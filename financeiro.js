const fs = require('fs');
const path = require('path');

const PASTA_USUARIOS = path.join(__dirname, 'usuarios');

if (!fs.existsSync(PASTA_USUARIOS)) {
    fs.mkdirSync(PASTA_USUARIOS);
}

function lerUsuario(numeroUsuario) {
    const caminhoArquivo = path.join(PASTA_USUARIOS, `${numeroUsuario}.json`);

    if (!fs.existsSync(caminhoArquivo)) {
        return { existe: false, erro: false, dadosUsuario: null };
    }

    try {
        const conteudoArquivo = fs.readFileSync(caminhoArquivo, 'utf-8');
        const dadosUsuario = JSON.parse(conteudoArquivo);

        if (!dadosUsuario || typeof dadosUsuario !== 'object') {
            return { existe: true, erro: true, dadosUsuario: null };
        }

        if (!dadosUsuario.meses || typeof dadosUsuario.meses !== 'object') {
            dadosUsuario.meses = {};
        }

        if (!dadosUsuario.nome) {
            dadosUsuario.nome = numeroUsuario;
        }

        return { existe: true, erro: false, dadosUsuario };
    } catch (erro) {
        console.error(`[ERRO] Não consegui ler o JSON do usuário ${numeroUsuario}:`, erro);
        return { existe: true, erro: true, dadosUsuario: null };
    }
}

function salvarUsuario(numeroUsuario, dadosUsuario) {
    const caminhoArquivo = path.join(PASTA_USUARIOS, `${numeroUsuario}.json`);
    fs.writeFileSync(caminhoArquivo, JSON.stringify(dadosUsuario, null, 2), 'utf-8');
}

function formatarValor(valor) {
    return Number(valor || 0).toFixed(2);
}

/**
 * Calcula o total de gastos do usuário.
 * Se o mês for informado, calcula apenas o mês especificado.
 * Se o mês não for informado, calcula o total geral de todos os meses.
 *
 * @param {string} numeroUsuario - O número do WhatsApp (será o nome do arquivo)
 * @param {number|string|null} mesConsulta - Mês que deseja consultar, ou null para todos
 * @returns {string} Mensagem formatada com o resultado da consulta
 */
function calcular(numeroUsuario, mesConsulta) {
    const usuario = lerUsuario(numeroUsuario);

    if (usuario.erro) {
        return '❌ Não consegui ler seu histórico. Seu arquivo pode estar corrompido.';
    }

    if (!usuario.existe) {
        return 'Você ainda não possui nenhuma compra cadastrada! ❌';
    }

    const dadosUsuario = usuario.dadosUsuario;

    if (Object.keys(dadosUsuario.meses).length === 0) {
        return 'Seu histórico de compras está vazio! 📑';
    }

    const temMesValido =
        mesConsulta !== null &&
        mesConsulta !== undefined &&
        String(mesConsulta).trim() !== '';

    if (temMesValido) {
        const mesAlvo = String(mesConsulta).trim();
        const mesFormatado = mesAlvo.padStart(2, '0');

        const chaveEncontrada = Object.keys(dadosUsuario.meses).find(chave => {
            return chave.trim().endsWith(`-${mesFormatado}`);
        });

        if (chaveEncontrada) {
            const comprasDoMes = Array.isArray(dadosUsuario.meses[chaveEncontrada])
                ? dadosUsuario.meses[chaveEncontrada]
                : [];

            const totalGasto = comprasDoMes.reduce((acumulador, compraAtual) => {
                return acumulador + Number(compraAtual.valorParcela || 0);
            }, 0);

            return `Você gastou R$ ${formatarValor(totalGasto)} em ${chaveEncontrada} 😱`;
        }

        return `Não encontrei nenhum gasto registrado para o mês ${mesFormatado}. 🎉`;
    }

    let mensagemFormatada = `📊 *HISTÓRICO DE COMPRAS - ${dadosUsuario.nome}*\n\n`;
    let totalGeral = 0;

    for (let [mes, listaDeCompras] of Object.entries(dadosUsuario.meses)) {
        const comprasDoMes = Array.isArray(listaDeCompras) ? listaDeCompras : [];

        const totalDoMes = comprasDoMes.reduce((acumulador, compraAtual) => {
            return acumulador + Number(compraAtual.valorParcela || 0);
        }, 0);

        totalGeral += totalDoMes;

        mensagemFormatada += `💰 *Subtotal de ${mes}:* R$ ${formatarValor(totalDoMes)}\n\n`;
    }

    mensagemFormatada += `====== 📈 RESUMO GERAL ======\n`;
    mensagemFormatada += `🔥 *Total acumulado de todos os meses:* R$ ${formatarValor(totalGeral)}\n`;

    return mensagemFormatada;
}

