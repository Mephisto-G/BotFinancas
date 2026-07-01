# 📋 Especificação de Funcionamento: Bot de Controle Financeiro

O sistema foi projetado sob o modelo de MVP (Mínimo Produto Viável), focando em custo zero de infraestrutura, alta performance e segurança de dados por meio de isolamento de arquivos.

---

## 1. Fluxo de Experiência do Usuário (UI/UX)
* **Entrada:** O usuário envia uma mensagem de texto natural ou estruturada no WhatsApp.
  * *Exemplo:* "Sofá 900 3" (Produto, Valor Total, Parcelas).
* **Processamento:** O bot interpreta o texto, calcula o parcelamento e atualiza os dados.
* **Saída:** O bot envia uma mensagem de confirmação de volta no WhatsApp detalhando o lançamento.

---

## 2. Arquitetura de Dados (Isolamento por JSON)
* **Estrutura:** Não há banco de dados centralizado. Cada usuário possui um arquivo `.json` próprio cujo nome é o seu número de telefone (Ex: `5511999999999.json`).
* **Vantagens:** 
  * **Privacidade:** Os dados de um usuário nunca se misturam com os de outro.
  * **Performance:** Operações de leitura (`JSON.parse`) e escrita (`JSON.stringify`) ocorrem em arquivos minúsculos (geralmente menores que 50 KB), tornando o processamento instantâneo.

---

## 3. Motor de Agendamento e Datas (Objeto Date)
* **Cálculo de Parcelas:** Ao receber uma compra parcelada, o software divide o valor igualmente e usa o loop `for` junto ao objeto nativo `new Date()` do JavaScript para projetar os meses futuros.
* **Chaves Temporais:** Os gastos são agrupados dentro do arquivo por "gavetas de meses" no formato `ANO-MÊS` (Ex: `"2026-07"`).
* **Virada de Ano Automática:** A lógica utiliza o método `.setMonth()` do JavaScript, que recalcula o ano civil automaticamente caso as parcelas passem do mês de Dezembro.

---

## 4. Gerenciamento de Concorrência (Fila Assíncrona)
* **O Problema:** Como o Node.js trabalha de forma assíncrona, se um usuário mandar várias mensagens seguidas, o bot pode tentar ler e gravar no mesmo arquivo JSON ao mesmo tempo, corrompendo os dados (Condição de Corrida).
* **A Solução:** Uma fila de mensagens em memória baseada em um Array (`[]`) e uma variável de controle (`botEstaOcupado`). 
* **Fluxo:** As mensagens do WhatsApp entram na fila e são processadas rigorosamente uma por uma (Sequencialmente). A mensagem `B` só é processada quando a mensagem `A` terminar de gravar o JSON com sucesso.

---

## 5. Estratégia de Performance (Rotina de Arquivamento)
* **Limpeza do Arquivo Ativo:** Para evitar que o arquivo principal do usuário acumule anos de histórico e fique pesado para leitura, o sistema possui uma rotina de expurgo na virada de ano.
* **Arquivo Morto:** Os dados de anos anteriores são recortados e movidos para um arquivo de histórico dedicado (Ex: `historico_2026.json`). 
* **Resultado:** O arquivo ativo do usuário permanece leve, contendo apenas o ano corrente e parcelas futuras que ainda vão vencer.

---

## 📂 Estrutura de Pastas Esperada
```text
bot-financas/
  ├── package.json       (Dependências e scripts do projeto)
  ├── financeiro.js      (Regras de negócio: parcelas e gerenciamento do JSON)
  ├── index.js           (Servidor principal e conexão com o WhatsApp)
  └── usuarios/          (O armário onde os arquivos são gravados)
       ├── 5511999999999.json
       └── 5511888888888.json