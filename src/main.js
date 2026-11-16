"use strict";
const { app, BrowserWindow, session, ipcMain, shell } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { SettingsStore } = require("./settings");
const { patchGame } = require("./patcher");

// Edição: "full" (Sala, Desempenho, Visual, Jogo e Mods) ou "lite" (Sala, Desempenho e Visual, sem mods nem funções
// que mudam a física). O build da Lite grava "edition": "lite" no package.json e nem inclui o código dos mods.
const EDITION = process.env.BONK_TURBO_EDITION || require("../package.json").edition || "full";
const FULL = EDITION !== "lite";
const { listMods, matches, parseHeader } = FULL ? require("./mods") : {};

const GAME_URL = "https://bonk.io/";
const GAME_SCRIPT = "/js/alpha2s.js";
const PARTITION = "persist:bonkturbo";
const PRELUDE = fs.readFileSync(path.join(__dirname, "prelude.js"), "utf8");

// BONK_TURBO_PROFILE=<pasta>: perfil separado (configurações, login e trava de instância), para testes
if (process.env.BONK_TURBO_PROFILE) app.setPath("userData", process.env.BONK_TURBO_PROFILE);
if (!app.requestSingleInstanceLock()) app.exit(0);

const store = new SettingsStore(path.join(app.getPath("userData"), "settings.json"), EDITION);
const BUILTIN_MODS = path.join(__dirname, "mods");
const USER_MODS = path.join(app.getPath("userData"), "mods");
if (FULL) fs.mkdirSync(USER_MODS, { recursive: true });

// Funções de jogo que vêm no launcher (aba "Jogo"). O código é o dos scripts originais, sem alteração: assim a física
// e a sincronização ficam idênticas às de quem usa o mesmo script pelo Tampermonkey, e todos jogam juntos.
// A ordem importa: o bonk-power-shot reaproveita um patch do biggg quando os dois estão ligados.
const FEATURES = (FULL ? [
  { id: "biggg", file: "biggg.user.js" },
  { id: "powerShot", file: "bonk-power-shot.user.js" },
] : []).map((f) => {
  const code = fs.readFileSync(path.join(__dirname, "features", f.file), "utf8");
  return { ...f, code, meta: parseHeader(code) };
});
let win = null;

// Flags do Chromium: valem só na inicialização. Fora do modo VSync, o navegador não segura os quadros na taxa do monitor.
const startup = store.get();
if (startup.fps !== "vsync") {
  app.commandLine.appendSwitch("disable-frame-rate-limit");
  app.commandLine.appendSwitch("disable-gpu-vsync");
}
app.commandLine.appendSwitch("disable-renderer-backgrounding");
app.commandLine.appendSwitch("disable-background-timer-throttling");
app.commandLine.appendSwitch("disable-backgrounding-occluded-windows");
app.commandLine.appendSwitch("ignore-gpu-blocklist");

const isGameHost = (u) => u.protocol === "https:" && (u.hostname === "bonk.io" || u.hostname === "www.bonk.io");
const parse = (raw) => {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
};

/** Entrega o alpha2s.js do bonk.io com os patches e o prelude; o resto passa direto. */
function interceptGameScript(ses) {
  ses.protocol.handle("https", async (req) => {
    const u = parse(req.url);
    if (!u || !isGameHost(u) || u.pathname !== GAME_SCRIPT)
      return ses.fetch(req, { bypassCustomProtocolHandlers: true }).catch(() => Response.error());
    const upstream = await ses.fetch(req.url, { bypassCustomProtocolHandlers: true, cache: "no-cache" }).catch(() => Response.error());
    if (!upstream.ok) return upstream;
    const original = await upstream.text();
    const init = JSON.stringify({ settings: store.get(), edition: EDITION });
    let body;
    try {
      const { code, report } = patchGame(original, PRELUDE.replace("__BT_INIT__", () => init));
      console.log("[patches]", report);
      body = code;
    } catch (err) {
      console.error("[patches] falhou, usando o jogo original", err);
      body = original;
    }
    return new Response(body, { headers: { "content-type": "application/javascript; charset=utf-8", "cache-control": "no-store" } });
  });
}

/** Link de convite (bonk.io/123456abcde): abre a página do convite, e o próprio bonk.io entra na sala. */
function joinInvite(raw) {
  const m = /^(?:https?:\/\/(?:www\.)?bonk\.io\/)?([0-9]{6}[a-zA-Z0-9]{0,8})\/?$/.exec(raw.trim());
  if (!m) return { ok: false, error: "Link inválido. Use o formato https://bonk.io/123456abcde" };
  void win?.loadURL(`https://bonk.io/${m[1]}`);
  return { ok: true };
}

