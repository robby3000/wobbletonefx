/* ===== WobbleTone FX — app.js ===== */
"use strict";

import { specFromLegacy, validateSpec } from "./engine/spec.js";
import { renderToCanvas } from "./engine/canvas.js";

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

const DRAMA_LOOKS = {
  cinematic: { curve: [0, 0.18, 0.52, 0.82, 1], saturation: 0.9, shadow: [-0.015, 0.002, 0.025], highlight: [0.028, 0.012, -0.01] },
  noir: { curve: [0, 0.11, 0.5, 0.9, 1], saturation: 0, shadow: [0, 0, 0], highlight: [0, 0, 0] },
  bleach: { curve: [0.035, 0.19, 0.53, 0.86, 0.99], saturation: 0.38, shadow: [-0.01, 0, 0.012], highlight: [0.024, 0.018, 0] },
  storm: { curve: [0, 0.14, 0.46, 0.76, 0.94], saturation: 0.72, shadow: [-0.015, 0.004, 0.04], highlight: [-0.006, 0.004, 0.022] },
  portrait: { curve: [0.018, 0.23, 0.51, 0.79, 0.985], saturation: 0.95, shadow: [0, 0, 0.006], highlight: [0.032, 0.014, -0.006] },
};

function dramaSettings(params) {
  const look = DRAMA_LOOKS[String(params.style || "cinematic").toLowerCase()] || DRAMA_LOOKS.cinematic;
  const strength = clamp(Number(params.strength) || 0, 0, 100) / 100;
  const shadows = clamp(Number(params.shadows) || 0, -50, 50) / 50 * 0.12 * strength;
  const highlights = clamp(Number(params.highlights) || 0, -50, 50) / 50 * 0.12 * strength;
  const requestedSaturation = clamp(Number(params.saturation) || 0, 0, 150) / 100;
  const saturation = 1 + (look.saturation * requestedSaturation - 1) * strength;
  const tableSize = 17;
  const tables = [0, 1, 2].map((channel) => {
    let previous = 0;
    return Array.from({ length: tableSize }, (_, index) => {
      const x = index / (tableSize - 1);
      const position = x * (look.curve.length - 1);
      const lower = Math.floor(position);
      const upper = Math.min(look.curve.length - 1, lower + 1);
      const styled = look.curve[lower] + (look.curve[upper] - look.curve[lower]) * (position - lower);
      const tone = x + (styled - x) * strength + shadows * (1 - x) * (1 - x) + highlights * x * x;
      const grade = (look.shadow[channel] * (1 - x) + look.highlight[channel] * x) * strength;
      const value = Math.max(previous, clamp(tone + grade, 0, 1));
      previous = value;
      return value;
    });
  });
  return { saturation, tables };
}

function buildDramaLayer(params, id) {
  const settings = dramaSettings(params);
  const table = (values) => values.map((value) => value.toFixed(4)).join(" ");
  const def = `<filter id="${id}" color-interpolation-filters="sRGB"><feColorMatrix type="saturate" values="${settings.saturation.toFixed(4)}" result="drama-sat"/><feComponentTransfer in="drama-sat"><feFuncR type="table" tableValues="${table(settings.tables[0])}"/><feFuncG type="table" tableValues="${table(settings.tables[1])}"/><feFuncB type="table" tableValues="${table(settings.tables[2])}"/></feComponentTransfer></filter>`;
  return { kind: "svg", id, def, ref: `url(#${id})` };
}

const GLITCH_PROFILES = {
  "ccd-failure": { displacement: 0.58, active: 0.46, exposure: 0.22, split: 0.8, frequencyX: 0.006, octaves: 1, noise: "turbulence" },
  "vhs-tear": { displacement: 0.38, active: 0.72, exposure: 0.08, split: 0.55, frequencyX: 0.003, octaves: 2, noise: "fractalNoise" },
  "rgb-fracture": { displacement: 0.14, active: 0.3, exposure: 0, split: 1.7, frequencyX: 0.012, octaves: 1, noise: "turbulence" },
  "signal-loss": { displacement: 0.68, active: 0.56, exposure: 0.42, split: 0.45, frequencyX: 0.004, octaves: 1, noise: "turbulence" },
};

function glitchSettings(params) {
  const style = String(params.style || "CCD Failure").toLowerCase().replace(/\s+/g, "-");
  const profile = GLITCH_PROFILES[style] || GLITCH_PROFILES["ccd-failure"];
  const amount = clamp(Number(params.amount) || 0, 0, 100) / 100;
  const bandSize = clamp(Number(params.bandSize) || 0, 1, 100) / 100;
  const split = clamp(Number(params.split) || 0, 0, 30) * profile.split * amount;
  const displacement = amount * 100 * profile.displacement;
  const frequencyY = 0.015 + (1 - bandSize) * 0.1;
  return { style, profile, amount, bandSize, split, displacement, frequencyY, seed: Math.round(clamp(Number(params.seed) || 1, 1, 9999)) };
}

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let result = value;
    result = Math.imul(result ^ result >>> 15, result | 1);
    result ^= result + Math.imul(result ^ result >>> 7, result | 61);
    return ((result ^ result >>> 14) >>> 0) / 4294967296;
  };
}

function buildGlitchBands(params, width, height) {
  const settings = glitchSettings(params);
  const styleSeed = [...settings.style].reduce((value, char) => Math.imul(value ^ char.charCodeAt(0), 16777619), settings.seed);
  const random = seededRandom(styleSeed);
  const targetBands = 4 + (1 - settings.bandSize) * 36;
  const averageHeight = Math.max(1, Math.round(height / targetBands));
  const bands = [];
  for (let y = 0; y < height;) {
    const bandHeight = Math.min(height - y, Math.max(1, Math.round(averageHeight * (0.55 + random() * 1.1))));
    const active = settings.amount > 0 && random() < settings.profile.active * (0.35 + settings.amount * 0.65);
    const dx = active ? Math.round((random() * 2 - 1) * settings.displacement) : 0;
    const dy = active ? Math.round((random() * 2 - 1) * settings.displacement * 0.06) : 0;
    const exposure = active ? 1 - random() * settings.profile.exposure * settings.amount : 1;
    bands.push({ y, height: bandHeight, dx, dy, exposure });
    y += bandHeight;
  }
  return { bands, split: Math.round(settings.split) };
}

