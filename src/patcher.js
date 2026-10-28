"use strict";
// Patches estruturais no alpha2s.js do bonk.io.
// O jogo é ofuscado e os nomes mudam a cada build, então cada patch casa com a FORMA do código, não com nomes.
// Um patch que não casa exatamente uma vez é desligado (e o recurso correspondente fica indisponível);
// nunca aplicamos um patch parcial.

const ID = String.raw`[\w$]+`;
const IDX = String.raw`[\w$]+\[\d+\]`;

/**
 * Envio imediato de input.
 *
 * No tick (30 Hz) o jogo chama uma função que lê as teclas, guarda o input em inputs[eu][frameAtual] e envia
 * {i: input, f: frameAtual} ao servidor e aos peers. Aqui:
 *  1) a função passa a se registrar em window.__btSendNow, para ser chamada também no instante da tecla;
 *  2) a gravação ganha a guarda "só se ainda não existe input meu neste frame". Assim um frame nunca é enviado
 *     duas vezes com conteúdos diferentes (os outros jogadores ignoram a segunda mensagem do mesmo frame, e o
 *     resultado seria dessincronização). Uma mudança que chegue depois do envio antecipado vai para o frame seguinte.
 */
function patchEarlyInput(code) {
  const send = new RegExp(String.raw`\(\{i:${IDX},f:${IDX}\}\)`, "g");
  const sends = [...code.matchAll(send)];
  if (sends.length !== 1) return { code, ok: false, why: `envio de input encontrado ${sends.length}x` };
  const sendAt = sends[0].index;

  // condição + gravação imediatamente antes do envio:
  // if(!ANT && TEM(CUR) || ANT && !IGUAL(CUR,ANT)){ARR[ARR2[EU]][ARR2[F]]=CUR;
  const cond = new RegExp(
    String.raw`if\((!${IDX} && ${ID}\(${IDX}\) \|\| ${IDX} && !${ID}\(${IDX},${IDX}\))\)\{((${IDX}\[${IDX}\]\[${IDX}\])=${IDX};)`,
    "g"
  );
  let condMatch = null;
  for (const m of code.matchAll(cond)) if (m.index < sendAt && sendAt - m.index < 400) condMatch = m;
  if (!condMatch) return { code, ok: false, why: "condição de gravação do input não encontrada" };

  // função que contém o envio: a última "function NOME(){var X=[arguments];" antes da condição
  const fnRe = new RegExp(String.raw`function (${ID})\(\)\{var (${ID})=\[arguments\];`, "g");
  let fn = null;
  for (const m of code.matchAll(fnRe)) {
    if (m.index < condMatch.index) fn = m;
    else break;
  }
  if (!fn || condMatch.index - fn.index > 3000) return { code, ok: false, why: "função de input não encontrada" };

  const [, condition, store, slot] = condMatch;
  const guarded = `if(!${slot}&&(${condition})){${store}`;
  const prologue =
    `function ${fn[1]}(){if(!window.__btEarlyCall){window.__btTickAt=performance.now();window.__btSendNow=${fn[1]};}var ${fn[2]}=[arguments];`;

  // aplica de trás para frente para os índices continuarem válidos
  let out = code.slice(0, condMatch.index) + guarded + code.slice(condMatch.index + condMatch[0].length);
  out = out.slice(0, fn.index) + prologue + out.slice(fn.index + fn[0].length);
  return { code: out, ok: true };
}

/**
 * Render da partida: render(anterior, atual, alpha, ...) passa a receber o que window.__btPre devolver.
 * O prelude usa isso para o desenho sem interpolação, a previsão (extrapolação) e a suavização das correções.
 */
function patchRender(code) {
  const re = new RegExp(
    String.raw`(${IDX}=${ID}\(${IDX}\);${IDX}\[${IDX}\[\d+\]\]\()((${IDX})\[(${IDX}) - 1\]),(\3\[\4\]),(${IDX}),`,
    "g"
  );
  let count = 0;
  const out = code.replace(re, (all, call, prev, _arr, frame, cur, alpha) => {
    count++;
    return `${call}...(window.__btPre?window.__btPre(${prev},${cur},${alpha},${frame}):[${prev},${cur},${alpha}]),`;
  });
  if (count !== 1) return { code, ok: false, why: `render da partida encontrado ${count}x` };
  return { code: out, ok: true };
}

/**
 * Passo da física: no tick, o jogo calcula estado[f+1] = física.step(estado[f], inputs(f), extra[f], ...).
 * Aqui esse passo também fica disponível como window.__btStep(estado, f), sem mudar nada na simulação: a previsão
 * roda a física do próprio jogo em cópias do estado, só para desenhar.
 */
function patchStep(code) {
  const re = new RegExp(
    String.raw`(${IDX})=(${ID})\((${IDX})\);if\((${IDX})\[\3 \+ 1\]\)\{[^{}]*\}else \{(${IDX})=(${IDX})\[(${IDX}\[\d+\])\]\((${IDX})\[\3\],\1,(${IDX})\[\3\],(${ID}\[0\]\[0\]),([\w$\[\],]*)\);\}`,
    "g"
  );
  let count = 0;
  const out = code.replace(re, (all, _inp, inputsOf, _frame, _cache, _res, physics, method, _states, extra, dt, rest) => {
    count++;
    return `window.__btStep=function(s,f){return ${physics}[${method}](s,${inputsOf}(f),${extra}[f],${dt},${rest});};${all}`;
  });
  if (count !== 1) return { code, ok: false, why: `passo da física encontrado ${count}x` };
  return { code: out, ok: true };
}

