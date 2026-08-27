/* ===== WobbleTone FX — app.js ===== */
"use strict";

/* ---------- Utilities ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const uid = () => Math.random().toString(36).slice(2, 9);

const hexToRgb = (hex) => {
  const m = hex.replace("#", "");
  const v = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
};
const rgb01 = (hex) => hexToRgb(hex).map((v) => (v / 255).toFixed(3));
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function showToast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => (t.hidden = true), 1800);
}

/* ---------- Effect Catalog ----------
 * Each effect: { id, name, icon, desc, category, type, params, build }
 * type: 'filter' (adds to img filter chain) | 'overlay' (layer div) | 'svg' (SVG filter on img)
 * build(params) returns a layer descriptor:
 *   filter  -> { kind:'filter', filter:'brightness(120%)' }
 *   svg     -> { kind:'svg', id, def:'<filter>…</filter>', ref:'url(#id)' }
 *   overlay -> { kind:'overlay', bg, blend, opacity, filter, useImage, imgFilter, anim }
 */
const EFFECT_CATALOG = [
  /* ---- Basic CSS filters ---- */
  {
    id: "brightness", name: "Brightness", icon: "☀️", desc: "Lighten or darken", category: "Basic", type: "filter",
    params: [{ key: "v", label: "Level", type: "slider", min: 0, max: 200, step: 1, default: 110, unit: "%" }],
    build: (p) => ({ kind: "filter", filter: `brightness(${p.v}%)` }),
  },
  {
    id: "contrast", name: "Contrast", icon: "◐", desc: "Punch up or flatten", category: "Basic", type: "filter",
    params: [{ key: "v", label: "Level", type: "slider", min: 0, max: 200, step: 1, default: 110, unit: "%" }],
    build: (p) => ({ kind: "filter", filter: `contrast(${p.v}%)` }),
  },
  {
    id: "saturate", name: "Saturation", icon: "🎨", desc: "Color intensity", category: "Basic", type: "filter",
    params: [{ key: "v", label: "Level", type: "slider", min: 0, max: 300, step: 1, default: 120, unit: "%" }],
    build: (p) => ({ kind: "filter", filter: `saturate(${p.v}%)` }),
  },
  {
    id: "hue", name: "Hue Shift", icon: "🌈", desc: "Rotate the color wheel", category: "Basic", type: "filter",
    params: [{ key: "v", label: "Angle", type: "slider", min: 0, max: 360, step: 1, default: 0, unit: "°" }],
    build: (p) => ({ kind: "filter", filter: `hue-rotate(${p.v}deg)` }),
  },
  {
    id: "sepia", name: "Sepia", icon: "📜", desc: "Warm vintage wash", category: "Basic", type: "filter",
    params: [{ key: "v", label: "Amount", type: "slider", min: 0, max: 100, step: 1, default: 60, unit: "%" }],
    build: (p) => ({ kind: "filter", filter: `sepia(${p.v}%)` }),
  },
  {
    id: "grayscale", name: "Grayscale", icon: "⚫", desc: "Desaturate to B&W", category: "Basic", type: "filter",
    params: [{ key: "v", label: "Amount", type: "slider", min: 0, max: 100, step: 1, default: 100, unit: "%" }],
    build: (p) => ({ kind: "filter", filter: `grayscale(${p.v}%)` }),
  },
  {
    id: "invert", name: "Invert", icon: "🔄", desc: "Negate colors", category: "Basic", type: "filter",
    params: [{ key: "v", label: "Amount", type: "slider", min: 0, max: 100, step: 1, default: 100, unit: "%" }],
    build: (p) => ({ kind: "filter", filter: `invert(${p.v}%)` }),
  },
  {
    id: "blur", name: "Blur", icon: "💨", desc: "Gaussian softening", category: "Basic", type: "filter",
    params: [{ key: "v", label: "Radius", type: "slider", min: 0, max: 20, step: 0.1, default: 1, unit: "px" }],
    build: (p) => ({ kind: "filter", filter: `blur(${p.v}px)` }),
  },
  {
    id: "opacity", name: "Opacity", icon: "👁", desc: "Fade through", category: "Basic", type: "filter",
    params: [{ key: "v", label: "Level", type: "slider", min: 0, max: 100, step: 1, default: 80, unit: "%" }],
    build: (p) => ({ kind: "filter", filter: `opacity(${p.v}%)` }),
  },

  /* ---- Duotone / Tritone (SVG) ---- */
  {
    id: "duotone", name: "Duotone", icon: "双色", desc: "Two-tone gradient map", category: "Tone", type: "svg",
    params: [
      { key: "shadow", label: "Shadow color", type: "color", default: "#1a0d3d" },
      { key: "highlight", label: "Highlight color", type: "color", default: "#ff5c8a" },
      { key: "contrast", label: "Contrast", type: "slider", min: 0, max: 100, step: 1, default: 20, unit: "%" },
    ],
    build: (p, id) => {
      const [sr, sg, sb] = rgb01(p.shadow), [hr, hg, hb] = rgb01(p.highlight);
      const c = p.contrast / 100;
      const lift = (x) => (x - 0.5) * (1 + c) + 0.5;
      const def = `<filter id="${id}" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0.299 0.587 0.114 0 0  0.299 0.587 0.114 0 0  0.299 0.587 0.114 0 0  0 0 0 1 0" result="g"/><feComponentTransfer in="g"><feFuncR type="table" tableValues="${sr} ${clamp(lift(hr),0,1).toFixed(3)}"/><feFuncG type="table" tableValues="${sg} ${clamp(lift(hg),0,1).toFixed(3)}"/><feFuncB type="table" tableValues="${sb} ${clamp(lift(hb),0,1).toFixed(3)}"/></feComponentTransfer></filter>`;
      return { kind: "svg", id, def, ref: `url(#${id})` };
    },
  },
  {
    id: "tritone", name: "Tritone", icon: "三色", desc: "Three-tone gradient map", category: "Tone", type: "svg",
    params: [
      { key: "shadow", label: "Shadow", type: "color", default: "#0b1d3a" },
      { key: "mid", label: "Midtone", type: "color", default: "#c44d4d" },
      { key: "highlight", label: "Highlight", type: "color", default: "#ffe8a3" },
    ],
    build: (p, id) => {
      const [sr, sg, sb] = rgb01(p.shadow), [mr, mg, mb] = rgb01(p.mid), [hr, hg, hb] = rgb01(p.highlight);
      const def = `<filter id="${id}" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0.299 0.587 0.114 0 0  0.299 0.587 0.114 0 0  0.299 0.587 0.114 0 0  0 0 0 1 0" result="g"/><feComponentTransfer in="g"><feFuncR type="table" tableValues="${sr} ${mr} ${hr}"/><feFuncG type="table" tableValues="${sg} ${mg} ${hg}"/><feFuncB type="table" tableValues="${sb} ${mb} ${hb}"/></feComponentTransfer></filter>`;
      return { kind: "svg", id, def, ref: `url(#${id})` };
    },
  },
  {
    id: "posterize", name: "Posterize", icon: "🔲", desc: "Banded color steps", category: "Tone", type: "svg",
    params: [{ key: "steps", label: "Levels", type: "slider", min: 2, max: 16, step: 1, default: 5, unit: "" }],
    build: (p, id) => {
      const n = clamp(Math.round(p.steps), 2, 16);
      const vals = Array.from({ length: n }, (_, i) => (i / (n - 1)).toFixed(3)).join(" ");
      const def = `<filter id="${id}" color-interpolation-filters="sRGB"><feComponentTransfer><feFuncR type="discrete" tableValues="${vals}"/><feFuncG type="discrete" tableValues="${vals}"/><feFuncB type="discrete" tableValues="${vals}"/></feComponentTransfer></filter>`;
      return { kind: "svg", id, def, ref: `url(#${id})` };
    },
  },
  {
    id: "heatmap", name: "Heatmap", icon: "🔥", desc: "Luminance → thermal gradient", category: "Tone", type: "svg",
    params: [{ key: "intensity", label: "Intensity", type: "slider", min: 0, max: 100, step: 1, default: 100, unit: "%" }],
    build: (p, id) => {
      const g = p.intensity / 100;
      const map = (arr) => arr.map((v) => (v * g).toFixed(3)).join(" ");
      const R = map([0.02, 0.1, 0.35, 0.7, 0.95, 1]);
      const G = map([0.0, 0.0, 0.05, 0.25, 0.7, 1]);
      const B = map([0.15, 0.4, 0.55, 0.1, 0.05, 0.9]);
      const def = `<filter id="${id}" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0.299 0.587 0.114 0 0  0.299 0.587 0.114 0 0  0.299 0.587 0.114 0 0  0 0 0 1 0" result="g"/><feComponentTransfer in="g"><feFuncR type="table" tableValues="${R}"/><feFuncG type="table" tableValues="${G}"/><feFuncB type="table" tableValues="${B}"/></feComponentTransfer></filter>`;
      return { kind: "svg", id, def, ref: `url(#${id})` };
    },
  },

  /* ---- Glow / Halation / Bloom (overlays using image) ---- */
  {
    id: "glow", name: "Glow", icon: "✨", desc: "Soft luminous bloom", category: "Light", type: "overlay",
    params: [
      { key: "color", label: "Glow color", type: "color", default: "#ffffff" },
      { key: "blur", label: "Spread", type: "slider", min: 0, max: 40, step: 0.5, default: 8, unit: "px" },
      { key: "brightness", label: "Intensity", type: "slider", min: 50, max: 400, step: 5, default: 180, unit: "%" },
      { key: "opacity", label: "Opacity", type: "slider", min: 0, max: 100, step: 1, default: 60, unit: "%" },
    ],
    build: (p) => ({
      kind: "overlay", useImage: true,
      imgFilter: `brightness(${p.brightness}%) blur(${p.blur}px) saturate(1.3)`,
      blend: "screen", opacity: p.opacity,
    }),
  },
  {
    id: "halation", name: "Halation", icon: "🌅", desc: "Film-style warm bloom around highlights", category: "Light", type: "overlay",
    params: [
      { key: "color", label: "Halo tint", type: "color", default: "#ff7a3c" },
      { key: "blur", label: "Spread", type: "slider", min: 2, max: 60, step: 0.5, default: 18, unit: "px" },
      { key: "threshold", label: "Threshold", type: "slider", min: 50, max: 300, step: 5, default: 160, unit: "%" },
      { key: "opacity", label: "Strength", type: "slider", min: 0, max: 100, step: 1, default: 55, unit: "%" },
    ],
    build: (p) => ({
      kind: "overlay", useImage: true,
      imgFilter: `brightness(${p.threshold}%) contrast(200%) blur(${p.blur}px)`,
      bg: p.color, blend: "lighten", opacity: p.opacity,
      bgBlend: "color",
    }),
  },
  {
    id: "bloom", name: "Bloom", icon: "🌸", desc: "Selective highlight bloom", category: "Light", type: "overlay",
    params: [
      { key: "blur", label: "Radius", type: "slider", min: 1, max: 50, step: 0.5, default: 12, unit: "px" },
      { key: "threshold", label: "Threshold", type: "slider", min: 80, max: 300, step: 5, default: 140, unit: "%" },
      { key: "opacity", label: "Strength", type: "slider", min: 0, max: 100, step: 1, default: 50, unit: "%" },
    ],
    build: (p) => ({
      kind: "overlay", useImage: true,
      imgFilter: `brightness(${p.threshold}%) contrast(180%) blur(${p.blur}px)`,
      blend: "screen", opacity: p.opacity,
    }),
  },
  {
    id: "chromatic", name: "Chromatic Aberration", icon: "🔵", desc: "RGB channel fringe split", category: "Light", type: "svg",
    params: [
      { key: "offset", label: "Split", type: "slider", min: 0, max: 20, step: 0.5, default: 4, unit: "px" },
      { key: "strength", label: "Strength", type: "slider", min: 0, max: 100, step: 1, default: 70, unit: "%" },
    ],
    build: (p, id) => {
      const o = p.offset;
      const s = (p.strength / 100).toFixed(2);
      const inv = (1 - p.strength / 100).toFixed(2);
      const def = `<filter id="${id}" color-interpolation-filters="sRGB"><feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r"/><feOffset in="r" dx="${o}" dy="0" result="rOff"/><feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="g"/><feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="b"/><feOffset in="b" dx="${-o}" dy="0" result="bOff"/><feBlend in="rOff" in2="g" mode="screen" result="rg"/><feBlend in="rg" in2="bOff" mode="screen" result="aberrated"/><feComposite in="SourceGraphic" in2="aberrated" operator="arithmetic" k1="0" k2="${s}" k3="${inv}" k4="0"/></filter>`;
      return { kind: "svg", id, def, ref: `url(#${id})` };
    },
  },

  /* ---- Color wash / blend overlays ---- */
  {
    id: "colorwash", name: "Color Wash", icon: "🧴", desc: "Tint with blend mode", category: "Color", type: "overlay",
    params: [
      { key: "color", label: "Color", type: "color", default: "#7c5cff" },
      { key: "blend", label: "Blend mode", type: "select", default: "overlay",
        options: ["multiply","screen","overlay","soft-light","hard-light","color-dodge","color-burn","hue","saturation","color","luminosity","difference","exclusion"] },
      { key: "opacity", label: "Opacity", type: "slider", min: 0, max: 100, step: 1, default: 40, unit: "%" },
    ],
    build: (p) => ({
      kind: "overlay", bg: p.color, blend: p.blend, opacity: p.opacity,
    }),
  },
  {
    id: "gradient", name: "Gradient Wash", icon: "🟣", desc: "Blended gradient overlay", category: "Color", type: "overlay",
    params: [
      { key: "c1", label: "Color 1", type: "color", default: "#ff5c8a" },
      { key: "c2", label: "Color 2", type: "color", default: "#7c5cff" },
      { key: "angle", label: "Angle", type: "slider", min: 0, max: 360, step: 1, default: 135, unit: "°" },
      { key: "blend", label: "Blend mode", type: "select", default: "soft-light",
        options: ["multiply","screen","overlay","soft-light","hard-light","color-dodge","hue","color","luminosity","difference","exclusion"] },
      { key: "opacity", label: "Opacity", type: "slider", min: 0, max: 100, step: 1, default: 50, unit: "%" },
    ],
    build: (p) => ({
      kind: "overlay",
      bg: `linear-gradient(${p.angle}deg, ${p.c1}, ${p.c2})`,
      blend: p.blend, opacity: p.opacity,
    }),
  },

  /* ---- Texture / atmosphere overlays ---- */
  {
    id: "grain", name: "Film Grain", icon: "📺", desc: "Analog noise texture", category: "Texture", type: "overlay",
    params: [
      { key: "size", label: "Grain size", type: "slider", min: 0.3, max: 3, step: 0.1, default: 0.9, unit: "" },
      { key: "opacity", label: "Strength", type: "slider", min: 0, max: 100, step: 1, default: 25, unit: "%" },
      { key: "blend", label: "Blend", type: "select", default: "overlay",
        options: ["overlay","soft-light","hard-light","screen","multiply"] },
    ],
    build: (p) => ({
      kind: "overlay", special: "grain", size: p.size, opacity: p.opacity, blend: p.blend,
      grainUri: GRAIN_URI(p.size),
    }),
  },
  {
    id: "vignette", name: "Vignette", icon: "⚫", desc: "Darken edges", category: "Texture", type: "overlay",
    params: [
      { key: "color", label: "Color", type: "color", default: "#000000" },
      { key: "size", label: "Spread", type: "slider", min: 20, max: 100, step: 1, default: 60, unit: "%" },
      { key: "opacity", label: "Strength", type: "slider", min: 0, max: 100, step: 1, default: 50, unit: "%" },
    ],
    build: (p) => ({
      kind: "overlay",
      bg: `radial-gradient(ellipse at center, transparent ${100 - p.size}%, ${p.color} 100%)`,
      blend: "multiply", opacity: p.opacity,
    }),
  },
  {
    id: "scanlines", name: "Scanlines", icon: "📡", desc: "CRT line pattern", category: "Texture", type: "overlay",
    params: [
      { key: "size", label: "Line spacing", type: "slider", min: 1, max: 8, step: 0.5, default: 3, unit: "px" },
      { key: "color", label: "Line color", type: "color", default: "#000000" },
      { key: "opacity", label: "Strength", type: "slider", min: 0, max: 100, step: 1, default: 30, unit: "%" },
      { key: "blend", label: "Blend", type: "select", default: "multiply",
        options: ["multiply","overlay","soft-light","screen"] },
    ],
    build: (p) => ({
      kind: "overlay",
      bg: `repeating-linear-gradient(0deg, ${p.color} 0px, ${p.color} 1px, transparent 1px, transparent ${p.size}px)`,
      blend: p.blend, opacity: p.opacity,
    }),
  },
  {
    id: "prism", name: "Prism Light", icon: "🔺", desc: "Refracted light streak", category: "Texture", type: "overlay",
    params: [
      { key: "c1", label: "Color 1", type: "color", default: "#ff2e88" },
      { key: "c2", label: "Color 2", type: "color", default: "#2effd5" },
      { key: "angle", label: "Angle", type: "slider", min: 0, max: 360, step: 1, default: 45, unit: "°" },
      { key: "width", label: "Streak width", type: "slider", min: 5, max: 60, step: 1, default: 20, unit: "%" },
      { key: "opacity", label: "Strength", type: "slider", min: 0, max: 100, step: 1, default: 35, unit: "%" },
    ],
    build: (p) => ({
      kind: "overlay",
      bg: `linear-gradient(${p.angle}deg, transparent ${50 - p.width / 2}%, ${p.c1} ${50 - p.width / 6}%, #fff 50%, ${p.c2} ${50 + p.width / 6}%, transparent ${50 + p.width / 2}%)`,
      blend: "screen", opacity: p.opacity,
    }),
  },

  /* ---- Psychedelic / stylized combos ---- */
  {
    id: "psychedelic", name: "Psychedelic", icon: "🌀", desc: "Animated hue + saturation surge", category: "Stylize", type: "filter",
    params: [
      { key: "saturate", label: "Saturation", type: "slider", min: 100, max: 500, step: 10, default: 280, unit: "%" },
      { key: "contrast", label: "Contrast", type: "slider", min: 80, max: 200, step: 1, default: 130, unit: "%" },
      { key: "speed", label: "Anim speed", type: "slider", min: 0, max: 20, step: 0.5, default: 8, unit: "s" },
      { key: "animate", label: "Animate", type: "select", default: "yes", options: ["yes", "no"] },
    ],
    build: (p) => ({
      kind: "filter",
      filter: `saturate(${p.saturate}%) contrast(${p.contrast}%)`,
      anim: p.animate === "yes" ? { name: "psy-hue", dur: p.speed } : null,
    }),
  },
  {
    id: "infrared", name: "Infrared", icon: "🔴", desc: "False-color IR look", category: "Stylize", type: "filter",
    params: [
      { key: "intensity", label: "Intensity", type: "slider", min: 0, max: 100, step: 1, default: 70, unit: "%" },
    ],
    build: (p) => {
      const i = p.intensity / 100;
      return { kind: "filter", filter: `invert(${(i * 100).toFixed(0)}%) hue-rotate(${(180 * i).toFixed(0)}deg) saturate(${(120 + 80 * i).toFixed(0)}%)` };
    },
  },
  {
    id: "vintage", name: "Vintage", icon: "📼", desc: "Faded film warmth", category: "Stylize", type: "filter",
    params: [
      { key: "sepia", label: "Sepia", type: "slider", min: 0, max: 100, step: 1, default: 45, unit: "%" },
      { key: "contrast", label: "Contrast", type: "slider", min: 60, max: 140, step: 1, default: 95, unit: "%" },
      { key: "saturate", label: "Saturation", type: "slider", min: 20, max: 150, step: 1, default: 80, unit: "%" },
      { key: "brightness", label: "Brightness", type: "slider", min: 60, max: 140, step: 1, default: 105, unit: "%" },
    ],
    build: (p) => ({ kind: "filter", filter: `sepia(${p.sepia}%) contrast(${p.contrast}%) saturate(${p.saturate}%) brightness(${p.brightness}%)` }),
  },
  {
    id: "dropshadow", name: "Drop Shadow", icon: "🫥", desc: "Offset shadow glow", category: "Stylize", type: "filter",
    params: [
      { key: "x", label: "X offset", type: "slider", min: -30, max: 30, step: 1, default: 0, unit: "px" },
      { key: "y", label: "Y offset", type: "slider", min: -30, max: 30, step: 1, default: 8, unit: "px" },
      { key: "blur", label: "Blur", type: "slider", min: 0, max: 50, step: 1, default: 16, unit: "px" },
      { key: "color", label: "Color", type: "color", default: "#7c5cff" },
    ],
    build: (p) => ({ kind: "filter", filter: `drop-shadow(${p.x}px ${p.y}px ${p.blur}px ${p.color})` }),
  },
];