function buildGlitchLayer(params, id) {
  const settings = glitchSettings(params);
  const darkening = 1 - settings.profile.exposure * settings.amount * 0.12;
  const split = Math.round(settings.split).toFixed(2);
  const def = `<filter id="${id}" x="-15%" y="-8%" width="130%" height="116%" color-interpolation-filters="sRGB"><feTurbulence type="${settings.profile.noise}" baseFrequency="${settings.profile.frequencyX.toFixed(4)} ${settings.frequencyY.toFixed(4)}" numOctaves="${settings.profile.octaves}" seed="${settings.seed}" result="glitch-noise"/><feColorMatrix in="glitch-noise" type="matrix" values="1 0 0 0 0  0 0 0 0 0.5  0 0 0 0 0  0 0 0 1 0" result="horizontal-noise"/><feDisplacementMap in="SourceGraphic" in2="horizontal-noise" scale="${settings.displacement.toFixed(2)}" xChannelSelector="R" yChannelSelector="G" result="torn"/><feComponentTransfer in="torn" result="exposed"><feFuncR type="linear" slope="${darkening.toFixed(4)}"/><feFuncG type="linear" slope="${darkening.toFixed(4)}"/><feFuncB type="linear" slope="${darkening.toFixed(4)}"/></feComponentTransfer><feColorMatrix in="exposed" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="red"/><feOffset in="red" dx="${split}" dy="0" result="red-shift"/><feColorMatrix in="exposed" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="green"/><feColorMatrix in="exposed" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="blue"/><feOffset in="blue" dx="-${split}" dy="0" result="blue-shift"/><feBlend in="red-shift" in2="green" mode="screen" result="red-green"/><feBlend in="red-green" in2="blue-shift" mode="screen" result="glitch-rgb"/><feComposite in="glitch-rgb" in2="SourceGraphic" operator="in"/></filter>`;
  return { kind: "svg", id, def, ref: `url(#${id})` };
}

