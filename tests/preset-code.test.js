const test = require("node:test");
const assert = require("node:assert/strict");

const {
  migrateEffectData,
  normalizePresetRecord,
  buildPresetArchive,
  parsePresetArchive,
  escapeHtmlAttribute,
  buildGeneratedCode,
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
