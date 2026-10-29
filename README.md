# Bonk Turbo Lite

Launcher do bonk.io focado em input lag e desempenho, com controle total do lobby. Feito para rodar
bem em PC simples: vem com tudo o que pesa desligado e com as opções de input lag ligadas.

## Baixar

Em **Releases**, baixe o `Bonk.Turbo.Lite.Setup.<versão>.exe` e instale. Se o Windows avisar que protegeu o
computador, clique em **Mais informações** e depois em **Executar assim mesmo** (o app não tem assinatura digital).

## Atalhos

| Tecla | Ação |
|---|---|
| F2 | Abre/fecha o painel (Sala, Desempenho e Visual) |
| F11 | Sai/volta da tela cheia |
| F5 | Recarrega o jogo |

## Sala

Como host, inclusive no meio da partida:
- mover jogadores de time (Espectador, Livre, Vermelho, Azul, Verde, Amarelo), kick, ban, dar host;
- travar times, ligar e desligar o modo de times, começar e reiniciar a partida;
- trocar o próprio time ou ir para espectador;
- lista de banidos: quem estiver nela é banido de novo ao entrar enquanto você for host.

As ações usam as funções do próprio jogo, e o servidor só as aceita do host da sala.

## Desempenho

- **Envio imediato de input:** a tecla sai no instante em que você aperta, em vez de esperar o próximo tick do jogo
  (até 33 ms antes). A mensagem é a mesma que o jogo mandaria, com o mesmo número de tick; um tick nunca é enviado
  duas vezes com conteúdo diferente.
- Limite de FPS de 30 a 3000 (240 por padrão). O limitador dorme até ~1 ms antes de cada quadro, sem gastar
  processador à toa.
- Resolução de renderização, contador de conexões P2P e entrar por link de convite.

## Visual

Muda só a sua tela: a simulação e o que vai para a sala continuam iguais.
- **Tempo real:** o bonk desenha sempre um tick (33 ms) atrás da simulação; aqui a imagem mostra o presente, prevendo
  o tick seguinte com a física do próprio jogo. Com o envio imediato, a previsão é refeita no instante da tecla.
- **Resposta seca:** mostra cada tick inteiro, sem deslizar entre eles. Menos liso, mas a resposta é imediata.
- **Tela cheia:** proporcional (formato original, com faixas nas laterais; o padrão), ampla (usa a tela toda sem
  esticar: nas laterais aparece o resto do mapa) ou esticada (16:9).
- Previsão extra para compensar a rede, suavização das correções da sala, movimento liso em FPS alto (relógio de
  alta precisão) e sem lixo de memória por quadro.
- Nitidez na tela esticada, antialiasing e canvas de baixa latência (desligados por padrão).
- Skin original nos modos com time (com borda da cor do time), esconder nomes e esconder o chat dos jogadores.

Os patches no código do jogo casam com a forma do código, não com nomes, então sobrevivem às atualizações do bonk.io.
Se um dia algum não casar, ele se desliga sozinho e o painel mostra "indisponível"; o jogo continua normal.

## Desenvolvimento

```
npm install
npm start                                 # roda o launcher
npm test -- caminho/para/alpha2s.js       # confere os patches num alpha2s.js real
npm run dist                              # gera o instalador
```

`BONK_TURBO_DEBUG=1` mostra no terminal o estado dos patches e os quadros por segundo do jogo.
