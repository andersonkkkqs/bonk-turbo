# Bonk Turbo

Launcher do bonk.io focado em reduzir o input lag.

## O que faz

**Envio imediato de input.** No bonk.io, o jogo só lê e envia as suas teclas no próximo tick da simulação (30 por
segundo), então cada tecla pode esperar até 33 ms antes de sair. O Bonk Turbo envia a mesma mensagem que o jogo
mandaria (`{i, f}`, com o mesmo número de tick) no instante em que você aperta a tecla.

- Nada muda na física nem no conteúdo das mensagens: elas só saem mais cedo.
- Um tick nunca é enviado duas vezes com conteúdo diferente (os outros jogadores ignoram a segunda mensagem do mesmo
  tick, e isso dessincronizaria a partida). Uma mudança que chega depois do envio antecipado vai para o tick seguinte.
- O patch casa com a forma do código do jogo, não com nomes, então sobrevive às atualizações do bonk.io. Se um dia não
  casar, ele se desliga sozinho e o painel mostra "indisponível"; o jogo continua normal.

## Atalhos

| Tecla | Ação |
|---|---|
| F2 | Abre/fecha o painel |
| F11 | Tela cheia |
| F5 | Recarrega o jogo |

## Desenvolvimento

```
npm install
npm start                                 # roda o launcher
npm test -- caminho/para/alpha2s.js       # confere o patch num alpha2s.js real
npm run dist                              # gera o instalador
```

`BONK_TURBO_DEBUG=1` mostra no terminal se o patch ficou ativo.