const CATALOG_BY_ID = Object.fromEntries(EFFECT_CATALOG.map((e) => [e.id, e]));

/* ---------- State ---------- */
const state = {
  imageSrc: null,
  imageName: "your-image.jpg",
  effects: [], // { key, defId, enabled, expanded, params }
  displayScale: 1, // previewWidth / nativeWidth — px values scaled by this in preview
  exportLayers: [],
  nativeSvgDefs: "", // unscaled SVG filter defs for PNG export
};

/* ---------- Default starter stack ---------- */
function defaultStack() {
  return [
    makeEffect("contrast", { v: 112 }),
    makeEffect("saturate", { v: 115 }),
    makeEffect("duotone", { shadow: "#160d33", highlight: "#ff6aae", contrast: 15 }),
    makeEffect("grain", { opacity: 18 }),
    makeEffect("vignette", { opacity: 35 }),
  ];
}

function makeEffect(defId, paramOverrides = {}) {
  const def = CATALOG_BY_ID[defId];
  const params = {};
  def.params.forEach((p) => (params[p.key] = paramOverrides[p.key] !== undefined ? paramOverrides[p.key] : p.default));
  return { key: uid(), defId, enabled: true, expanded: false, params };
}

/* ---------- Display scale (preview vs native resolution) ----------
 * Pixel-based effect parameters (blur radius, grain tile size, scanline
 * spacing, drop-shadow offsets, etc.) look different at preview scale vs
 * native export resolution. We measure the ratio of displayed image width
 * to native width and scale all px values in the preview by that factor,
 * so the preview closely matches the exported PNG.
 */
