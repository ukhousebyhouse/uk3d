// Testes do resolvedor de cidades (comentários típicos do Reino Unido).
// Uso: node strumenti/teste-risolutore.mjs
import { Risolutore, estrairVoto, estrairTags } from './risolutore.mjs';

const r = new Risolutore();
let falhas = 0;
const caso = (txt, esperado) => {
  const t0 = performance.now(), res = r.risolvere(txt), ms = performance.now() - t0;
  const nome = res.istat ? `${res.nome} (${r.comuni.get(res.istat).sigla})` : null;
  const ok = esperado === null ? res.istat === null : nome === esperado;
  if (!ok) falhas++;
  console.log(`${ok ? '✔' : '✘'} ${JSON.stringify(txt).padEnd(44)} → ${nome ?? `— ${res.motivo}${res.candidati ? ` [${res.candidati.join(', ')}]` : ''}`}${ok ? '' : `   (esperado: ${esperado ?? 'nada'})`}${ms > 50 ? ` ${ms.toFixed(0)}ms` : ''}`);
};

// básicos: cidade + país, cidade + county, só a cidade
caso('Leeds, England', 'Leeds (West Yorkshire)');
caso('leeds', 'Leeds (West Yorkshire)');
caso('Manchester 🐝', 'Manchester (Greater Manchester)');
caso('Glasgow, Scotland 🏴󠁧󠁢󠁳󠁣󠁴󠁿', 'Glasgow (Glasgow)');
caso('Cardiff Wales', 'Cardiff (Cardiff)');
caso('Belfast, Northern Ireland', 'Belfast (Belfast)');
caso('Belfast NI', 'Belfast (Belfast)');
caso("I'm from Sheffield, South Yorkshire", 'Sheffield (South Yorkshire)');
caso('Truro, Cornwall', 'Truro (Cornwall)');
caso('Inverness, Highlands', 'Inverness (Highland)');
caso('Newcastle upon Tyne', 'Newcastle upon Tyne (Tyne and Wear)');
caso('Stoke on Trent', 'Stoke-on-Trent (Staffordshire)');
caso('Cardiff', 'Cardiff (Cardiff)');
caso('Reading', 'Reading (Reading)');
caso('Newport', 'Newport (Newport)');
caso('St Albans, Herts', 'St Albans (Hertfordshire)');
// apelidos e nomes em galês / Gaelic / Irish
caso('Brum', 'Birmingham (West Midlands)');
caso('the toon', 'Newcastle upon Tyne (Tyne and Wear)');
caso('Glesga', 'Glasgow (Glasgow)');
caso('Caerdydd, Cymru', 'Cardiff (Cardiff)');
caso('Abertawe', 'Swansea (Swansea)');
caso('Derry', 'Derry/Londonderry (Derry City and Strabane)');
caso('Londonderry', 'Derry/Londonderry (Derry City and Strabane)');
caso('Belfast, Norn Iron', 'Belfast (Belfast)');
// postcode
caso('LS6', 'Leeds (West Yorkshire)');
caso('BT9 5AB', 'Belfast (Belfast)');
caso('M1 2AB Manchester', 'Manchester (Greater Manchester)');
// Londres é uma cidade só
caso('London', 'London (Greater London)');
caso('Hackney, London', 'London (Greater London)');
caso('Richmond, North Yorkshire', 'Richmond (North Yorkshire)');
// homônimos: county / nação decidem
caso('Newport, Wales', 'Newport (Newport)');
caso('Newport, Isle of Wight', 'Newport (Isle of Wight)');
// county + nação: o county decide (antes a nação deixava todos passarem)
caso('Fawley, Hampshire, England', 'Fawley (Hampshire)');
caso('newport, shropshire, england', 'Newport (Telford and Wrekin)');
caso('Hythe and Dibden, England', 'Hythe (Hampshire)');
caso('Hythe england', 'Hythe (Kent)');
caso('Barrow, Suffolk', 'Barrow (Suffolk)');
caso('Barrow,england', 'Barrow in Furness (Westmorland and Furness)');
caso('Chalfont St Peter, England', 'Chalfont Saint Peter (Buckinghamshire)');
caso('Southend, England', 'Southend-on-Sea (Southend-on-Sea)');
caso('Bromley, England', 'London (Greater London)');
// só o county: a cidade principal
caso('Essex England', 'Chelmsford (Essex)');
caso('Cornwall, England', 'Truro (Cornwall)');
caso('Wirral,England', 'Birkenhead (Merseyside)');
// erros de digitação
caso('Liverpol', 'Liverpool (Merseyside)');
caso('Edinbrugh', 'Edinburgh (Edinburgh)');
caso('Middlesborough', 'Middlesbrough (Middlesbrough)');
// palavras comuns que também são cidades
caso('love this so much', null);
caso('come join us in Leeds', 'Leeds (West Yorkshire)');
caso('Reading, Berkshire', 'Reading (Reading)');
caso('reading this now haha', null);
// fora do Reino Unido: recusa
caso('Birmingham, Alabama', null);
caso('Dublin', null);
caso('Cork, Ireland', null);
caso('Douglas, Isle of Man', null);
caso('Manchester, New Hampshire USA', null);
// só nação / nada
caso('Scotland', null);
caso('England 🏴󠁧󠁢󠁥󠁮󠁧󠁿', null);
caso('🔥🔥🔥', null);
caso('@mate look at this', null);

// votos e marcações
const v = (txt, esp) => { const x = estrairVoto(txt); const ok = x === esp; if (!ok) falhas++; console.log(`${ok ? '✔' : '✘'} vote ${JSON.stringify(txt)} → ${x}`); };
v('vote @olivia_smith', 'olivia_smith');
v('Voting for @Jack.Jones!', 'jack.jones');
v('I voted yesterday', null);
const tg = estrairTags('oi @Amy_1 @rhys.b. and @amy_1');
const okT = JSON.stringify(tg) === JSON.stringify(['amy_1', 'rhys.b']);
if (!okT) falhas++;
console.log(`${okT ? '✔' : '✘'} tags → ${JSON.stringify(tg)}`);

// desempenho
const t0 = performance.now();
for (let i = 0; i < 2000; i++) r._risolvere(`from town number ${i} Leeds`);
console.log(`\n2000 textos novos: ${(performance.now() - t0).toFixed(0)} ms`);
console.log(falhas ? `${falhas} falha(s)` : 'todos os testes passaram');
process.exit(falhas ? 1 : 0);
