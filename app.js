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
      bg: p.color, bgBlend: "color", blend: "screen", opacity: p.opacity,
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
      const def = `<filter id="${id}" color-interpolation-filters="sRGB"><feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r"/><feOffset in="r" dx="${o}" dy="0" result="rOff"/><feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="g"/><feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="b"/><feOffset in="b" dx="${-o}" dy="0" result="bOff"/><feBlend in="rOff" in2="g" mode="screen" result="rg"/><feBlend in="rg" in2="bOff" mode="screen" result="aberrated"/><feComposite in="SourceGraphic" in2="aberrated" operator="arithmetic" k1="0" k2="${inv}" k3="${s}" k4="0"/></filter>`;
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
  comparing: false,
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
  const container = $("#layer-container");
  const svgDefs = $("#svg-filters");
  if (!state.imageSrc) return;

  const scale = state.displayScale;
  const operations = [];
  const previewSvgDefs = [];
  const nativeSvgDefs = [];

  state.effects.forEach((eff) => {
    if (!eff.enabled) return;
    const layer = CATALOG_BY_ID[eff.defId].build(eff.params, `f-${eff.key}`);
    if (!layer) return;
    const operation = { effect: eff.defId, params: { ...eff.params }, layer };
    operations.push(operation);
    if (layer.kind === "svg") {
      previewSvgDefs.push(scaleSvgOffsets(layer.def, scale));
      nativeSvgDefs.push(layer.def);
    }
  });

  state.exportLayers = operations;
  svgDefs.innerHTML = previewSvgDefs.join("");

  const base = document.createElement("img");
  base.id = "base-image";
  base.className = "base-image";
  base.alt = "Preview";
  base.crossOrigin = "anonymous";
  base.src = state.imageSrc;

  let current = base;
  if (!state.comparing) {
    operations.forEach((operation) => {
      current = wrapPreviewOperation(current, operation, scale);
    });
  }
  container.replaceChildren(current);

  applyAnimations(operations);
  generateCode(operations, nativeSvgDefs);
  scheduleDisplayScaleCheck();
}

function wrapPreviewOperation(current, operation, scale) {
  const { layer } = operation;
  if (layer.kind === "filter" || layer.kind === "svg") {
    const wrapper = document.createElement("div");
    wrapper.className = "pipeline-step";
    wrapper.style.filter = layer.kind === "svg" ? layer.ref : scalePxInString(layer.filter, scale);
    wrapper.appendChild(current);
    if (layer.anim) {
      const animated = document.createElement("div");
      animated.className = "pipeline-step";
      animated.style.animation = `${layer.anim.name} ${layer.anim.dur}s linear infinite`;
      animated.appendChild(wrapper);
      return animated;
    }
    return wrapper;
  }

  const composite = document.createElement("div");
  composite.className = "pipeline-step pipeline-composite";
  const sourceForOverlay = layer.useImage ? clonePipeline(current) : null;
  composite.appendChild(current);

  const overlay = document.createElement("div");
  overlay.className = layer.useImage ? "pipeline-derived" : "overlay-layer";
  overlay.style.mixBlendMode = layer.blend;
  overlay.style.opacity = layer.opacity / 100;

  if (layer.special === "grain") {
    overlay.style.backgroundImage = `url('${layer.grainUri}')`;
    overlay.style.backgroundSize = `${Math.max(1, Math.round(200 * scale))}px`;
  } else if (layer.useImage) {
    const content = document.createElement("div");
    const filtered = document.createElement("div");
    content.className = "pipeline-derived-content";
    filtered.className = "pipeline-derived-filter";
    filtered.style.filter = scalePxInString(layer.imgFilter || "none", scale);
    filtered.appendChild(sourceForOverlay);
    content.appendChild(filtered);
    if (layer.bg) {
      const tint = document.createElement("div");
      tint.className = "pipeline-tint";
      tint.style.background = layer.bg;
      tint.style.mixBlendMode = layer.bgBlend || "color";
      content.appendChild(tint);
    }
    overlay.appendChild(content);
  } else {
    overlay.style.background = scalePxInString(layer.bg, scale);
  }

  composite.appendChild(overlay);
  return composite;
}