function calculateDisplayScale() {
  const img = $("#base-image");
  if (!img || !img.naturalWidth || !img.complete) return null;
  return img.clientWidth / img.naturalWidth;
}

let scaleCheckScheduled = false;
function scheduleDisplayScaleCheck() {
  if (scaleCheckScheduled) return;
  scaleCheckScheduled = true;
  requestAnimationFrame(() => {
    scaleCheckScheduled = false;
    const img = $("#base-image");
    if (!img || !img.naturalWidth) return;
    if (!img.complete) {
      img.addEventListener("load", () => updateDisplayScale(), { once: true });
      return;
    }
    updateDisplayScale();
  });
}

function updateDisplayScale() {
  const newScale = calculateDisplayScale();
  if (newScale === null) return;
  // Only re-render if scale changed meaningfully (avoids loops)
  if (Math.abs(newScale - state.displayScale) > 0.005) {
    state.displayScale = newScale;
    render();
  }
}

// Scale all Npx values in a CSS string by the given factor
function scalePxInString(str, scale) {
  if (!str || scale >= 1) return str;
  return str.replace(/(\d+\.?\d*)px/g, (m, n) => {
    const v = parseFloat(n) * scale;
    return (v < 0.01 ? 0 : v.toFixed(2)) + "px";
  });
}

