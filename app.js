/* ===== WobbleTone FX — app.js ===== */
"use strict";

import { specFromLegacy, validateSpec } from "./engine/spec.js";
import { renderToCanvas } from "./engine/canvas.js";

/* ---------- Utilities ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const uid = () => Math.random().toString(36).slice(2, 9);

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const escapeHtmlAttribute = (value) =>
  String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");


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
 * Each effect: { id, name, icon, desc, category, params }
 * params drive the UI controls; the engine registry owns render semantics —
 * the Filter Specification (effectsToSpec) is the semantic source of truth.
 */
const EFFECT_CATALOG = [
  /* ---- Basic CSS filters ---- */
  {
    id: "brightness", name: "Brightness", icon: "☀️", desc: "Lighten or darken", category: "Basic",
    params: [{ key: "v", label: "Level", type: "slider", min: 0, max: 200, step: 1, default: 110, unit: "%" }],
  },
  {
    id: "contrast", name: "Contrast", icon: "◐", desc: "Punch up or flatten", category: "Basic",
    params: [{ key: "v", label: "Level", type: "slider", min: 0, max: 200, step: 1, default: 110, unit: "%" }],
  },
  {
    id: "saturate", name: "Saturation", icon: "🎨", desc: "Color intensity", category: "Basic",
    params: [{ key: "v", label: "Level", type: "slider", min: 0, max: 300, step: 1, default: 120, unit: "%" }],
  },
  {
    id: "hue", name: "Hue Shift", icon: "🌈", desc: "Rotate the color wheel", category: "Basic",
    params: [{ key: "v", label: "Angle", type: "slider", min: 0, max: 360, step: 1, default: 0, unit: "°" }],
  },
  {
    id: "sepia", name: "Sepia", icon: "📜", desc: "Warm vintage wash", category: "Basic",
    params: [{ key: "v", label: "Amount", type: "slider", min: 0, max: 100, step: 1, default: 60, unit: "%" }],
  },
  {
    id: "grayscale", name: "Grayscale", icon: "⚫", desc: "Desaturate to B&W", category: "Basic",
    params: [{ key: "v", label: "Amount", type: "slider", min: 0, max: 100, step: 1, default: 100, unit: "%" }],
  },
  {
    id: "invert", name: "Invert", icon: "🔄", desc: "Negate colors", category: "Basic",
    params: [{ key: "v", label: "Amount", type: "slider", min: 0, max: 100, step: 1, default: 100, unit: "%" }],
  },
  {
    id: "blur", name: "Blur", icon: "💨", desc: "Gaussian softening", category: "Basic",
    params: [{ key: "v", label: "Radius", type: "slider", min: 0, max: 20, step: 0.1, default: 1, unit: "px" }],
  },
  {
    id: "opacity", name: "Opacity", icon: "👁", desc: "Fade through", category: "Basic",
    params: [{ key: "v", label: "Level", type: "slider", min: 0, max: 100, step: 1, default: 80, unit: "%" }],
  },

  /* ---- Duotone / Tritone (SVG) ---- */
  {
    id: "duotone", name: "Duotone", icon: "双色", desc: "Two-tone gradient map", category: "Tone",
    params: [
      { key: "shadow", label: "Shadow color", type: "color", default: "#1a0d3d" },
      { key: "highlight", label: "Highlight color", type: "color", default: "#ff5c8a" },
      { key: "contrast", label: "Contrast", type: "slider", min: 0, max: 100, step: 1, default: 20, unit: "%" },
    ],
  },
  {
    id: "tritone", name: "Tritone", icon: "三色", desc: "Three-tone gradient map", category: "Tone",
    params: [
      { key: "shadow", label: "Shadow", type: "color", default: "#0b1d3a" },
      { key: "mid", label: "Midtone", type: "color", default: "#c44d4d" },
      { key: "highlight", label: "Highlight", type: "color", default: "#ffe8a3" },
    ],
  },
  {
    id: "posterize", name: "Posterize", icon: "🔲", desc: "Banded color steps", category: "Tone",
    params: [{ key: "steps", label: "Levels", type: "slider", min: 2, max: 16, step: 1, default: 5, unit: "" }],
  },
  {
    id: "heatmap", name: "Heatmap", icon: "🔥", desc: "Luminance → thermal gradient", category: "Tone",
    params: [{ key: "intensity", label: "Intensity", type: "slider", min: 0, max: 100, step: 1, default: 100, unit: "%" }],
  },
  {
    id: "drama", name: "Drama", icon: "◒", desc: "Cinematic tone curve and colour grade", category: "Tone",
    params: [
      { key: "style", label: "Look", type: "select", default: "Cinematic", options: ["Cinematic", "Noir", "Bleach", "Storm", "Portrait"] },
      { key: "strength", label: "Strength", type: "slider", min: 0, max: 100, step: 1, default: 70, unit: "%" },
      { key: "shadows", label: "Shadows", type: "slider", min: -50, max: 50, step: 1, default: 0, unit: "" },
      { key: "highlights", label: "Highlights", type: "slider", min: -50, max: 50, step: 1, default: 0, unit: "" },
      { key: "saturation", label: "Saturation", type: "slider", min: 0, max: 150, step: 1, default: 100, unit: "%" },
    ],
  },

  /* ---- Bloom / glow overlay using image ---- */
  {
    id: "bloom", name: "Bloom / Glow", icon: "✦", desc: "Highlight bloom, glow, or warm halation", category: "Light",
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
  },
  {
    id: "chromatic", name: "Chromatic Aberration", icon: "🔵", desc: "RGB channel fringe split", category: "Light",
    params: [
      { key: "offset", label: "Split", type: "slider", min: 0, max: 20, step: 0.5, default: 4, unit: "px" },
      { key: "strength", label: "Strength", type: "slider", min: 0, max: 100, step: 1, default: 70, unit: "%" },
    ],
  },

  /* ---- Color wash / blend overlays ---- */
  {
    id: "colorwash", name: "Color Wash", icon: "🧴", desc: "Tint with blend mode", category: "Color",
    params: [
      { key: "color", label: "Color", type: "color", default: "#7c5cff" },
      { key: "blend", label: "Blend mode", type: "select", default: "overlay",
        options: ["multiply","screen","overlay","soft-light","hard-light","color-dodge","color-burn","hue","saturation","color","luminosity","difference","exclusion"] },
      { key: "opacity", label: "Opacity", type: "slider", min: 0, max: 100, step: 1, default: 40, unit: "%" },
    ],
  },
  {
    id: "gradient", name: "Gradient Wash", icon: "🟣", desc: "Blended gradient overlay", category: "Color",
    params: [
      { key: "c1", label: "Color 1", type: "color", default: "#ff5c8a" },
      { key: "c2", label: "Color 2", type: "color", default: "#7c5cff" },
      { key: "angle", label: "Angle", type: "slider", min: 0, max: 360, step: 1, default: 135, unit: "°" },
      { key: "blend", label: "Blend mode", type: "select", default: "soft-light",
        options: ["multiply","screen","overlay","soft-light","hard-light","color-dodge","hue","color","luminosity","difference","exclusion"] },
      { key: "opacity", label: "Opacity", type: "slider", min: 0, max: 100, step: 1, default: 50, unit: "%" },
    ],
  },

  /* ---- Texture / atmosphere overlays ---- */
  {
    id: "grain", name: "Film Grain", icon: "📺", desc: "Analog noise texture", category: "Texture",
    params: [
      { key: "size", label: "Grain size", type: "slider", min: 0.3, max: 3, step: 0.1, default: 0.9, unit: "" },
      { key: "opacity", label: "Strength", type: "slider", min: 0, max: 100, step: 1, default: 25, unit: "%" },
      { key: "blend", label: "Blend", type: "select", default: "overlay",
        options: ["overlay","soft-light","hard-light","screen","multiply"] },
    ],
  },
  {
    id: "vignette", name: "Vignette", icon: "⚫", desc: "Darken edges", category: "Texture",
    params: [
      { key: "color", label: "Color", type: "color", default: "#000000" },
      { key: "size", label: "Spread", type: "slider", min: 20, max: 100, step: 1, default: 60, unit: "%" },
      { key: "opacity", label: "Strength", type: "slider", min: 0, max: 100, step: 1, default: 50, unit: "%" },
    ],
  },
  {
    id: "scanlines", name: "Scanlines", icon: "📡", desc: "CRT line pattern", category: "Texture",
    params: [
      { key: "size", label: "Line spacing", type: "slider", min: 1, max: 8, step: 0.5, default: 3, unit: "px" },
      { key: "color", label: "Line color", type: "color", default: "#000000" },
      { key: "opacity", label: "Strength", type: "slider", min: 0, max: 100, step: 1, default: 30, unit: "%" },
      { key: "blend", label: "Blend", type: "select", default: "multiply",
        options: ["multiply","overlay","soft-light","screen"] },
    ],
  },
  {
    id: "prism", name: "Prism Light", icon: "🔺", desc: "Refracted light streak", category: "Texture",
    params: [
      { key: "c1", label: "Color 1", type: "color", default: "#ff2e88" },
      { key: "c2", label: "Color 2", type: "color", default: "#2effd5" },
      { key: "angle", label: "Angle", type: "slider", min: 0, max: 360, step: 1, default: 45, unit: "°" },
      { key: "width", label: "Streak width", type: "slider", min: 5, max: 60, step: 1, default: 20, unit: "%" },
      { key: "opacity", label: "Strength", type: "slider", min: 0, max: 100, step: 1, default: 35, unit: "%" },
    ],
  },

  /* ---- Psychedelic / stylized combos ---- */
  {
    id: "glitch", name: "Glitch", icon: "▤", desc: "Seeded sensor tearing and RGB fracture", category: "Stylize",
    params: [
      { key: "style", label: "Style", type: "select", default: "CCD Failure", options: ["CCD Failure", "VHS Tear", "RGB Fracture", "Signal Loss"] },
      { key: "amount", label: "Amount", type: "slider", min: 0, max: 100, step: 1, default: 42, unit: "%" },
      { key: "bandSize", label: "Band size", type: "slider", min: 1, max: 100, step: 1, default: 28, unit: "%" },
      { key: "split", label: "RGB split", type: "slider", min: 0, max: 30, step: 0.5, default: 6, unit: "px" },
      { key: "seed", label: "Seed", type: "slider", min: 1, max: 9999, step: 1, default: 317, unit: "" },
    ],
  },
  {
    id: "psychedelic", name: "Psychedelic", icon: "🌀", desc: "Animated hue + saturation surge", category: "Stylize",
    params: [
      { key: "saturate", label: "Saturation", type: "slider", min: 100, max: 500, step: 10, default: 280, unit: "%" },
      { key: "contrast", label: "Contrast", type: "slider", min: 80, max: 200, step: 1, default: 130, unit: "%" },
      { key: "speed", label: "Anim speed", type: "slider", min: 0, max: 20, step: 0.5, default: 8, unit: "s" },
      { key: "animate", label: "Animate", type: "select", default: "yes", options: ["yes", "no"] },
    ],
  },
  {
    id: "infrared", name: "Infrared", icon: "🔴", desc: "False-color IR look", category: "Stylize",
    params: [
      { key: "intensity", label: "Intensity", type: "slider", min: 0, max: 100, step: 1, default: 70, unit: "%" },
    ],
  },
  {
    id: "vintage", name: "Vintage", icon: "📼", desc: "Faded film warmth", category: "Stylize",
    params: [
      { key: "sepia", label: "Sepia", type: "slider", min: 0, max: 100, step: 1, default: 45, unit: "%" },
      { key: "contrast", label: "Contrast", type: "slider", min: 60, max: 140, step: 1, default: 95, unit: "%" },
      { key: "saturate", label: "Saturation", type: "slider", min: 20, max: 150, step: 1, default: 80, unit: "%" },
      { key: "brightness", label: "Brightness", type: "slider", min: 60, max: 140, step: 1, default: 105, unit: "%" },
    ],
  },
  {
    id: "dropshadow", name: "Drop Shadow", icon: "🫥", desc: "Offset shadow glow", category: "Stylize",
    params: [
      { key: "x", label: "X offset", type: "slider", min: -30, max: 30, step: 1, default: 0, unit: "px" },
      { key: "y", label: "Y offset", type: "slider", min: -30, max: 30, step: 1, default: 8, unit: "px" },
      { key: "blur", label: "Blur", type: "slider", min: 0, max: 50, step: 1, default: 16, unit: "px" },
      { key: "color", label: "Color", type: "color", default: "#7c5cff" },
    ],
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
  comparing: false,
  hasUserImage: false,
  imageWidth: 800,
  imageHeight: 600,
  previewZoomed: false,
  suppressPreviewTransition: false,
  zoomPoint: { x: 0.5, y: 0.5 },
  generatedCode: "",
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

  const spec = effectsToSpec(state.effects, state.imageName);

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
      const canvas = renderToCanvas(state.img, spec, opts);
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
  generateCode(spec);
}

/* ---------- Spec export ---------- */
// The Filter Specification is the semantic source of truth — the Code tab
// shows the current stack as spec JSON for use with the shared engine
// (e.g. Aimless "import filter").
function specToJson(spec) {
  return JSON.stringify(spec, null, 2) + "\n";
}

function generateCode(spec) {
  const json = specToJson(spec);
  state.generatedCode = json;
  const output = $("#code-output");
  if (output) output.textContent = json;
  const meta = $("#code-meta");
  if (meta) {
    const bytes = new TextEncoder().encode(json).length;
    meta.textContent = `${(bytes / 1024).toFixed(1)} KB · ${spec.effects.length} active effect${spec.effects.length === 1 ? "" : "s"}`;
  }
  const warning = $("#code-warning");
  if (warning) {
    warning.hidden = true;
    warning.textContent = "";
  }
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
      note.textContent = "Pixel-based values scale with output resolution — the preview matches the export.";
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
/* ---------- PNG export ---------- */
// Export renders through the shared engine at native resolution — the same
// renderBuffer path as the preview, so what you see is what you get.
async function downloadPNG() {
  if (!state.img) return showToast("Upload an image first");
  try {
    const spec = effectsToSpec(state.effects, state.imageName);
    const canvas = renderToCanvas(state.img, spec, {
      sourceWidth: state.imageWidth,
      sourceHeight: state.imageHeight,
    });
    const allowsBlank = spec.effects.some((effect) => effect.type === "opacity" && effect.params.v === 0);
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
      showToast("Saved PNG");
    }, "image/png");
  } catch (err) {
    console.error("Export failed:", err);
    showToast(err.message || "Export failed — see console");
  }
}

function createCanvas(W, H) {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  return canvas;
}

function hasVisiblePixels(canvas) {
  const sample = createCanvas(20, 20);
  const ctx = sample.getContext("2d");
  ctx.drawImage(canvas, 0, 0, 20, 20);
  const data = ctx.getImageData(0, 0, 20, 20).data;
  for (let i = 3; i < data.length; i += 4) if (data[i] > 0) return true;
  return false;
}
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
  $("#btn-copy").onclick = () => copyText(state.generatedCode, "Spec JSON copied");
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
  migrateEffectData, normalizePresetRecord, buildPresetArchive, parsePresetArchive, serializeEffects,
  effectsToSpec, specToEffects, specToJson,
  escapeHtmlAttribute, calculatePreviewLayout,
};
