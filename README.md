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

Effects stack in order — drag the grip handle to reorder layers. Subtle effects (grain, vignette) sit naturally on top of bolder ones (duotone, psychedelic); reorder to taste.

## Run it

No dependencies. Serve the folder with any static server:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`. For PWA install + service worker, HTTPS or localhost is required.

## Tech

Vanilla HTML/CSS/JS, SVG filters (`feColorMatrix`, `feComponentTransfer`, `feTurbulence`), CSS `filter`, `mix-blend-mode`, `background-blend-mode`. No framework, no build tool, no npm.

## Notes

- **Save PNG** exports the full composited image — base image with all filter/SVG filter layers plus all overlay layers (glow, halation, grain, vignette, etc.) — via canvas. Blend modes are mapped to canvas `globalCompositeOperation`.
- **Preview accuracy** — pixel-based effect parameters (blur radius, grain tile size, scanline spacing, drop-shadow offsets) are automatically scaled in the live preview to match what the native-resolution export will look like. The generated code uses the correct full-resolution values.
- Images never leave the device (FileReader → data URL).
- The generated code is self-contained: SVG filter defs, the image with inline `filter`, overlay divs, and a `<style>` block.
