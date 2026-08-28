const test = require("node:test");
const assert = require("node:assert/strict");

const {
  migrateEffectData,
  normalizePresetRecord,
  buildPresetArchive,
  parsePresetArchive,
  serializeEffects,
  escapeHtmlAttribute,
  buildDramaLayer,
  buildGeneratedCode,
  calculatePreviewLayout,
} = require("../app.js");

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
  assert.deepEqual(preset.effects[0].params, {
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
  assert.equal(archive.version, 1);
  assert.deepEqual(parsePresetArchive(JSON.stringify(archive)), archive);
  assert.throws(() => parsePresetArchive({ schema: "other", version: 1, presets: [] }), /not a supported/);
  assert.throws(() => normalizePresetRecord({ name: "Broken", effects: [{ defId: "missing", params: {} }] }), /unknown effect/);
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
  assert.deepEqual(archive.presets[0].effects.map((effect) => effect.defId), ["contrast"]);
  assert.ok(archive.presets[0].effects.every((effect) => effect.enabled));
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

test("Drama presets round-trip and generated code uses deterministic IDs", () => {
  const params = { style: "Cinematic", strength: 70, shadows: 0, highlights: 0, saturation: 100 };
  const preset = normalizePresetRecord({
    id: "drama-preset",
    name: "Drama Preset",
    createdAt: 100,
    effects: [{ defId: "drama", enabled: true, params }],
  });
  assert.deepEqual(preset.effects[0].params, params);
  const operation = { effect: "drama", params, layer: buildDramaLayer(params, "runtime-id") };
  const output = buildGeneratedCode([operation], "image.jpg");
  assert.match(output.html, /id="wt-drama-1"/);
  assert.match(output.html, /filter:url\(#wt-drama-1\)/);
  assert.doesNotMatch(output.html, /runtime-id/);
});

test("generated code escapes image attributes and omits unused animation CSS", () => {
  const output = buildGeneratedCode([{
    effect: "contrast",
    params: { v: 120 },
    layer: { kind: "filter", filter: "contrast(120%)" },
  }], 'photo"<&.jpg');
  assert.match(output.html, /src="photo&quot;&lt;&amp;\.jpg"/);
  assert.match(output.html, /alt=""/);
  assert.doesNotMatch(output.css, /@keyframes/);
  assert.equal(output.derivedCount, 0);
});

test("generated SVG IDs are deterministic", () => {
  const operation = {
    effect: "posterize",
    params: { steps: 4 },
    layer: { kind: "svg", ref: "url(#random)", def: '<filter id="random"></filter>' },
  };
  const first = buildGeneratedCode([operation], "image.jpg");
  const second = buildGeneratedCode([operation], "image.jpg");
  assert.equal(first.all, second.all);
  assert.match(first.html, /id="wt-posterize-1"/);
  assert.match(first.html, /filter:url\(#wt-posterize-1\)/);
  assert.doesNotMatch(first.html, /random/);
});

test("generated grain is embedded once and Bloom reports derived markup", () => {
  const grain = {
    effect: "grain",
    params: { size: 1, opacity: 20, blend: "overlay" },
    layer: { kind: "overlay", special: "grain", opacity: 20, blend: "overlay" },
  };
  const bloom = {
    effect: "bloom",
    params: {},
    layer: {
      kind: "overlay",
      useImage: true,
      imgFilter: "brightness(140%) contrast(180%) blur(12px)",
      bg: "#ff7700",
      bgBlend: "color",
      bgOpacity: 50,
      blend: "screen",
      opacity: 40,
    },
  };
  const output = buildGeneratedCode([grain, bloom], "image.jpg");
  assert.equal((output.all.match(/data:image\/png;base64/g) || []).length, 1);
  assert.match(output.html, /background-image:var\(--wt-grain\)/);
  assert.match(output.html, /background-size:64px/);
  assert.match(output.html, /background:#ff7700;mix-blend-mode:color;opacity:0\.5/);
  assert.equal(output.derivedCount, 1);
});

test("attribute escaping handles all HTML-significant characters", () => {
  assert.equal(escapeHtmlAttribute('a&"<>'), "a&amp;&quot;&lt;&gt;");
});
