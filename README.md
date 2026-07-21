# BotFinancas - Controle Financeiro via WhatsApp

Bot inteligente de controle financeiro que permite gerenciar gastos e parcelas diretamente pelo WhatsApp, utilizando processamento de linguagem natural e arquitetura de dados otimizada.

![Node.js](https://img.shields.io/badge/Node.js-14+-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![WhatsApp](https://img.shields.io/badge/WhatsApp-API-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)

---

##  Visão Geral

Sistema MVP de controle financeiro que elimina a necessidade de aplicativos ou planilhas. O usuário envia uma mensagem simples como **"Sofá 900 3"** (produto, valor total, parcelas) e o bot automaticamente:
- Interpreta a mensagem
- Calcula o parcelamento
- Projeta as datas de vencimento
- Armazena os dados de forma segura
- Envia confirmação detalhada

---

##  Funcionalidades e Destaques Técnicos

###  **Processamento Inteligente**
- Interpretação de mensagens em linguagem natural
- Cálculo automático de parcelas com projeção temporal
- Suporte a compras que ultrapassam o ano civil (virada de ano automática)

###  **Arquitetura de Dados**
- **Isolamento total por usuário**: Cada usuário possui seu próprio arquivo `.json` (nomeado pelo número de telefone)
- **Privacidade garantida**: Dados nunca se misturam entre usuários
- **Performance otimizada**: Arquivos menores que 50KB garantem leitura/escrita instantânea via `JSON.parse()` e `JSON.stringify()`

###  **Gerenciamento de Concorrência Avançado**
- **Solução de Condição de Corrida**: Implementação de fila assíncrona em memória
- **Processamento sequencial**: Mensagens são processadas uma por uma usando array de fila e variável de controle `botEstaOcupado`
- **Integridade dos dados**: Garante que operações de escrita no JSON nunca se sobreponham

### **Motor de Datas**
- Uso do objeto nativo `Date()` do JavaScript com método `.setMonth()`
- Agrupamento de gastos por "gavetas temporais" no formato `ANO-MÊS` (ex: `"2026-07"`)
- Projeção automática de meses futuros em loops `for`

### **Rotina de Performance e Arquivamento**
- **Limpeza automática na virada de ano**: Dados de anos anteriores são movidos para `historico_YYYY.json`
- **Arquivo ativo otimizado**: Mantém apenas o ano corrente e parcelas futuras, garantindo performance constante

---

## Tecnologias Utilizadas

| Categoria | Tecnologias |
| :--- | :--- |
| **Runtime** | Node.js |
| **Linguagem** | JavaScript (ES6+) |
| **Integração** | WhatsApp API (WWebJS/whatsapp-web.js) |
| **Armazenamento** | File System (JSON) |
| **Conceitos** | Programação Assíncrona, Filas, Concorrência |

---

## Estrutura do Projeto
```text
bot-financas/
  ├── package.json       (Dependências e scripts do projeto)
  ├── financeiro.js      (Regras de negócio: parcelas e gerenciamento do JSON)
  ├── index.js           (Servidor principal e conexão com o WhatsApp)
  └── usuarios/          (O armário onde os arquivos são gravados)
       ├── 5511999999999.json
       └── 5511888888888.json
```
---

## 🔧 Como Executar

1. **Clone o repositório:**
   ```bash
   git clone https://github.com/Mephisto-G/BotFinancas.git
   cd BotFinancas
1. **Instale as dependências:**
2.    npm install
3.**Configure as variáveis de ambiente (se necessário):**
     Adicione credenciais da API do WhatsApp conforme documentação
4. **Execute o bot:**
     npm start
5. **Escaneie o QR Code:**
   O bot irá gerar um QR Code no terminal para vincular seu WhatsApp

 ## Como Usar
Envie mensagens no seguinte formato para o bot:
     <Descrição> <Valor Total> <Número de Parcelas>
Exemplos:
      Sofá 900 3 → Sofá em 3x de R$ 300,00
      Notebook 3600 12 → Notebook em 12x de R$ 300,00
      Mercado 450 1 → Mercado à vista R$ 450,00
O bot responderá com:
      Confirmação do lançamento
      Datas de vencimento de cada parcela
      Valor de cada parcela
