// Motor de regras: eventos brutos do Instagram -> snapshot do site.
// Recalcula tudo do zero a cada execução (determinístico: mesmos eventos = mesmo mapa).
//
// eventi = {
//   inizio: ms,                                   // início do jogo (1º post)
//   posts:   [{ id, ts }],
//   commenti:[{ post, conta, ts, luogo: istat|null, tags: [conta], voto: conta|null, pub: índice|null, stato: 'valido'|'pendente'|'rifiutato' }],
//            // pub: voto no nome do pub da própria cidade (REGOLE.pub_nomi); vale o último voto de cada conta
//   storie:  [{ conta, ts }],                     // story que marcou o perfil
//   bloccati:[conta],                             // escondidos do mapa (lote fica reservado)
//   doppi:   [{ da: ms, a: ms, tipi: ['storia'] | ['tutto'] }],
//   commerci:[{ id, istat, ts, fino: ms|null, prodotto, nome, tipo, colore, whatsapp, instagram, descrizione, testo, logo }],
//            // aprovados: na hora "ts" reservam o próximo lote da cidade (as casas seguintes pulam esse lote);
//            // depois de "fino" somem do mapa, mas o lote continua reservado (nenhuma casa muda de lugar).
//            // Outdoors (prodotto 'cartellone') não gastam lote: ganham "posto", o 1º ponto de destaque livre da cidade
// }
import { REGOLE, livelloDi } from '../sito/js/regole.js';
import { giornoRoma, limitiMandati, mandatoDi } from '../sito/js/tempo.js';

const F = { casa: 0, commento: 1, extra: 2, tag: 3, recluta: 4, voto: 5, storia: 6, post: 7, mecenate: 8, invitato: 9 };
const NOMES_F = Object.keys(F);
const dia = 86400e3;
const ontem = d => new Date(Date.parse(`${d}T12:00:00Z`) - dia).toISOString().slice(0, 10);

