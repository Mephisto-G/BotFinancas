# 📊 Bot de Finanças Pessoais - WhatsApp

## 📋 Visão Geral

Este projeto é um bot de WhatsApp para controle de finanças pessoais. Ele permite que o usuário:

- Cadastre compras parceladas
- Consulte o histórico de gastos
- Calcule totais por mês ou geral
- Exclua produtos do histórico
- Envie comandos por texto ou áudio

O bot utiliza a API do Google Gemini para interpretar mensagens em linguagem natural. Caso a IA esteja indisponível ou não configurada, ele também possui um modo de segurança com comandos manuais separados por `|`.

---

## 🏗️ Arquitetura

```txt
Usuário envia mensagem no WhatsApp
        |
        v
index.js recebe a mensagem
        |
        v
Mensagem entra na fila de processamento
        |
        v
IA Gemini tenta interpretar a mensagem
        |
        +--> Se funcionar: executa a ação interpretada
        |
        +--> Se falhar: ativa o modo de segurança com comandos manuais
        |
        v
financeiro.js executa a ação:
- cadastrarCompraParcelada()
- consultar()
- calcular()
- excluir()
        |
        v
Dados são salvos/lidos em usuarios/{numero}.json
        |
        v
Bot responde no WhatsApp
```

---

## 📁 Estrutura de Arquivos

```txt
projeto/
├── index.js            # Servidor principal, conexão com WhatsApp, fila e IA
├── financeiro.js       # Lógica de negócio: cadastro, consulta, cálculo e exclusão
├── .env                # Variáveis de ambiente, como a chave da API do Gemini
├── package.json        # Dependências do projeto
└── usuarios/           # Pasta criada automaticamente para armazenar os dados
    └── {numero}.json   # Arquivo JSON com os dados de cada usuário
```

---

## ⚙️ Tecnologias Utilizadas

- Node.js
- whatsapp-web.js
- Google Gemini API
- FFmpeg
- dotenv
- qrcode-terminal
- fluent-ffmpeg

---

## 🔧 Instalação

### 1. Instale as dependências

```bash
npm install
```

### 2. Configure a variável de ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
GEMINI_API_KEY=sua_chave_da_api_aqui
```

Se a chave não estiver configurada ou estiver com o valor padrão, o bot entrará automaticamente no modo de segurança.

### 3. Inicie o bot

```bash
node index.js
```

Ao iniciar, um QR Code será exibido no terminal. Escaneie com o WhatsApp para conectar.

---

## 🤖 Como o Bot Interpreta Mensagens

O bot possui dois modos de funcionamento:

### Modo IA

Quando a chave do Gemini está configurada corretamente, o usuário pode enviar mensagens naturais, como:

```txt
Comprei um notebook de 3000 reais em 10 vezes
```

O Gemini interpreta a mensagem e extrai os dados automaticamente.

### Modo Segurança

Se a IA falhar ou não estiver configurada, o usuário pode enviar comandos manuais usando barra vertical `|`.

Exemplo:

```txt
Notebook | 3000 | 10
```

---

## 📝 Como Realizar Requisições ao Bot

## 1️⃣ Cadastrar uma compra

### Usando linguagem natural

Envie mensagens como:

```txt
Comprei um iPhone de 5000 em 12 vezes
```

```txt
Gastei 200 no mercado
```

```txt
Assinei a Netflix por 55 reais mensais
```

### Usando comando manual

Formato:

```txt
Produto | ValorTotal | Parcelas
```

Exemplos:

```txt
Notebook | 3000 | 10
```

```txt
Mercado | 200 | 1
```

```txt
Netflix | 55 | 1
```

Se a quantidade de parcelas não for informada no modo manual, o bot assume `1`.

Resposta esperada:

```txt
✅ Lançamento de *Notebook* (10x) cadastrado com sucesso!
```

---

## 2️⃣ Consultar histórico

### Usando linguagem natural

Exemplos:

```txt
Quero ver meu histórico
```

```txt
Me mostra meus gastos
```

```txt
Histórico do mês de agosto
```

```txt
Quero ver os gastos do mês 5
```

### Usando comando manual

Para consultar todos os meses:

```txt
consulta
```

Para consultar um mês específico:

```txt
consulta | 8
```

Exemplo de resposta:

```txt
📊 *HISTÓRICO DE COMPRAS - 5511999999999*

📅 *Mês: 2026-08*
🔹 *Produto:* Notebook
   *Valor da Parcela:* R$ 300.00
   *Parcela:* 1 de 10
----------------------------
🔹 *Produto:* Netflix
   *Valor da Parcela:* R$ 55.00
   *Parcela:* 1 de 1
----------------------------
```

---

## 3️⃣ Calcular totais

### Usando linguagem natural

Exemplos:

```txt
Quanto eu gastei esse mês?
```

```txt
Calcula meus gastos de agosto
```

```txt
Qual o total de tudo que eu já gastei?
```

### Usando comando manual

Para calcular todos os meses:

```txt
calcular
```

Para calcular um mês específico:

```txt
calcular | 8
```

Exemplo de resposta:

```txt
📊 *HISTÓRICO DE COMPRAS - 5511999999999*

💰 *Subtotal de 2026-08:* R$ 355.00

