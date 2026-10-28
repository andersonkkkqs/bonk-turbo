/* Bonk Turbo: roda no mundo da página, antes do código do jogo (vai prefixado ao alpha2s.js). */
(() => {
  "use strict";
  if (window.__btLoaded) return;
  window.__btLoaded = true;

  const INIT = __BT_INIT__; // { settings } preenchido pelo processo principal
  let S = INIT.settings;
  const api = window.bonkTurbo; // exposto pelo preload (contextBridge)
  const whenDom = (fn) => (document.body ? fn() : document.addEventListener("DOMContentLoaded", fn, { once: true }));

  // ---------------------------------------------------------------------------------------------------------------
  // Envio imediato de input (depende do patch aplicado no alpha2s.js).
  const patches = window.__btPatches || {};
  const earlyAvailable = patches.earlyInput === "ok";
  const channel = new MessageChannel();
  channel.port1.onmessage = () => {
    if (!S.earlyInput || !earlyAvailable) return;
    const send = window.__btSendNow;
    // só durante a partida: a função se registra a cada tick; parada há mais de 100 ms = fora de jogo
    if (typeof send !== "function" || performance.now() - (window.__btTickAt || 0) > 100) return;
    window.__btEarlyCall = true;
    try {
      send();
    } catch {
      /* o tick seguinte cobre */
    } finally {
      window.__btEarlyCall = false;
    }
  };
  // a mensagem roda depois de todos os ouvintes de tecla do jogo (que atualizam o estado das teclas)
  const kick = () => channel.port2.postMessage(0);
  window.addEventListener("keydown", (e) => {
    if (!e.repeat) kick();
  });
  window.addEventListener("keyup", kick);

  // ---------------------------------------------------------------------------------------------------------------
  // Painel (F2).
  const CSS = `
#bt-panel { position:fixed; right:12px; top:12px; width:340px; z-index:2147483647; background:#14121acc; color:#ece9f2;
  font:13px/1.35 "Segoe UI", system-ui, sans-serif; border:1px solid #ffffff1f; border-radius:10px; box-shadow:0 8px 30px #000a; display:none; }
#bt-panel.open { display:block; }
#bt-panel header { display:flex; align-items:center; padding:8px 10px; border-bottom:1px solid #ffffff14; }
#bt-panel header b { flex:1; font-size:14px; }
#bt-panel section { padding:10px; }
#bt-panel .row { display:flex; align-items:center; gap:6px; margin:6px 0; }
#bt-panel .row > span { flex:1; }
#bt-panel .muted { color:#9d97aa; font-size:12px; }
#bt-panel button { background:#2a2633; color:#ece9f2; border:1px solid #ffffff1a; border-radius:5px; padding:2px 7px; cursor:pointer; }
#bt-panel .ok { color:#7ee08a; } #bt-panel .bad { color:#ff8a8a; }
`;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  let panel = null;

  const render = () => {
    if (!panel) return;
    const status = earlyAvailable
      ? `<span class="ok">ativo no código do jogo</span>`
      : `<span class="bad">indisponível (${esc(patches.earlyInput || "não aplicado")})</span>`;
    panel.querySelector("section").innerHTML = `
<div class="row"><span>Envio imediato de input</span><input type="checkbox" data-s="earlyInput"${S.earlyInput ? " checked" : ""}></div>
<p class="muted">Manda a tecla na hora em que você aperta, em vez de esperar o próximo tick do jogo (até 33 ms antes).
A mensagem é a mesma que o jogo mandaria; só sai mais cedo. ${status}</p>`;
  };

  whenDom(() => {
    const style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);
    panel = document.createElement("div");
    panel.id = "bt-panel";
    panel.innerHTML = `<header><b>Bonk Turbo</b><button data-a="close">✕</button></header><section></section>`;
    document.body.appendChild(panel);
    for (const t of ["keydown", "keyup", "keypress"]) panel.addEventListener(t, (e) => e.stopPropagation());
    panel.addEventListener("click", (e) => {
      if (e.target.closest('[data-a="close"]')) panel.classList.remove("open");
    });
    panel.addEventListener("change", (e) => {
      const el = e.target;
      if (el.type !== "checkbox") return;
      S = { ...S, [el.dataset.s]: el.checked };
      api?.setSettings({ [el.dataset.s]: el.checked });
      el.blur();
    });
    render();
  });
  // F2 é capturado pelo launcher (funciona com o foco em qualquer parte da janela)
  api?.onTogglePanel(() => {
    panel?.classList.toggle("open");
    render();
  });
  api?.onSettings((next) => {
    S = next;
    render();
  });
})();