// Scale dx/dy attributes in SVG filter defs by the given factor
function scaleSvgOffsets(str, scale) {
  if (!str || scale >= 1) return str;
  return str.replace(/(dx|dy)="(-?\d+\.?\d*)"/g, (m, attr, val) => {
    const v = parseFloat(val) * scale;
    return `${attr}="${v.toFixed(2)}"`;
  });
}

// Check if an effect definition has pixel-based parameters (needs scale note)
function hasPixelParams(def) {
  if (def.id === "grain") return true; // grain has a hardcoded 200px tile size
  return def.params.some((p) => p.unit === "px");
}

/* ---------- Rendering ---------- */
// Canvas-generated grain noise — reliable across all browsers (SVG feTurbulence
// in a background-image data URI silently fails on Safari/iOS).
const grainCache = {};
function GRAIN_URI(size) {
  const key = size.toFixed(1);
  if (grainCache[key]) return grainCache[key];
  // Smaller canvas = coarser grain when scaled up to fill the overlay
  const dim = Math.round(180 / size);
  const canvas = document.createElement("canvas");
  canvas.width = dim;
  canvas.height = dim;
  const ctx = canvas.getContext("2d");
  const imageData = ctx.createImageData(dim, dim);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const v = Math.random() * 255;
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
    data[i + 3] = 255; // fully opaque — opacity controlled by the layer
  }
  ctx.putImageData(imageData, 0, 0);
  const uri = canvas.toDataURL();
  grainCache[key] = uri;
  return uri;
}

