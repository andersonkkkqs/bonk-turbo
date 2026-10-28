# Bonk Turbo

Launcher do bonk.io focado em desempenho, input lag e ferramentas de host durante a partida.
Junta o que importava do BonkTools Launcher e do Bonk Launcher (Ditl), sem temas nem personalização.

## Atalhos

| Tecla | Ação |
|---|---|
| F2 | Abre/fecha o painel (Sala e Desempenho) |
| F11 | Tela cheia |
| F5 | Recarrega o jogo |
| Ctrl+Shift+F12 | Ferramentas de desenvolvedor |

## Recursos

**Desempenho**
- FPS: limite de 30 a 3000 (cronometrado por timer; o limite é o FPS real enquanto o PC aguentar), "Sem limite" ou VSync. Fora do VSync o Chromium roda sem trava de quadros.
- Tela cheia 16:9 sem bordas: o iframe do jogo e o canvas ocupam a tela inteira (o jogo é esticado; a proporção original é 730×500).
- Resolução de renderização de 50% a 200%.

**Input lag** (patches estruturais no `alpha2s.js`, aplicados a cada carregamento)
- Envio imediato de input: a mensagem `{i, f}` que o jogo mandaria no próximo tick sai no instante da tecla.
  O frame nunca é enviado duas vezes com conteúdo diferente (veja `src/patcher.js`).
- Contador de conexões P2P abertas.

**Visual** (aba própria no painel; muda só a sua tela)
- Previsão (extrapolação) de 0 a 50 ms: roda a física do próprio jogo alguns quadros à frente, em cópias do estado,
  e desenha o resultado. Para antes de gols e contagens; sem a física disponível, nunca passa do estado atual.
- Suavizar correções de 0 a 300 ms: quando a sala corrige uma posição (rollback), o jogador desliza até o lugar certo.
- Desenho sem interpolação.
- Skin original nos modos com time (com ou sem a borda da cor do time), esconder nomes na partida e esconder o chat
  dos jogadores.

**Jogo** (aba própria no painel; mudam a física, então todos na sala precisam da mesma função ligada)
- Física customizada (biggg v18): Menu Host no lobby com campo, gol, rede, bola, jogadores, tempo, pênaltis, Sniper
  e modos prontos.
- Power shot e curva (bonk-power-shot v6), na tecla Special.

O código dessas duas funções é o dos scripts originais, sem alteração (`src/features`). Assim a física e a
sincronização são idênticas às de quem usa os mesmos scripts pelo Tampermonkey, e todos jogam na mesma sala.
Um mod da pasta com o mesmo nome de uma função ligada é ignorado, para não rodar em dobro.

Se o bonk.io mudar o código e um patch não casar, ele é desligado sozinho, e o painel mostra "indisponível".
O jogo continua funcionando normalmente.

**Sala** (como host, inclusive no meio da partida)
- Mover jogador de time (Espectador, Livre, Vermelho, Azul, Verde, Amarelo), kick, ban, dar host, travar times.
- Reiniciar partida: dispara o mesmo evento do botão Start do lobby, também no meio da partida.
- Ban com lista salva: quem estiver nela é banido de novo ao entrar enquanto você for host.
- Entrar por link de convite.

As ações usam as funções do próprio motor de rede do jogo (`kickPlayer`, `banPlayer`, `changeOtherTeam`,
`sendHostChange`, `doTeamLock`), e o servidor só as aceita do host da sala.

## Mods

Scripts no formato do Tampermonkey (`.user.js`), ligados e desligados na aba **Mods** do painel (F2).
Não é preciso instalar o Tampermonkey.

- Pasta dos mods: `%APPDATA%\Bonk Turbo\mods` (botão "Abrir pasta de mods" no painel).
- Mods que vêm com o launcher ficam em `src/mods`; um arquivo com o mesmo nome na pasta do usuário o substitui.
- Os mods ligados rodam no iframe do jogo antes de qualquer script dele (equivale a `@run-at document-start`),
  respeitando o `@match` do cabeçalho. Ligar ou desligar um mod vale depois de recarregar o jogo.
- Scripts que alteram o `alpha2s.js` pelo esquema do Code Injector (gancho em `appendChild` + `window.__bkPatches`)
  funcionam junto com os patches do próprio launcher.
- Mods que mudam a física só funcionam se todos na sala tiverem o mesmo mod ligado.

## Desenvolvimento

```
npm install
npm start                                 # roda o launcher
npm test -- caminho/para/alpha2s.js       # confere os patches num alpha2s.js real
npm run dist                              # gera dist/Bonk Turbo Setup <versão>.exe
```

`BONK_TURBO_DEBUG=1` mostra no terminal o estado dos patches e os quadros por segundo do jogo.

## Estrutura

- `src/main.js`: janela, flags do Chromium, interceptação do `alpha2s.js`, IPC.
- `src/patcher.js`: patches estruturais no código do jogo.
- `src/prelude.js`: roda dentro da página do jogo (limitador de FPS, sala, painel, tela cheia).
- `src/preload.js`: ponte entre a página e o launcher; também estica o iframe na página de fora.
- `src/settings.js`: configurações salvas em `%APPDATA%\Bonk Turbo\settings.json`.
