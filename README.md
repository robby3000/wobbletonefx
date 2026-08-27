# WobbleTone FX

A CSS photo effect playground for building unique, stackable image filters in the browser. Upload an image, stack effects with live sliders, then copy the generated CSS+HTML into your own app.

Works as an installable PWA — mobile-first, offline-capable, no build step.

## Effects

**Basic filters** — brightness, contrast, saturation, hue shift, sepia, grayscale, invert, blur, opacity, drop shadow

**Tone (SVG gradient maps)** — duotone, tritone, posterize, heatmap

**Light** — glow, halation (film-style warm bloom), bloom, chromatic aberration

**Color** — color wash (12 blend modes), gradient wash

**Texture** — film grain, vignette, scanlines, prism light streak

**Stylize** — psychedelic (animated hue), infrared, vintage

Effects run from top to bottom. Drag the grip handle to reorder any filter or overlay. Later effects operate on the complete result of earlier effects, including grain, vignette, glow, washes, and tone maps.

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
- **Preview accuracy** — pixel-based effect parameters (blur radius, grain tile size, scanline spacing, drop-shadow offsets) are automatically scaled in the live preview to match what the native-resolution export will look like. The generated code uses the correct full-resolution values.
- Images never leave the device (FileReader → data URL).
- The generated code is self-contained: SVG filter defs, the image with inline `filter`, overlay divs, and a `<style>` block.