function clonePipeline(node) {
  const clone = node.cloneNode(true);
  if (clone.removeAttribute) clone.removeAttribute("id");
  clone.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));
  return clone;
}

let animStyleEl = null;
function applyAnimations(operations) {
  if (animStyleEl) animStyleEl.remove();
  if (!operations.some((operation) => operation.layer.anim)) return;
  animStyleEl = document.createElement("style");
  animStyleEl.textContent = "@keyframes psy-hue{to{filter:hue-rotate(360deg)}}";
  document.head.appendChild(animStyleEl);
}

/* ---------- Code generation ---------- */
function generateCode(operations, svgDefs) {
  let markup = `<img src="${state.imageName}" class="filter-img" />`;
  let hasGrain = false;

  operations.forEach(({ layer }) => {
    if (layer.kind === "filter" || layer.kind === "svg") {
      const filter = layer.kind === "svg" ? layer.ref : layer.filter;
      markup = `<div class="fx-step" style="filter:${filter}">${markup}</div>`;
      if (layer.anim) markup = `<div class="fx-step anim-psy" style="animation-duration:${layer.anim.dur}s">${markup}</div>`;
      return;
    }

    let overlay;
    if (layer.special === "grain") {
      hasGrain = true;
      overlay = `<div class="fx-overlay" style="background-image:url('grain-noise.png');background-size:200px;mix-blend-mode:${layer.blend};opacity:${layer.opacity / 100}"></div>`;
    } else if (layer.useImage) {
      let derived = markup;
      derived = `<div style="filter:${layer.imgFilter}">${derived}</div>`;
      if (layer.bg) derived = `<div class="fx-derived-content">${derived}<div class="fx-overlay" style="background:${layer.bg};mix-blend-mode:${layer.bgBlend || "color"}"></div></div>`;
      overlay = `<div class="fx-derived" style="mix-blend-mode:${layer.blend};opacity:${layer.opacity / 100}">${derived}</div>`;
    } else {
      overlay = `<div class="fx-overlay" style="background:${layer.bg};mix-blend-mode:${layer.blend};opacity:${layer.opacity / 100}"></div>`;
    }
    markup = `<div class="fx-step fx-composite">${markup}${overlay}</div>`;
  });

  let code = "";
  if (svgDefs.length) {
    code += `<!-- SVG filters: place at top of <body> -->\n<svg width="0" height="0" aria-hidden="true"><defs>${svgDefs.join("")}</defs></svg>\n\n`;
  }
  if (hasGrain) {
    code += `<!-- grain-noise.png: a 200×200 grayscale noise texture -->\n`;
  }
  code += `<!-- Effects are nested to preserve top-to-bottom stack order -->\n<div class="filter-stage">${markup}</div>\n`;
  code += `\n<style>\n.filter-stage,.fx-step{position:relative;display:inline-block;max-width:100%;line-height:0}\n.filter-img{display:block;max-width:100%}\n.fx-overlay,.fx-derived{position:absolute;inset:0;pointer-events:none;overflow:hidden}\n.fx-derived-content,.fx-derived .fx-step,.fx-derived .filter-img{width:100%;height:100%}\n.fx-composite{isolation:isolate}\n@keyframes psy-hue{to{filter:hue-rotate(360deg)}}\n.anim-psy{animation-name:psy-hue;animation-timing-function:linear;animation-iteration-count:infinite}\n</style>\n`;
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

if (typeof document !== "undefined") document.addEventListener("dragover", (e) => {
  const card = e.target.closest(".effect-card");
  if (card) {
    e.preventDefault();
    $$(".effect-card").forEach((c) => c.classList.remove("dragging-over"));
    card.classList.add("dragging-over");
  }
});

if (typeof document !== "undefined") document.addEventListener("drop", (e) => {
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
    const operations = state.exportLayers || [];
    const canvas = await renderExportCanvas(img, operations);
    const allowsBlank = operations.some((operation) => operation.effect === "opacity" && operation.params.v === 0);
    if (!allowsBlank && !hasVisiblePixels(canvas)) throw new Error("Export produced a blank image");

    canvas.toBlob((blob) => {
      if (!blob) {
        showToast("Export failed — image could not be encoded");
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "wobbletone-fx-" + Date.now() + ".png";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast("Saved PNG (ordered stack)");
    }, "image/png");
  } catch (err) {
    console.error("Export failed:", err);
    showToast(err.message || "Export failed — see console");
  }
}

async function renderExportCanvas(img, operations) {
  const W = img.naturalWidth, H = img.naturalHeight;
  let source = createCanvas(W, H);
  let destination = createCanvas(W, H);
  let scratch = null;
  source.getContext("2d").drawImage(img, 0, 0, W, H);

  for (let i = 0; i < operations.length;) {
    const operation = operations[i];
    if (operation.layer.kind === "filter") {
      const filters = [];
      while (i < operations.length && operations[i].layer.kind === "filter") {
        filters.push(operations[i].layer.filter);
        i++;
      }
      applyCssFilter(source, destination, filters.join(" "), W, H);
    } else if (operation.layer.kind === "svg") {
      applyPixelEffect(source, destination, operation.effect, operation.params, W, H);
      i++;
    } else {
      if (operation.layer.useImage && !scratch) scratch = createCanvas(W, H);
      await applyOrderedOverlay(source, destination, scratch, operation, W, H);
      i++;
    }
    [source, destination] = [destination, source];
  }
  return source;
}

function createCanvas(W, H) {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  return canvas;
}

function resetCanvas(ctx, W, H) {
  ctx.filter = "none";
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.clearRect(0, 0, W, H);
}

function applyCssFilter(source, destination, filter, W, H) {
  const ctx = destination.getContext("2d");
  resetCanvas(ctx, W, H);
  ctx.filter = filter;
  ctx.drawImage(source, 0, 0, W, H);
  ctx.filter = "none";
}

function applyPixelEffect(source, destination, effect, params, W, H) {
  const sourceCtx = source.getContext("2d");
  const destinationCtx = destination.getContext("2d");
  const imageData = sourceCtx.getImageData(0, 0, W, H);
  transformPixelData(imageData, effect, params, W, H);
  resetCanvas(destinationCtx, W, H);
  destinationCtx.putImageData(imageData, 0, 0);
}

function transformPixelData(imageData, effect, params, W, H) {
  const data = imageData.data;
  if (effect === "chromatic") {
    const original = new Uint8ClampedArray(data);
    const offset = Math.round(params.offset);
    const strength = params.strength / 100;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        const ri = (y * W + clamp(x - offset, 0, W - 1)) * 4;
        const bi = (y * W + clamp(x + offset, 0, W - 1)) * 4;
        data[i] = lerpByte(original[i], original[ri], strength);
        data[i + 1] = original[i + 1];
        data[i + 2] = lerpByte(original[i + 2], original[bi + 2], strength);
      }
    }
    return imageData;
  }

  const colors = pixelEffectColors(effect, params);
  for (let i = 0; i < data.length; i += 4) {
    if (effect === "posterize") {
      const steps = clamp(Math.round(params.steps), 2, 16);
      data[i] = posterizeByte(data[i], steps);
      data[i + 1] = posterizeByte(data[i + 1], steps);
      data[i + 2] = posterizeByte(data[i + 2], steps);
      continue;
    }
    const luminance = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
    const mapped = mapPixelColor(luminance, colors);
    data[i] = mapped[0];
    data[i + 1] = mapped[1];
    data[i + 2] = mapped[2];
  }
  return imageData;
}

