"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { transformPixelData, posterizeByte } = require("../app.js");

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
