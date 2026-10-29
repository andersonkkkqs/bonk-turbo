/* Bonk Turbo: roda no mundo da página, antes do código do jogo (vai prefixado ao alpha2s.js). */
(() => {
  "use strict";
  if (window.__btLoaded) return;
  window.__btLoaded = true;

  const INIT = __BT_INIT__; // { settings } preenchido pelo processo principal
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
  // Resolução e nitidez (precisam valer antes de o PIXI criar os renderers).
  // Com a tela esticada, o jogo desenha numa largura de 730:500 e o navegador estica a imagem, o que borra. Com
  // "nitidez na tela esticada", o desenho já sai com pixels suficientes para a largura real da tela.
  const screenMode = () => S.screen;
  const stretchGain = screenMode() === "stretch" && S.sharpStretch ? Math.max(1, screen.width / screen.height / (730 / 500)) : 1;
  const scale = Math.min(3, Math.max(0.5, (Number(S.renderScale) || 1) * stretchGain));
  if (S.msaa || S.lowLatency) {
    // antialiasing de verdade (MSAA) nas bordas e canvas de baixa latência (o quadro vai para a tela sem esperar o
    // compositor da página); valem para os contextos WebGL criados daqui em diante
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, attrs) {
      if (type === "webgl" || type === "webgl2" || type === "experimental-webgl") {
        attrs = { ...(attrs && typeof attrs === "object" ? attrs : {}) };
        if (S.msaa) attrs.antialias = true;
        if (S.lowLatency) attrs.desynchronized = true;
      }
      return getContext.call(this, type, attrs);
    };
  }
  if (scale !== 1) {
    const desc = Object.getOwnPropertyDescriptor(window, "devicePixelRatio") ?? Object.getOwnPropertyDescriptor(Window.prototype, "devicePixelRatio");
    const base = () => {
      const v = desc?.get ? Number(desc.get.call(window)) : 1;
      return Number.isFinite(v) && v > 0 ? v : 1;
    };
    Object.defineProperty(window, "devicePixelRatio", { configurable: true, get: () => base() * scale });
  }

  // ---------------------------------------------------------------------------------------------------------------
  // Tela cheia ampla: o canvas cobre a tela toda e o desenho do jogo, na escala de sempre, vai centralizado nele.
  // Nada é esticado; nas laterais aparece o que o mapa tiver além da área de 730:500 (só a sua tela muda).
  const wideTarget = (r) => !!r.view?.closest?.("#gamerenderer, #bgreplay");
  const hookWide = () => {
    const proto = window.PIXI?.Renderer?.prototype;
    if (!proto || proto.__btWide) return !!proto;
    proto.__btWide = true;
    const resize = proto.resize;
    const render = proto.render;
    proto.resize = function (w, h) {
      // tamanho pedido pelo jogo; o desenho é feito para ele
      this.__btW = w;
      this.__btH = h;
      if (screenMode() === "wide" && wideTarget(this)) return resize.call(this, innerWidth, innerHeight);
      return resize.call(this, w, h);
    };
    proto.render = function (obj, target, ...rest) {
      if (target || !obj || !this.view) return render.call(this, obj, target, ...rest);
      if (this.__btW === undefined) {
        this.__btW = this.screen.width;
        this.__btH = this.screen.height;
      }
      const wide = screenMode() === "wide" && wideTarget(this);
      const w = wide ? innerWidth : this.__btW;
      const h = wide ? innerHeight : this.__btH;
      if (this.screen.width !== w || this.screen.height !== h) resize.call(this, w, h);
      if (!wide) return render.call(this, obj, target, ...rest);
      const dx = (w - this.__btW) / 2;
      const dy = (h - this.__btH) / 2;
      // o fundo (primeiro objeto da cena) só cobre a área do jogo: no desenho, ele é alargado até as bordas da tela
      const bg = obj.children?.[0];
      const bgSaved = (bg instanceof PIXI.Graphics || bg instanceof PIXI.Sprite) && bg.width >= this.__btW && bg.height >= this.__btH ? [bg.x, bg.y, bg.width, bg.height] : null;
      obj.position.x += dx;
      obj.position.y += dy;
      if (bgSaved) {
        bg.x -= dx;
        bg.y -= dy;
        bg.width = bgSaved[2] + 2 * dx;
        bg.height = bgSaved[3] + 2 * dy;
      }
      try {
        return render.call(this, obj, target, ...rest);
      } finally {
        obj.position.x -= dx;
        obj.position.y -= dy;
        if (bgSaved) [bg.x, bg.y, bg.width, bg.height] = bgSaved;
      }
    };
    return true;
  };
  if (!hookWide()) whenDom(hookWide);

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
  // Espera longa: dorme num setTimeout até ~1 ms antes; o último milissegundo é feito com MessageChannel (preciso, e sem
  // o atraso mínimo de 4 ms dos timers encadeados). O timer é marcado de dentro de uma mensagem, para não encadear
  // timers. Assim o processador não fica girando à toa entre um quadro e outro.
  const tickPort = new MessageChannel();
  const sleepPort = new MessageChannel();
  sleepPort.port1.onmessage = () => setTimeout(run, Math.max(0, last + interval - performance.now() - 1));
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
    if (wait > 1.5) sleepPort.port2.postMessage(0);
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
  let inputEpoch = 0; // muda quando o seu input é gravado fora do tick: a previsão visual é refeita na hora
  const channel = new MessageChannel();
  channel.port1.onmessage = () => {
    if (!S.earlyInput || !earlyAvailable) return;
    const send = window.__btSendNow;
    // só durante a partida: a função se registra a cada tick; parada há mais de 100 ms = fora de jogo
    if (typeof send !== "function" || performance.now() - (window.__btTickAt || 0) > 100) return;
    window.__btEarlyCall = true;
    try {
      send();
      inputEpoch++;
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
  //
  // O jogo desenha uma mistura entre o tick anterior e o atual (interpolação): a imagem fica sempre um tick (33 ms)
  // atrás da simulação. Este motor:
  //  1. mede o tempo dentro do tick com o relógio de alta precisão (o jogo usa Date.now, de 1 ms: em FPS alto vários
  //     quadros seguidos saíam na mesma posição);
  //  2. no modo tempo real desenha o presente, prevendo os próximos ticks com a física do próprio jogo;
  //  3. refaz a previsão no instante em que o seu input é gravado (envio imediato): o seu jogador responde no mesmo
  //     quadro em que você aperta a tecla;
  //  4. não cria objetos por quadro: as cópias de estado são feitas uma vez por tick e reaproveitadas.
  const FRAME_MS = 1000 / 30;
  const visual = { lastFrameAt: 0, steps: 0, stepsPerSec: 0 };
  setInterval(() => {
    visual.stepsPerSec = visual.steps;
    visual.steps = 0;
  }, 1000);
  const cloneOf = (o) => Object.assign(Object.create(Object.getPrototypeOf(o)), o);
  const playing = (st) => st && st.discs && st.fte === -1 && st.ftu === -1;

  // 1. Relógio do tick: quando (performance.now) o tick f começou. O alpha do jogo vem em degraus de 1 ms; aqui ele é
  // refeito com precisão de microssegundos, com um ajuste lento para acompanhar o relógio do jogo.
  const clock = { f: -1, start: 0 };
  const tickPhase = (alpha, f) => {
    const now = performance.now();
    const guess = now - alpha * FRAME_MS;
    if (f === clock.f) clock.start += (guess - clock.start) * 0.05;
    else if (f === clock.f + 1 && Math.abs(clock.start + FRAME_MS - guess) < FRAME_MS / 2)
      clock.start += FRAME_MS + (guess - clock.start - FRAME_MS) * 0.2;
    else clock.start = guess;
    clock.f = f;
    return Math.max(0, (now - clock.start) / FRAME_MS);
  };

  // 2 e 3. Previsão: estados futuros calculados pela física do jogo (patch "step"), em cópias. Os outros jogadores
  // seguem com o último input conhecido; o seu input entra assim que é gravado.
  const pred = { base: null, epoch: -1, states: [], views: [], stopped: false, errors: 0 };
  const withPositions = (real, from) => {
    const c = cloneOf(real);
    c.discs = real.discs.map((d, i) => {
      const p = from.discs[i];
      return d && p ? Object.assign(cloneOf(d), { x: p.x, y: p.y, xv: p.xv, yv: p.yv, a: p.a ?? d.a }) : d;
    });
    if (real.ball && from.ball) c.ball = Object.assign(cloneOf(real.ball), { x: from.ball.x, y: from.ball.y, xv: from.ball.xv, yv: from.ball.yv });
    return c;
  };
  const predict = (cur, f, n) => {
    if (cur !== pred.base || pred.epoch !== inputEpoch) {
      pred.base = cur;
      pred.epoch = inputEpoch;
      pred.states = [cur];
      pred.views = [cur];
      pred.stopped = false;
    }
    const step = window.__btStep;
    if (pred.stopped || typeof step !== "function") return pred.views;
    const keeper = window.__bkFis; // scripts de física que guardam estado entre passos: preserva
    const saved = keeper ? keeper.salva() : null;
    try {
      while (pred.states.length <= n) {
        const next = step(pred.states[pred.states.length - 1], f + pred.states.length - 1);
        visual.steps++;
        // gol, contagem ou fim de rodada no caminho: para antes (não mostra o gol antes da hora)
        if (!playing(next)) {
          pred.stopped = true;
          break;
        }
        pred.states.push(next);
        // só posições e velocidades vêm da previsão; sons, placar etc. continuam os do jogo de verdade
        pred.views.push(withPositions(cur, next));
      }
    } finally {
      if (keeper) keeper.restaura(saved);
    }
    return pred.views;
  };

  // Suavização: quando a sala corrige o passado (rollback), quem "pulou" desliza até a posição certa.
  const drawnAt = new Map(); // tick -> estado desenhado como atual
  const offsets = new Map(); // índice do disco (-1 = bola) -> [dx, dy], diminuindo com o tempo
  let lastSmoothAt = 0;
  const forEachBody = (st, fn) => {
    st.discs?.forEach((d, i) => d && typeof d.x === "number" && fn(i, d));
    if (st.ball && typeof st.ball.x === "number") fn(-1, st.ball);
  };
  const addCorrection = (old, now) => {
    const fresh = new Map();
    forEachBody(now, (k, b) => fresh.set(k, b));
    forEachBody(old, (k, v) => {
      const d = fresh.get(k);
      if (!d) return offsets.delete(k);
      const o = offsets.get(k) || [0, 0];
      o[0] += v.x - d.x;
      o[1] += v.y - d.y;
      if (Math.abs(o[0]) + Math.abs(o[1]) > 5) offsets.delete(k); // pulo grande (renascer, gol): sem suavizar
      else offsets.set(k, o);
    });
  };
  const trackCorrections = (prev, cur, f) => {
    if (cur.dontInterpolate) {
      drawnAt.clear();
      offsets.clear();
      return;
    }
    const before = drawnAt.get(f);
    if (before && before !== cur) addCorrection(before, cur);
    else if (!before && prev && drawnAt.get(f - 1) && drawnAt.get(f - 1) !== prev) addCorrection(drawnAt.get(f - 1), prev);
    drawnAt.set(f, cur);
    if (drawnAt.size > 60) for (const k of drawnAt.keys()) if (k < f - 40) drawnAt.delete(k);
    const t = performance.now();
    const keep = Math.exp(-Math.min(t - lastSmoothAt, 200) / S.smooth);
    lastSmoothAt = t;
    for (const [k, o] of offsets) {
      o[0] *= keep;
      o[1] *= keep;
      if (Math.abs(o[0]) + Math.abs(o[1]) < 0.002) offsets.delete(k);
    }
  };
  // 4. Cópia deslocada feita uma vez por estado e atualizada a cada quadro (sem lixo para o coletor de memória).
  const shiftedCopies = new WeakMap();
  const shifted = (st) => {
    if (!st || !offsets.size) return st;
    let c = shiftedCopies.get(st);
    if (!c) {
      c = cloneOf(st);
      if (st.discs) c.discs = st.discs.map((d) => d && cloneOf(d));
      if (st.ball) c.ball = cloneOf(st.ball);
      shiftedCopies.set(st, c);
    }
    forEachBody(st, (k, b) => {
      const o = offsets.get(k);
      const t = k === -1 ? c.ball : c.discs[k];
      t.x = o ? b.x + o[0] : b.x;
      t.y = o ? b.y + o[1] : b.y;
    });
    return c;
  };

  const out = [null, null, 0]; // reaproveitado: o render copia os valores na hora
  const result = (a, b, alpha) => {
    out[0] = shifted(a);
    out[1] = shifted(b);
    out[2] = alpha;
    return out;
  };
  window.__btPre = (prev, cur, alpha, f) => {
    try {
      visual.lastFrameAt = performance.now();
      if (!cur) return [prev, cur, alpha];
      if (S.smooth > 0) trackCorrections(prev, cur, f);
      else if (drawnAt.size) {
        drawnAt.clear();
        offsets.clear();
      }
      if (cur.dontInterpolate) return result(prev, cur, alpha);
      const phase = tickPhase(alpha, f);
      // onde desenhar, em ticks depois do atual (0 = o próprio tick atual)
      let ahead = (S.realtime ? phase : phase - 1) + S.extrap / FRAME_MS;
      // resposta seca: sem deslizar entre ticks, mostra o tick inteiro (o atual ou, no tempo real, o seguinte já previsto)
      if (S.dry) ahead = Math.ceil(ahead - 1e-6);
      if (ahead <= 0) return result(prev || cur, cur, Math.min(1, 1 + ahead));
      // sem a física disponível (ou fora do jogo rolando), não passa do estado atual: em linha reta atravessaria paredes
      if (patches.step !== "ok" || pred.errors > 20 || !playing(cur)) return result(prev || cur, cur, 1);
      const i = Math.floor(ahead);
      const views = predict(cur, f, i + 1);
      if (views.length < 2) return result(prev || cur, cur, 1);
      const a = Math.min(i, views.length - 1);
      const b = Math.min(i + 1, views.length - 1);
      return result(views[a], views[b], a === b ? 1 : ahead - i);
    } catch (err) {
      if (++pred.errors === 21) console.warn("[Bonk Turbo] previsão desligada nesta partida:", err);
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
      case 39: // modo de times ligado/desligado
        room.teams = !!a[1];
        break;
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
  const WANTED = new Set([2, 3, 4, 5, 6, 12, 13, 15, 18, 19, 24, 39, 41]);
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
/* tela cheia proporcional: o jogo ocupa a altura toda, centralizado, sem distorcer (faixas escuras dos lados) */
html.bt-fit, html.bt-fit body { margin:0 !important; overflow:hidden !important; background:#000 !important; }
html.bt-fit #bonkiocontainer { position:fixed !important; width:min(100vw, 146vh) !important; height:min(100vh, 68.4932vw) !important;
  left:calc((100vw - min(100vw, 146vh)) / 2) !important; top:calc((100vh - min(100vh, 68.4932vw)) / 2) !important; margin:0 !important; border:0 !important; }
html.bt-fit :is(#gamerenderer, #bgreplay) > canvas { position:absolute !important; left:0 !important; top:0 !important; width:100% !important; height:100% !important; }
html.bt-fit #xpbarcontainer { display:none !important; }
/* tela cheia ampla: menus e botões como no proporcional; só o canvas cobre a tela toda */
html.bt-wide, html.bt-wide body { margin:0 !important; overflow:hidden !important; background:#000 !important; }
html.bt-wide #bonkiocontainer { position:fixed !important; width:min(100vw, 146vh) !important; height:min(100vh, 68.4932vw) !important;
  left:calc((100vw - min(100vw, 146vh)) / 2) !important; top:calc((100vh - min(100vh, 68.4932vw)) / 2) !important; margin:0 !important; border:0 !important; }
html.bt-wide :is(#gamerenderer, #bgreplay) > canvas { position:fixed !important; left:0 !important; top:0 !important; width:100vw !important; height:100vh !important; }
html.bt-wide #xpbarcontainer { display:none !important; }
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
    document.documentElement.classList.toggle("bt-stretch", screenMode() === "stretch");
    document.documentElement.classList.toggle("bt-fit", screenMode() === "fit");
    document.documentElement.classList.toggle("bt-wide", screenMode() === "wide");
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

  // Modo de times: vem da sala (mensagem 39); antes de ela chegar, do texto "Teams On/Off" do lobby.
  const teamsOn = () => {
    if (typeof room.teams === "boolean") return room.teams;
    const t = document.getElementById("newbonklobby_teams_middletext")?.textContent || "";
    return /\bon\b/i.test(t) ? true : /\boff\b/i.test(t) ? false : null;
  };
  // times que fazem sentido no modo atual: com times, Livre não existe; sem times, só Livre e Espectador
  const teamChoices = () => {
    const on = teamsOn();
    return on === true ? [0, 2, 3, 4, 5] : on === false ? [0, 1] : [0, 1, 2, 3, 4, 5];
  };
  const teamButtons = (p, action) =>
    teamChoices()
      .filter((t) => t !== p.team)
      .map((t) => `<button class="b" data-a="${action}" data-id="${p.id}" data-t="${t}">${TEAMS[t]}</button>`)
      .join("");

  function renderRoom() {
    if (!room.inRoom) return `<p class="muted">Entre numa sala para ver os jogadores.</p>`;
    const host = isHost();
    const on = teamsOn();
    let html = `<div class="row"><span>${host ? "Você é o host" : "Você não é o host"} · ${room.playing ? "em partida" : "no lobby"}${
      on === null ? "" : on ? " · com times" : " · sem times"
    }</span></div>`;
    if (host) {
      // modos com times obrigatórios (Football etc.): o próprio jogo esconde o botão "Teams"
      const forced = document.getElementById("newbonklobby_teamsbutton")?.style.visibility === "hidden";
      html += `<div class="row">${
        forced
          ? `<span class="muted" style="flex:1">Este modo exige times</span>`
          : `<button class="b" data-a="teams" style="flex:1">${on ? "Desligar modo de times" : on === false ? "Ligar modo de times" : "Ligar/desligar modo de times"}</button>`
      }`;
      html += `<button class="b" data-a="lock" style="flex:1">${room.teamLock ? "Destravar times" : "Travar times"}</button></div>`;
      if (patches.restart === "ok")
        html += `<div class="row"><button class="b" data-a="restart" style="flex:1;padding:6px">${room.playing ? "Reiniciar partida" : "Começar partida"}</button></div>`;
    } else html += `<p class="muted">As ações de host aparecem quando você é o host da sala.</p>`;
    for (const p of room.players.values()) {
      const me = p.id === room.myId;
      html += `<div class="player"><span class="name t${p.team}">${esc(p.name)}</span> <span class="muted">${p.guest ? "convidado" : "nv " + p.level} · ${TEAMS[p.team]}${p.id === room.hostId ? " · host" : ""}${me ? " · você" : ""}</span>`;
      if (me) {
        // o próprio time: o host sempre pode trocar; os outros, quando os times não estão travados
        if (host || !room.teamLock) html += `<div class="acts">${teamButtons(p, "myteam")}</div>`;
      } else if (host) {
        html += `<div class="acts">${teamButtons(p, "team")}`;
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
    // o FPS é sempre um limite: VSync e "sem limite" travam PCs fracos
    return `
<div class="row"><span>Limite de FPS</span></div>
<div class="row"${mode === "cap" ? "" : ' style="display:none"'}><input type="range" min="30" max="3000" step="1" value="${fpsNum}" data-s="fpsRange"><input type="number" min="30" max="3000" value="${fpsNum}" data-s="fps" style="width:70px"></div>
<div class="row"><span>Mostrar FPS</span><input type="checkbox" data-s="showFps"${S.showFps ? " checked" : ""}></div>
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
<div class="row"><span><b>Tempo real</b> (recomendado)</span><input type="checkbox" data-s="realtime"${S.realtime ? " checked" : ""}></div>
<p class="muted">O jogo desenha sempre um tick (33 ms) atrás da simulação. No tempo real, a imagem mostra o presente: o tick
seguinte é previsto com a física do próprio jogo. Com o <b>envio imediato</b> ligado, a previsão é refeita no instante da tecla
e o seu jogador responde no mesmo quadro.${missing("step")}</p>
<div class="row"><span>Resposta seca (sem deslizar)</span><input type="checkbox" data-s="dry"${S.dry ? " checked" : ""}></div>
<p class="muted">Mostra cada tick inteiro de uma vez, sem a transição entre eles: menos liso, mas a resposta é imediata. Com o
tempo real ligado, já mostra o tick seguinte inteiro, refeito no instante da tecla.</p>
<div class="row"><span>Previsão extra (rede)</span><b data-l="extrap">${S.extrap ? S.extrap + " ms" : "nenhuma"}</b></div>
<input type="range" min="0" max="50" step="1" value="${S.extrap}" data-s="extrap">
<p class="muted">Além do tempo real, desenha mais alguns milissegundos à frente para compensar o atraso da rede. Os outros
jogadores são previstos com o último input deles; se mudarem de direção, a imagem corrige. Comece com 10 a 20 ms.</p>
<div class="row"><span>Suavizar correções</span><b data-l="smooth">${S.smooth ? S.smooth + " ms" : "desligada"}</b></div>
<input type="range" min="0" max="300" step="10" value="${S.smooth}" data-s="smooth">
<p class="muted">Quando a sala corrige uma posição (lag de outro jogador), o jogador desliza até o lugar certo em vez de teleportar.</p>
<p class="muted">Física prevista agora: <b data-l="steps">${visual.stepsPerSec}</b> passos/s · o movimento usa o relógio de alta
precisão, liso em qualquer FPS.</p>
<hr style="border-color:#ffffff14">
<div class="row"><span>Tela cheia</span><select data-s="screen">
  <option value="stretch"${S.screen === "stretch" ? " selected" : ""}>Esticada (16:9 sem bordas)</option>
  <option value="wide"${S.screen === "wide" ? " selected" : ""}>Ampla (sem esticar e sem bordas)</option>
  <option value="fit"${S.screen === "fit" ? " selected" : ""}>Proporcional (com bordas)</option></select></div>
<p class="muted">Ampla e proporcional mantêm o tamanho original do jogo, sem distorcer. Na ampla, a tela toda é usada: nas
laterais aparece o resto do mapa. Na proporcional, ficam faixas nas laterais.</p>
<div class="row"><span>Nitidez na tela cheia 16:9</span><input type="checkbox" data-s="sharpStretch"${S.sharpStretch ? " checked" : ""}></div>
<p class="muted">Desenha o jogo já com os pixels da largura real da tela, em vez de aumentar uma imagem menor (usa um pouco mais de GPU).</p>
<div class="row"><span>Antialiasing (bordas lisas)</span><input type="checkbox" data-s="msaa"${S.msaa ? " checked" : ""}></div>
<div class="row"><span>Canvas de baixa latência (experimental)</span><input type="checkbox" data-s="lowLatency"${S.lowLatency ? " checked" : ""}></div>
<p class="muted">O quadro vai para a tela sem esperar o compositor da página. Pode mostrar "rasgos" na imagem em alguns monitores.
Estas opções valem depois de recarregar o jogo (F5).</p>
<hr style="border-color:#ffffff14">
<div class="row"><span>Skin original nos modos com time</span><input type="checkbox" data-s="origSkin"${S.origSkin ? " checked" : ""}></div>
<div class="row"><span>Manter borda da cor do time</span><input type="checkbox" data-s="teamBorder"${S.teamBorder ? " checked" : ""}></div>
<p class="muted">Tira a pintura da cor do time das skins. Com a borda, dá para saber o time de cada um. Vale a partir da próxima rodada.${missing("skins")}</p>
<div class="row"><span>Esconder nomes na partida</span><input type="checkbox" data-s="hideNicks"${S.hideNicks ? " checked" : ""}></div>
<div class="row"><span>Esconder chat dos jogadores</span><input type="checkbox" data-s="muteChat"${S.muteChat ? " checked" : ""}></div>
<p class="muted">As mensagens do sistema (entradas, saídas, avisos) continuam aparecendo.${missing("nicks")}</p>`;
  }

  function render() {
    if (!panel || !panel.classList.contains("open")) return;
    const box = panel.querySelector(`section[data-tab="${tab}"]`);
    // não redesenha enquanto o usuário digita ou arrasta algo no painel
    if (panel.contains(document.activeElement) && document.activeElement.matches("input, select")) return;
    box.innerHTML = tab === "room" ? renderRoom() : tab === "visual" ? renderVisual() : renderPerf();
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
    const tabs = [
      ["room", "Sala"],
      ["perf", "Desempenho"],
      ["visual", "Visual"],
    ];
    const tabButtons = tabs.map(([id, label], i) => `<button data-tab="${id}"${i ? "" : ' class="on"'}>${label}</button>`).join("");
    const sections = tabs.map(([id], i) => `<section data-tab="${id}"${i ? "" : ' class="on"'}></section>`).join("");
    panel.innerHTML = `<header><b>Bonk Turbo Lite</b><span class="tabs">${tabButtons}</span>
      <button class="b" data-a="close">✕</button></header>${sections}`;
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
        case "teams": {
          // o mesmo que o botão "Teams" do lobby: atualiza a sala, os jogadores e avisa o servidor
          const button = document.getElementById("newbonklobby_teamsbutton");
          if (typeof button?.onclick === "function") button.onclick();
          else act((n) => n.sendTeamSettingsChange(!teamsOn()));
          return;
        }
        case "myteam":
          return act((n) => n.changeOwnTeam(Number(el.dataset.t)));
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
        case "screen":
          save({ screen: el.value });
          break;
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
        if (label) label.textContent = S[k] ? `${S[k]} ms` : k === "extrap" ? "nenhuma" : "desligada";
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
