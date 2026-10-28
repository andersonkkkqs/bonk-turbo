"use strict";
const { app, BrowserWindow, session, ipcMain, shell } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { SettingsStore } = require("./settings");
const { patchGame } = require("./patcher");

const GAME_URL = "https://bonk.io/";
const GAME_SCRIPT = "/js/alpha2s.js";
const PARTITION = "persist:bonkturbo";
const PRELUDE = fs.readFileSync(path.join(__dirname, "prelude.js"), "utf8");

// BONK_TURBO_PROFILE=<pasta>: perfil separado (configurações, login e trava de instância), para testes
if (process.env.BONK_TURBO_PROFILE) app.setPath("userData", process.env.BONK_TURBO_PROFILE);
if (!app.requestSingleInstanceLock()) app.exit(0);

const store = new SettingsStore(path.join(app.getPath("userData"), "settings.json"));
let win = null;

const isGameHost = (u) => u.protocol === "https:" && (u.hostname === "bonk.io" || u.hostname === "www.bonk.io");
const parse = (raw) => {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
};

/** Entrega o alpha2s.js do bonk.io com o patch e o prelude; o resto passa direto. */
function interceptGameScript(ses) {
  ses.protocol.handle("https", async (req) => {
    const u = parse(req.url);
    if (!u || !isGameHost(u) || u.pathname !== GAME_SCRIPT)
      return ses.fetch(req, { bypassCustomProtocolHandlers: true }).catch(() => Response.error());
    const upstream = await ses.fetch(req.url, { bypassCustomProtocolHandlers: true, cache: "no-cache" }).catch(() => Response.error());
    if (!upstream.ok) return upstream;
    const original = await upstream.text();
    const init = JSON.stringify({ settings: store.get() });
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

function createWindow() {
  const ses = session.fromPartition(PARTITION);
  interceptGameScript(ses);
  ses.setPermissionRequestHandler((_wc, permission, cb) => cb(permission === "fullscreen" || permission === "pointerLock"));

  win = new BrowserWindow({
    width: 1600,
    height: 900,
    backgroundColor: "#000000",
    title: "Bonk Turbo",
    autoHideMenuBar: true,
    fullscreen: store.get().startFullscreen,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      partition: PARTITION,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      // o jogo roda num iframe (gameframe-release.html): o preload precisa entrar nele
      nodeIntegrationInSubFrames: true,
      spellcheck: false,
    },
  });
  win.setMenu(null);
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
  if (process.env.BONK_TURBO_DEBUG === "1") {
    // BONK_TURBO_DEBUG=1: mostra no terminal se o patch ficou ativo
    wc.on("did-finish-load", () =>
      setTimeout(async () => {
        const frame = wc.mainFrame.framesInSubtree.find((f) => f.url.includes("gameframe"));
        const probe = `JSON.stringify({ patches: window.__btPatches, painel: !!document.getElementById("bt-panel") })`;
        console.log("[debug] jogo", frame ? await frame.executeJavaScript(probe).catch((err) => String(err)) : "(sem gameframe)");
      }, 12000)
    );
  }
  win.on("closed", () => (win = null));
  void win.loadURL(GAME_URL);
}

// só a página do bonk.io (e o iframe do jogo) falam com o launcher
const fromBonk = (e) => e.sender === win?.webContents && e.senderFrame?.origin === "https://bonk.io";

// a abertura aparece só uma vez por execução do app (e.returnValue só aceita escrita: ler devolve undefined)
let splashShown = false;
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

app.on("second-instance", () => {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.focus();
});
app.whenReady().then(createWindow);
app.on("window-all-closed", () => app.quit());
