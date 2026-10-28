"use strict";
// Mods: userscripts (.user.js, o mesmo formato do Tampermonkey) que o launcher injeta no jogo.
// Duas pastas: os mods que vêm com o launcher (src/mods) e a pasta do usuário (%APPDATA%\Bonk Turbo\mods).
const fs = require("node:fs");
const path = require("node:path");

const MAX_BYTES = 2 * 1024 * 1024;

/** Lê o cabeçalho // ==UserScript== ... // ==/UserScript==. */
function parseHeader(code) {
  const meta = { match: [] };
  const block = /\/\/\s*==UserScript==([\s\S]*?)\/\/\s*==\/UserScript==/.exec(code);
  if (!block) return meta;
  for (const line of block[1].split(/\r?\n/)) {
    const m = /^\s*\/\/\s*@([\w:-]+)\s+(.+?)\s*$/.exec(line);
    if (!m) continue;
    const [, key, value] = m;
    if (key === "match" || key === "include") meta.match.push(value);
    else if (!(key in meta)) meta[key] = value;
  }
  return meta;
}

/** @match no estilo do Tampermonkey: só "*" como curinga. Sem @match, vale para o iframe do jogo. */
function matches(meta, url) {
  const patterns = meta.match.length ? meta.match : ["https://bonk.io/gameframe-release.html*"];
  return patterns.some((p) => new RegExp(`^${p.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`).test(url));
}

function readDir(dir, builtin) {
  let files = [];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith(".js"));
  } catch {
    return [];
  }
  const out = [];
  for (const file of files.sort()) {
    const full = path.join(dir, file);
    try {
      if (fs.statSync(full).size > MAX_BYTES) continue;
      const code = fs.readFileSync(full, "utf8");
      const meta = parseHeader(code);
      out.push({
        id: `${builtin ? "builtin" : "user"}:${file}`,
        file,
        builtin,
        name: meta.name || file.replace(/(\.user)?\.js$/, ""),
        version: meta.version || "",
        description: meta.description || "",
        meta,
        code,
      });
    } catch {
      /* arquivo ilegível: fica de fora */
    }
  }
  return out;
}

/** Todos os mods; um mod do usuário com o mesmo nome de arquivo de um que vem com o launcher o substitui. */
function listMods(builtinDir, userDir) {
  const user = readDir(userDir, false);
  const names = new Set(user.map((m) => m.file));
  return [...readDir(builtinDir, true).filter((m) => !names.has(m.file)), ...user];
}

module.exports = { listMods, matches, parseHeader };
