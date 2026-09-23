# WobbleTone FX

A browser-based photo effects studio for building ordered, reusable filter stacks. Open an image, tune the effects with live controls, save presets, export a full-resolution PNG, or copy the stack as Filter Spec JSON — a portable, versioned description of the look that other tools (like Aimless) can render identically.

WobbleTone FX is an installable, offline-capable PWA with no build step.

## Effects

**Basic filters** — brightness, contrast, saturation, hue shift, sepia, grayscale, invert, blur, opacity, drop shadow

**Tone (pixel mappings)**: duotone, tritone, posterize, heatmap, Drama

**Light**: Bloom / Glow, with controls for neutral bloom, coloured glow, or warm halation; chromatic aberration

**Color** — color wash (12 blend modes), gradient wash

**Texture** — film grain, vignette, scanlines, prism light streak

**Stylize**: glitch, psychedelic, infrared, vintage

Effects run from top to bottom. Drag the grip handle to reorder any filter or overlay. Later effects operate on the complete result of earlier effects, including grain, vignette, bloom, washes, and tone maps.

## Presets

Presets are stored locally in IndexedDB as versioned Filter Spec records (`{id, name, spec}`). The Preset Library can rename, duplicate, load, and delete them, and can export or import the complete library as JSON — v2 records carry specs, v1 `{effects}` records migrate on read. Exported archives contain effect settings only, never the working photograph.

## Run it

The rendering engine lives in a separate repository, vendored here as a git submodule at `engine/`. Clone with submodules:

```bash
git clone --recurse-submodules https://github.com/robby3000/wobbletonefx.git
# or, in an existing clone:
git submodule update --init
```

No dependencies. Serve the folder with any static server:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`. For PWA install + service worker, HTTPS or localhost is required.

Tests: `npm test` (Node, no dependencies — exercises the spec bridge and preset/archive round-trips).

## Architecture

Rendering is engine-driven: a **Filter Specification** (`{format: "wobbletone-filter", version: 1, effects: [...]}`) is the semantic source of truth, and the shared CPU renderer at [`engine/`](./engine) ([wobbletone-engine](https://github.com/robby3000/wobbletone-engine)) interprets it into pixels. Preview and PNG export use the *same* render path — what you see is what you get, byte for byte, on every browser. There is no CSS `filter`, SVG filter, or DOM-clone pipeline anywhere in the render path, so nothing depends on browser-specific filter support (this is what fixed the old iOS export/preview failures).

- **Preview** renders to a single canvas at a capped resolution (~1600px) with incremental caching — only the effects after the first change re-render, so late-stack tweaks are near-instant.
- **Save PNG** renders the spec at native image resolution.
- **Code tab** emits the spec as pretty-printed JSON — paste it into Aimless's filter import, or anywhere else that speaks `wobbletone-filter`.
- `engine/` is a submodule — never edit it here; change it in wobbletone-engine and bump the pointer.

## Tech

Vanilla HTML/CSS/JS + Canvas 2D for pixel I/O only. All effect semantics live in the engine (pure JS, deterministic, Node-tested). No framework, build tool, or npm dependency.

## Notes

- **Preview accuracy**: new images are fitted in full, including portrait and square photographs. Tap the preview to toggle native 100% zoom around that position.
- **Preset archives**: switched-off layers are omitted from new presets and exported JSON, so archives describe only the active look.
- Images never leave the device (FileReader → data URL).