function render() {
  const img = $("#base-image");
  const overlays = $("#overlay-layers");
  const svgDefs = $("#svg-filters");

  if (!state.imageSrc) return;

  img.src = state.imageSrc;

  const scale = state.displayScale;

  // Build layers in order.
  // We produce two parallel sets:
  //   - native (unscaled) for PNG export + code generation
  //   - preview (px values scaled by displayScale) for the live DOM
  const nativeFilterParts = [];
  const previewFilterParts = [];
  const previewSvgDefs = [];
  const nativeSvgDefs = [];
  const nativeOverlayHTML = [];
  const previewOverlayHTML = [];
  const exportLayers = [];
  const anims = [];

  state.effects.forEach((eff) => {
    if (!eff.enabled) return;
    const def = CATALOG_BY_ID[eff.defId];
    const layer = def.build(eff.params, `f-${eff.key}`);
    if (!layer) return;

    if (layer.kind === "filter") {
      nativeFilterParts.push(layer.filter);
      previewFilterParts.push(scalePxInString(layer.filter, scale));
      exportLayers.push({ type: "filter", filter: layer.filter });
      if (layer.anim) anims.push(layer.anim);
    } else if (layer.kind === "svg") {
      // SVG filters: scale dx/dy offsets for preview, keep native for export
      previewSvgDefs.push(scaleSvgOffsets(layer.def, scale));
      nativeSvgDefs.push(layer.def);
      nativeFilterParts.push(layer.ref);
      previewFilterParts.push(layer.ref);
      exportLayers.push({ type: "filter", filter: layer.ref });
    } else if (layer.kind === "overlay") {
      if (layer.special === "grain") {
        const grainTileNative = 200;
        const grainTilePreview = Math.round(grainTileNative * scale);
        previewOverlayHTML.push(`<div class="overlay-layer" style="background-image:url('${layer.grainUri}');background-size:${grainTilePreview}px;mix-blend-mode:${layer.blend};opacity:${layer.opacity}%"></div>`);
        nativeOverlayHTML.push(`<div class="overlay-layer" style="background-image:url('${layer.grainUri}');background-size:${grainTileNative}px;mix-blend-mode:${layer.blend};opacity:${layer.opacity}%"></div>`);
        exportLayers.push({ type: "grain", uri: layer.grainUri, blend: layer.blend, opacity: layer.opacity });
      } else {
        let nativeStyle = "";
        let previewStyle = "";
        if (layer.useImage) {
          nativeStyle += `background-image:url('__IMG__');background-size:cover;`;
          previewStyle += `background-image:url('__IMG__');background-size:cover;`;
          if (layer.imgFilter) {
            nativeStyle += `filter:${layer.imgFilter};`;
            previewStyle += `filter:${scalePxInString(layer.imgFilter, scale)};`;
          }
          if (layer.bg) {
            nativeStyle += `background-color:${layer.bg};background-blend-mode:${layer.bgBlend || "normal"};`;
            previewStyle += `background-color:${layer.bg};background-blend-mode:${layer.bgBlend || "normal"};`;
          }
          exportLayers.push({ type: "image", filter: layer.imgFilter || "none", blend: layer.blend, opacity: layer.opacity, bg: layer.bg, bgBlend: layer.bgBlend });
        } else {
          nativeStyle += `background:${layer.bg};`;
          previewStyle += `background:${scalePxInString(layer.bg, scale)};`;
          exportLayers.push({ type: "bg", bg: layer.bg, blend: layer.blend, opacity: layer.opacity });
        }
        nativeStyle += `mix-blend-mode:${layer.blend};opacity:${layer.opacity}%`;
        previewStyle += `mix-blend-mode:${layer.blend};opacity:${layer.opacity}%`;
        nativeOverlayHTML.push(`<div class="overlay-layer" style="${nativeStyle}"></div>`);
        previewOverlayHTML.push(`<div class="overlay-layer" style="${previewStyle}"></div>`);
      }
    }
  });

  // Store for PNG export (native resolution)
  state.exportLayers = exportLayers;
  state.nativeSvgDefs = nativeSvgDefs.join("");

  // Apply scaled values to live preview DOM
  svgDefs.innerHTML = previewSvgDefs.join("");
  img.style.filter = previewFilterParts.length ? previewFilterParts.join(" ") : "none";
  overlays.innerHTML = previewOverlayHTML.join("").replace(/__IMG__/g, state.imageSrc);

  // Animations
  applyAnimations(anims);

  // Code — use native (unscaled) values so the exported CSS is correct at full res
  const codeOverlays = nativeOverlayHTML.map((h) =>
    h.replace(/__IMG__/g, state.imageName)
     .replace(/data:image\/png;base64,[^'"]+/g, "grain-noise.png")
  );
  generateCode(nativeFilterParts, nativeSvgDefs, codeOverlays, anims);

  // Re-measure display scale after layout settles (handles initial load + resize)
  scheduleDisplayScaleCheck();
}

let animStyleEl = null;
function applyAnimations(anims) {
  if (animStyleEl) animStyleEl.remove();
  if (!anims.length) return;
  const rules = anims.map((a) => {
    if (a.name === "psy-hue") {
      return `@keyframes psy-hue{to{filter:hue-rotate(360deg)}}`;
    }
    return "";
  }).join("");
  const apply = anims.map((a) => `#layer-container{animation:${a.name} ${a.dur}s linear infinite}`).join("");
  animStyleEl = document.createElement("style");
  animStyleEl.textContent = rules + apply;
  document.head.appendChild(animStyleEl);
}

/* ---------- Code generation ---------- */
function generateCode(filterParts, svgDefs, overlayHTML, anims) {
  const hasSvg = svgDefs.length > 0;
  const hasOverlays = overlayHTML.length > 0;
  const hasAnim = anims.length > 0;

  const filterStr = filterParts.length ? filterParts.join(" ") : "none";

  let code = "";

  // SVG filters
  if (hasSvg) {
    code += `<!-- SVG filters: place at top of <body> -->\n<svg style="display:none">\n  <defs>\n    ${svgDefs.join("\n    ")}\n  </defs>\n</svg>\n\n`;
  }

  // HTML
  const hasGrain = overlayHTML.some((h) => h.includes("grain-noise.png"));
  if (hasGrain) {
    code += `<!-- Tip: generate grain-noise.png — a 200×200 grayscale noise texture.\n     In JS: canvas → fill with random gray pixels → toDataURL() → save. -->\n`;
  }
  code += `<!-- Image with filters -->\n<div class="filter-stage">\n  <img src="${state.imageName}" class="filter-img"${filterStr !== "none" ? ` style="filter:${filterStr}"` : ""} />\n`;
  if (hasOverlays) {
    overlayHTML.forEach((h) => {
      code += `  ${h}\n`;
    });
  }
  code += `</div>\n`;

  // CSS
  code += `\n<style>\n.filter-stage{position:relative;display:inline-block;line-height:0}\n.filter-img{display:block;max-width:100%}\n.overlay-layer{position:absolute;inset:0;pointer-events:none}\n`;
  if (hasAnim) {
    code += `@keyframes psy-hue{to{filter:hue-rotate(360deg)}}\n.filter-stage{animation:psy-hue ${anims[0].dur}s linear infinite}\n`;
  }
  code += `</style>\n`;

  $("#code-output").textContent = code;
}

/* ---------- Controls UI ---------- */
function renderEffectsList() {
  const list = $("#effects-list");
  list.innerHTML = "";
  state.effects.forEach((eff, idx) => {
    const def = CATALOG_BY_ID[eff.defId];
    const card = document.createElement("div");
    card.className = "effect-card" + (eff.enabled ? "" : " disabled");
    card.dataset.key = eff.key;
    card.draggable = false;

    card.innerHTML = `
      <div class="effect-card-header">
        <span class="effect-grip" data-grip title="Drag to reorder">⠿</span>
        <span class="effect-name">${def.icon} ${def.name}</span>
        <span class="effect-badge">${def.category}</span>
        <div class="effect-toggle ${eff.enabled ? "on" : ""}" data-toggle></div>
      </div>
      <div class="effect-card-body ${eff.expanded ? "" : "hidden"}"></div>
    `;

    const body = $(".effect-card-body", card);
    def.params.forEach((p) => body.appendChild(buildControl(eff, p)));
    // Add scale note for effects with pixel-based parameters
    if (hasPixelParams(def)) {
      const note = document.createElement("div");
      note.className = "effect-note";
      note.textContent = "Preview approximates native resolution — px values are scaled to match the export.";
      body.appendChild(note);
    }
    const removeBtn = document.createElement("button");
    removeBtn.className = "effect-remove";
    removeBtn.textContent = "✕ Remove";
    removeBtn.onclick = (e) => {
      e.stopPropagation();
      state.effects = state.effects.filter((x) => x.key !== eff.key);
      renderEffectsList();
      render();
    };
    body.appendChild(removeBtn);

    // Header interactions
    const header = $(".effect-card-header", card);
    header.onclick = (e) => {
      if (e.target.closest("[data-toggle]") || e.target.closest("[data-grip]")) return;
      eff.expanded = !eff.expanded;
      body.classList.toggle("hidden", !eff.expanded);
    };
    $("[data-toggle]", card).onclick = (e) => {
      e.stopPropagation();
      eff.enabled = !eff.enabled;
      card.classList.toggle("disabled", !eff.enabled);
      e.currentTarget.classList.toggle("on", eff.enabled);
      render();
    };

    // Drag reorder via grip
    const grip = $("[data-grip]", card);
    setupDrag(grip, card, idx);

    list.appendChild(card);
  });
}

function buildControl(eff, p) {
  const row = document.createElement("div");
  row.className = "control-row";

  if (p.type === "slider") {
    row.innerHTML = `
      <div class="control-label"><span>${p.label}</span><span class="control-value"></span></div>
      <input type="range" min="${p.min}" max="${p.max}" step="${p.step}" value="${eff.params[p.key]}" />
    `;
    const input = $("input", row);
    const val = $(".control-value", row);
    const fmt = () => {
      const n = parseFloat(input.value);
      val.textContent = (Number.isInteger(p.step) ? Math.round(n) : n.toFixed(1)) + (p.unit || "");
    };
    fmt();
    input.oninput = () => {
      eff.params[p.key] = parseFloat(input.value);
      fmt();
      render();
    };
  } else if (p.type === "color") {
    row.innerHTML = `
      <div class="control-label"><span>${p.label}</span></div>
      <div class="color-row">
        <input type="color" value="${eff.params[p.key]}" />
        <span class="color-hex">${eff.params[p.key]}</span>
      </div>
    `;
    const input = $("input", row);
    const hex = $(".color-hex", row);
    input.oninput = () => {
      eff.params[p.key] = input.value;
      hex.textContent = input.value;
      render();
    };
  } else if (p.type === "select") {
    row.innerHTML = `
      <div class="control-label"><span>${p.label}</span></div>
      <select>${p.options.map((o) => `<option ${o === eff.params[p.key] ? "selected" : ""}>${o}</option>`).join("")}</select>
    `;
    const sel = $("select", row);
    sel.onchange = () => {
      eff.params[p.key] = sel.value;
      render();
    };
  }
  return row;
}

/* ---------- Drag to reorder ---------- */
function setupDrag(grip, card, idx) {
  grip.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    card.draggable = true;
    card.addEventListener("dragstart", onDragStart, { once: true });
    card.addEventListener("dragend", onDragEnd, { once: true });
  });
  let dragKey = null;
  function onDragStart(e) {
    dragKey = card.dataset.key;
    e.dataTransfer.effectAllowed = "move";
    card.style.opacity = "0.4";
  }
  function onDragEnd() {
    card.draggable = false;
    card.style.opacity = "";
    $$(".effect-card").forEach((c) => c.classList.remove("dragging-over"));
  }
}

