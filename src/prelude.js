/* Bonk Turbo: roda no mundo da página, antes do código do jogo (vai prefixado ao alpha2s.js). */
(() => {
  "use strict";
  if (window.__btLoaded) return;
  window.__btLoaded = true;

  const INIT = __BT_INIT__; // { settings, autoJoin } preenchido pelo processo principal
  let S = INIT.settings;
  if (INIT.autoJoin) window.autoJoin = INIT.autoJoin;
  const api = window.bonkTurbo; // exposto pelo preload (contextBridge)

  const whenDom = (fn) => (document.body ? fn() : document.addEventListener("DOMContentLoaded", fn, { once: true }));

  // ---------------------------------------------------------------------------------------------------------------
  // Página externa ausente: o jogo roda direto, sem o bonk.io de fora. O resizeGame do jogo mexe em elementos da
  // página externa (parent.document); como aqui parent === window, criamos esses elementos invisíveis.
  if (window.top === window) {
    whenDom(() => {
      for (const id of ["maingameframe", "adboxverticalleftCurse", "adboxverticalCurse"]) {
        if (document.getElementById(id)) continue;
        const el = document.createElement("div");
        el.id = id;
        el.style.display = "none";
        document.body.appendChild(el);
      }
    });
  }

  // ---------------------------------------------------------------------------------------------------------------
  // Resolução de renderização (precisa valer antes de o PIXI criar os renderers).
  const scale = Math.min(2, Math.max(0.5, Number(S.renderScale) || 1));
  if (scale !== 1) {
    const desc = Object.getOwnPropertyDescriptor(window, "devicePixelRatio") ?? Object.getOwnPropertyDescriptor(Window.prototype, "devicePixelRatio");
    const base = () => {
      const v = desc?.get ? Number(desc.get.call(window)) : 1;
      return Number.isFinite(v) && v > 0 ? v : 1;
    };
    Object.defineProperty(window, "devicePixelRatio", { configurable: true, get: () => base() * scale });
  }

  // ---------------------------------------------------------------------------------------------------------------
  // Limitador de FPS (30 a 3000). 0 = sem limite (usa o requestAnimationFrame nativo).
  const nativeRaf = window.requestAnimationFrame.bind(window);
  const nativeCancel = window.cancelAnimationFrame.bind(window);
  let cap = 0;
  let interval = 0;
  let last = 0;
  let queue = new Map();
  let seq = 1e9;
  let scheduled = false;
  let frames = 0;
  let lastTs = -1;
  const countFrame = (ts) => {
    if (ts !== lastTs) {
      lastTs = ts;
      frames++;
    }
  };
  // Com limite, os quadros são cronometrados por timer, não pelo requestAnimationFrame nativo: um quadro nativo em que
  // nada é desenhado faz o Chromium desacelerar os seguintes (600 de limite virava ~130 FPS reais).
  // Espera longa: setTimeout; perto do horário: MessageChannel (sem o atraso mínimo de 4 ms dos timers encadeados).
  const tickPort = new MessageChannel();
  const run = () => {
    scheduled = false;
    const now = performance.now();
    if (now < last + interval - 0.02) return pump();
    last = now - last < interval * 2 ? last + interval : now;
    const cbs = queue;
    queue = new Map();
    countFrame(now);
    for (const cb of cbs.values()) {
      try {
        cb(now);
      } catch (err) {
        setTimeout(() => {
          throw err;
        });
      }
    }
  };
  tickPort.port1.onmessage = run;
  const pump = () => {
    if (scheduled) return;
    scheduled = true;
    const wait = last + interval - performance.now();
    if (wait > 6) setTimeout(run, wait - 4);
    else tickPort.port2.postMessage(0);
  };
  window.requestAnimationFrame = (cb) => {
    if (cap <= 0)
      return nativeRaf((ts) => {
        countFrame(ts);
        cb(ts);
      });
    const id = ++seq;
    queue.set(id, cb);
    pump();
    return id;
  };
  window.cancelAnimationFrame = (id) => {
    if (id > 1e9) queue.delete(id);
    else nativeCancel(id);
  };
  const setCap = (fps) => {
    const n = typeof fps === "number" ? Math.min(3000, Math.max(30, fps)) : 0;
    cap = n;
    interval = n > 0 ? 1000 / n : 0;
    last = performance.now() - interval;
    if (cap <= 0 && queue.size) {
      const cbs = queue;
      queue = new Map();
      for (const cb of cbs.values()) nativeRaf(cb);
    }
  };

  // ---------------------------------------------------------------------------------------------------------------
  // Input lag: envio imediato (depende do patch aplicado no alpha2s.js).
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
  // Visual: o render da partida passa por __btPre (patch "render"). Tudo aqui só muda o que é desenhado na sua tela;
  // a simulação e o que vai para a sala ficam iguais.
  const FRAME_MS = 1000 / 30;
  const visual = { lastFrameAt: 0, predictions: 0 };
  const cloneOf = (o) => Object.assign(Object.create(Object.getPrototypeOf(o)), o);
  const bodiesOf = (st) => {
    const out = [];
    st.discs?.forEach((d, i) => {
      if (d && typeof d.x === "number") out.push(["d" + i, d]);
    });
    if (st.ball && typeof st.ball.x === "number") out.push(["b", st.ball]);
    return out;
  };
  const playing = (st) => st && st.discs && st.fte === -1 && st.ftu === -1;

  // Previsão: roda a física do próprio jogo (patch "step") alguns quadros à frente, em cópias do estado.
  // Os outros jogadores seguem com o último input conhecido; se mudarem de direção, a imagem corrige em seguida.
  let predBase = null;
  let preds = [];
  let predStopped = false;
  let predErrors = 0;
  const predict = (cur, f, n) => {
    if (cur !== predBase) {
      predBase = cur;
      preds = [cur];
      predStopped = false;
    }
    const step = window.__btStep;
    if (predStopped || typeof step !== "function") return preds;
    const biggg = window.__bkFis; // o mod biggg guarda estado da física entre passos: preserva
    const saved = biggg ? biggg.salva() : null;
    try {
      while (preds.length <= n) {
        const next = step(preds[preds.length - 1], f + preds.length - 1);
        // gol, contagem ou fim de rodada no caminho: para antes (não mostra o gol antes da hora)
        if (!playing(next)) {
          predStopped = true;
          break;
        }
        preds.push(next);
        visual.predictions++;
      }
    } finally {
      if (biggg) biggg.restaura(saved);
    }
    return preds;
  };
  const withPositions = (real, from) => {
    const c = cloneOf(real);
    c.discs = real.discs.map((d, i) => {
      const p = from.discs[i];
      return d && p ? Object.assign(cloneOf(d), { x: p.x, y: p.y, xv: p.xv, yv: p.yv, a: p.a ?? d.a }) : d;
    });
    if (real.ball && from.ball) c.ball = Object.assign(cloneOf(real.ball), { x: from.ball.x, y: from.ball.y, xv: from.ball.xv, yv: from.ball.yv });
    return c;
  };
  const extrapolate = (prev, cur, alpha, f) => {
    const ahead = alpha - 1 + S.extrap / FRAME_MS; // quadros depois do estado atual
    if (ahead <= 0) return [prev, cur, alpha + S.extrap / FRAME_MS];
    // sem a física disponível, não vai além do estado atual (prolongar em linha reta atravessa paredes)
    if (patches.step !== "ok" || predErrors > 20 || !playing(cur)) return [prev, cur, 1];
    try {
      const i = Math.floor(ahead);
      const ps = predict(cur, f, i + 1);
      if (ps.length < 2) return [prev, cur, 1];
      const a = Math.min(i, ps.length - 1);
      const b = Math.min(i + 1, ps.length - 1);
      return [a === 0 ? cur : withPositions(cur, ps[a]), withPositions(cur, ps[b]), a === b ? 1 : ahead - i];
    } catch (err) {
      if (++predErrors === 21) console.warn("[Bonk Turbo] previsão desligada nesta partida:", err);
      return [prev, cur, 1];
    }
  };

  // Suavização: quando a sala corrige o passado (rollback), quem "pulou" desliza até a posição certa.
  const drawnAt = new Map(); // quadro -> estado desenhado como atual
  const offsets = new Map(); // corpo -> [dx, dy] que vai diminuindo
  let lastSmoothAt = 0;
  const addCorrection = (old, now) => {
    const fresh = new Map(bodiesOf(now));
    for (const [k, v] of bodiesOf(old)) {
      const d = fresh.get(k);
      if (!d) {
        offsets.delete(k);
        continue;
      }
      const o = offsets.get(k) || [0, 0];
      o[0] += v.x - d.x;
      o[1] += v.y - d.y;
      if (Math.abs(o[0]) + Math.abs(o[1]) > 5) offsets.delete(k); // pulo grande (renascer, gol): sem suavizar
      else offsets.set(k, o);
    }
  };
  const smooth = (prev, cur, f) => {
    if (cur.dontInterpolate) {
      drawnAt.clear();
      offsets.clear();
      return;
    }
    const before = drawnAt.get(f);
    if (before && before !== cur) addCorrection(before, cur);
    else if (!before && prev && drawnAt.get(f - 1) && drawnAt.get(f - 1) !== prev) addCorrection(drawnAt.get(f - 1), prev);
    drawnAt.set(f, cur);
    for (const k of drawnAt.keys()) if (k < f - 40) drawnAt.delete(k);
    const t = performance.now();
    const keep = Math.exp(-Math.min(t - lastSmoothAt, 200) / S.smooth);
    lastSmoothAt = t;
    for (const [k, o] of offsets) {
      o[0] *= keep;
      o[1] *= keep;
      if (Math.abs(o[0]) + Math.abs(o[1]) < 0.002) offsets.delete(k);
    }
  };
  const shifted = (st) => {
    if (!st) return st;
    const c = cloneOf(st);
    if (st.discs)
      c.discs = st.discs.map((d, i) => {
        const o = d && offsets.get("d" + i);
        return o ? Object.assign(cloneOf(d), { x: d.x + o[0], y: d.y + o[1] }) : d;
      });
    const ob = st.ball && offsets.get("b");
    if (ob) c.ball = Object.assign(cloneOf(st.ball), { x: st.ball.x + ob[0], y: st.ball.y + ob[1] });
    return c;
  };

  window.__btPre = (prev, cur, alpha, f) => {
    try {
      visual.lastFrameAt = performance.now();
      if (!cur) return [prev, cur, alpha];
      let r = [prev, cur, S.noInterp ? 1 : alpha];
      if (S.smooth > 0) smooth(prev, cur, f);
      else if (drawnAt.size) {
        drawnAt.clear();
        offsets.clear();
      }
      if (S.extrap > 0 && !cur.dontInterpolate) r = extrapolate(r[0], r[1], r[2], f);
      if (offsets.size) r = [shifted(r[0]), shifted(r[1]), r[2]];
      return r;
    } catch {
      return [prev, cur, alpha];
    }
  };

  // Skins: o cache de texturas do jogo guarda a skin já pintada; ao trocar a opção, ele é limpo.
  let avatarCache = null;
  Object.defineProperty(Object.prototype, "avatarCache", {
    configurable: true,
    get: () => undefined,
    set(value) {
      Object.defineProperty(this, "avatarCache", { value, writable: true, configurable: true, enumerable: true });
      avatarCache = value;
    },
  });

  // Nomes acima dos jogadores (patch "nicks").
  const nickTexts = new Set();
  window.__btNick = (text) => {
    nickTexts.add(text);
    text.visible = !S.hideNicks;
    return text;
  };
  const applyNicks = () => {
    for (const t of nickTexts) {
      if (t.destroyed) nickTexts.delete(t);
      else t.visible = !S.hideNicks;
    }
  };

  // Chat: esconde as mensagens dos jogadores; as do sistema ("* ...") continuam.
  const CHATS = "#ingamechatcontent, #newbonklobby_chat_content";
  const isPlayerLine = (el) => el.nodeType === 1 && !el.textContent.trim().startsWith("*");
  const applyChat = (el) => {
    if (isPlayerLine(el)) el.style.display = S.muteChat ? "none" : "";
  };
  const chatObserver = new MutationObserver((muts) => {
    for (const m of muts) for (const n of m.addedNodes) if (n.parentElement?.matches(CHATS)) applyChat(n);
  });
  whenDom(() => {
    for (const c of document.querySelectorAll(CHATS)) chatObserver.observe(c, { childList: true });
  });
  const applyChatAll = () => {
    for (const c of document.querySelectorAll(CHATS)) for (const l of c.children) applyChat(l);
  };

  // ---------------------------------------------------------------------------------------------------------------
  // P2P: conta conexões WebRTC abertas com os outros jogadores.
  const peers = new Set();
  const NativePC = window.RTCPeerConnection;
  if (NativePC) {
    window.RTCPeerConnection = class extends NativePC {
      constructor(...args) {
        super(...args);
        peers.add(this);
        const done = () => {
          if (this.connectionState === "closed" || this.connectionState === "failed") peers.delete(this);
          render();
        };
        this.addEventListener("connectionstatechange", done);
      }
    };
  }
  const p2pOpen = () => [...peers].filter((p) => p.connectionState === "connected").length;

  // ---------------------------------------------------------------------------------------------------------------
  // Motor de rede do jogo: capturado quando o jogo define this.kickPlayer na instância.
  let net = null;
  Object.defineProperty(Object.prototype, "kickPlayer", {
    configurable: true,
    get: () => undefined,
    set(value) {
      Object.defineProperty(this, "kickPlayer", { value, writable: true, configurable: true, enumerable: true });
      net = this;
    },
  });

  // ---------------------------------------------------------------------------------------------------------------
  // Estado da sala, lido das mensagens do servidor (socket.io: "42[id, ...]").
  const room = { inRoom: false, myId: null, hostId: null, playing: false, teamLock: false, players: new Map() };
  const bans = new Set((S.bans || []).map((n) => n.toLowerCase()));
  const resetRoom = () => {
    room.inRoom = false;
    room.myId = room.hostId = null;
    room.playing = false;
    room.players.clear();
  };
  const isHost = () => room.inRoom && room.myId !== null && room.myId === room.hostId;
  const asTeam = (v) => (Number.isInteger(v) && v >= 0 && v <= 5 ? v : 1);
  const onFrame = (data) => {
    if (typeof data !== "string" || data.charCodeAt(0) !== 52 || data.charCodeAt(1) !== 50 || data.length > 262144) return;
    const head = /^42\[(\d{1,3})[,\]]/.exec(data);
    if (!head || !WANTED.has(Number(head[1]))) return;
    let a;
    try {
      a = JSON.parse(data.slice(2));
    } catch {
      return;
    }
    if (!Array.isArray(a)) return;
    switch (a[0]) {
      case 2: // sala criada (por mim)
        resetRoom();
        Object.assign(room, { inRoom: true, myId: 0, hostId: 0 });
        room.players.set(0, { id: 0, name: "Você", guest: false, level: 0, team: 1 });
        break;
      case 3: {
        // entrei numa sala: [3, meuId, hostId, jogadores[], ...]
        resetRoom();
        Object.assign(room, { inRoom: true, myId: a[1], hostId: a[2] });
        (Array.isArray(a[3]) ? a[3] : []).forEach((p, id) => {
          if (p && typeof p.userName === "string")
            room.players.set(id, { id, name: p.userName, guest: !!p.guest, level: p.level | 0, team: asTeam(p.team) });
        });
        break;
      }
      case 4: {
        // entrou alguém: [4, id, peerId, nome, convidado, nível, time]
        const p = { id: a[1], name: String(a[3] ?? "?"), guest: !!a[4], level: a[5] | 0, team: asTeam(a[6]) };
        room.players.set(p.id, p);
        if (isHost() && bans.has(p.name.toLowerCase())) setTimeout(() => net?.banPlayer(p.id), 250);
        break;
      }
      case 5: // saiu
      case 24: // expulso
        if (a[1] === room.myId) resetRoom();
        else room.players.delete(a[1]);
        break;
      case 6: // host saiu: [6, antigoHost, novoHost]
        if (a[2] === -1) resetRoom();
        else {
          room.players.delete(a[1]);
          room.hostId = a[2];
        }
        break;
      case 41: {
        const h = a[1];
        room.hostId = typeof h === "object" && h ? h.newHost : h;
        break;
      }
      case 12: {
        const p = room.players.get(a[1]);
        if (p && typeof a[2] === "string") p.name = a[2];
        break;
      }
      case 18: {
        const p = room.players.get(a[1]);
        if (p) p.team = asTeam(a[2]);
        break;
      }
      case 19:
        room.teamLock = !!a[1];
        break;
      case 15:
        room.playing = true;
        break;
      case 13:
        room.playing = false;
        break;
    }
    render();
  };
  const WANTED = new Set([2, 3, 4, 5, 6, 12, 13, 15, 18, 19, 24, 41]);
  const NativeWS = window.WebSocket;
  window.WebSocket = class extends NativeWS {
    constructor(url, protocols) {
      super(url, protocols);
      let game = false;
      try {
        const u = new URL(String(url), location.href);
        game = /(^|\.)bonk\.io$/.test(u.hostname) && u.pathname.startsWith("/socket.io/");
      } catch {}
      if (game) {
        this.addEventListener("message", (ev) => onFrame(ev.data));
        this.addEventListener("close", () => {
          resetRoom();
          render();
        });
      }
    }
  };

  // ---------------------------------------------------------------------------------------------------------------
  // Interface: painel (F2) com Sala e Desempenho, contador de FPS e tela cheia 16:9.
  const CSS = `
html.bt-stretch, html.bt-stretch body { margin:0 !important; overflow:hidden !important; background:#000 !important; }
html.bt-stretch #bonkiocontainer { position:fixed !important; left:0 !important; top:0 !important; width:100vw !important; height:100vh !important; margin:0 !important; border:0 !important; }
html.bt-stretch :is(#gamerenderer, #bgreplay) > canvas { position:fixed !important; left:0 !important; top:0 !important; width:100vw !important; height:100vh !important; }
html.bt-stretch #xpbarcontainer { display:none !important; }
#bt-fps { position:fixed; left:6px; top:4px; z-index:2147483646; font:600 12px/1 Consolas, monospace; color:#9effa8; text-shadow:0 1px 2px #000; pointer-events:none; }
#bt-panel { position:fixed; right:12px; top:12px; width:440px; max-height:calc(100vh - 24px); overflow:auto; z-index:2147483647; background:#14121acc; backdrop-filter:none;
  color:#ece9f2; font:13px/1.35 "Segoe UI", system-ui, sans-serif; border:1px solid #ffffff1f; border-radius:10px; box-shadow:0 8px 30px #000a; display:none; }
#bt-panel.open { display:block; }
#bt-panel header { display:flex; align-items:center; gap:6px; padding:8px 10px; border-bottom:1px solid #ffffff14; }
#bt-panel header b { flex:1; font-size:14px; }
#bt-panel .tabs button { background:none; border:0; color:#aaa3b8; padding:4px 8px; border-radius:6px; cursor:pointer; font:inherit; }
#bt-panel .tabs button.on { background:#7c4dff; color:#fff; }
#bt-panel section { padding:10px; display:none; }
#bt-panel section.on { display:block; }
#bt-panel .row { display:flex; align-items:center; gap:6px; margin:6px 0; }
#bt-panel .row > span { flex:1; }
#bt-panel .muted { color:#9d97aa; font-size:12px; }
#bt-panel .player { padding:6px 0; border-top:1px solid #ffffff10; }
#bt-panel .player .name { font-weight:600; }
#bt-panel .player .acts { display:flex; flex-wrap:wrap; gap:4px; margin-top:4px; }
#bt-panel button.b { background:#2a2633; color:#ece9f2; border:1px solid #ffffff1a; border-radius:5px; padding:2px 7px; cursor:pointer; font:12px "Segoe UI", sans-serif; }
#bt-panel button.b:hover { background:#3a3446; }
#bt-panel button.warn { background:#5a1f2a; }
#bt-panel .t0{color:#bbb} #bt-panel .t1{color:#e0e0e0} #bt-panel .t2{color:#ff6b6b} #bt-panel .t3{color:#5aa9ff} #bt-panel .t4{color:#6bdc7a} #bt-panel .t5{color:#ffd54a}
#bt-panel input[type=number], #bt-panel input[type=text], #bt-panel select { background:#0e0c13; color:#ece9f2; border:1px solid #ffffff26; border-radius:5px; padding:3px 6px; font:inherit; }
#bt-panel input[type=range] { width:100%; }
#bt-panel .ok { color:#7ee08a; } #bt-panel .bad { color:#ff8a8a; }
`;
  const TEAMS = ["Espectador", "Livre", "Vermelho", "Azul", "Verde", "Amarelo"];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  let panel = null;
  let fpsEl = null;
  let tab = "room";

  let appliedSkin = null;
  const save = (patch) => {
    S = { ...S, ...patch };
    apply();
    api?.setSettings(patch);
  };
  const apply = () => {
    setCap(S.fps === "vsync" || S.fps === "unlimited" ? 0 : S.fps);
    const skinKey = `${!!S.origSkin}${!!S.teamBorder}`;
    if (skinKey !== appliedSkin) {
      window.__btOrigSkin = !!S.origSkin;
      window.__btTeamBorder = !!S.teamBorder;
      if (appliedSkin !== null) avatarCache?.clear?.(); // skins já pintadas são refeitas na próxima rodada
      appliedSkin = skinKey;
    }
    applyNicks();
    applyChatAll();
    document.documentElement.classList.toggle("bt-stretch", !!S.stretch);
    if (fpsEl) fpsEl.style.display = S.showFps ? "" : "none";
    window.dispatchEvent(new Event("resize"));
  };

  const act = (fn) => {
    if (!net) return alert("O jogo ainda não está conectado.");
    try {
      fn(net);
    } catch (err) {
      console.error("[Bonk Turbo]", err);
    }
  };

  function renderRoom() {
    if (!room.inRoom) return `<p class="muted">Entre numa sala para ver os jogadores.</p>`;
    const host = isHost();
    let html = `<div class="row"><span>${host ? "Você é o host" : "Você não é o host"} · ${room.playing ? "em partida" : "no lobby"}</span>`;
    if (host) html += `<button class="b" data-a="lock">${room.teamLock ? "Destravar times" : "Travar times"}</button>`;
    html += `</div>`;
    if (host && patches.restart === "ok")
      html += `<div class="row"><button class="b" data-a="restart" style="flex:1;padding:6px">${room.playing ? "Reiniciar partida" : "Começar partida"}</button></div>`;
    if (!host) html += `<p class="muted">As ações de host aparecem quando você é o host da sala.</p>`;
    for (const p of room.players.values()) {
      const me = p.id === room.myId;
      html += `<div class="player"><span class="name t${p.team}">${esc(p.name)}</span> <span class="muted">${p.guest ? "convidado" : "nv " + p.level} · ${TEAMS[p.team]}${p.id === room.hostId ? " · host" : ""}${me ? " · você" : ""}</span>`;
      if (host && !me) {
        html += `<div class="acts">`;
        for (const t of [0, 1, 2, 3, 4, 5]) if (t !== p.team) html += `<button class="b" data-a="team" data-id="${p.id}" data-t="${t}">${TEAMS[t]}</button>`;
        html += `<button class="b" data-a="host" data-id="${p.id}">Dar host</button>`;
        html += `<button class="b warn" data-a="kick" data-id="${p.id}">Kick</button>`;
        html += `<button class="b warn" data-a="ban" data-id="${p.id}">Ban</button></div>`;
      }
      html += `</div>`;
    }
    if (bans.size) {
      html += `<div class="player"><b>Banidos</b> <span class="muted">(banidos de novo se voltarem enquanto você for host)</span><div class="acts">`;
      for (const n of bans) html += `<button class="b" data-a="unban" data-n="${esc(n)}">${esc(n)} ✕</button>`;
      html += `</div></div>`;
    }
    return html;
  }

  function renderPerf() {
    const fpsNum = typeof S.fps === "number" ? S.fps : 240;
    const mode = typeof S.fps === "number" ? "cap" : S.fps;
    const status = (k) => (patches[k] === "ok" ? `<span class="ok">ativo no código do jogo</span>` : `<span class="bad">indisponível (${esc(patches[k] || "não aplicado")})</span>`);
    return `
<div class="row"><span>Modo de FPS</span><select data-s="fpsMode">
  <option value="cap"${mode === "cap" ? " selected" : ""}>Limite</option>
  <option value="unlimited"${mode === "unlimited" ? " selected" : ""}>Sem limite</option>
  <option value="vsync"${mode === "vsync" ? " selected" : ""}>VSync</option></select></div>
<div class="row"${mode === "cap" ? "" : ' style="display:none"'}><input type="range" min="30" max="3000" step="1" value="${fpsNum}" data-s="fpsRange"><input type="number" min="30" max="3000" value="${fpsNum}" data-s="fps" style="width:70px"></div>
<p class="muted">Trocar entre VSync e os outros modos exige reiniciar o launcher.</p>
<div class="row"><span>Mostrar FPS</span><input type="checkbox" data-s="showFps"${S.showFps ? " checked" : ""}></div>
<div class="row"><span>Tela cheia 16:9 sem bordas (estica o jogo)</span><input type="checkbox" data-s="stretch"${S.stretch ? " checked" : ""}></div>
<div class="row"><span>Resolução de renderização</span><select data-s="renderScale">
  ${[0.5, 0.75, 1, 1.5, 2].map((v) => `<option value="${v}"${Number(S.renderScale) === v ? " selected" : ""}>${v * 100}%</option>`).join("")}</select></div>
<p class="muted">A resolução vale depois de recarregar o jogo (F5).</p>
<hr style="border-color:#ffffff14">
<div class="row"><span>Envio imediato de input</span><input type="checkbox" data-s="earlyInput"${S.earlyInput ? " checked" : ""}></div>
<p class="muted">Manda a tecla na hora em que você aperta, em vez de esperar o próximo tick (até 33 ms antes). ${status("earlyInput")}</p>
<div class="row"><span>Conexões P2P abertas</span><b>${p2pOpen()}</b></div>
<p class="muted">Com P2P, seus inputs chegam direto aos outros jogadores sem passar pelo servidor.</p>
<hr style="border-color:#ffffff14">
<div class="row"><input type="text" placeholder="https://bonk.io/123456abcde" data-s="link" style="flex:1"><button class="b" data-a="join">Entrar</button></div>
<p class="muted" data-s="joinMsg"></p>`;
  }

  function renderVisual() {
    const ok = (k) => patches[k] === "ok";
    const missing = (k) => (ok(k) ? "" : ` <span class="bad">indisponível nesta versão do jogo</span>`);
    const live =
      performance.now() - visual.lastFrameAt < 1500 ? `<span class="ok">partida sendo desenhada agora</span>` : `<span class="muted">vale durante a partida</span>`;
    return `
<p class="muted">Tudo aqui muda só a sua tela: a simulação e o que vai para a sala continuam iguais. ${live}</p>
<div class="row"><span>Previsão (extrapolação)</span><b data-l="extrap">${S.extrap ? S.extrap + " ms" : "desligada"}</b></div>
<input type="range" min="0" max="50" step="1" value="${S.extrap}" data-s="extrap">
<p class="muted">Desenha a partida alguns milissegundos à frente, rodando a física do próprio jogo. Compensa parte do atraso do tick e da rede. Os outros jogadores são previstos com o último input deles; se mudarem de direção, a imagem corrige.${missing("step")}</p>
<div class="row"><span>Suavizar correções</span><b data-l="smooth">${S.smooth ? S.smooth + " ms" : "desligada"}</b></div>
<input type="range" min="0" max="300" step="10" value="${S.smooth}" data-s="smooth">
<p class="muted">Quando a sala corrige uma posição (lag de outro jogador), o jogador desliza até o lugar certo em vez de teleportar.</p>
<div class="row"><span>Desenho sem interpolação</span><input type="checkbox" data-s="noInterp"${S.noInterp ? " checked" : ""}></div>
<p class="muted">Mostra sempre o último tick, sem misturar com o anterior. Com a previsão ligada, não é necessário.${missing("render")}</p>
<hr style="border-color:#ffffff14">
<div class="row"><span>Skin original nos modos com time</span><input type="checkbox" data-s="origSkin"${S.origSkin ? " checked" : ""}></div>
<div class="row"><span>Manter borda da cor do time</span><input type="checkbox" data-s="teamBorder"${S.teamBorder ? " checked" : ""}></div>
<p class="muted">Tira a pintura da cor do time das skins. Com a borda, dá para saber o time de cada um. Vale a partir da próxima rodada.${missing("skins")}</p>
<div class="row"><span>Esconder nomes na partida</span><input type="checkbox" data-s="hideNicks"${S.hideNicks ? " checked" : ""}></div>
<div class="row"><span>Esconder chat dos jogadores</span><input type="checkbox" data-s="muteChat"${S.muteChat ? " checked" : ""}></div>
<p class="muted">As mensagens do sistema (entradas, saídas, avisos) continuam aparecendo.${missing("nicks")}</p>`;
  }

  let featuresChanged = false;
  function renderGame() {
    const f = S.features || {};
    let html = `
<p class="muted">Funções que <b>mudam a física</b> da partida. Todos na sala precisam ter a mesma função ligada (no Bonk Turbo,
ou o mesmo script na mesma versão pelo Tampermonkey); quem não tiver joga com a física normal e a partida dessincroniza.</p>
<div class="player"><div class="row"><span class="name">Física customizada</span><span class="muted">biggg v18</span><input type="checkbox" data-feature="biggg"${f.biggg ? " checked" : ""}></div>
<div class="muted">Quando você é o host, aparece o botão do <b>Menu Host</b> no lobby: tamanho do campo, gol, traves e rede; tamanho,
peso, chute e quique da bola; tamanho e velocidade dos jogadores; tempo de partida, gol de ouro, pênaltis, Sniper e modos prontos
(1v1, 3v3, Big, Futsal, Haxball...). No chat: <b>/p</b> pausa, <b>/acrescimo</b>, <b>/time1</b> e <b>/time2</b> dão nome aos times,
<b>/sync on</b> detecta dessincronização. O host avisa no chat quem está sem a função.</div></div>
<div class="player"><div class="row"><span class="name">Power shot e curva</span><span class="muted">bonk-power-shot v6</span><input type="checkbox" data-feature="powerShot"${f.powerShot ? " checked" : ""}></div>
<div class="muted">No Football, com a tecla <b>Special</b>: segure conduzindo a bola para carregar e solte para chutar mais forte.
Correndo de lado na hora de soltar, a bola sai com curva. O host liga no chat do lobby com <b>/chute power on</b> e
<b>/chute curva on</b> (veja <b>/chute</b>).</div></div>`;
    if (featuresChanged)
      html += `<div class="row"><button class="b" data-a="modsReload" style="flex:1;padding:6px">Recarregar o jogo para aplicar</button></div>
        <p class="muted">Recarregar tira você da sala atual.</p>`;
    return html;
  }

  let modList = null;
  let modsChanged = false;
  const loadMods = () =>
    api?.listMods().then((list) => {
      modList = list || [];
      render();
    });
  function renderMods() {
    if (!modList) {
      void loadMods();
      return `<p class="muted">Carregando...</p>`;
    }
    let html = `<p class="muted">Scripts no formato do Tampermonkey (.user.js). Ligue os que quiser; valem depois de recarregar o jogo.</p>`;
    if (!modList.length) html += `<p class="muted">Nenhum mod instalado. Coloque arquivos .user.js na pasta de mods.</p>`;
    for (const m of modList) {
      html += `<div class="player"><div class="row"><span><span class="name">${esc(m.name)}</span> <span class="muted">${m.version ? "v" + esc(m.version) : ""}${m.builtin ? " · vem com o launcher" : ""}</span></span>
        <input type="checkbox" data-mod="${esc(m.id)}"${m.enabled ? " checked" : ""}></div>${m.description ? `<div class="muted">${esc(m.description)}</div>` : ""}</div>`;
    }
    if (modsChanged)
      html += `<div class="row"><button class="b" data-a="modsReload" style="flex:1;padding:6px">Recarregar o jogo para aplicar</button></div>
        <p class="muted">Recarregar tira você da sala atual.</p>`;
    html += `<div class="row"><button class="b" data-a="modsFolder" style="flex:1">Abrir pasta de mods</button><button class="b" data-a="modsRefresh" style="flex:1">Atualizar lista</button></div>
      <p class="muted">Mods que mudam a física só funcionam se todos na sala tiverem o mesmo mod ligado. Instale só mods de quem você confia: eles rodam dentro do jogo.</p>`;
    return html;
  }

  function render() {
    if (!panel || !panel.classList.contains("open")) return;
    const box = panel.querySelector(`section[data-tab="${tab}"]`);
    // não redesenha enquanto o usuário digita ou arrasta algo no painel
    if (panel.contains(document.activeElement) && document.activeElement.matches("input, select")) return;
    box.innerHTML = tab === "room" ? renderRoom() : tab === "mods" ? renderMods() : tab === "visual" ? renderVisual() : tab === "game" ? renderGame() : renderPerf();
  }

  function buildUi() {
    const style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);
    fpsEl = document.createElement("div");
    fpsEl.id = "bt-fps";
    document.body.appendChild(fpsEl);
    setInterval(() => {
      fpsEl.textContent = `${frames} FPS`;
      frames = 0;
    }, 1000);

    panel = document.createElement("div");
    panel.id = "bt-panel";
    panel.innerHTML = `<header><b>Bonk Turbo</b><span class="tabs"><button data-tab="room" class="on">Sala</button><button data-tab="perf">Desempenho</button><button data-tab="visual">Visual</button><button data-tab="game">Jogo</button><button data-tab="mods">Mods</button></span>
      <button class="b" data-a="close">✕</button></header><section data-tab="room" class="on"></section><section data-tab="perf"></section><section data-tab="visual"></section><section data-tab="game"></section><section data-tab="mods"></section>`;
    document.body.appendChild(panel);
    // o jogo trata teclas na janela inteira; dentro do painel elas ficam no painel
    for (const t of ["keydown", "keyup", "keypress"]) panel.addEventListener(t, (e) => e.stopPropagation());

    panel.addEventListener("click", (e) => {
      const el = e.target.closest("[data-tab],[data-a]");
      if (!el) return;
      if (el.dataset.tab && el.tagName === "BUTTON") {
        tab = el.dataset.tab;
        panel.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("on", b === el));
        panel.querySelectorAll("section").forEach((s) => s.classList.toggle("on", s.dataset.tab === tab));
        return render();
      }
      const id = Number(el.dataset.id);
      const p = room.players.get(id);
      switch (el.dataset.a) {
        case "close":
          panel.classList.remove("open");
          return;
        case "lock":
          return act((n) => n.doTeamLock(!room.teamLock));
        case "restart":
          // mesmo evento do botão Start do lobby; funciona também no meio da partida
          for (const emit of Object.values(window.__btEmit || {})) {
            try {
              emit("startGame");
            } catch (err) {
              console.error("[Bonk Turbo]", err);
            }
          }
          return;
        case "team":
          return act((n) => n.changeOtherTeam(id, Number(el.dataset.t)));
        case "host":
          if (confirm(`Passar o host para ${p?.name}?`)) act((n) => n.sendHostChange(id));
          return;
        case "kick":
          return act((n) => n.kickPlayer(id));
        case "ban":
          if (!p) return;
          bans.add(p.name.toLowerCase());
          save({ bans: [...bans] });
          act((n) => n.banPlayer(id));
          return render();
        case "unban":
          bans.delete(el.dataset.n);
          save({ bans: [...bans] });
          return render();
        case "modsFolder":
          void api?.openModsFolder();
          return;
        case "modsRefresh":
          modList = null;
          return render();
        case "modsReload":
          void api?.reload();
          return;
        case "join": {
          const input = panel.querySelector('[data-s="link"]');
          const msg = panel.querySelector('[data-s="joinMsg"]');
          msg.textContent = "Procurando a sala...";
          api?.joinLink(input.value).then((r) => {
            if (r && !r.ok) msg.textContent = r.error;
          });
          return;
        }
      }
    });
    panel.addEventListener("change", (e) => {
      const el = e.target;
      if (el.dataset.feature) {
        save({ features: { ...(S.features || {}), [el.dataset.feature]: el.checked } });
        featuresChanged = true;
        el.blur();
        return render();
      }
      if (el.dataset.mod) {
        save({ mods: { ...(S.mods || {}), [el.dataset.mod]: el.checked } });
        const m = modList?.find((x) => x.id === el.dataset.mod);
        if (m) m.enabled = el.checked;
        modsChanged = true;
        el.blur();
        return render();
      }
      switch (el.dataset.s) {
        case "fpsMode": {
          const was = S.fps;
          const fps = el.value === "cap" ? (typeof was === "number" ? was : 240) : el.value;
          save({ fps });
          if ((was === "vsync") !== (fps === "vsync") && confirm("Essa troca precisa reiniciar o launcher. Reiniciar agora?")) api?.relaunch();
          break;
        }
        case "fps":
        case "fpsRange": {
          const v = Math.min(3000, Math.max(30, Math.round(Number(el.value) || 240)));
          save({ fps: v });
          break;
        }
        case "renderScale":
          save({ renderScale: Number(el.value) });
          break;
        case "extrap":
        case "smooth":
          save({ [el.dataset.s]: Number(el.value) });
          break;
        default:
          if (el.type === "checkbox") save({ [el.dataset.s]: el.checked });
      }
      el.blur();
      render();
    });
    panel.addEventListener("input", (e) => {
      const k = e.target.dataset.s;
      if (k === "fpsRange") panel.querySelector('[data-s="fps"]').value = e.target.value;
      if (k === "extrap" || k === "smooth") {
        // aplica enquanto arrasta, para dar para sentir a diferença na hora
        S = { ...S, [k]: Number(e.target.value) };
        const label = panel.querySelector(`[data-l="${k}"]`);
        if (label) label.textContent = S[k] ? `${S[k]} ms` : "desligada";
      }
    });

    // F2 é capturado pelo launcher (funciona com o foco em qualquer parte da janela)
    api?.onTogglePanel(() => {
      panel.classList.toggle("open");
      render();
    });
    setInterval(render, 1000);
    apply();
  }

  api?.onSettings((next) => {
    S = next;
    apply();
    render();
  });
  apply();
  whenDom(buildUi);
})();