function pixelEffectColors(effect, params) {
  if (effect === "duotone") {
    const shadow = hexToRgb(params.shadow);
    const highlight = hexToRgb(params.highlight);
    const contrast = 1 + params.contrast / 100;
    return [shadow, highlight.map((value) => clamp(Math.round((value - 127.5) * contrast + 127.5), 0, 255))];
  }
  if (effect === "tritone") return [hexToRgb(params.shadow), hexToRgb(params.mid), hexToRgb(params.highlight)];
  const intensity = params.intensity / 100;
  return [
    [0.02, 0, 0.15], [0.1, 0, 0.4], [0.35, 0.05, 0.55],
    [0.7, 0.25, 0.1], [0.95, 0.7, 0.05], [1, 1, 0.9],
  ].map((color) => color.map((value) => Math.round(value * intensity * 255)));
}

function mapPixelColor(value, colors) {
  const position = value * (colors.length - 1);
  const lower = Math.floor(position);
  const upper = Math.min(colors.length - 1, lower + 1);
  const amount = position - lower;
  return colors[lower].map((channel, index) => lerpByte(channel, colors[upper][index], amount));
}

function posterizeByte(value, steps) {
  const band = Math.min(steps - 1, Math.floor(value / 256 * steps));
  return Math.round(band / (steps - 1) * 255);
}