document.addEventListener("dragover", (e) => {
  const card = e.target.closest(".effect-card");
  if (card) {
    e.preventDefault();
    $$(".effect-card").forEach((c) => c.classList.remove("dragging-over"));
    card.classList.add("dragging-over");
  }
});

document.addEventListener("drop", (e) => {
  const card = e.target.closest(".effect-card");
  if (!card) return;
  e.preventDefault();
  const fromKey = $$(".effect-card").find((c) => c.style.opacity === "0.4")?.dataset.key;
  const toKey = card.dataset.key;
  if (!fromKey || fromKey === toKey) return;
  const fromIdx = state.effects.findIndex((x) => x.key === fromKey);
  const toIdx = state.effects.findIndex((x) => x.key === toKey);
  const [moved] = state.effects.splice(fromIdx, 1);
  state.effects.splice(toIdx, 0, moved);
  renderEffectsList();
  render();
});

/* ---------- Effect picker ---------- */
function openEffectPicker() {
  const grid = $("#effect-options");
  grid.innerHTML = "";
  EFFECT_CATALOG.forEach((def) => {
    const opt = document.createElement("div");
    opt.className = "effect-option";
    opt.innerHTML = `<div class="effect-option-icon">${def.icon}</div><div class="effect-option-name">${def.name}</div><div class="effect-option-desc">${def.desc}</div>`;
    opt.onclick = () => {
      state.effects.push(makeEffect(def.id));
      renderEffectsList();
      render();
      closeEffectPicker();
    };
    grid.appendChild(opt);
  });
  $("#effect-picker").hidden = false;
}
function closeEffectPicker() {
  $("#effect-picker").hidden = true;
}

/* ---------- Image upload ---------- */
function handleFile(file) {
  if (!file || !file.type.startsWith("image/")) return;
  state.imageName = file.name;
  state.displayScale = 1; // reset — will be recalculated after image loads
  const reader = new FileReader();
  reader.onload = (e) => {
    state.imageSrc = e.target.result;
    $("#upload-prompt").hidden = true;
    $("#preview-wrap").hidden = false;
    render();
  };
  reader.readAsDataURL(file);
}

/* ---------- Download (render full layer stack to canvas) ---------- */
// CSS mix-blend-mode → canvas globalCompositeOperation mapping.
// Most names match; a few differ.
const BLEND_TO_COMPOSITE = {
  "normal": "source-over",
  "multiply": "multiply",
  "screen": "screen",
  "overlay": "overlay",
  "soft-light": "soft-light",
  "hard-light": "hard-light",
  "color-dodge": "color-dodge",
  "color-burn": "color-burn",
  "darken": "darken",
  "lighten": "lighten",
  "difference": "difference",
  "exclusion": "exclusion",
  "hue": "hue",
  "saturation": "saturation",
  "color": "color",
  "luminosity": "luminosity",
};