function createWindow() {
  const ses = session.fromPartition(PARTITION);
  interceptGameScript(ses);
  ses.setPermissionRequestHandler((_wc, permission, cb) => cb(permission === "fullscreen" || permission === "pointerLock"));

  win = new BrowserWindow({
    width: 1600,
    height: 900,
    backgroundColor: "#000000",
    title: FULL ? "Bonk Turbo" : "Bonk Turbo Lite",
    autoHideMenuBar: true,
    fullscreen: false, // abre maximizado mas com bordas/moldura (F11 alterna tela cheia real)
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      partition: PARTITION,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      // o jogo roda num iframe (gameframe-release.html): o preload precisa entrar nele
      nodeIntegrationInSubFrames: true,
      backgroundThrottling: false,
      spellcheck: false,
    },
  });
  win.setMenu(null);
  win.maximize();
  const wc = win.webContents;

  wc.on("will-navigate", (e, url) => {
    const u = parse(url);
    if (u && isGameHost(u)) return;
    e.preventDefault();
    if (u && (u.protocol === "https:" || u.protocol === "http:")) void shell.openExternal(url);
  });
  wc.setWindowOpenHandler(({ url }) => {
    const u = parse(url);
    if (u && (u.protocol === "https:" || u.protocol === "http:")) void shell.openExternal(url);
    return { action: "deny" };
  });
  wc.on("before-input-event", (e, input) => {
    if (input.type !== "keyDown") return;
    if (input.key === "F11") {
      e.preventDefault();
      win.setFullScreen(!win.isFullScreen());
    } else if (input.key === "F2") {
      e.preventDefault();
      for (const f of wc.mainFrame.framesInSubtree) if (f.origin === "https://bonk.io") f.send("panel:toggle");
    } else if (input.key === "F5") {
      e.preventDefault();
      wc.reload();
    } else if (input.key === "F12" && input.control && input.shift) {
      e.preventDefault();
      wc.toggleDevTools();
    }
  });
  const debug = process.env.BONK_TURBO_DEBUG === "1";
  wc.on("console-message", (e) => {
    if (debug || e.message.startsWith("[Bonk Turbo]")) console.log(`[página:${e.level}] ${e.message.slice(0, 300)} (${e.sourceId}:${e.lineNumber})`);
  });
  if (process.env.BONK_TURBO_SPLASH_SHOT) {
    // teste: captura só a janela do launcher durante a abertura
    wc.once("did-start-loading", () =>
      setTimeout(async () => {
        fs.writeFileSync(process.env.BONK_TURBO_SPLASH_SHOT, (await wc.capturePage()).toPNG());
      }, 2200)
    );
  }
  if (debug) wc.on("preload-error", (_e, file, err) => console.log("[debug] erro no preload", file, String(err)));
  if (debug) {
    // BONK_TURBO_DEBUG=1: mostra estado dos patches, tamanho do iframe e quadros por segundo do jogo
    wc.on("did-finish-load", () => {
      console.log("[debug] carregou", wc.getURL());
      setTimeout(async () => {
        const frame = wc.mainFrame.framesInSubtree.find((f) => f.url.includes("gameframe"));
        if (!frame) return console.log("[debug] sem gameframe");
        const probe = `JSON.stringify({ patches: window.__btPatches, painel: !!document.getElementById("bt-panel"),
          esticado: document.documentElement.classList.contains("bt-stretch"),
          scripts: { patches: window.__bkPatches?.length ?? 0, powerShot: !!window.__bkPowerShot, gol: typeof window.__bkGolL,
            jogoPatchado: !!document.querySelector('script[src^="blob:"]') },
          canvas: [...document.querySelectorAll("canvas")].filter((c) => c.width > 400).map((c) => c.width + "x" + c.height), dpr: devicePixelRatio })`;
        console.log("[debug] jogo", await frame.executeJavaScript(probe).catch((err) => String(err)));
        const rate = `new Promise((r) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 1000) requestAnimationFrame(f); else r(n); }; requestAnimationFrame(f); })`;
        console.log("[debug] quadros/s no jogo", await frame.executeJavaScript(rate).catch((err) => String(err)));
        if (process.env.BONK_TURBO_EVAL) {
          // depuração: roda um script de passos no iframe do jogo e mostra o que ele devolver
          for (const step of fs.readFileSync(process.env.BONK_TURBO_EVAL, "utf8").split(/\r?\n\/\/---\r?\n/)) {
            const r = await frame.executeJavaScript(step).catch((err) => "ERRO " + String(err));
            console.log("[eval]", typeof r === "string" ? r.slice(0, 1500) : JSON.stringify(r));
          }
          fs.writeFileSync(process.env.BONK_TURBO_EVAL + ".png", (await wc.capturePage()).toPNG());
          console.log("[eval] print salvo");
        }
        if (process.env.BONK_TURBO_SELFTEST) {
          // teste do motor visual com estados sintéticos: a "física" de mentira anda 1 unidade por passo em x
          const selftest = `(() => {
            const real = window.__btStep;
            const st = (x) => ({ discs: [{ x, y: 0, xv: 30, yv: 0 }], ball: { x, y: 5, xv: 0, yv: 0 }, fte: -1, ftu: -1 });
            let passos = 0;
            window.__btStep = (s) => (passos++, st(s.discs[0].x + 1));
            const prev = st(0), cur = st(1);
            const r1 = window.__btPre(prev, cur, 0.5, 10);
            const um = [r1[0].discs[0].x, r1[1].discs[0].x, +r1[2].toFixed(2)];
            const r2 = window.__btPre(prev, cur, 0.5, 10);
            const res = { quadro1: um, mesmoArray: r1 === r2, passosNoSegundo: passos };
            window.__btStep = real;
            return JSON.stringify(res);
          })()`;
          console.log("[debug] selftest", await frame.executeJavaScript(selftest).catch((err) => String(err)));
        }
        if (process.env.BONK_TURBO_SHOT) {
          frame.send("panel:toggle");
          setTimeout(async () => {
            if (process.env.BONK_TURBO_TAB) await frame.executeJavaScript(`document.querySelector('#bt-panel [data-tab="${process.env.BONK_TURBO_TAB}"]')?.click()`);
            await new Promise((r) => setTimeout(r, 500));
            fs.writeFileSync(process.env.BONK_TURBO_SHOT, (await wc.capturePage()).toPNG());
            console.log("[debug] print salvo");
          }, 1500);
        }
      }, 12000);
    });
    wc.on("did-fail-load", (_e, code, desc, url) => console.log("[debug] falhou", code, desc, url));
  }
  win.on("closed", () => (win = null));
  void win.loadURL(GAME_URL);
}

