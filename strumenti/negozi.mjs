// Aprovação de lojas e outdoors (usada por amministra.mjs "approva" e pelo robô do GitHub, ci.mjs).
// Pedido em <privato>/dati/negozi/<id>.json (api/negozio.php); pago pela Stripe (api/stripe.php marca pagamento: 'pagato').
// Aprovar = confere vagas, publica o logo em data/loghi e acrescenta em config/commerci.json (o motor põe no mapa).
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..');
const CFG = path.join(RAIZ, 'config');
const LOCAL = path.join(RAIZ, 'dati-grezzi', 'negozi');
const ler = (f, padrao) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return padrao; } };
const gravar = (f, o) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(o, null, 2)); };

export const remotoNegozi = ftp => `${ftp.priv}dati/negozi/`;

export function baixarPedido(ftp, id) {
  if (!/^\d{6}-[0-9a-f]{8}$/.test(id ?? '')) throw new Error('id inválido (ex.: 261025-1a2b3c4d)');
  if (!ftp.baixar(`${remotoNegozi(ftp)}${id}.json`, path.join(LOCAL, `${id}.json`))) throw new Error(`pedido ${id} não encontrado no servidor`);
  return ler(path.join(LOCAL, `${id}.json`), null);
}
export function salvarPedido(ftp, p) {
  gravar(path.join(LOCAL, `${p.id}.json`), p);
  ftp.enviar([{ local: path.join(LOCAL, `${p.id}.json`), remoto: `${remotoNegozi(ftp)}${p.id}.json` }]);
}
export function listarPedidos(ftp, filtro = () => true) {
  return ftp.listar(remotoNegozi(ftp)).filter(n => /^\d{6}-[0-9a-f]{8}\.json$/.test(n)).map(n => n.slice(0, -5)).filter(filtro).sort()
    .map(id => (ftp.baixar(`${remotoNegozi(ftp)}${id}.json`, path.join(LOCAL, `${id}.json`)) ? ler(path.join(LOCAL, `${id}.json`), null) : null)).filter(Boolean);
}

// config/commerci.json: traz antes a cópia do servidor (o robô e o PC aprovam; a do servidor é a que vale)
export function baixarCommerci(ftp) {
  ftp.baixar(`${ftp.priv}config-gioco/commerci.json`, path.join(CFG, 'commerci.json'));
  return ler(path.join(CFG, 'commerci.json'), []);
}
export function enviarCommerci(ftp, lista) {
  gravar(path.join(CFG, 'commerci.json'), lista);
  ftp.enviar([{ local: path.join(CFG, 'commerci.json'), remoto: `${ftp.priv}config-gioco/commerci.json` }]);
}

// aprova um pedido; devolve a mensagem. comuni: Map istat -> { nome, sigla, pop }. lista: config/commerci.json (muda no lugar)
export function approvaPedido({ ftp, p, comuni, lista, giorni = null, gratis = false, log = console.log }) {
  const cfgNeg = ler(path.join(RAIZ, 'sito', 'data', 'negozio.json'), {}), com = comuni.get(p.istat);
  if (!com) throw new Error(`comune ${p.istat} não existe`);
  if (lista.some(x => x.id === p.id)) throw new Error(`${p.id} já está aprovado (use rinnova)`);
  if (p.pagamento !== 'pagato' && !gratis) throw new Error(`${p.id} ainda não foi pago: só aprove depois do pagamento (ou "approva ${p.id} gratis")`);
  const prodotto = p.prodotto ?? 'negozio';
  const piano = cfgNeg.piani.find(x => com.pop >= x.da) ?? cfgNeg.piani.at(-1);
  const ativos = lista.filter(x => x.istat === p.istat && (x.prodotto ?? 'negozio') === prodotto && Date.parse(x.fino) > Date.now()).length;
  if (ativos >= piano.posti[prodotto]) throw new Error(`${com.nome} já tem ${ativos}/${piano.posti[prodotto]} ${prodotto} ativos`);
  if (p.test) log('aviso: pagamento de TESTE da Stripe');
  let logo = '';
  if (p.logo) {
    const arq = path.join(RAIZ, 'sito', 'data', 'loghi', p.logo);
    fs.mkdirSync(path.dirname(arq), { recursive: true });
    if (ftp.baixar(`${remotoNegozi(ftp)}${p.logo}`, arq)) { ftp.enviar([{ local: arq, remoto: `${ftp.web}data/loghi/${p.logo}` }]); logo = `data/loghi/${p.logo}`; }
    else log('aviso: não consegui baixar o logo; vai sem logo');
  }
  const dias = +(giorni ?? cfgNeg.durata_giorni ?? 30), agora = new Date();
  lista.push({
    id: p.id, istat: p.istat, approvato: agora.toISOString(), fino: new Date(agora.getTime() + dias * 86400e3).toISOString(),
    prodotto, nome: p.nome, tipo: p.tipo, colore: p.colore, whatsapp: p.whatsapp, instagram: p.instagram,
    descrizione: p.descrizione, testo: p.testo, logo,
    ...(p.su_misura && p.stile ? { stile: p.stile } : {}),
    ...(p.giocatore ? { giocatore: p.giocatore } : {}),   // casa do comprador: +100 (+50 su misura) e badge Patron
  });
  p.stato = 'approvato'; p.approvato = agora.toISOString();
  salvarPedido(ftp, p);
  return `${p.nome} (${prodotto === 'cartellone' ? 'outdoor' : 'loja'}) aprovado em ${com.nome} por ${dias} dias`;
}

// robô: aprova sozinho os pedidos pagos (pagamento real) que ainda estão "nuovo"; devolve quantos entraram
export function approvaPagati({ ftp, comuni, log = console.log }) {
  // só pedidos dos últimos 7 dias (o id começa com AAMMDD): não baixa o histórico inteiro a cada 10 minutos
  const desde = new Date(Date.now() - 7 * 86400e3).toISOString().slice(2, 10).replace(/-/g, '');
  const pagos = listarPedidos(ftp, id => id.slice(0, 6) >= desde).filter(p => p.stato === 'nuovo' && p.pagamento === 'pagato' && !p.test);
  if (!pagos.length) return 0;
  const lista = baixarCommerci(ftp);
  let n = 0;
  for (const p of pagos) {
    try { log(`loja paga: ${approvaPedido({ ftp, p, comuni, lista, log })}`); n++; }
    catch (e) { log(`loja paga ${p.id} NÃO aprovada: ${e.message}`); }
  }
  if (n) enviarCommerci(ftp, lista);
  return n;
}
