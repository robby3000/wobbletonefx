# WobbleTone FX

A browser-based photo effects studio for building ordered, reusable filter stacks. Open an image, tune the effects with live controls, save presets, export a full-resolution PNG, or copy standalone HTML and CSS.

WobbleTone FX is an installable, offline-capable PWA with no build step.

## Effects

**Basic filters** — brightness, contrast, saturation, hue shift, sepia, grayscale, invert, blur, opacity, drop shadow

**Tone (SVG and pixel mappings)**: duotone, tritone, posterize, heatmap, Drama

**Light**: Bloom / Glow, with controls for neutral bloom, coloured glow, or warm halation; chromatic aberration

**Color** — color wash (12 blend modes), gradient wash

**Texture** — film grain, vignette, scanlines, prism light streak

**Stylize**: glitch, psychedelic (animated hue), infrared, vintage

Effects run from top to bottom. Drag the grip handle to reorder any filter or overlay. Later effects operate on the complete result of earlier effects, including grain, vignette, bloom, washes, and tone maps.

## Presets

Presets are stored locally in IndexedDB. The Preset Library can rename, duplicate, load, and delete them, and can export or import the complete library as versioned JSON. Exported archives contain effect settings only, never the working photograph.

## Run it

No dependencies. Serve the folder with any static server:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`. For PWA install + service worker, HTTPS or localhost is required.

## Tech

Vanilla HTML/CSS/JS, SVG filters (`feColorMatrix`, `feComponentTransfer`), Canvas 2D, CSS `filter`, and `mix-blend-mode`. No framework, build tool, or npm dependency.

## Notes

- **Save PNG** runs the same ordered stack at native image resolution. Custom tone maps use direct pixel processing during export, avoiding unreliable SVG `url()` filters in Canvas on mobile browsers.
- **Preview accuracy**: new images are fitted in full, including portrait and square photographs. Tap the preview to toggle native 100% zoom around that position. Pixel-based effect parameters scale with the current view.
- **Preset archives**: switched-off layers are omitted from new presets and exported JSON, so archives describe only the active look.
- Images never leave the device (FileReader → data URL).
- The generated code is self-contained: deterministic SVG filter definitions, ordered effect markup, an embedded 64 x 64 film-grain tile when needed, and a focused `<style>` block. Bloom / Glow reports when full-fidelity output expands the markup.
