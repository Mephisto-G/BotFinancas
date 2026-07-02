const { cadastrarCompraParcelada } = require('./financeiro');
const { consultar } = require('./financeiro');

// ============================================================================
// CONFIGURAÇÃO DA IA (GEMINI)
// ============================================================================
require('dotenv').config()
const { GoogleGenAI } = require('@google/genai');
const API_KEY_GEMINI = process.env.GEMINI_API_KEY; 
const ai = new GoogleGenAI({ apiKey: API_KEY_GEMINI });

// ============================================================================
// ESTRUTURA DA FILA DE MENSAGENS (CONCORRÊNCIA)
// ============================================================================
const filaDeMensagens = [];
let botEstaOcupado = false;

/**
 * Função responsável por enviar o texto ao Gemini e extrair os dados em JSON
 */
async function interpretarMensagemComIA(textoDoUsuario) {
    const dataAtual = new Date().toLocaleDateString('pt-BR');
    const prompt = `
        A data de hoje é: ${dataAtual}
        Você é um assistente financeiro pessoal integrado ao WhatsApp. 
        Sua tarefa é extrair o nome do produto, o valor total da compra e a quantidade de parcelas a partir da mensagem do usuário.
    
        Responda ESTRITAMENTE com um objeto JSON válido, sem formatações markdown adicionais, no formato adequado para cada ação.

        Regras importantes para CADASTRAR COMPRAS:
        1. Se o usuário estiver relatando um gasto, retorne o seguinte formato:
       { "acao": "cadastrar", "produto": string, "valor": number, "parcelas": number }
        2. Se o usuário não mencionar a quantidade de parcelas, assuma que o valor de "parcelas" é 1.
        3. Se você não conseguir identificar com certeza o produto ou o valor total, retorne EXCLUSIVAMENTE: { "erro": true }

        Regras importantes para CONSULTAR HISTÓRICO:
        4. Se o usuário desejar consultar o histórico, faça o seguinte:
            4.1 Se ele apenas digitar que deseja ver o histórico geral, retorne: 
                { "acao": "consulta", "mes": null }
            4.2 Se ele informar um mês específico (ex: "mês de maio" ou "mês 5"), retorne o número do mês como número puro: 
                { "acao": "consulta", "mes": 5 }
            4.3 Se ele pedir o histórico do "mês atual" ou "desse mês", use a data fornecida no topo (${dataAtual}) para descobrir o número do mês atual e retorne-o como número puro (ex: 7).

        Mensagem do usuário: "${textoDoUsuario}"
    `;

    try {
        const resposta = await ai.models.generateContent({
            model: 'gemini-2.5-flash', // Modelo rápido e ideal para extração de texto
            contents: prompt,
            config: { responseMimeType: "application/json" } // Força o retorno em JSON puro
        });

        return JSON.parse(resposta.text);
    } catch (error) {
        console.error("Erro na comunicação com o Gemini:", error);
        return { erro: true };
    }
}

/**
 * Motor de processamento da fila (Garante a execução sequencial/vaga por vaga)
 */
async function processarFila() {
    // Se o bot já estiver processando alguém ou se a fila acabar, interrompe
    if (botEstaOcupado || filaDeMensagens.length === 0) return;

    // Bloqueia a fila para que nenhuma outra mensagem atropele o processo atual
    botEstaOcupado = true;

    // Retira a mensagem mais antiga da fila (Primeiro a entrar, Primeiro a sair)
    const mensagemAtual = filaDeMensagens.shift();
    const numeroUsuario = mensagemAtual.de;

    try {
        console.log(`\n[FILA] Processando mensagem de ${numeroUsuario}...`);
        let dadosExtraidos
        let produto, valor, parcelas, acao; 

        // CHAVE DE MUDANÇA: Se você tiver a API Key do Gemini, ele usa a IA.
        // Se não tiver, ele usa o corte por barras fixas (|) como plano de fundo.
        if (API_KEY_GEMINI !== "SUA_CHAVE_DA_API_AQUI") {
            // MODO COMPLETO: Usando Inteligência Artificial
            dadosExtraidos = await interpretarMensagemComIA(mensagemAtual.texto);

            if (dadosExtraidos.erro) {
                console.log(`[BOT] Resposta para ${numeroUsuario}: "Desculpe, não consegui entender o valor ou o produto. Pode repetir?"`);
                return;
            }

            produto = dadosExtraidos.produto;
            valor = dadosExtraidos.valor;
            parcelas = dadosExtraidos.parcelas;
            acao = dadosExtraidos.acao;

        } else {
            // MODO DE SEGURANÇA (Sem IA)
            const partes = mensagemAtual.texto.split('|');
            // ... seu código de checar partes ...

            produto = partes[0].trim();
            valor = Number(partes[1].trim());
            parcelas = partes[2] ? Number(partes[2].trim()) : 1; 
            acao = "cadastrar"; // 👈 ADICIONE ISSO AQUI!

            produto = partes[0].trim();
            valor = Number(partes[1].trim());
            parcelas = partes[2] ? Number(partes[2].trim()) : 1; // Se não informar, assume 1
        }
        switch (acao){
            case "cadastrar":
                // CHAMA O MÓDULO FINANCEIRO (Gravação segura no JSON isolado)
                await cadastrarCompraParcelada(numeroUsuario, produto, valor, parcelas);
                console.log(`[SUCESSO] Lançamento de "${produto}" (${parcelas}x) salvo para o usuário ${numeroUsuario}!`);
                console.log(`[BOT] Resposta para ${numeroUsuario}: "Lançamento de ${produto} cadastrado com sucesso!"`);
                break;

            case "consulta":
                const mesParaConsulta = dadosExtraidos ? dadosExtraidos.mes : null;
                const resultadoHistorico = await consultar(numeroUsuario, mesParaConsulta);
                console.log(`[BOT] Resposta de histórico: `, resultadoHistorico); 
                break;
                }
    } catch (erro) {
        console.error(`[ERRO] Falha crítica ao processar a mensagem de ${numeroUsuario}:`, erro);
    } finally {
        // Libera o bot para a próxima tarefa
        botEstaOcupado = false;
        
        // Chama a si mesmo imediatamente para processar o próximo da fila (se houver)
        processarFila();
    }
}

/**
 * Função gatilho que simula ou recebe o evento de nova mensagem do WhatsApp
 */
function quandoChegarMensagemDoWhatsApp(eventoMensagem) {
    console.log(`[WHATSAPP] Nova mensagem recebida de ${eventoMensagem.de}`);
    
    // Insere a mensagem no final do array da fila
    filaDeMensagens.push(eventoMensagem);
    
    // Dispara a tentativa de processamento
    processarFila();
}

// ============================================================================
// ÁREA DE TESTES (SIMULAÇÃO DE ENTRADA DO WHATSAPP)
// ============================================================================
console.log("=== INICIALIZANDO SERVIDOR DO BOT ===");

// Simulando mensagens chegando exatamente juntas ou fora de ordem
// Se estiver SEM IA (Chave padrão), teste usando o formato com barras: "Item | Valor | Parcelas"
setTimeout(() => {
    quandoChegarMensagemDoWhatsApp({ de: "5511999999999", texto: "Comprei um sofa em 3 vzs de 900" });
    quandoChegarMensagemDoWhatsApp({ de: "5511999999999", texto: "me mostre o mês de agosto" });
}, 1000);