# 💰 BotFinanças — Bot de Finanças Pessoais via WhatsApp

![Node.js](https://img.shields.io/badge/Node.js-14%2B-green?logo=nodedotjs&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6%2B-yellow?logo=javascript&logoColor=white)
![WhatsApp](https://img.shields.io/badge/WhatsApp-API-25D366?logo=whatsapp&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-Banco%20Local-blue?logo=sqlite&logoColor=white)
![Google Gemini](https://img.shields.io/badge/Google%20Gemini-IA-4285F4?logo=google&logoColor=white)
![Raspberry Pi](https://img.shields.io/badge/Raspberry%20Pi-Compatível-A22846?logo=raspberrypi&logoColor=white)

Bot pessoal de finanças que roda no **WhatsApp** (ideal para **Raspberry Pi**): você manda mensagem de **texto ou áudio**, a IA **Gemini** interpreta, e o bot **cadastra, consulta, calcula e exclui** suas compras parceladas — com persistência em **SQLite** e **backup automático**. 🎉

---

## 📋 Índice

- [🚀 Funcionalidades](#-funcionalidades)
- [🛠️ Tecnologias](#️-tecnologias)
- [📦 Pré-requisitos](#-pré-requisitos)
- [⚙️ Instalação](#️-instalação)
- [🔐 Configuração (.env)](#-configuração-env)
- [📁 Estrutura do Projeto](#-estrutura-do-projeto)
- [📲 Como Usar (comandos)](#-como-usar-comandos)
- [🗄️ Banco de Dados (SQLite)](#️-banco-de-dados-sqlite)
- [💾 Backup Automático](#-backup-automático)
- [🔁 Migração JSON → SQLite](#-migração-json--sqlite)
- [🔍 Consultas úteis no terminal](#-consultas-úteis-no-terminal)
- [🐛 Troubleshooting](#-troubleshooting)
- [🗺️ Roadmap](#️-roadmap)

---

## 🚀 Funcionalidades

### ✨ Principais
- 🤖 **Interpretação por IA (Gemini)**: entenda linguagem natural ("comprei uma geladeira de 1200 em 10x").
- 🎙️ **Transcrição de áudio**: mande mensagem de voz e o bot transcreve (FFmpeg + Gemini) e processa.
- 📬 **Fila sequencial de mensagens**: processa uma por vez, sem concorrência (`filaDeMensagens` + `botEstaOcupado`).
- ✅ **Cadastro de compras parceladas**: distribui automaticamente as parcelas nos meses seguintes.
- 🔍 **Consulta de histórico**: geral ou por mês específico.
- 🧮 **Cálculo de gastos**: subtotal por mês + total acumulado geral.
- 🗑️ **Exclusão de produtos**: remove todas as parcelas do item.
- 🛟 **Modo manual de segurança**: se a IA falhar/não existir, use comandos com `|`.

### Banco de Dados
- 🗄️ **Persistência em SQLite** (`better-sqlite3`).
- 🔗 **Modelo relacional**: tabelas `usuarios` ↔ `compras` ligadas por chave estrangeira (`usuario_id`).
- ⚡ **WAL mode** (`journal_mode = WAL`): mais performance e segurança contra corrupção.
- 💬 **Funções retornam mensagens**: o `financeiro.js` monta o texto (inclusive no cadastro e em validações de erro) e o `index.js` só entrega no WhatsApp.
- 🛡️ **Validação de entrada**: valores/parcelas inválidos retornam aviso amigável em vez de quebrar.
- 💾 **Backup automático**: a cada inicialização do bot, espera a fila esvaziar e copia o banco (com data no nome) para `/media/ps2share/backup`.


---

## 🛠️ Tecnologias

| Tecnologia | Uso |
|---|---|
| **Node.js (ES6+)** | Runtime do projeto |
| **whatsapp-web.js** | Conexão com o WhatsApp (QR Code) |
| **Google Gemini (`@google/genai`)** | Interpretação de texto e transcrição de áudio |
| **fluent-ffmpeg + FFmpeg** | Conversão de áudio (ogg → mp3) |
| **better-sqlite3** | Banco de dados SQLite síncrono e rápido |
| **qrcode-terminal** | QR Code de conexão no terminal |
| **dotenv** | Variáveis de ambiente (chave da API) |

---

## 📦 Pré-requisitos

- **Node.js 14+**
- **Chromium** (navegador para o whatsapp-web.js no Linux/Raspberry Pi)
- **FFmpeg** (conversão de áudio)
- **sqlite3 CLI** (opcional, para consultas manuais)
- **Chave da API do Google Gemini**

---

## ⚙️ Instalação

```bash
# 1. Entre na pasta do projeto
cd BotFinancas

# 2. Dependências do sistema (Debian/Raspberry Pi OS)
sudo apt update
sudo apt install chromium ffmpeg sqlite3

# 3. Dependências do Node
npm install whatsapp-web.js qrcode-terminal dotenv @google/genai fluent-ffmpeg better-sqlite3

# 4. Configure a chave da IA (veja seção .env)

# 5. Inicie o bot e escaneie o QR Code com o WhatsApp
node index.js
```

---

## 🔐 Configuração (.env)

Crie um arquivo `.env` na raiz do projeto:

```env
GEMINI_API_KEY=sua_chave_da_api_aqui
```

> Sem chave (ou se a IA falhar), o bot ativa automaticamente o **modo manual** com `|`.

---

## 📁 Estrutura do Projeto

```
BotFinancas/
├── index.js            # Bot: fila, IA, áudio, WhatsApp e backup
├── financeiro.js       # Camada de dados (SQLite: cadastrar/consultar/excluir/calcular + db)
├── financeiro.db       # Banco SQLite (gerado automaticamente)
├── .env                # Chave da API Gemini
└── README.md
```

---

## 📲 Como Usar (comandos)

### 🤖 Por linguagem natural (com IA)
| Ação | Exemplo de mensagem |
|---|---|
| Cadastrar | *"comprei uma geladeira de 1200 reais em 10 vezes"* |
| Consultar | *"quero ver meu histórico"* / *"compras de maio"* |
| Calcular | *"quanto eu gastei esse mês?"* |
| Excluir | *"apaga a geladeira do histórico"* |
| Áudio | 🎤 mande o áudio falando qualquer uma das ações acima |

### 🛟 Modo manual (fallback com `|`)
| Ação | Formato |
|---|---|
| Cadastrar | `Geladeira | 1200 | 10` |
| Consultar | `consulta | 8` *(ou só `consulta`)* |
| Calcular | `calcular | 8` *(ou só `calcular`)* |
| Excluir | `excluir | Geladeira` |

---

## 💾 Backup Automático

- 🔄 **Quando roda:** toda vez que o bot inicia (`node index.js`).
- ⏳ **Segurança:** espera a `filaDeMensagens` esvaziar **e** o bot ficar ocioso antes de copiar.
- 📦 **Como copia:** usa `db.backup()` (snapshot consistente do SQLite, mesmo com WAL).
- 📅 **Nome do arquivo:** com data → `financeiro_2026-08-06.db` (1 arquivo por dia; reinícios no mesmo dia sobrescrevem).
- 📍 **Destino:** `/media/ps2share/backup` (pasta criada automaticamente se não existir).
- 🛡️ **À prova de falhas:** se o share não estiver montado, o erro é apenas logado — **o bot não cai**.


## 🐛 Troubleshooting

| Problema | Solução |
|---|---|
| QR Code não aparece | Verifique se o Chromium está instalado (`/usr/bin/chromium`) |
| `no such table: compras` | Rode o bot uma vez (cria as tabelas) ou rode `node migrar.js` |
| Áudio não transcreve | Instale o FFmpeg (`sudo apt install ffmpeg`) |
| `[BACKUP] ❌ Falha` | Confira se `/media/ps2share` está montado na Raspberry Pi |
| `path is not defined` | Garanta `const path = require('path');` no `index.js` |
---

## 🗺️ Roadmap

- [ ] Nome customizado por usuário
- [ ] Índices no banco para buscas rápidas
- [ ] Backup com horário no nome (múltiplas versões por dia)
- [ ] Relatório mensal automático enviado no WhatsApp
- [ ] Dashboard web de acompanhamento

---

## 📄 Licença

Projeto pessoal de estudos — use e adapte à vontade.

