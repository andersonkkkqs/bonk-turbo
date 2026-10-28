"use strict";
const fs = require("node:fs");
const path = require("node:path");

const DEFAULTS = {
  fps: 240, // número (30..3000), "unlimited" ou "vsync"
  showFps: true,
  stretch: true, // tela cheia 16:9 sem bordas
  startFullscreen: true,
  renderScale: 1,
  earlyInput: true,
  noInterp: false,
  bans: [],
};

const SCALES = [0.5, 0.75, 1, 1.5, 2];

function sanitize(raw) {
  const s = { ...DEFAULTS };
  if (!raw || typeof raw !== "object") return s;
  if (raw.fps === "vsync" || raw.fps === "unlimited") s.fps = raw.fps;
  else if (Number.isFinite(raw.fps)) s.fps = Math.min(3000, Math.max(30, Math.round(raw.fps)));
  for (const k of ["showFps", "stretch", "startFullscreen", "earlyInput", "noInterp"]) if (typeof raw[k] === "boolean") s[k] = raw[k];
  if (SCALES.includes(raw.renderScale)) s.renderScale = raw.renderScale;
  if (Array.isArray(raw.bans))
    s.bans = [...new Set(raw.bans.filter((n) => typeof n === "string" && n.length > 0 && n.length <= 64).map((n) => n.toLowerCase()))].slice(0, 500);
  return s;
}

class SettingsStore {
  constructor(file) {
    this.file = file;
    try {
      this.value = sanitize(JSON.parse(fs.readFileSync(file, "utf8")));
    } catch {
      this.value = sanitize(null);
    }
  }
  get() {
    return { ...this.value };
  }
  set(patch) {
    this.value = sanitize({ ...this.value, ...patch });
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(`${this.file}.tmp`, JSON.stringify(this.value, null, 2));
      fs.renameSync(`${this.file}.tmp`, this.file);
    } catch (err) {
      console.error("não consegui salvar as configurações", err);
    }
    return this.get();
  }
}

module.exports = { SettingsStore, sanitize, DEFAULTS };