export function calcolare({ eventi, comuni, regioni, agora, versao = 'snap', demo = false, follower = 0 }) {
  const R = REGOLE, P = R.punti;
  const comIdx = new Map(comuni.map((c, i) => [c[0], i]));
  const bloccati = new Set((eventi.bloccati ?? []).map(s => s.toLowerCase()));
  const doppi = eventi.doppi ?? [];
  const lim = limitiMandati(eventi.inizio, agora);
  const kc = mandatoDi(lim, agora);
  const sfidaAtiva = ts => (R.sfide ?? []).find(s => ts >= Date.parse(s.inizio) && ts < Date.parse(s.fine)) ?? null;
  const fator = (f, ts) =>(doppi.some(d => ts >= d.da && ts < d.a && (d.tipi.includes('tutto') || d.tipi.includes(NOMES_F[f]))) ? 2 : 1);

  const contas = new Map(), luoghi = new Map(), postEst = new Map(), votos = new Set(), eventos = [];
  const cont = { commenti: 0, validi: 0, pendenti: 0, rifiutati: 0, storie: 0 };
  const conta = nome => {
    const k = nome.toLowerCase();
    let a = contas.get(k);
    if (!a) contas.set(k, a = { conta: k, casa: null, tot: 0, fonti: NOMES_F.map(() => 0), perM: [], giorni: new Set(), giorniStoria: new Set(), giorniPost: new Set(), fiamme: 0, taggatoDa: null, recrutado: false, bloc: bloccati.has(k) });
    return a;
  };
  // mandato=false: os pontos fazem a casa crescer mas não contam na semana (eleições), ex.: compra de negócio
  const add = (a, f, pts, ts, mandato = true) => {
    if (a.bloc) return;
    pts *= fator(f, ts);
    const antes = livelloDi(a.tot);
    a.tot += pts;
    a.fonti[f] += pts;
    const k = mandatoDi(lim, ts);
    if (mandato) a.perM[k] = (a.perM[k] ?? 0) + pts;
    const depois = livelloDi(a.tot);
    if (depois > antes && depois >= 10) eventos.push({ tipo: 'livello', conta: a.conta, livello: depois, ts });
  };
  const criarCasa = (a, ci, ts) => {
    let l = luoghi.get(ci);
    if (!l) {
      luoghi.set(ci, l = { ci, visiveis: [], lotti: 0, ts });
      if (!a.bloc) eventos.push({ tipo: 'citta_fondata', luogo: comuni[ci][0], fondatore: a.conta, ts });
    } else if (l.visiveis.length === 1 && !a.bloc && ts - l.visiveis[0].casa.ts < R.disputa_s * 1000) {
      eventos.push({ tipo: 'disputa', luogo: comuni[ci][0], fondatore: l.visiveis[0].conta, secondo: a.conta, differenza_s: Math.round((ts - l.visiveis[0].casa.ts) / 1000), ts });
    }
    a.casa = { ci, ts, lote: l.lotti++ };
    if (!a.bloc) {
      l.visiveis.push(a);
      const t = R.traguardi.find(x => x.case === l.visiveis.length);
      if (t) eventos.push({ tipo: 'traguardo', luogo: comuni[ci][0], id: t.id, conta: a.conta, ts });
    }
    add(a, F.casa, P.casa, ts);
    if (a.taggatoDa && !a.recrutado) {
      a.recrutado = true;
      const quem = contas.get(a.taggatoDa);
      if (quem?.casa) {
        add(quem, F.recluta, P.recluta, ts);
        // boas-vindas: quem entra por indicação também ganha (só na janela REGOLE.invitato_da .. invitato_a)
        if (P.invitato && ts >= Date.parse(R.invitato_da ?? 0) && ts < Date.parse(R.invitato_a ?? '9999-01-01')) add(a, F.invitato, P.invitato, ts);
        // desafio relâmpago: o amigo novo conta se a casa dele nasceu dentro da janela
        const sf = sfidaAtiva(ts);
        if (sf && !quem.bloc && !a.bloc) { const r = (quem.sfide ??= {})[sf.id] ??= { n: 0, ts: 0 }; r.n++; r.ts = ts; }
      }
    }
  };

  // ---------- linha do tempo ----------
  const linha = [
    ...eventi.commenti.map(c => ({ t: 'c', ts: c.ts, c })),
    ...eventi.storie.map(s => ({ t: 's', ts: s.ts, s })),
    ...(eventi.commerci ?? []).map(n => ({ t: 'n', ts: n.ts, n })),
    ...(eventi.post ?? []).map(p => ({ t: 'p', ts: p.ts, p })),
  ].filter(e => e.ts <= agora).sort((a, b) => a.ts - b.ts);
  const commerci = [];

  // grande eleição: placar por nação com os pontos do jogo inteiro (sem os de negócio no mapa)
  const G = R.gran_elezione ? Date.parse(R.gran_elezione.data) : Infinity;
  const placarNazioni = (ate = Infinity) => {
    const out = {};
    for (const r of regioni) {
      out[r.cod] = [...contas.values()].filter(a => a.casa && !a.bloc && a.casa.ts <= ate && comuni[a.casa.ci][3] === r.cod)
        .map(a => ({ conta: a.conta, pts: a.tot - a.fonti[F.mecenate], ts: a.casa.ts }))
        .filter(x => x.pts > 0).sort((x, y) => y.pts - x.pts || x.ts - y.ts).slice(0, 5).map(({ conta, pts }) => ({ conta, pts }));
    }
    return out;
  };
  let eletti = null;

  for (const e of linha) {
    if (!eletti && e.ts >= G) eletti = placarNazioni(G);   // fotografia na hora da eleição
    if (e.t === 'n') {
      const ci = comIdx.get(e.n.istat), l = ci == null ? null : luoghi.get(ci);
      // só cidades que já têm casas. Loja: ocupa o próximo lote. Outdoor: o primeiro ponto de destaque livre
      // (citta.js postiCartellone), sem gastar lote
      if (l && (e.n.prodotto ?? 'negozio') === 'cartellone') {
        const ocupados = new Set(commerci.filter(x => x.ci === ci && x.prodotto === 'cartellone' && !(x.fino && x.fino <= e.ts)).map(x => x.posto));
        let posto = 0;
        while (ocupados.has(posto)) posto++;
        commerci.push({ ...e.n, ci, posto });
      } else if (l) commerci.push({ ...e.n, ci, lote: l.lotti++ });
    } else if (e.t === 'p') {
      // post no feed que marca o perfil: +post, 1 por dia (como a story, mas sem chamas)
      const a = contas.get(e.p.conta.toLowerCase());
      if (!a?.casa || a.bloc) continue;
      const d = giornoRoma(e.ts);
      if (!a.giorniPost.has(d)) { a.giorniPost.add(d); add(a, F.post, P.post, e.ts); }
      a.giorni.add(d);
    } else if (e.t === 'c') {
      const c = e.c;
      cont.commenti++;
      if (c.stato === 'pendente') { cont.pendenti++; continue; }
      if (c.stato !== 'valido') { cont.rifiutati++; continue; }
      cont.validi++;
      const a = conta(c.conta);
      if (!a.casa && c.luogo != null && comIdx.has(c.luogo)) criarCasa(a, comIdx.get(c.luogo), c.ts);
      if (!a.casa) continue;                       // ainda sem cidade: "casa riservata"
      const ch = `${c.post}|${a.conta}`;
      let s = postEst.get(ch);
      if (!s) postEst.set(ch, s = { n: 0, tags: new Set() });
      s.n++;
      if (s.n === 1) add(a, F.commento, P.commento, c.ts);
      else if (R.extra_attivo && s.n - 1 <= R.limiti.extra) add(a, F.extra, P.extra, c.ts);
      for (const t0 of c.tags ?? []) {
        const t = t0.toLowerCase();
        if (t === a.conta) continue;
        // o limite vale só para os +3 do tag: o amigo que entra depois conta como recruta mesmo além do 10º tag
        const alvo = conta(t);
        if (!alvo.casa && !alvo.taggatoDa) alvo.taggatoDa = a.conta;
        if (s.tags.has(t) || s.tags.size >= R.limiti.tag) continue;
        s.tags.add(t);
        add(a, F.tag, P.tag, c.ts);
      }
      if (c.voto) {
        const v = c.voto.toLowerCase(), alvo = contas.get(v);
        if (v !== a.conta && alvo?.casa && !votos.has(ch)) { votos.add(ch); add(alvo, F.voto, P.voto, c.ts); }
      }
      if (c.pub != null && R.pub_nomi[c.pub] && !a.bloc) a.pub = { i: c.pub, ts: c.ts };   // o último voto vale
      a.giorni.add(giornoRoma(c.ts));
    } else {
      const a = contas.get(e.s.conta.toLowerCase());
      if (!a?.casa || a.bloc) continue;
      cont.storie++;
      const d = giornoRoma(e.ts);
      if (!a.giorniStoria.has(d)) { a.giorniStoria.add(d); add(a, F.storia, P.storia, e.ts); }
      a.fiamme = Math.max(a.fiamme, e.ts + R.fiamme_h * 3600e3);
      a.giorni.add(d);
    }
  }

  if (!eletti && agora >= G) eletti = placarNazioni(G);
  if (eletti) for (const [cod, l] of Object.entries(eletti)) if (l[0]) eventos.push({ tipo: 'gran_eletto', regione: cod, conta: l[0].conta, pts: l[0].pts, ts: G });

  // desafio relâmpago no site: o que está valendo, o que começa em até 1 dia ou o que acabou há até 3 dias
  const sfida = (R.sfide ?? []).filter(s => agora >= Date.parse(s.inizio) - 864e5 && agora < Date.parse(s.fine) + 3 * 864e5).sort((a, b) => Date.parse(b.inizio) - Date.parse(a.inizio))[0];
  let sfidaSnap = null;
  if (sfida) {
    const classifica = [...contas.values()].filter(a => a.sfide?.[sfida.id] && !a.bloc)
      .map(a => ({ conta: a.conta, n: a.sfide[sfida.id].n, ts: a.sfide[sfida.id].ts }))
      .sort((x, y) => y.n - x.n || x.ts - y.ts).slice(0, 10);
    const conclusa = agora >= Date.parse(sfida.fine);
    sfidaSnap = { id: sfida.id, titolo: sfida.titolo, premio: sfida.premio, inizio: sfida.inizio, fine: sfida.fine, conclusa, classifica: classifica.map(({ conta, n }) => ({ conta, n })) };
    if (conclusa && classifica[0]) eventos.push({ tipo: 'sfida_vinta', conta: classifica[0].conta, n: classifica[0].n, titolo: sfida.titolo, ts: Date.parse(sfida.fine) });
  }

  // ---------- mecenati: quem comprou um negócio ou outdoor (campo "giocatore" do pedido) ----------
  for (const n of eventi.commerci ?? []) {
    const a = n.giocatore && contas.get(n.giocatore.toLowerCase());
    if (!a?.casa || n.ts > agora) continue;
    add(a, F.mecenate, P.mecenate + (n.stile ? P.misura : 0), Math.max(n.ts, a.casa.ts), false);
  }

  // ---------- casas visíveis ----------
  const casas = [...contas.values()].filter(a => a.casa && !a.bloc);
  const sett = a => a.perM[kc] ?? 0;
  const regDe = a => comuni[a.casa.ci][3];
  const istatDe = a => comuni[a.casa.ci][0];
  const ordem = (k) => (x, y) => (y.perM[k] ?? 0) - (x.perM[k] ?? 0) || x.casa.ts - y.casa.ts;

  // ---------- eleições de domingo (presidente e sindaci) ----------
  let presidente = null, sindaci = {};
  for (let k = 1; k < kc; k++) {
    sindaci = {};   // cada eleição substitui os sindaci da semana anterior
    const fim = lim[k], eleg = casas.filter(a => a.casa.ts < fim && (a.perM[k] ?? 0) > 0).sort(ordem(k));
    if (eleg[0]) {
      presidente = { conta: eleg[0].conta, pts_elezione: eleg[0].perM[k], eletto_nel_mandato: k };
      eventos.push({ tipo: 'presidente_eletto', conta: eleg[0].conta, pts: eleg[0].perM[k], ts: fim });
    }
    const vistos = new Set();
    for (const a of eleg) {
      const ist = istatDe(a);
      if (vistos.has(ist) || a.conta === presidente?.conta) continue;
      vistos.add(ist);
      sindaci[ist] = { conta: a.conta, eletto_nel_mandato: k };
    }
  }

  // ---------- cargos ao vivo (um por pessoa, de cima para baixo) ----------
  const usados = new Set([presidente?.conta, ...Object.values(sindaci).map(s => s.conta)].filter(Boolean));
  const ativos = casas.filter(a => sett(a) > 0).sort(ordem(kc));
  const livres = filtro => ativos.filter(a => !usados.has(a.conta) && filtro(a));
  const marcar = a => { usados.add(a.conta); return { conta: a.conta, pts: sett(a) }; };
  const cariche = { presidente: null, leader: null, regioni: {}, sindaci: {}, consiglieri: {} };
  if (presidente) { const p = contas.get(presidente.conta); cariche.presidente = { ...presidente, pts: sett(p) }; }
  if (ativos[0]) cariche.leader = { conta: ativos[0].conta, pts: sett(ativos[0]) };
  for (const r of regioni) cariche.regioni[r.cod] = { senatori: [], presidente: null, deputati: [] };
  for (const r of regioni) cariche.regioni[r.cod].senatori = livres(a => regDe(a) === r.cod).slice(0, R.posti.senatoriPerRegione).map(marcar);
  for (const r of regioni) { const a = livres(x => regDe(x) === r.cod)[0]; cariche.regioni[r.cod].presidente = a ? marcar(a) : null; }
  const popTot = regioni.reduce((s, r) => s + r.pop, 0);
  for (const r of regioni) {
    const vagas = Math.max(R.posti.deputatiMinimo, Math.round(R.posti.deputati * r.pop / popTot));
    cariche.regioni[r.cod].deputati = livres(a => regDe(a) === r.cod).slice(0, vagas).map(marcar);
  }
  for (const [ist, s] of Object.entries(sindaci)) cariche.sindaci[ist] = { ...s, pts: sett(contas.get(s.conta)) };
  const porComune = new Map();
  for (const a of livres(() => true)) { const ist = istatDe(a); if (!porComune.has(ist)) porComune.set(ist, []); porComune.get(ist).push(a); }
  for (const [ist, lista] of porComune) cariche.consiglieri[ist] = lista.slice(0, R.posti.consiglieri).map(marcar);

  // battle of the nations: vence quem tem mais pontos por milhão de habitantes
  // (a England tem 84% da população: pelo total ela ganharia sempre; assim Wales e Northern Ireland têm chance real)
  const ptsReg = new Map(regioni.map(r => [r.cod, 0])), popReg = new Map(regioni.map(r => [r.cod, r.pop]));
  for (const a of casas) ptsReg.set(regDe(a), ptsReg.get(regDe(a)) + sett(a));
  cariche.guerra = [...ptsReg].map(([cod, pts]) => ({ cod, pts, per_milione: Math.round(pts * 1e6 / popReg.get(cod)) }))
    .sort((a, b) => b.per_milione - a.per_milione || b.pts - a.pts);

  // ---------- luoghi e casas na saída ----------
  const lugares = [...luoghi.values()].filter(l => l.visiveis.length).sort((a, b) => a.ts - b.ts);
  const liDe = new Map(lugares.map((l, i) => [l.ci, i]));
  const hoje = giornoRoma(agora);
  const serie = a => {
    let d = a.giorni.has(hoje) ? hoje : ontem(hoje), n = 0;
    while (a.giorni.has(d)) { n++; d = ontem(d); }
    return n;
  };
  // nome do pub: mais votos entre os moradores; empate -> o nome votado primeiro
  const votiPub = l => {
    const v = new Map();
    for (const a of l.visiveis) if (a.pub) { const x = v.get(a.pub.i) ?? { n: 0, ts: Infinity }; x.n++; x.ts = Math.min(x.ts, a.pub.ts); v.set(a.pub.i, x); }
    return [...v].sort((a, b) => b[1].n - a[1].n || a[1].ts - b[1].ts).map(([i, x]) => [i, x.n]);
  };
  const saidaCasas = casas.sort((a, b) => a.casa.ts - b.casa.ts).map(a => [
    a.conta, liDe.get(a.casa.ci), a.casa.lote, Math.round(a.casa.ts / 1000), a.tot, sett(a),
    a.fiamme > agora ? Math.round(a.fiamme / 1000) : 0, a.fonti, serie(a),
  ]);

  // derby: primeiro par do rodízio com casas nas duas cidades
  let derby = null;
  for (let i = 0; i < R.derby.length && !derby; i++) {
    const [a, b] = R.derby[(kc - 1 + i) % R.derby.length];
    const la = lugares.find(l => comuni[l.ci][0] === a), lb = lugares.find(l => comuni[l.ci][0] === b);
    if (la && lb) derby = { a, b, pts_a: la.visiveis.reduce((s, x) => s + sett(x), 0), pts_b: lb.visiveis.reduce((s, x) => s + sett(x), 0) };
  }

  return {
    formato: 'uk-house-by-house/snapshot@1',
    versao, demo, regola: R.versao,
    gerado_em: new Date().toISOString(),
    dati_fino: new Date(agora).toISOString(),
    mandato: { n: kc, inizio: new Date(lim[kc - 1]).toISOString(), fine: new Date(lim[kc]).toISOString() },
    contatori: {
      commenti: cont.commenti, commenti_validi: cont.validi, commenti_pendenti: cont.pendenti, commenti_rifiutati: cont.rifiutati,
      contas: contas.size, case: casas.length, case_nascoste: [...contas.values()].filter(a => a.casa && a.bloc).length,
      luoghi: lugares.length, regioni: regioni.length, comuni: comuni.length, storie: cont.storie, follower,
    },
    doppi: doppi.filter(d => d.a > agora - dia && d.da < agora + dia).map(d => ({ da: new Date(d.da).toISOString(), a: new Date(d.a).toISOString(), tipi: d.tipi })),
    // [comune, casas, fundador, ts do fundador, lotes ocupados, votos do pub [[nome, votos], ...] (mais votado primeiro)]
    luoghi: lugares.map(l => [l.ci, l.visiveis.length, l.visiveis[0].conta, Math.round(l.visiveis[0].casa.ts / 1000), l.lotti, votiPub(l)]),
    // [conta, luogo, lote, ts, punti_totali, punti_settimana, fiamme_fino, [fonti], serie_giorni]
    case: saidaCasas,
    commerci: commerci.filter(n => liDe.has(n.ci) && !(n.fino && n.fino <= agora)).map(n => ({
      li: liDe.get(n.ci), ...(n.posto != null ? { posto: n.posto } : { lote: n.lote }), id: n.id, prodotto: n.prodotto ?? 'negozio', nome: n.nome, tipo: n.tipo ?? 'altro', colore: n.colore ?? '#E0473C',
      whatsapp: n.whatsapp ?? '', instagram: n.instagram ?? '', descrizione: n.descrizione ?? '', testo: n.testo ?? '', logo: n.logo ?? '',
      ...(n.giocatore ? { giocatore: n.giocatore.toLowerCase() } : {}),
      ...(n.stile ? { stile: n.stile } : {}),   // loja "su misura" (editor)
    })),
    cariche,
    derby,
    // antes da data: os 5 primeiros de cada nação agora; depois: o resultado congelado (o 1º de cada nação é o eleito)
    ...(R.gran_elezione ? { gran_elezione: { data: R.gran_elezione.data, conclusa: !!eletti, nazioni: eletti ?? placarNazioni() } } : {}),
    ...(sfidaSnap ? { sfida: sfidaSnap } : {}),
    eventi: eventos.filter(e => e.ts <= agora).sort((a, b) => b.ts - a.ts).slice(0, 40).map(e => ({ ...e, ts: new Date(e.ts).toISOString() })),
  };
}
