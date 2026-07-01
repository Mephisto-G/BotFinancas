const { cadastrarCompraParcelada } = require('./financeiro');

// 1. A FILA EM MEMÓRIA
const filaDeMensagens = [];
let botEstaOcupado = false;

// 2. FUNÇÃO QUE PROCESSA A FILA SEQUENCIALMENTE
async function processarFila() {
    // Se o bot já estiver processando alguém ou se a fila estiver vazia, ele para
    if (botEstaOcupado || filaDeMensagens.length === 0) return;

    // Bloqueia o bot para que nenhuma outra mensagem atropele o processo atual
    botEstaOcupado = true;

    // Pega a mensagem mais antiga da fila (início do array)
    const mensagemAtual = filaDeMensagens.shift();

    try {
        const textoOriginal = mensagemAtual.texto;

        // VALIDAÇÃO: Verifica se a mensagem começa com o comando correto
        if (!textoOriginal.startsWith('!comprar')) {
            console.log(`[AVISO] Mensagem ignorada de ${mensagemAtual.de}: Não é um comando válido.`);
            return;
        }

        // REMOVE O COMANDO E FATIA O TEXTO NAS BARRAS '|'
        // Exemplo: "!comprar Sofá de Couro | 900 | 3" vira ["Sofá de Couro ", " 900 ", " 3"]
        const partes = textoOriginal.replace('!comprar', '').split('|');

        // VALIDAÇÃO: Garante que o usuário enviou os 3 pedaços necessários
        if (partes.length !== 3) {
            console.log(`[ERRO] Formato inválido enviado por ${mensagemAtual.de}. Use: !comprar Produto | Valor | Parcelas`);
            return;
        }

        // .trim() limpa os espaços em branco que sobram antes e depois do texto
        const produto = partes[0].trim();
        const valor = Number(partes[1].trim());
        const parcelas = Number(partes[2].trim());

        // VALIDAÇÃO MATEMÁTICA: Impede valores bizarros ou texto onde deveriam ser números
        if (isNaN(valor) || isNaN(parcelas) || valor <= 0 || parcelas <= 0) {
            console.log(`[ERRO] Dados numéricos inválidos enviados por ${mensagemAtual.de}`);
            return;
        }

        const numeroUsuario = mensagemAtual.de;

        // ENVIA OS DADOS LIMPOS PARA O MOTOR DO FINANCEIRO
        // O await garante que o index espera o arquivo JSON ser salvo antes de continuar
        await cadastrarCompraParcelada(numeroUsuario, produto, valor, parcelas);
        
        console.log(`[SUCESSO] Fila: Compra de "${produto}" processada para o usuário ${numeroUsuario}`);

    } catch (erro) {
        console.error("[CRÍTICO] Erro ao processar mensagem da fila:", erro);
    } finally {
        // Libera o bot para o próximo da fila
        botEstaOcupado = false;
        
        // Executa a função novamente para verificar se há mais mensagens aguardando
        processarFila();
    }
}

// 3. DO WHATSAPP PARA A FILA
// Essa função simula a chegada de mensagens que a biblioteca do WhatsApp dispararia
function quandoChegarMensagemDoWhatsApp(eventoMensagem) {
    console.log(`[FILA] Nova mensagem de ${eventoMensagem.de} adicionada à espera.`);
    
    // Adiciona o objeto da mensagem no final da fila
    filaDeMensagens.push(eventoMensagem);
    
    // Dispara o processador
    processarFila();
}

// ====================================================================
// CASO DE TESTE: Simulando o envio de mensagens fora de ordem e espaços
// ====================================================================

// Teste 1: Produto com nome composto e espaços extras entre as barras (Vai funcionar!)
quandoChegarMensagemDoWhatsApp({ 
    de: "5511999999999", 
    texto: "!comprar Sofá de Couro Grande |   1200   |  4  " 
});

// Teste 2: Mensagem colada logo em seguida (Vai esperar o Teste 1 terminar)
quandoChegarMensagemDoWhatsApp({ 
    de: "5511999999999", 
    texto: "!comprar Monitor Gamer | 800 | 2" 
});