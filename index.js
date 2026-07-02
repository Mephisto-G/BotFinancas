const { cadastrarCompraParcelada } = require('./financeiro');
const { consultar } = require('./financeiro');
const { excluir } = require('./financeiro');

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

        Regras importantes para EXCLUIR HISTÓRICO:
        4. Se o usuário manifestar o desejo de apagar, deletar ou excluir um gasto, identifique o nome do item e retorne o seguinte formato:
            { "acao": "excluir", "produto": string }
    

        Mensagem do usuário: "${textoDoUsuario}"
    `;

    try {
        const resposta = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite', 
            contents: prompt,
            config: { responseMimeType: "application/json" } 
        });

        return JSON.parse(resposta.text);
    } catch (error) {
        console.error("Erro na comunicação com o Gemini:", error);
        /* Fazer uma resposta para o usuario */
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
                /* client.sendMessage(`${numeroUsuario}@c.us`, "Desculpe, não consegui entender o valor ou o produto. Pode repetir? 🧐"); */
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
                cadastrarCompraParcelada(numeroUsuario, produto, valor, parcelas);
                console.log(`[SUCESSO] Lançamento de "${produto}" (${parcelas}x) salvo para o usuário ${numeroUsuario}!`);
                console.log(`[BOT] Resposta para ${numeroUsuario}: "Lançamento de ${produto} cadastrado com sucesso!"`);
                /* client.sendMessage(`${numeroUsuario}@c.us`, `✅ Lançamento de *${produto}* (${parcelas}x) cadastrado com sucesso!`); */
                break;

            case "consulta":
                const mesParaConsulta = dadosExtraidos ? dadosExtraidos.mes : null;
                const resultadoHistorico = consultar(numeroUsuario, mesParaConsulta);
                console.log(`[BOT] Resposta de histórico: `, resultadoHistorico);
                /* client.sendMessage(`${numeroUsuario}@c.us`, resultadoHistorico); */
                break;

            case "excluir":
                const excluirProduto= dadosExtraidos ? dadosExtraidos.produto : null;
                const resultadoExcluir = excluir(numeroUsuario, excluirProduto);
                console.log(`[BOT] Resposta de histórico: `, resultadoExcluir);
                /* client.sendMessage(`${numeroUsuario}@c.us`, resultadoExcluir); */
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

setTimeout(() => {
    quandoChegarMensagemDoWhatsApp({ de: "5511999999999", texto: "Comprei um sofa em 3 vzs de 900" });
    quandoChegarMensagemDoWhatsApp({ de: "5511999999999", texto: "me mostre  minhas compras do mes 8" });
    quandoChegarMensagemDoWhatsApp({ de: "5511999999999", texto: "remover sofa" });
}, 1000);

// ============================================================================
// CONEXÃO REAL COM O WHATSAPP
// ============================================================================
/* const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

console.log("\n=== INICIALIZANDO SERVIDOR DO BOT ===");
console.log("[WHATSAPP] Aguardando inicialização do navegador do WhatsApp...");

// Criando a instância do cliente do WhatsApp
const client = new Client({
    authStrategy: new LocalAuth(), // Salva a sessão para você não ter que ler o QR Code toda vez
    puppeteer: {
        headless: true, // Roda em segundo plano sem abrir uma janela de navegador na sua tela
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

// 1. Gerador de QR Code no Terminal
client.on('qr', (qr) => {
    console.log('\n[WHATSAPP] 🚨 QR CODE GERADO! Escaneie com o seu aplicativo do WhatsApp:');
    qrcode.generate(qr, { small: true });
});

// 2. Evento de Conexão com Sucesso
client.on('ready', () => {
    console.log('\n[WHATSAPP] ✅ Tudo pronto! Bot de finanças conectado e escutando mensagens!');
}); */

/* // 3. CAPTURA DE MENSAGENS REAIS
client.on('message_create', async (msg) => {
    // 🛡️ TRAVA 1: Ignora mensagens que o próprio bot enviar
    if (msg.fromMe) return;

    // 🛡️ TRAVA 2: Ignora grupos
    if (msg.from.includes('@g.us')) return;

    // 🛡️ TRAVA 3: CORREÇÃO - Ignora mensagens antigas da sincronização inicial
    // Se o tempo da mensagem for menor do que o momento em que o bot iniciou, ignora.
    const tempoMensagem = msg.timestamp * 1000; // Converte segundos para milissegundos
    const agora = Date.now();
    
    // Se a mensagem tiver mais de 10 segundos de idade, o bot ignora (é histórico antigo)
    if (agora - tempoMensagem > 10000) {
        return; 
    }

    // Pega o número limpo do usuário (e aceita o formato @lid que o WhatsApp usa para canais/novas contas)
    const numeroLimpo = msg.from.replace('@c.us', '').replace('@lid', '');

    // Envia a mensagem real recebida para a sua fila existente!
    quandoChegarMensagemDoWhatsApp({
        de: numeroLimpo,
        texto: msg.body
    });
});

// Inicializa o bot do WhatsApp
client.initialize(); */


// ============================================================================
// ÁREA DE TESTES (SIMULAÇÃO DE ENTRADA DO WHATSAPP)
// ============================================================================
/* console.log("=== INICIALIZANDO SERVIDOR DO BOT ==="); */

// Simulando mensagens chegando exatamente juntas ou fora de ordem
// Se estiver SEM IA (Chave padrão), teste usando o formato com barras: "Item | Valor | Parcelas"
