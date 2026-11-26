// Christmas on the map (sito/data/natale.json): liga as compras e publica o arquivo no site.
// No UK a loja paga pela Stripe com o link de api/natale.php; o webhook manda um e-mail com o comando certo daqui.
// Uso:
//   node strumenti/natale.mjs lista                       quem comprou o quê + dias do Advent livres + links de pagamento
//   node strumenti/natale.mjs negozio <id>                 "Christmas shop" (loja decorada + Christmas Market na High Street)
//   node strumenti/natale.mjs avvento <AAAA-MM-DD> <id>    um dia do Advent calendar (faixa no mapa + baú ×bonus)
//   node strumenti/natale.mjs sponsor <id>                 Official Christmas sponsor (faixa de Natal em todo o mapa)
//   node strumenti/natale.mjs togli <id>                   tira a loja de tudo (ex.: reembolso)
//   node strumenti/natale.mjs link <id>                    links de pagamento (Stripe) para mandar à loja
// <id> = id do comércio em config/commerci.json (o mesmo do pedido). Quem compra Advent ou Sponsor já ganha a decoração.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ARQ = path.join(RAIZ, 'sito', 'data', 'natale.json');
const SITE = 'https://ukhousebyhouse.com';
const nat = JSON.parse(fs.readFileSync(ARQ, 'utf8'));
const commerci = JSON.parse(fs.readFileSync(path.join(RAIZ, 'config', 'commerci.json'), 'utf8'));
const nome = id => commerci.find(c => c.id === id)?.nome ?? `(id ${id} não está em commerci.json)`;
const [cmd, a, b] = process.argv.slice(2);
const exige = id => { if (!commerci.some(c => c.id === id)) { console.error(`ERRO: comércio ${id} não existe em config/commerci.json (aprove a loja antes)`); process.exit(1); } };
const DIAS = Array.from({ length: 24 }, (_, i) => `2026-12-${String(i + 1).padStart(2, '0')}`);
const links = id => {
  const u = (o, d) => `${SITE}/api/natale.php?shop=${id}&offer=${o}${d ? `&day=${d}` : ''}`;
  const livre = DIAS.find(d => !nat.avvento[d] && d >= new Date().toISOString().slice(0, 10));
  return [`🎄 Christmas shop £9.99:            ${u('negozio')}`, `🎄 Christmas shop (renewal) £7.99:  ${u('rinnovo')}`,
    `🎁 Advent day £19.99 (troque o day): ${u('avvento', livre ?? '2026-12-24')}`, `⭐ Official sponsor £149:           ${nat.sponsor ? '(já vendido)' : u('sponsor')}`].join('\n');
};
let muda = true;
if (cmd === 'negozio') { exige(a); if (!nat.negozi.includes(a)) nat.negozi.push(a); console.log(`ok: 🎄 Christmas shop → ${nome(a)}`); }
else if (cmd === 'avvento') {
  if (!DIAS.includes(a)) { console.error('ERRO: dia do Advent é de 2026-12-01 a 2026-12-24'); process.exit(1); }
  exige(b);
  if (nat.avvento[a] && nat.avvento[a] !== b) { console.error(`ERRO: ${a} já é de ${nome(nat.avvento[a])}`); process.exit(1); }
  nat.avvento[a] = b; console.log(`ok: 🎁 Advent ${a} → ${nome(b)}`);
}
else if (cmd === 'sponsor') {
  exige(a);
  if (nat.sponsor && nat.sponsor.id !== a) { console.error(`ERRO: o sponsor já é ${nome(nat.sponsor.id)} (só 1)`); process.exit(1); }
  nat.sponsor = { id: a }; console.log(`ok: ⭐ Official sponsor → ${nome(a)}`);
}
else if (cmd === 'togli') {
  nat.negozi = nat.negozi.filter(x => x !== a);
  for (const [d, id] of Object.entries(nat.avvento)) if (id === a) delete nat.avvento[d];
  if (nat.sponsor?.id === a) nat.sponsor = null;
  console.log(`ok: ${nome(a)} tirado do Natal`);
}
else if (cmd === 'link') { muda = false; exige(a); console.log(`${nome(a)}\n${links(a)}`); }
else {
  muda = false;
  console.log(`⭐ Sponsor: ${nat.sponsor ? nome(nat.sponsor.id) : 'livre'}`);
  console.log(`🎄 Christmas shops (${nat.negozi.length}): ${nat.negozi.map(nome).join(' · ') || '—'}`);
  console.log(`🎁 Advent: ${DIAS.map(d => `${d.slice(8)} ${nat.avvento[d] ? nome(nat.avvento[d]) : 'livre'}`).join('\n   ')}`);
  console.log('\nLinks de pagamento por loja: node strumenti/natale.mjs link <id>');
}
if (muda) {
  nat.avvento = Object.fromEntries(Object.entries(nat.avvento).sort());
  fs.writeFileSync(ARQ, JSON.stringify(nat) + '\n');
  const { conectar } = await import('./pubblica.mjs');
  const ftp = conectar(() => {});
  ftp.enviar([{ local: ARQ, remoto: `${ftp.web}data/natale.json` }]);
  console.log('natale.json enviado ao site (vale para quem abrir o site a partir de agora)');
}