function excluir(numeroUsuario, produtoDeletar) {
    if (!produtoDeletar || typeof produtoDeletar !== 'string' || !produtoDeletar.trim()) {
        return 'Informe o nome do produto que deseja excluir. ❌';
    }

    const usuario = lerUsuario(numeroUsuario);

    if (usuario.erro) {
        return '❌ Não consegui ler seu histórico. Seu arquivo pode estar corrompido.';
    }

    if (!usuario.existe) {
        return 'Você ainda não possui nenhuma compra cadastrada! ❌';
    }

    const dadosUsuario = usuario.dadosUsuario;
    const produtoAlvo = produtoDeletar.trim().toLowerCase();

    let produtoEncontrado = false;

    for (let chaveMes of Object.keys(dadosUsuario.meses)) {
        const comprasDoMes = Array.isArray(dadosUsuario.meses[chaveMes])
            ? dadosUsuario.meses[chaveMes]
            : [];

        dadosUsuario.meses[chaveMes] = comprasDoMes.filter(compra => {
            const produtoAtual =
                typeof compra.produto === 'string'
                    ? compra.produto.toLowerCase()
                    : '';

            const deveManter = produtoAtual !== produtoAlvo;

            if (!deveManter) {
                produtoEncontrado = true;
            }

            return deveManter;
        });

        if (dadosUsuario.meses[chaveMes].length === 0) {
            delete dadosUsuario.meses[chaveMes];
        }
    }

    if (!produtoEncontrado) {
        return `Não encontrei o produto "${produtoDeletar.trim()}" no seu histórico. 🤷‍♂️`;
    }

    salvarUsuario(numeroUsuario, dadosUsuario);

    return `[SUCESSO] O produto "${produtoDeletar.trim()}" foi removido do histórico.`;
}

function consultar(numeroUsuario, mesConsulta) {
    const usuario = lerUsuario(numeroUsuario);

    if (usuario.erro) {
        return '❌ Não consegui ler seu histórico. Seu arquivo pode estar corrompido.';
    }

    if (!usuario.existe) {
        return 'Você ainda não possui nenhuma compra cadastrada! ❌';
    }

    const dadosUsuario = usuario.dadosUsuario;

    if (Object.keys(dadosUsuario.meses).length === 0) {
        return 'Seu histórico de compras está vazio! 📑';
    }

    let mensagemFormatada = `📊 *HISTÓRICO DE COMPRAS - ${dadosUsuario.nome}*\n\n`;

    const temMesValido =
        mesConsulta !== null &&
        mesConsulta !== undefined &&
        String(mesConsulta).trim() !== '';

    if (temMesValido) {
        const mesAlvo = String(mesConsulta).trim();
        const mesFormatado = mesAlvo.padStart(2, '0');

        const chaveEncontrada = Object.keys(dadosUsuario.meses).find(chave => {
            return chave.trim().endsWith(`-${mesFormatado}`);
        });

        if (chaveEncontrada) {
            const comprasDoMes = Array.isArray(dadosUsuario.meses[chaveEncontrada])
                ? dadosUsuario.meses[chaveEncontrada]
                : [];

            if (comprasDoMes.length === 0) {
                return `Não encontrei nenhuma compra para o mês ${mesFormatado}. 🤷‍♂️`;
            }

            mensagemFormatada += `📅 *Mês: ${chaveEncontrada}*\n`;

            for (let compra of comprasDoMes) {
                mensagemFormatada += `🔹 *Produto:* ${compra.produto || 'Sem nome'}\n`;
                mensagemFormatada += `   *Valor da Parcela:* R$ ${formatarValor(compra.valorParcela)}\n`;
                mensagemFormatada += `   *Parcela:* ${compra.parcelaAtual ?? '-'} de ${compra.totalParcelas ?? '-'}\n`;
                mensagemFormatada += `----------------------------\n`;
            }

            return mensagemFormatada;
        }

        return `Não encontrei nenhuma compra para o mês ${mesFormatado}. 🤷‍♂️`;
    }

    for (let [mes, listaDeCompras] of Object.entries(dadosUsuario.meses)) {
        const comprasDoMes = Array.isArray(listaDeCompras) ? listaDeCompras : [];

        mensagemFormatada += `📅 *Mês: ${mes}*\n`;

        for (let compra of comprasDoMes) {
            mensagemFormatada += `🔹 *Produto:* ${compra.produto || 'Sem nome'}\n`;
            mensagemFormatada += `   *Valor da Parcela:* R$ ${formatarValor(compra.valorParcela)}\n`;
            mensagemFormatada += `   *Parcela:* ${compra.parcelaAtual ?? '-'} de ${compra.totalParcelas ?? '-'}\n`;
            mensagemFormatada += `----------------------------\n`;
        }
    }

    return mensagemFormatada;
}

