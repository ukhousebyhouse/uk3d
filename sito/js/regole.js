// Regras do jogo. Compartilhado entre o site e os scripts Node (sem DOM).
export const REGOLE = {
  versao: 'rule-1.0',
  // mecenate/misura: quem compra um negócio no mapa; só fazem a casa crescer, NÃO contam no mandato (eleições)
  punti: { casa: 10, commento: 5, extra: 1, tag: 3, recluta: 25, voto: 5, storia: 20, post: 20, mecenate: 100, misura: 50 },
  // extra e tag: por post; storia e post (no feed, marcando o perfil): por dia (fuso de Londres)
  limiti: { extra: 10, tag: 10, storia: 1, post: 1 },
  extra_attivo: true,          // false = comentar várias vezes no mesmo post não soma
  fiamme_h: 24,
  disputa_s: 120,              // duas casas na mesma cidade nova em menos de 2 min = "disputa"
  // mandato: de domingo 21:00 a domingo 21:00, hora de Londres
  mandato: { giorno: 0, ora: 21 },
  // derby da semana: um par por mandato, em rodízio (ids GeoNames). Sempre cidade × cidade: nunca comunidades
  // nem clubes sectários (Celtic × Rangers fica de fora)
  derby: [
    ['2643123', '2644210'], // Manchester × Liverpool
    ['2641673', '2636531'], // Newcastle × Sunderland
    ['2650225', '2648579'], // Edinburgh × Glasgow
    ['2653822', '2636432'], // Cardiff × Swansea
    ['2643743', '2643123'], // London × Manchester (South × North)
    ['2644688', '2638077'], // Leeds × Sheffield
    ['2655984', '2643736'], // Belfast × Derry/Londonderry
    ['2655603', '2652221'], // Birmingham × Coventry
    ['2657832', '2650752'], // Aberdeen × Dundee
    ['2654675', '2656173'], // Bristol × Bath
  ],
  meta_passo: 5000,            // a meta global é o próximo múltiplo deste número de casas
  // a "property ladder" britânica: terraced -> semi -> detached -> manor
  livelli: [
    { min: 0, nome: 'Tiny Cottage' },
    { min: 20, nome: 'Terraced House' },
    { min: 30, nome: 'Terraced House with Garden' },
    { min: 45, nome: 'Semi-Detached' },
    { min: 70, nome: 'Semi with Garage' },
    { min: 100, nome: 'Detached House' },
    { min: 140, nome: 'Detached with Conservatory' },
    { min: 190, nome: 'Georgian Townhouse' },
    { min: 250, nome: 'Country House' },
    { min: 330, nome: 'Manor House' },
    { min: 600, nome: 'Clock Tower' },
    { min: 900, nome: 'Skyscraper' },
    { min: 1300, nome: 'Country Estate' },
    { min: 1900, nome: 'Palace' },
    { min: 2800, nome: 'Top of the Map' },
  ],
  // ordem de distribuição: de cima para baixo, um cargo por pessoa
  cariche: ['presidente', 'senatore', 'presidente_regione', 'deputato', 'sindaco', 'consigliere'],
  // regione = nação: 3 Lords por nação, 650 MPs divididos pela população (mínimo 2 por nação)
  posti: { presidente: 1, senatoriPerRegione: 3, deputati: 650, deputatiMinimo: 2, consiglieri: 10 },
  marchi: { chiesa: 30, palazzinaOgni: 100, ospedale: 1000, stadio: 5000 },
  // lotes livres desenhados depois da última casa (só desenho: convite para marcar amigos)
  lotti_liberi: 3,
  cartellone_da: 15,           // cidades com pelo menos estas casas mostram um outdoor "YOUR AD HERE"
  // Christmas no village green (mês-dia, hora de Londres): árvore e luzes até a Twelfth Night
  natale: { da: '11-28', a: '01-06' },
  halloween: { da: '10-27', a: '10-31' },
  // Bonfire Night (5 de novembro): fogueira e fogos no village green
  bonfire: { da: '11-01', a: '11-06' },
  // dia de cada nação: casas da nação enfeitadas e pontos em dobro nas stories (amministra.mjs doppi)
  feste_nazione: [
    { reg: 'SCT', md: '11-30', nome: "St Andrew's Day" },
    { reg: 'SCT', md: '01-25', nome: 'Burns Night' },
    { reg: 'WLS', md: '01-25', nome: "St Dwynwen's Day" },
    { reg: 'WLS', md: '03-01', nome: "St David's Day" },
    { reg: 'NIR', md: '03-17', nome: "St Patrick's Day" },
    { reg: 'ENG', md: '04-23', nome: "St George's Day" },
  ],
};

const mesDia = ts => new Date(ts).toLocaleDateString('en-CA', { timeZone: 'Europe/London' }).slice(5);
const forcado = nome => (typeof location !== 'undefined' ? new URLSearchParams(location.search).get(nome) : null);
const noPeriodo = (md, { da, a }) => (da <= a ? md >= da && md <= a : md >= da || md <= a);

