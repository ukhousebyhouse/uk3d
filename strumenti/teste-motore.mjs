// Testes das regras do motor com eventos montados à mão.
// Uso: node strumenti/teste-motore.mjs
import { calcolare } from './motore.mjs';
import { daRoma } from '../sito/js/tempo.js';

const comuni = [['058091', 'Roma', 'RM', '12', 0, 0, 2800000], ['015146', 'Milano', 'MI', '03', -270, -380, 1400000]];
const regioni = [{ cod: '12', nome: 'Lazio', pop: 5700000 }, { cod: '03', nome: 'Lombardia', pop: 10000000 }];
const qui = daRoma(2026, 10, 15, 14), H = 3600e3;          // quinta 15/10, 14h Roma
const dom21 = daRoma(2026, 10, 18, 21);                     // fim do mandato 1
const c = (conta, ts, extra = {}) => ({ post: 'p1', conta, ts, luogo: null, tags: [], voto: null, stato: 'valido', ...extra });

const eventi = {
  inizio: qui,
  posts: [{ id: 'p1', ts: qui }, { id: 'p2', ts: dom21 + H }],
  commenti: [
    c('anna', qui + 1e3, { luogo: '058091' }),                        // casa 10 + commento 5, fundadora de Roma
    c('bruno', qui + 30e3, { luogo: '058091' }),                      // 30 s depois: disputa
    ...Array.from({ length: 12 }, (_, i) => c('anna', qui + 2e3 + i)), // extras: só 10 contam
    c('anna', qui + 5 * H, { tags: ['carla', 'carla', 'anna', 'dario'] }), // carla e dario: +3 cada (repetida e a própria não contam)
    c('carla', qui + 6 * H, { luogo: '015146' }),                     // carla entra: anna ganha +25
    c('dario', qui + 7 * H, { luogo: '015146' }),                     // dario entra: anna ganha +25
    c('bruno', qui + 8 * H, { voto: 'anna' }),                        // voto +5 para anna
    c('bruno', qui + 9 * H, { voto: 'anna' }),                        // segundo voto no mesmo post: não conta
    c('carla', qui + 9 * H, { voto: 'carla' }),                       // votar em si mesma: não conta
    c('eva', qui + 10 * H, { luogo: '058091' }),                      // bloqueada: lote reservado, casa escondida
    c('fabio', qui + 11 * H),                                         // sem cidade: não ganha casa
    c('gino', qui + 12 * H, { stato: 'rifiutato', luogo: '058091' }),
    { post: 'p2', conta: 'bruno', ts: dom21 + 2 * H, luogo: null, tags: [], voto: null, stato: 'valido' }, // mandato 2
  ],
  storie: [
    { conta: 'bruno', ts: qui + 13 * H }, { conta: 'bruno', ts: qui + 14 * H },  // mesmo dia: só +20 uma vez
    { conta: 'carla', ts: daRoma(2026, 10, 17, 12) },                           // dia em dobro: +40
    { conta: 'fabio', ts: qui + 15 * H },                                       // sem casa: ignorada
    { conta: 'dario', ts: dom21 + H },                                          // 2 h antes de "agora": em chamas
  ],
  bloccati: ['eva'],
  doppi: [{ da: daRoma(2026, 10, 17, 0), a: daRoma(2026, 10, 18, 0), tipi: ['storia'] }],
};

const agora = dom21 + 3 * H;
const s = calcolare({ eventi, comuni, regioni, agora });
const casa = conta => s.case.find(x => x[0] === conta);
let falhas = 0;
const ok = (cond, msg) => { console.log(`${cond ? '✔' : '✘'} ${msg}`); if (!cond) falhas++; };

