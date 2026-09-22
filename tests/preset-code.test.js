import test from "node:test";
import assert from "node:assert/strict";

import {
  migrateEffectData,
  normalizePresetRecord,
  buildPresetArchive,
  parsePresetArchive,
  serializeEffects,
  effectsToSpec,
  specToEffects,
  specToJson,
  escapeHtmlAttribute,
  calculatePreviewLayout,
} from "../app.js";

test("legacy Glow and Halation effects migrate to Bloom / Glow", () => {
  assert.deepEqual(migrateEffectData({
    defId: "glow",
    enabled: true,
    params: { color: "#abcdef", blur: 9, brightness: 175, opacity: 44 },
  }), {
    defId: "bloom",
    enabled: true,
    params: {
      blur: 9,
      threshold: 175,
      contrast: 100,
      saturate: 130,
      opacity: 44,
      color: "#abcdef",
      tint: 100,
      blend: "screen",
    },
  });

  assert.deepEqual(migrateEffectData({
    defId: "halation",
    params: { color: "#ff5500", blur: 22, threshold: 165, opacity: 52 },
  }).params, {
    blur: 22,
    threshold: 165,
    contrast: 200,
    saturate: 100,
    opacity: 52,
    color: "#ff5500",
    tint: 100,
    blend: "lighten",
  });
});

test("preset normalization fills new Bloom parameters without losing old settings", () => {
  const preset = normalizePresetRecord({
    id: "old-bloom",
    name: "Old Bloom",
    createdAt: 100,
    effects: [{ defId: "bloom", enabled: true, params: { blur: 14, threshold: 150, opacity: 40 } }],
  });
  assert.equal(preset.spec.effects[0].type, "bloom");
  assert.deepEqual(preset.spec.effects[0].params, {
    blur: 14,
    threshold: 150,
    contrast: 180,
    saturate: 100,
    opacity: 40,
    color: "#ffffff",
    tint: 0,
    blend: "screen",
  });
  assert.equal(preset.updatedAt, 100);
});

test("preset archives are versioned, round-trip, and reject unsupported input", () => {
  const records = [{
    id: "one",
    name: "One",
    createdAt: 100,
    updatedAt: 200,
    effects: [{ defId: "contrast", enabled: true, params: { v: 120 } }],
  }];
  const archive = buildPresetArchive(records, "2026-08-28T12:00:00.000Z");
  assert.equal(archive.schema, "wobbletone-presets");
  assert.equal(archive.version, 2);
  assert.deepEqual(parsePresetArchive(JSON.stringify(archive)), archive);
  assert.throws(() => parsePresetArchive({ schema: "other", version: 2, presets: [] }), /not a supported/);
  assert.throws(() => normalizePresetRecord({ name: "Broken", effects: [{ defId: "missing", params: {} }] }), /unknown effect/);
});

test("v1 preset records migrate to spec (incl. glow/halation → bloom)", () => {
  const preset = normalizePresetRecord({
    id: "legacy",
    name: "Legacy",
    createdAt: 50,
    effects: [
      { defId: "glow", enabled: true, params: { color: "#abcdef", blur: 9, brightness: 175, opacity: 44 } },
      { defId: "contrast", enabled: false, params: { v: 200 } }, // dropped: disabled
      { defId: "grain", enabled: true, params: { size: 1, opacity: 20, blend: "overlay" } },
    ],
  });
  assert.equal(preset.spec.format, "wobbletone-filter");
  assert.equal(preset.spec.version, 1);
  assert.deepEqual(preset.spec.effects.map((e) => e.type), ["bloom", "grain"]);
  assert.equal(preset.spec.effects[0].params.threshold, 175); // brightness → threshold
  assert.equal(preset.spec.effects[0].params.blend, "screen");
  assert.equal(preset.spec.effects[1].params.seed, 1);         // seed filled for determinism
  assert.equal(preset.effects, undefined);                     // v2 shape: spec only
});

test("v2 preset records pass through spec validation", () => {
  const spec = effectsToSpec([{ defId: "contrast", enabled: true, params: { v: 999 } }], "clamped");
  assert.equal(spec.effects[0].params.v, 200); // specFromLegacy clamps
  const preset = normalizePresetRecord({ id: "v2", name: "V2", createdAt: 5, spec });
  assert.equal(preset.spec.effects[0].params.v, 200);
  assert.equal(preset.spec.name, "clamped");
});

test("v1 archives import and migrate on read", () => {
  const v1Archive = {
    schema: "wobbletone-presets",
    version: 1,
    exportedAt: "2026-08-28T12:00:00.000Z",
    presets: [{
      id: "old",
      name: "Old",
      createdAt: 100,
      updatedAt: 200,
      effects: [{ defId: "halation", params: { color: "#ff5500", blur: 22, threshold: 165, opacity: 52 } }],
    }],
  };
  const parsed = parsePresetArchive(JSON.stringify(v1Archive));
  assert.equal(parsed.version, 2);
  assert.equal(parsed.presets[0].spec.effects[0].type, "bloom");
  assert.equal(parsed.presets[0].spec.effects[0].params.blend, "lighten");
});

