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

- **Tabuleiros** (0 a 3000): Madeira Clássica, Verde Torneio, Nogueira Entalhada, Oceano Profundo, Mármore Carrara, Neon Cyberpunk, Ouro Real, Galáxia. Os mais caros têm moldura e decoração (veios, mármore, grade neon, brilho, estrelas).
- **Peças** (0 a 2800): Clássicas, Marfim e Ébano, Cristal, Rubi e Esmeralda, Neon, Ouro e Prata, Fogo e Gelo.
- **Ícones de perfil** (0 a 2500): aparecem nos amigos, no ranking, nos convites e na partida.
- **Bonecos** (0 a 3000): Recruta (padrão), Estiloso, Descolado, Ninja, Feiticeiro, Rei do Tabuleiro, Astronauta.
- **Movimentos especiais** (0 a 2200): Passinho do Jamal e Movimento do 67 (grátis), Giro Vitorioso, Muque, Voadora (chute que lança o rival), Coroação (coroa e confete) e Fúria do Trovão (raios no rival).

O servidor é a fonte da verdade: confere o saldo, quem tem cada item e o que está equipado. O catálogo fica em `server/src/catalog.ts` e o app recebe dele os preços e os visuais.

## Finalização da partida (3D)

Em vitória ou derrota (online ou contra a IA), antes do resumo aparece uma cena 3D renderizada com **three.js sobre expo-gl** (WebGL2, funciona no iOS, no Android e na web):

1. os dois bonecos entram caminhando numa arena circular cujo piso usa as cores do seu tabuleiro;
2. o vencedor ataca (soco, voadora ou raio, conforme o movimento), com explosão de impacto e tremida de câmera, e o rival cai;
3. a câmera gira em volta do vencedor, que comemora entre confetes com o movimento especial equipado.

| Movimento | Comemoração |
|---|---|
| Passinho do Jamal | pra lá e pra cá, pés alternando, quadril e braços no contratempo |
| Movimento do 67 | mãos à frente subindo e descendo alternadas, com "6" e "7" em blocos luminosos 3D |
| Giro Vitorioso | giro com braços abertos |
| Muque | braços para cima "mostrando o muque" |
| Voadora | salto com chute que lança o rival, depois polichinelos |
| Coroação | uma coroa 3D cai do céu na cabeça do vencedor |
| Fúria do Trovão | raios em zigue-zague com clarão atingem o rival |

Em empate a cena não aparece. O botão "Pular" encerra a cena. Na loja, cada movimento tem prévia em 3D e a aba **Bonecos** tem um provador 3D.

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
