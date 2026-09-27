<p align="center">
  <img src="img/ico-sem-fundo.png" alt="PKS Codex" width="180" />
</p>

<h1 align="center">PKS Codex</h1>

<p align="center">
  O companheiro de bolso para quem joga RPG de mesa.<br/>
  Fichas de personagem, campanhas, bestiário, lojas, batalhas por turnos e subida de nível — tudo em um só app.
</p>

<p align="center">
  <img alt="Expo" src="https://img.shields.io/badge/Expo-SDK%2057-000020?logo=expo" />
  <img alt="React Native" src="https://img.shields.io/badge/React%20Native-0.86-61DAFB?logo=react" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript" />
  <img alt="Firebase" src="https://img.shields.io/badge/Firebase-Auth%20%2B%20Firestore-FFCA28?logo=firebase" />
  <img alt="Plataforma" src="https://img.shields.io/badge/plataforma-Android%20%7C%20iOS-3DDC84" />
</p>

---

## Sumário

- [Sobre](#sobre)
- [Funcionalidades](#funcionalidades)
  - [Para jogadores](#-para-jogadores-personagem)
  - [Para o Mestre](#-para-o-mestre-codex)
  - [Batalhas](#️-batalhas)
  - [Extras](#-extras)
- [Regras do sistema](#regras-do-sistema)
- [Instalação rápida (APK)](#instalação-rápida-apk)
- [Rodando o projeto](#rodando-o-projeto)
- [Configurando o Firebase](#configurando-o-firebase)
- [Scripts](#scripts)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Testes](#testes)

---

## Sobre

O **PKS Codex** nasceu para tirar o papel, a borracha e as planilhas da mesa de RPG. Ao abrir o app, você escolhe como quer começar:

| 🛡️ **Personagem** | 📜 **Mestre** |
| --- | --- |
| Crie até 5 heróis, entre em uma campanha com um código e acompanhe vida, mana, estamina, XP, inventário e ouro. | Crie um **Codex** (campanha) com monstros, lojas e habilidades, conduza batalhas e distribua recompensas. |

Os dados ficam salvos no aparelho e são sincronizados em tempo real pelo Firebase, então Mestre e jogadores veem a mesma batalha ao mesmo tempo, cada um no seu celular.

## Funcionalidades

### 🛡️ Para jogadores (Personagem)

- **Fichas completas** — nome, idade, raça (livre, porque cada mundo tem as suas) e foto tirada pela câmera ou escolhida da galeria.
- **Vida, mana e estamina** com barras em pixel art que esvaziam conforme o valor.
- **Atributos personalizáveis** — começa com Força, Agilidade e Inteligência, mas você pode criar os seus.
- **Inventário** com quantidade e descrição de cada item.
- **Ouro** para gastar nas lojas da campanha.
- **Nível e XP** — a barra de experiência enche até a próxima subida de nível.
- **Entrar em uma campanha** digitando o código curto do Codex.
- **Habilidades oferecidas pelo Mestre** — o jogador aceita ou recusa cada oferta.
- **Até 5 personagens** por jogador.

### 📜 Para o Mestre (Codex)

- **Criação de campanhas** com nome, descrição e código de convite.
- **Bestiário pronto** com monstros pré-gerados, cada um com vida, armadura, habilidades e loot:
  Goblin Saqueador 👺, Lobo das Sombras 🐺, Esqueleto Guerreiro, Orc Berserker, Aranha Gigante, Troll da Ponte, Mímico e Dragão Vermelho Jovem.
- **Monstros personalizados** com foto, habilidades próprias e itens que caem quando ele é derrotado.
- **Lojas** (Loja de Armas, Loja Geral, Loja de Poções ou criadas do zero), com preço por item e visibilidade escolhida por personagem.
- **Editor de habilidades** — mágicas (custam mana) ou físicas (custam estamina), com dano base em notação de dados (ex.: `2d6 + 3`) e chance de aplicar status.
- **Subida de nível guiada** — quando um personagem sobe de nível, o Mestre define as recompensas: mais vida, mana ou estamina, pontos em atributos, novos atributos, novas habilidades e uma anotação.

### ⚔️ Batalhas

- **Até 4 monstros por batalha**, cada um com vida, status, balão, iniciativa e turno próprios. O jogador escolhe qual monstro atacar e a vitória vem quando todos caem.
- **Ordem de turnos por iniciativa** (d20 para cada personagem e cada monstro), com rodadas e indicação de quem está jogando.
- **Ações do jogador:** ataque físico, usar habilidade, usar item, **Defender**, **Observar** (revela armadura e habilidades do monstro escolhido) e **Fugir**.
- **Armadura:** o dado do ataque precisa ser maior ou igual à armadura do alvo. Se não for, o ataque erra na hora (o custo da habilidade é gasto mesmo assim). Habilidades sem dano, como cura, não dependem da armadura.
- **Defender:** o próximo ataque de monstro causa metade do dano, até o próximo turno do personagem.
- **Rolagem de dados** d4, d6, d8, d10, d12 e d20 direto na tela, com o resultado registrado no log.
- **Status automáticos**, aplicados pelo sistema e que o Mestre não pode alterar:

  | Status | Efeito |
  | --- | --- |
  | 🧪 Veneno | 1d4 de dano por turno, por 3 turnos |
  | 🔥 Queimadura | 1d6 de dano por turno, por 2 turnos |
  | ❄️ Congelamento | perde o próximo turno |
  | 💫 Atordoamento | perde o próximo turno |

- **Cenários em pixel art** escolhidos pelo Mestre: planície, deserto, gelo, floresta e mar (de dia e à noite) e catacumbas.
- **Balão de cada monstro** mostrando a habilidade que ele vai usar e sua condição (ex.: "Furioso").
- **Efeitos visuais:** o alvo treme e pisca ao tomar dano ou ser curado, com o número flutuando ("−7", "+5", "Errou!"), o dado virtual gira antes de parar e o "Seu turno!" pulsa. As animações respeitam a opção "Remover animações" do aparelho.
- **Log de combate** colorido por tipo: dano, cura, status e dados.
- **XP proporcional ao dano** no fim da batalha e **Espólios** com os itens de todos os monstros derrotados, pegos em turnos pelos personagens vivos.

### ✨ Extras

- **Widget na tela inicial (Android)** com vida, mana, estamina, nível e ouro do seu personagem.
- **Modo demonstração** — cria 3 personagens e um Codex com monstros, lojas, habilidades e uma batalha em andamento para explorar o app sem configurar nada.
- **Galeria visual** com a paleta de cores, os ícones em pixel art e todos os componentes do app para testar.
- **Tema escuro** com paleta medieval: Carmesim, Dourado Antigo, Preto Carvão, Pergaminho, Grafite e Ardósia.

## Regras do sistema

| Regra | Valor |
| --- | --- |
| Personagem novo | 20 de vida · 10 de mana · 10 de estamina · 100 de ouro · nível 1 |
| Atributos iniciais | Força, Agilidade e Inteligência com valor 10 |
| XP para subir de nível | `nível atual × 100` |
| Custo das habilidades | mágica → mana · física → estamina |
| Divisão de XP | quem causou mais dano recebe o máximo e quem não causou dano recebe o mínimo. Quem morreu ou fugiu recebe o mínimo. |
| Acertar um monstro | dado do ataque ≥ armadura do monstro |
| Defender | metade do dano do próximo ataque (arredondado para baixo) |
| Fugir | d20 ≥ 10 |
| Monstros por batalha | até 4 |

As regras ficam em [`pks-codex-app/src/lib/rules.ts`](pks-codex-app/src/lib/rules.ts) e o motor de batalha em [`pks-codex-app/src/lib/engine.ts`](pks-codex-app/src/lib/engine.ts).

## Instalação rápida (APK)

Na raiz do repositório há builds prontos para Android:

| Arquivo | Para quem |
| --- | --- |
| `PKS-Codex-arm64.apk` | A maioria dos celulares Android atuais (arquivo menor) |
| `PKS-Codex.apk` | Qualquer celular Android, inclusive os mais antigos (ARM 32 e 64 bits); não roda em emulador x86 |

Copie o APK para o celular, abra o arquivo e permita a instalação de fontes desconhecidas quando o Android pedir.

## Rodando o projeto

O app fica na pasta [`pks-codex-app/`](pks-codex-app/).

**Pré-requisitos**

- [Node.js](https://nodejs.org/) 20 ou superior
- [Android Studio](https://developer.android.com/studio) com o Android SDK (para emulador ou build nativo)
- Um projeto no [Firebase](https://console.firebase.google.com/) (veja a seção abaixo)

**Passo a passo**

```bash
cd pks-codex-app
npm install
cp .env.example .env      # preencha com os dados do Firebase
npx expo start            # a = Android · r = recarregar · j = debug
```

> **Expo Go × build nativo:** o Expo Go roda o app, mas não inclui o widget da tela inicial. Para ter o app completo, gere um build nativo com `npx expo run:android`.

## Configurando o Firebase

O app usa **login anônimo** e o **Cloud Firestore** para sincronizar personagens e campanhas.

1. Crie um projeto no Console do Firebase.
2. Ative **Authentication → Anônimo**.
3. Crie um banco **Cloud Firestore**.
4. Registre um app **Web** e copie a configuração para o `.env`:

   ```env
   EXPO_PUBLIC_FIREBASE_API_KEY=
   EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
   EXPO_PUBLIC_FIREBASE_PROJECT_ID=
   EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
   EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
   EXPO_PUBLIC_FIREBASE_APP_ID=
   ```

5. Publique as regras de segurança:

   ```bash
   npx firebase-tools deploy --only firestore:rules
   ```

As regras em [`firestore.rules`](pks-codex-app/firestore.rules) garantem que:

- só o dono edita ou apaga a própria ficha e o próprio Codex;
- o Mestre e os colegas de campanha podem aplicar dano, cura, XP e recompensas nas fichas do Codex;
- para entrar em uma campanha, a única alteração permitida é o jogador se adicionar à lista de membros.

## Scripts

Os scripts em PowerShell ficam em [`pks-codex-app/scripts/`](pks-codex-app/scripts/) e também estão disponíveis como configurações de execução no Android Studio.

| Comando | O que faz |
| --- | --- |
| `npm start` | Inicia o servidor do Expo |
| `npm run android` | Compila e abre o app nativo no Android |
| `npm test` | Compila e roda os testes |
| `npm run lint` | Roda o ESLint |
| `scripts/expo-start.ps1 [-Clear]` | Inicia o Expo (com `-Clear`, limpa o cache do Metro) |
| `scripts/expo-android.ps1 [-Avd Pixel_4]` | Liga o emulador, se necessário, e abre o app nele |
| `scripts/native-android.ps1` | Build nativo com o widget, instalado no aparelho |
| `scripts/prebuild.ps1` | Regenera a pasta `android/` a partir do `app.json` |
| `scripts/check.ps1` | Typecheck + testes |

## Estrutura do projeto

```
PKS_CODEX/
├── pks-codex-app/            # App principal (Expo + React Native)
│   ├── src/
│   │   ├── app/              # Telas (Expo Router: cada arquivo é uma rota)
│   │   │   ├── index.tsx         # Início: escolher Personagem ou Mestre
│   │   │   ├── personagens.tsx   # Lista de personagens
│   │   │   ├── personagem/       # Ficha, edição e loja do personagem
│   │   │   ├── mestre.tsx        # Lista de Codex do Mestre
│   │   │   ├── codex/            # Campanha, bestiário, lojas, habilidades, nível
│   │   │   ├── monstro/          # Editor de monstros
│   │   │   ├── batalha/          # Nova batalha e tela de combate
│   │   │   └── galeria.tsx       # Galeria visual dos componentes
│   │   ├── components/       # Componentes de UI, pixel art, batalha e editores
│   │   ├── lib/
│   │   │   ├── engine.ts         # Motor de batalha (funções puras)
│   │   │   ├── rules.ts          # Regras: dados, status, XP, valores iniciais
│   │   │   ├── presets.ts        # Monstros, lojas e habilidades prontos
│   │   │   ├── store.tsx         # Estado global + persistência local
│   │   │   ├── sync.ts           # Diferença entre estados para o Firestore
│   │   │   ├── firebase.ts       # Conexão com Auth e Firestore
│   │   │   └── types.ts          # Tipos do domínio
│   │   └── widget/           # Widget Android da tela inicial
│   ├── tests/                # Testes (node:test)
│   ├── scripts/              # Scripts PowerShell de desenvolvimento
│   ├── firestore.rules       # Regras de segurança do Firestore
│   └── app.json              # Configuração do Expo
├── img/                      # Logo do projeto
├── PKS-Codex*.apk            # Builds Android prontos
└── app/                      # Projeto Android nativo (Kotlin), ainda não usado pelo app
```

## Testes

O motor de batalha, a sincronização e os ícones em pixel art são funções puras e têm testes com o runner nativo do Node:

```bash
cd pks-codex-app
npm test            # ou: scripts/check.ps1 (typecheck + testes)
```

| Arquivo | Cobre |
| --- | --- |
| `tests/engine.test.js` | Iniciativa, turnos, vários monstros, armadura, defesa, custo de mana, status, fuga, espólios, XP, subida de nível, conversão de batalhas antigas e modo demonstração |
| `tests/push.test.js` | Quando as notificações push de turno e de nível são enviadas |
| `tests/sync.test.js` | Detecção de mudanças e sincronização dos documentos |
| `tests/pixel-shapes.test.js` | Desenho dos ícones em pixel art |

---

<p align="center">Feito com 🎲 para mestres e aventureiros.</p>