function lerpByte(start, end, amount) {
  return clamp(Math.round(start + (end - start) * amount), 0, 255);
}

async function applyOrderedOverlay(source, destination, scratch, operation, W, H) {
  const { effect, params, layer } = operation;
  const ctx = destination.getContext("2d");
  resetCanvas(ctx, W, H);
  ctx.drawImage(source, 0, 0, W, H);
  ctx.globalAlpha = (layer.opacity ?? 100) / 100;
  ctx.globalCompositeOperation = BLEND_TO_COMPOSITE[layer.blend] || "source-over";

  if (layer.special === "grain") {
    const grain = await loadImage(layer.grainUri);
    for (let y = 0; y < H; y += 200) {
      for (let x = 0; x < W; x += 200) ctx.drawImage(grain, x, y, 200, 200);
    }
  } else if (layer.useImage) {
    const scratchCtx = scratch.getContext("2d");
    resetCanvas(scratchCtx, W, H);
    scratchCtx.filter = layer.imgFilter || "none";
    scratchCtx.drawImage(source, 0, 0, W, H);
    scratchCtx.filter = "none";
    if (layer.bg) {
      scratchCtx.globalCompositeOperation = BLEND_TO_COMPOSITE[layer.bgBlend] || "color";
      scratchCtx.fillStyle = layer.bg;
      scratchCtx.fillRect(0, 0, W, H);
      scratchCtx.globalCompositeOperation = "source-over";
    }
    ctx.drawImage(scratch, 0, 0, W, H);
  } else {
    drawEffectBackground(ctx, effect, params, W, H);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
}

function drawEffectBackground(ctx, effect, params, W, H) {
  if (effect === "colorwash") {
    ctx.fillStyle = params.color;
    ctx.fillRect(0, 0, W, H);
    return;
  }
  if (effect === "vignette") {
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(W / 2, H / 2);
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    gradient.addColorStop((100 - params.size) / 100, "transparent");
    gradient.addColorStop(1, params.color);
    ctx.fillStyle = gradient;
    ctx.fillRect(-1, -1, 2, 2);
    ctx.restore();
    return;
  }
  if (effect === "scanlines") {
    ctx.fillStyle = params.color;
    for (let y = 0; y < H; y += params.size) ctx.fillRect(0, y, W, 1);
    return;
  }
  const stops = effect === "prism"
    ? [[0.5 - params.width / 200, "transparent"], [0.5 - params.width / 600, params.c1], [0.5, "#fff"], [0.5 + params.width / 600, params.c2], [0.5 + params.width / 200, "transparent"]]
    : [[0, params.c1], [1, params.c2]];
  const gradient = createLinearGradient(ctx, params.angle, W, H);
  stops.forEach(([offset, color]) => gradient.addColorStop(clamp(offset, 0, 1), color));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);
}

function createLinearGradient(ctx, angle, W, H) {
  const radians = angle * Math.PI / 180;
  const dx = Math.sin(radians);
  const dy = -Math.cos(radians);
  const length = Math.abs(W * dx) + Math.abs(H * dy);
  return ctx.createLinearGradient(W / 2 - dx * length / 2, H / 2 - dy * length / 2, W / 2 + dx * length / 2, H / 2 + dy * length / 2);
}

function hasVisiblePixels(canvas) {
  const sample = createCanvas(20, 20);
  const ctx = sample.getContext("2d");
  ctx.drawImage(canvas, 0, 0, 20, 20);
  const data = ctx.getImageData(0, 0, 20, 20).data;
  for (let i = 3; i < data.length; i += 4) if (data[i] > 0) return true;
  return false;
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
  compare.addEventListener("change", () => {
    state.comparing = compare.checked;
    render();
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

if (typeof document !== "undefined") document.addEventListener("DOMContentLoaded", init);
if (typeof module !== "undefined") {
  module.exports = { transformPixelData, posterizeByte, mapPixelColor, pixelEffectColors };
}
