# ♞ Xadrez Arena

App mobile de xadrez (iOS/Android, também roda na web) com:

- **Partidas online ranqueadas** com matchmaking por rating (Elo) e **10 níveis** (Iniciante → Grande Mestre)
- **Amizades**: busca de jogadores, pedidos, aceitar/recusar, status online/em partida em tempo real
- **Convites de partida** entre amigos (ritmo, cor e amistosa/ranqueada) e **revanche**
- **IA de xadrez própria** com 5 níveis, que funciona offline, com dicas e desfazer lance
- **Loja** com moedas: tabuleiros, peças, ícones de perfil, bonecos e movimentos especiais (quanto mais bonito, mais caro)
- **Finalização em 3D**: ao fim da partida o boneco 3D (em blocos) do vencedor derruba o rival numa arena com o piso do seu tabuleiro e comemora com o movimento especial equipado (padrão: *Passinho do Jamal* e *Movimento do 67*)
- **Visual jovem**: cores neon e gradientes, fonte arredondada (Fredoka), seu boneco 3D na tela inicial, sequência de vitórias 🔥 com bônus de moedas
- **Peças vetoriais detalhadas** (desenho próprio em SVG) com sombreamento, contorno, brilho e sombra
- **Notificações** em tempo real com central no app (🔔)
- **Segurança**: JWT endurecido, HTTPS obrigatório em produção, token no Keychain/Keystore

## 📱 Instalar no Android (sem programar)

Baixe o APK mais recente direto no celular:
**https://github.com/felipecastrotiburcio-cpu/xadrez-arena/releases/latest/download/xadrez-arena.apk**

Abra o arquivo baixado, permita "instalar apps desta fonte" se o Android pedir e toque em **Instalar**. Android 7.0 ou superior.