test("import rejects specs with unknown effect types", () => {
  const bad = {
    schema: "wobbletone-presets",
    version: 2,
    presets: [{
      id: "x", name: "X", createdAt: 1,
      spec: { format: "wobbletone-filter", version: 1, effects: [{ type: "teleport", params: {} }] },
    }],
  };
  assert.throws(() => parsePresetArchive(JSON.stringify(bad)), /teleport|unknown/i);
});

test("specToEffects restores a spec into runtime effect records", () => {
  const spec = effectsToSpec([
    { defId: "duotone", enabled: true, params: { shadow: "#112233", highlight: "#ffeecc", contrast: 30 } },
    { defId: "vignette", enabled: true, params: { color: "#000000", size: 60, opacity: 50 } },
  ], "RT");
  const effects = specToEffects(spec);
  assert.equal(effects.length, 2);
  assert.equal(effects[0].defId, "duotone");
  assert.equal(effects[1].defId, "vignette");
  assert.ok(effects.every((e) => e.enabled));
  assert.throws(() => specToEffects({ format: "wobbletone-filter", version: 1, effects: [{ type: "nope", params: {} }] }));
});

test("enabled-only serialization removes switched-off effects from saves and archives", () => {
  const effects = [
    { defId: "contrast", enabled: true, params: { v: 120 } },
    { defId: "grain", enabled: false, params: { size: 1, opacity: 20, blend: "overlay" } },
  ];
  assert.deepEqual(serializeEffects(effects, true).map((effect) => effect.defId), ["contrast"]);
  const archive = buildPresetArchive([{
    id: "mixed",
    name: "Mixed",
    createdAt: 100,
    updatedAt: 100,
    effects,
  }], "2026-08-28T12:00:00.000Z");
  assert.deepEqual(archive.presets[0].spec.effects.map((effect) => effect.type), ["contrast"]);
});

test("preview fit layout contains portrait, square, and landscape images", () => {
  assert.deepEqual(calculatePreviewLayout(400, 300, 1000, 2000), {
    width: 150,
    height: 300,
    x: 125,
    y: 0,
    absoluteScale: 0.15,
    transformScale: 1,
  });
  assert.deepEqual(calculatePreviewLayout(400, 300, 1000, 1000), {
    width: 300,
    height: 300,
    x: 50,
    y: 0,
    absoluteScale: 0.3,
    transformScale: 1,
  });
  assert.deepEqual(calculatePreviewLayout(400, 300, 2000, 1000), {
    width: 400,
    height: 200,
    x: 0,
    y: 50,
    absoluteScale: 0.2,
    transformScale: 1,
  });
});

test("preview zoom uses native scale, centres the selected point, and fills the frame", () => {
  const layout = calculatePreviewLayout(400, 300, 1000, 2000, true, { x: 0.25, y: 0.75 });
  assert.equal(layout.absoluteScale, 1);
  assert.equal(layout.transformScale, 1 / 0.15);
  assert.equal(layout.x, -50);
  assert.equal(layout.y, -1350);
  assert.ok(1000 * layout.absoluteScale >= 400);
  assert.ok(2000 * layout.absoluteScale >= 300);

  const small = calculatePreviewLayout(400, 300, 100, 100, true, { x: 0.5, y: 0.5 });
  assert.equal(small.absoluteScale, 4);
  assert.equal(small.x, 0);
  assert.equal(small.y, -50);
});

test("Drama presets round-trip into spec params unchanged", () => {
  const params = { style: "Cinematic", strength: 70, shadows: 0, highlights: 0, saturation: 100 };
  const preset = normalizePresetRecord({
    id: "drama-preset",
    name: "Drama Preset",
    createdAt: 100,
    effects: [{ defId: "drama", enabled: true, params }],
  });
  assert.deepEqual(preset.spec.effects[0].params, params);
});

test("Glitch presets round-trip into spec params unchanged", () => {
  const params = { style: "CCD Failure", amount: 42, bandSize: 28, split: 6, seed: 317 };
  const preset = normalizePresetRecord({
    id: "glitch-preset",
    name: "Glitch Preset",
    createdAt: 100,
    effects: [{ defId: "glitch", enabled: true, params }],
  });
  assert.deepEqual(preset.spec.effects[0].params, params);
});

test("spec JSON output is pretty-printed and round-trips", () => {
  const spec = effectsToSpec([
    { defId: "contrast", enabled: true, params: { v: 130 } },
    { defId: "grain", enabled: true, params: { size: 1, opacity: 20, blend: "overlay" } },
  ], "json-test");
  const json = specToJson(spec);
  assert.ok(json.endsWith("\n"));
  assert.match(json, /\n  "format": "wobbletone-filter",/); // 2-space indent
  const parsed = JSON.parse(json);
  assert.equal(parsed.format, "wobbletone-filter");
  assert.equal(parsed.version, 1);
  assert.equal(parsed.name, "json-test");
  assert.deepEqual(parsed.effects, spec.effects);
  assert.equal(parsed.effects.length, 2);
});

test("attribute escaping handles all HTML-significant characters", () => {
  assert.equal(escapeHtmlAttribute('a&"<>'), "a&amp;&quot;&lt;&gt;");
});
