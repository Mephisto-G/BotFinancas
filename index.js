const {
    cadastrarCompraParcelada,
    consultar,
    excluir,
    calcular
} = require('./financeiro');

const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');

require('dotenv').config();

const { GoogleGenAI } = require('@google/genai');

const API_KEY_GEMINI = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey: API_KEY_GEMINI });

const filaDeMensagens = [];
let botEstaOcupado = false;

function temChaveDaIA() {
    return Boolean(API_KEY_GEMINI) && API_KEY_GEMINI !== 'SUA_CHAVE_DA_API_AQUI';
}

async function interpretarMensagemComIA(textoDoUsuario) {
    const dataAtual = new Date().toLocaleDateString('pt-BR');

    const prompt = `
A data de hoje é: ${dataAtual}

Você é um assistente financeiro pessoal integrado ao WhatsApp.
Sua tarefa é interpretar a mensagem do usuário e retornar somente JSON válido.

Regras:

1. CADASTRAR
Se o usuário estiver relatando um gasto, retorne:
{ "acao": "cadastrar", "produto": string, "valor": number, "parcelas": number }

Se o usuário não mencionar a quantidade de parcelas, assuma parcelas = 1.

Se não conseguir identificar com certeza o produto ou o valor total, retorne exclusivamente:
{ "erro": true }

2. CONSULTAR
Se o usuário desejar consultar o histórico:
- Histórico geral: { "acao": "consulta", "mes": null }
- Mês específico: { "acao": "consulta", "mes": 5 }
- "Mês atual" ou "desse mês": use a data de hoje (${dataAtual}) e retorne o número do mês atual.

3. EXCLUIR
Se o usuário desejar apagar, deletar ou excluir um gasto, retorne:
{ "acao": "excluir", "produto": string }

4. CALCULAR
Se o usuário desejar calcular o histórico:
- Cálculo geral: { "acao": "calcular", "mes": null }
- Mês específico: { "acao": "calcular", "mes": 5 }
- "Mês atual" ou "desse mês": use a data de hoje (${dataAtual}) e retorne o número do mês atual.

Responda somente JSON válido, sem markdown, sem explicações e sem texto extra.

Mensagem do usuário: "${textoDoUsuario}"
`;

    try {
        const resposta = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite',
            contents: prompt,
            config: { responseMimeType: 'application/json' }
        });

        return JSON.parse(resposta.text);
    } catch (error) {
        console.error('Erro na comunicação com o Gemini:', error);
        return { erro: true };
    }
}

function quandoChegarMensagemDoWhatsApp(eventoMensagem) {
    console.log(`[WHATSAPP] Nova mensagem recebida de ${eventoMensagem.from}`);

    filaDeMensagens.push(eventoMensagem);
    processarFila();
}