====== 📈 RESUMO GERAL ======
🔥 *Total acumulado de todos os meses:* R$ 355.00
```

---

## 4️⃣ Excluir um produto

### Usando linguagem natural

Exemplos:

```txt
Quero excluir o Notebook
```

```txt
Deleta a Netflix do meu histórico
```

```txt
Remove o mercado
```

### Usando comando manual

Formato:

```txt
excluir | NomeDoProduto
```

Exemplos:

```txt
excluir | Notebook
```

```txt
remover | Netflix
```

Resposta esperada:

```txt
[SUCESSO] Se o produto "Notebook" existia, ele foi removido do histórico.
```

---

## 5️⃣ Enviar comando por áudio

O bot também aceita mensagens de voz.

Fluxo:

1. O usuário envia um áudio no WhatsApp
2. O bot responde: `Ouvindo seu áudio, só um minutinho...`
3. O áudio é convertido para MP3 usando FFmpeg
4. O áudio é enviado para o Gemini transcrever
5. O texto transcrito entra na fila como uma mensagem normal
6. O bot executa a ação correspondente

Exemplo de áudio:

```txt
Comprei uma TV de 2000 reais em 5 vezes
```

O bot transcreve e cadastra automaticamente.

---

## 📦 Estrutura do JSON por Usuário

Cada usuário possui um arquivo dentro da pasta `usuarios`.

Exemplo:

```json
{
  "nome": "5511999999999",
  "meses": {
    "2026-08": [
      {
        "produto": "Notebook",
        "valorParcela": 300.00,
        "parcelaAtual": 1,
        "totalParcelas": 10
      },
      {
        "produto": "Netflix",
        "valorParcela": 55.00,
        "parcelaAtual": 1,
        "totalParcelas": 1
      }
    ],
    "2026-09": [
      {
        "produto": "Notebook",
        "valorParcela": 300.00,
        "parcelaAtual": 2,
        "totalParcelas": 10
      }
    ]
  }
}
```

---

## 🧠 Interpretação da IA

A IA recebe a mensagem do usuário e tenta retornar um JSON estruturado.

Exemplos de retorno:

### Cadastro

```json
{
  "acao": "cadastrar",
  "produto": "Notebook",
  "valor": 3000,
  "parcelas": 10
}
```

### Consulta geral

```json
{
  "acao": "consulta",
  "mes": null
}
```

### Consulta de mês específico

```json
{
  "acao": "consulta",
  "mes": 8
}
```

### Cálculo geral

```json
{
  "acao": "calcular",
  "mes": null
}
```

### Cálculo de mês específico

```json
{
  "acao": "calcular",
  "mes": 8
}
```

### Exclusão

```json
{
  "acao": "excluir",
  "produto": "Notebook"
}
```

### Erro de interpretação

```json
{
  "erro": true
}
```

---

## 🔄 Fluxo de Processamento

```txt
Mensagem recebida
      |
      v
É áudio?
      |
      +--> Sim: converte, transcreve e coloca na fila
      |
      +--> Não: coloca direto na fila
      |
      v
IA disponível?
      |
      +--> Sim: Gemini interpreta a mensagem
      |
      +--> Não: ativa modo segurança
      |
      v
Modo segurança separa por "|"
      |
      v
Ação identificada:
- cadastrar
- consulta
- calcular
- excluir
      |
      v
Função correspondente é executada
      |
      v
Bot envia resposta ao usuário
```

---

## 🛡️ Tratamento de Erros

| Situação | Comportamento |
|---|---|
| IA indisponível | Ativa modo segurança com comandos manuais |
| Comando manual inválido | Envia mensagem de ajuda |
| Usuário sem histórico | Informa que não há compras cadastradas |
| Mês sem registros | Informa que não encontrou gastos |
| Erro no áudio | Informa falha no processamento |
| Mensagem antiga | Ignora mensagens com mais de 10 segundos |
| Mensagem de grupo | Ignora |
| Mensagem do próprio bot | Ignora |

---

## 📌 Resumo Rápido de Comandos

| Ação | Linguagem Natural | Comando Manual |
|---|---|---|
| Cadastrar | `Comprei um notebook de 3000 em 10 vezes` | `Notebook | 3000 | 10` |
| Consultar tudo | `Quero ver meu histórico` | `consulta` |
| Consultar mês | `Quero ver os gastos de agosto` | `consulta | 8` |
| Calcular tudo | `Quanto eu gastei?` | `calcular` |
| Calcular mês | `Quanto gastei em agosto?` | `calcular | 8` |
| Excluir | `Deleta o Notebook` | `excluir | Notebook` |

---

## ⚠️ Observações Importantes

- O bot funciona apenas em conversas privadas.
- Mensagens de grupos são ignoradas.
- Mensagens do próprio bot são ignoradas.
- Mensagens antigas, com mais de 10 segundos, são ignoradas.
- O bot utiliza fila para processar mensagens sequencialmente.
- O FFmpeg precisa estar instalado no sistema para processamento de áudio.
- A chave da API do Gemini deve estar no arquivo `.env`.

---

## 🚀 Como Usar Depois de Conectar

Após escanear o QR Code, basta enviar mensagens para o número do WhatsApp onde o bot está conectado.

Exemplos:

```txt
Comprei um celular de 2000 em 5 vezes
```

```txt
consulta
```

```txt
calcular | 8
```

```txt
excluir | Celular
```

```txt
Quanto eu gastei no mês atual?
```
