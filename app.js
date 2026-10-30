// ColorCodes — find colors that pair well with a main color.
// Uses the free The Color API (https://www.thecolorapi.com), with a local fallback.

const API = "https://www.thecolorapi.com";
const MAX_ACCENTS = 4;

const SCHEMES = [
  { mode: "complement", label: "Complementary" },
  { mode: "analogic", label: "Analogous" },
  { mode: "triad", label: "Triadic" },
  { mode: "analogic-complement", label: "Split complementary" },
  { mode: "monochrome", label: "Monochrome" },
];

const state = {
  main: "#0A84FF",
  second: null,
  accents: [],
  role: "second", // which slot a swatch click fills
  names: {}, // hex -> color name
  suggestions: [], // [{label, colors: [hex]}]
};

const $ = (id) => document.getElementById(id);
const picker = $("colorPicker");
const text = $("colorText");

// ---------- Color helpers ----------

// Turn any CSS color (hex, name, rgb, hsl) into #RRGGBB, or null if invalid.
const ctx = document.createElement("canvas").getContext("2d");
function toHex(value) {
  const v = value.trim();
  if (!v) return null;
  const withHash = /^[0-9a-f]{3}([0-9a-f]{3})?$/i.test(v) ? "#" + v : v;
  ctx.fillStyle = "#000000";
  ctx.fillStyle = withHash;
  const first = ctx.fillStyle;
  ctx.fillStyle = "#ffffff";
  ctx.fillStyle = withHash;
  if (first !== ctx.fillStyle) return null; // browser rejected the value
  return first.startsWith("#") ? first.toUpperCase() : null;
}

function hexToHsl(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return [h, s * 100, l * 100];
}

function hslToHex(h, s, l) {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(100, s)) / 100;
  l = Math.max(10, Math.min(92, l)) / 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return "#" + [f(0), f(8), f(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, "0")).join("").toUpperCase();
}

// Dark or light text for a given background.
function textOn(hex) {
  const n = parseInt(hex.slice(1), 16);
  const lum = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return lum > 150 ? "#1d1d1f" : "#ffffff";
}

// Offline fallback that mirrors the API's scheme modes.
function localScheme(hex, mode) {
  const [h, s, l] = hexToHsl(hex);
  const shades = (hue) => [-24, -12, 0, 12, 24].map((d) => hslToHex(hue, s, l + d));
  switch (mode) {
    case "complement": return shades(h + 180);
    case "analogic": return [-60, -30, 30, 60, 90].map((d) => hslToHex(h + d, s, l));
    case "triad": return [120, 240, 120, 240, 0].map((d, i) => hslToHex(h + d, s, l + (i > 1 ? 15 : 0)));
    case "analogic-complement": return [150, 210, 165, 195, 180].map((d) => hslToHex(h + d, s, l));
    default: return [-36, -18, 12, 24, 36].map((d) => hslToHex(h, s, l + d));
  }
}

// ---------- API ----------

async function fetchScheme(hex, mode) {
  try {
    const res = await fetch(`${API}/scheme?hex=${hex.slice(1)}&mode=${mode}&count=6&format=json`);
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    data.colors.forEach((c) => (state.names[c.hex.value.toUpperCase()] = c.name.value));
    return data.colors.map((c) => c.hex.value.toUpperCase());
  } catch {
    return localScheme(hex, mode);
  }
}

async function fetchName(hex) {
  if (state.names[hex]) return state.names[hex];
  try {
    const res = await fetch(`${API}/id?hex=${hex.slice(1)}&format=json`);
    const data = await res.json();
    return (state.names[hex] = data.name.value);
  } catch {
    return "";
  }
}

// ---------- Rendering ----------

function renderSuggestions() {
  const wrap = $("suggestions");
  wrap.innerHTML = "";
  state.suggestions.forEach(({ label, colors }) => {
    const group = document.createElement("div");
    group.innerHTML = `<h3 class="scheme-title">${label}</h3>`;
    const row = document.createElement("div");
    row.className = "swatches";
    colors.forEach((hex) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "swatch";
      btn.style.background = hex;
      btn.style.color = textOn(hex);
      btn.title = state.names[hex] ? `${state.names[hex]} · ${hex}` : hex;
      btn.innerHTML = `<span class="hex">${hex}</span>`;
      if (state.second === hex) {
        btn.classList.add("is-second");
        btn.insertAdjacentHTML("beforeend", `<span class="badge">2nd</span>`);
      } else if (state.accents.includes(hex)) {
        btn.classList.add("is-accent");
        btn.insertAdjacentHTML("beforeend", `<span class="badge">Accent</span>`);
      }
      btn.addEventListener("click", () => choose(hex));
      row.appendChild(btn);
    });
    group.appendChild(row);
    wrap.appendChild(group);
  });
}