async function downloadPNG() {
  if (!state.imageSrc) return showToast("Upload an image first");
  try {
    const img = await loadImage(state.imageSrc);
    const W = img.naturalWidth, H = img.naturalHeight;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");

    const layers = state.exportLayers || [];

    // Separate filter layers (applied to the base image) from overlay layers
    const filterStrs = layers.filter((l) => l.type === "filter").map((l) => l.filter);
    const overlayLayers = layers.filter((l) => l.type !== "filter");

    // 1. Draw base image with all filter/svg-filter layers applied.
    //    Strategy: inject native SVG defs into the DOM, then use ctx.filter
    //    with url() references. This works in Chrome/Firefox. For Safari
    //    (which doesn't support url() in ctx.filter), fall back to
    //    rasterizing via an inline SVG <image> element.
    const hasSvgFilter = filterStrs.some((f) => f.includes("url("));
    const cssFilters = filterStrs.filter((f) => !f.includes("url("));
    const svgFilterDefs = state.nativeSvgDefs || "";

    // Inject native (unscaled) SVG defs into the DOM for ctx.filter url() access
    let exportSvgContainer = null;
    if (hasSvgFilter && svgFilterDefs) {
      exportSvgContainer = document.createElement("svg");
      exportSvgContainer.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
      exportSvgContainer.innerHTML = `<defs>${svgFilterDefs}</defs>`;
      document.body.appendChild(exportSvgContainer);
    }

    // Try ctx.filter with url() first (Chrome/Firefox)
    let svgFiltersApplied = false;
    if (hasSvgFilter) {
      try {
        // Test: draw a tiny rect with the SVG filter to see if it works
        const testCanvas = document.createElement("canvas");
        testCanvas.width = 2;
        testCanvas.height = 2;
        const testCtx = testCanvas.getContext("2d");
        const firstUrlFilter = filterStrs.find((f) => f.includes("url("));
        testCtx.filter = firstUrlFilter;
        testCtx.fillStyle = "#fff";
        testCtx.fillRect(0, 0, 2, 2);
        // If no exception thrown and we get non-white pixels, ctx.filter url() works
        const pixel = testCtx.getImageData(0, 0, 1, 1).data;
        // duotone/tritone transforms white into a color, so check if it changed
        svgFiltersApplied = pixel[0] !== 255 || pixel[1] !== 255 || pixel[2] !== 255;
        testCtx.filter = "none";
      } catch (e) {
        svgFiltersApplied = false;
      }
    }

    let baseImg = img;
    if (hasSvgFilter && !svgFiltersApplied && svgFilterDefs) {
      // Safari fallback: rasterize via inline SVG <image>
      baseImg = await applySvgFilters(img, svgFilterDefs, filterStrs, W, H);
    }

    // Build the full filter chain for drawing
    if (svgFiltersApplied) {
      // Chrome/Firefox: use all filters (CSS + SVG url()) via ctx.filter
      ctx.filter = filterStrs.length ? filterStrs.join(" ") : "none";
    } else {
      // Safari fallback: SVG filters already baked into baseImg, only apply CSS filters
      ctx.filter = cssFilters.length ? cssFilters.join(" ") : "none";
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(baseImg, 0, 0, W, H);
    ctx.filter = "none";

    // Clean up injected SVG defs
    if (exportSvgContainer) exportSvgContainer.remove();

    // 2. Composite each overlay layer
    for (const layer of overlayLayers) {
      ctx.globalAlpha = (layer.opacity || 100) / 100;
      ctx.globalCompositeOperation = BLEND_TO_COMPOSITE[layer.blend] || "source-over";

      if (layer.type === "bg") {
        // Solid color or CSS gradient — draw via a temp canvas + CSS background
        await drawBackgroundLayer(ctx, layer.bg, W, H);
      } else if (layer.type === "image") {
        // Image-backed overlay (glow, halation, bloom) — draw image with filter
        // If there's a bg color + bgBlend, tint the image first
        let drawImg = img;
        if (layer.bg && layer.bgBlend) {
          drawImg = await tintImage(img, layer.bg, layer.bgBlend, W, H);
        }
        ctx.filter = layer.filter || "none";
        ctx.drawImage(drawImg, 0, 0, W, H);
        ctx.filter = "none";
      } else if (layer.type === "grain") {
        // Grain noise texture — tile it to fill
        const grainImg = await loadImage(layer.uri);
        const tileSize = grainImg.naturalWidth || 200;
        ctx.filter = "none";
        for (let y = 0; y < H; y += tileSize) {
          for (let x = 0; x < W; x += tileSize) {
            ctx.drawImage(grainImg, x, y, tileSize, tileSize);
          }
        }
      }
    }

    // Reset and export
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "wobbletone-fx-" + Date.now() + ".png";
      a.click();
      URL.revokeObjectURL(url);
      showToast("Saved PNG (all layers)");
    }, "image/png");
  } catch (err) {
    console.error("Export failed:", err);
    showToast("Export failed — see console");
  }
}

// Apply SVG filters to an image by rendering through an inline SVG.
// Fallback for Safari (which doesn't support url() in ctx.filter).
// Uses a Blob URL instead of a data URL to avoid size limits with large images.
function applySvgFilters(img, filterDefs, filterStrs, W, H) {
  return new Promise((resolve) => {
    const urlFilters = filterStrs.filter((f) => f.includes("url("));
    const filterChain = urlFilters.join(" ");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}">
      <defs>${filterDefs}</defs>
      <image width="${W}" height="${H}" filter="${filterChain}" xlink:href="${img.src}"/>
    </svg>`;
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const blobUrl = URL.createObjectURL(blob);
    const svgImg = new Image();
    svgImg.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const c = canvas.getContext("2d");
      c.drawImage(svgImg, 0, 0);
      URL.revokeObjectURL(blobUrl);
      try {
        resolve(loadImage(canvas.toDataURL()));
      } catch (e) {
        console.warn("SVG filter export: canvas tainted, using unfiltered", e);
        resolve(img);
      }
    };
    svgImg.onerror = () => {
      URL.revokeObjectURL(blobUrl);
      console.warn("SVG filter export: SVG image failed to load, using unfiltered");
      resolve(img);
    };
    svgImg.src = blobUrl;
  });
}

// Draw a CSS background (solid color or gradient) onto canvas by using
// a temporary DOM element + SVG foreignObject to rasterize it.
async function drawBackgroundLayer(ctx, bg, W, H) {
  // For solid colors, fill directly
  if (bg.startsWith("#") || bg.startsWith("rgb")) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    return;
  }
  // For gradients and patterns, use an offscreen canvas with DOM rendering
  const div = document.createElement("div");
  div.style.cssText = `position:absolute;width:${W}px;height:${H}px;background:${bg};`;
  document.body.appendChild(div);
  const dataUrl = await htmlToImage(div, W, H);
  div.remove();
  if (dataUrl) {
    const gradImg = await loadImage(dataUrl);
    ctx.drawImage(gradImg, 0, 0, W, H);
  }
}

// Rasterize a DOM element via SVG foreignObject
function htmlToImage(el, W, H) {
  return new Promise((resolve) => {
    const rect = el.getBoundingClientRect();
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
      <foreignObject width="100%" height="100%">
        <div xmlns="http://www.w3.org/1999/xhtml" style="width:${W}px;height:${H}px;background:${el.style.background};"></div>
      </foreignObject>
    </svg>`;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const c = canvas.getContext("2d");
      c.drawImage(img, 0, 0);
      resolve(canvas.toDataURL());
    };
    img.onerror = () => resolve(null);
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  });
}

