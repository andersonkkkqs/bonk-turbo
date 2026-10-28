"use strict";
const fs = require("node:fs");
const path = require("node:path");

const DEFAULTS = {
  earlyInput: true,
  startFullscreen: true,
};

function sanitize(raw) {
  const s = { ...DEFAULTS };
  if (!raw || typeof raw !== "object") return s;
  for (const k of Object.keys(DEFAULTS)) if (typeof raw[k] === "boolean") s[k] = raw[k];
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
    // mantém no arquivo opções que esta versão não conhece (de outras versões do launcher)
    let onDisk = {};
    try {
      onDisk = JSON.parse(fs.readFileSync(this.file, "utf8")) || {};
    } catch {}
    this.value = sanitize({ ...this.value, ...patch });
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(`${this.file}.tmp`, JSON.stringify({ ...onDisk, ...this.value }, null, 2));
      fs.renameSync(`${this.file}.tmp`, this.file);
    } catch (err) {
      console.error("não consegui salvar as configurações", err);
    }
    return this.get();
  }
}

module.exports = { SettingsStore, sanitize, DEFAULTS };