// Halloween: abóboras nas casas e no village green (?halloween=1 / ?halloween=0 forçam nos testes)
export function halloweenAttivo(ts = Date.now()) {
  const f = forcado('halloween');
  return f !== null ? f !== '0' : noPeriodo(mesDia(ts), REGOLE.halloween);
}

// o Natal está ativo nesta data? (?natale=1 / ?natale=0 forçam nos testes)
export function nataleAttivo(ts = Date.now()) {
  const f = forcado('natale');
  return f !== null ? f !== '0' : noPeriodo(mesDia(ts), REGOLE.natale);
}

// Bonfire Night (?bonfire=1 / ?bonfire=0 forçam nos testes)
export function bonfireAttivo(ts = Date.now()) {
  const f = forcado('bonfire');
  return f !== null ? f !== '0' : noPeriodo(mesDia(ts), REGOLE.bonfire);
}

// festas de nação de hoje: [{ reg, nome }] (?festa=WLS força a festa de uma nação nos testes)
export function festeNazioneOggi(ts = Date.now()) {
  const f = forcado('festa');
  if (f) return REGOLE.feste_nazione.filter(x => x.reg === f).slice(0, 1);
  const md = mesDia(ts);
  return REGOLE.feste_nazione.filter(x => x.md === md);
}

export const NOMI_CARICHE = {
  presidente: 'Prime Minister',
  senatore: 'Lord/Lady',
  presidente_regione: 'First Minister',
  deputato: 'MP',
  sindaco: 'Mayor',
  consigliere: 'Councillor',
};

export const DESCR_CARICHE = {
  presidente: '1 for the whole UK · elected on Sunday at 9pm',
  senatore: '3 per nation',
  presidente_regione: '1 per nation',
  deputato: '650, shared out by population (at least 2 per nation)',
  sindaco: '1 per town · elected on Sunday at 9pm',
  consigliere: '10 per town',
};

// cargos com tradução galesa (no painel da Wales tudo aparece nas duas línguas, como nas placas de lá)
export const NOMI_CARICHE_CY = {
  presidente: 'Prif Weinidog y DU',
  senatore: 'Arglwydd/Arglwyddes',
  presidente_regione: 'Prif Weinidog',
  deputato: 'AS',
  sindaco: 'Maer',
  consigliere: 'Cynghorydd',
};

// ordem igual ao array "fonti" de cada casa no snapshot
export const FONTI = [
  ['casa', 'House', '#FFC93C'],
  ['commento', 'Comments on posts', '#4FB6FF'],
  ['extra', 'Extra comments', '#A7D8FF'],
  ['tag', 'Mates tagged', '#3DDC97'],
  ['recluta', 'Mates who joined', '#1F9D6B'],
  ['voto', 'Votes received', '#E0473C'],
  ['storia', 'Stories tagging us', '#FF8A00'],
  ['post', 'Posts tagging us', '#D94F8A'],
  ['mecenate', 'Business on the map', '#6C4FD3'],
];

export const COME_GUADAGNARE = p => [
  ['commento', 'Comment on our posts', `+${p.commento} per post`],
  ['extra', 'Extra comments', `+${p.extra} (up to 10)`],
  ['tag', 'Tag your mates', `+${p.tag} per mate (up to 10)`],
  ['recluta', 'Mates who join', `+${p.recluta} when a mate you tagged gets a house`],
  ['voto', 'Votes received', `+${p.voto} (1 per person per post)`],
  ['storia', 'Story tagging @ukhousebyhouse', `+${p.storia} (1 a day) and your house is on fire for 24 h`],
  ['post', 'Feed post tagging us', `+${p.post} (1 a day): tag @ukhousebyhouse in the photo`],
  ['mecenate', 'Put your business on the map', `+${p.mecenate} (+${p.misura} custom) and a Patron badge: they grow your house but don't count in elections`],
  ['casa', 'Having a house', `+${p.casa}, once`],
];

export function livelloDi(punti) {
  let n = 0;
  for (let i = 0; i < REGOLE.livelli.length; i++) if (punti >= REGOLE.livelli[i].min) n = i;
  return n;
}

// formatação britânica, fuso de Londres: "6,966", "5 November", "Thursday 5 November", "21:00"
export const num = n => Number(n).toLocaleString('en-GB', { maximumFractionDigits: 2 });
export const punti = n => `${num(n)} ${n === 1 ? 'point' : 'points'}`;
const FUSO = { timeZone: 'Europe/London' };
export const dataBreve = ts => new Date(ts).toLocaleDateString('en-GB', { ...FUSO, day: 'numeric', month: 'long' });
export const dataLunga = ts => new Date(ts).toLocaleDateString('en-GB', { ...FUSO, weekday: 'long', day: 'numeric', month: 'long' });
export const ora = ts => new Date(ts).toLocaleTimeString('en-GB', { ...FUSO, hour: '2-digit', minute: '2-digit' });