// Tint an image with a color using background-blend-mode equivalent.
// We create a temp canvas, fill with color, then blend the image on top.
async function tintImage(img, color, blendMode, W, H) {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  // Fill with the tint color
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, W, H);
  // Blend the image on top using the bg blend mode
  ctx.globalCompositeOperation = BLEND_TO_COMPOSITE[blendMode] || "source-over";
  ctx.drawImage(img, 0, 0, W, H);
  ctx.globalCompositeOperation = "source-over";
  const dataUrl = canvas.toDataURL();
  return loadImage(dataUrl);
}
function loadImage(src) {
  return new Promise((res, rej) => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });
}

/* ---------- Randomize ---------- */
function randomize() {
  const pool = EFFECT_CATALOG.filter((e) => !["opacity"].includes(e.id));
  const n = 3 + Math.floor(Math.random() * 4);
  const chosen = [...pool].sort(() => Math.random() - 0.5).slice(0, n);
  state.effects = chosen.map((def) => {
    const params = {};
    def.params.forEach((p) => {
      if (p.type === "slider") {
        params[p.key] = p.min + Math.random() * (p.max - p.min);
        if (Number.isInteger(p.step)) params[p.key] = Math.round(params[p.key]);
      } else if (p.type === "color") {
        params[p.key] = "#" + Math.floor(Math.random() * 16777215).toString(16).padStart(6, "0");
      } else if (p.type === "select") {
        params[p.key] = p.options[Math.floor(Math.random() * p.options.length)];
      }
    });
    return { key: uid(), defId: def.id, enabled: true, expanded: false, params };
  });
  renderEffectsList();
  render();
  showToast("Randomized!");
}

/* ---------- Init ---------- */
function init() {
  // Upload — both the empty-stage prompt and the toolbar button
  const prompt = $("#upload-prompt");
  const fileInput = $("#file-input");
  prompt.onclick = () => fileInput.click();
  $("#btn-upload").onclick = () => fileInput.click();
  fileInput.onchange = (e) => {
    handleFile(e.target.files[0]);
    // reset so picking the same file again still fires onchange
    e.target.value = "";
  };

  // Drag & drop file (desktop) + tap preview to swap
  const stage = $("#stage");
  stage.addEventListener("dragover", (e) => { e.preventDefault(); stage.style.outline = "2px solid var(--accent)"; });
  stage.addEventListener("dragleave", () => (stage.style.outline = ""));
  stage.addEventListener("drop", (e) => {
    e.preventDefault();
    stage.style.outline = "";
    handleFile(e.dataTransfer.files[0]);
  });
  $("#preview-wrap").onclick = () => fileInput.click();

  // Compare
  const compare = $("#compare-toggle");
  const compareOrig = () => {
    if (!state.imageSrc) return;
    const img = $("#base-image");
    img.style.filter = "none";
    $("#overlay-layers").style.display = "none";
  };
  const restore = () => render();
  compare.addEventListener("change", () => {
    if (compare.checked) compareOrig(); else restore();
  });

  // Buttons
  $("#btn-add-effect").onclick = openEffectPicker;
  $("#btn-randomize").onclick = randomize;
  $("#btn-reset").onclick = () => {
    state.effects = defaultStack();
    renderEffectsList();
    render();
    showToast("Reset to defaults");
  };
  $("#btn-download").onclick = downloadPNG;
  $("#btn-copy").onclick = async () => {
    const text = $("#code-output").textContent;
    try {
      await navigator.clipboard.writeText(text);
      showToast("Copied to clipboard");
    } catch {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      showToast("Copied to clipboard");
    }
  };

  // Modal close
  $$("#effect-picker [data-close]").forEach((el) => (el.onclick = closeEffectPicker));

  // Tabs
  $$(".tab-btn").forEach((btn) => {
    btn.onclick = () => {
      $$(".tab-btn").forEach((b) => b.classList.remove("active"));
      $$(".tab-panel").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      $(`#tab-${btn.dataset.tab}`).classList.add("active");
    };
  });

  // Recalculate display scale on resize (debounced)
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      state.displayScale = 1; // force re-measure
      render();
    }, 150);
  });

  // Load default sample image
  loadSample();

  // Initial stack
  state.effects = defaultStack();
  renderEffectsList();
  render();

  // PWA
  registerSW();
}

function loadSample() {
  // Inline SVG sample image so the app works offline immediately
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='800' height='600'><defs><radialGradient id='g' cx='35%' cy='30%' r='75%'><stop offset='0%' stop-color='#ffd9a0'/><stop offset='40%' stop-color='#ff7a5c'/><stop offset='75%' stop-color='#7c3cff'/><stop offset='100%' stop-color='#121a3a'/></radialGradient></defs><rect width='800' height='600' fill='url(#g)'/><circle cx='280' cy='200' r='90' fill='#fff' opacity='0.85'/><rect x='450' y='120' width='200' height='200' rx='20' fill='#1a1a2e' opacity='0.7'/><polygon points='400,500 550,300 650,500' fill='#0a0a1a' opacity='0.6'/></svg>`;
  state.imageSrc = "data:image/svg+xml;base64," + btoa(svg);
  state.imageName = "sample.svg";
  state.displayScale = 1; // reset — will be recalculated after image loads
  $("#upload-prompt").hidden = true;
  $("#preview-wrap").hidden = false;
}

/* ---------- Service Worker ---------- */
function registerSW() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  }
}

document.addEventListener("DOMContentLoaded", init);