ok(casa('anna')[4] === 10 + 5 + 10 + 6 + 50 + 5, `anna: casa+commento+10 extras+2 tags+2 recrute+1 voto = 86 (deu ${casa('anna')[4]})`);
ok(JSON.stringify(casa('anna')[7]) === JSON.stringify([10, 5, 10, 6, 50, 5, 0, 0, 0, 0]), `anna: fontes ${JSON.stringify(casa('anna')[7])}`);
ok(casa('bruno')[4] === 10 + 5 + 2 + 20 + 5, `bruno: casa+commento+2 extras (votos)+1 storia+commento no mandato 2 = 42 (deu ${casa('bruno')[4]})`);
ok(casa('bruno')[5] === 5, `bruno: pontos do mandato 2 = 5 (deu ${casa('bruno')[5]})`);
ok(casa('bruno')[6] === 0, 'bruno: chamas apagadas (story há mais de 24 h)');
ok(casa('dario')[6] > 0, 'dario: casa em chamas (story há 2 h)');
ok(casa('carla')[4] === 10 + 5 + 1 + 40, `carla: casa+commento+1 extra+storia em dia dobrado = 56 (deu ${casa('carla')[4]})`);
ok(!casa('eva') && !casa('fabio') && !casa('gino'), 'eva (bloqueada), fabio (sem cidade) e gino (rejeitado) sem casa visível');
const roma = s.luoghi.find(l => l[0] === 0);
ok(roma[1] === 2 && roma[4] === 3 && roma[2] === 'anna', `Roma: 2 casas visíveis, 3 lotes, fundadora anna (${JSON.stringify(roma)})`);
ok(s.eventi.some(e => e.tipo === 'disputa' && e.secondo === 'bruno' && e.differenza_s === 29), 'evento de disputa anna × bruno (29 s)');
ok(s.mandato.n === 2, `mandato atual = 2 (deu ${s.mandato.n})`);
ok(s.cariche.presidente?.conta === 'anna', `presidente eleito no domingo = anna (deu ${s.cariche.presidente?.conta})`);
ok(s.cariche.sindaci['015146']?.conta === 'carla', `sindaca de Milano = carla (deu ${s.cariche.sindaci['015146']?.conta})`);
ok(s.cariche.leader?.conta === 'dario', `líder do mandato 2 = dario, story +20 (deu ${s.cariche.leader?.conta})`);
ok(s.contatori.commenti_rifiutati === 1 && s.contatori.case_nascoste === 1, 'contadores: 1 rejeitado, 1 casa escondida');

// comércios: reservam o próximo lote na hora da aprovação; expirados somem mas o lote continua reservado
const s2 = calcolare({
  eventi: {
    ...eventi,
    commenti: [c('anna', qui + 1e3, { luogo: '058091' }), c('bruno', qui + 3 * H, { luogo: '058091' }), c('carla', qui + 5 * H, { luogo: '058091' })],
    storie: [], bloccati: [],
    commerci: [
      { id: 'n1', istat: '058091', ts: qui + 2 * H, prodotto: 'negozio', nome: 'Pizzeria' },               // entre anna e bruno: lote 1
      { id: 'n2', istat: '058091', ts: qui + 4 * H, fino: qui + 4.5 * H, prodotto: 'cartellone', nome: 'X' }, // expirado: lote 3 fica reservado
      { id: 'n3', istat: '015146', ts: qui + 4 * H, nome: 'Milano' },                                     // cidade sem casas: ignorado
    ],
  },
  comuni, regioni, agora,
});
const lote = conta => s2.case.find(x => x[0] === conta)[2];
ok(lote('anna') === 0 && lote('bruno') === 2 && lote('carla') === 4, `casas pulam os lotes dos comércios (anna 0, bruno 2, carla 4; deu ${lote('anna')}, ${lote('bruno')}, ${lote('carla')})`);
ok(s2.commerci.length === 1 && s2.commerci[0].id === 'n1' && s2.commerci[0].lote === 1 && s2.commerci[0].li === 0, `só o comércio ativo aparece, no lote 1 (${JSON.stringify(s2.commerci.map(n => [n.id, n.lote]))})`);
ok(s2.luoghi[0][4] === 5, `Roma: 5 lotes ocupados (3 casas + 2 comércios; deu ${s2.luoghi[0][4]})`);

