// ==UserScript==
// @name         biggg
// @version      18
// @match        https://bonk.io/gameframe-release.html*
// @run-at       document-start
// @grant        none
// ==/UserScript==
(function () {
  // valores padrão da física (o host pode mudar pelo Menu Host)
  const LX = +(1 - 0.7 / 30.455).toFixed(4); // largura que faz o gol contar só com a bola inteira
  // valores com que toda sala começa (iguais ao Bonk); o host muda pelo Menu Host
  const PADRAO = { k: 1, lx: 1, inteira: 0, gol: 6.5, trave: 1, rede: 0, bate: 1, tam: 1, chute: 1, jog: 1, conta: 1, vel: 1, peso: 1, parede: 1, boneco: 1, iner: 1, atrito: 1, sniper: 0, acel: 1, tempo: 0, ouro: 1, penalti: 0, pencob: 5 };
  // valores originais do Bonk (botão "Padrão")
  const BONK = { k: 1, lx: 1, inteira: 0, gol: 6.5, trave: 1, rede: 0, bate: 1, tam: 1, chute: 1, jog: 1, conta: 1, vel: 1, peso: 1, parede: 1, boneco: 1, iner: 1, atrito: 1, sniper: 0, acel: 1, tempo: 0, ouro: 1, penalti: 0, pencob: 5 };
  // modos prontos (botão "Modos"); mude à vontade
  const MODOS = {
    "1v1": { jog: 1, conta: 1, vel: 1, peso: 1, parede: 1, boneco: 1, iner: 1, atrito: 1, sniper: 0, acel: 1, tempo: 0, ouro: 1, penalti: 0, pencob: 5, k: 1, lx: 1, inteira: 1, gol: 6, trave: 0.75, rede: 2.5, bate: 0.5, tam: 0.93, chute: 1.075 },
    "2v2": { ...BONK },
    "3v3": { jog: 1, conta: 1, vel: 1, peso: 1, parede: 1, boneco: 1, iner: 1, atrito: 1, sniper: 0, acel: 1, tempo: 0, ouro: 1, penalti: 0, pencob: 5, k: 1.2, lx: 1, inteira: 1, gol: 7, trave: 0.75, rede: 2.5, bate: 0.5, tam: 0.93, chute: 1.075 },
    "4v4": { jog: 1, conta: 1, vel: 1, peso: 1, parede: 1, boneco: 1, iner: 1, atrito: 1, sniper: 0, acel: 1, tempo: 0, ouro: 1, penalti: 0, pencob: 5, k: 1.35, lx: 1, inteira: 1, gol: 7.5, trave: 0.75, rede: 2.5, bate: 0.5, tam: 0.93, chute: 1.1 },
    "Big": { k: 1.15, lx: 1, inteira: 1, gol: 6.5, trave: 0.9, rede: 2.5, bate: 0.25, tam: 1.07, chute: 0.9, jog: 1.2, conta: 1, vel: 0.9, peso: 0.8, parede: 0.9, boneco: 0.88, iner: 1.1, atrito: 1, sniper: 0, acel: 1, tempo: 0, ouro: 1, penalti: 0, pencob: 5 },
    "Sniper": { ...BONK, chute: 1.975, sniper: 1 },
    "Iceball": { k: 0.9, lx: 1, inteira: 1, gol: 5, trave: 0.44, rede: 2.5, bate: 0, tam: 0.99, chute: 1.1, jog: 1, conta: 1, vel: 0.86, peso: 5, parede: 0.87, boneco: 0.22, iner: 1.1, atrito: 0.8, sniper: 0, acel: 1, tempo: 0, ouro: 1, penalti: 0, pencob: 5 },
    "Pênalti": { ...BONK, penalti: 1, rede: 1.5, bate: 0.3, tam: 0.9, peso: 1, chute: 1.25, atrito: 0.8, parede: 1, boneco: 0.1 },
    "Haxball 3v3": { ...BONK, k: 1.6, lx: 1.6, inteira: 1, gol: 8, trave: 1, rede: 2.5, bate: 0.5, chute: 1.15 },
    "Haxball 4v4": { ...BONK, k: 1.9, lx: 1.9, inteira: 1, gol: 9, trave: 1, rede: 2.5, bate: 0.5, chute: 1.2, vel: 1.05 },
    "Futsal": { k: 0.9, lx: 1, inteira: 1, gol: 5, trave: 0.44, rede: 2.5, bate: 0.04, tam: 0.69, chute: 0.89, jog: 1, conta: 1, vel: 0.86, peso: 0.2, parede: 0.86, boneco: 0.1, iner: 1.1, atrito: 1, sniper: 0, acel: 1, tempo: 0, ouro: 1, penalti: 0, pencob: 5 },
  };
  const VERSAO = 18; // suba este número quando mudar o formato do pacote
  const PLACAR = 0.85;
  const PLACAR_Y = 3;
  const HOST_PADRAO = "leomessi_1"; // usado só se o host não for detectado no lobby
  const NOME_MAX = 16;
  const MAX_ROUNDS = 1e9;
  const LOGO_URL = "https://i.imgur.com/Lo48c2m.jpg";
  const IMGBB_CHAVE = ""; // cole aqui a chave da API do ImgBB entre as aspas; vale para todos que usarem este script
  const LOGO_ALPHA = 0.2;
  const LOGO_ESCALA = 0.078;
  const ICONE = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAyCAYAAAAeP4ixAAAACXBIWXMAAAsTAAALEwEAmpwYAAAFCklEQVR4nO2aW4hWVRTHj5dPo5mmbNKiKTMzLyNhETOaQg8FPRT40E2CAqPe6sFISMyCsItZ42XsqctLEgU9dIEoku5kL00GFlh0H0uCIB0nZ3LUXyz9b9ocz9n7nPOdKaf8wzAf31p7XfY5a+211v6S5CT+BwAeBw5zPEaAlclYAdBPPj5LxgKANuAIMARM8L4/Td8PAxOTEx3AorydB34Qbe6/Y11y1IgLgHuAqRG+22XsCxm010W7KSJjKrACOL8O233BFwO7ZcSvwHUB3ifEd38G7VHRHgqsvxr4WXwWa7PqcmKW58Re/bd3fQMwOcXbAN4Vz/UZsm4R7U0/fkSbpE0w2YZ9njMX1enE+wrYVcBBffc50AnMBJ4CfvOy03E7abHh0ffI8A5gDtDnpejVShofNu0McF7KiRaP1gV8LdqQlBsOAe8BtwXk3gl84u28ZbFBff4WWOjxtqac6ajiiAvaA8CZGXRT8px49gPrgLNLJo8tcsTwvD2FDL522WBYXsWRFuArCXgywLfAlJVW8Pf6Dv8ppAH0yIZd/ltRCsDligcrN65K/mEAV0r3SMjZosIe1I7sznrFRgvAGcCP0r2mDoETge0S+HItVhbT+6J0fpxO1c2mYRdwl9UiNKxviZdEZtYpeI5S6wAwpQD/fGAj8IVS66A+23fzC6yfrtg8UCYTFnHkGe3Q2gjfJKVUczoPRus13oisp8X/cF1OnKJy4WAozcqJbd4huQnoVhq3v4XAZu/c2BZyBpgtPgv48VUMPx24Qiew1VMfSeBbkXX2JAw/AZdEzh3XePVGZO4Q39vAeh3S3VkHp79oXaCzs3LixkhMHNKTyHUi5cyw1nQG+O4KvKK2YY9lLXI99h/ApyoZrEBcasEXMcyC2LAx5oS3xuLEsKFAC3GDtQVKyTu0YYbDWQscSuds4Eut7SqxxmLGsLPi2XYUWUSHcRUEW743tJZYY0WnYaCCvnHO2LodGajgiPUbhn2j5UhbE69Wd4UhRZVXqy3kyIiXoazBedUOQBsUxLozL9g3lzDGpeueCN9cYBnwCPAa8J3XlI1kLVhpIxzvwPJhC28ukH5t7YICTlwK/Fkg/d5NNoZl672xjNDp7cI7BQ9El077Q87ICddCbyp4IL7hvR3zKg34VKLsVYlyVoCv4ZUow3JskbJTq6qFLXoSiLcxaiVKMwWc6q3eSNE4ojqsUVDn2qQuaHfKlvFWp+3UGbNfn3tCMeFgE0avjJ+W1AUZ5sqCaC1Vg77F0mV9zOy6hE7WIM7wbC1Ci+ndKp19sd6lqEB7nw3f2KSxFiuL6W31hoDrmxV2jc6Q5scx1fR3KVbMhmurCpmm+azhvoiy3LRccEC3OEBfLRt+iV1p5AmwuxDD7zmjzCneyGZQ94bnlJA/Q4NvV0m8lJURVVe5W4AVVRyZ7nWMH/iVre4w+r1GzB9i28D71oDcOzKG2K4N6DfZqTgx3a4jrHbxY8Viypl2nQWum9wungt1ELprBTNyRs58zGGP+vBzJcMNAd3dS3vKiabvSHxn3FliAbgm47Km4SlfmiHLaiU3TEivnQA84N29DNV20ZO6Avhegq3EXxLgtd00rMqgWeEXLDs4ljx21X71lsouy4FTI3w2RjJszaC9ItqyiIwWjX7KX+yMQnnRl0GzpsgwLznRwbEB3xFls/Fj9gcDBq9xGrs/4fCmlnk/qslvT08i+e/gLx6eFfRUEBkkAAAAAElFTkSuQmCC";

  const GAP = 4;
  const RAIO = 0.7;
  const ESP = 0.45;
  const BOLA_R = 0.7;
  const BOLA_PX = BOLA_R * 11;
  let KX = PADRAO.lx;
  let XW = 30.455 * KX;
  let INTEIRA = !!PADRAO.inteira;
  const linhaGol = () => XW + (INTEIRA ? BOLA_R * TAM : 0);
  window.__bkJog = PADRAO.jog;
  window.__bkConta = true;
  let VEL = 1, PESO = 1, PAREDE = 1, BONECO = 1, ATRITO = 1;
  // Sniper: posições (fração da meia-altura interna do campo) tiradas do mapa do Haxball
  let SNIPER = false;
  const SN_MEIO = 0.207, SN_D = 0.585, SN_R = 0.822;
  const meiaAltura = () => 15.909 * K;
  window.__bkIner = 1;
  // inércia: menos atrito e menos força na mesma proporção -> mesma velocidade máxima, mas acelera/freia mais devagar
  window.__bkVel = () => (football ? VEL / window.__bkIner : 1);
  // com largura 1 e sem "bola inteira", devolve o valor original do Bonk (idêntico, para jogar junto com quem não tem o script)
  window.__bkGolL = (orig) => !window.__bkConta ? -Infinity : (KX === 1 && !INTEIRA && orig !== undefined ? orig : 365 / 11 - linhaGol());
  window.__bkGolR = (orig) => !window.__bkConta ? Infinity : (KX === 1 && !INTEIRA && orig !== undefined ? orig : 365 / 11 + linhaGol());
  const CHAT = "#ingamechatcontent, #newbonklobby_chat_content";
  const IDS = ["newbonklobby_playerbox_leftelementcontainer", "newbonklobby_playerbox_rightelementcontainer", "newbonklobby_specbox_elementcontainer"];
  const LOBBY_LISTAS = IDS.map(id => "#" + id + " > *").join(", ");

  const minhaCfg = { ...PADRAO };     // o que eu uso quando sou host
  let cfg = { ...PADRAO };            // o que está valendo na física agora
  let pendenteCfg = null;             // config recebida durante uma partida
  let K = cfg.k, GOL = cfg.gol, TRAVE = cfg.trave, REDE = cfg.rede, BATE = cfg.bate, TAM = cfg.tam, CHUTE = cfg.chute;
  let resetCaixas = () => {};
  window.__bkTam = TAM;

  // distância só com Math.sqrt: exata e igual em qualquer navegador (Math.hypot não é garantido e pode dessincronizar)
  const dist2 = (x, y) => Math.sqrt(x * x + y * y);
  const near = (v, ...ns) => ns.some(n => Math.abs(v - n) < 0.01);
  const compY = (y) => 250 + (y - 250) / K;
  const placares = new Set();
  const nomes = {};
  const meus = {};
  const logos = {};      // links das logos em uso (recebidos do host)
  const meusLogos = {};  // links que eu (host) escolhi
  const LOGO_RE = /^https:\/\/(i\.ibb\.co\/[A-Za-z0-9]+\/[A-Za-z0-9._-]+|i\.imgur\.com\/[A-Za-z0-9]+)\.(png|jpe?g|gif|webp)$/;
  const vistos = new WeakSet();
  let football = false;
  let pendente = 0;
  let ultimoEnvio = 0;
  let timerEnvio = null;
  let qtd = 0;
  let deb = null;
  let socket = null;
  let sockChat = null;
  let sujo = true;

  // ---------- patches compartilhados no alpha2s.js ----------
  const PATCHES = window.__bkPatches = window.__bkPatches || [];
  PATCHES.push(
    [/(Math\[[\w$]+\[\d+\]\[201\]\]\(Math\[[\w$]+\[\d+\]\[200\]\]\(1,[\w$]+\[\d+\]\[\d+\]\[[\w$]+\[\d+\]\[567\]\]\),)9\)/g, "$1" + MAX_ROUNDS + ")"],
    [/(< )(\(([\w$]+\[0\]\[0\])\[[\w$]+\[\d+\]\[1506\]\] \+ \3\[[\w$]+\[\d+\]\[1507\]\]\) \/ \3\[[\w$]+\[\d+\]\[46\]\])/g, "$1(window.__bkGolL ? window.__bkGolL($2) : $2)"],
    [/(> )(\(730 - ([\w$]+\[0\]\[0\])\[[\w$]+\[\d+\]\[1506\]\] - \3\[[\w$]+\[\d+\]\[1507\]\]\) \/ \3\[[\w$]+\[\d+\]\[46\]\])/g, "$1(window.__bkGolR ? window.__bkGolR($2) : $2)"],
    [/([\w$]+)\[6\]=\1\[0\]\[0\];/, "$1[6]=window.__bkNet=$1[0][0];"],
    [/(this\[([\w$]+)\[8\]\[\d+\]\]=\2\[0\]\[0\];this\[\2\[8\]\[195\]\]=)1;/g, "$1(window.__bkJog||1);"],
    // pênaltis: o script ajusta o estado/entradas antes de cada passo da física do Football
    [/(B\[([\w$]+)\[5\]\[129\]\]\[\2\[5\]\[128\]\]=function\([^)]*\)\{var ([\w$]+)=\[arguments\];)/,
      "$1if(window.__bkCfgEstado)window.__bkCfgEstado($3[0][0]);if(window.__bkRedePre)window.__bkRedePre($3[0][0]);if(window.__bkPausa){var __pz=window.__bkPausa($3[0][0]);if(__pz)return __pz;}if(window.__bkPenalti){var __bp=window.__bkPenalti($3[0][0],$3[0][1]);if(__bp){$3[0][0]=__bp[0];$3[0][1]=__bp[1];}}"],
    // pênaltis: depois do passo, a bola volta para a marca enquanto ninguém chutou (encostar/carregar não move)
    [/(\]\(\);\}\}([\w$]+)\[5\]\[\2\[3\]\[395\]\]\(\);)return (\2\[71\]);\};/,
      "$1return window.__bkPenaltiPos?window.__bkPenaltiPos($3):$3;};"],
    // número do quadro de cada passo da física (para a pausa valer no mesmo quadro para todos)
    [/([\w$]+)\[25\]\[([\w$]+\[\d+\])\[128\]\]\(\1\[4\]\[(\1\[6\]|[\w$]+\[\d+\])\]/g, "$1[25][$2[128]]($1[4][(window.__bkF=$3)]"],
    // área onde o boneco pode andar: acompanha o tamanho do campo (no Bonk é fixa em 730x500)
    [/clampToPitch\(\) \{var ([\w$]+)=\[arguments\];[\s\S]*?\}\}(?=output\(\) \{)/,
      "clampToPitch() {var L=window.__bkLim||{x0:0,x1:730,y0:0,y1:500},p=this.body.GetPosition(),v=this.body.GetLinearVelocity(),r=this.radius,m=this.ppm;" +
      "if(p.x<L.x0/m+r){p.x=L.x0/m+r;v.x=0;}if(p.x>L.x1/m-r){p.x=L.x1/m-r;v.x=0;}if(p.y<L.y0/m+r){p.y=L.y0/m+r;v.y=0;}if(p.y>L.y1/m-r){p.y=L.y1/m-r;v.y=0;}}"],
    // lista de jogadores da sala (nome por id), para a ordem dos pênaltis
    [/([\w$]+)\[82\]=\[\];\1\[42\]=Infinity;/, "$&window.__bkSala=function(){return $1[82];};"],
    // placar inicial: o host mexe no estado inicial antes de mandar para a sala (vale até para quem não tem o script)
    [/(([\w$]+)\[5\]\[\2\[4\]\[332\]\]=0;)/, "$1if(window.__bkPlacarInicial)window.__bkPlacarInicial($2[5]);"],
    // fim da partida por tempo: antes da checagem de vitória do Bonk, a cada quadro
    [/(([\w$]+)\[72\]-=k7V\.[\w$]+\(([\w$]+)\[7\],1000\);)(if\(\2\[4\]\[\2\[6\]\]\[\3\[9\]\[4\]\] == 0\)\{)(?=[\s\S]{0,2500}?([\w$]+)\(k7V\.[\w$]+\(2268\)\))/,
      "$1if(window.__bkFimTempo&&window.__bkFimTempo($2[4][$2[6]],$2[6],$2[4])){$5(\"gameComplete\");return;}$4"],
    [/(\[7\]=32\.0)(;)/g, "$1*(window.__bkVel ? window.__bkVel() : 1)$2"],
    [/(\[[\w$]+\[\d+\]\[207\]\]=)2\.4;/, "$1(2.4/(window.__bkIner||1));"],
    [/totalRadius:1\}/g, "totalRadius:(window.__bkJog||1)}"],
    [/< 0\.7 \+ (this\[[\w$]+\[\d+\]\[\d+\]\]) \+ 0\.6\)/g, "< 0.7 * (window.__bkTam || 1) + $1 + 0.6)"],
    [/(\[9\]=parseInt\()([\w$]+\[0\]\[0\]\[[\w$]+\[1\]\[742\]\])(\);k7V\.[\w$]+\(\d+\);[\w$]+\[3\]=k7V\.Q5\$\([\w$]+\[9\],0\))/g, "$1(this&&this.value!=null?this.value:$2)$3"]
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

  // ---------- configuração da física ----------
  const fmt = (c) => [c.k, c.gol, c.trave, c.rede, c.bate, c.tam, c.chute, c.lx, c.inteira, c.jog, c.conta, c.vel, c.peso, c.parede, c.boneco, c.iner, c.atrito, c.sniper, c.acel, c.tempo, c.ouro, c.penalti, c.pencob].join(",");
  const parseCfg = (s) => {
    const v = String(s || "").split(",").map(Number);
    if (v.length < 7 || v.some(isNaN)) return null;
    return { k: v[0], gol: v[1], trave: v[2], rede: v[3], bate: v[4], tam: v[5], chute: v[6], lx: v.length > 7 ? v[7] : LX, inteira: v.length > 8 ? v[8] : 0, jog: v.length > 9 ? v[9] : 1, conta: v.length > 10 ? v[10] : 1, vel: v.length > 11 ? v[11] : 1, peso: v.length > 12 ? v[12] : 1, parede: v.length > 13 ? v[13] : 1, boneco: v.length > 14 ? v[14] : 1, iner: v.length > 15 ? v[15] : 1, atrito: v.length > 16 ? v[16] : 1, sniper: v.length > 17 ? v[17] : 0, acel: v.length > 18 ? v[18] : 1, tempo: v.length > 19 ? v[19] : 0, ouro: v.length > 20 ? v[20] : 1, penalti: v.length > 21 ? v[21] : 0, pencob: v.length > 22 ? v[22] : 5 };
  };
  const noLobby = () => {
    const l = document.getElementById("newbonklobby");
    return !!(l && l.offsetParent !== null && getComputedStyle(l).display !== "none");
  };
  const aplicaCfg = (c) => {
    cfg = { ...c };
    if (cfg.conta === 0 && !(cfg.rede >= 1)) cfg.rede = 1;
    ({ k: K, gol: GOL, trave: TRAVE, rede: REDE, bate: BATE, tam: TAM, chute: CHUTE } = cfg);
    KX = cfg.lx || 1;
    XW = 30.455 * KX;
    INTEIRA = !!cfg.inteira;
    window.__bkJog = cfg.jog || 1;
    window.__bkConta = cfg.conta !== 0;
    VEL = cfg.vel || 1;
    PESO = cfg.peso > 0 ? cfg.peso : 1;
    PAREDE = cfg.parede >= 0 ? cfg.parede : 1;
    BONECO = cfg.boneco >= 0 ? cfg.boneco : 1;
    // aceleração e inércia mexem na mesma coisa (força e atrito do boneco na mesma proporção): uma é o inverso da outra
    window.__bkIner = (cfg.iner > 0 ? cfg.iner : 1) / (cfg.acel > 0 ? cfg.acel : 1);
    ATRITO = cfg.atrito >= 0 ? cfg.atrito : 1;
    SNIPER = cfg.sniper === 1;
    if (SNIPER) {
      GOL = SN_MEIO * meiaAltura(); // gol do meio usa as traves originais do Bonk
      REDE = 0;                     // sem rede: o gol conta ao passar da linha
    }
    if (cfg.penalti === 1) {
      window.__bkConta = false;      // os gols da disputa são contados pelo script, não pelo Bonk
      REDE = Math.max(REDE || 0, 1.5); // rede segura a bola
      SNIPER = false;
    }
    window.__bkTam = TAM;
    window.__bkCampo = { kx: KX, k: K, rede: REDE }; // tamanho do campo, para o bonk-tela enquadrar
    // a mesma folga do Bonk em volta das linhas (30 dos lados, 75 em cima/embaixo); nunca menor que a área original
    const mx = Math.max(365, 335 * KX + 30), my = Math.max(250, 175 * K + 75);
    window.__bkLim = mx === 365 && my === 250 ? null : { x0: 365 - mx, x1: 365 + mx, y0: 250 - my, y1: 250 + my };
    resetCaixas();
  };
  const recebeCfg = (c) => {
    if (!c) return;
    if (noLobby()) { aplicaCfg(c); pendenteCfg = null; }
    else pendenteCfg = c;
  };
  setInterval(() => { if (pendenteCfg && noLobby()) { aplicaCfg(pendenteCfg); pendenteCfg = null; } }, 500);

  // ---------- quem é o host ----------
  const souHost = () => {
    const n = window.__bkNet;
    if (n && typeof n.getLSID === "function") {
      try { return n.hostID == n.getLSID(); } catch (e) {}
    }
    const r = document.getElementById("newbonklobby_roundsinput");
    return !!(r && !r.disabled);
  };
  // o Bonk põe o ícone em todos; só o host tem host_1..5.png (os outros ficam com host_0.png)
  let hostChat = null; // último host anunciado no chat do Bonk
  const nomeHost = () => {
    if (hostChat) return hostChat;
    for (const img of document.querySelectorAll(".newbonklobby_playerentry_host")) {
      if (/host_0\.png/.test(img.getAttribute("src") || "")) continue;
      const e = img.closest(".newbonklobby_playerentry");
      const n = e && e.querySelector('[class*="name"]');
      if (n && n.textContent.trim()) return n.textContent.trim();
    }
    return HOST_PADRAO;
  };
  const doHost = (autor) => autor.trim().toLowerCase() === nomeHost().toLowerCase();

  // ---------- tempo de partida ----------
  // Tudo é calculado a partir do número do quadro e do placar do estado do jogo, então dá o mesmo resultado
  // para todos que têm o script. Pausas: 121 quadros de saída no começo e 212 por gol (91 de comemoração + 121 de saída).
  const SAIDA = 121, PAUSA_GOL = 212;
  let acrescimo = 0;              // segundos, definido pelo host com /acrescimo
  let baseGols = 0;               // gols que já vieram no placar inicial (não contam como pausa no relógio)
  const placarIni = [0, 0];       // escolhido pelo host no menu, usado na próxima partida (vermelho, azul)
  let ultimoQuadro = -1;
  const relogio = { ativo: false, resta: 0, ouro: false, acr: 0, pausado: false };
  const golsDe = (st) => { let g = 0; for (const v of st.scores || []) if (v > 0) g += v; return g; };
  const placarDif = (st) => ((st.scores || [])[2] || 0) !== ((st.scores || [])[3] || 0); // Football: 2 = vermelho, 3 = azul
  const jogado = (st, f) => {
    const G = Math.max(0, golsDe(st) - baseGols);
    let q;
    if (st.fte >= 0) q = f - (90 - st.fte) - SAIDA - (G - 1) * PAUSA_GOL;
    else if (st.ftu >= 0) q = G ? f - 91 - (120 - st.ftu) - SAIDA - (G - 1) * PAUSA_GOL : 0;
    else q = f - SAIDA - G * PAUSA_GOL;
    return Math.max(0, q);
  };
  // As configurações da partida vão DENTRO do estado inicial que o host manda no Start (posições 50+ do placar,
  // negativas). Cada passo da física usa o que está no estado: todos jogam exatamente com a mesma configuração,
  // mesmo que a mensagem do chat tenha chegado atrasada para alguém. (Só grava quando algo difere do Bonk.)
  const SLOT_CFG = 50;
  const CHAVES_CFG = ["k", "gol", "trave", "rede", "bate", "tam", "chute", "lx", "inteira", "jog", "conta", "vel", "peso", "parede", "boneco", "iner", "atrito", "sniper", "acel", "tempo", "ouro", "penalti", "pencob"];
  const gravaCfgNoEstado = (st, c) => {
    if (fmt(c) === fmt(BONK)) return;
    while (st.scores.length < SLOT_CFG + CHAVES_CFG.length) st.scores.push(null);
    CHAVES_CFG.forEach((k, i) => { st.scores[SLOT_CFG + i] = -(Math.round((+c[k] || 0) * 1000) + 1); });
  };
  let cfgEstadoAtual = "";
  window.__bkCfgEstado = (st) => {
    try {
      const sc = st && st.scores;
      if (!sc) return;
      // sem configuração no estado = o host começou com tudo no padrão do Bonk (ou não tem o biggg): todos usam o padrão
      const temCfg = typeof sc[SLOT_CFG] === "number" && sc[SLOT_CFG] < 0;
      const cod = temCfg ? sc.slice(SLOT_CFG, SLOT_CFG + CHAVES_CFG.length).join(",") : "BONK";
      if (cod === cfgEstadoAtual) return;
      cfgEstadoAtual = cod;
      const c = {};
      if (temCfg) CHAVES_CFG.forEach((k, i) => { const v = sc[SLOT_CFG + i]; c[k] = typeof v === "number" && v < 0 ? (-v - 1) / 1000 : PADRAO[k]; });
      else Object.assign(c, BONK);
      if (fmt(c) !== fmt(cfg)) aplicaCfg(c);
    } catch (e) {}
  };
  window.__bkPlacarInicial = (st) => {
    try {
      if (!souHost() || !st || !st.scores) return;
      cfgEstadoAtual = "";
      gravaCfgNoEstado(st, pendenteCfg || cfg);
      const [a, b] = placarIni;
      if (!a && !b) return;
      st.scores[2] = a; st.scores[3] = b;
      baseGols = golsDe(st);
      placarIni[0] = placarIni[1] = 0; // vale só para esta partida
      setTimeout(() => { enviar("⚽ Partida começando com placar " + a + " x " + b); ultimoEnvio = 0; sincroniza(1); }, 300);
    } catch (e) {}
  };
  // ---------- detector de dessincronização (/sync on) ----------
  // A cada ~5 s, cada jogador manda um "resumo" (hash) do estado de ~3 s atrás. Se o de alguém for diferente do seu,
  // a partida dessincronizou ali: o aviso diz o quadro e o que estava diferente, para achar a causa.
  let syncOn = false, historico = null;
  const meusHash = new Map();      // quadro -> hash
  const resumoDe = new Map();      // quadro -> texto curto (para mostrar a diferença)
  const outrosHash = [];           // pendentes: [autor, quadro, hash]
  const ultimoAvisoSync = new Map();
  const hashEstado = (st) => {
    const nums = [];
    const add = (v) => nums.push(typeof v === "number" ? v.toPrecision(10) : String(v));
    if (st.ball) { add(st.ball.x); add(st.ball.y); add(st.ball.xv); add(st.ball.yv); }
    (st.discs || []).forEach((d, i) => { if (d) { add(i); add(d.x); add(d.y); add(d.xv); add(d.yv); add(d.kickReady); } });
    (st.scores || []).forEach(add);
    add(st.ftu); add(st.fte);
    const txt = nums.join("|");
    let h = 5381;
    for (let i = 0; i < txt.length; i++) h = ((h << 5) + h + txt.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  };
  const confereSync = () => {
    for (let i = outrosHash.length - 1; i >= 0; i--) {
      const [autor, q, h] = outrosHash[i];
      if (!meusHash.has(q)) continue;
      outrosHash.splice(i, 1);
      if (meusHash.get(q) === h) continue;
      const k = autor.toLowerCase();
      if (Date.now() - (ultimoAvisoSync.get(k) || 0) < 20000) continue;
      ultimoAvisoSync.set(k, Date.now());
      avisoChat("⚠ DESSINCRONIZOU com " + autor + " no quadro " + q + " (" + (q / 30).toFixed(1) + " s de partida). Meu estado: " + (resumoDe.get(q) || "?") + ". Mande um print disto.", null);
    }
  };
  window.__bkFimTempo = (st, f, hist) => {
    window.__bkEstado = st; // estado atual da partida (o bonk-tela usa para a câmera seguir)
    if (syncOn && hist && f % 150 === 0 && f >= 120) {
      try {
        const q = f - 90, sq = hist[q];
        if (sq) {
          const h = hashEstado(sq);
          meusHash.set(q, h);
          const b = sq.ball || {};
          resumoDe.set(q, "bola " + (+b.x).toFixed(2) + "," + (+b.y).toFixed(2) + " placar " + ((sq.scores || [])[2] || 0) + "x" + ((sq.scores || [])[3] || 0));
          for (const k of meusHash.keys()) if (k < q - 3000) { meusHash.delete(k); resumoDe.delete(k); }
          enviar("[TH]" + q + ":" + h);
          confereSync();
        }
      } catch (e) {}
    }
    try {
      if (f < ultimoQuadro - 30) { acrescimo = 0; pausas.length = 0; } // começou outra partida
      relogio.pausado = pausadoEm(f);
      if ((f < ultimoQuadro - 30 || ultimoQuadro < 0) && f < 200 && st && st.scores) baseGols = golsDe(st);
      ultimoQuadro = f;
      if (cfg.penalti === 1 && football && st && st.scores && st.ball) {
        penInfo.ativo = true;
        penInfo.texto = textoPen(st);
        relogio.ativo = false;
        const P = lePen(st.scores);
        return P.fase === PF.FIM && P.t >= 75;
      }
      penInfo.ativo = false;
      const T = cfg.tempo > 0 ? cfg.tempo : 0;
      if (!football || !T || !st || !st.scores || !st.ball) { relogio.ativo = false; return false; }
      const limite = Math.round((T * 60 + acrescimo) * 30);
      const q = jogado(st, f - quadrosPausados(f));
      const acabou = q >= limite;
      relogio.ativo = true;
      relogio.resta = Math.max(0, limite - q) / 30;
      relogio.acr = acrescimo;
      relogio.ouro = acabou && !placarDif(st) && cfg.ouro !== 0;
      if (!acabou) return false;
      const rolando = st.fte === -1 && st.ftu === -1;
      if (placarDif(st)) return rolando || st.fte === 0;      // alguém na frente: fim (depois da comemoração, se teve gol)
      if (cfg.ouro === 0) return rolando;                     // empate aceito
      return false;                                           // gol de ouro: segue até alguém marcar
    } catch (e) { return false; }
  };

  // ---------- pausa (/p) ----------
  // O host marca "pausa do quadro A até o quadro B" (B vazio = ainda pausado). O quadro escolhido fica ~0,7 s
  // à frente, para a mensagem chegar a todos antes. Durante a pausa, cada passo da física devolve o mesmo estado.
  const pausas = [];               // [[inicio, fim], ...]  fim = Infinity enquanto pausado
  const MARGEM_PAUSA = 20;
  const pausadoEm = (f) => pausas.some(([a, b]) => f >= a && f < b);
  const quadrosPausados = (f) => { let n = 0; for (const [a, b] of pausas) if (f > a) n += Math.min(f, b) - a; return n; };
  window.__bkPausa = (st) => {
    try {
      const f = window.__bkF;
      if (!pausas.length || typeof f !== "number" || !pausadoEm(f) || !st) return null;
      return Object.assign(Object.create(Object.getPrototypeOf(st)), st);
    } catch (e) { return null; }
  };
  const encPausas = () => pausas.map(([a, b]) => a + "-" + (b === Infinity ? "" : b)).join(",");
  const decPausas = (txt) => {
    pausas.length = 0;
    for (const p of String(txt || "").split(",")) {
      const m = p.match(/^(\d+)-(\d*)$/);
      if (m) pausas.push([+m[1], m[2] ? +m[2] : Infinity]);
    }
  };

  // ---------- disputa de pênaltis ----------
  // O progresso fica guardado no próprio placar do estado do jogo (posições 4..9, em números negativos, que o
  // Bonk ignora na checagem de vitória). Assim todos que têm o script calculam a mesma coisa, quadro a quadro.
  const pen = { ordem: { 2: [], 3: [] }, gol: { 2: -1, 3: -1 } }; // definido pelo host (ids dos jogadores)
  const penInfo = { ativo: false, texto: "" };
  const PF = { PREP: 0, VIVO: 1, CHUTOU: 2, RES: 3, FIM: 9 };
  const lePen = (sc) => {
    const g = (i, p) => (typeof sc[i] === "number" && sc[i] < 0 ? -sc[i] - 1 : p);
    return { n: g(4, 0), t: g(5, 0), fase: g(6, 0), res: g(7, 0), hR: g(8, 0), hB: g(9, 0) };
  };
  const gravaPen = (sc, P) => {
    while (sc.length < 10) sc.push(null);
    sc[4] = -(P.n + 1); sc[5] = -(P.t + 1); sc[6] = -(P.fase + 1); sc[7] = -(P.res + 1); sc[8] = -(P.hR + 1); sc[9] = -(P.hB + 1);
  };
  const nomeId = (id) => { try { const s = window.__bkSala && window.__bkSala(); return (s && s[id] && s[id].userName) || ("#" + id); } catch (e) { return "#" + id; } };
  const listaDo = (st, time) => {
    const ok = (id) => st.discs[id] && st.discs[id].team === time;
    let l = (pen.ordem[time] || []).filter(ok);
    if (!l.length) l = st.discs.map((d, i) => (d && d.team === time ? i : -1)).filter(i => i >= 0);
    return l;
  };
  const goleiroDo = (st, time) => {
    const g = pen.gol[time];
    if (g >= 0 && st.discs[g] && st.discs[g].team === time) return g;
    const l = listaDo(st, time);
    return l.length ? l[0] : -1;
  };
  const decidido = (P, gR, gB) => {
    const N = cfg.pencob > 0 ? Math.round(cfg.pencob) : 5;
    const feitas = P.n + 1, kR = Math.ceil(feitas / 2), kB = Math.floor(feitas / 2);
    if (kR <= N && kB <= N && feitas < 2 * N) return gR > gB + (N - kB) || gB > gR + (N - kR);
    return feitas % 2 === 0 && gR !== gB; // depois das N de cada: alternadas até alguém errar
  };
  const neutro = (i) => {
    if (!i || typeof i !== "object") return i;
    const o = {};
    for (const k in i) o[k] = typeof i[k] === "boolean" ? false : i[k];
    return o;
  };
  window.__bkPenalti = (st, inp) => {
    try {
      if (!(cfg.penalti === 1) || !st || !st.ball || !st.discs || !st.scores || st.fte >= 0) return null;
      const cx = 365 / 11, cy = 250 / 11, H = 15.909 * K;
      const linha = cx + XW, spot = linha - 0.33 * XW;
      const s = Object.assign(Object.create(Object.getPrototypeOf(st)), st);
      s.scores = st.scores.slice();
      s.ball = Object.assign({}, st.ball);
      s.discs = st.discs.map(d => (d ? Object.assign(Object.create(Object.getPrototypeOf(d)), d) : d));
      const ent = Array.isArray(inp) ? inp.slice() : inp;
      const P = lePen(s.scores);
      const kt = P.n % 2 === 0 ? 2 : 3, dt = kt === 2 ? 3 : 2;
      const lk = listaDo(s, kt);
      const batedor = lk.length ? lk[Math.floor(P.n / 2) % lk.length] : -1;
      const goleiro = goleiroDo(s, dt);
      const R = BOLA_R * TAM;
      const pos = (i, x, y) => { const d = s.discs[i]; if (!d) return; d.x = x; d.y = y; d.xv = 0; d.yv = 0; if (ent && ent[i]) ent[i] = neutro(ent[i]); };
      const para = (i) => { const d = s.discs[i]; if (!d) return; d.xv = 0; d.yv = 0; if (ent && ent[i]) ent[i] = neutro(ent[i]); };
      // quem não está na cobrança fica parado na metade esquerda, junto às laterais
      let k = 0;
      s.discs.forEach((d, i) => {
        if (!d || i === batedor || i === goleiro) return;
        const col = Math.floor(k / 2), lado = k % 2 ? 1 : -1; k++;
        pos(i, cx - XW + 3 + col * 2.6, cy + lado * (H - 1.4));
      });
      const arruma = () => {
        s.ball.x = spot; s.ball.y = cy; s.ball.xv = 0; s.ball.yv = 0;
        if (batedor >= 0) pos(batedor, spot - 2.4, cy);
        if (goleiro >= 0) pos(goleiro, linha - 1.3, cy);
      };
      if (st.ftu >= 0) { arruma(); gravaPen(s.scores, P); return [s, ent]; }
      const b = s.ball, vb = dist2(b.xv || 0, b.yv || 0);
      // goleiro preso na pequena área
      if (goleiro >= 0 && s.discs[goleiro]) {
        const g = s.discs[goleiro];
        if (g.x < linha - 4) { g.x = linha - 4; if (g.xv < 0) g.xv = 0; }
        const ym = GOL + 2;
        if (g.y < cy - ym) { g.y = cy - ym; if (g.yv < 0) g.yv = 0; }
        if (g.y > cy + ym) { g.y = cy + ym; if (g.yv > 0) g.yv = 0; }
      }
      const fimCobranca = (gol) => {
        const idx = Math.floor(P.n / 2);
        if (gol) {
          s.scores[kt] = (s.scores[kt] || 0) + 1;
          if (idx < 25) { if (kt === 2) P.hR |= (1 << idx); else P.hB |= (1 << idx); }
        }
        P.res = gol ? 1 : 2; P.fase = PF.RES; P.t = 0;
      };
      if (P.fase === PF.PREP) {
        arruma();
        if (++P.t >= 30) { P.fase = PF.VIVO; P.t = 0; }
      } else if (P.fase === PF.VIVO || P.fase === PF.CHUTOU) {
        P.t++;
        if (P.fase === PF.VIVO) {
          // a bola só sai da marca com chute de verdade: tecla de chute + chute pronto + bola ao alcance
          b.x = spot; b.y = cy; b.xv = 0; b.yv = 0;
          const d = batedor >= 0 && s.discs[batedor];
          const e = d && ent && ent[batedor];
          const alcance = 0.7 * TAM + (window.__bkJog || 1) + 0.6;
          const chuta = e && e.action && d.kickReady !== false && dist2(d.x - b.x, d.y - b.y) < alcance;
          if (batedor < 0) fimCobranca(false);
          else if (chuta) { P.fase = PF.CHUTOU; P.t = 0; }
          else if (P.t > 30 * 7) fimCobranca(false); // 7 s sem bater: perdeu
        } else {
          para(batedor); // depois de bater, o batedor não pode pegar o rebote
          if (b.x - R > linha) fimCobranca(true);
          else if (b.x < spot - 4 || P.t > 30 * 5 || (vb < 0.4 && P.t > 15)) fimCobranca(false);
        }
      } else if (P.fase === PF.RES) {
        s.discs.forEach((d, i) => d && para(i));
        if (++P.t >= 45) {
          if (decidido(P, s.scores[2] || 0, s.scores[3] || 0)) { P.fase = PF.FIM; P.t = 0; }
          else { P.n++; P.fase = PF.PREP; P.t = 0; P.res = 0; arruma(); }
        }
      } else if (P.fase === PF.FIM) {
        s.discs.forEach((d, i) => d && para(i));
        P.t++;
      }
      gravaPen(s.scores, P);
      return [s, ent];
    } catch (e) { return null; }
  };
  window.__bkPenaltiPos = (st) => {
    try { if (window.__bkRedePos) window.__bkRedePos(st); } catch (e) {}
    try {
      if (!(cfg.penalti === 1) || !st || !st.ball || !st.scores) return st;
      const P = lePen(st.scores);
      if (P.fase === PF.PREP || P.fase === PF.VIVO) {
        st.ball.x = 365 / 11 + XW - 0.33 * XW; st.ball.y = 250 / 11; st.ball.xv = 0; st.ball.yv = 0;
      }
    } catch (e) {}
    return st;
  };
  const textoPen = (st) => {
    const P = lePen(st.scores);
    const marca = (h, kicks) => { let o = ""; for (let i = 0; i < kicks; i++) o += (h >> i) & 1 ? "●" : "✕"; return o; };
    const feitas = P.n + (P.fase >= PF.RES ? 1 : 0);
    const kR = Math.ceil(feitas / 2), kB = Math.floor(feitas / 2);
    let t = "PÊNALTIS  " + (marca(P.hR, Math.min(kR, 25)) || "-") + "  x  " + (marca(P.hB, Math.min(kB, 25)) || "-");
    if (P.fase === PF.FIM) t += "  • FIM";
    else {
      const kt = P.n % 2 === 0 ? 2 : 3;
      const lk = listaDo(st, kt);
      const bat = lk.length ? lk[Math.floor(P.n / 2) % lk.length] : -1;
      t += "  • " + (P.fase === PF.RES ? (P.res === 1 ? "GOL!" : "Perdeu!") : "Bate: " + nomeId(bat));
    }
    return t;
  };
  // ordem enviada pelo host: "r3.7.1;b2.5;g4,6"
  const encPen = () => "r" + pen.ordem[2].join(".") + ";b" + pen.ordem[3].join(".") + ";g" + pen.gol[2] + "," + pen.gol[3];
  const decPen = (txt) => {
    const m = String(txt || "").match(/^r([\d.]*);b([\d.]*);g(-?\d+),(-?\d+)$/);
    if (!m) return;
    const ids = (x) => (x ? x.split(".").map(Number).filter(n => n >= 0) : []);
    pen.ordem[2] = ids(m[1]); pen.ordem[3] = ids(m[2]);
    pen.gol[2] = +m[3]; pen.gol[3] = +m[4];
  };

  // ---------- quem tem o biggg ----------
  const temScript = new Map();   // nome (minúsculo) -> versão, de quem respondeu "[TB]"
  const jaAvisados = new Set();  // nomes já anunciados no chat como sem script
  let respondiA = null;          // para qual host eu já respondi
  let timerChecagem = null;
  const nomesNosTimes = () => {
    const out = [];
    for (const id of ["newbonklobby_playerbox_leftelementcontainer", "newbonklobby_playerbox_rightelementcontainer"]) {
      for (const e of document.querySelectorAll("#" + id + " .newbonklobby_playerentry")) {
        const n = e.querySelector('[class*="name"]');
        const t = n && n.textContent.trim();
        if (t) out.push(t);
      }
    }
    return out;
  };

  // ---------- rede / chat ----------
  const resetSala = () => {
    Object.assign(minhaCfg, PADRAO);
    pendenteCfg = null;
    aplicaCfg({ ...PADRAO });
    for (const o of [meus, nomes, meusLogos, logos]) for (const k in o) delete o[k];
    pendente = 0;
    hostChat = null;
    temScript.clear(); jaAvisados.clear(); respondiA = null; temTela.clear(); jaAvisadosTela.clear();
    acrescimo = 0; pausas.length = 0; baseGols = 0; placarIni[0] = placarIni[1] = 0;
    if (typeof avisados !== "undefined") { avisados.clear(); ultimaRecebida = null; }
  };

  const wsSend = WebSocket.prototype.send;
  WebSocket.prototype.send = function (d) {
    if (typeof d === "string" && d.startsWith("42[") && !this.__bkFecha) {
      this.__bkFecha = true;
      this.addEventListener("close", resetSala);
    }
    if (typeof d === "string" && d.startsWith("42[12,")) resetSala();
    if (typeof d === "string") {
      if (d.startsWith("42[10,")) sockChat = this;
      if (d.startsWith("42[")) socket = this;
    }
    return wsSend.call(this, d);
  };

  const enviar = (txt) => {
    const s = [sockChat, socket].find(x => x && x.readyState === 1);
    if (!s) return false;
    wsSend.call(s, '42[10,{"message":' + JSON.stringify(txt) + "}]");
    return true;
  };
  // logos vão encurtadas no mesmo pacote: "b<id>/<arq>" = i.ibb.co, "i<arq>" = i.imgur.com
  const encLogo = (u) => {
    if (!u || !LOGO_RE.test(u)) return "";
    if (u.startsWith("https://i.ibb.co/")) return "b" + u.slice(17);
    if (u.startsWith("https://i.imgur.com/")) return "i" + u.slice(20);
    return "";
  };
  const decLogo = (c) => {
    c = (c || "").trim();
    const u = c[0] === "b" ? "https://i.ibb.co/" + c.slice(1) : c[0] === "i" ? "https://i.imgur.com/" + c.slice(1) : "";
    return LOGO_RE.test(u) ? u : "";
  };
  const pacote = () => "[TT]" + (meus[1] || "") + "|" + (meus[2] || "") + "|" + fmt(minhaCfg) +
    "|" + encLogo(meusLogos[1]) + "|" + encLogo(meusLogos[2]) + "|v" + VERSAO + "|a" + acrescimo + "|g" + baseGols + "|p" + encPen() + "|z" + encPausas();

  // campo maior que a tela original do Bonk (730x500): sem o bonk-tela, parte do campo fica fora da tela
  const campoGrande = (c) => (c.lx || 1) > 1.09 || (c.k || 1) > 1.43;
  const temTela = new Set();      // quem respondeu que tem o bonk-tela
  const jaAvisadosTela = new Set();
  // o host confere, um tempo depois de mandar as configurações, quem respondeu que tem o biggg
  const checaScripts = () => {
    if (!souHost()) return;
    const eu = nomeHost().toLowerCase();
    const sem = [], velhos = [];
    for (const n of nomesNosTimes()) {
      const k = n.toLowerCase();
      if (k === eu || jaAvisados.has(k)) continue;
      if (!temScript.has(k)) sem.push(n);
      else if (temScript.get(k) !== VERSAO) velhos.push(n + " (v" + temScript.get(k) + ")");
      else continue;
      jaAvisados.add(k);
    }
    const partes = [];
    if (sem.length) partes.push("sem o script biggg: " + sem.join(", "));
    if (velhos.length) partes.push("com outra versão do biggg (a do host é " + VERSAO + "): " + velhos.join(", "));
    if (partes.length) enviar("⚠ Jogadores " + partes.join(" | ") + ". Para eles o campo e a física ficam diferentes.");
    if (campoGrande(minhaCfg)) {
      const semTela = [];
      for (const n of nomesNosTimes()) {
        const k = n.toLowerCase();
        if (k === eu || !temScript.has(k) || temTela.has(k) || jaAvisadosTela.has(k)) continue;
        semTela.push(n); jaAvisadosTela.add(k);
      }
      if (semTela.length) setTimeout(() => enviar("⚠ Sem o script bonk-tela: " + semTela.join(", ") + ". Este campo é maior que a tela do Bonk; sem o bonk-tela eles não veem o campo inteiro."), partes.length ? 4500 : 0);
    }
  };
  const agendaChecagem = () => {
    clearTimeout(timerChecagem);
    timerChecagem = setTimeout(checaScripts, 10000);
  };

  const tentaEnviar = () => {
    if (!pendente) return;
    const espera = 4000 - (Date.now() - ultimoEnvio);
    if (espera <= 0 && enviar(pacote())) {
      pendente--;
      ultimoEnvio = Date.now();
      agendaChecagem();
    }
    if (pendente && !timerEnvio) {
      timerEnvio = setTimeout(() => { timerEnvio = null; tentaEnviar(); }, Math.max(espera, 1000));
    }
  };
  const sincroniza = (vezes) => {
    if (!souHost()) return;
    pendente = Math.max(pendente, vezes);
    tentaEnviar();
  };

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || !/^(ingamechatinputtext|newbonklobby_chat_input)$/.test(e.target.id)) return;
    const sy = e.target.value.trim().match(/^\/sync(?:\s+(on|off))?$/i);
    if (sy) {
      e.preventDefault();
      e.stopImmediatePropagation();
      e.target.value = "";
      if (sy[1]) syncOn = sy[1].toLowerCase() === "on";
      meusHash.clear(); resumoDe.clear(); outrosHash.length = 0;
      return avisoChat("Detector de dessincronização: " + (syncOn ? "LIGADO (precisa estar ligado em pelo menos 2 jogadores; manda uma mensagem escondida a cada 5 s)" : "desligado") + ". Use /sync on ou /sync off.");
    }
    if (/^\/p$/i.test(e.target.value.trim())) {
      e.preventDefault();
      e.stopImmediatePropagation();
      e.target.value = "";
      if (!souHost()) return avisoChat("Só o host pode pausar a partida.");
      if (noLobby() || ultimoQuadro < 0) return avisoChat("Não há partida rolando para pausar.");
      const alvo = ultimoQuadro + MARGEM_PAUSA;
      const ultima = pausas[pausas.length - 1];
      if (ultima && ultima[1] === Infinity) {
        ultima[1] = Math.max(alvo, ultima[0] + 1);
        avisoChat("▶ Partida retomada (para todos com o biggg).");
      } else {
        pausas.push([alvo, Infinity]);
        avisoChat("⏸ Partida pausada para todos com o biggg. Digite /p de novo para voltar.");
      }
      // manda já (sem esperar a fila), porque o quadro da pausa precisa chegar antes de acontecer
      enviar(pacote());
      ultimoEnvio = Date.now();
      return;
    }
    const ac = e.target.value.trim().match(/^\/acr[eé]scimo(?:\s+(\+)?\s*([\d.,]+))?$/i);
    if (ac) {
      e.preventDefault();
      e.stopImmediatePropagation();
      e.target.value = "";
      if (!souHost()) return avisoChat("Só o host pode dar acréscimo.");
      if (!(cfg.tempo > 0)) return avisoChat("A partida não está com tempo. Defina o tempo no Menu Host (vale a partir da próxima partida).");
      if (ac[2] === undefined) return avisoChat("Acréscimo atual: " + fmtAcr(acrescimo) + ". Use /acrescimo 2 (define 2 min) ou /acrescimo +1 (soma 1 min).");
      const min = parseFloat(ac[2].replace(",", "."));
      if (isNaN(min) || min < 0) return avisoChat("Use /acrescimo 2 ou /acrescimo +1");
      acrescimo = Math.round((ac[1] ? acrescimo + min * 60 : min * 60));
      ultimoEnvio = 0;
      sincroniza(1);
      enviar("⏱ Acréscimo: " + fmtAcr(acrescimo));
      return;
    }
    const m = e.target.value.match(/^\/time([12])(?:\s+(.*))?$/i);
    if (!m) return;
    const nome = (m[2] || "").replace(/\|/g, "").trim().slice(0, NOME_MAX);
    if (nome) meus[m[1]] = nome; else delete meus[m[1]];
    e.target.value = "[T" + m[1] + "]" + nome;
  }, true);

  const fmtAcr = (seg) => {
    if (!seg) return "nenhum";
    const m = Math.floor(seg / 60), s = Math.round(seg % 60);
    return "+" + (s ? m + ":" + String(s).padStart(2, "0") : m + " min");
  };
  let ultimaRecebida = null;
  const avisados = new Set();
  const avisoChat = (txt, chave) => {
    if (chave) { if (avisados.has(chave)) return; avisados.add(chave); }
    for (const c of document.querySelectorAll(CHAT)) {
      const d = document.createElement("div");
      d.textContent = "* " + txt;
      d.style.color = "#888";
      vistos.add(d);
      c.appendChild(d);
      c.scrollTop = c.scrollHeight;
    }
  };

  const chat = new MutationObserver((muts) => {
    for (const mu of muts) {
      for (const n of mu.addedNodes) {
        const el = n.nodeType === 1 ? n : n.parentElement;
        if (!el || !el.closest || el.matches(CHAT) || !el.closest(CHAT)) continue;
        let linha = el;
        while (linha.parentElement && !linha.parentElement.matches(CHAT)) linha = linha.parentElement;
        if (vistos.has(linha)) continue;
        vistos.add(linha);
        const texto = linha.textContent.trim();
        const troca = texto.match(/^\*\s*(?:.+ has given host privileges to (.+), who is now the game host|.+ has left the game and (.+) is now the game host)\.?$/);
        if (troca) {
          hostChat = (troca[1] || troca[2]).trim();
          continue;
        }
        if (/has joined the game/i.test(texto)) {
          sincroniza(2);
          continue;
        }
        const th = texto.match(/^(.*?):\s*\[TH\](\d+):([0-9a-z]+)\s*$/);
        if (th) {
          linha.remove();
          let eu = "";
          try { const sala = window.__bkSala && window.__bkSala(); const id = window.__bkNet && window.__bkNet.getLSID(); eu = (sala && sala[id] && sala[id].userName) || ""; } catch (e) {}
          if (syncOn && th[1].trim().toLowerCase() !== eu.toLowerCase()) { outrosHash.push([th[1].trim(), +th[2], th[3]]); if (outrosHash.length > 200) outrosHash.shift(); confereSync(); }
          continue;
        }
        const tb = texto.match(/^(.*?):\s*\[TB\](\d*)(t?)\s*$/);
        if (tb) {
          temScript.set(tb[1].trim().toLowerCase(), parseInt(tb[2], 10) || 0);
          if (tb[3]) temTela.add(tb[1].trim().toLowerCase()); else temTela.delete(tb[1].trim().toLowerCase());
          linha.remove();
          continue;
        }
        const tl = texto.match(/^(.*?):\s*\[TL\](.*)$/);
        if (tl) {
          if (doHost(tl[1])) {
            const [a, b] = tl[2].split("|").map(x => (x || "").trim());
            for (const [k, u] of [[1, a], [2, b]]) {
              if (LOGO_RE.test(u)) logos[k] = u; else delete logos[k];
            }
          }
          linha.remove();
          continue;
        }
        const sync = texto.match(/^(.*?):\s*\[TT\](.*)$/);
        const um = texto.match(/^(.*?):\s*\[T([12])\]\s*(.*)$/);
        if (!sync && !um) continue;
        if (sync && doHost(sync[1])) {
          const [a, b, c, g1, g2, ver, acr, bg, pp, zz] = sync[2].split("|");
          if (zz && zz[0] === "z" && !souHost()) {
            const antes = pausadoEm(ultimoQuadro);
            decPausas(zz.slice(1));
            const fim = pausas.length && pausas[pausas.length - 1];
            if (fim && fim[1] === Infinity && !antes) avisoChat("⏸ O host pausou a partida.");
            else if (antes && fim && fim[1] !== Infinity) avisoChat("▶ O host retomou a partida.");
          }
          if (pp && pp[0] === "p" && !souHost()) decPen(pp.slice(1));
          if (bg && bg[0] === "g" && !souHost()) baseGols = parseInt(bg.slice(1), 10) || 0;
          if (acr && acr[0] === "a") {
            const nv = parseFloat(acr.slice(1)) || 0;
            if (nv !== acrescimo && !souHost()) avisoChat("Acréscimo: " + fmtAcr(nv));
            acrescimo = nv;
          }
          if (!souHost()) {
            // responde ao host (uma vez por host) que eu tenho o biggg
            const h = sync[1].trim().toLowerCase();
            if (respondiA !== h) {
              respondiA = h;
              setTimeout(() => enviar("[TB]" + VERSAO + (window.__bkTelaInstalado ? "t" : "")), 1000 + Math.random() * 3000);
            }
            const vh = parseInt((ver || "").slice(1), 10) || 0;
            if (vh !== VERSAO) avisoChat(vh < VERSAO
              ? "O host usa uma versão mais antiga do biggg (" + (vh || "antiga") + "); a sua é " + VERSAO + ". Peça para ele atualizar — e conferir no Tampermonkey se não ficou uma cópia antiga do biggg ativada junto com a nova."
              : "O host usa o biggg versão " + vh + "; a sua é " + VERSAO + ". Atualize o seu script.", "ver" + vh);
            else if (c && c !== ultimaRecebida) avisoChat("Configurações do host recebidas" + (noLobby() ? " e aplicadas." : "; valem a partir do próximo lobby."));
            ultimaRecebida = c;
          }
          nomes[1] = (a || "").trim().slice(0, NOME_MAX);
          nomes[2] = (b || "").trim().slice(0, NOME_MAX);
          for (const [k, g] of [[1, g1], [2, g2]]) {
            const u = decLogo(g);
            if (u) logos[k] = u; else delete logos[k];
          }
          if (c) recebeCfg(parseCfg(c));
        } else if (um && doHost(um[1])) {
          nomes[um[2]] = um[3].trim().slice(0, NOME_MAX);
        }
        linha.remove();
      }
    }
  });

  const mudouLobby = () => {
    clearTimeout(deb);
    deb = setTimeout(() => {
      const n = document.querySelectorAll(LOBBY_LISTAS).length;
      if (n > qtd) sincroniza(2);
      qtd = n;
    }, 800);
  };

  // ---------- Menu Host ----------
  // [aba, rótulo, tipo ("num" ou "sw"), dica, passo]
  const CAMPOS = {
    tempo:   ["Partida", "Tempo (min)", "num", "Duração da partida em minutos, contando só com a bola em jogo. 0 = sem tempo. O host pode dar acréscimo com /acrescimo.", 1],
    ouro:    ["Partida", "Gol de ouro no empate", "sw", "Se o tempo acabar empatado, a partida continua até o próximo gol. Desligado: termina empatada.", 1],
    conta:   ["Partida", "Contar gols", "sw", "Desligado: a bola entra no gol mas não vale ponto (a rede fica no mínimo em 1 para a bola não sair).", 1],
    inteira: ["Partida", "Gol só com bola inteira", "sw", "O gol só vale quando a bola passa inteira da linha, como no futebol de verdade.", 1],
    sniper:  ["Partida", "Sniper", "sw", "3 gols de cada lado e cada time preso na sua metade do campo. A bola atravessa o meio.", 1],
    k:       ["Campo", "Altura do campo", "num", "Multiplica a altura do campo. 1 = Bonk.", 0.05],
    lx:      ["Campo", "Largura do campo", "num", "Multiplica a largura do campo. 1 = Bonk.", 0.05],
    gol:     ["Campo", "Abertura do gol", "num", "Metade da abertura do gol, em metros do jogo. Bonk = 6.5. (Ignorado no Sniper.)", 0.5],
    trave:   ["Campo", "Tamanho das traves", "num", "Multiplica o tamanho das traves. 1 = Bonk.", 0.05],
    rede:    ["Campo", "Profundidade da rede", "num", "Profundidade da rede atrás do gol. 0 = sem rede (Bonk).", 0.5],
    bate:    ["Campo", "Rebote na rede", "num", "Quanto a bola volta ao bater na rede. 1 = volta tudo, 0 = morre na rede.", 0.05],
    tam:     ["Bola", "Tamanho", "num", "Multiplica o tamanho da bola. 1 = Bonk.", 0.05],
    peso:    ["Bola", "Peso", "num", "Multiplica o peso da bola contra os jogadores. 1 = Bonk.", 0.05],
    chute:   ["Bola", "Força do chute", "num", "Multiplica a força do chute. 1 = Bonk.", 0.05],
    atrito:  ["Bola", "Atrito", "num", "1 = Bonk. Menos = rola mais; mais = para mais rápido.", 0.05],
    parede:  ["Bola", "Rebote nas paredes", "num", "1 = Bonk. Menos = amortece; mais = quica mais. 1.25 = quique sem perder velocidade.", 0.05],
    boneco:  ["Bola", "Rebote no jogador", "num", "1 = Bonk. Menos = amortece (mais fácil dominar); mais = espirra.", 0.05],
    penalti: ["Pênaltis", "Disputa de pênaltis", "sw", "A partida vira uma disputa de pênaltis: um batedor contra o goleiro do outro time, alternando vermelho e azul, na ordem abaixo. Os outros ficam parados na lateral.", 1],
    pencob:  ["Pênaltis", "Cobranças por time", "num", "Quantas cobranças cada time tem antes das alternadas (no futebol são 5). Se empatar, segue uma de cada até alguém errar.", 1],
    jog:     ["Jogadores", "Tamanho", "num", "Multiplica o tamanho dos jogadores. 1 = Bonk.", 0.05],
    vel:     ["Jogadores", "Velocidade", "num", "Multiplica a velocidade máxima. 1 = Bonk.", 0.05],
    acel:    ["Jogadores", "Aceleração", "num", "1 = Bonk. Mais = arranca e freia mais rápido. Não muda a velocidade máxima.", 0.05],
    iner:    ["Jogadores", "Inércia", "num", "1 = Bonk. Mais = desliza mais (gelo); menos = para rápido. É o inverso da aceleração.", 0.05],
  };
  const ABAS = ["Partida", "Campo", "Bola", "Jogadores", "Pênaltis", "Times"];

  function montaMenu() {
    const box = document.getElementById("newbonklobby_settingsbox");
    const label = document.getElementById("newbonklobby_roundslabel");
    const input = document.getElementById("newbonklobby_roundsinput");
    if (!box || !label || !input) return;
    input.removeAttribute("maxlength");
    const fonte = getComputedStyle(box).fontFamily;

    const st = document.createElement("style");
    st.textContent = `
      #bk_hostbtn{position:absolute;display:none;text-align:center;padding:0;white-space:nowrap;box-sizing:border-box;}
      #bk_fundo{position:fixed;inset:0;z-index:9999;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.45);}
      #bk_hostmenu{width:min(470px,94vw);max-height:92vh;display:flex;flex-direction:column;background:#cfd8dc;color:#263238;border-radius:7px;overflow:hidden;box-shadow:0 6px 24px rgba(0,0,0,.5);font-size:14px;}
      #bk_hostmenu *{box-sizing:border-box;}
      #bk_hostmenu .bk_top{background:#009688;color:#fff;text-align:center;font-size:20px;padding:7px;}
      #bk_hostmenu .bk_abas{display:flex;background:#b0bec5;}
      #bk_hostmenu .bk_aba{flex:1;text-align:center;padding:7px 0 6px;font-size:13px;cursor:pointer;color:#37474f;border-top:3px solid transparent;user-select:none;}
      #bk_hostmenu .bk_aba:hover{background:#c5d0d5;}
      #bk_hostmenu .bk_aba.on{background:#cfd8dc;font-weight:bold;color:#00796b;border-top-color:#009688;}
      #bk_hostmenu .bk_chips{display:flex;flex-wrap:wrap;gap:5px;padding:9px 12px 3px;}
      #bk_hostmenu .bk_chip{background:#795548;color:#fff;border-radius:12px;padding:3px 11px;font-size:12px;cursor:pointer;user-select:none;}
      #bk_hostmenu .bk_chip:hover{filter:brightness(1.15);}
      #bk_hostmenu .bk_chip.on{background:#009688;}
      #bk_hostmenu .bk_chip.bk_meu{background:#5d4037;border:1px dashed #d7ccc8;display:flex;align-items:center;gap:5px;}
      #bk_hostmenu .bk_chip.bk_meu.on{background:#009688;}
      #bk_hostmenu .bk_apaga{opacity:.75;font-size:11px;}
      #bk_hostmenu .bk_apaga:hover{opacity:1;color:#ffcdd2;}
      #bk_hostmenu .bk_chip.bk_novo{background:transparent;color:#00796b;border:1px dashed #00796b;}
      #bk_hostmenu{position:relative;}
      #bk_hostmenu .bk_criar{position:absolute;inset:0;z-index:10;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.4);}
      #bk_hostmenu .bk_criarcx{width:78%;background:#cfd8dc;border-radius:6px;padding:12px 14px;box-shadow:0 4px 16px rgba(0,0,0,.45);}
      #bk_hostmenu .bk_criartit{font-size:17px;font-weight:bold;color:#00796b;margin-bottom:4px;}
      #bk_hostmenu .bk_corpo{flex:1;overflow-y:auto;padding:4px 14px 8px;min-height:240px;}
      #bk_hostmenu .bk_pag{display:none;}
      #bk_hostmenu .bk_pag.on{display:block;}
      #bk_hostmenu .bk_linha{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 0;border-bottom:1px solid #b0bec5;min-height:36px;}
      #bk_hostmenu .bk_linha:last-child{border-bottom:0;}
      #bk_hostmenu .bk_lab{display:flex;align-items:center;gap:5px;}
      #bk_hostmenu .bk_q{position:relative;display:inline-block;width:15px;height:15px;border-radius:50%;background:#90a4ae;color:#fff;font-size:11px;text-align:center;line-height:15px;cursor:help;flex:none;}
      #bk_hostmenu .bk_q:hover::after{content:attr(data-dica);position:absolute;left:20px;top:-4px;width:230px;background:#263238;color:#fff;font-size:12px;line-height:1.35;text-align:left;padding:6px 8px;border-radius:4px;z-index:5;white-space:normal;box-shadow:0 2px 8px rgba(0,0,0,.4);}
      #bk_hostmenu .bk_val{display:flex;align-items:center;gap:5px;flex:none;}
      #bk_hostmenu .bk_step{width:23px;height:23px;background:#795548;color:#fff;border-radius:3px;text-align:center;line-height:23px;font-weight:bold;cursor:pointer;user-select:none;}
      #bk_hostmenu .bk_step:hover{filter:brightness(1.15);}
      #bk_hostmenu input{font-family:inherit;font-size:13px;color:#263238;background:#eceff1;border:1px solid #90a4ae;border-radius:3px;padding:3px 4px;outline:none;}
      #bk_hostmenu input:focus{border-color:#009688;}
      #bk_hostmenu input.bk_num{width:54px;text-align:center;}
      #bk_hostmenu input.bk_txt{width:150px;}
      #bk_hostmenu input::-webkit-outer-spin-button,#bk_hostmenu input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0;}
      #bk_hostmenu .bk_mud input.bk_num{color:#00796b;font-weight:bold;}
      #bk_hostmenu .bk_dot{width:7px;height:7px;border-radius:50%;background:#009688;visibility:hidden;}
      #bk_hostmenu .bk_mud .bk_dot{visibility:visible;}
      #bk_hostmenu .bk_sw{width:38px;height:20px;border-radius:10px;background:#90a4ae;position:relative;cursor:pointer;transition:background .15s;}
      #bk_hostmenu .bk_sw::after{content:"";position:absolute;width:16px;height:16px;border-radius:50%;background:#fff;top:2px;left:2px;transition:left .15s;}
      #bk_hostmenu .bk_sw.on{background:#009688;}
      #bk_hostmenu .bk_sw.on::after{left:20px;}
      #bk_hostmenu .bk_sw.trava{opacity:.5;cursor:not-allowed;}
      #bk_hostmenu .bk_mini{background:#795548;color:#fff;border-radius:3px;padding:0 7px;height:23px;line-height:23px;font-size:12px;cursor:pointer;user-select:none;}
      #bk_hostmenu .bk_prev{width:24px;height:24px;object-fit:contain;display:none;}
      #bk_hostmenu .bk_aviso{font-size:12px;color:#546e7a;margin-top:6px;min-height:14px;}
      #bk_hostmenu .bk_rodape{font-size:11px;color:#607d8b;text-align:center;padding:0 12px 6px;}
      #bk_hostmenu .bk_botoes{display:flex;gap:8px;padding:9px 12px;background:#b0bec5;}
      #bk_hostmenu .bk_btn{flex:1;background:#795548;color:#fff;text-align:center;padding:7px;border-radius:3px;font-size:15px;cursor:pointer;user-select:none;}
      #bk_hostmenu .bk_btn:hover{filter:brightness(1.15);}
      #bk_hostmenu .bk_btn.ok{background:#00796b;}
    `;
    document.head.appendChild(st);

    const btn = document.createElement("div");
    btn.id = "bk_hostbtn";
    btn.className = "newbonklobby_settings_button brownButton brownButton_classic buttonShadow";
    btn.title = "Menu Host";
    btn.style.backgroundImage = "url(" + ICONE + ")";
    btn.style.backgroundRepeat = "no-repeat";
    btn.style.backgroundPosition = "center";
    btn.style.backgroundSize = "60%";
    const modeMenu = document.getElementById("newbonklobby_mode_menu");
    if (modeMenu) box.insertBefore(btn, modeMenu); else box.appendChild(btn);

    const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };
    const fundo = el("div"); fundo.id = "bk_fundo";
    const menu = el("div"); menu.id = "bk_hostmenu";
    menu.style.fontFamily = fonte;
    fundo.appendChild(menu);
    menu.appendChild(el("div", "bk_top", "Menu Host"));

    // abas
    const barra = el("div", "bk_abas");
    const chips = el("div", "bk_chips");
    const corpo = el("div", "bk_corpo");
    const pags = {}, abasEl = {};
    let abaAtual = "Partida";
    try { abaAtual = localStorage.getItem("bkAba") || abaAtual; } catch (e) {}
    const mostraAba = (a) => {
      abaAtual = a;
      try { localStorage.setItem("bkAba", a); } catch (e) {}
      for (const n of ABAS) { abasEl[n].classList.toggle("on", n === a); pags[n].classList.toggle("on", n === a); }
    };
    for (const a of ABAS) {
      const t = el("div", "bk_aba", a);
      t.onclick = () => mostraAba(a);
      abasEl[a] = t; barra.appendChild(t);
      pags[a] = el("div", "bk_pag"); corpo.appendChild(pags[a]);
    }
    menu.append(barra, chips, corpo);

    const linha = (aba, rotulo, dica, valorEl) => {
      const l = el("div", "bk_linha");
      const lab = el("div", "bk_lab");
      lab.appendChild(el("span", "", rotulo));
      if (dica) { const q = el("span", "bk_q", "?"); q.dataset.dica = dica; lab.appendChild(q); }
      l.append(lab, valorEl);
      pags[aba].appendChild(l);
      return l;
    };
    const arred = (v) => Math.round(v * 1000) / 1000;

    // controles: número com − e +, ou interruptor
    const fis = {};
    let atualizaRodape = () => {};
    const atualizaMarcas = () => {
      atualizaRodape();
      for (const k in fis) fis[k].marca();
      for (const [nome, c] of Object.entries(chipsEl)) c.classList.toggle("on", Object.keys(fis).every(k => +MODOS[nome][k] === +fis[k].value));
      for (const [nome, c] of Object.entries(chipsMeus)) { const m = meusModos[nome]; c.classList.toggle("on", !!m && Object.keys(m).every(k => fis[k] && +m[k] === +fis[k].value)); }
    };
    const ctlNum = (key, passo, minimo) => {
      const val = el("div", "bk_val");
      const dot = el("span", "bk_dot");
      const menos = el("div", "bk_step", "−"), mais = el("div", "bk_step", "+");
      const i = el("input", "bk_num"); i.type = "number"; i.step = "any";
      val.append(dot, menos, i, mais);
      const c = {
        min: minimo,
        get value() { return i.value; },
        set value(v) { i.value = v; c.marca(); },
        marca() { val.classList.toggle("bk_mud", BONK[key] !== undefined && parseFloat(i.value) !== BONK[key]); },
        el: val,
      };
      const soma = (d) => {
        let v = arred((parseFloat(i.value) || 0) + d);
        if (v < (c.min || 0)) v = c.min || 0;
        i.value = v; atualizaMarcas(); travaRede();
      };
      menos.onclick = () => soma(-passo);
      mais.onclick = () => soma(passo);
      i.addEventListener("input", atualizaMarcas);
      i.addEventListener("change", () => { travaRede(); atualizaMarcas(); });
      return c;
    };
    const ctlSw = (key) => {
      const sw = el("div", "bk_sw");
      let v = 0;
      const c = {
        trava: false,
        get value() { return String(v); },
        set value(x) { v = +x ? 1 : 0; sw.classList.toggle("on", !!v); },
        marca() {},
        el: sw,
      };
      sw.onclick = () => { if (c.trava) return; c.value = v ? 0 : 1; travaRede(); atualizaMarcas(); };
      return c;
    };

    // --- Partida ---
    const rounds = ctlNum("__rounds", 1, 1);
    rounds.marca = () => {};
    linha("Partida", "Rounds para vencer", "Quantos gols um time precisa para vencer. Para jogar só por tempo, coloque um número alto.", rounds.el);
    const pi1 = ctlNum("__pi1", 1, 0), pi2 = ctlNum("__pi2", 1, 0);
    pi1.marca = pi2.marca = () => {};
    const piWrap = el("div", "bk_val");
    const xis = el("span", "", "x"); xis.style.margin = "0 2px";
    piWrap.append(pi1.el, xis, pi2.el);
    linha("Partida", "Placar inicial", "A próxima partida começa com esse placar (time 1 x time 2). Vale para todos, até quem não tem o script. Depois de usado, volta para 0 x 0.", piWrap);
    for (const key in CAMPOS) {
      const [aba, rot, tipo, dica, passo] = CAMPOS[key];
      const c = tipo === "sw" ? ctlSw(key) : ctlNum(key, passo, 0);
      fis[key] = c;
      linha(aba, rot, dica, c.el);
    }
    // sem contar gols, a rede não pode ficar abaixo de 1 (a bola sairia do campo)
    const REDE_MIN = 1;
    function travaRede() {
      const semGol = parseFloat(fis.conta.value) === 0;
      fis.rede.min = semGol ? REDE_MIN : 0;
      if (semGol && !(parseFloat(fis.rede.value) >= REDE_MIN)) fis.rede.value = REDE_MIN;
    }

    // --- Pênaltis: ordem dos batedores e goleiro de cada time ---
    const caixaOrdem = el("div");
    pags["Pênaltis"].appendChild(caixaOrdem);
    const desenhaOrdem = () => {
      caixaOrdem.textContent = "";
      let sala = [];
      try { sala = (window.__bkSala && window.__bkSala()) || []; } catch (e) {}
      for (const [time, nomeT, cor] of [[2, nomes[1] || "Vermelho", "#e53935"], [3, nomes[2] || "Azul", "#1e88e5"]]) {
        const presentes = [];
        sala.forEach((j, id) => { if (j && j.team === time) presentes.push(id); });
        // mantém a ordem já escolhida e põe quem chegou no fim
        pen.ordem[time] = pen.ordem[time].filter(id => presentes.includes(id)).concat(presentes.filter(id => !pen.ordem[time].includes(id)));
        if (!presentes.includes(pen.gol[time])) pen.gol[time] = presentes.length ? pen.ordem[time][0] : -1;
        const tit = el("div", "bk_lab", nomeT);
        tit.style.cssText = "margin:10px 0 2px;font-weight:bold;color:" + cor;
        caixaOrdem.appendChild(tit);
        if (!presentes.length) { caixaOrdem.appendChild(el("div", "bk_aviso", "Ninguém neste time.")); continue; }
        pen.ordem[time].forEach((id, pos) => {
          const l = el("div", "bk_linha");
          const lab = el("div", "bk_lab", (pos + 1) + ". " + ((sala[id] && sala[id].userName) || "#" + id));
          const val = el("div", "bk_val");
          const mv = (d) => {
            const o = pen.ordem[time], q = pos + d;
            if (q < 0 || q >= o.length) return;
            [o[pos], o[q]] = [o[q], o[pos]];
            desenhaOrdem();
          };
          const up = el("div", "bk_step", "▲"), dn = el("div", "bk_step", "▼");
          up.title = "Bate antes"; dn.title = "Bate depois";
          up.onclick = () => mv(-1); dn.onclick = () => mv(1);
          const gk = el("div", "bk_mini", pen.gol[time] === id ? "Goleiro ✓" : "Goleiro");
          gk.style.background = pen.gol[time] === id ? "#00796b" : "";
          gk.title = "Defende os pênaltis do outro time";
          gk.onclick = () => { pen.gol[time] = id; desenhaOrdem(); };
          val.append(gk, up, dn);
          l.append(lab, val);
          caixaOrdem.appendChild(l);
        });
      }
      caixaOrdem.appendChild(el("div", "bk_aviso", "Os times se alternam: 1º do vermelho, 1º do azul, 2º do vermelho... O goleiro também pode bater. Ligue a disputa, aplique no lobby e dê Start."));
    };
    abasEl["Pênaltis"].addEventListener("click", desenhaOrdem);

    // --- Times ---
    const txt = (ph) => { const i = el("input", "bk_txt"); i.type = "text"; i.placeholder = ph || ""; return i; };
    const t1 = txt("Time 1"), t2 = txt("Time 2");
    t1.maxLength = t2.maxLength = NOME_MAX;
    const statusLogo = el("div", "bk_aviso");
    const ACEITA = ".png,.jpg,.jpeg,.gif,.webp,image/png,image/jpeg,image/gif,image/webp";
    let idMem = "";
    try { idMem = localStorage.getItem("bkImgbbKey") || ""; } catch (e) {}
    const lerId = () => idMem || IMGBB_CHAVE;
    const sobeImgur = async (file) => {
      const id = lerId();
      if (!id) throw new Error("Cole a chave da API do ImgBB primeiro");
      if (!/^image\/(png|jpeg|gif|webp)$/.test(file.type)) throw new Error("Use .png, .jpg, .gif ou .webp");
      const bmp = await createImageBitmap(file);
      const esc = Math.min(1, 128 / Math.max(bmp.width, bmp.height));
      const cv = document.createElement("canvas");
      cv.width = Math.max(1, Math.round(bmp.width * esc));
      cv.height = Math.max(1, Math.round(bmp.height * esc));
      cv.getContext("2d").drawImage(bmp, 0, 0, cv.width, cv.height);
      const blob = await new Promise(res => cv.toBlob(res, "image/png"));
      const fd = new FormData();
      fd.append("image", blob, "logo.png");
      const resp = await fetch("https://api.imgbb.com/1/upload?key=" + encodeURIComponent(id), { method: "POST", body: fd });
      const j = await resp.json().catch(() => ({}));
      const url = j && j.data && (j.data.image && j.data.image.url || j.data.url);
      if (!resp.ok || !url) throw new Error("O ImgBB recusou o envio" + (j && j.error && j.error.message ? ": " + j.error.message : ""));
      const final = url.replace(/^http:/, "https:");
      if (!LOGO_RE.test(final)) throw new Error("Link inesperado do ImgBB: " + final);
      return final;
    };
    const linhaLogo = (k) => {
      const wrap = el("div", "bk_val");
      const prev = el("img", "bk_prev");
      const url = txt("link da imagem");
      url.style.width = "118px"; url.style.fontSize = "11px";
      const arq = el("input"); arq.type = "file"; arq.accept = ACEITA; arq.style.display = "none";
      // a prévia carrega do mesmo jeito que o jogo (crossOrigin); se falhar aqui, falha na partida também
      prev.crossOrigin = "anonymous";
      prev.onerror = () => {
        if (!url.value.trim()) return;
        prev.style.display = "none";
        statusLogo.textContent = "A logo do time " + k + " não carregou do jeito que o jogo precisa. Envie de novo pelo botão PC.";
      };
      const mostra = () => {
        const u = url.value.trim();
        const ok = LOGO_RE.test(u);
        prev.style.display = ok ? "block" : "none";
        if (ok) prev.src = u;
        else if (u) statusLogo.textContent = "Link da logo do time " + k + " não aceito. Use o botão PC ou um link direto i.ibb.co / i.imgur.com.";
      };
      url.addEventListener("input", mostra);
      arq.onchange = async () => {
        const f = arq.files && arq.files[0];
        arq.value = "";
        if (!f) return;
        statusLogo.textContent = "Enviando logo do time " + k + " ao ImgBB...";
        try {
          url.value = await sobeImgur(f);
          mostra();
          statusLogo.textContent = "Logo do time " + k + " pronta. Clique em Aplicar.";
        } catch (e) {
          statusLogo.textContent = String(e.message || e);
        }
      };
      const pc = el("div", "bk_mini", "PC"); pc.title = "Enviar imagem do computador"; pc.onclick = () => arq.click();
      const x = el("div", "bk_mini", "X"); x.title = "Tirar logo"; x.onclick = () => { url.value = ""; mostra(); };
      wrap.append(prev, url, pc, x, arq);
      return { url, mostra, wrap };
    };
    linha("Times", "Nome do time 1", "Aparece no placar no lugar de \"Red\".", t1);
    const lg1 = linhaLogo(1);
    linha("Times", "Logo do time 1", "Imagem ao lado do nome no placar. Use PC para enviar do computador.", lg1.wrap);
    linha("Times", "Nome do time 2", "Aparece no placar no lugar de \"Blue\".", t2);
    const lg2 = linhaLogo(2);
    linha("Times", "Logo do time 2", "Imagem ao lado do nome no placar. Use PC para enviar do computador.", lg2.wrap);
    const idImgur = txt("chave da API");
    idImgur.value = lerId();
    idImgur.style.fontSize = "11px";
    idImgur.addEventListener("input", () => {
      idMem = idImgur.value.trim();
      try { localStorage.setItem("bkImgbbKey", idMem); } catch (e) {}
    });
    linha("Times", "Chave do ImgBB", "Necessária para enviar logos pelo botão PC. Pegue em api.imgbb.com (Get API key).", idImgur);
    pags.Times.appendChild(statusLogo);

    // modos (botões no topo): os prontos + os criados por este jogador (salvos só neste navegador)
    const chipsEl = {}, chipsMeus = {};
    const ABAS_MODO = ["Campo", "Bola", "Jogadores"]; // só essas abas entram num modo criado
    let meusModos = {};
    try { meusModos = JSON.parse(localStorage.getItem("bkMeusModos") || "{}") || {}; } catch (e) { meusModos = {}; }
    const salvaModos = () => { try { localStorage.setItem("bkMeusModos", JSON.stringify(meusModos)); } catch (e) {} };
    const montaChips = () => {
      chips.textContent = "";
      for (const k in chipsMeus) delete chipsMeus[k];
      for (const nome in MODOS) {
        const c = el("div", "bk_chip", nome);
        c.onclick = () => { for (const key in fis) fis[key].value = MODOS[nome][key]; travaRede(); atualizaMarcas(); };
        chipsEl[nome] = c; chips.appendChild(c);
      }
      for (const nome in meusModos) {
        const c = el("div", "bk_chip bk_meu");
        c.appendChild(el("span", "", nome));
        const x = el("span", "bk_apaga", "×");
        x.title = "Apagar este modo";
        x.onclick = (e) => {
          e.stopPropagation();
          if (x.dataset.conf !== "1") { x.dataset.conf = "1"; x.textContent = "apagar?"; setTimeout(() => { x.dataset.conf = ""; x.textContent = "×"; }, 2500); return; }
          delete meusModos[nome]; salvaModos(); montaChips(); atualizaMarcas();
        };
        c.appendChild(x);
        c.title = "Modo criado por você";
        c.onclick = () => { const m = meusModos[nome]; for (const key in m) if (fis[key]) fis[key].value = m[key]; travaRede(); atualizaMarcas(); };
        chipsMeus[nome] = c; chips.appendChild(c);
      }
      const novo = el("div", "bk_chip bk_novo", "+ Novo modo");
      novo.title = "Criar um modo com as configurações de Campo, Bola e Jogadores que estão no menu";
      novo.onclick = abreCriar;
      chips.appendChild(novo);
    };

    // janela para dar nome ao modo novo
    const criar = el("div", "bk_criar");
    const cx = el("div", "bk_criarcx");
    cx.appendChild(el("div", "bk_criartit", "Novo modo"));
    cx.appendChild(el("div", "bk_aviso", "Salva as configurações de Campo, Bola e Jogadores que estão no menu agora. Só você vê esse modo."));
    const nomeModo = el("input", "bk_txt"); nomeModo.type = "text"; nomeModo.maxLength = 20; nomeModo.placeholder = "Nome do modo";
    nomeModo.style.width = "100%"; nomeModo.style.margin = "8px 0 4px"; nomeModo.style.fontSize = "15px";
    const avisoNome = el("div", "bk_aviso", "");
    const bxs = el("div", "bk_botoes"); bxs.style.background = "transparent"; bxs.style.padding = "8px 0 0";
    const bCancela = el("div", "bk_btn", "Cancelar"), bCria = el("div", "bk_btn ok", "Criar");
    bxs.append(bCancela, bCria);
    cx.append(nomeModo, avisoNome, bxs);
    criar.appendChild(cx);
    menu.appendChild(criar);
    let confirmaIgual = false; // já avisou que é igual a outro modo e o usuário quer seguir
    const nomeLimpo = () => nomeModo.value.replace(/[|;]/g, "").trim().slice(0, 20);
    const confereNome = () => {
      const n = nomeLimpo();
      const pronto = Object.keys(MODOS).some(m => m.toLowerCase() === n.toLowerCase());
      const existe = Object.keys(meusModos).some(m => m.toLowerCase() === n.toLowerCase());
      avisoNome.textContent = !n ? "" : pronto ? "Já existe um modo pronto com esse nome. Escolha outro." : existe ? "Você já tem um modo com esse nome: criar vai substituir." : "";
      bCria.textContent = existe ? "Substituir" : "Criar";
      confirmaIgual = false;
      bCria.style.opacity = !n || pronto ? ".5" : "";
      return n && !pronto;
    };
    function abreCriar() { nomeModo.value = ""; avisoNome.style.color = ""; confereNome(); criar.style.display = "flex"; setTimeout(() => nomeModo.focus(), 0); }
    const fechaCriar = () => { criar.style.display = "none"; };
    nomeModo.addEventListener("input", confereNome);
    nomeModo.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") bCria.click(); if (e.key === "Escape") fechaCriar(); });
    bCancela.onclick = fechaCriar;
    bCria.onclick = () => {
      const n = nomeLimpo();
      if (!n || Object.keys(MODOS).some(x => x.toLowerCase() === n.toLowerCase())) { confereNome(); return; }
      travaRede();
      const m = {};
      for (const key in CAMPOS) if (ABAS_MODO.includes(CAMPOS[key][0])) { const v = parseFloat(fis[key].value); m[key] = isNaN(v) ? BONK[key] : v; }
      // mesmas configurações de Campo, Bola e Jogadores de outro modo? avisa e pede confirmação
      if (!confirmaIgual) {
        const iguais = [];
        for (const nome in MODOS) if (Object.keys(m).every(k => +MODOS[nome][k] === +m[k])) iguais.push(nome);
        for (const nome in meusModos) if (nome.toLowerCase() !== n.toLowerCase() && Object.keys(m).every(k => +meusModos[nome][k] === +m[k])) iguais.push(nome);
        if (iguais.length) {
          avisoNome.textContent = "⚠ Campo, Bola e Jogadores estão iguais " + (iguais.length > 1 ? "aos modos " : "ao modo ") + iguais.join(", ") + ". Quer criar mesmo assim?";
          avisoNome.style.color = "#c62828";
          bCria.textContent = "Criar mesmo assim";
          confirmaIgual = true;
          return;
        }
      }
      avisoNome.style.color = "";
      for (const x in meusModos) if (x.toLowerCase() === n.toLowerCase()) delete meusModos[x];
      meusModos[n] = m;
      salvaModos();
      montaChips();
      atualizaMarcas();
      fechaCriar();
    };
    montaChips();

    const RODAPE = "Valores em verde estão diferentes do Bonk. A física só muda para quem tem o script; aplique no lobby, antes do Start.";
    const rodape = el("div", "bk_rodape", RODAPE);
    menu.appendChild(rodape);
    atualizaRodape = () => {
      const c = { lx: parseFloat(fis.lx.value) || 1, k: parseFloat(fis.k.value) || 1 };
      if (campoGrande(c)) {
        rodape.textContent = "⚠ Campo maior que a tela do Bonk: todos os jogadores precisam do biggg E do bonk-tela (a câmera segue o jogador)." +
          (window.__bkTelaInstalado ? "" : " Você não tem o bonk-tela instalado.");
        rodape.style.color = "#c62828";
      } else { rodape.textContent = RODAPE; rodape.style.color = ""; }
    };
    const botoes = el("div", "bk_botoes");
    const bPadrao = el("div", "bk_btn", "Padrão"), bVoltar = el("div", "bk_btn", "Voltar"), bAplicar = el("div", "bk_btn ok", "Aplicar");
    botoes.append(bPadrao, bVoltar, bAplicar);
    menu.appendChild(botoes);
    document.body.appendChild(fundo);

    const abrir = () => {
      // mostra o que está valendo na sala (assim um novo host herda o que o anterior configurou)
      t1.value = nomes[1] || "";
      t2.value = nomes[2] || "";
      lg1.url.value = logos[1] || "";
      lg2.url.value = logos[2] || "";
      lg1.mostra();
      lg2.mostra();
      statusLogo.textContent = "";
      rounds.value = input.value || "3";
      pi1.value = placarIni[0]; pi2.value = placarIni[1];
      const atual = pendenteCfg || cfg;
      for (const key in fis) fis[key].value = atual[key] ?? minhaCfg[key];
      travaRede();
      atualizaMarcas();
      desenhaOrdem();
      mostraAba(ABAS.includes(abaAtual) ? abaAtual : "Partida");
      fundo.style.display = "flex";
    };
    const fechar = () => { fundo.style.display = "none"; fechaCriar(); };
    btn.onclick = abrir;
    bVoltar.onclick = fechar;
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && fundo.style.display === "flex") { if (criar.style.display === "flex") fechaCriar(); else fechar(); } });
    bPadrao.onclick = () => { for (const key in fis) fis[key].value = BONK[key]; travaRede(); atualizaMarcas(); };
    bAplicar.onclick = () => {
      const n1 = t1.value.replace(/\|/g, "").trim().slice(0, NOME_MAX);
      const n2 = t2.value.replace(/\|/g, "").trim().slice(0, NOME_MAX);
      if (n1) meus[1] = n1; else delete meus[1];
      if (n2) meus[2] = n2; else delete meus[2];
      for (const [k, u0] of [[1, lg1.url], [2, lg2.url]]) {
        const u = u0.value.trim();
        if (LOGO_RE.test(u)) { meusLogos[k] = u; logos[k] = u; } else { delete meusLogos[k]; delete logos[k]; }
      }

      placarIni[0] = Math.max(0, parseInt(pi1.value, 10) || 0);
      placarIni[1] = Math.max(0, parseInt(pi2.value, 10) || 0);
      const r = parseInt(rounds.value, 10);
      if (r >= 1 && String(r) !== input.value) {
        input.disabled = false;
        input.removeAttribute("maxlength");
        input.value = String(r);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }

      travaRede();
      const nova = {};
      for (const key in fis) {
        const v = parseFloat(fis[key].value);
        nova[key] = isNaN(v) ? PADRAO[key] : v;
      }
      Object.assign(minhaCfg, nova);
      recebeCfg({ ...minhaCfg });
      if (campoGrande(minhaCfg)) {
        avisoChat("Este campo é maior que a tela do Bonk: todos precisam do biggg e do bonk-tela para jogar." + (window.__bkTelaInstalado ? "" : " Você não tem o bonk-tela instalado!"));
        jaAvisadosTela.clear();
      }

      ultimoEnvio = 0;
      sincroniza(1);
      fechar();
    };

    const link = document.getElementById("newbonklobby_linkbutton");
    const posiciona = () => {
      if (!link || !link.offsetWidth) return;
      const b = box.getBoundingClientRect();
      const l = link.getBoundingClientRect();
      const esc = box.offsetWidth ? b.width / box.offsetWidth : 1;
      const w = l.width / esc, h = l.height / esc;
      btn.style.width = w + "px";
      btn.style.height = h + "px";
      btn.style.left = ((l.right - b.left) / esc - w) + "px";
      btn.style.top = ((l.top - b.top) / esc - h - 8) + "px";
    };
    setInterval(() => {
      const host = souHost();
      const modoAberto = modeMenu && getComputedStyle(modeMenu).display !== "none" && modeMenu.offsetHeight > 0;
      if (host && !modoAberto) {
        btn.style.display = "block";
        posiciona();
        label.style.visibility = input.style.visibility = "hidden";
      } else if (host) {
        btn.style.display = "none";
      } else {
        btn.style.display = "none";
        fundo.style.display = "none";
        label.style.visibility = input.style.visibility = "";
      }
    }, 150);
  }

  document.addEventListener("DOMContentLoaded", () => {
    for (const c of document.querySelectorAll(CHAT)) chat.observe(c, { childList: true, subtree: true });
    qtd = document.querySelectorAll(LOBBY_LISTAS).length;
    for (const id of IDS) {
      const el = document.getElementById(id);
      if (el) new MutationObserver(mudouLobby).observe(el, { childList: true });
    }
    montaMenu();
    // duas cópias do biggg ativas (ex.: a antiga não foi apagada) aplicam tudo em dobro
    const copias = (window.__bkPatches || []).filter(([, rep]) => typeof rep === "string" && rep.includes("__bkGolL ? window.__bkGolL(")).length;
    if (copias > 1) {
      console.warn("[biggg] " + copias + " cópias do biggg ativas");
      setTimeout(() => avisoChat("ATENÇÃO: há " + copias + " cópias do biggg ativas no seu Tampermonkey. Deixe só a versão " + VERSAO + " ligada e recarregue a página.", "copias"), 3000);
    }
  });

  // ---------- física ----------
  const achaPlacares = (n, d = 0, out = []) => {
    if (n.children && (n.children.length === 4 || n.__lg || n.__tempo) && Math.abs(n.x - 366) < 2 &&
        n.children[2] && typeof n.children[2].text === "string") out.push(n);
    if (d < 4 && n.children) for (const c of n.children) achaPlacares(c, d + 1, out);
    return out;
  };

  function fisica(B) {
    const V2 = B.Common.Math.b2Vec2;
    const Poly = B.Collision.Shapes.b2PolygonShape;
    const setAsArray = Poly.prototype.SetAsArray;
    const redeFix = new WeakSet();
    const muroFix = new WeakSet();
    const WM = B.Collision.b2WorldManifold;
    let caixas = null;
    let naRede = false;
    resetCaixas = () => { caixas = null; };
    // a extrapolação simulada (bonk-utilidades) roda passos extras; salva/restaura o que a física guarda entre passos
    window.__bkFis = { salva: () => naRede, restaura: (v) => { naRede = v; } };
    // "a bola já estava na rede no passo anterior" fica guardado no próprio estado (posição 28 do placar, negativa):
    // quando o Bonk volta no tempo para corrigir, ele recalcula a partir do estado certo e todos chegam ao mesmo resultado
    window.__bkRedePre = (st) => { const v = st && st.scores && st.scores[28]; naRede = typeof v === "number" && v < 0 ? v === -2 : false; };
    window.__bkRedePos = (st) => { if (st && st.scores && REDE > 0 && BATE < 1) { while (st.scores.length < 29) st.scores.push(null); st.scores[28] = naRede ? -2 : -1; } };

    Poly.prototype.SetAsArray = function (vs, n) {
      if (Array.isArray(vs) && vs.length && vs.every(v =>
        near(Math.abs(v.x), 30.909, 30.455) && near(Math.abs(v.y), 6.5, 15.909, 16.364))) {
        const lateral = vs.every(v => Math.sign(v.x) === Math.sign(vs[0].x));
        const golPadrao = GOL === 6.5 && !SNIPER;
        vs = vs.map(v => new V2(KX === 1 ? v.x : v.x * KX, near(Math.abs(v.y), 6.5) ? (golPadrao ? v.y : Math.sign(v.y) * GOL)
          : SNIPER && lateral ? Math.sign(v.y) * SN_D * meiaAltura() : K === 1 ? v.y : v.y * K));
        this.__muro = true;
      }
      return setAsArray.call(this, vs, n);
    };

    const criaCaixas = () => {
      const box = (x0, y0, x1, y1) => {
        const s = new Poly();
        setAsArray.call(s, [new V2(x0, y0), new V2(x1, y0), new V2(x1, y1), new V2(x0, y1)], 4);
        return s;
      };
      const out = [];
      const fim = XW + REDE;
      for (const s of [-1, 1]) {
        const a = Math.min(s * XW, s * (fim + ESP)), b = Math.max(s * XW, s * (fim + ESP));
        out.push(box(a, GOL, b, GOL + ESP), box(a, -GOL - ESP, b, -GOL));
        const c = Math.min(s * fim, s * (fim + ESP)), d = Math.max(s * fim, s * (fim + ESP));
        out.push(box(c, -GOL - ESP, d, GOL + ESP));
      }
      return out;
    };

    const Body = B.Dynamics.b2Body.prototype;
    const createFixture = Body.CreateFixture;
    Body.CreateFixture = function (def, ...r) {
      const s = def.shape || def;
      if (s.m_p && near(s.m_radius, 0.727, 0.727 * TRAVE) && near(Math.abs(s.m_p.x), 30.455, XW) && near(Math.abs(s.m_p.y), 6.5, GOL)) {
        football = true;
        // só mexe no que mudou: com tudo no padrão, as traves ficam exatamente como as do Bonk
        if (KX !== 1) s.m_p.x = Math.sign(s.m_p.x) * XW;
        if (GOL !== 6.5 || SNIPER) s.m_p.y = Math.sign(s.m_p.y) * GOL;
        if (TRAVE !== 1) s.m_radius = 0.727 * TRAVE;
      }
      if (s.m_p && this.GetType() === 2 && !near(s.m_radius, window.__bkJog || 1) && near(s.m_radius, BOLA_R, BOLA_R * TAM)) {
        this.__bola = true;
        if (near(s.m_radius, BOLA_R) && !def.__bkPeso) {
          def.__bkPeso = true;
          s.m_radius = BOLA_R * TAM;
          if (def.shape && typeof def.density === "number") def.density *= PESO / (TAM * TAM);
        }
      }
      if (s.m_p && this.GetType() === 2 && !this.__bola) this.__jog = true;
      const fx = createFixture.call(this, def, ...r);
      if (s.__muro) muroFix.add(fx);
      if (SNIPER && def.shape && s.__muro && !this.__sniper) {
        this.__sniper = true;
        const H = meiaAltura(), x0 = 30.455 * KX, x1 = 30.909 * KX;
        const box = (a, b, c, d) => { const p = new Poly(); setAsArray.call(p, [new V2(a, b), new V2(c, b), new V2(c, d), new V2(a, d)], 4); return p; };
        // parede entre o gol de canto e o canto do campo
        for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
          const ya = sy * SN_R * H, yb = sy * 16.364 * K;
          def.shape = box(Math.min(sx * x0, sx * x1), Math.min(ya, yb), Math.max(sx * x0, sx * x1), Math.max(ya, yb));
          muroFix.add(createFixture.call(this, def));
        }
        // traves dos gols de canto: iguais às do Bonk (quicam 0.9 e batem na bola E nos jogadores: máscara 4|2)
        const filtroMuro = def.filter, restMuro = def.restitution;
        if (filtroMuro && filtroMuro.Copy) { const ft = filtroMuro.Copy(); ft.maskBits = 6; def.filter = ft; }
        def.restitution = 0.9;
        for (const sx of [-1, 1]) for (const fy of [SN_D, SN_R]) for (const sy of [-1, 1]) {
          const c = new B.Collision.Shapes.b2CircleShape(0.727 * TRAVE);
          c.m_p.x = sx * XW; c.m_p.y = sy * fy * H;
          def.shape = c;
          createFixture.call(this, def);
        }
        def.filter = filtroMuro; def.restitution = restMuro;
        // barreira no meio só para os jogadores (bola tem categoria 4, jogadores 2)
        const filtro = def.filter;
        if (filtro && filtro.Copy) {
          const f2 = filtro.Copy();
          f2.maskBits = 2;
          def.filter = f2;
          def.shape = box(-0.1, -16.364 * K, 0.1, 16.364 * K);
          createFixture.call(this, def);
          def.filter = filtro;
        }
        def.shape = s;
      }
      if (REDE > 0 && def.shape && s.__muro && !this.__rede) {
        this.__rede = true;
        caixas = caixas || criaCaixas();
        for (const c of caixas) {
          def.shape = c;
          redeFix.add(createFixture.call(this, def));
        }
        def.shape = s;
      }
      return fx;
    };

    const setDamping = Body.SetLinearDamping;
    Body.SetLinearDamping = function (d, ...r) {
      if (this.__bola && ATRITO !== 1 && near(d, 0.6)) d *= ATRITO; // bola do Football: 0.6 no Bonk
      return setDamping.call(this, d, ...r);
    };

    const applyImpulse = Body.ApplyImpulse;
    Body.ApplyImpulse = function (imp, pt, ...r) {
      const f = CHUTE * PESO;
      if (this.__bola) this.__chutou = true;
      if (football && this.__bola && f !== 1) {
        imp = new V2(imp.x * f, imp.y * f);
      }
      return applyImpulse.call(this, imp, pt, ...r);
    };

    const W = B.Dynamics.b2World.prototype;
    if (W.b2World) {
      const init = W.b2World;
      W.b2World = function (...a) { football = false; return init.apply(this, a); };
    }

    const step = W.Step;
    if (step) {
      W.Step = function (...a) {
        const ret = step.apply(this, a);
        const fazRede = REDE > 0 && BATE < 1;
        const fazMuro = football && PAREDE !== 1;
        const fazJog = football && BONECO !== 1;
        if (!fazRede && !fazMuro && !fazJog) return ret;
        for (let b = this.GetBodyList(); b; b = b.GetNext()) {
          if (!b.__bola) continue;
          let toca = false, muro = null;
          const jogs = new Set();
          for (let e = b.GetContactList(); e; e = e.next) {
            const c = e.contact;
            if (!c.IsTouching()) continue;
            const fa = c.GetFixtureA(), fb = c.GetFixtureB();
            if (redeFix.has(fa) || redeFix.has(fb)) toca = true;
            else if (muroFix.has(fa) || muroFix.has(fb)) muro = muro || c;
            else if (e.other && e.other.__jog) jogs.add(e.other);
          }
          // rebote no jogador: muda só a velocidade com que a bola se afasta do boneco
          const antes = b.__jogs || new Set();
          if (fazJog && !b.__chutou) {
            for (const j of jogs) {
              if (antes.has(j)) continue;
              const pb = b.GetPosition(), pj = j.GetPosition();
              let nx = pb.x - pj.x, ny = pb.y - pj.y;
              const d = dist2(nx, ny);
              if (!d) continue;
              nx /= d; ny /= d;
              const v = b.GetLinearVelocity(), vj = j.GetLinearVelocity();
              const vn = (v.x - vj.x) * nx + (v.y - vj.y) * ny;
              if (vn <= 0) continue;
              const f = BONECO - 1;
              b.SetLinearVelocity(new V2(v.x + f * vn * nx, v.y + f * vn * ny));
            }
          }
          b.__jogs = jogs;
          b.__chutou = false;
          if (fazRede && toca && !naRede) {
            const v = b.GetLinearVelocity();
            b.SetLinearVelocity(new V2(v.x * BATE, v.y * BATE));
          }
          naRede = toca;
          // rebote nas paredes: muda só a parte da velocidade que sai da parede
          if (fazMuro && muro && !b.__naMuro && !toca) {
            const v = b.GetLinearVelocity();
            let nx = 0, ny = 0;
            try {
              const wm = new WM();
              muro.GetWorldManifold(wm);
              nx = wm.m_normal.x; ny = wm.m_normal.y;
            } catch (e) {}
            if (!nx && !ny) {
              const p = b.GetPosition();
              if (Math.abs(p.y - 250 / 11) > 15.909 * K - 1.5) ny = 1; else nx = 1;
            }
            const vn = v.x * nx + v.y * ny, f = PAREDE - 1;
            b.SetLinearVelocity(new V2(v.x + f * vn * nx, v.y + f * vn * ny));
          }
          b.__naMuro = !!muro;
        }
        return ret;
      };
    }
  }

  // ---------- desenho ----------
  function desenhaLogo(c) {
    if (c.__logo) return;
    const logo = PIXI.Sprite.from(LOGO_URL);
    logo.anchor.set(0.5);
    logo.scale.set(LOGO_ESCALA / KX, LOGO_ESCALA / K);
    logo.alpha = LOGO_ALPHA;
    logo.position.set(365, 250);
    c.addChild(logo);
    c.__logo = logo;
  }

  function desenhaRede(c) {
    const ls = c.geometry?.graphicsData?.find(g => g.shape?.width === 670 && g.lineStyle)?.lineStyle;
    const w = ls?.width || 1, cor = ls?.color ?? 0xffffff, al = ls?.alpha ?? 0.8;
    const px = (X) => 365 + X * 11 / KX;
    const py = (Y) => 250 + Y * 11 / K;
    const rx = 8 * TRAVE / KX, ry = 8 * TRAVE / K;
    const g = new PIXI.Graphics();
    const seg = (xa, ya, xb, yb) => { g.moveTo(xa, ya); g.lineTo(xb, yb); };

    g.lineStyle(w, cor, al);
    for (const s of [-1, 1]) {
      const x0 = px(s * XW), x1 = px(s * (XW + REDE));
      const yT = py(-GOL), yB = py(GOL);
      seg(x0 + s * rx, yT, x1, yT);
      seg(x0 + s * rx, yB, x1, yB);
      seg(x1, yT, x1, yB);
      seg(x0, yT + ry, x0, yB - ry);
    }
    c.addChild(g);
    c.__rede = g;
  }

  function desenhaSniper(c) {
    const px = (X) => 365 + X * 11 / KX;
    const py = (Y) => 250 + Y * 11 / K;
    const H = meiaAltura();
    const rx = 8 * TRAVE / KX, ry = 8 * TRAVE / K;
    const g = new PIXI.Graphics();
    // barreira do meio
    g.lineStyle(3 / KX, 0x222222, 0.9);
    g.moveTo(365, py(-15.909 * K)); g.lineTo(365, py(15.909 * K));
    // traves dos gols de canto: pretas com o mesmo contorno branco fino das traves do Bonk
    // (o gol do meio usa as traves originais: azul de um lado, vermelho do outro)
    g.lineStyle(1, 0xffffff, 0.5);
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      for (const fy of [SN_D, SN_R]) {
        g.beginFill(0x1a1a1a);
        g.drawEllipse(px(sx * XW), py(sy * fy * H), rx, ry);
        g.endFill();
      }
    }
    c.addChild(g);
    c.__sniper = g;
  }

  function restauraCampo(c) {
    c.scale.x = c.__bm.sx;
    c.scale.y = c.__bm.sy;
    c.x = c.__bm.x;
    c.y = c.__bm.y;
    delete c.__bm;
    for (const k of ["__rede", "__logo", "__sniper"]) {
      if (c[k]) {
        c.removeChild(c[k]);
        c[k].destroy();
        delete c[k];
      }
    }
  }

  function desenhaLogosPlacar(p, l1, l2) {
    const lg = p.__lg || (p.__lg = {});
    for (const [k, txt, lado] of [[1, l1, -1], [2, l2, 1]]) {
      const u = logos[k];
      let sp = lg[k];
      if (sp && sp.__url !== u) {
        p.removeChild(sp);
        sp.destroy();
        sp = lg[k] = null;
      }
      if (!u) continue;
      if (!sp) {
        sp = lg[k] = PIXI.Sprite.from(u, { resourceOptions: { crossorigin: "anonymous" } });
        sp.__url = u;
        avisaFalhaLogo(sp, k, u);
        sp.anchor.set(lado < 0 ? 1 : 0, 0.5);
        p.addChild(sp);
      }
      const tex = sp.texture;
      if (!tex || !tex.valid || !tex.height) { sp.visible = false; continue; }
      const h = txt.height * 1.25;
      sp.scale.set(h / tex.height);
      sp.visible = true;
      sp.position.set(txt.x + lado * (txt.width + GAP), txt.y);
    }
  }

  const falhas = new Set();
  function avisaFalhaLogo(sp, k, u) {
    const bt = sp.texture && sp.texture.baseTexture;
    if (!bt || !bt.once) return;
    bt.once("error", () => {
      if (falhas.has(u)) return;
      falhas.add(u);
      console.warn("[biggg] logo não carregou:", u);
      for (const c of document.querySelectorAll(CHAT)) {
        const d = document.createElement("div");
        d.textContent = "* Logo do time " + k + " não carregou: " + u;
        d.style.color = "#c66";
        c.appendChild(d);
        vistos.add(d);
        c.scrollTop = c.scrollHeight;
      }
    });
  }

  function desenhaRelogio(p, l2) {
    if (!relogio.ativo && !relogio.pausado) { if (p.__tempo) p.__tempo.visible = false; return; }
    let t = p.__tempo;
    if (!t) {
      const est = l2.style || {};
      t = p.__tempo = new PIXI.Text("", { fontFamily: est.fontFamily || "futurept_b1", fontSize: est.fontSize || 20, fill: 0xffffff, dropShadow: true, dropShadowAlpha: 0.3, dropShadowDistance: 2 });
      p.addChild(t);
    }
    const seg = Math.ceil(relogio.resta);
    let txt = relogio.ouro ? "GOL DE OURO" : Math.floor(seg / 60) + ":" + String(seg % 60).padStart(2, "0");
    if (!relogio.ouro && relogio.acr) txt += "  (" + fmtAcr(relogio.acr) + ")";
    if (!relogio.ativo) txt = "";
    if (relogio.pausado) txt = (txt ? txt + "  " : "") + "⏸ PAUSADO";

    if (t.text !== txt) t.text = txt;
    t.style.fill = penInfo.ativo ? 0xffffff : relogio.ouro ? 0xffd54f : seg <= 10 ? 0xff8a80 : 0xffffff;
    t.visible = true;
    // à direita do time 2: depois da logo, se tiver, senão depois do nome; mesma linha (mesmo anchor vertical do nome)
    const lg = p.__lg && p.__lg[2];
    const ref = lg && lg.visible ? lg : l2;
    const ay = l2.anchor ? l2.anchor.y : 0;
    const ax = ref.anchor ? ref.anchor.x : 0;
    t.anchor.set(0, ay);
    t.position.set(ref.x + (1 - ax) * ref.width + GAP * 3, l2.y);
  }

  function removeLogosPlacar(p) {
    if (!p.__lg) return;
    for (const k in p.__lg) {
      const sp = p.__lg[k];
      if (sp) { p.removeChild(sp); sp.destroy(); }
    }
    delete p.__lg;
  }

  function visual() {
    for (const m of ["addChild", "addChildAt"]) {
      const o = PIXI.Container.prototype[m];
      PIXI.Container.prototype[m] = function (...a) {
        sujo = true;
        return o.apply(this, a);
      };
    }

    const R = PIXI.Renderer.prototype;
    const render = R.render;
    R.render = function (obj, ...r) {
      const c = obj?.children?.[0];
      if (c?.scale) {
        if (c.__bm && (!football || c.__bm.cfg !== cfg)) restauraCampo(c);
        if (football && !c.__bm && (c.__bkTelaExt || (Math.round(c.width) === 730 && Math.round(c.height) === 500))) {
          c.__bm = { sx: c.scale.x, sy: c.scale.y, x: c.x, y: c.y, cfg };
          c.scale.x *= KX;
          c.scale.y *= K;
          c.x += 365 * c.__bm.sx * (1 - KX);
          c.y += 250 * c.__bm.sy * (1 - K);
          if (REDE > 0) desenhaRede(c);
          if (SNIPER) desenhaSniper(c);
          desenhaLogo(c);
        }
      }

      if (football) {
        if (sujo && obj) {
          sujo = false;
          for (const p of achaPlacares(obj)) placares.add(p);
        }
        for (const p of placares) {
          if (!p.parent) {
            placares.delete(p);
            continue;
          }
          const [n0, n1, l1, l2] = p.children;
          const o = p.__o || (p.__o = {
            sx: p.scale.x, sy: p.scale.y, y: p.y,
            t: [l1.text, l2.text],
            pos: [[l1.x, l1.y], [l2.x, l2.y]],
          });
          p.scale.set(o.sx * PLACAR, o.sy * PLACAR);
          p.y = o.y - 24.5 * (1 - PLACAR) - PLACAR_Y;
          l1.text = nomes[1] || o.t[0];
          l2.text = nomes[2] || o.t[1];
          l1.position.set(n0.x - n0.width - GAP, n0.y);
          l2.position.set(n1.x + n1.width + GAP, n1.y);
          desenhaLogosPlacar(p, l1, l2);
          desenhaRelogio(p, l2);
        }
      } else if (placares.size) {
        for (const p of placares) {
          if (!p.__o) continue;
          const o = p.__o;
          p.scale.set(o.sx, o.sy);
          p.y = o.y;
          p.children[2].text = o.t[0];
          p.children[3].text = o.t[1];
          p.children[2].position.set(o.pos[0][0], o.pos[0][1]);
          p.children[3].position.set(o.pos[1][0], o.pos[1][1]);
          removeLogosPlacar(p);
          if (p.__tempo) { p.removeChild(p.__tempo); p.__tempo.destroy(); delete p.__tempo; }
          delete p.__o;
        }
        placares.clear();
        sujo = true;
      }

      return render.call(this, obj, ...r);
    };

    const G = PIXI.Graphics.prototype;
    const drawCircle = G.drawCircle;
    G.drawCircle = function (x, y, r, ...a) {
      if (football && TAM !== 1 && near(r, BOLA_PX)) {
        return drawCircle.call(this, x, y, r * TAM, ...a);
      }
      if (near(r, 8) && near(x, 30, 700) && near(y, 178.5, 321.5)) {
        return this.drawEllipse(x, 250 + Math.sign(y - 250) * GOL * 11 / K, r * TRAVE / KX, r * TRAVE / K);
      }
      if (near(r, 50) && near(x, 365) && near(y, 250)) {
        return this.drawEllipse(x, y, r / KX, r / K);
      }
      return drawCircle.call(this, x, y, r, ...a);
    };

    for (const nome of ["moveTo", "lineTo"]) {
      const orig = G[nome];
      G[nome] = function (x, y, ...a) {
        if (near(x, 30, 85, 645, 700) && near(y, 115, 385)) y = compY(y);
        return orig.call(this, x, y, ...a);
      };
    }
  }

  const t = setInterval(() => {
    const B = window.requirejs?.s?.contexts?._?.defined?.["physics/box2dweb/Box2DModuleGJMod"];
    if (B && window.PIXI) {
      clearInterval(t);
      fisica(B);
      visual();
    }
  }, 20);
})();