function showToast(msg, action = null) {
  const t = $("#toast");
  t.replaceChildren();
  const message = document.createElement("span");
  message.className = "toast-message";
  message.textContent = msg;
  t.appendChild(message);
  if (action) {
    const button = document.createElement("button");
    button.className = "toast-action";
    button.type = "button";
    button.textContent = action.label;
    button.onclick = () => {
      clearTimeout(showToast._t);
      t.hidden = true;
      action.run();
    };
    t.appendChild(button);
  }
  t.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => (t.hidden = true), action ? 5000 : 2200);
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
  {
    id: "drama", name: "Drama", icon: "◒", desc: "Cinematic tone curve and colour grade", category: "Tone", type: "svg",
    params: [
      { key: "style", label: "Look", type: "select", default: "Cinematic", options: ["Cinematic", "Noir", "Bleach", "Storm", "Portrait"] },
      { key: "strength", label: "Strength", type: "slider", min: 0, max: 100, step: 1, default: 70, unit: "%" },
      { key: "shadows", label: "Shadows", type: "slider", min: -50, max: 50, step: 1, default: 0, unit: "" },
      { key: "highlights", label: "Highlights", type: "slider", min: -50, max: 50, step: 1, default: 0, unit: "" },
      { key: "saturation", label: "Saturation", type: "slider", min: 0, max: 150, step: 1, default: 100, unit: "%" },
    ],
    build: buildDramaLayer,
  },

  /* ---- Bloom / glow overlay using image ---- */
  {
    id: "bloom", name: "Bloom / Glow", icon: "✦", desc: "Highlight bloom, glow, or warm halation", category: "Light", type: "overlay",
    params: [
      { key: "blur", label: "Spread", type: "slider", min: 0, max: 60, step: 0.5, default: 12, unit: "px" },
      { key: "threshold", label: "Threshold", type: "slider", min: 50, max: 400, step: 5, default: 140, unit: "%" },
      { key: "contrast", label: "Highlight isolation", type: "slider", min: 100, max: 250, step: 5, default: 180, unit: "%" },
      { key: "saturate", label: "Bloom saturation", type: "slider", min: 0, max: 200, step: 5, default: 100, unit: "%" },
      { key: "opacity", label: "Strength", type: "slider", min: 0, max: 100, step: 1, default: 50, unit: "%" },
      { key: "color", label: "Tint", type: "color", default: "#ffffff" },
      { key: "tint", label: "Tint amount", type: "slider", min: 0, max: 100, step: 1, default: 0, unit: "%" },
      { key: "blend", label: "Blend", type: "select", default: "screen", options: ["screen", "lighten"] },
    ],
    build: (p) => ({
      kind: "overlay", useImage: true,
      imgFilter: `brightness(${p.threshold}%) contrast(${p.contrast}%) blur(${p.blur}px) saturate(${p.saturate}%)`,
      bg: p.tint > 0 ? p.color : null, bgBlend: "color", bgOpacity: p.tint,
      blend: p.blend, opacity: p.opacity,
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
    id: "glitch", name: "Glitch", icon: "▤", desc: "Seeded sensor tearing and RGB fracture", category: "Stylize", type: "svg",
    params: [
      { key: "style", label: "Style", type: "select", default: "CCD Failure", options: ["CCD Failure", "VHS Tear", "RGB Fracture", "Signal Loss"] },
      { key: "amount", label: "Amount", type: "slider", min: 0, max: 100, step: 1, default: 42, unit: "%" },
      { key: "bandSize", label: "Band size", type: "slider", min: 1, max: 100, step: 1, default: 28, unit: "%" },
      { key: "split", label: "RGB split", type: "slider", min: 0, max: 30, step: 0.5, default: 6, unit: "px" },
      { key: "seed", label: "Seed", type: "slider", min: 1, max: 9999, step: 1, default: 317, unit: "" },
    ],
    build: buildGlitchLayer,
  },
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
  img: null, // decoded Image element the engine preview draws from
  imageName: "your-image.jpg",
  effects: [], // { key, defId, enabled, expanded, params }
  displayScale: 1, // previewWidth / nativeWidth — px values scaled by this in preview
  exportLayers: [],
  comparing: false,
  hasUserImage: false,
  imageWidth: 800,
  imageHeight: 600,
  previewZoomed: false,
  suppressPreviewTransition: false,
  zoomPoint: { x: 0.5, y: 0.5 },
  generatedCode: { all: "", html: "", css: "" },
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

function migrateEffectData(effect) {
  if (!effect || !effect.defId) return null;
  const params = { ...(effect.params || {}) };
  if (effect.defId === "glow") {
    return { ...effect, defId: "bloom", params: {
      blur: params.blur ?? 8,
      threshold: params.brightness ?? 180,
      contrast: 100,
      saturate: 130,
      opacity: params.opacity ?? 60,
      color: params.color || "#ffffff",
      tint: 100,
      blend: "screen",
    } };
  }
  if (effect.defId === "halation") {
    return { ...effect, defId: "bloom", params: {
      blur: params.blur ?? 18,
      threshold: params.threshold ?? 160,
      contrast: 200,
      saturate: 100,
      opacity: params.opacity ?? 55,
      color: params.color || "#ff7a3c",
      tint: 100,
      blend: "lighten",
    } };
  }
  return { ...effect, params };
}

function normalizeEffectData(effect) {
  const migrated = migrateEffectData(effect);
  if (!migrated || !CATALOG_BY_ID[migrated.defId]) return null;
  const normalized = makeEffect(migrated.defId, migrated.params);
  normalized.enabled = migrated.enabled !== false;
  return normalized;
}

function serializeEffects(effects, enabledOnly = false) {
  return effects
    .filter((effect) => !enabledOnly || effect.enabled !== false)
    .map((effect) => ({
      defId: effect.defId,
      enabled: effect.enabled !== false,
      params: { ...effect.params },
    }));
}

function cloneEffects(effects) {
  return effects.map((effect) => ({ ...effect, params: { ...effect.params } }));
}

/* ---------- Spec bridge ---------- */
// Runtime effect stack → Filter Specification (the semantic source of truth).
function effectsToSpec(effects, name) {
  return specFromLegacy(serializeEffects(effects, true), name);
}

// Filter Specification → runtime effect records for state.effects.
// validateSpec throws with a clear message on unknown types / malformed specs.
function specToEffects(spec) {
  const validated = validateSpec(spec);
  return validated.effects
    .map((effect) => normalizeEffectData({ defId: effect.type, enabled: true, params: effect.params }))
    .filter(Boolean);
}

/* ---------- Preview geometry ---------- */
function calculatePreviewLayout(frameWidth, frameHeight, imageWidth, imageHeight, zoomed = false, point = { x: 0.5, y: 0.5 }) {
  if (![frameWidth, frameHeight, imageWidth, imageHeight].every((value) => Number.isFinite(value) && value > 0)) return null;
  const fitScale = Math.min(frameWidth / imageWidth, frameHeight / imageHeight);
  const absoluteScale = zoomed ? Math.max(1, frameWidth / imageWidth, frameHeight / imageHeight) : fitScale;
  const width = imageWidth * fitScale;
  const height = imageHeight * fitScale;
  const renderedWidth = imageWidth * absoluteScale;
  const renderedHeight = imageHeight * absoluteScale;
  const desiredX = frameWidth / 2 - clamp(point.x, 0, 1) * renderedWidth;
  const desiredY = frameHeight / 2 - clamp(point.y, 0, 1) * renderedHeight;
  const x = zoomed ? clamp(desiredX, frameWidth - renderedWidth, 0) : (frameWidth - width) / 2;
  const y = zoomed ? clamp(desiredY, frameHeight - renderedHeight, 0) : (frameHeight - height) / 2;
  return { width, height, x, y, absoluteScale, transformScale: absoluteScale / fitScale };
}

function currentPreviewLayout() {
  const frame = $("#preview-wrap");
  if (!frame) return null;
  return calculatePreviewLayout(
    frame.clientWidth,
    frame.clientHeight,
    state.imageWidth,
    state.imageHeight,
    state.previewZoomed,
    state.zoomPoint,
  );
}

function applyPreviewLayout(container, layout) {
  if (!layout) return;
  container.classList.toggle("no-transition", state.suppressPreviewTransition);
  container.style.width = `${layout.width}px`;
  container.style.height = `${layout.height}px`;
  container.style.transform = `translate(${layout.x}px, ${layout.y}px) scale(${layout.transformScale})`;
  container.classList.toggle("is-zoomed", state.previewZoomed);
  $("#preview-wrap").classList.toggle("is-zoomed", state.previewZoomed);
  if (state.suppressPreviewTransition) {
    state.suppressPreviewTransition = false;
    requestAnimationFrame(() => container.classList.remove("no-transition"));
  }
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

// Fixed 64x64 grayscale noise tile for the Code tab export only.
// The preview and PNG export use the runtime-generated GRAIN_URI() above;
// this static tile keeps generated HTML self-contained (no external PNG file).
const GRAIN_TILE_64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAbhElEQVR4nE3bBbSWVRMF4KPYjWJ3KxZ2dzcWtgKK3d2FDbaADaKgoGILtiK2WGB3d3eO65m15l//XYt17/2+9z1nZs/ee+a896Ptt99+cfrpp8e9994bL774YgwdOjQmn3zy6Nu3bxx//PEx7bTTxpdffhm77757vPfee3H44YfHrbfeGo8//jisuOKK8dRTT+V7559/flx++eWx4447Rvfu3WPfffeNI488Muaaa6648sorY8CAAdGjR48YO3ZsfPzxx/H111/HzTffHBdccEFss802udeUU04Z7777bkw88cS59gwzzBA//vhj3nvKKafEd999FzPPPHN+n2222eLss8+OTp06xVJLLRUDBw6M5557LkaPHh0PP/xwbLzxxrHmmmvGYYcdFlNMMUWssMIKscoqq8QHH3wQvj777LO47777ornwgQceiC5dusRWW20Vr776alx99dW5yWSTTRannXZaAvDCCy/E5ptvHjvttFOsuuqqceGFF8YGG2wQDz30UAwbNiyefvrpWH311WPIkCGx3Xbb5XoTTTRRbLnllrmZAJ9//vnYYYcd4qijjopRo0bFiBEjomvXrrH00kvHWmutlckeffTRmchxxx2X74nn9ddfzxgnmWSSWGONNeK8886LxRdfPBO69tprY7lllovVVlstAZ5uuuli/vnnzyS7desWzz77bPz9999xyy23xDfffBP//vtvfPrpp/HYY4/FmDFjoi222GKx2Wabxeyzzx6PPvpoLrDtttvGmWeeGbfffnsuNumkk8aJJ56YQAj0sssuy2T/+OOP+Pzzz2PRRReN/fffP+9bdtll45FHHsmADjzwwNxUECoNACBKXnW//fbbBOe6667LxACwyIKLZII///xzAo11AFLZkSNHxvDhw3Pv/v37Z4y9evWKZZZZJtZff/0YN25crLzyyhnnscceGzvvvHNcf/31ud+CCy6YRb3hhhuyACcccEL88MMP0SAsaMHvscceSTGBoO7cc8+dlezXr1+ceuqp8eCDD8a5554be+65Z1bDvehHBpdccknMNNNMsc4668QXX3yR7DjooIPiiSeeyCQF+corr2RV3XPnnXfGpptumuCdccYZCcg111wTffr0iddeey2raw2BYqLfp5lmmkyCJMTwzz//5Jr2bq0lGzBQsoqJtZhKBgcccEDKhtzkh33ybhAWpMQ//PDDuO222/L3N998M6lNDpjwxhtvJJUgzysgjpaqzRMOPvjgBIAX0KY1VFgl11577QSMHO65555ch3Q22mijrHjHjh3zd9IZP358zDrrrPma9f1bb731MnEFIQeVU0nexUfcu/eee6f/uJf0Lr300qS42I455piYd955U/88zT7Y5LrGHOhtgQUWiA4dOiSlBN+5c+dETLKHHHJIomkRQUseYIL0/jPPPBMLL7xwzDHHHFlhKJMV1P/888+kpXsFBwTrkxyj7dmzZ5x11llpeqhPLpg455xzxi677JLrqpT3mSxjdb33X3rppWQAdvKNvfbaKwsgyd122y0ZSO9ykjCj9cWPsG3GGWeMptIuhuQ555yT6PIF5sgoLIAlqMSdJY2aFqRLpmhD2iQFldZJ3n///dS97iJp6zIp1SeHCSaYIH3C/fYhM9REXyzQEdAUtYGlGDqLyvOVWWaZJX2HH1jPe7qRn90rNsCTLGbvuuuuCZKCc3+ymXrqqaMxObp58skn45NPPom//vormUDfG264YVZScAxF9Q899NDUHm+wETr17t37f8FoeWhKNt779dff0+SwwuukghnWYkYCFzRDxcKtt946brrpprxfu9x+++1Dq+YXEhcLj2Buv//+e7ZlazFqHQYLScPP88wzT8qCz+hSQCFxhdKqgdho0A+0KjlBMEB0Pfnkk5MZgkFtLYTRSIYDMy5Jvv3224mwILxuQ9TWf1VUJRiZAKaaaqo0qN9++y0TUCGmCJQJJ5wwq8U77EsKGKD6WHrRRRdlIXiK7/a2h70kbi2GqwjywUJSxmJ5Dho0KE466aQsls6g6A36jI3bekEyWiFW8AYaRlWVg6jkOL0AJQX9d955Jxe/6667svXdfffduRHKA5VHeJ2MgAYkOqZJQVpXy+MTOgi9o7N9AT/99NNnjExWvJWcauoOK620UoK7zz77ZLzmAjMNALHZnoBXQMaHebxCMRMATov+EjJZLbTQQtny6JphSPDGG2+M+eabLx3V5iomEBTTulTJjIAFPMI0RtN6M58BmH6uosBSObQkEQxjqldddVX6D3DIxZqCBwKwrENuSyyxRHYGnsWg5cCkSU2B+M1HH32UOcnHvaTGa1zLWAGqOM2FkMIADqvtSQRt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";
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

// Preview is a single engine-rendered canvas — no DOM filter stack, no SVG
// defs, no cloned pipeline trees. Slider input is coalesced to one render
// per frame via requestAnimationFrame.
const PREVIEW_MAX_DIM = 1600;
let renderQueued = false;

function render() {
  if (typeof requestAnimationFrame !== "function") return renderNow();
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    renderNow();
  });
}

function renderNow() {
  const container = $("#layer-container");
  if (!state.imageSrc || !container) return;

  const layout = currentPreviewLayout();
  if (layout) state.displayScale = layout.width / state.imageWidth;

  // Operations still feed generateCode + the PNG export path (replaced in W4).
  const operations = [];
  state.effects.forEach((eff) => {
    if (!eff.enabled) return;
    const layer = CATALOG_BY_ID[eff.defId].build(eff.params, `f-${eff.key}`);
    if (!layer) return;
    operations.push({ effect: eff.defId, params: { ...eff.params }, layer });
  });
  state.exportLayers = operations;

  const status = $("#image-status");
  const baseName = state.hasUserImage ? state.imageName : "Sample image";

  if (state.comparing) {
    const img = document.createElement("img");
    img.className = "base-image";
    img.alt = "Preview";
    img.src = state.imageSrc;
    container.replaceChildren(img);
    if (status) status.textContent = `${baseName} — original`;
  } else {
    try {
      const opts = {
        maxDim: PREVIEW_MAX_DIM,
        sourceWidth: state.imageWidth,
        sourceHeight: state.imageHeight,
        collectStats: true,
      };
      const canvas = renderToCanvas(state.img, effectsToSpec(state.effects, state.imageName), opts);
      canvas.className = "preview-canvas";
      container.replaceChildren(canvas);
      if (status) {
        status.textContent = `${baseName} — rendered ${canvas.width}×${canvas.height} in ${opts.stats.ms.toFixed(0)}ms`;
      }
    } catch (err) {
      console.error("Preview render failed:", err);
      const img = document.createElement("img");
      img.className = "base-image";
      img.alt = "Preview";
      img.src = state.imageSrc;
      container.replaceChildren(img);
      if (status) status.textContent = `${baseName} — render failed`;
    }
  }

  applyPreviewLayout(container, layout);
  generateCode(operations);
}

/* ---------- Code generation ---------- */
function escapeHtmlAttribute(value) {
  return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function indentCode(value, depth = 1) {
  const pad = "  ".repeat(depth);
  return value.split("\n").map((line) => pad + line).join("\n");
}

function wrapCode(open, children, close = "</div>") {
  return `${open}\n${children.map((child) => indentCode(child)).join("\n")}\n${close}`;
}

function buildGeneratedCode(operations, imageName) {
  const prepared = operations.map((operation, index) => {
    if (operation.layer.kind !== "svg") return operation;
    const id = `wt-${operation.effect.replace(/[^a-z0-9-]/gi, "-").toLowerCase()}-${index + 1}`;
    return { ...operation, layer: CATALOG_BY_ID[operation.effect].build(operation.params, id) };
  });
  const svgDefs = prepared.filter(({ layer }) => layer.kind === "svg").map(({ layer }) => layer.def);
  const hasGrain = prepared.some(({ layer }) => layer.special === "grain");
  const hasAnimation = prepared.some(({ layer }) => layer.anim);
  const derivedCount = prepared.filter(({ layer }) => layer.useImage).length;
  let markup = `<img src="${escapeHtmlAttribute(imageName)}" class="filter-img" alt="" />`;

  prepared.forEach(({ layer }) => {
    if (layer.kind === "filter" || layer.kind === "svg") {
      const filter = layer.kind === "svg" ? layer.ref : layer.filter;
      markup = wrapCode(`<div class="fx-step" style="filter:${filter}">`, [markup]);
      if (layer.anim) markup = wrapCode(`<div class="fx-step anim-psy" style="animation-duration:${layer.anim.dur}s">`, [markup]);
      return;
    }

    let overlay;
    if (layer.special === "grain") {
      overlay = `<div class="fx-overlay" style="background-image:var(--wt-grain);background-size:64px;mix-blend-mode:${layer.blend};opacity:${layer.opacity / 100}"></div>`;
    } else if (layer.useImage) {
      let derived = wrapCode(`<div style="filter:${layer.imgFilter}">`, [markup]);
      if (layer.bg) {
        const tint = `<div class="fx-overlay" style="background:${layer.bg};mix-blend-mode:${layer.bgBlend || "color"};opacity:${(layer.bgOpacity ?? 100) / 100}"></div>`;
        derived = wrapCode('<div class="fx-derived-content">', [derived, tint]);
      }
      overlay = wrapCode(`<div class="fx-derived" style="mix-blend-mode:${layer.blend};opacity:${layer.opacity / 100}">`, [derived]);
    } else {
      overlay = `<div class="fx-overlay" style="background:${layer.bg};mix-blend-mode:${layer.blend};opacity:${layer.opacity / 100}"></div>`;
    }
    markup = wrapCode('<div class="fx-step fx-composite">', [markup, overlay]);
  });

  const htmlParts = [];
  if (svgDefs.length) {
    htmlParts.push(`<!-- Shared SVG filters -->\n<svg width="0" height="0" aria-hidden="true">\n  <defs>\n${svgDefs.map((def) => indentCode(def, 2)).join("\n")}\n  </defs>\n</svg>`);
  }
  if (hasGrain) htmlParts.push("<!-- Film grain uses an embedded 64 x 64 PNG tile. -->");
  htmlParts.push(`<!-- Nested steps preserve the effect order. -->\n<div class="filter-stage">\n${indentCode(markup)}\n</div>`);
  const html = htmlParts.join("\n\n");

  const cssLines = [];
  if (hasGrain) cssLines.push(`.filter-stage { --wt-grain: url('${GRAIN_TILE_64}'); }`);
  cssLines.push(
    ".filter-stage, .fx-step { position: relative; display: inline-block; max-width: 100%; line-height: 0; }",
    ".filter-img { display: block; max-width: 100%; height: auto; }",
    ".fx-overlay, .fx-derived { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }",
    ".fx-derived-content, .fx-derived .fx-step, .fx-derived .filter-img { width: 100%; height: 100%; }",
    ".fx-composite { isolation: isolate; }",
  );
  if (hasAnimation) {
    cssLines.push(
      "@keyframes psy-hue { to { filter: hue-rotate(360deg); } }",
      ".anim-psy { animation-name: psy-hue; animation-timing-function: linear; animation-iteration-count: infinite; }",
      "@media (prefers-reduced-motion: reduce), print { .anim-psy { animation: none; } }",
    );
  }
  const css = `<style>\n${cssLines.join("\n")}\n</style>`;
  return { html, css, all: `${html}\n\n${css}\n`, derivedCount };
}

function generateCode(operations) {
  const output = buildGeneratedCode(operations, state.imageName);
  state.generatedCode = output;
  $("#code-output").textContent = output.all;
  const bytes = new TextEncoder().encode(output.all).length;
  $("#code-meta").textContent = `${(bytes / 1024).toFixed(1)} KB · ${operations.length} active effect${operations.length === 1 ? "" : "s"}`;
  const warning = $("#code-warning");
  warning.hidden = output.derivedCount === 0;
  warning.textContent = output.derivedCount === 0 ? "" : "Bloom / Glow duplicates the preceding visual tree for full fidelity. This increases standalone markup size; exported PNGs are unaffected.";
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
  openModal($("#effect-picker"));
}
function closeEffectPicker() {
  closeModal($("#effect-picker"));
}

/* ---------- Image upload ---------- */
function activateImage(src, name, width, height, hasUserImage, img = null) {
  state.imageSrc = src;
  state.img = img;
  state.imageName = name;
  state.imageWidth = width;
  state.imageHeight = height;
  state.hasUserImage = hasUserImage;
  state.previewZoomed = false;
  state.suppressPreviewTransition = true;
  state.zoomPoint = { x: 0.5, y: 0.5 };
  state.displayScale = 1;
  $("#upload-prompt").hidden = true;
  $("#preview-wrap").hidden = false;
  updateCommandState();
  render();
}

function handleFile(file) {
  if (!file || !file.type.startsWith("image/")) return;
  const reader = new FileReader();
  reader.onload = (event) => {
    const probe = new Image();
    probe.onload = () => activateImage(event.target.result, file.name, probe.naturalWidth, probe.naturalHeight, true, probe);
    probe.onerror = () => showToast("Could not open this image");
    probe.src = event.target.result;
  };
  reader.onerror = () => showToast("Could not read this image");
  reader.readAsDataURL(file);
}

function togglePreviewZoom(event = null) {
  const container = $("#layer-container");
  if (!container || !state.imageWidth || !state.imageHeight) return;
  if (!state.previewZoomed && event?.clientX != null) {
    const rect = container.getBoundingClientRect();
    state.zoomPoint = {
      x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
      y: clamp((event.clientY - rect.top) / rect.height, 0, 1),
    };
  }
  state.previewZoomed = !state.previewZoomed;
  render();
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
  if (effect === "glitch") {
    applyGlitchPixelData(data, params, W, H);
    return imageData;
  }
  if (effect === "drama") {
    applyDramaPixelData(data, params);
    return imageData;
  }
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

function applyGlitchPixelData(data, params, width, height) {
  const source = new Uint8ClampedArray(data);
  const { bands, split } = buildGlitchBands(params, width, height);
  for (const band of bands) {
    const endY = band.y + band.height;
    for (let y = band.y; y < endY; y++) {
      const sourceY = clamp(y - band.dy, 0, height - 1);
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;
        const sourceX = clamp(x - band.dx, 0, width - 1);
        const redIndex = (sourceY * width + clamp(sourceX - split, 0, width - 1)) * 4;
        const greenIndex = (sourceY * width + sourceX) * 4;
        const blueIndex = (sourceY * width + clamp(sourceX + split, 0, width - 1)) * 4;
        data[index] = clamp(Math.round(source[redIndex] * band.exposure), 0, 255);
        data[index + 1] = clamp(Math.round(source[greenIndex + 1] * band.exposure), 0, 255);
        data[index + 2] = clamp(Math.round(source[blueIndex + 2] * band.exposure), 0, 255);
        data[index + 3] = source[index + 3];
      }
    }
  }
}

function applyDramaPixelData(data, params) {
  const { saturation, tables } = dramaSettings(params);
  for (let i = 0; i < data.length; i += 4) {
    const luminance = 0.213 * data[i] + 0.715 * data[i + 1] + 0.072 * data[i + 2];
    const red = clamp(luminance + (data[i] - luminance) * saturation, 0, 255);
    const green = clamp(luminance + (data[i + 1] - luminance) * saturation, 0, 255);
    const blue = clamp(luminance + (data[i + 2] - luminance) * saturation, 0, 255);
    data[i] = sampleDramaTable(red, tables[0]);
    data[i + 1] = sampleDramaTable(green, tables[1]);
    data[i + 2] = sampleDramaTable(blue, tables[2]);
  }
}

function sampleDramaTable(value, table) {
  const position = clamp(value, 0, 255) / 255 * (table.length - 1);
  const lower = Math.floor(position);
  const upper = Math.min(table.length - 1, lower + 1);
  return Math.round((table[lower] + (table[upper] - table[lower]) * (position - lower)) * 255);
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
      scratchCtx.globalAlpha = (layer.bgOpacity ?? 100) / 100;
      scratchCtx.fillStyle = layer.bg;
      scratchCtx.fillRect(0, 0, W, H);
      scratchCtx.globalAlpha = 1;
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
function restoreEffects(effects, message) {
  state.effects = cloneEffects(effects);
  renderEffectsList();
  render();
  showToast(message);
}

function randomize() {
  const previous = cloneEffects(state.effects);
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
  showToast("New surprise stack", { label: "Undo", run: () => restoreEffects(previous, "Surprise undone") });
}

/* ---------- IndexedDB Presets ---------- */
const DB_NAME = "wobbletonefx";
const DB_VERSION = 1;
const STORE_NAME = "presets";
let dbInstance = null;

function openDB() {
  if (dbInstance) return Promise.resolve(dbInstance);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    req.onsuccess = () => {
      dbInstance = req.result;
      dbInstance.onversionchange = () => {
        dbInstance.close();
        dbInstance = null;
      };
      resolve(dbInstance);
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("Preset database is open in another tab"));
  });
}

async function dbGetAll() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => {
      const list = req.result || [];
      list.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      resolve(list);
    };
    req.onerror = () => reject(req.error);
  });
}

