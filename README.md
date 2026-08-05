📊 Bot de Finanças Pessoais - WhatsApp
📋 Visão Geral
Bot de WhatsApp para controle de finanças pessoais que permite cadastrar compras parceladas, consultar histórico, excluir registros e calcular totais de gastos. O bot interpreta mensagens em linguagem natural usando a API do Google Gemini e possui um modo de segurança com comandos manuais caso a IA esteja indisponível.

🏗️ Arquitetura
┌─────────────────────────────────────────────────────┐
│                   WhatsApp (Usuário)                 │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│              index.js (Servidor Principal)           │
│  ┌───────────────────────────────────────────────┐  │
│  │  Captura de Mensagens (texto e áudio)         │  │
│  │  Fila de Processamento (concorrência)         │  │
│  │  Interpretação via Gemini AI                  │  │
│  │  Modo Segurança (fallback com |)              │  │
│  └───────────────────────────────────────────────┘  │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│            financeiro.js (Lógica de Negócio)        │
│  ┌───────────────────────────────────────────────┐  │
│  │  cadastrarCompraParcelada()                   │  │
│  │  consultar()                                  │  │
│  │  excluir()                                    │  │
│  │  calcular()                                   │  │
│  └───────────────────────────────────────────────┘  │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│           /usuarios/{numero}.json (Storage)         │
└─────────────────────────────────────────────────────┘

📁 Estrutura de Arquivos

projeto/
├── index.js            # Servidor principal, conexão WhatsApp, fila, IA
├── financeiro.js       # Lógica de negócio (CRUD de finanças)
├── .env                # Variáveis de ambiente (GEMINI_API_KEY)
├── package.json        # Dependências do projeto
└── usuarios/           # Pasta criada automaticamente
    └── {numero}.json   # Dados de cada usuário

🤖 Como o Bot Interpreta Mensagens

O bot possui dois modos de operação:
Modo 1: Inteligência Artificial (Gemini)
Quando a chave da API está configurada, o bot envia a mensagem do usuário para o Gemini interpretar em linguagem natural. O usuário pode falar naturalmente:
"Comprei um notebook de 3000 reais em 10 vezes"
O Gemini extrai os dados e retorna um JSON estruturado.
Modo 2: Segurança (Comandos Manuais)
Se a IA falhar ou não estiver configurada, o bot aceita comandos separados por barra vertical (|):
Notebook | 3000 | 10

📝 Como Realizar Requisições ao Bot
1️⃣ CADASTRAR UMA COMPRA
Via Linguagem Natural (IA)
Envie qualquer mensagem descrevendo a compra:
Comprei um iPhone de 5000 em 12 vezes
Gastei 200 no mercado
Assinei a Netflix por 55 reais mensais

Via Comando Manual
Produto | ValorTotal | Parcelas

Exemplos:
Notebook | 3000 | 10
Mercado | 200 | 1
Netflix | 55 | 1

Resposta do bot:
✅ Lançamento de *Notebook* (10x) cadastrado com sucesso!


