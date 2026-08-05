const Database = require('better-sqlite3');
const path = require('path');

// Cria (ou abre) o banco de dados
const db = new Database(path.join(__dirname, 'financeiro.db'));

// Recomendação de performance para SQLite
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    numero TEXT UNIQUE NOT NULL,
    nome TEXT
  );

  CREATE TABLE IF NOT EXISTS compras (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER NOT NULL,
    produto TEXT NOT NULL,
    valor_parcela REAL NOT NULL,
    parcela_atual INTEGER NOT NULL,
    total_parcelas INTEGER NOT NULL,
    chave_mes TEXT NOT NULL,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
  );
`);

// ============================================================================
// CADASTRAR
// ============================================================================
function cadastrarCompraParcelada(numeroUsuario, produto, valorTotal, parcelas) {
  // Garante que o usuário existe (não duplica por causa do UNIQUE + ON CONFLICT)
  db.prepare(`
    INSERT INTO usuarios (numero, nome) VALUES (?, ?)
    ON CONFLICT(numero) DO NOTHING
  `).run(numeroUsuario, numeroUsuario);

  const usuario = db.prepare('SELECT id FROM usuarios WHERE numero = ?').get(numeroUsuario);

  const valorParcela = valorTotal / parcelas;
  const dataInicial = new Date();

  const stmtCompra = db.prepare(`
    INSERT INTO compras (usuario_id, produto, valor_parcela, parcela_atual, total_parcelas, chave_mes)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  // Transação: ou salva todas as parcelas, ou salva nenhuma (segurança)
  const salvarCompra = db.transaction(() => {
    for (let i = 0; i < parcelas; i++) {
      let dataDaParcela = new Date(dataInicial);
      dataDaParcela.setMonth(dataInicial.getMonth() + i);

      const ano = dataDaParcela.getFullYear();
      const mes = String(dataDaParcela.getMonth() + 1).padStart(2, '0');
      const chaveMes = `${ano}-${mes}`;

      stmtCompra.run(
        usuario.id,
        produto,
        Number(valorParcela.toFixed(2)),
        i + 1,
        parcelas,
        chaveMes
      );
    }
  });

  salvarCompra();
  console.log(`Sucesso: Compra de "${produto}" em ${parcelas}x salva para o usuário ${numeroUsuario}!`);
  return `✅ Lançamento de *${produto}* (${parcelas}x) cadastrado com sucesso!`;
}


function consultar(numeroUsuario, mesConsulta) {
  const usuario = db.prepare('SELECT * FROM usuarios WHERE numero = ?').get(numeroUsuario);

  if (!usuario) {
    return "Você ainda não possui nenhuma compra cadastrada! ❌";
  }

  let sql = `SELECT * FROM compras WHERE usuario_id = ?`;
  const params = [usuario.id];

  if (mesConsulta) {
    const mesFormatado = String(mesConsulta).trim().padStart(2, '0');
    sql += ` AND chave_mes LIKE ?`;
    params.push(`%-${mesFormatado}`);
  }

  sql += ` ORDER BY chave_mes, parcela_atual`;
  const compras = db.prepare(sql).all(...params);

  if (compras.length === 0) {
    return mesConsulta
      ? `Não encontrei nenhuma compra para o mês ${mesConsulta}. 🤷‍♂️`
      : "Seu histórico de compras está vazio! 📑";
  }

  let mensagemFormatada = `📊 *HISTÓRICO DE COMPRAS - ${usuario.nome}*\n\n`;
  let mesAtualNaLista = null;

  for (const compra of compras) {
    if (compra.chave_mes !== mesAtualNaLista) {
      mensagemFormatada += `📅 *Mês: ${compra.chave_mes}*\n`;
      mesAtualNaLista = compra.chave_mes;
    }
    mensagemFormatada += `🔹 *Produto:* ${compra.produto}\n`;
    mensagemFormatada += `   *Valor da Parcela:* R$ ${compra.valor_parcela.toFixed(2)}\n`;
    mensagemFormatada += `   *Parcela:* ${compra.parcela_atual} de ${compra.total_parcelas}\n`;
    mensagemFormatada += `----------------------------\n`;
  }

  return mensagemFormatada;
}


function calcular(numeroUsuario, mesConsulta) {
  const usuario = db.prepare('SELECT id FROM usuarios WHERE numero = ?').get(numeroUsuario);

  if (!usuario) {
    return "Você ainda não possui nenhuma compra cadastrada! ❌";
  }


  if (mesConsulta) {
    const mesFormatado = String(mesConsulta).trim().padStart(2, '0');
    const resultado = db.prepare(`
      SELECT SUM(valor_parcela) as total, chave_mes
      FROM compras
      WHERE usuario_id = ? AND chave_mes LIKE ?
    `).get(usuario.id, `%-${mesFormatado}`);

    if (resultado && resultado.total) {
      return `Você gastou R$: ${resultado.total.toFixed(2)} em ${resultado.chave_mes} 😱`;
    }
    return `Não encontrei nenhum gasto registrado para o mês ${mesConsulta}. 🎉`;
  }


  const porMes = db.prepare(`
    SELECT chave_mes, SUM(valor_parcela) as total
    FROM compras
    WHERE usuario_id = ?
    GROUP BY chave_mes
    ORDER BY chave_mes
  `).all(usuario.id);

  if (porMes.length === 0) {
    return "Seu histórico de compras está vazio! 📑";
  }

  let mensagemFormatada = `📊 *HISTÓRICO DE COMPRAS - ${usuario.nome}*\n\n`;
  let totalGeral = 0;

  for (const linha of porMes) {
    mensagemFormatada += `💰 *Subtotal de ${linha.chave_mes}:* R$ ${linha.total.toFixed(2)}\n\n`;
    totalGeral += linha.total;
  }

  mensagemFormatada += `====== 📈 RESUMO GERAL ====== \n`;
  mensagemFormatada += `🔥 *Total acumulado de todos os meses:* R$ ${totalGeral.toFixed(2)}\n`;

  return mensagemFormatada;
}


function excluir(numeroUsuario, produtoDeletar) {
  const usuario = db.prepare('SELECT id FROM usuarios WHERE numero = ?').get(numeroUsuario);

  if (!usuario) {
    return "Usuário não encontrado.";
  }

  const resultado = db.prepare(`
    DELETE FROM compras
    WHERE usuario_id = ? AND LOWER(produto) = LOWER(?)
  `).run(usuario.id, produtoDeletar);

  if (resultado.changes > 0) {
    return `[SUCESSO] O produto "${produtoDeletar}" foi removido do histórico (${resultado.changes} parcela(s) removida(s)). ✅`;
  }
  return `Não encontrei o produto "${produtoDeletar}" no seu histórico. 🤷‍♂️`;
}

module.exports = { cadastrarCompraParcelada, consultar, excluir, calcular, db};