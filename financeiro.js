const fs = require('fs');
const path = require('path');

// Garante que a pasta 'usuarios' exista para não dar erro ao salvar
const PASTA_USUARIOS = path.join(__dirname, 'usuarios');
if (!fs.existsSync(PASTA_USUARIOS)) {
    fs.mkdirSync(PASTA_USUARIOS);
}

/**
 * Função que calcula as parcelas e salva direto no JSON do usuário
 * @param {string} numeroUsuario - O número do WhatsApp (será o nome do arquivo)
 * @param {string} produto - Nome do produto/serviço
 * @param {number} valorTotal - Valor total da compra
 * @param {number} parcelas - Quantidade de parcelas
 */

function excluir(numeroUsuario, produtoDeletar){
    const caminhoArquivo = path.join(PASTA_USUARIOS, `${numeroUsuario}.json`);
    
    if (fs.existsSync(caminhoArquivo)) {
        const conteudoArquivo = fs.readFileSync(caminhoArquivo, 'utf-8');
        const dadosUsuario = JSON.parse(conteudoArquivo);
        
        for (let chaveMes of Object.keys(dadosUsuario.meses)) {
            
            //Filtrar a lista  mantendo apenas os produtos cujo nome seja diferente do produto que quero deletar
            dadosUsuario.meses[chaveMes] = dadosUsuario.meses[chaveMes].filter(compra => {
                return compra.produto.toLowerCase() !== produtoDeletar.toLowerCase();
            });

            // 3. Limpeza se o mes ficar vazio
            if (dadosUsuario.meses[chaveMes].length === 0) {
                delete dadosUsuario.meses[chaveMes];
            }
        }
        // Salvando
        fs.writeFileSync(caminhoArquivo, JSON.stringify(dadosUsuario, null, 2), 'utf-8');
        return(`[SUCESSO] Se o produto "${produtoDeletar}" existia, ele foi removido do histórico.`);
        
    } else {
        return("Usuário não encontrado.");
    }
}


function consultar(numeroUsuario, mesConsulta) {
    const caminhoArquivo = path.join(PASTA_USUARIOS, `${numeroUsuario}.json`);
    
    // 1. Checa se o usuário tem histórico
    if (!fs.existsSync(caminhoArquivo)) {
        return "Você ainda não possui nenhuma compra cadastrada! ❌";
    }
    
    const conteudoArquivo = fs.readFileSync(caminhoArquivo, 'utf-8');
    const dadosUsuario = JSON.parse(conteudoArquivo);
    
    // Se a pasta 'meses' estiver vazia
    if (Object.keys(dadosUsuario.meses).length === 0) {
        return "Seu histórico de compras está vazio! 📑";
    }

    let mensagemFormatada = `📊 *HISTÓRICO DE COMPRAS - ${dadosUsuario.nome}*\n\n`;

    // 2. CASO A: Consulta de um mês específico (Corrigido o nome da variável para mesConsulta)
    if (mesConsulta) {
        const mesAlvo = String(mesConsulta).trim(); 
        
        // Procura se existe alguma chave que inclua esse número
        const chaveEncontrada = Object.keys(dadosUsuario.meses).find(chave => {
            const mesFormatado = mesAlvo.padStart(2, '0'); 
            return chave.includes(mesFormatado);
        });

        // Se achou a chave correta (ex: encontrou "2026-08")
        if (chaveEncontrada) {
            const comprasDoMes = dadosUsuario.meses[chaveEncontrada];
            
            mensagemFormatada += `📅 *Mês: ${chaveEncontrada}*\n`;
            for (let compra of comprasDoMes) {
                mensagemFormatada += `🔹 *Produto:* ${compra.produto}\n`;
                mensagemFormatada += `   *Valor da Parcela:* R$ ${compra.valorParcela.toFixed(2)}\n`;
                mensagemFormatada += `   *Parcela:* ${compra.parcelaAtual} de ${compra.totalParcelas}\n`;
                mensagemFormatada += `----------------------------\n`;
            }
            return mensagemFormatada;
        } else {
            return `Não encontrei nenhuma compra para o mês ${mesConsulta}. 🤷‍♂️`;
        }
    } 

    // 3. CASO B: Consulta Geral (Se o usuário não disser o mês, mostra tudo)
    for (let [mes, listaDeCompras] of Object.entries(dadosUsuario.meses)) {
        mensagemFormatada += `📅 *Mês: ${mes}*\n`;
        
        for (let compra of listaDeCompras) {
            mensagemFormatada += `🔹 *Produto:* ${compra.produto}\n`;
            mensagemFormatada += `   *Valor da Parcela:* R$ ${compra.valorParcela.toFixed(2)}\n`;
            mensagemFormatada += `   *Parcela:* ${compra.parcelaAtual} de ${compra.totalParcelas}\n`;
            mensagemFormatada += `----------------------------\n`;
        }
    }
    
    return mensagemFormatada;
}

function cadastrarCompraParcelada(numeroUsuario, produto, valorTotal, parcelas) {
    const caminhoArquivo = path.join(PASTA_USUARIOS, `${numeroUsuario}.json`);
    
    // 1. LER OS DADOS EXISTENTES (Se o usuário já tiver um arquivo, abre ele. Se não, começa zerado)
    let dadosUsuario = { nome: numeroUsuario, meses: {} };
    
    if (fs.existsSync(caminhoArquivo)) {
        const conteudoArquivo = fs.readFileSync(caminhoArquivo, 'utf-8');
        dadosUsuario = JSON.parse(conteudoArquivo);
    }

    // 2. CALCULAR O VALOR DE CADA PARCELA
    const valorParcela = valorTotal / parcelas;
    const dataInicial = new Date(); // Pega o momento exato da compra

    // 3. O LOOP FOR: Roda o número de vezes das parcelas
    for (let i = 0; i < parcelas; i++) {
        // Criamos uma cópia da data atual para avançar os meses sem bugar a original
        let dataDaParcela = new Date(dataInicial);
        
        // Somas 'i' ao mês atual. O JS muda o ano sozinho se passar de dezembro!
        dataDaParcela.setMonth(dataInicial.getMonth() + i);
        
        // Formata a data para gerar a chave do mês (Ex: "2026-06")
        const ano = dataDaParcela.getFullYear();
        const mes = String(dataDaParcela.getMonth() + 1).padStart(2, '0'); // +1 porque Janeiro em JS é 0
        const chaveMes = `${ano}-${mes}`;

        // Cria a estrutura do produto/parcela atual
        const novaParcela = {
            produto: produto,
            valorParcela: Number(valorParcela.toFixed(2)), // Garante duas casas decimais (ex: 33.33)
            parcelaAtual: i + 1,
            totalParcelas: parcelas
        };

        // Se aquele mês ainda não existe nas gavetas do usuário, cria uma lista vazia
        if (!dadosUsuario.meses[chaveMes]) {
            dadosUsuario.meses[chaveMes] = [];
        }

        // Adiciona a parcela dentro da lista daquele mês específico
        dadosUsuario.meses[chaveMes].push(novaParcela);
    }

    // 4. SALVAR DE VOLTA NO ARQUIVO JSON
    // O 'null, 2' serve para deixar o texto do JSON quebrado e identado (bonito de ler)
    fs.writeFileSync(caminhoArquivo, JSON.stringify(dadosUsuario, null, 2), 'utf-8');
    
    console.log(`Sucesso: Compra de "${produto}" em ${parcelas}x salva para o usuário ${numeroUsuario}!`);
}

module.exports = { cadastrarCompraParcelada, consultar, excluir };


