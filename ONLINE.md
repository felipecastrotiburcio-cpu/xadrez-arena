# Partidas online, bandeiras e compras reais — como ligar

O código do servidor online já está pronto e testado (`supabase/`). Para jogadores do mundo
inteiro jogarem entre si, ele precisa rodar num projeto **Supabase** seu. As compras com dinheiro
real precisam das contas de desenvolvedor do **Google Play** e da **Apple**.

Use contas **pessoais** (não da empresa).

---

## 1. Servidor online (Supabase) — grátis

1. Crie uma conta em **supabase.com** e clique em **New project**.
   - Nome: `xadrez-arena` · Região: **South America (São Paulo)** · Senha do banco: crie uma forte e **guarde**.
2. Pegue estes 4 dados:
   | Dado | Onde fica |
   |---|---|
   | **Reference ID** | Project Settings → General |
   | **Project URL** (`https://xxxx.supabase.co`) | Project Settings → API |
   | **anon public key** (ou *publishable key*) | Project Settings → API Keys |
   | **Access token** | Clique no seu avatar → Account → **Access Tokens** → Generate new token |
3. No GitHub do projeto: **Settings → Secrets and variables → Actions**.
   - Aba **Secrets** → *New repository secret* (ficam escondidos):
     - `SUPABASE_ACCESS_TOKEN` = access token
     - `SUPABASE_PROJECT_REF` = Reference ID
     - `SUPABASE_DB_PASSWORD` = senha do banco
   - Aba **Variables** → *New repository variable* (são públicos, vão dentro do app):
     - `SUPABASE_URL` = Project URL
     - `SUPABASE_ANON_KEY` = anon public key
4. GitHub → **Actions → Servidor online (Supabase) → Run workflow**. Ele testa tudo num Supabase
   de teste e depois publica o banco e a função `arena` no seu projeto.
5. Depois, rode também **APK Android**, **App iOS** e **Site (versão web / iPhone)**: as versões
   novas já saem ligadas ao servidor (contas online, fila, convites, amigos, bandeiras).

Plano grátis do Supabase: 500 MB de banco, 500 mil chamadas de função por mês e 200 conexões ao
vivo simultâneas — suficiente para começar. Projetos grátis sem uso por 7 dias são pausados
(é só reativar no painel).

**Como funciona por dentro**
- Contas: nome de usuário + senha (Supabase Auth; o nome vira um e-mail interno que não recebe nada).
- Cada lance é conferido no servidor com as regras do xadrez (chess.js): ninguém consegue trapacear.
- Rating Elo, moedas, níveis, sequência de vitórias e notificações: mesmas regras do servidor antigo.
- O app só **lê** o banco; moedas, itens e partidas só mudam pela função do servidor.
- Bandeira: o país vem do celular no cadastro e pode ser trocado em **Configurações**.

---

## 2. Compras reais (itens lendários)

Os 12 itens **lendários** (tabuleiros Ouro Real, Fortaleza dos Cavaleiros e Galáxia; peças Ouro e
Prata, Cavaleiros Medievais e Fogo e Gelo; ícones Coroa e Diamante; bonecos Rei do Tabuleiro,
Robô Dourado e Astronauta; movimento Fúria do Trovão) agora são vendidos com dinheiro real. O
**ID do produto** em cada loja é igual ao ID do item:

`board_royal`, `board_castle`, `board_galaxy`, `pieces_gold`, `pieces_knights`, `pieces_elements`,
`avatar_crown`, `avatar_diamond`, `char_king`, `char_golden_robot`, `char_astronaut`, `move_lightning`

Sugestão de preço: ícones R$ 4,90 · tabuleiros, peças e movimento R$ 9,90 · bonecos R$ 14,90
(cada loja converte para as outras moedas).

Compras reais **só funcionam no app instalado pela loja** (Play Store / App Store / TestFlight) e
com o servidor online ligado. Na versão web e no APK baixado do GitHub aparece o aviso
"compra no app".

### Google Play (US$ 25, pagamento único)
1. Crie a conta em **play.google.com/console** (conta Google pessoal) e crie o app
   **Xadrez Arena** com o pacote `app.xadrezarena`.
2. Envie uma versão para **Teste interno** (o Google exige o app publicado num canal de teste
   para vender itens). Para isso é preciso uma chave de assinatura própria — peça que eu configure
   o arquivo `.aab` assinado.
3. **Monetizar → Produtos → Produtos no app**: crie os 12 produtos com os IDs acima e ative.
4. Conferência das compras pelo servidor: no **Google Cloud** (mesma conta), crie uma *conta de
   serviço*, gere uma chave JSON e, no Play Console → **Usuários e permissões**, convide o e-mail
   da conta de serviço com permissão de **ver dados financeiros e gerenciar pedidos**.
5. No GitHub, crie o segredo `GOOGLE_SERVICE_ACCOUNT_JSON` com o conteúdo do arquivo JSON e rode
   de novo **Servidor online (Supabase)**.

### App Store (US$ 99/ano)
1. Conta **Apple Developer** pessoal; aceite o contrato **Paid Apps** e preencha banco/impostos em
   App Store Connect → *Business*.
2. Crie o app (ID `app.xadrezarena`) e, em **Monetização → Compras dentro do app**, crie os 12
   itens como **Não consumíveis** com os IDs acima.
3. Configure o envio para o TestFlight (veja **IOS.md**). A conferência das compras da Apple não
   precisa de chave extra: o servidor confere a assinatura da Apple em cada compra.

Botão **Restaurar compras** na loja do app: recupera itens comprados em outro aparelho (a Apple
exige esse botão).

---

## O que foi testado
- Banco e permissões: 42 verificações (PGlite).
- Conferência de compras da Apple com uma cadeia de certificados de teste (assinatura válida,
  adulterada, outro app, outro produto, reembolso, certificado vencido); a impressão digital da
  raiz da Apple é conferida contra o site da Apple a cada execução.
- Servidor completo num Supabase de teste no GitHub Actions, com dois jogadores: cadastro, fila,
  partida até o xeque-mate ao vivo, convites, amizades, empate, desistência, cancelamento por falta
  de lance, loja, bônus, moedas da IA e tentativas de trapaça.
- App web contra esse Supabase de teste: um jogador em português e outro em inglês se encontram e
  jogam ao vivo.
- **Não testado:** compra real nas lojas (exige as contas acima) e o servidor no seu projeto real.