async function dbPut(record) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put(record);
    tx.oncomplete = () => resolve(record);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function dbPutMany(records) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    records.forEach((record) => store.put(record));
    tx.oncomplete = () => resolve(records);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function dbDelete(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function generateId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return uid() + Date.now().toString(36);
}

function requestPersistentStorage() {
  if (!navigator.storage || !navigator.storage.persist) return;
  const tryPersist = () => navigator.storage.persist().catch(() => {});
  tryPersist();
  const onFirstGesture = () => {
    navigator.storage.persisted && navigator.storage.persisted().then((ok) => {
      if (!ok) tryPersist();
    }).catch(() => {});
    window.removeEventListener("pointerdown", onFirstGesture);
  };
  window.addEventListener("pointerdown", onFirstGesture, { once: false });
}

/* ---------- Preset library ---------- */
const PRESET_SCHEMA = "wobbletone-presets";
const PRESET_SCHEMA_VERSION = 2;

// v2 records store a Filter Specification; v1 {effects:[{defId,params}]}
// records migrate through specFromLegacy (disabled effects are dropped —
// a spec describes what is rendered).
function normalizePresetRecord(record) {
  if (!record || typeof record !== "object") throw new Error("Invalid preset record");
  const name = String(record.name || "Untitled preset").trim() || "Untitled preset";
  const createdAt = Number(record.createdAt) || Date.now();
  const base = {
    id: String(record.id || generateId()),
    name,
    createdAt,
    updatedAt: Number(record.updatedAt) || createdAt,
  };
  if (record.spec) {
    return { ...base, spec: validateSpec(record.spec) };
  }
  if (!Array.isArray(record.effects)) throw new Error("Invalid preset record");
  const effects = record.effects.map(normalizeEffectData).filter(Boolean);
  if (effects.length !== record.effects.length) throw new Error(`Preset "${name}" contains an unknown effect`);
  return { ...base, spec: specFromLegacy(serializeEffects(effects, true), name) };
}