function cadastrarCompraParcelada(numeroUsuario, produto, valorTotal, parcelas) {
    if (!produto || typeof produto !== 'string' || !produto.trim()) {
        return '❌ Informe o nome do produto/serviço.';
    }

    const valor = Number(valorTotal);
    const numeroParcelas = Number(parcelas);

    if (!Number.isFinite(valor) || valor <= 0) {
        return '❌ Informe um valor total válido, maior que zero.';
    }

    if (!Number.isInteger(numeroParcelas) || numeroParcelas <= 0) {
        return '❌ Informe uma quantidade de parcelas inteira e maior que zero.';
    }

    const usuario = lerUsuario(numeroUsuario);

    if (usuario.erro) {
        return '❌ Não consegui ler seu histórico. Seu arquivo pode estar corrompido.';
    }

    let dadosUsuario = usuario.existe
        ? usuario.dadosUsuario
        : { nome: numeroUsuario, meses: {} };

    if (!dadosUsuario.meses || typeof dadosUsuario.meses !== 'object') {
        dadosUsuario.meses = {};
    }

    if (!dadosUsuario.nome) {
        dadosUsuario.nome = numeroUsuario;
    }

    const valorParcela = valor / numeroParcelas;
    const dataInicial = new Date();

    for (let i = 0; i < numeroParcelas; i++) {
        const dataDaParcela = new Date(
            dataInicial.getFullYear(),
            dataInicial.getMonth() + i,
            1
        );

        const ano = dataDaParcela.getFullYear();
        const mes = String(dataDaParcela.getMonth() + 1).padStart(2, '0');
        const chaveMes = `${ano}-${mes}`;

        const novaParcela = {
            produto: produto.trim(),
            valorParcela: Number(valorParcela.toFixed(2)),
            parcelaAtual: i + 1,
            totalParcelas: numeroParcelas
        };

        if (
            !dadosUsuario.meses[chaveMes] ||
            !Array.isArray(dadosUsuario.meses[chaveMes])
        ) {
            dadosUsuario.meses[chaveMes] = [];
        }

        dadosUsuario.meses[chaveMes].push(novaParcela);
    }

    salvarUsuario(numeroUsuario, dadosUsuario);

    console.log(
        `Sucesso: Compra de "${produto.trim()}" em ${numeroParcelas}x salva para o usuário ${numeroUsuario}!`
    );

    return `✅ Lançamento de *${produto.trim()}* (${numeroParcelas}x) cadastrado com sucesso!`;
}

module.exports = {
    cadastrarCompraParcelada,
    consultar,
    excluir,
    calcular
};
