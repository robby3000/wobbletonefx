# WobbleTone FX — Agent Notes

A zero-dependency, no-build photo filter lab. Stack effects, preview on a canvas,
export full-resolution PNGs, save named presets (IndexedDB), copy/import Filter
Spec JSON. All pixels come from the shared `wobbletone-engine` submodule — this
app owns UI only, never pixel semantics.

## Commands

- Tests: `npm test` → `node --test tests/*.test.js`
- Dev: serve the repo root, e.g. `python3 -m http.server 8124`
- **Bump `CACHE_VERSION` in `service-worker.js` on every shipped change.** The SW
  precaches `ASSETS` explicitly — if you add a file (including a new engine
  module), add it to the list or it won't exist offline.
- Engine submodule lives at `engine/`. **Never edit it in place** — change the
  `wobbletone-engine` repo, push, then `cd engine && git fetch && git checkout <sha>`.

## Architecture

```
Filter Spec JSON (the source of truth)
  { format: "wobbletone-filter", version: 1, name, effects: [{ type, params }] }
        │  strict-order execution; unknown types rejected;
        │  out-of-range numbers clamped; unknown keys ignored
        ▼
renderBuffer(buffer, spec, opts)        engine/render.js
        │  buffer = { data: Uint8ClampedArray, width, height }
        │  RGBA straight alpha, sRGB-encoded
        ▼
registry.js  →  EFFECTS[type].apply(buffer, params, ctx)
```

- **Resolution model**: pixel params (`blur.v`, `glitch.split`, …) are flagged
  `px: true` in the registry and arrive at `apply()` already multiplied by
  `renderScale = buffer.width / sourceWidth`. Derived non-param displacements
  scale via `ctx.renderScale`. Preview (~1600px) and export (native res) are
  the same render code path — that's the parity guarantee.
- **Incremental preview**: `incremental.js` caches intermediate buffers; editing
  effect N re-renders only from N onward. Cache-retained buffers must never be
  pooled/recycled.
- **Determinism**: seeded RNG only (`rng.js`), golden hashes in
  `test/golden.test.js` pin every effect's output. Re-pin only on intended
  changes (`scripts/dump-golden.mjs` regenerates fixtures; update `EXPECTED`
  from test output).
- No CSS filters, no SVG filters, no `ctx.filter` — Safari/iOS silently dropped
  them, which is why this architecture exists.

## Adding an effect

1. Engine repo: implement `apply(buffer, params)` in the right `effects/*.js`
   module (or a new one — register it in `ASSETS` in both consumers' service
   workers if so). Pure function over the buffer; mark spatial params `px: true`.
2. Register in `registry.js` with category + param table (`num/sel/col/stops`).
3. Engine tests + a golden case in `test/fixtures.js`; bump `version.js` and the
   sanity-test pin. `npm test` → `node --test`.
4. Push engine. Bump the submodule here **and** in `aimless/public/lib/engine`.
5. Catalog entry in `app.js` `EFFECT_CATALOG`: `id` = registry type, params map
   `key` → spec param name; types `slider | select | color`.
6. Whitelist the type + defaults in `aimless/public/lib/filters.js`
   `EFFECT_DEFAULTS` so legacy `{effects}` presets import.
7. Bump `CACHE_VERSION` here; `npm run stamp` in aimless.

Compound recipes (e.g. `psychedelic`) live in `effects/compound.js` and expand
to primitives — prefer that over new monolithic math when the look is a
composition of existing ops.

## Conventions

- Vanilla ES modules, no framework, no bundler, no dependencies.
- One logical change per commit. Test suite must stay green.
- UI element names for design discussion: `docs/20260924-wobbletone-guide-ui-names.md`.
- `docs/` is gitignored local planning material.
- Drag reorder uses Pointer Events — **do not reintroduce HTML5 drag-and-drop**;
  iOS Safari doesn't support it.
