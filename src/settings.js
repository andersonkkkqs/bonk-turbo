"use strict";
const fs = require("node:fs");
const path = require("node:path");

const DEFAULTS = {
  fps: 240, // número (30..3000), "unlimited" ou "vsync"
  showFps: true,
  screen: "stretch", // "stretch": tela cheia 16:9 sem bordas; "wide": sem esticar e sem bordas; "fit": com faixas nas laterais; "original": como no site
  startFullscreen: true,
  renderScale: 1,
  earlyInput: true,
  realtime: false, // desenha o presente (prevendo o tick seguinte) em vez de um tick atrás
  dry: false, // desenha ticks inteiros, sem transição entre eles
  extrap: 0, // ms de previsão extra, além do tempo real (0 a 50)
  smooth: 0, // ms para uma correção sumir (0 a 300)
  origSkin: false,
  teamBorder: true,
  hideNicks: false,
  muteChat: false,
  sharpStretch: true, // tela esticada desenhada na resolução real da tela
  msaa: false, // antialiasing (bordas lisas)
  lowLatency: false, // canvas de baixa latência (experimental)
  bans: [],
};

// Lite: feita para rodar em PC simples. Vem com tudo o que pesa desligado e com as opções de input lag ligadas; o FPS é
// sempre um limite (VSync e "sem limite" travam PCs fracos).
const LITE_DEFAULTS = { ...DEFAULTS, screen: "fit", sharpStretch: false, realtime: true };

const SCALES = [0.5, 0.75, 1, 1.5, 2];

function sanitize(raw, edition = "full") {
  const lite = edition === "lite";
  const s = { ...(lite ? LITE_DEFAULTS : DEFAULTS) };
  if (!raw || typeof raw !== "object") return s;
  if (!lite && (raw.fps === "vsync" || raw.fps === "unlimited")) s.fps = raw.fps;
  else if (Number.isFinite(raw.fps)) s.fps = Math.min(3000, Math.max(30, Math.round(raw.fps)));
  const flags = ["showFps", "startFullscreen", "earlyInput", "realtime", "origSkin", "teamBorder", "hideNicks", "muteChat"];
  for (const k of [...flags, "sharpStretch", "msaa", "lowLatency", "dry"]) if (typeof raw[k] === "boolean") s[k] = raw[k];
  // o jogo é sempre em tela cheia: esticado, amplo (sem esticar e sem bordas) ou proporcional (faixas nas laterais)
  s.screen = ["fit", "wide"].includes(raw.screen) ? raw.screen : "stretch";
  s.startFullscreen = true;
  // versões antigas: "desenho sem interpolação" virou o modo tempo real
  if (typeof raw.realtime !== "boolean" && raw.noInterp === true) s.realtime = true;
  if (Number.isFinite(raw.extrap)) s.extrap = Math.min(50, Math.max(0, Math.round(raw.extrap)));
  if (Number.isFinite(raw.smooth)) s.smooth = Math.min(300, Math.max(0, Math.round(raw.smooth)));
  if (SCALES.includes(raw.renderScale)) s.renderScale = raw.renderScale;
  if (Array.isArray(raw.bans))
    s.bans = [...new Set(raw.bans.filter((n) => typeof n === "string" && n.length > 0 && n.length <= 64).map((n) => n.toLowerCase()))].slice(0, 500);
  return s;
}

class SettingsStore {
  constructor(file, edition) {
    this.file = file;
    this.edition = edition;
    try {
      this.value = sanitize(JSON.parse(fs.readFileSync(file, "utf8")), edition);
    } catch {
      this.value = sanitize(null, edition);
    }
  }
  get() {
    return { ...this.value };
  }
  set(patch) {
    this.value = sanitize({ ...this.value, ...patch }, this.edition);
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

module.exports = { SettingsStore, sanitize, DEFAULTS, LITE_DEFAULTS };