/**
 * Skin original nos modos com time. O jogo pinta a skin de quatro jeitos; cada um ganha uma condição:
 *  - função de matiz (gira o tom de cada cor para o do time): devolve a cor original;
 *  - camada de tinta (círculo da cor do time misturado por cima): fica transparente;
 *  - contorno do time e asas do VTOL: somem, a não ser com "borda do time" ligada;
 *  - setas e projéteis: usam a cor do jogador, como fora dos modos com time.
 */
function patchSkins(code) {
  const parts = {};
  let out = code;
  const apply = (name, re, fn) => {
    let n = 0;
    out = out.replace(re, (...m) => {
      n++;
      return fn(...m);
    });
    parts[name] = n;
  };
  const SHOW_TEAM = "(!window.__btOrigSkin||window.__btTeamBorder)";
  // function NOME(cor,matiz){var X=[arguments]; ... cor.toString(16).padStart(...) ... hsl.h=matiz; ...
  apply(
    "matiz",
    new RegExp(String.raw`(function ${ID}\((${ID}),${ID}\)\{var (${ID})=\[arguments\];)(?=[^{}]{0,700}\]\(16\)\[[^{}]{0,300}${IDX}\[\3\[\d+\]\[\d+\]\]=\3\[0\]\[1\];)`, "g"),
    (all, head, color) => `${head}if(window.__btOrigSkin)return ${color};`
  );
  apply(
    "contorno",
    new RegExp(String.raw`(>= 2 && [^{}]*? <= 5)(\)\{[^{}]*?=0x000000;)`, "g"),
    (all, cond, rest) => `${cond}&&${SHOW_TEAM}${rest}`
  );
  apply(
    "asas",
    new RegExp(String.raw`(>= 2 && [^{}]*? <= 5)(\)\{if\([^{}]*== 2\)\{[^{}]*=0xf44336;\};)`, "g"),
    (all, cond, rest) => `${cond}&&${SHOW_TEAM}${rest}`
  );
  // ...=0xffeb3b;}  G.beginFill(cor);  ...  G.drawCircle(0,0,...)  -> beginFill(cor, transparente se skin original)
  apply(
    "tinta",
    new RegExp(String.raw`(=0xffeb3b;\}(${IDX})\[${IDX}\[\d+\]\]\(${IDX})\)(?=;[^;]{0,30};?\2\[${IDX}\[\d+\]\]\(0,0,)`, "g"),
    (all, head) => `${head},window.__btOrigSkin?0:1)`
  );
  apply(
    "setas",
    new RegExp(String.raw`(== false)(\)\{if\([^{}]*\)\{[^{}]*\}\}else \{if\([^{}]*== 2\)\{[^{}]*=0xf44336;\})`, "g"),
    (all, cond, rest) => `${cond}||window.__btOrigSkin${rest}`
  );
  if (!parts.matiz || !parts.contorno || !parts.tinta) return { code, ok: false, why: `trechos encontrados ${JSON.stringify(parts)}` };
  return { code: out, ok: true, parts };
}

/** Nomes acima dos jogadores na partida: cada PIXI.Text de nome passa por window.__btNick (para poder esconder). */
function patchNicks(code) {
  let count = 0;
  const wrap = (all, head, text) => {
    count++;
    return `${head}window.__btNick(${text});`;
  };
  const TEXT = String.raw`new PIXI\[${IDX}\[\d+\]\]\(${IDX},${IDX}\)`;
  let out = code.replace(new RegExp(String.raw`(dropShadowAlpha:0\.30\};this\[${IDX}\[\d+\]\]=)(${TEXT});`, "g"), wrap);
  out = out.replace(new RegExp(String.raw`(dropShadowAlpha:0\.20\};if\([^{}]*\)\{[^{}]*\}${IDX}=)(${TEXT});`, "g"), wrap);
  if (count === 0) return { code, ok: false, why: "nomes dos jogadores não encontrados" };
  return { code: out, ok: true, count };
}

/**
 * Emissores de evento internos: function NOME(...args){ despacha args[0] para os ouvintes }.
 * Cada um passa a se registrar em window.__btEmit. O "Reiniciar partida" dispara "startGame" neles, o mesmo evento que o
 * botão Start do lobby usa (só o lobby escuta esse evento, e o servidor só aceita do host).
 */
function patchEmitters(code) {
  const re = new RegExp(String.raw`([;}{])function (${ID})\(\.\.\.(${ID})\)\{`, "g");
  let count = 0;
  const out = code.replace(re, (all, before, name) => {
    count++;
    return `${before}(window.__btEmit||(window.__btEmit={}))[${JSON.stringify(name)}]=${name};function ${name}(...${all.slice(all.indexOf("...") + 3)}`;
  });
  if (count === 0) return { code, ok: false, why: "emissores de evento não encontrados" };
  return { code: out, ok: true, count };
}

function patchGame(code, prelude) {
  const report = {};
  let out = code;
  const all = [
    ["earlyInput", patchEarlyInput],
    ["render", patchRender],
    ["step", patchStep],
    ["skins", patchSkins],
    ["nicks", patchNicks],
    ["restart", patchEmitters],
  ];
  for (const [name, fn] of all) {
    const r = fn(out);
    report[name] = r.ok ? "ok" : `falhou: ${r.why}`;
    if (r.ok) out = r.code;
  }
  const header = `window.__btPatches=${JSON.stringify(report)};\n`;
  return { code: header + prelude + "\n;" + out, report };
}

module.exports = { patchGame, patchEarlyInput, patchRender, patchStep, patchSkins, patchNicks, patchEmitters };
