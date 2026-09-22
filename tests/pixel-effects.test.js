import test from "node:test";
import assert from "node:assert/strict";
import {
  transformPixelData,
  posterizeByte,
  dramaSettings,
  buildDramaLayer,
  buildGlitchBands,
  buildGlitchLayer,
} from "../app.js";

function pixels(values, width = values.length) {
  return { data: new Uint8ClampedArray(values.flat()), width, height: values.length / width };
}

function apply(imageData, effect, params) {
  return transformPixelData(imageData, effect, params, imageData.width, imageData.height);
}

test("duotone maps black to shadow and white to adjusted highlight", () => {
  const image = pixels([[0, 0, 0, 91], [255, 255, 255, 173]]);
  apply(image, "duotone", { shadow: "#102030", highlight: "#e0d0c0", contrast: 0 });
  assert.deepEqual([...image.data], [16, 32, 48, 91, 224, 208, 192, 173]);
});

test("tritone maps midpoint luminance to the midtone", () => {
  const image = pixels([[128, 128, 128, 255]]);
  apply(image, "tritone", { shadow: "#000000", mid: "#804020", highlight: "#ffffff" });
  assert.ok(Math.abs(image.data[0] - 128) <= 1);
  assert.ok(Math.abs(image.data[1] - 64) <= 1);
  assert.ok(Math.abs(image.data[2] - 32) <= 1);
});

test("posterize uses SVG discrete-table band boundaries", () => {
  assert.equal(posterizeByte(0, 4), 0);
  assert.equal(posterizeByte(63, 4), 0);
  assert.equal(posterizeByte(64, 4), 85);
  assert.equal(posterizeByte(255, 4), 255);
});

test("heatmap preserves alpha", () => {
  const image = pixels([[120, 80, 40, 37]]);
  apply(image, "heatmap", { intensity: 100 });
  assert.equal(image.data[3], 37);
  assert.notDeepEqual([...image.data.slice(0, 3)], [120, 80, 40]);
});

test("chromatic aberration shifts red and blue in opposing directions", () => {
  const image = pixels([
    [10, 1, 20, 255],
    [30, 2, 40, 255],
    [50, 3, 60, 255],
  ], 3);
  apply(image, "chromatic", { offset: 1, strength: 100 });
  assert.deepEqual([...image.data], [10, 1, 40, 255, 10, 2, 60, 255, 30, 3, 60, 255]);
});

test("Drama at zero strength is neutral and preserves alpha", () => {
  const image = pixels([[90, 140, 210, 73]]);
  apply(image, "drama", { style: "Cinematic", strength: 0, shadows: 0, highlights: 0, saturation: 100 });
  assert.deepEqual([...image.data], [90, 140, 210, 73]);
});

test("Drama looks produce distinct controlled tone mappings", () => {
  const source = [70, 130, 205, 111];
  const cinematic = pixels([source]);
  const noir = pixels([source]);
  apply(cinematic, "drama", { style: "Cinematic", strength: 100, shadows: 0, highlights: 0, saturation: 100 });
  apply(noir, "drama", { style: "Noir", strength: 100, shadows: 0, highlights: 0, saturation: 100 });
  assert.equal(cinematic.data[3], 111);
  assert.equal(noir.data[3], 111);
  assert.notDeepEqual([...cinematic.data.slice(0, 3)], [...noir.data.slice(0, 3)]);
  assert.ok(Math.max(...noir.data.slice(0, 3)) - Math.min(...noir.data.slice(0, 3)) <= 1);
});

test("Drama shadow and highlight controls move the intended tonal ranges", () => {
  const lifted = pixels([[30, 30, 30, 255], [225, 225, 225, 255]], 2);
  const crushed = pixels([[30, 30, 30, 255], [225, 225, 225, 255]], 2);
  apply(lifted, "drama", { style: "Portrait", strength: 100, shadows: 50, highlights: 50, saturation: 100 });
  apply(crushed, "drama", { style: "Portrait", strength: 100, shadows: -50, highlights: -50, saturation: 100 });
  assert.ok(lifted.data[0] > crushed.data[0]);
  assert.ok(lifted.data[4] > crushed.data[4]);
});

