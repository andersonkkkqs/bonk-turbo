"use strict";
// Uso: node test/patch-test.js <caminho do alpha2s.js>
// Aplica os patches num alpha2s.js real e confere que cada um casou e que o resultado ainda é JavaScript válido.
const fs = require("node:fs");
const vm = require("node:vm");
const { patchGame } = require("../src/patcher");

const file = process.argv[2];
if (!file) {
  console.error("informe o caminho de um alpha2s.js");
  process.exit(2);
}
const code = fs.readFileSync(file, "utf8");
const { code: out, report } = patchGame(code, "/* prelude */");
console.log(report);
new vm.Script(out, { filename: "alpha2s.patched.js" }); // só compila, não executa
const failed = Object.entries(report).filter(([, v]) => v !== "ok");
if (failed.length) {
  console.error("patches com falha:", failed);
  process.exit(1);
}
const show = (re) => {
  const m = re.exec(out);
  console.log(m ? out.slice(m.index, m.index + 260) + "\n" : "(não achado)");
};
show(/function [\w$]+\(\)\{if\(!window\.__btEarlyCall\)/);
show(/if\(![\w$]+\[\d+\]\[[\w$]+\[\d+\]\]\[[\w$]+\[\d+\]\]&&\(/);
show(/window\.__btNoInterp\?1:/);
console.log("OK");
