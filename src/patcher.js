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
 * Desenho sem interpolação: logo antes do render da partida, alpha passa a ser 1 quando ligado, mostrando o estado
 * mais recente da simulação em vez de um ponto entre os dois últimos ticks.
 * A chamada de render fica intacta: mods (ex.: bonk-utilidades) procuram exatamente esse trecho.
 */
function patchNoInterp(code) {
  const re = new RegExp(
    String.raw`(${IDX}=${ID}\(${IDX}\);)(${IDX}\[${IDX}\[\d+\]\]\((${IDX})\[(${IDX}) - 1\],\3\[\4\],(${IDX}),)`,
    "g"
  );
  let count = 0;
  const out = code.replace(re, (all, before, call, _arr, _idx, alpha) => {
    count++;
    return `if(window.__btNoInterp)${alpha}=1;${before}${call}`;
  });
  if (count === 0) return { code, ok: false, why: "chamada de render não encontrada" };
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
  for (const [name, fn] of [["earlyInput", patchEarlyInput], ["noInterp", patchNoInterp], ["restart", patchEmitters]]) {
    const r = fn(out);
    report[name] = r.ok ? "ok" : `falhou: ${r.why}`;
    if (r.ok) out = r.code;
  }
  const header = `window.__btPatches=${JSON.stringify(report)};\n`;
  return { code: header + prelude + "\n;" + out, report };
}

module.exports = { patchGame, patchEarlyInput, patchNoInterp, patchEmitters };