async function migrateStoredPresets() {
  const presets = await dbGetAll();
  for (const preset of presets) {
    const normalized = normalizePresetRecord(preset);
    if (JSON.stringify(normalized) !== JSON.stringify(preset)) await dbPut(normalized);
  }
}

function buildPresetArchive(presets, exportedAt = new Date().toISOString()) {
  return {
    schema: PRESET_SCHEMA,
    version: PRESET_SCHEMA_VERSION,
    exportedAt,
    presets: presets.map((record) => normalizePresetRecord(record)),
  };
}

// Accepts v1 archives on import — normalizePresetRecord migrates each
// legacy record to a spec — and emits v2.
function parsePresetArchive(value) {
  const archive = typeof value === "string" ? JSON.parse(value) : value;
  if (!archive || archive.schema !== PRESET_SCHEMA || !Array.isArray(archive.presets)
      || (archive.version !== 1 && archive.version !== PRESET_SCHEMA_VERSION)) {
    throw new Error("This is not a supported WobbleTone preset archive");
  }
  return buildPresetArchive(archive.presets, archive.exportedAt);
}

function presetJson(presets) {
  return JSON.stringify(buildPresetArchive(presets), null, 2) + "\n";
}

async function savePreset() {
  if (!state.effects.some((effect) => effect.enabled !== false)) return showToast("Enable at least one effect first");
  const name = prompt("Preset name:", "My Preset " + new Date().toLocaleDateString());
  if (!name || !name.trim()) return;
  const now = Date.now();
  const cleanName = name.trim();
  try {
    const existing = (await dbGetAll()).find((preset) => preset.name.toLowerCase() === cleanName.toLowerCase());
    if (existing && !confirm(`Replace the saved preset "${existing.name}"?`)) return;
    const record = {
      id: existing?.id || generateId(),
      name: cleanName,
      spec: effectsToSpec(state.effects, cleanName),
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    await dbPut(record);
    showToast("Saved preset: " + record.name);
    await refreshPresets();
  } catch (err) {
    console.error("Save preset failed:", err);
    showToast("Failed to save preset");
  }
}

async function loadPreset(id) {
  try {
    const preset = (await dbGetAll()).find((item) => item.id === id);
    if (!preset) return;
    state.effects = specToEffects(preset.spec);
    renderEffectsList();
    render();
    closeModal($("#preset-picker"));
    showToast("Loaded: " + preset.name);
  } catch (err) {
    console.error("Load preset failed:", err);
    showToast("Failed to load preset");
  }
}

async function renamePreset(id) {
  const preset = (await dbGetAll()).find((item) => item.id === id);
  if (!preset) return;
  const name = prompt("Rename preset:", preset.name);
  if (!name || !name.trim() || name.trim() === preset.name) return;
  await dbPut({ ...preset, name: name.trim(), updatedAt: Date.now() });
  await refreshPresets();
  showToast("Preset renamed");
}

async function duplicatePreset(id) {
  const preset = (await dbGetAll()).find((item) => item.id === id);
  if (!preset) return;
  const now = Date.now();
  await dbPut({ ...preset, id: generateId(), name: preset.name + " Copy", createdAt: now, updatedAt: now });
  await refreshPresets();
  showToast("Preset duplicated");
}

async function deletePreset(id) {
  try {
    const preset = (await dbGetAll()).find((item) => item.id === id);
    if (!preset) return;
    await dbDelete(id);
    await refreshPresets();
    showToast(`Deleted ${preset.name}`, {
      label: "Undo",
      run: async () => {
        await dbPut(preset);
        await refreshPresets();
        showToast("Preset restored");
      },
    });
  } catch (err) {
    console.error("Delete preset failed:", err);
    showToast("Failed to delete preset");
  }
}

async function copyText(text, message = "Copied to clipboard") {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
  showToast(message);
}

function downloadTextFile(filename, text, type = "application/json") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function exportPresetArchive() {
  const presets = await dbGetAll();
  if (!presets.length) return showToast("No presets to export");
  downloadTextFile(`wobbletone-presets-${new Date().toISOString().slice(0, 10)}.json`, presetJson(presets));
  showToast(`Exported ${presets.length} preset${presets.length === 1 ? "" : "s"}`);
}

async function copyPresetArchive() {
  const presets = await dbGetAll();
  if (!presets.length) return showToast("No presets to copy");
  await copyText(presetJson(presets), "Preset JSON copied");
}

async function sharePresetArchive() {
  const presets = await dbGetAll();
  if (!presets.length) return showToast("No presets to share");
  const text = presetJson(presets);
  if (typeof File === "undefined") {
    downloadTextFile("wobbletone-presets.json", text);
    return showToast("Sharing unavailable; downloaded JSON");
  }
  const file = new File([text], "wobbletone-presets.json", { type: "application/json" });
  if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ title: "WobbleTone presets", files: [file] });
      return;
    } catch (err) {
      if (err.name === "AbortError") return;
    }
  }
  downloadTextFile(file.name, await file.text());
  showToast("Sharing unavailable; downloaded JSON");
}