// mecenate (+100, +50 su misura) não conta no mandato; post no feed +20 uma vez por dia
const s3 = calcolare({
  eventi: {
    ...eventi,
    commenti: [c('anna', qui + 1e3, { luogo: '058091' }), c('bruno', qui + 2e3, { luogo: '058091' })],
    storie: [], bloccati: [], doppi: [],
    commerci: [{ id: 'n1', istat: '058091', ts: qui + H, nome: 'Pizzeria', giocatore: 'Anna', stile: { oggetto: 'pizza' } }],
    post: [{ conta: 'bruno', ts: qui + 2 * H }, { conta: 'bruno', ts: qui + 3 * H }, { conta: 'bruno', ts: qui + 30 * H }],
  },
  comuni, regioni, agora: qui + 40 * H,
});
const c3 = conta => s3.case.find(x => x[0] === conta);
ok(c3('anna')[4] === 10 + 5 + 150 && c3('anna')[5] === 15 && c3('anna')[7][8] === 150, `anna mecenate: total 165, mandato 15 (deu ${c3('anna')[4]} / ${c3('anna')[5]})`);
ok(c3('bruno')[7][7] === 40 && c3('bruno')[5] === 55, `bruno: 2 dias de post = +40 e contam no mandato (deu ${c3('bruno')[7][7]} / ${c3('bruno')[5]})`);

// recruta além do 10º tag: os +3 param no limite, mas o amigo que entra depois ainda dá +25
const muitos = Array.from({ length: 12 }, (_, i) => `amico${i}`);
const s4 = calcolare({
  eventi: {
    ...eventi,
    commenti: [c('anna', qui + 1e3, { luogo: '058091' }), c('anna', qui + 2e3, { tags: muitos }), c('amico11', qui + 3e3, { luogo: '058091' })],
    storie: [], bloccati: [], doppi: [], commerci: [], post: [],
  },
  comuni, regioni, agora: qui + 10 * H,
});
const a4 = s4.case.find(x => x[0] === 'anna');
ok(a4[7][3] === 30 && a4[7][4] === 25, `anna: tag limitado a 10 (+30) e recruta do 12º amigo (+25) (deu tag ${a4[7][3]}, recluta ${a4[7][4]})`);

// desbloqueios (3ª casa = cabine) e votos no nome do pub: vale o último voto de cada morador; empate -> o votado primeiro
const s5 = calcolare({
  eventi: {
    ...eventi,
    commenti: [
      c('anna', qui + 1e3, { luogo: '058091', pub: 2 }), c('bruno', qui + 2e3, { luogo: '058091', pub: 0 }), c('carla', qui + 3e3, { luogo: '058091', pub: 0 }),
      c('dario', qui + 4e3, { luogo: '015146', pub: 2 }),            // mora em Milano: não vota no pub de Roma
      c('carla', qui + 5e3, { pub: 2 }),                             // carla muda o voto: Crown 2 × Red Lion 1
    ],
    storie: [], bloccati: [], doppi: [], commerci: [], post: [],
  },
  comuni, regioni, agora: qui + 10 * H,
});
const roma5 = s5.luoghi.find(l => l[0] === 0);
ok(JSON.stringify(roma5[5]) === '[[2,2],[0,1]]', `pub de Roma: [[2,2],[0,1]] (deu ${JSON.stringify(roma5[5])})`);
ok(s5.eventi.some(e => e.tipo === 'traguardo' && e.id === 'cabina' && e.conta === 'carla'), 'evento: Roma desbloqueou a cabine com a casa da carla');
// grande eleição: pontos do jogo inteiro por nação, congelados na data (pontos depois dela não mudam o resultado)
const { estrairPub, REGOLE } = await import('../sito/js/regole.js');
const gAntes = REGOLE.gran_elezione;
REGOLE.gran_elezione = { data: new Date(qui + 6 * H).toISOString(), titolo: 'First Minister' };
const s6 = calcolare({
  eventi: {
    ...eventi,
    commenti: [
      c('anna', qui + 1e3, { luogo: '058091' }), c('bruno', qui + 2e3, { luogo: '058091' }), c('carla', qui + 3e3, { luogo: '015146' }),
      c('bruno', qui + H, { tags: ['x1', 'x2'] }),                                   // bruno passa a anna antes da data
      c('anna', qui + 7 * H, { post: 'p2', tags: ['y1', 'y2', 'y3'] }),             // depois da data: não muda o eleito
    ],
    storie: [], bloccati: [], doppi: [], commerci: [], post: [],
  },
  comuni, regioni, agora: qui + 10 * H,
});
REGOLE.gran_elezione = gAntes;
const ge = s6.gran_elezione;
ok(ge?.conclusa && ge.nazioni['12'][0].conta === 'bruno' && ge.nazioni['03'][0].conta === 'carla', `grande eleição: Lazio bruno, Lombardia carla (deu ${JSON.stringify(ge?.nazioni)})`);
ok(s6.eventi.filter(e => e.tipo === 'gran_eletto').length === 2, 'eventos gran_eletto: um por nação com casas');
ok(estrairPub('Pub: the rose and crown!') === 4 && estrairPub('pub Crown') === 2 && estrairPub("pub kings head") === 5 && estrairPub('the pub is great') === null && estrairPub('Leeds, England') === null,
  'estrairPub: "rose and crown", "Crown", "kings head"; frase qualquer com "pub" não vale');