test("Drama SVG builder is deterministic and uses sRGB table curves", () => {
  const params = { style: "Storm", strength: 75, shadows: -10, highlights: -15, saturation: 90 };
  const first = buildDramaLayer(params, "drama-test");
  const second = buildDramaLayer(params, "drama-test");
  assert.deepEqual(first, second);
  assert.equal(first.ref, "url(#drama-test)");
  assert.match(first.def, /id="drama-test"/);
  assert.match(first.def, /color-interpolation-filters="sRGB"/);
  assert.match(first.def, /<feColorMatrix type="saturate"/);
  assert.equal((first.def.match(/<feFunc[RGB]/g) || []).length, 3);
  assert.equal(dramaSettings(params).tables[0].length, 17);
});

test("Glitch is neutral at zero amount and preserves alpha", () => {
  const values = Array.from({ length: 64 }, (_, index) => [index * 3, 255 - index * 2, index * 4, 40 + index]);
  const image = pixels(values, 8);
  const original = [...image.data];
  apply(image, "glitch", { style: "CCD Failure", amount: 0, bandSize: 28, split: 12, seed: 317 });
  assert.deepEqual([...image.data], original);

  apply(image, "glitch", { style: "Signal Loss", amount: 100, bandSize: 12, split: 10, seed: 92 });
  for (let index = 3; index < image.data.length; index += 4) assert.equal(image.data[index], original[index]);
});

test("Glitch output and band structure are deterministic by seed", () => {
  const params = { style: "VHS Tear", amount: 88, bandSize: 16, split: 9, seed: 451 };
  assert.deepEqual(buildGlitchBands(params, 8, 8), buildGlitchBands(params, 8, 8));
  const fullSizeBands = buildGlitchBands(params, 800, 600).bands.length;
  assert.ok(fullSizeBands >= 20 && fullSizeBands <= 50);
  const values = Array.from({ length: 64 }, (_, index) => [index * 4, index * 2, 255 - index * 3, 255]);
  const first = pixels(values, 8);
  const second = pixels(values, 8);
  const different = pixels(values, 8);
  apply(first, "glitch", params);
  apply(second, "glitch", params);
  apply(different, "glitch", { ...params, seed: 452 });
  assert.deepEqual([...first.data], [...second.data]);
  assert.notDeepEqual([...first.data], [...different.data]);
});

test("Glitch SVG builder is deterministic and horizontally constrained", () => {
  const params = { style: "RGB Fracture", amount: 70, bandSize: 24, split: 8, seed: 808 };
  const first = buildGlitchLayer(params, "glitch-test");
  const second = buildGlitchLayer(params, "glitch-test");
  assert.deepEqual(first, second);
  assert.equal(first.ref, "url(#glitch-test)");
  assert.match(first.def, /id="glitch-test"/);
  assert.match(first.def, /color-interpolation-filters="sRGB"/);
  assert.match(first.def, /<feTurbulence/);
  assert.match(first.def, /<feDisplacementMap/);
  assert.match(first.def, /yChannelSelector="G"/);
  assert.match(first.def, /seed="808"/);
  assert.doesNotMatch(first.def, /feCrop/);
});

test("custom effects are order-sensitive", () => {
  const source = [90, 140, 210, 255];
  const first = pixels([source]);
  apply(first, "posterize", { steps: 3 });
  apply(first, "duotone", { shadow: "#102030", highlight: "#e0a060", contrast: 0 });

  const second = pixels([source]);
  apply(second, "duotone", { shadow: "#102030", highlight: "#e0a060", contrast: 0 });
  apply(second, "posterize", { steps: 3 });

  assert.notDeepEqual([...first.data], [...second.data]);
});

test("Drama remains order-sensitive with existing tone effects", () => {
  const params = { style: "Bleach", strength: 85, shadows: -10, highlights: 15, saturation: 80 };
  const first = pixels([[90, 140, 210, 255]]);
  apply(first, "drama", params);
  apply(first, "posterize", { steps: 4 });

  const second = pixels([[90, 140, 210, 255]]);
  apply(second, "posterize", { steps: 4 });
  apply(second, "drama", params);
  assert.notDeepEqual([...first.data], [...second.data]);
});

test("Glitch remains order-sensitive with existing tone effects", () => {
  const params = { style: "CCD Failure", amount: 90, bandSize: 12, split: 8, seed: 91 };
  const values = Array.from({ length: 64 }, (_, index) => [index * 4, 255 - index * 3, index * 2, 255]);
  const first = pixels(values, 8);
  apply(first, "glitch", params);
  apply(first, "posterize", { steps: 4 });

  const second = pixels(values, 8);
  apply(second, "posterize", { steps: 4 });
  apply(second, "glitch", params);
  assert.notDeepEqual([...first.data], [...second.data]);
});
