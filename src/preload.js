"use strict";
// Roda na página do bonk.io e no iframe do jogo (gameframe). Frames de outras origens (anúncios etc.) não recebem nada.
const { contextBridge, ipcRenderer } = require("electron");

const isBonk = location.origin === "https://bonk.io";
const isOuter = isBonk && window === window.top;

if (isBonk) {
  contextBridge.exposeInMainWorld("bonkTurbo", {
    setSettings: (patch) => ipcRenderer.invoke("settings:set", patch),
    onSettings: (cb) => {
      if (typeof cb === "function") ipcRenderer.on("settings:changed", (_e, s) => cb(s));
    },
    onTogglePanel: (cb) => {
      if (typeof cb === "function") ipcRenderer.on("panel:toggle", () => cb());
    },
  });
}

// Abertura: só na primeira página depois de abrir o app (não em F5 nem ao entrar por convite).
if (isOuter && ipcRenderer.sendSync("splash:take")) showSplash();

function showSplash() {
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;inset:0;z-index:2147483647;";
  const root = host.attachShadow({ mode: "closed" });
  root.innerHTML = `
<style>
  .s { position:absolute; inset:0; display:grid; place-items:center; background:radial-gradient(circle at 50% 45%, #1d1830 0%, #0a090e 70%);
    font-family:"Segoe UI", system-ui, sans-serif; transition:opacity .6s ease; }
  .s.out { opacity:0; }
  .box { display:grid; justify-items:center; gap:14px; }
  .stage { position:relative; width:220px; height:120px; }
  .floor { position:absolute; left:20px; right:20px; bottom:8px; height:6px; border-radius:3px; background:#7c4dff; transform:scaleX(0);
    animation:floor .5s .1s cubic-bezier(.2,.8,.2,1) forwards; }
  .ball { position:absolute; left:calc(50% - 22px); bottom:14px; width:44px; height:44px; border-radius:50%;
    background:radial-gradient(circle at 35% 30%, #fff 0 12%, #ff6b6b 13% 100%); box-shadow:0 0 24px #ff6b6b66;
    animation:drop 1.1s .25s cubic-bezier(.3,0,.7,1) both; }
  .shadow { position:absolute; left:calc(50% - 26px); bottom:4px; width:52px; height:10px; border-radius:50%; background:#0008;
    animation:shadow 1.1s .25s cubic-bezier(.3,0,.7,1) both; }
  h1 { margin:0; font-size:46px; font-weight:800; letter-spacing:.04em; color:transparent;
    background:linear-gradient(90deg, #ece9f2 0%, #ece9f2 40%, #b388ff 50%, #ece9f2 60%, #ece9f2 100%) 0 0 / 300% 100%;
    -webkit-background-clip:text; background-clip:text; opacity:0; transform:translateY(10px);
    animation:rise .5s 1.1s ease-out forwards, shine 1.4s 1.4s ease-in-out forwards; }
  p { margin:0; font-size:15px; letter-spacing:.2em; color:#9d97aa; opacity:0;
    animation:rise .5s 1.5s ease-out forwards; }
  @keyframes floor { to { transform:scaleX(1); } }
  @keyframes drop {
    0% { transform:translateY(-140px) scale(1,1); }
    45% { transform:translateY(0) scale(1.15,.82); }
    62% { transform:translateY(-48px) scale(.95,1.05); }
    80% { transform:translateY(0) scale(1.08,.9); }
    90% { transform:translateY(-12px) scale(1,1); }
    100% { transform:translateY(0) scale(1,1); }
  }
  @keyframes shadow { 0% { transform:scale(.3); opacity:.2; } 45%,80%,100% { transform:scale(1); opacity:1; } 62% { transform:scale(.6); opacity:.5; } }
  @keyframes rise { to { opacity:1; transform:none; } }
  @keyframes shine { from { background-position:100% 0; } to { background-position:0 0; } }
</style>
<div class="s"><div class="box">
  <div class="stage"><div class="floor"></div><div class="shadow"></div><div class="ball"></div></div>
  <h1>BONK TURBO</h1>
  <p>By me p</p>
</div></div>`;
  // o preload roda antes de existir o <html>: monta assim que o parser criar o elemento
  const mount = () => document.documentElement.appendChild(host);
  if (document.documentElement) mount();
  else
    new MutationObserver((_m, obs) => {
      if (!document.documentElement) return;
      obs.disconnect();
      mount();
    }).observe(document, { childList: true });

  // fica no mínimo 2,6 s e sai quando a página terminou de carregar (ou em 8 s, o que vier primeiro)
  const minimum = new Promise((r) => setTimeout(r, 2600));
  const loaded = new Promise((r) => (document.readyState === "complete" ? r() : window.addEventListener("load", r, { once: true })));
  const limit = new Promise((r) => setTimeout(r, 8000));
  void Promise.race([Promise.all([minimum, loaded]), limit]).then(() => {
    root.querySelector(".s").classList.add("out");
    setTimeout(() => host.remove(), 700);
  });
}
