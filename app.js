/* ===== Filter Forge — app.js ===== */
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
      const def = `<filter id="${id}" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0.299 0.587 0.114 0 0  0.299 0.587 0.114 0 0  0.299 0.587 0.114 0 0  0 0 0 1 0" result="g"/><feComponentTransfer in="g"><feFuncR tableValues="${sr} ${clamp(lift(hr),0,1).toFixed(3)}"/><feFuncG tableValues="${sg} ${clamp(lift(hg),0,1).toFixed(3)}"/><feFuncB tableValues="${sb} ${clamp(lift(hb),0,1).toFixed(3)}"/></feComponentTransfer></filter>`;
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
      const def = `<filter id="${id}" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0.299 0.587 0.114 0 0  0.299 0.587 0.114 0 0  0.299 0.587 0.114 0 0  0 0 0 1 0" result="g"/><feComponentTransfer in="g"><feFuncR tableValues="${sr} ${mr} ${hr}"/><feFuncG tableValues="${sg} ${mg} ${hg}"/><feFuncB tableValues="${sb} ${mb} ${hb}"/></feComponentTransfer></filter>`;
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
      const def = `<filter id="${id}" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0.299 0.587 0.114 0 0  0.299 0.587 0.114 0 0  0.299 0.587 0.114 0 0  0 0 0 1 0" result="g"/><feComponentTransfer in="g"><feFuncR tableValues="${R}"/><feFuncG tableValues="${G}"/><feFuncB tableValues="${B}"/></feComponentTransfer></filter>`;
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
    id: "chromatic", name: "Chromatic Aberration", icon: "🔵", desc: "RGB channel fringe split", category: "Light", type: "filter",
    params: [
      { key: "offset", label: "Split", type: "slider", min: 0, max: 20, step: 0.5, default: 4, unit: "px" },
      { key: "strength", label: "Strength", type: "slider", min: 0, max: 100, step: 1, default: 70, unit: "%" },
    ],
    build: (p) => {
      const a = (p.strength / 100).toFixed(2);
      const o = p.offset;
      return { kind: "filter", filter: `drop-shadow(${o}px 0 0 rgba(255,0,80,${a})) drop-shadow(${-o}px 0 0 rgba(0,200,255,${a}))` };
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

/* ---------- Rendering ---------- */
const GRAIN_URI = (size) =>
  `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='${size}' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E`;

function render() {
  const img = $("#base-image");
  const overlays = $("#overlay-layers");
  const svgDefs = $("#svg-filters");

  if (!state.imageSrc) return;

  img.src = state.imageSrc;

  // Build layers in order
  const filterParts = [];
  const svgDefStrings = [];
  const overlayHTML = [];
  const overlayStyles = [];
  const anims = [];

  state.effects.forEach((eff) => {
    if (!eff.enabled) return;
    const def = CATALOG_BY_ID[eff.defId];
    const layer = def.build(eff.params, `f-${eff.key}`);
    if (!layer) return;

    if (layer.kind === "filter") {
      filterParts.push(layer.filter);
      if (layer.anim) anims.push(layer.anim);
    } else if (layer.kind === "svg") {
      svgDefStrings.push(layer.def);
      filterParts.push(layer.ref);
    } else if (layer.kind === "overlay") {
      if (layer.special === "grain") {
        overlayHTML.push(`<div class="overlay-layer" style="background-image:url('${GRAIN_URI(layer.size)}');mix-blend-mode:${layer.blend};opacity:${layer.opacity}%"></div>`);
      } else {
        let style = "";
        if (layer.useImage) {
          style += `background-image:url('__IMG__');background-size:cover;`;
          if (layer.imgFilter) style += `filter:${layer.imgFilter};`;
          if (layer.bg) style += `background-color:${layer.bg};background-blend-mode:${layer.bgBlend || "normal"};`;
        } else {
          style += `background:${layer.bg};`;
        }
        style += `mix-blend-mode:${layer.blend};opacity:${layer.opacity}%`;
        overlayHTML.push(`<div class="overlay-layer" style="${style}"></div>`);
      }
    }
  });

  // Apply — substitute real image src for live preview
  svgDefs.innerHTML = svgDefStrings.join("");
  img.style.filter = filterParts.length ? filterParts.join(" ") : "none";
  overlays.innerHTML = overlayHTML.join("").replace(/__IMG__/g, state.imageSrc);

  // Animations
  applyAnimations(anims);

  // Code — use user's filename as placeholder
  generateCode(filterParts, svgDefStrings, overlayHTML.map((h) => h.replace(/__IMG__/g, state.imageName)), anims);
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
  const reader = new FileReader();
  reader.onload = (e) => {
    state.imageSrc = e.target.result;
    $("#upload-prompt").hidden = true;
    $("#preview-wrap").hidden = false;
    render();
  };
  reader.readAsDataURL(file);
}

/* ---------- Download (render to canvas) ---------- */
async function downloadPNG() {
  if (!state.imageSrc) return showToast("Upload an image first");
  try {
    const img = await loadImage(state.imageSrc);
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    ctx.filter = $("#base-image").style.filter || "none";
    ctx.drawImage(img, 0, 0);
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "filter-forge-" + Date.now() + ".png";
      a.click();
      URL.revokeObjectURL(url);
      showToast("Saved PNG (base filter only)");
    });
  } catch (err) {
    showToast("Save failed — overlays need manual export");
  }
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
  // Upload
  const prompt = $("#upload-prompt");
  const fileInput = $("#file-input");
  prompt.onclick = () => fileInput.click();
  fileInput.onchange = (e) => handleFile(e.target.files[0]);

  // Drag & drop file
  const stage = $("#stage");
  stage.addEventListener("dragover", (e) => { e.preventDefault(); stage.style.outline = "2px solid var(--accent)"; });
  stage.addEventListener("dragleave", () => (stage.style.outline = ""));
  stage.addEventListener("drop", (e) => {
    e.preventDefault();
    stage.style.outline = "";
    handleFile(e.dataTransfer.files[0]);
  });

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
