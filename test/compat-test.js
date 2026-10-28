// Uso: node test/compat-test.js <alpha2s.js> . src/features/biggg.user.js src/features/bonk-power-shot.user.js
// Roda os scripts num sandbox mínimo para obter window.__bkPatches e compara quantas vezes cada regex casa
// no jogo original e no jogo já modificado pelo Bonk Turbo (patches do launcher aplicados antes, como no app).
const fs = require("fs"), vm = require("vm"), path = require("path");
const [game, root, ...scripts] = process.argv.slice(2);
const { patchGame } = require(root + "/src/patcher");
const raw = fs.readFileSync(game, "utf8");
const turbo = patchGame(raw, "").code;
const noop = () => {};
const el = () => ({ addEventListener: noop, appendChild: noop, style: {}, classList: { toggle: noop, add: noop }, querySelectorAll: () => [] });
const ctx = {
  console, Math, JSON, Date, Number, String, Array, Object, RegExp, Map, Set, WeakSet, Promise, parseFloat, parseInt, isNaN, Infinity,
  setInterval: () => 0, clearInterval: noop, setTimeout: () => 0, clearTimeout: noop, requestAnimationFrame: noop, performance: { now: () => 0 },
  localStorage: { getItem: () => null, setItem: noop },
  document: { addEventListener: noop, getElementById: () => null, querySelectorAll: () => [], createElement: el, head: el(), body: null },
  WebSocket: function () {}, Node: function () {}, MutationObserver: class { observe() {} }, XMLHttpRequest: function () {},
  URL: { createObjectURL: () => "" }, Blob: function () {}, getComputedStyle: () => ({}),
};
ctx.WebSocket.prototype.send = noop;
ctx.Node.prototype.appendChild = noop;
ctx.Node.prototype.insertBefore = noop;
ctx.window = ctx;
vm.createContext(ctx);
const owner = [];
for (const s of scripts) {
  const before = (ctx.__bkPatches || []).length;
  try { vm.runInContext(fs.readFileSync(s, "utf8"), ctx, { filename: s }); } catch (e) { console.log("aviso", path.basename(s), String(e).slice(0, 100)); }
  for (let k = before; k < ctx.__bkPatches.length; k++) owner.push(path.basename(s).split(".")[0] + "#" + (k - before));
}
let a = raw, b = turbo, bad = 0;
ctx.__bkPatches.forEach(([re, rep], k) => {
  const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
  const ca = (a.match(g) || []).length, cb = (b.match(g) || []).length;
  if (ca !== cb) bad++;
  console.log(owner[k].padEnd(20), "original:", ca, " turbo:", cb, ca !== cb ? "  <-- DIFERENTE" : "");
  a = a.replace(re, rep); b = b.replace(re, rep); // aplica em sequência, como o gancho deles faz
});
console.log(bad ? `${bad} diferença(s)` : "todos iguais");
// o resultado final ainda precisa ser JavaScript válido
new vm.Script(b); console.log("código final (turbo + scripts) compila");
