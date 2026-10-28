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
- Desenho sem interpolação: o render recebe alpha = 1 (estado mais recente, até 33 ms antes).
- Contador de conexões P2P abertas.

Se o bonk.io mudar o código e um patch não casar, ele é desligado sozinho, e o painel mostra "indisponível".
O jogo continua funcionando normalmente.

**Sala** (como host, inclusive no meio da partida)
- Mover jogador de time (Espectador, Livre, Vermelho, Azul, Verde, Amarelo), kick, ban, dar host, travar times.
- Reiniciar partida: dispara o mesmo evento do botão Start do lobby, também no meio da partida.
- Ban com lista salva: quem estiver nela é banido de novo ao entrar enquanto você for host.
- Entrar por link de convite.

As ações usam as funções do próprio motor de rede do jogo (`kickPlayer`, `banPlayer`, `changeOtherTeam`,
`sendHostChange`, `doTeamLock`), e o servidor só as aceita do host da sala.

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