// só a página do bonk.io (e o iframe do jogo) falam com o launcher
const fromBonk = (e) => e.sender === win?.webContents && e.senderFrame?.origin === "https://bonk.io";

ipcMain.handle("settings:get", (e) => (fromBonk(e) ? store.get() : null));
// a abertura aparece só uma vez por execução do app
let splashShown = false;
// (e.returnValue só aceita escrita: ler devolve undefined)
ipcMain.on("splash:take", (e) => {
  const show = fromBonk(e) && !splashShown;
  if (show) splashShown = true;
  e.returnValue = show;
});
ipcMain.handle("settings:set", (e, patch) => {
  if (!fromBonk(e) || !patch || typeof patch !== "object") return null;
  const next = store.set(patch);
  for (const f of e.sender.mainFrame.framesInSubtree) if (f.origin === "https://bonk.io" && f !== e.senderFrame) f.send("settings:changed", next);
  return next;
});
// Mods: lista para o painel; o código dos ativos vai para o preload, que injeta antes do jogo carregar
ipcMain.handle("mods:list", (e) => {
  if (!fromBonk(e) || !FULL) return null;
  const on = store.get().mods;
  return listMods(BUILTIN_MODS, USER_MODS).map(({ id, name, version, description, builtin }) => ({ id, name, version, description, builtin, enabled: !!on[id] }));
});
ipcMain.on("mods:code", (e, url) => {
  let mods = [];
  // roda durante o preload, quando a origem do frame ainda não está definida: vale a URL enviada pelo preload
  // (o preload é do launcher; os scripts das páginas não têm acesso ao IPC)
  if (FULL && e.sender === win?.webContents && typeof url === "string" && parse(url)?.origin === "https://bonk.io") {
    const { mods: on, features } = store.get();
    const active = FEATURES.filter((f) => features[f.id] && matches(f.meta, url));
    mods = active.map((f) => ({ name: f.meta.name, code: f.code }));
    // um mod da pasta com o mesmo nome de uma função ligada ficaria em dobro (e dessincronizaria): fica de fora
    const taken = new Set(active.map((f) => f.meta.name.toLowerCase()));
    try {
      for (const m of listMods(BUILTIN_MODS, USER_MODS))
        if (on[m.id] && matches(m.meta, url) && !taken.has(m.name.toLowerCase())) mods.push({ name: m.name, code: m.code });
    } catch (err) {
      console.error("[mods] não consegui ler os mods", err);
    }
  }
  e.returnValue = mods;
});
ipcMain.handle("mods:folder", (e) => (fromBonk(e) && FULL ? shell.openPath(USER_MODS) : null));
ipcMain.handle("app:reload", (e) => {
  if (fromBonk(e)) e.sender.reload();
});
ipcMain.handle("room:join", (e, link) => (fromBonk(e) ? joinInvite(link) : null));
ipcMain.handle("app:relaunch", (e) => {
  if (!fromBonk(e)) return;
  app.relaunch();
  app.exit(0);
});

app.on("second-instance", () => {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.focus();
});
app.whenReady().then(createWindow);
app.on("window-all-closed", () => app.quit());
