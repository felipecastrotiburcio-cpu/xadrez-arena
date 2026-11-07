# Xadrez Arena no iPhone e iPad

O mesmo código do app Android roda no iOS (React Native + Expo). A cada mudança no
ramo `main`, o GitHub compila o app num Mac (workflow **App iOS**), testa no simulador
de iPhone e publica o arquivo **xadrez-arena-ios.ipa** em
[Releases](https://github.com/felipecastrotiburcio-cpu/xadrez-arena/releases)
(nas versões com nome "Xadrez Arena iOS").

- iOS mínimo: **16.4** (iPhone 8 ou mais novo) · iPad em tela cheia, em pé.
- Não pede microfone, câmera, localização nem Face ID.

## Jeito mais fácil: versão web (só o iPhone, grátis)

Endereço: **https://felipecastrotiburcio-cpu.github.io/xadrez-arena/**

1. Abra o endereço no **Safari** do iPhone.
2. Toque em **Compartilhar** (quadrado com seta para cima) → **Adicionar à Tela de Início** → **Adicionar**.
3. Abra pelo ícone **Xadrez Arena** na tela de início: ele abre em tela cheia, como um app.

- Depois de aberto uma vez, funciona **sem internet** (IA, loja, contas, finalizações 3D).
- Contas e moedas ficam salvas no próprio iPhone (no app da tela de início). Apagar o ícone
  apaga esses dados.
- Atualiza sozinho: a cada mudança no projeto o workflow **Site (versão web / iPhone)** publica
  a versão nova.
- **Configuração única** (dono do repositório): GitHub → **Settings → Pages → Build and
  deployment → Source: GitHub Actions**. Depois, Actions → "Site (versão web / iPhone)" →
  **Run workflow**.

## Por que o arquivo .ipa não instala direto?

A Apple só deixa instalar apps **assinados** por uma conta Apple. Diferente do Android,
não existe "permitir fontes desconhecidas". Por isso há dois caminhos:

## Caminho 1 — Grátis, com o seu Apple ID (precisa de um computador)

1. Baixe o **xadrez-arena-ios.ipa** em Releases.
2. Instale o **Sideloadly** (sideloadly.io, Windows ou Mac) e o iTunes/Dispositivos Apple.
3. Ligue o iPhone no computador pelo cabo e arraste o .ipa para o Sideloadly.
4. Digite o seu Apple ID e clique em **Start**. O Sideloadly assina e instala o app.
5. No iPhone: **Ajustes → Geral → VPN e Gerenciamento de Dispositivos** → toque no seu
   Apple ID → **Confiar**. No iOS 16 ou mais novo, ative também
   **Ajustes → Privacidade e Segurança → Modo de Desenvolvedor** (o iPhone reinicia).

Limites da Apple para contas grátis: o app **expira em 7 dias** (é só repetir os passos;
contas e moedas salvas no aparelho continuam) e no máximo 3 apps assim por vez.

## Caminho 2 — TestFlight (recomendado para distribuir para amigos)

Precisa do **Apple Developer Program** (US$ 99 por ano, developer.apple.com) em uma conta
**pessoal**. Depois de configurar uma vez, cada compilação vai sozinha para o TestFlight:

1. Em [App Store Connect](https://appstoreconnect.apple.com) → **Apps** → **+** → Novo app:
   nome "Xadrez Arena", ID do pacote **app.xadrezarena** (registre-o antes em
   Certificates, Identifiers & Profiles → Identifiers, se ele não aparecer na lista).
2. Em **Usuários e Acesso → Integrações → App Store Connect API**, crie uma chave com
   acesso **App Manager**. Anote o **Key ID** e o **Issuer ID** e baixe o arquivo `.p8`
   (só pode ser baixado uma vez).
3. Descubra o **Team ID** em developer.apple.com → Account → Membership.
4. No GitHub do projeto: **Settings → Secrets and variables → Actions → New repository secret**
   e crie:

   | Segredo | Valor |
   |---|---|
   | `APPLE_TEAM_ID` | Team ID (10 caracteres) |
   | `ASC_KEY_ID` | Key ID da chave |
   | `ASC_ISSUER_ID` | Issuer ID |
   | `ASC_KEY_P8_BASE64` | conteúdo do `.p8` em base64 (`base64 -i AuthKey_XXXX.p8` no Mac, ou `certutil -encode` no Windows, sem as linhas BEGIN/END) |

5. Em **Actions → App iOS → Run workflow**. O passo "Enviar para o TestFlight" assina o app
   e envia; em 5–30 minutos ele aparece no App Store Connect → TestFlight.
6. Adicione testadores (você e amigos) em TestFlight e instale pelo app **TestFlight** do iPhone.
   As versões de TestFlight valem 90 dias.

Esse passo **nunca foi executado de verdade**: ele só roda quando os segredos existem.
Na primeira vez, confira o log da Action; erros comuns são o app ainda não criado no
App Store Connect ou a chave sem permissão App Manager.

## Publicar na App Store

Com o TestFlight funcionando, basta preencher a ficha do app no App Store Connect
(descrição, capturas de tela, classificação etária, política de privacidade) e enviar
para revisão. Para isso o servidor online precisa estar no ar, porque a Apple testa as
funções que o app anuncia.