function chip(role, hex) {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "chip" + (hex ? "" : " empty");
  const name = hex && state.names[hex] ? state.names[hex] : "";
  el.innerHTML = `
    <div class="fill" style="${hex ? `background:${hex}` : ""}"></div>
    <div class="meta">
      <div class="role">${role}</div>
      <div class="val">${hex || "Not chosen"}</div>
      ${name ? `<div class="role" style="text-transform:none">${name}</div>` : ""}
    </div>`;
  if (hex) {
    el.title = "Copy " + hex;
    el.addEventListener("click", () => copy(hex));
  }
  return el;
}

function renderPalette() {
  const p = $("palette");
  p.innerHTML = "";
  p.appendChild(chip("Main", state.main));
  p.appendChild(chip("Second main", state.second));
  state.accents.forEach((hex, i) => p.appendChild(chip(`Accent ${i + 1}`, hex)));
  if (state.accents.length === 0) p.appendChild(chip("Accent", null));
  updateBackground();
}

// Blend the palette into the animated background.
function updateBackground() {
  const fallback = state.suggestions.flatMap((s) => s.colors);
  const pick = (i) => fallback[i] || state.main;
  const colors = [
    state.main,
    state.second || pick(2),
    state.accents[0] || pick(8),
    state.accents[1] || state.accents[0] || pick(14),
  ];
  const root = document.documentElement.style;
  colors.forEach((c, i) => root.setProperty(`--c${i + 1}`, c));
  document.querySelector(".btn.primary").style.background = state.main;
  document.querySelector(".btn.primary").style.color = textOn(state.main);
}

function render() {
  renderSuggestions();
  renderPalette();
}

// ---------- Actions ----------

function choose(hex) {
  if (state.role === "second") {
    state.second = state.second === hex ? null : hex;
    state.accents = state.accents.filter((a) => a !== hex);
  } else {
    if (state.accents.includes(hex)) {
      state.accents = state.accents.filter((a) => a !== hex);
    } else if (state.accents.length >= MAX_ACCENTS) {
      toast(`Up to ${MAX_ACCENTS} accents — tap one to remove it`);
      return;
    } else {
      state.accents.push(hex);
      if (state.second === hex) state.second = null;
    }
  }
  render();
}

function setRole(role) {
  state.role = role;
  document.querySelectorAll(".seg").forEach((b) => {
    const on = b.dataset.role === role;
    b.classList.toggle("active", on);
    b.setAttribute("aria-checked", on);
  });
  $("hint").textContent =
    role === "second"
      ? "Tap a swatch to set your second main color."
      : `Tap swatches to add accent colors (up to ${MAX_ACCENTS}).`;
}

async function loadColor(hex) {
  state.main = hex;
  state.second = null;
  state.accents = [];
  picker.value = hex.toLowerCase();
  text.value = hex;
  $("error").textContent = "";
  $("suggestions").innerHTML = `<p class="loading">Finding matches…</p>`;
  setRole("second");
  updateBackground();

  const [name, ...lists] = await Promise.all([
    fetchName(hex),
    ...SCHEMES.map((s) => fetchScheme(hex, s.mode)),
  ]);
  if (state.main !== hex) return; // a newer color was entered meanwhile

  $("mainName").textContent = name ? `Main color: ${name}` : "";
  state.suggestions = SCHEMES.map((s, i) => ({
    label: s.label,
    colors: [...new Set(lists[i])].filter((c) => c !== hex).slice(0, 5),
  }));
  render();
}

function copy(value, message) {
  navigator.clipboard?.writeText(value).then(
    () => toast(message || `Copied ${value}`),
    () => toast("Couldn't copy")
  );
}

let toastTimer;
function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 1800);
}

// ---------- Events ----------

$("colorForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const hex = toHex(text.value);
  if (!hex) {
    $("error").textContent = "That doesn't look like a color. Try #FF6B6B, coral, or rgb(255, 107, 107).";
    return;
  }
  loadColor(hex);
});

picker.addEventListener("input", () => (text.value = picker.value.toUpperCase()));
picker.addEventListener("change", () => loadColor(picker.value.toUpperCase()));

document.querySelectorAll(".seg").forEach((b) =>
  b.addEventListener("click", () => setRole(b.dataset.role))
);

$("reset").addEventListener("click", () => {
  state.second = null;
  state.accents = [];
  render();
});

$("copyCss").addEventListener("click", () => {
  const lines = [`  --color-main: ${state.main};`];
  if (state.second) lines.push(`  --color-second: ${state.second};`);
  state.accents.forEach((a, i) => lines.push(`  --color-accent-${i + 1}: ${a};`));
  copy(`:root {\n${lines.join("\n")}\n}`, "Palette copied as CSS variables");
});

loadColor(state.main);
