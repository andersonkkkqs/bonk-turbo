// ==UserScript==
// @name         bonk-power-shot
// @version      6
// @match        https://bonk.io/gameframe-release.html*
// @run-at       document-start
// @grant        none
// ==/UserScript==
// Power shot e chute com curva no modo Football, usando a tecla "Special" do Bonk (configurável em Settings > Controls).
//  - Segure Special conduzindo a bola para carregar e SOLTE: chuta, mais forte quanto mais carregado (power shot).
//    Sem a bola a carga não sobe, e perder a bola zera a carga (/chute bola off desliga essa regra).
//  - Curva como no Haxball: se você estiver CORRENDO de lado em relação ao chute na hora de soltar, a bola curva para esse lado.
// O host liga e ajusta pelo chat (/chute ...). Muda a física: TODOS na sala precisam deste script.
(function () {
  // duas cópias ativas (ex.: a antiga "bonk-chute"/"bonk-power-chute" junto com esta) aplicam o efeito em dobro
  // e dessincronizam com quem tem só uma. A segunda cópia não roda e avisa.
  if (window.__bkPowerShot) {
    document.addEventListener("DOMContentLoaded", () => setTimeout(() => {
      for (const id of ["ingamechatcontent", "newbonklobby_chat_content"]) {
        const c = document.getElementById(id);
        if (!c) continue;
        const d = document.createElement("div");
        d.textContent = "* ATENÇÃO: há mais de uma cópia do bonk-power-shot (ou da versão antiga bonk-chute / bonk-power-chute) ativa no Tampermonkey. Deixe só uma e recarregue.";
        d.style.color = "#e53935";
        c.appendChild(d);
      }
    }, 3000));
    return;
  }
  window.__bkPowerShot = true;
  const VERSAO = 6;

  // ---------- configuração (o host define e manda para a sala; vale a partir do lobby) ----------
  const PADRAO = { power: 0, curva: 0, forca: 1.6, carga: 1, efeito: 1, bola: 1 }; // bola: só carrega conduzindo a bola
  let cfg = { ...PADRAO };       // o que vale na física agora
  let minha = { ...PADRAO };     // o que eu escolho quando sou host
  let pendente = null;

  // ---------- patches no código do jogo ----------
  const PATCHES = window.__bkPatches = window.__bkPatches || [];
  PATCHES.push(
    // antes de cada passo da física do Football: carga, power shot e curva
    [/(B\[([\w$]+)\[5\]\[129\]\]\[\2\[5\]\[128\]\]=function\([^)]*\)\{var ([\w$]+)=\[arguments\];)/,
      "$1if(window.__bkChutePre){var __cp=window.__bkChutePre($3[0][0],$3[0][1]);if(__cp){$3[0][0]=__cp[0];$3[0][1]=__cp[1];}}"],
    // estado inicial que o host manda no Start: leva junto a configuração do chute (todos usam a mesma)
    [/(([\w$]+)\[5\]\[\2\[4\]\[332\]\]=0;)/, "$1if(window.__bkChuteIni)window.__bkChuteIni($2[5]);"],
    // rede do jogo (para saber quem é o host); funciona com ou sem o biggg
    [/([\w$]+)\[6\]=(?:window\.__bkNet=)?\1\[0\]\[0\];/, "$1[6]=window.__bkNet=$1[0][0];"]
  );
  if (!window.__bkPatchHook) {
    window.__bkPatchHook = true;
    const prepara = (node) => {
      if (!node || node.tagName !== "SCRIPT" || node.__bp || !/alpha2s\.js/.test(node.src)) return;
      node.__bp = true;
      try {
        const x = new XMLHttpRequest();
        x.open("GET", node.src, false);
        x.send();
        if (x.status !== 200) return;
        const novo = window.__bkPatches.reduce((s, [re, r]) => s.replace(re, r), x.responseText);
        if (novo !== x.responseText) node.src = URL.createObjectURL(new Blob([novo], { type: "text/javascript" }));
      } catch (e) {}
    };
    for (const nome of ["appendChild", "insertBefore"]) {
      const orig = Node.prototype[nome];
      Node.prototype[nome] = function (n, ...r) {
        prepara(n);
        return orig.call(this, n, ...r);
      };
    }
  }

  const antigas = (window.__bkPatches || []).filter(([, rep]) => typeof rep === "string" && rep.includes("__bkChutePre")).length;
  if (antigas > 1) document.addEventListener("DOMContentLoaded", () => setTimeout(() => {
    for (const id of ["ingamechatcontent", "newbonklobby_chat_content"]) {
      const c = document.getElementById(id);
      if (!c) continue;
      const d = document.createElement("div");
      d.textContent = "* ATENÇÃO: uma versão antiga do script de chute (bonk-chute / bonk-power-chute) também está ativa. Desative-a no Tampermonkey e recarregue: duas cópias dessincronizam a partida.";
      d.style.color = "#e53935";
      c.appendChild(d);
    }
  }, 3000));

  // ---------- física ----------
  // O que precisa durar entre um passo e outro fica no placar do estado (posições 30+, números negativos que o
  // Bonk ignora): assim todos calculam igual, inclusive quando o jogo volta no tempo para corrigir.
  const S_CURVA = 30, S_OMEGA = 31, S_CARGA = 32; // carga do jogador id fica em S_CARGA + id
  const OFF = 1e6;
  const le = (sc, i, p) => (typeof sc[i] === "number" && sc[i] < 0 ? -sc[i] - 1 : p);
  const grava = (sc, i, v) => { while (sc.length <= i) sc.push(null); sc[i] = -(v + 1); };
  // distância só com Math.sqrt (resultado exato e igual em qualquer navegador; Math.hypot não é garantido)
  const dist2 = (x, y) => Math.sqrt(x * x + y * y);
  const CURVA_PASSOS = 30;   // ~1 s de efeito
  const OMEGA_BASE = 0.03;   // giro por passo (rad) no começo da curva, com efeito 1
  let multAgora = 1;         // multiplicador do impulso do chute neste passo
  const cargaLocal = { v: 0, t: 0 };

  // Special: segurar carrega, SOLTAR chuta (se a bola estiver ao alcance). Com a seta de lado na hora de soltar, sai com curva.
  // Enquanto o power shot/curva estão ligados, o Special deixa de "frear" o boneco (o que o Bonk faz por padrão no Football).
  let avisouDesligado = false;
  const neutroSpecial = (i) => (i && i.action2 ? Object.assign({}, i, { action2: false }) : i);
  // configuração guardada no estado da partida (posições 20-25 do placar, negativas), gravada pelo host no Start
  const S_CFG = 20, CH = ["power", "curva", "forca", "carga", "efeito", "bola"];
  window.__bkChuteIni = (st) => {
    try {
      if (!souHost() || !st || !st.scores || !(cfg.power || cfg.curva)) return;
      while (st.scores.length < S_CFG + CH.length) st.scores.push(null);
      CH.forEach((k, i) => { st.scores[S_CFG + i] = -(Math.round(+cfg[k] * 1000) + 10000000 + 1); });
    } catch (e) {}
  };
  let cfgEstCod = "", cfgEst = null;
  const DESLIGADO = { power: 0, curva: 0, forca: 1.6, carga: 1, efeito: 1, bola: 1 };
  let cfgPartida = DESLIGADO; // o que está valendo na partida atual (para a barra de carga)
  const cfgDoEstado = (st) => {
    const sc = st.scores;
    if (!(typeof sc[S_CFG] === "number" && sc[S_CFG] < 0)) return null;
    const cod = sc.slice(S_CFG, S_CFG + CH.length).join(",");
    if (cod !== cfgEstCod) {
      cfgEstCod = cod;
      cfgEst = {};
      CH.forEach((k, i) => { cfgEst[k] = (-sc[S_CFG + i] - 1 - 10000000) / 1000; });
    }
    return cfgEst;
  };
  window.__bkChutePre = (st, ent) => {
    try {
      multAgora = 1;
      // a partida usa a configuração gravada pelo host no Start; sem ela, tudo desligado (igual para todos)
      const C = (st && st.scores && cfgDoEstado(st)) || DESLIGADO;
      cfgPartida = C;
      if (!(C.power || C.curva)) {
        // desligado: o Special continua sendo o freio do Bonk. Avisa uma vez quem apertar, para não parecer defeito.
        try {
          const eu = window.__bkNet && window.__bkNet.getLSID ? window.__bkNet.getLSID() : -1;
          if (!avisouDesligado && Array.isArray(ent) && ent[eu] && ent[eu].action2) {
            avisouDesligado = true;
            setTimeout(() => aviso("Power shot e curva estão DESLIGADOS nesta sala, por isso o Special está freando (é o padrão do Bonk). " +
              "O host precisa digitar /chute power on e /chute curva on no lobby, antes do Start."), 0);
          }
        } catch (e) {}
        return null;
      }
      if (!st || !st.ball || !st.discs || !st.scores || !Array.isArray(ent)) return null;
      const s = Object.assign(Object.create(Object.getPrototypeOf(st)), st);
      s.scores = st.scores.slice();
      const ent2 = ent.map(neutroSpecial);
      const b = s.ball;
      const maxCarga = Math.max(1, Math.round((C.carga > 0 ? C.carga : 1) * 30));
      const alcance = 0.7 * (window.__bkTam || 1) + (window.__bkJog || 1) + 0.6;
      let eu = -1;
      try { eu = window.__bkNet && window.__bkNet.getLSID ? window.__bkNet.getLSID() : -1; } catch (e) {}
      let especial = false;
      st.discs.forEach((d, id) => {
        if (!d) return;
        const inp = ent[id] || {};
        // guardado: 0 = não está segurando o Special; 1 + carga = segurando (com essa carga)
        const guardado = le(s.scores, S_CARGA + id, 0);
        const segurava = guardado > 0, antes = segurava ? guardado - 1 : 0;
        // "com a bola": encostado nela ou quase (folga de meio raio da bola)
        const comBola = dist2(b.x - d.x, b.y - d.y) <= (window.__bkJog || 1) + 0.7 * (window.__bkTam || 1) + 0.35;
        let carga = antes, segura = !!inp.action2;
        if (segura) carga = C.bola && !comBola ? 0 : Math.min(carga + 1, maxCarga); // sem a bola: não carrega e zera
        else if (segurava) {
          // soltou o Special: chuta agora, se a bola estiver ao alcance
          carga = 0;
          const dx = b.x - d.x, dy = b.y - d.y, dist = dist2(dx, dy);
          if (dist < alcance && dist > 0 && st.ftu === -1 && !especial) {
            especial = true;
            ent2[id] = Object.assign({}, ent2[id] || {}, { action: true });
            if (!d.kickReady) { s.discs = s.discs.slice(); s.discs[id] = Object.assign(Object.create(Object.getPrototypeOf(d)), d, { kickReady: true }); }
            if (C.power) multAgora = 1 + ((C.forca > 0 ? C.forca : 1.6) - 1) * Math.min(antes / maxCarga, 1);
            if (C.curva) {
              // como no Haxball: o efeito vem do MOVIMENTO do boneco na hora do chute. Correndo de lado em relação
              // ao chute, a bola curva para o lado em que você corria; quanto mais rápido de lado, mais curva.
              const ux = dx / dist, uy = dy / dist;
              const vMax = 12.7 * (window.__bkVel ? window.__bkVel() * (window.__bkIner || 1) : 1); // velocidade máxima do boneco
              const lado = (ux * (d.yv || 0) - uy * (d.xv || 0)) / vMax; // >0: correndo para a "direita" do chute
              const forca = Math.max(-1, Math.min(1, lado));
              if (Math.abs(forca) > 0.2) {
                grava(s.scores, S_CURVA, CURVA_PASSOS + 1);
                grava(s.scores, S_OMEGA, Math.round(forca * OMEGA_BASE * (C.efeito || 1) * 1e6) + OFF);
              } else grava(s.scores, S_CURVA, 0);
            }
          }
        }
        grava(s.scores, S_CARGA + id, segura ? carga + 1 : 0);
        if (id === eu) { cargaLocal.v = segura ? carga / maxCarga : 0; cargaLocal.t = performance.now(); cargaLocal.semBola = segura && C.bola && !comBola; }
      });
      // chute normal (tecla de chute) de alguém perto da bola cancela a curva que estava rolando
      if (!especial && st.discs.some((d, id) => d && ent[id] && ent[id].action && d.kickReady !== false &&
        dist2(b.x - d.x, b.y - d.y) < alcance)) grava(s.scores, S_CURVA, 0);
      // curva em andamento: a direção da bola vai girando, cada vez menos
      const resta = le(s.scores, S_CURVA, 0);
      if (resta > 0 && !especial) {
        const omega = (le(s.scores, S_OMEGA, OFF) - OFF) / 1e6 * (resta / CURVA_PASSOS);
        // rotação exata só com + - * / (Math.cos/sin podem dar resultados diferentes entre navegadores e dessincronizar)
        const q = omega * omega / 4, c = (1 - q) / (1 + q), sn = omega / (1 + q);
        s.ball = Object.assign({}, b, { xv: b.xv * c - b.yv * sn, yv: b.xv * sn + b.yv * c });
        grava(s.scores, S_CURVA, resta - 1);
      }
      return [s, ent2];
    } catch (e) { return null; }
  };

  // multiplica o impulso do chute na bola (power shot)
  const ganchoImpulso = setInterval(() => {
    const B = window.requirejs?.s?.contexts?._?.defined?.["physics/box2dweb/Box2DModuleGJMod"];
    if (!B) return;
    clearInterval(ganchoImpulso);
    const Body = B.Dynamics.b2Body.prototype;
    const orig = Body.ApplyImpulse;
    const V2 = B.Common.Math.b2Vec2;
    Body.ApplyImpulse = function (imp, pt, ...r) {
      if (multAgora !== 1) {
        const u = this.GetUserData && this.GetUserData();
        if (u && u.type === "ball") imp = new V2(imp.x * multAgora, imp.y * multAgora);
      }
      return orig.call(this, imp, pt, ...r);
    };
  }, 20);

  // ---------- barra de carga (só na sua tela) ----------
  let barra = null;
  const desenhaCarga = () => {
    requestAnimationFrame(desenhaCarga);
    if (!barra) {
      if (!document.body) return;
      barra = document.createElement("div");
      barra.style.cssText = "position:fixed;left:50%;bottom:9%;width:180px;height:9px;margin-left:-90px;border-radius:5px;" +
        "background:rgba(20,30,38,.55);box-shadow:0 2px 8px rgba(0,0,0,.35);overflow:hidden;z-index:9;display:none;pointer-events:none;";
      barra.innerHTML = '<div style="height:100%;width:0;border-radius:5px;background:linear-gradient(90deg,#ffca28,#ff7043,#e53935)"></div>';
      document.body.appendChild(barra);
    }
    const ativo = cfgPartida.power && (cargaLocal.v > 0 || cargaLocal.semBola) && performance.now() - cargaLocal.t < 150;
    barra.style.opacity = cargaLocal.semBola ? ".45" : "1";
    barra.style.display = ativo ? "block" : "none";
    if (ativo) barra.firstChild.style.width = Math.round(cargaLocal.v * 100) + "%";
  };
  requestAnimationFrame(desenhaCarga);

  // ---------- quem é o host ----------
  let hostChat = null;
  const souHost = () => {
    const n = window.__bkNet;
    if (n && typeof n.getLSID === "function") { try { return n.hostID == n.getLSID(); } catch (e) {} }
    const r = document.getElementById("newbonklobby_roundsinput");
    return !!(r && !r.disabled);
  };
  const nomeHost = () => {
    if (hostChat) return hostChat;
    for (const img of document.querySelectorAll(".newbonklobby_playerentry_host")) {
      if (/host_0\.png/.test(img.getAttribute("src") || "")) continue;
      const e = img.closest(".newbonklobby_playerentry");
      const n = e && e.querySelector('[class*="name"]');
      if (n && n.textContent.trim()) return n.textContent.trim();
    }
    return null;
  };
  const noLobby = () => {
    const l = document.getElementById("newbonklobby");
    return !!(l && l.offsetParent !== null && getComputedStyle(l).display !== "none");
  };
  const aplica = (c) => { if (noLobby()) { cfg = { ...c }; pendente = null; } else pendente = { ...c }; };
  setInterval(() => { if (pendente && noLobby()) { cfg = pendente; pendente = null; } }, 500);

  // ---------- rede: mensagem escondida no chat ----------
  let sock = null;
  const wsSend = WebSocket.prototype.send;
  WebSocket.prototype.send = function (d) {
    if (typeof d === "string" && d.startsWith("42[")) {
      sock = this;
      if (d.startsWith("42[12,")) { cfg = { ...PADRAO }; minha = { ...PADRAO }; pendente = null; hostChat = null; } // criou sala nova
      if (!this.__bkChuteFecha) { this.__bkChuteFecha = true; this.addEventListener("close", () => { cfg = { ...PADRAO }; minha = { ...PADRAO }; pendente = null; hostChat = null; }); }
    }
    return wsSend.call(this, d);
  };
  const enviar = (txt) => {
    if (!sock || sock.readyState !== 1) return false;
    wsSend.call(sock, '42[10,{"message":' + JSON.stringify(txt) + "}]");
    return true;
  };
  const pacote = () => "[TC]v" + VERSAO + "|" + [minha.power, minha.curva, minha.forca, minha.carga, minha.efeito, minha.bola].join(",");
  let ultimoEnvio = 0, timer = null;
  const manda = () => {
    if (!souHost()) return;
    clearTimeout(timer);
    const espera = Math.max(0, 2500 - (Date.now() - ultimoEnvio));
    timer = setTimeout(() => { if (enviar(pacote())) ultimoEnvio = Date.now(); }, espera);
  };

  const CHAT = "#ingamechatcontent, #newbonklobby_chat_content";
  const aviso = (txt) => {
    for (const c of document.querySelectorAll(CHAT)) {
      const d = document.createElement("div");
      d.textContent = "* " + txt;
      d.__bkAviso = true; d.__bkChute = true;
      d.style.color = "#e0913a";
      c.appendChild(d);
      c.scrollTop = c.scrollHeight;
    }
  };
  const vistos = new WeakSet();
  const chatObs = new MutationObserver((muts) => {
    for (const mu of muts) for (const n of mu.addedNodes) {
      if (n.nodeType !== 1 || n.__bkChute || vistos.has(n)) continue;
      vistos.add(n);
      const texto = (n.textContent || "").trim();
      const troca = texto.match(/^\*\s*(?:.+ has given host privileges to (.+), who is now the game host|.+ has left the game and (.+) is now the game host)\.?$/);
      if (troca) { hostChat = (troca[1] || troca[2]).trim(); continue; }
      if (/has joined the game/i.test(texto)) { if (minha.power || minha.curva) manda(); continue; }
      const m = texto.match(/^(.*?):\s*\[TC\]v(\d+)\|([\d.,-]+)\s*$/);
      if (!m) continue;
      n.remove();
      const h = nomeHost();
      if (h && m[1].trim().toLowerCase() !== h.toLowerCase()) continue;
      const v = m[3].split(",").map(Number);
      if (v.length < 5 || v.some(isNaN)) continue;
      const nova = { power: v[0], curva: v[1], forca: v[2], carga: v[3], efeito: v[4], bola: v.length > 5 ? v[5] : 1 };
      if (!souHost() && (nova.power !== cfg.power || nova.curva !== cfg.curva))
        aviso("Host: power shot " + (nova.power ? "ligado" : "desligado") + ", curva " + (nova.curva ? "ligada" : "desligada") + (noLobby() ? "." : " (vale a partir do próximo lobby)."));
      aplica(nova);
    }
  });

  // ---------- nome da tecla no menu de configurações do Bonk ----------
  const renomeia = () => {
    const sc = document.getElementById("settingsContainer");
    if (!sc) return;
    for (const td of sc.querySelectorAll("td, th, div, span")) {
      if (td.children.length === 0 && td.textContent.trim() === "Special") {
        td.textContent = "Special / Power shot e curva";
        td.title = "No Football (com o bonk-power-shot ligado pelo host): segure para carregar e solte perto da bola para chutar; correndo de lado ao soltar = curva";
      }
    }
  };
  setInterval(renomeia, 1000);

  // ---------- comandos ----------
  const estado = (c) => "Chute: power shot " + (c.power ? "ON" : "off") + " (força máx. " + c.forca + "x, carga " + c.carga + " s, " + (c.bola ? "só carrega com a bola" : "carrega em qualquer lugar") + ") | curva " +
    (c.curva ? "ON" : "off") + " (efeito " + c.efeito + ")";
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || !/^(ingamechatinputtext|newbonklobby_chat_input)$/.test(e.target.id)) return;
    const m = e.target.value.trim().match(/^\/chute(?:\s+(\S+))?(?:\s+(\S+))?$/i);
    if (!m) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    e.target.value = "";
    const a = (m[1] || "").toLowerCase(), b = (m[2] || "").toLowerCase().replace(",", ".");
    if (!a) return aviso(estado(cfg) + "  | comandos do host: /chute power on|off, /chute curva on|off, /chute bola on|off, /chute forca N, /chute carga N, /chute efeito N, /chute padrao. Tecla: Special (Settings > Controls).");
    if (!souHost()) return aviso("Só o host muda o chute. " + estado(cfg));
    if ((a === "power" || a === "curva" || a === "bola") && (b === "on" || b === "off")) minha[a] = b === "on" ? 1 : 0;
    else if (a === "forca" || a === "força" || a === "carga" || a === "efeito") {
      const n = parseFloat(b);
      if (isNaN(n) || (a !== "efeito" && !(n > 0)) || n === 0) return aviso("Use /chute forca 1.6 (força máxima do power shot), /chute carga 1 (segundos para carregar) ou /chute efeito 1 (curva; negativo inverte o lado)");
      const k = a === "força" ? "forca" : a;
      minha[k] = k === "forca" ? Math.min(n, 1000) : Math.max(-10, Math.min(n, 10)); // força: até 1000x
    } else if (a === "padrao" || a === "padrão") minha = { ...PADRAO };
    else return aviso("Use /chute power on|off, /chute curva on|off, /chute bola on|off, /chute forca N, /chute carga N, /chute efeito N ou /chute padrao");
    aplica(minha);
    ultimoEnvio = 0;
    manda();
    aviso(estado(minha) + (noLobby() ? "" : " (vale a partir do próximo lobby)") + ". Todos na sala precisam do bonk-power-shot.");
  }, true);

  document.addEventListener("DOMContentLoaded", () => {
    for (const c of document.querySelectorAll(CHAT)) chatObs.observe(c, { childList: true });
  });
})();