const { cadastrarCompraParcelada } = require('./financeiro');
const { consultar } = require('./financeiro');
const { excluir } = require('./financeiro');
const { calcular } = require('./financeiro');

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
        
        Regras importantes para CALCULAR HISTÓRICO:
        4. Se o usuário desejar CALCULAR o histórico, faça o seguinte:
            4.1 Se ele apenas digitar que deseja ver o calculo geral, retorne: 
                { "acao": "calcular", "mes": null }
            4.2 Se ele informar um mês específico (ex: "mês de maio" ou "mês 5"), retorne o número do mês como número puro: 
                { "acao": "calcular", "mes": 5 }
            4.3 Se ele pedir para calcular do "mês atual" ou "desse mês", use a data fornecida no topo (${dataAtual}) para descobrir o número do mês atual e retorne-o como número puro (ex: 7).

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
        return { erro: true };
    }
}

/**
 * Função gatilho que simula ou recebe o evento de nova mensagem do WhatsApp
 */
function quandoChegarMensagemDoWhatsApp(eventoMensagem) {
    console.log(`[WHATSAPP] Nova mensagem recebida de ${eventoMensagem.from}`);
    
    // Insere a mensagem no final do array da fila
    filaDeMensagens.push(eventoMensagem);
    
    // Dispara a tentativa de processamento
    processarFila();
}

/**
 * Motor de processamento da fila (Garante a execução sequencial/vaga por vaga)
 */
async function processarFila() {
    if (botEstaOcupado || filaDeMensagens.length === 0) return;

    botEstaOcupado = true;

    const mensagemAtual = filaDeMensagens.shift();
    const numeroUsuario = mensagemAtual.from; // Armazena o ID completo (Ex: 5511999999999@c.us)

    try {
        console.log(`\n[FILA] Processando mensagem de ${numeroUsuario}...`);
        let produto, valor, parcelas, acao, mes; 
        let dadosExtraidos = null; 
        let modoSegurancaAtivado = false;

        // 1. TENTA USAR A IA SE A CHAVE EXISTIR
        if (API_KEY_GEMINI !== "SUA_CHAVE_DA_API_AQUI") {
            try {
                dadosExtraidos = await interpretarMensagemComIA(mensagemAtual.body);
                
                if (dadosExtraidos.erro) {
                    modoSegurancaAtivado = true;
                } else {
                    produto = dadosExtraidos.produto;
                    valor = dadosExtraidos.valor;
                    parcelas = dadosExtraidos.parcelas;
                    acao = dadosExtraidos.acao;
                }
            } catch (erroIA) {
                console.log("[SISTEMA] IA indisponível (Modelo/Chave errada). Ativando Modo de Segurança...");
                modoSegurancaAtivado = true;
            }
        } else {
            modoSegurancaAtivado = true;
        }

        // 2. PLANO B: SE A IA FALHOU OU NÃO EXISTE, SEPARA POR BARRAS (|)
        if (modoSegurancaAtivado) {
            const partes = mensagemAtual.body.split('|'); 

            if (partes[0].trim().toLowerCase() === 'excluir' || partes[0].trim().toLowerCase() === 'remover') {
                acao = "excluir";
                produto = partes[1] ? partes[1].trim() : null;
            }
            else if (partes[0].trim().toLowerCase() === 'consulta' || partes[0].trim().toLowerCase() === 'histórico') {
                acao = "consulta";
                mes = partes[1] ? Number(partes[1].trim()) : null; 
            }
            else if (partes[0].trim().toLowerCase() === 'calcule' || partes[0].trim().toLowerCase() === 'calcular') {
                acao = "calcular";
                mes = partes[1] ? Number(partes[1].trim()) : null; 
            }
            else if (partes.length >= 2) {
                produto = partes[0].trim();
                valor = Number(partes[1].trim());
                parcelas = partes[2] ? Number(partes[2].trim()) : 1; 
                acao = "cadastrar"; 
            }
           else {
                console.log(`[BOT] Comando manual inválido de ${numeroUsuario}. Enviando erro...`);
                
                // Texto explicativo para ajudar o usuário a não errar de novo
                const mensagemAjuda = `❌ Não consegui processar o seu comando manual.\n\n` +
                                      `💡 *Use um dos formatos abaixo se o erro persistir:*\n` +
                                      `• Cadastrar: *Produto | Valor | Parcelas*\n` +
                                      `• Consultar: *consulta | Mês*\n` +
                                      `• Excluir: *excluir | Nome do Produto*\n` +
                                      `• Calcular: *calcular | Mês*`;

                // Envia de forma assíncrona esperando o WhatsApp confirmar
                await client.sendMessage(numeroUsuario, mensagemAjuda);
                
                return; // Encerra o processo desta mensagem atual com segurança
            }
        }
            
        // Extrai apenas o número limpo para passar às funções do sistema de arquivos de dados, se necessário
        const numeroLimpo = numeroUsuario.replace('@c.us', '').replace('@lid', '');

        switch (acao){
            case "cadastrar":
                cadastrarCompraParcelada(numeroLimpo, produto, valor, parcelas);
                await client.sendMessage(numeroUsuario, `✅ Lançamento de *${produto}* (${parcelas}x) cadastrado com sucesso!`);
                break;

            case "consulta":
                const mesParaConsulta = dadosExtraidos ? dadosExtraidos.mes : mes;
                const resultadoHistorico = consultar(numeroLimpo, mesParaConsulta);
                await client.sendMessage(numeroUsuario, resultadoHistorico);
                break;

            case "excluir":
                const excluirProduto = dadosExtraidos ? dadosExtraidos.produto : produto;
                const resultadoExcluir = excluir(numeroLimpo, excluirProduto);
                await client.sendMessage(numeroUsuario, resultadoExcluir);
                break;

            case "calcular":
                const mesParaCalcular = dadosExtraidos ? dadosExtraidos.mes : mes;
                const resultadoCalcular = calcular(numeroLimpo, mesParaCalcular);
                await client.sendMessage(numeroUsuario, resultadoCalcular);
                break;
        }

    } catch (erro) {
        console.error(`[ERRO] Falha crítica ao processar a mensagem de ${numeroUsuario}:`, erro);
    } finally {
        botEstaOcupado = false;
        processarFila();
    }
}

// ============================================================================
// CONEXÃO REAL COM O WHATSAPP
// ============================================================================
const { Client, LocalAuth} = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

console.log("\n=== INICIALIZANDO SERVIDOR DO BOT ===");
console.log("[WHATSAPP] Aguardando inicialização do navegador do WhatsApp...");

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--disable-extensions', // Desativa extensões para carregar mais rápido
            '--unhandled-rejections=strict'
        ]
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
});

// 3. CAPTURA DE MENSAGENS REAIS
client.on('message_create', async (msg) => {
    if (msg.fromMe) return;
    if (msg.from.includes('@g.us')) return;

    const tempoMensagem = msg.timestamp * 1000;
    const agora = Date.now();
    
    if (agora - tempoMensagem > 10000) {
        return; 
    }

    // 🟢 CORREÇÃO CRÍTICA: Passando o msg.from completo (com @c.us) para evitar problemas no envio posterior
    quandoChegarMensagemDoWhatsApp({
        from: msg.from,
        body: msg.body
    });
});

// Inicializa o bot do WhatsApp
client.initialize();