async function processarFila() {
    if (botEstaOcupado || filaDeMensagens.length === 0) return;

    botEstaOcupado = true;

    const mensagemAtual = filaDeMensagens.shift();
    const numeroUsuario = mensagemAtual.from;
    const corpo = String(mensagemAtual.body || '');

    try {
        console.log(`\n[FILA] Processando mensagem de ${numeroUsuario}...`);

        let produto;
        let valor;
        let parcelas;
        let acao;
        let mes;

        let dadosExtraidos = null;
        let modoSegurancaAtivado = false;

        if (temChaveDaIA()) {
            try {
                dadosExtraidos = await interpretarMensagemComIA(corpo);

                if (!dadosExtraidos || dadosExtraidos.erro) {
                    modoSegurancaAtivado = true;
                    dadosExtraidos = null;
                } else {
                    produto = dadosExtraidos.produto;
                    valor = dadosExtraidos.valor;
                    parcelas = dadosExtraidos.parcelas ?? 1;
                    acao = dadosExtraidos.acao;
                }
            } catch (erroIA) {
                console.log('[SISTEMA] IA indisponível. Ativando Modo de Segurança...');
                modoSegurancaAtivado = true;
                dadosExtraidos = null;
            }
        } else {
            modoSegurancaAtivado = true;
        }

        if (modoSegurancaAtivado) {
            const partes = corpo.split('|');
            const comando = partes[0] ? partes[0].trim().toLowerCase() : '';

            if (comando === 'excluir' || comando === 'remover') {
                acao = 'excluir';
                produto = partes[1] ? partes[1].trim() : null;
            } else if (
                comando === 'consulta' ||
                comando === 'histórico' ||
                comando === 'historico'
            ) {
                acao = 'consulta';
                mes = partes[1] && partes[1].trim() !== ''
                    ? Number(partes[1].trim())
                    : null;
            } else if (comando === 'calcule' || comando === 'calcular') {
                acao = 'calcular';
                mes = partes[1] && partes[1].trim() !== ''
                    ? Number(partes[1].trim())
                    : null;
            } else if (partes.length >= 2) {
                produto = partes[0] ? partes[0].trim() : null;
                valor = partes[1] && partes[1].trim() !== ''
                    ? Number(partes[1].trim())
                    : null;
                parcelas = partes[2] && partes[2].trim() !== ''
                    ? Number(partes[2].trim())
                    : 1;
                acao = 'cadastrar';
            } else {
                console.log(`[BOT] Comando manual inválido de ${numeroUsuario}. Enviando erro...`);

                const mensagemAjuda =
                    `❌ Não consegui processar o seu comando manual.\n\n` +
                    `💡 *Use um dos formatos abaixo se o erro persistir:*\n` +
                    `• Cadastrar: *Produto | Valor | Parcelas*\n` +
                    `• Consultar: *consulta | Mês*\n` +
                    `• Excluir: *excluir | Nome do Produto*\n` +
                    `• Calcular: *calcular | Mês*`;

                await client.sendMessage(numeroUsuario, mensagemAjuda);
                return;
            }
        }

        const numeroLimpo = String(numeroUsuario)
            .replace('@c.us', '')
            .replace('@lid', '');

        switch (acao) {
            case 'cadastrar': {
                const resultadoCadastro = cadastrarCompraParcelada(
                    numeroLimpo,
                    produto,
                    valor,
                    parcelas
                );

                await client.sendMessage(numeroUsuario, resultadoCadastro);
                break;
            }

            case 'consulta': {
                const mesParaConsulta = modoSegurancaAtivado
                    ? mes
                    : dadosExtraidos?.mes ?? null;

                const resultadoHistorico = consultar(numeroLimpo, mesParaConsulta);

                await client.sendMessage(numeroUsuario, resultadoHistorico);
                break;
            }

            case 'excluir': {
                const excluirProduto = modoSegurancaAtivado
                    ? produto
                    : dadosExtraidos?.produto ?? null;

                const resultadoExcluir = excluir(numeroLimpo, excluirProduto);

                await client.sendMessage(numeroUsuario, resultadoExcluir);
                break;
            }

            case 'calcular': {
                const mesParaCalcular = modoSegurancaAtivado
                    ? mes
                    : dadosExtraidos?.mes ?? null;

                const resultadoCalcular = calcular(numeroLimpo, mesParaCalcular);

                await client.sendMessage(numeroUsuario, resultadoCalcular);
                break;
            }

            default: {
                await client.sendMessage(
                    numeroUsuario,
                    '❌ Não entendi o comando. Tente algo como:\n' +
                    'Notebook | 3000 | 10\n' +
                    'consulta | 8\n' +
                    'calcular | 8\n' +
                    'excluir | Notebook'
                );
                break;
            }
        }
    } catch (erro) {
        console.error(`[ERRO] Falha crítica ao processar a mensagem de ${numeroUsuario}:`, erro);

        try {
            await client.sendMessage(
                numeroUsuario,
                '❌ Ocorreu um erro ao processar sua mensagem. Tente novamente.'
            );
        } catch (erroEnvio) {
            console.error('[ERRO] Não foi possível enviar mensagem de erro:', erroEnvio);
        }
    } finally {
        botEstaOcupado = false;
        processarFila();
    }
}

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

console.log('\n=== INICIALIZANDO SERVIDOR DO BOT ===');
console.log('[WHATSAPP] Aguardando inicialização do navegador do WhatsApp...');

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        protocolTimeout: 600000, // 10 minutos (a Pi é lenta, dá tempo pra ela)
        executablePath: process.platform === 'linux' ? '/usr/bin/chromium' : undefined,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-extensions',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-software-rasterizer',
            '--no-first-run',
            '--no-zygote',
            '--disable-accelerated-2d-canvas',
            '--renderer-process-limit=2',
            '--js-flags=--max-old-space-size=256',
            '--headless=new'
        ]
    }
});