async function importPresetArchive(file) {
  if (!file) return;
  try {
    const archive = parsePresetArchive(await file.text());
    const existing = await dbGetAll();
    const usedIds = new Set(existing.map((preset) => preset.id));
    const usedNames = new Set(existing.map((preset) => preset.name.toLowerCase()));
    const imported = archive.presets.map((source, index) => {
      const preset = normalizePresetRecord(source);
      if (usedIds.has(preset.id)) preset.id = generateId();
      if (usedNames.has(preset.name.toLowerCase())) preset.name += " (Imported)";
      const now = Date.now() + index;
      usedIds.add(preset.id);
      usedNames.add(preset.name.toLowerCase());
      return { ...preset, createdAt: now, updatedAt: now };
    });
    await dbPutMany(imported);
    await refreshPresets();
    showToast(`Imported ${imported.length} preset${imported.length === 1 ? "" : "s"}`);
  } catch (err) {
    console.error("Import presets failed:", err);
    showToast(err.message || "Could not import presets");
  }
}

async function copySinglePreset(id) {
  const preset = (await dbGetAll()).find((item) => item.id === id);
  if (preset) await copyText(presetJson([preset]), `${preset.name} JSON copied`);
}

async function refreshPresets() {
  const list = $("#preset-list");
  if (!list) return;
  try {
    const presets = (await dbGetAll()).map(normalizePresetRecord).sort((a, b) => b.updatedAt - a.updatedAt);
    if (presets.length === 0) {
      list.innerHTML = '<div class="preset-empty">No saved presets yet. Build an effect stack and tap Save Preset.</div>';
      return;
    }
    list.innerHTML = "";
    presets.forEach((preset) => {
      const card = document.createElement("article");
      card.className = "preset-card";
      const effectNames = preset.spec.effects.map((effect) => CATALOG_BY_ID[effect.type]?.name || effect.type).join(" → ");
      const date = new Date(preset.updatedAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
      card.innerHTML = `
        <div class="preset-card-head">
          <div class="preset-info">
            <div class="preset-name">${escapeHtmlAttribute(preset.name)}</div>
            <div class="preset-effects">${escapeHtmlAttribute(effectNames)}</div>
          </div>
          <span class="preset-date">${escapeHtmlAttribute(date)}</span>
        </div>
        <div class="preset-actions">
          <button class="preset-load btn" type="button">Load</button>
          <button class="preset-rename btn" type="button">Rename</button>
          <button class="preset-duplicate btn" type="button">Duplicate</button>
          <button class="preset-json btn" type="button">Copy JSON</button>
          <button class="preset-delete btn btn-danger" type="button">Delete</button>
        </div>`;
      $(".preset-load", card).onclick = () => loadPreset(preset.id);
      $(".preset-rename", card).onclick = () => renamePreset(preset.id).catch(() => showToast("Failed to rename preset"));
      $(".preset-duplicate", card).onclick = () => duplicatePreset(preset.id).catch(() => showToast("Failed to duplicate preset"));
      $(".preset-json", card).onclick = () => copySinglePreset(preset.id);
      $(".preset-delete", card).onclick = () => deletePreset(preset.id);
      list.appendChild(card);
    });
  } catch (err) {
    console.error("Refresh presets failed:", err);
    list.innerHTML = '<div class="preset-empty">Could not open the preset library.</div>';
  }
}

function openPresetPicker() {
  refreshPresets();
  openModal($("#preset-picker"));
}

let activeModal = null;
let modalReturnFocus = null;
function openModal(modal) {
  if (!modal) return;
  modalReturnFocus = document.activeElement;
  activeModal = modal;
  modal.hidden = false;
  document.body.classList.add("modal-open");
  requestAnimationFrame(() => modal.querySelector("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])")?.focus());
}

function closeModal(modal = activeModal) {
  if (!modal) return;
  modal.hidden = true;
  if (activeModal === modal) activeModal = null;
  document.body.classList.toggle("modal-open", !!activeModal);
  modalReturnFocus?.focus?.();
  modalReturnFocus = null;
}

function handleModalKeydown(event) {
  if (!activeModal) return;
  if (event.key === "Escape") {
    event.preventDefault();
    closeModal();
    return;
  }
  if (event.key !== "Tab") return;
  const focusable = $$("button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])", activeModal)
    .filter((element) => !element.hidden && element.offsetParent !== null);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function updateCommandState() {
  const open = $("#btn-upload");
  const save = $("#btn-download");
  if (!open || !save) return;
  open.classList.toggle("is-primary", !state.hasUserImage);
  save.classList.toggle("is-primary", state.hasUserImage);
  $("#image-status").textContent = state.hasUserImage ? state.imageName : "Sample image";
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
  const preview = $("#preview-wrap");
  preview.onclick = togglePreviewZoom;
  preview.onkeydown = (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    if (!state.previewZoomed) state.zoomPoint = { x: 0.5, y: 0.5 };
    togglePreviewZoom();
  };

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
    const previous = cloneEffects(state.effects);
    state.effects = defaultStack();
    renderEffectsList();
    render();
    showToast("Reset to defaults", { label: "Undo", run: () => restoreEffects(previous, "Reset undone") });
  };
  $("#btn-save-preset").onclick = savePreset;
  $("#btn-presets").onclick = openPresetPicker;
  $("#btn-download").onclick = downloadPNG;
  $("#btn-info").onclick = () => openModal($("#info-modal"));
  $("#btn-copy").onclick = () => copyText(state.generatedCode.all);
  $("#btn-copy-html").onclick = () => copyText(state.generatedCode.html, "HTML copied");
  $("#btn-copy-css").onclick = () => copyText(state.generatedCode.css, "CSS copied");
  $("#btn-export-presets").onclick = () => exportPresetArchive().catch(() => showToast("Could not export presets"));
  $("#btn-share-presets").onclick = () => sharePresetArchive().catch(() => showToast("Could not share presets"));
  $("#btn-copy-presets").onclick = () => copyPresetArchive().catch(() => showToast("Could not copy presets"));
  $("#btn-import-presets").onclick = () => $("#preset-import-input").click();
  $("#preset-import-input").onchange = (event) => {
    importPresetArchive(event.target.files[0]);
    event.target.value = "";
  };

  // Modal close
  $$(".modal [data-close]").forEach((element) => (element.onclick = () => closeModal(element.closest(".modal"))));
  document.addEventListener("keydown", handleModalKeydown);

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
  requestPersistentStorage();
  migrateStoredPresets().catch((err) => console.error("Preset migration failed:", err));
}

function loadSample() {
  // Inline SVG sample image so the app works offline immediately
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='800' height='600'><defs><radialGradient id='g' cx='35%' cy='30%' r='75%'><stop offset='0%' stop-color='#ffd9a0'/><stop offset='40%' stop-color='#ff7a5c'/><stop offset='75%' stop-color='#7c3cff'/><stop offset='100%' stop-color='#121a3a'/></radialGradient></defs><rect width='800' height='600' fill='url(#g)'/><circle cx='280' cy='200' r='90' fill='#fff' opacity='0.85'/><rect x='450' y='120' width='200' height='200' rx='20' fill='#1a1a2e' opacity='0.7'/><polygon points='400,500 550,300 650,500' fill='#0a0a1a' opacity='0.6'/></svg>`;
  const img = new Image();
  img.onload = () => activateImage(img.src, "sample.svg", img.naturalWidth, img.naturalHeight, false, img);
  img.onerror = () => showToast("Could not load the sample image");
  img.src = "data:image/svg+xml;base64," + btoa(svg);
}

/* ---------- Service Worker ---------- */
function registerSW() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  }
}

if (typeof document !== "undefined") document.addEventListener("DOMContentLoaded", init);

export {
  transformPixelData, posterizeByte, mapPixelColor, pixelEffectColors,
  dramaSettings, buildDramaLayer, sampleDramaTable,
  glitchSettings, buildGlitchBands, buildGlitchLayer,
  migrateEffectData, normalizePresetRecord, buildPresetArchive, parsePresetArchive, serializeEffects,
  effectsToSpec, specToEffects,
  escapeHtmlAttribute, buildGeneratedCode, calculatePreviewLayout,
};