O APK é gerado automaticamente pelo GitHub Actions (`.github/workflows/android-apk.yml`) a cada mudança no app: ele compila, **testa num emulador Android** (abre o app, joga contra a IA, confere regras e a finalização 3D) e só então publica em [Releases](https://github.com/felipecastrotiburcio-cpu/xadrez-arena/releases). Para gerar de novo manualmente: aba **Actions → APK Android → Run workflow**.

- **Sem internet:** jogar contra a IA (5 níveis), dicas, desfazer, finalização 3D e **contas salvas no aparelho** com moedas, loja, níveis, ranking do aparelho e notificações.
- **Com servidor:** partidas online, amigos, convites e ranking global. O servidor ainda não está publicado; sem ele essas telas avisam que precisam do modo online.
- **Assinatura:** por padrão o APK de teste usa a chave de testes do React Native. Para usar uma chave própria, cadastre em *Settings → Secrets and variables → Actions* os segredos `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` e `ANDROID_KEY_PASSWORD`.

## Estrutura

```
xadrez-app/
├── app/      # Expo (React Native + Expo Router + TypeScript)
│   └── src/
│       ├── app/          # telas (rotas do Expo Router)
│       ├── ai/           # motor de xadrez da IA + testes
│       ├── three/        # cenas 3D (three.js + expo-gl): boneco em blocos, arena, finalizações
│       ├── components/   # tabuleiro, barras de jogador, modais…
│       └── lib/          # API, autenticação, socket, níveis, tema
└── server/   # Node.js + Express + Socket.IO + TypeScript
    └── src/
        ├── app.ts          # monta HTTP + WebSocket
        ├── routes.ts       # REST: auth, usuários, amigos, ranking
        ├── games.ts        # partidas ao vivo, relógios, fim de jogo, Elo
        ├── matchmaking.ts  # fila ranqueada
        ├── invites.ts      # convites e revanches
        ├── levels.ts       # Elo e níveis
        ├── catalog.ts      # itens da loja, preços e economia de moedas
        ├── shop.ts         # REST: loja, bônus diário, notificações
        ├── notifications.ts# grava e entrega notificações em tempo real
        └── config.ts       # variáveis de ambiente, JWT_SECRET e HTTPS
deploy/       # Docker Compose + Caddy (HTTPS automático com Let's Encrypt)
```

## Como rodar

### 1. Servidor

```bash
cd server
npm install
npm run dev        # http://localhost:3001
```

Os dados ficam em `server/data/db.json`. Todas as variáveis estão documentadas em `server/.env.example`. Em desenvolvimento não é preciso configurar nada: um `JWT_SECRET` aleatório é gerado em `server/data/.jwt-secret`.

### 2. App

```bash
cd app
npm install
npx expo start     # abra no Expo Go (celular), emulador, ou pressione "w" para a web
```

Em desenvolvimento o app usa automaticamente o IP da máquina que roda o Metro na porta 3001, então funciona direto no celular na mesma rede Wi-Fi. Para outro endereço, use **⚙️ Configurações → Servidor** no app ou defina `EXPO_PUBLIC_SERVER_URL`.

## Contas no aparelho (modo local)

Quando nenhum servidor online está configurado (caso do APK atual), o app usa um **servidor local** (`app/src/lib/localBackend.ts`) que responde às mesmas rotas da API e guarda tudo no celular:

- **Contas** com nome de usuário e senha. A senha é guardada com **PBKDF2-SHA256** (10 mil iterações) e sal aleatório de 16 bytes, gerado por `expo-crypto`. O token da sessão fica no Keychain/Keystore.
- **Moedas, loja, itens equipados, bônus diário, notificações e histórico** de partidas.
- **Nível e rating** calculados contra a força de cada nível da IA (Elo).
- **Ranking** com as contas criadas no aparelho.

Moedas por partida contra a IA: vitória de 15 (nível 1) a 35 (nível 5), empate de 7 a 15, derrota 3, mais o bônus de vitórias seguidas e +100 ao subir de nível. Cada partida paga só uma vez: desfazer e vencer de novo não paga outra vez.

Testes: `cd app && npm run test:local`.

## Online pelo mundo (Supabase), inglês, bandeiras e compras reais

- **Servidor online no Supabase** (`supabase/`): banco com permissões (RLS), função de borda
  `arena` que valida cada lance com chess.js, fila por rating, convites, amizades, presença
  (quem está online), empate, desistência, relógio conferido no servidor, loja, bônus diário e
  moedas da IA. Eventos ao vivo pelo Realtime, com rede de segurança se um aviso se perder.
  Como ligar no seu projeto: **ONLINE.md**.
- **Inglês**: o app segue o idioma do aparelho (português → português; outros → inglês) e pode ser
  trocado em Configurações (`app/src/lib/i18n.tsx`, dicionários em `app/src/lib/i18n/`).
- **Bandeiras**: país detectado no cadastro (pode trocar em Configurações), bandeira ao lado do
  nome na partida, ranking, amigos, perfil e convites.
- **Compras reais**: os 12 itens lendários são vendidos pela Google Play / App Store
  (`app/src/lib/iap.ts`, conferência no servidor em `supabase/functions/arena/purchases.ts`).
- **Testes** (workflow *Servidor online (Supabase)*): banco (PGlite), conferência de compras (Deno),
  servidor completo num Supabase local com dois jogadores e o app web com um jogador em português
  e outro em inglês jogando ao vivo até o xeque-mate.

## Tabuleiro, regras e sons

- Casa a1 escura (padrão oficial: cada dama começa na casa da sua cor). Tabuleiro de ponta a ponta na tela.
- **Relógio contra a IA:** livre, 10, 5 ou 3 minutos. A IA gasta no máximo ~1/40 do tempo que lhe resta por lance. Online: 1, 3, 3+2, 5, 10 e 15+10.
- **Pré-lance:** na vez do adversário você já escolhe o próximo lance (casas em rosa); ele sai na hora se ainda for legal, senão é descartado. Tocar em outra casa cancela.
- **En passant:** ao selecionar o peão, a casa de destino e o peão que será capturado (contorno tracejado) ficam marcados; ao capturar aparece o aviso "En passant!".
- **Empates (como Lichess/Chess.com):** automáticos por afogamento, material insuficiente, repetição tripla e regra dos 50 lances; quem perde no tempo empata se o adversário não tiver material para dar mate. Proposta de empate: online o adversário aceita ou recusa; contra a IA ela aceita a partir do 10º lance se não estiver melhor (avaliação ≤ +0,3 peão para ela).
- **Sons** (síntese própria em `app/scripts/gen-sounds.mjs`): toc de madeira no tabuleiro, captura (peça contra peça + tabuleiro), xeque e xeque-mate. **Músicas originais** nas finalizações: phonk de cowbell no Movimento do 67, funk tamborzão no Passinho do Jamal e fanfarra 8 bits nos demais. Liga/desliga em **Configurações**. O app usa `expo-audio` sem permissão de microfone.

## Loja e moedas

| Como ganhar | Moedas |
|---|---|
| Conta nova | 300 |
| Bônus diário | 50 |
| Vitória / empate / derrota (ranqueada) | 30 / 15 / 5 (amistosa vale metade) |
| Subir de nível | +100 |
| Sequência de vitórias 🔥 | +10 na 3ª vitória seguida, +20 na 4ª… (máx. +50) |

Partidas contra a IA não dão moedas: elas rodam no aparelho e o servidor não teria como conferir o resultado.

Categorias (o preço sobe com a raridade: comum → raro → épico → lendário):

- **Tabuleiros** (0 a 3000): Madeira Clássica, Verde Torneio, Nogueira Entalhada, Oceano Profundo, Gelo Ártico, Confeitaria, Mármore Carrara, Neon Cyberpunk, Fliperama, Lava Vulcânica, Ouro Real, Fortaleza dos Cavaleiros, Galáxia. Além das cores, cada um tem **formato de casa** (lisa, ladrilho com rejunte, redonda, em relevo ou de vidro) e **borda no tema** (`app/src/components/FrameArt.tsx`): madeira com veios, ondas, neve e flocos, listras de doce, rocha com lava, céu estrelado, neon, ornamentos de ouro, rebites e a **muralha de castelo** com ameias, torres, bandeiras e ponte levadiça.
- **Peças** (0 a 2800): cada conjunto tem um **modelo próprio** — Clássicas (Staunton), Marfim e Ébano / Ouro e Prata (medieval: torre com bandeira, cúpulas, coroas com joias), Cristal / Rubi e Esmeralda / Fogo e Gelo (lapidadas), Doces (fofinhas, com rostinho), Robôs (LEDs e antenas), Pixel 8-bits, Neon / Sombras (moderno geométrico) e **Cavaleiros Medievais** (soldados de escudo, cavalos de guerra com penacho, monges, rainha de hennin e rei de armadura com espada; azul contra vermelho).
- **Prévia antes de comprar:** tabuleiros e peças abrem um tabuleiro grande onde dá para mexer as peças (com som) antes de comprar.
- **Ícones de perfil** (0 a 2500): aparecem nos amigos, no ranking, nos convites e na partida.
- **Bonecos** (0 a 3000): Novato (padrão), Estiloso, Descolado, Atleta, Ninja, Feiticeiro, Rei do Tabuleiro, Robô Dourado, Astronauta.
- **Movimentos especiais** (0 a 2200): Passinho do Jamal e Movimento do 67 (grátis), Giro Vitorioso, Aviãozinho, Dança do Robô, Muque, Voadora (chute que lança o rival), Mortal para Trás, Coroação (coroa e confete) e Fúria do Trovão (raios no rival).

O catálogo tem 57 itens e existe em duas cópias idênticas: `server/src/catalog.ts` e `app/src/lib/catalog.ts` (usada no modo local). Um teste do servidor falha se as duas divergirem.

O servidor é a fonte da verdade: confere o saldo, quem tem cada item e o que está equipado. O catálogo fica em `server/src/catalog.ts` e o app recebe dele os preços e os visuais.

## Finalização da partida (3D)

Em vitória ou derrota (online ou contra a IA), antes do resumo aparece uma cena 3D renderizada com **three.js sobre expo-gl** (WebGL2, funciona no iOS, no Android e na web):

1. os dois bonecos entram caminhando numa arena circular cujo piso usa as cores do seu tabuleiro;
2. o vencedor ataca (soco, voadora ou raio, conforme o movimento), com explosão de impacto e tremida de câmera, e o rival cai;
3. a câmera gira em volta do vencedor, que comemora entre confetes com o movimento especial equipado.

| Movimento | Comemoração |
|---|---|
| Passinho do Jamal | pra lá e pra cá, pés alternando, quadril e braços no contratempo |
| Movimento do 67 | antebraços à frente, palmas para cima, subindo e descendo alternados, com "6" e "7" em blocos luminosos 3D |
| Aviãozinho | braços abertos como asas, voando em círculo e inclinando nas curvas |
| Dança do Robô | poses travadas (muda de uma vez e segura), cotovelos em 90° |
| Mortal para Trás | agacha, salta, gira 360° encolhido e aterrissa amortecendo |
| Giro Vitorioso | giro com braços abertos |
| Muque | braços para cima "mostrando o muque" |
| Voadora | salto com chute que lança o rival, depois polichinelos |
| Coroação | uma coroa 3D cai do céu na cabeça do vencedor |
| Fúria do Trovão | raios em zigue-zague com clarão atingem o rival |

Em empate a cena não aparece. O botão "Pular" encerra a cena. Na loja, cada movimento tem prévia em 3D e a aba **Bonecos** tem um provador 3D.

**Como a animação funciona** (`app/src/three/anim.ts` e `clips.ts`): o boneco tem esqueleto articulado (pelve, coluna, pescoço, ombros, **cotovelos**, quadris e **joelhos**). Cada movimento é uma sequência de poses-chave interpolada por spline Catmull-Rom, com transições suaves entre movimentos. Os golpes usam antecipação (recuar antes), impacto e recuperação. Quem perde recebe o golpe: a cabeça vai para trás, ele cambaleia, os joelhos cedem e ele cai de costas.

**Bonecos**: modelados em blocos (cabeça, tronco, braços e pernas arredondados, com sombreamento cartoon). O padrão, *Novato*, tem cabeça e braços amarelos, camisa azul e calça verde. Os acessórios são peças 3D (boné, cabelo, cartola, coroa, faixa ninja, capacete de astronauta) e há cinco rostos (sorriso, risada, óculos escuros, máscara, visor).

## Notificações

Ficam salvas no servidor e chegam em tempo real pelo Socket.IO: aviso rápido na tela e contador no sininho da tela inicial.

Tipos: boas-vindas, pedido de amizade, amizade aceita, desafio perdido (convite expirou), resultado da partida (rating e moedas), subida de nível e bônus resgatado. Tocar numa notificação leva à tela relacionada.

## Segurança: JWT e HTTPS

**JWT**
- Em produção o servidor **não inicia** sem `JWT_SECRET` com pelo menos 32 caracteres, e recusa valores de exemplo. Gere um com `openssl rand -base64 48`.
- Algoritmo fixo `HS256` (bloqueia o ataque de `alg: none` e a troca de algoritmo), `issuer` e `audience` conferidos, expiração de 7 dias.
- `tokenVersion` no usuário: **"Sair de todos os aparelhos"** (em Configurações) invalida todos os tokens na hora.
- No celular o token fica no **Keychain (iOS) / Keystore (Android)** via `expo-secure-store`.
- Login e cadastro aceitam no máximo 20 tentativas a cada 15 minutos por IP, e a senha precisa ter no mínimo 8 caracteres.

**HTTPS**
- Em produção, toda requisição HTTP é redirecionada (308) para HTTPS, com HSTS de 1 ano e cabeçalhos de segurança (`helmet`). O redirecionamento usa `PUBLIC_HOST` e não o cabeçalho `Host`, que pode ser forjado.
- O servidor não inicia em produção sem uma das opções abaixo:
  - **Proxy reverso (recomendado):** `deploy/docker-compose.yml` sobe o servidor atrás do **Caddy**, que emite e renova o certificado do Let's Encrypt sozinho:
    ```bash
    cd deploy && cp .env.example .env   # preencha DOMAIN e JWT_SECRET
    docker compose up -d --build
    ```
  - **TLS direto no Node:** `TLS_CERT_FILE` + `TLS_KEY_FILE` (e `HTTP_REDIRECT_PORT=80` para redirecionar).
- **App:** `app.config.ts` com `APP_ENV=production` (perfil `production` do `eas.json`) remove as exceções de HTTP, então iOS (ATS) e Android passam a bloquear conexões sem TLS. Além disso, builds de produção recusam qualquer servidor `http://`. Em desenvolvimento o HTTP continua liberado para a rede local.

## Testes

```bash
cd server && npm test        # 14 testes: partidas, Elo, loja, moedas, notificações, ataques ao JWT, HTTPS real com certificado
cd app && npm run test:ai    # motor: perft em 5 posições de referência, mate em 1, partidas completas
cd app && npm run typecheck
```

## Regras do sistema online

| Item | Como funciona |
|---|---|
| Rating inicial | 1000 (Nível 3 · Amador) |
| Elo | K = 40 nas primeiras 30 partidas, depois 20 (10 acima de 2400) |
| Níveis | 0 / 800 / 1000 / 1200 / 1400 / 1600 / 1800 / 2000 / 2200 / 2400 |
| Matchmaking | mesmo ritmo, diferença de rating de ±100, ampliada em 25 por segundo de espera (máx. ±800) |
| Ritmos | 1+0, 3+2, 5+0, 10+0, 15+10 |
| Início | o relógio só corre depois do 1º lance de cada lado; sem lance em 30 s a partida é cancelada (sem rating) |
| Queda de conexão | 60 s para reconectar, senão derrota por abandono |
| Tempo esgotado | derrota, ou empate se o adversário não tiver material para dar mate |
| Convites | só entre amigos (ou revanche), expiram em 60 s |

## A IA

O motor foi otimizado para o Hermes (interpretador JavaScript do celular): nada é alocado durante a busca, e há busca PVS com redução de lances tardios. Na mesma profundidade, ficou cerca de 4,7× mais rápido que a versão anterior, e venceu a versão antiga por 6 a 2. No app, a IA calcula em trechos (a tela não congela) e "pensa" por um intervalo natural de 0,9 a 1,6 s antes de jogar. As peças deslizam até a casa de destino. Medição: `cd app && npm run bench:ai`.


Motor próprio em `app/src/ai/engine.ts` (não usa biblioteca externa): tabuleiro 0x88, hash Zobrist, negamax com poda alfa-beta, aprofundamento iterativo, busca de quiescência, tabela de transposição, null-move pruning, ordenação MVV-LVA/killers/history e avaliação com tabelas peça-casa, par de bispos e estrutura de peões. A geração de lances é validada por **perft**.

| Nível | Nome | Elo aprox. | Como joga |
|---|---|---|---|
| 1 | Peão Curioso | 400 | profundidade 1, muito ruído, 25% de lances aleatórios |
| 2 | Cavalo Aprendiz | 800 | profundidade 2, ruído médio |
| 3 | Bispo Estrategista | 1200 | profundidade 3, pouco ruído |
| 4 | Torre Implacável | 1600 | até 6 lances à frente, 1,5 s |
| 5 | Dama Mestra | 2000 | busca completa, 3 s |

## Para produção

- Trocar o banco JSON (`server/src/db.ts`) por Postgres mantendo a mesma interface
- Notificações push com o app fechado (`expo-notifications` + tokens de push no servidor). Hoje as notificações chegam com o app aberto e ficam guardadas na central.
- Rodar a cena 3D num aparelho Android de entrada para calibrar a qualidade (ex: desligar o antisserrilhado `msaaSamples` em aparelhos fracos)
- Compra de moedas com dinheiro real (exige a loja da Apple/Google: StoreKit / Play Billing)
- Rodar a IA em uma thread separada (ex.: `react-native-worklets`) para os níveis mais fortes não travarem a interface em aparelhos lentos
- Gerar os builds com `npx eas-cli@latest build`