client.on('qr', (qr) => {
    console.log('\n[WHATSAPP] 🚨 QR CODE GERADO! Escaneie com o seu aplicativo do WhatsApp:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('\n[WHATSAPP] ✅ Tudo pronto! Bot de finanças conectado e escutando mensagens!');
});

client.on('message_create', async (msg) => {
    if (msg.fromMe) return;
    if (msg.from.includes('@g.us')) return;

    const tempoMensagem = msg.timestamp ? msg.timestamp * 1000 : Date.now();
    const agora = Date.now();

    if (msg.timestamp && agora - tempoMensagem > 10000) {
        return;
    }

    if (msg.hasMedia && (msg.type === 'audio' || msg.type === 'ptt')) {
        const idMensagem = msg.id && msg.id.id ? msg.id.id : String(Date.now());
        const idArquivo = String(idMensagem).replace(/[^a-zA-Z0-9_-]/g, '') || String(Date.now());

        const inputPath = `./temp_${idArquivo}.ogg`;
        const outputPath = `./temp_${idArquivo}.mp3`;

        let uploadResult = null;

        const limparArquivosLocais = () => {
            try {
                if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
                if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
                console.log('[SISTEMA] Arquivos locais limpos com sucesso.');
            } catch (errLimpeza) {
                console.error('Erro ao apagar arquivos temporários:', errLimpeza);
            }
        };

        try {
            await msg.reply('Ouvindo seu áudio, só um minutinho...');

            // Download com retry (falha de vez em quando em máquina lenta)
            let media = null;
            for (let tentativa = 1; tentativa <= 3; tentativa++) {
                try {
                    media = await msg.downloadMedia();
                    break; // deu certo, sai do loop
                } catch (erroDownload) {
                    console.error(`[ÁUDIO] Falha no download (tentativa ${tentativa}/3): ${erroDownload.message}`);
                    if (tentativa < 3) await new Promise(r => setTimeout(r, 3000));
                }
            }

            // Se nem com retry funcionou, avisa o usuário e encerra
            if (!media) {
                await msg.reply('❌ Não consegui baixar seu áudio. Tenta enviar novamente, por favor.');
                limparArquivosLocais();
                return;
            }

            fs.writeFileSync(inputPath, media.data, 'base64');

            ffmpeg(inputPath)
                .toFormat('mp3')
                .on('end', async () => {
                    try {
                        uploadResult = await ai.files.upload({
                            file: outputPath,
                            mimeType: 'audio/mp3'
                        });

                        const transcricao = await ai.models.generateContent({
                            model: 'gemini-3.1-flash-lite',
                            contents: [
                                {
                                    fileData: {
                                        fileUri: uploadResult.uri,
                                        mimeType: uploadResult.mimeType || 'audio/mp3'
                                    }
                                },
                                {
                                    text:
                                        'Transcreva exatamente o que foi dito neste áudio, ' +
                                        'sem adicionar nenhuma saudação, comentário, explicação ou pontuação extra. ' +
                                        'Apenas o texto falado puro.'
                                }
                            ]
                        });

                        const textoDoAudio =
                            transcricao && typeof transcricao.text === 'string'
                                ? transcricao.text.trim()
                                : '';

                        console.log(`[Áudio Transcrito]: ${textoDoAudio}`);

                        try {
                            await ai.files.delete({ name: uploadResult.name });
                        } catch (erroRemoverArquivo) {
                            console.error('Erro ao remover arquivo do Google:', erroRemoverArquivo);
                        }

                        limparArquivosLocais();

                        if (textoDoAudio) {
                            filaDeMensagens.push({
                                from: msg.from,
                                body: textoDoAudio
                            });

                            processarFila();
                        } else {
                            await client.sendMessage(
                                msg.from,
                                '❌ Não consegui extrair nenhuma mensagem falada deste áudio.'
                            );
                        }
                    } catch (apiError) {
                        console.error('Erro no processamento do áudio/API:', apiError);

                        try {
                            await client.sendMessage(
                                msg.from,
                                '❌ Tive um problema ao processar seu áudio.'
                            );
                        } catch (erroMensagem) {
                            console.error('Erro ao enviar mensagem de erro:', erroMensagem);
                        }

                        if (uploadResult) {
                            try {
                                await ai.files.delete({ name: uploadResult.name });
                            } catch (erroRemoverArquivo) {
                                // Silencioso de propósito
                            }
                        }

                        limparArquivosLocais();
                    }
                })
                .on('error', async (err) => {
                    console.error('Erro na conversão do FFmpeg:', err);

                    try {
                        await client.sendMessage(
                            msg.from,
                            '❌ Erro ao converter o formato do seu áudio.'
                        );
                    } catch (erroMensagem) {
                        console.error('Erro ao enviar mensagem de erro:', erroMensagem);
                    }

                    limparArquivosLocais();
                })
                .save(outputPath);
        } catch (error) {
            console.error('Erro geral no fluxo de áudio:', error);

            try {
                await msg.reply('❌ Ocorreu um erro ao processar sua mensagem de voz.');
            } catch (erroMensagem) {
                console.error('Erro ao enviar mensagem de erro:', erroMensagem);
            }

            limparArquivosLocais();
        }
    } else if (msg.type === 'chat' && msg.body && msg.body.trim()) {
        quandoChegarMensagemDoWhatsApp({
            from: msg.from,
            body: msg.body
        });
    }
});

client.initialize();
