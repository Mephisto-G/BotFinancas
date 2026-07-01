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

module.exports = { cadastrarCompraParcelada };


/* // ==========================================
// TESTANDO A FUNÇÃO (Para você rodar no terminal)
// ==========================================

// Simula o João comprando um Sofá de R$ 900 em 3 parcelas
cadastrarCompraParcelada("5511999999999", "Sofá", 900, 3);

// Simula o mesmo João adicionando uma Internet de R$ 120 de 1 parcela (à vista) no mesmo arquivo
cadastrarCompraParcelada("5511999999999", "Internet", 120, 1); */