// desafio relâmpago: conta só amigos novos cuja casa nasceu na janela; empate -> quem chegou primeiro
const sfAntes = REGOLE.sfide;
REGOLE.sfide = [{ id: 't', inizio: new Date(qui + 1 * H).toISOString(), fine: new Date(qui + 5 * H).toISOString(), titolo: 'Teste', premio: 'x' }];
const s7 = calcolare({
  eventi: {
    ...eventi,
    commenti: [
      c('anna', qui, { luogo: '058091' }), c('bruno', qui + 1e3, { luogo: '058091' }),
      c('anna', qui + 2e3, { tags: ['a1', 'a2', 'a3'] }), c('bruno', qui + 3e3, { tags: ['b1', 'b2'] }),
      c('a1', qui + 0.5 * H, { luogo: '058091' }),                                   // antes da janela: não conta
      c('b1', qui + 2 * H, { luogo: '058091' }), c('a2', qui + 2.5 * H, { luogo: '058091' }),
      c('b2', qui + 3 * H, { luogo: '058091' }), c('a3', qui + 3.5 * H, { luogo: '058091' }),
      c('a4', qui + 6 * H, { luogo: '058091' }),                                      // depois da janela (e sem tag)
    ],
    storie: [], bloccati: [], doppi: [], commerci: [], post: [],
  },
  comuni, regioni, agora: qui + 8 * H,
});
REGOLE.sfide = sfAntes;
const sf = s7.sfida;
ok(sf?.conclusa && JSON.stringify(sf.classifica) === JSON.stringify([{ conta: 'bruno', n: 2 }, { conta: 'anna', n: 2 }]), `desafio: bruno e anna com 2, bruno chegou antes (deu ${JSON.stringify(sf?.classifica)})`);
ok(s7.eventi.some(e => e.tipo === 'sfida_vinta' && e.conta === 'bruno'), 'evento sfida_vinta para bruno');

// boas-vindas: quem entra por indicação ganha +25 só se a casa nasceu depois de invitato_da
const invAntes = REGOLE.invitato_da;
REGOLE.invitato_da = new Date(qui + 1 * H).toISOString();
const s8 = calcolare({
  eventi: {
    ...eventi,
    commenti: [c('anna', qui, { luogo: '058091' }), c('anna', qui + 2e3, { tags: ['v1', 'v2'] }),
      c('v1', qui + 0.5 * H, { luogo: '058091' }), c('v2', qui + 2 * H, { luogo: '058091' })],
    storie: [], bloccati: [], doppi: [], commerci: [], post: [],
  },
  comuni, regioni, agora: qui + 3 * H,
});
REGOLE.invitato_da = invAntes;
const c8 = conta => s8.case.find(x => x[0] === conta);
ok(c8('v1')[7][9] === 0 && c8('v2')[7][9] === 25 && c8('v2')[4] === 10 + 5 + 25, `boas-vindas: v1 (antes) 0, v2 (depois) +25 (deu ${c8('v1')[7][9]}, ${c8('v2')[7][9]}, total v2 ${c8('v2')[4]})`);
ok(c8('anna')[7][4] === 50, `anna continua com +25 por cada amigo (deu ${c8('anna')[7][4]})`);
console.log(falhas ? `\n${falhas} falha(s)` : '\ntodos os testes passaram');
process.exit(falhas ? 1 : 0);
