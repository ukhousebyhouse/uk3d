// Resolvedor: texto livre de um comentário -> cidade do mapa (id GeoNames).
// Ex.: "Leeds, West Yorkshire 🔥" -> 2644688; "LS6" -> Leeds; "Caerdydd, Cymru" -> Cardiff; "Belfast, NI" -> Belfast.
// Só conhece o Reino Unido: "Birmingham, Alabama", "Dublin", "Isle of Man" são recusados. Sem certeza, devolve istat null e o motivo.
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..');

export const norm = s => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
  .replace(/[’'`´]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

// artigos e preposições: ignorados ao comparar nomes ("Newcastle upon Tyne" = "newcastle tyne"); y/yr galês
const STOP = new Set('of the upon on in under by at and y yr'.split(' '));
// palavras comuns que não devem virar cidade por aproximação
const COMUNS = new Set(('im i am from live living lived based born bred raised originally orig near nr outside just here there hello hi hiya hey ' +
  'this that these those is it its so much now look at what who was be me you we us they them he she his her a an to for really very too ' +
  'my our house home town city village hamlet place area country county co nation uk gb britain great british united kingdom brit ' +
  'please pls plz cheers thanks ta love lol haha mate mates lads lad lass bro fam yes yeah aye no not and the with get got give want ' +
  'north south east west northern southern eastern western central upper lower old new little great greater ' +
  'proper well good best top first last still now today ' +
  // vocabulário do próprio jogo
  'cottage terraced terrace semi detached conservatory georgian manor mansion palace tower skyscraper estate points point level ' +
  'mayor minister prime mp lord lady councillor story stories fire derby vote voting follow following like tag tagged').split(' '));
// cidades cujo nome é uma palavra comum: só valem com confirmação (nação/county/postcode) ou sozinhas com maiúscula
const COMUNI_PAROLE = new Set(('reading street wells hope march sale deal rye ware send wool ash holt mold wick cliff bath bury eye ham how box ' +
  'over corby hatch hook moss marsh ford bridge church park green heath hill vale bank cross castle mill brook wood lea leigh barton ' +
  'stone wells usk bala nash sandy poole goring belper looe redruth').split(' '));

// apelidos e nomes estrangeiros -> nome oficial da cidade
const ALIAS = {
  brum: 'Birmingham', brummie: 'Birmingham', manc: 'Manchester', manny: 'Manchester', mancs: 'Manchester',
  'the toon': 'Newcastle upon Tyne', toon: 'Newcastle upon Tyne', newcastle: 'Newcastle upon Tyne', geordieland: 'Newcastle upon Tyne',
  scouse: 'Liverpool', scouseland: 'Liverpool', pool: 'Liverpool', 'the big smoke': 'London', 'big smoke': 'London', ldn: 'London', lndn: 'London',
  glesga: 'Glasgow', glesgae: 'Glasgow', weegie: 'Glasgow', embra: 'Edinburgh', edinbra: 'Edinburgh', 'auld reekie': 'Edinburgh', edi: 'Edinburgh',
  brizzle: 'Bristol', brissle: 'Bristol', boro: 'Middlesbrough', smoggie: 'Middlesbrough', sotton: 'Southampton', soton: 'Southampton',
  pompey: 'Portsmouth', donny: 'Doncaster', brad: 'Bradford', notts: 'Nottingham', nottz: 'Nottingham',
  'derry londonderry': 'Derry/Londonderry', 'stroke city': 'Derry/Londonderry', 'the bru': 'Bournemouth',
  'stoke': 'Stoke-on-Trent', 'stoke on trent': 'Stoke-on-Trent', 'hull': 'Kingston upon Hull', 'kingston upon hull': 'Kingston upon Hull',
  'newcastle under lyme': 'Newcastle-under-Lyme', 'st andrews': 'Saint Andrews', 'st albans': 'St Albans', 'st helens': 'St Helens', 'st ives': 'St Ives',
};

// nações e apelidos; county escrito por extenso também confirma (ver this.contee)
const NAZIONI = {
  ENG: ['england', 'eng', 'english', 'engerland', 'blighty'],
  SCT: ['scotland', 'scot', 'scotty', 'scottish', 'alba', 'scotia'],
  WLS: ['wales', 'cymru', 'welsh', 'wales uk'],
  NIR: ['northern ireland', 'n ireland', 'n i', 'ni', 'norn iron', 'nornirn', 'norniron', 'ulster', 'north of ireland', 'n irl'],
};
// abreviações e regiões históricas que o britânico usa no lugar do county oficial
const CONTEE_EXTRA = {
  yorkshire: ['West Yorkshire', 'South Yorkshire', 'North Yorkshire', 'East Riding of Yorkshire', 'York', 'Kingston upon Hull'],
  yorks: ['West Yorkshire', 'South Yorkshire', 'North Yorkshire', 'East Riding of Yorkshire', 'York', 'Kingston upon Hull'],
  lancs: ['Lancashire', 'Blackpool', 'Blackburn with Darwen'], lancashire: ['Lancashire', 'Blackpool', 'Blackburn with Darwen', 'Greater Manchester', 'Merseyside'],
  notts: ['Nottinghamshire', 'Nottingham'], herts: ['Hertfordshire'], bucks: ['Buckinghamshire', 'Milton Keynes'], beds: ['Bedford', 'Central Bedfordshire', 'Luton'],
  bedfordshire: ['Bedford', 'Central Bedfordshire', 'Luton'], berks: ['West Berkshire', 'Reading', 'Wokingham', 'Bracknell Forest', 'Windsor and Maidenhead', 'Slough'],
  berkshire: ['West Berkshire', 'Reading', 'Wokingham', 'Bracknell Forest', 'Windsor and Maidenhead', 'Slough'],
  hants: ['Hampshire', 'Southampton', 'Portsmouth'], hampshire: ['Hampshire', 'Southampton', 'Portsmouth'], wilts: ['Wiltshire', 'Swindon'],
  glos: ['Gloucestershire', 'South Gloucestershire'], oxon: ['Oxfordshire'], cambs: ['Cambridgeshire', 'Peterborough'], northants: ['North Northamptonshire', 'West Northamptonshire'],
  northamptonshire: ['North Northamptonshire', 'West Northamptonshire'], leics: ['Leicestershire', 'Leicester', 'Rutland'], lincs: ['Lincolnshire', 'North Lincolnshire', 'North East Lincolnshire'],
  staffs: ['Staffordshire', 'Stoke-on-Trent'], warks: ['Warwickshire'], worcs: ['Worcestershire'], derbys: ['Derbyshire', 'Derby'], shrops: ['Shropshire', 'Telford and Wrekin'],
  cheshire: ['Cheshire East', 'Cheshire West and Chester', 'Warrington', 'Halton'], cumbria: ['Cumberland', 'Westmorland and Furness'],
  somerset: ['Somerset', 'North Somerset', 'Bath and North East Somerset'], durham: ['County Durham', 'Darlington', 'Hartlepool', 'Stockton-on-Tees'],
  'county durham': ['County Durham', 'Darlington', 'Hartlepool', 'Stockton-on-Tees'], teesside: ['Middlesbrough', 'Stockton-on-Tees', 'Redcar and Cleveland', 'Hartlepool'],
  tyneside: ['Tyne and Wear'], manchester: ['Greater Manchester'], london: ['Greater London'], kent: ['Kent', 'Medway'], essex: ['Essex', 'Southend-on-Sea', 'Thurrock'],
  sussex: ['East Sussex', 'West Sussex', 'Brighton and Hove'], surrey: ['Surrey'], devon: ['Devon', 'Plymouth', 'Torbay'], dorset: ['Dorset', 'Bournemouth, Christchurch and Poole'],
  'west country': ['Devon', 'Cornwall', 'Somerset', 'Dorset', 'Bristol', 'Plymouth', 'Torbay', 'Gloucestershire', 'Wiltshire'],
  'black country': ['West Midlands'], midlands: ['West Midlands', 'Staffordshire', 'Warwickshire', 'Worcestershire', 'Nottinghamshire', 'Derbyshire', 'Leicestershire'],
  'east anglia': ['Norfolk', 'Suffolk', 'Cambridgeshire'], 'the wirral': ['Merseyside'], wirral: ['Merseyside'],
  highlands: ['Highland'], 'western isles': ['Na h-Eileanan Siar'], hebrides: ['Na h-Eileanan Siar', 'Highland', 'Argyll and Bute'], fife: ['Fife'], ayrshire: ['North Ayrshire', 'South Ayrshire', 'East Ayrshire'],
  lanarkshire: ['North Lanarkshire', 'South Lanarkshire'], 'the borders': ['Scottish Borders'], borders: ['Scottish Borders'], lothian: ['Edinburgh', 'West Lothian', 'East Lothian', 'Midlothian'],
  'south wales': ['Cardiff', 'Swansea', 'Newport', 'Vale of Glamorgan', 'Rhondda Cynon Taf', 'Bridgend', 'Neath Port Talbot', 'Caerphilly', 'Merthyr Tydfil', 'Blaenau Gwent', 'Torfaen', 'Monmouthshire'],
  'the valleys': ['Rhondda Cynon Taf', 'Merthyr Tydfil', 'Caerphilly', 'Blaenau Gwent', 'Torfaen', 'Neath Port Talbot', 'Bridgend'],
  'north wales': ['Gwynedd', 'Isle of Anglesey', 'Conwy', 'Denbighshire', 'Flintshire', 'Wrexham'], anglesey: ['Isle of Anglesey'], 'ynys mon': ['Isle of Anglesey'],
  // os 6 counties tradicionais de Northern Ireland -> distritos atuais (aproximação, só para confirmar)
  antrim: ['Antrim and Newtownabbey', 'Mid and East Antrim', 'Causeway Coast and Glens', 'Belfast', 'Lisburn and Castlereagh'],
  armagh: ['Armagh City, Banbridge and Craigavon', 'Newry, Mourne and Down'], 'county down': ['Ards and North Down', 'Newry, Mourne and Down', 'Lisburn and Castlereagh', 'Armagh City, Banbridge and Craigavon', 'Belfast'],
  'co down': ['Ards and North Down', 'Newry, Mourne and Down', 'Lisburn and Castlereagh', 'Armagh City, Banbridge and Craigavon', 'Belfast'],
  fermanagh: ['Fermanagh and Omagh'], tyrone: ['Mid Ulster', 'Fermanagh and Omagh', 'Derry City and Strabane'],
  londonderry: ['Derry City and Strabane', 'Causeway Coast and Glens', 'Mid Ulster'], 'county derry': ['Derry City and Strabane', 'Causeway Coast and Glens', 'Mid Ulster'],
};
// fora do Reino Unido: o robô recusa ("Birmingham, Alabama", "Cork", "Isle of Man", "New Jersey")
const ESTERI = ['ireland', 'republic of ireland', 'roi', 'eire', 'dublin', 'cork', 'galway', 'limerick', 'kilkenny', 'waterford', 'donegal', 'kerry', 'wexford', 'sligo',
  'isle of man', 'iom', 'jersey', 'guernsey', 'st helier', 'st peter port', 'alderney', 'sark', 'gibraltar',
  'usa', 'america', 'united states', 'alabama', 'texas', 'california', 'florida', 'new york', 'ohio', 'michigan', 'georgia', 'virginia', 'carolina',
  'massachusetts', 'pennsylvania', 'illinois', 'canada', 'ontario', 'australia', 'nsw', 'new zealand', 'nz', 'india', 'nigeria', 'south africa', 'spain', 'france', 'italy', 'germany', 'poland'];

const distancia = (a, b, max) => {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let ant = Array.from({ length: b.length + 1 }, (_, i) => i), ant2 = null;
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let melhor = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(ant[j] + 1, cur[j - 1] + 1, ant[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (ant2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) cur[j] = Math.min(cur[j], ant2[j - 2] + 1);
      melhor = Math.min(melhor, cur[j]);
    }
    if (melhor > max) return max + 1;
    ant2 = ant; ant = cur;
  }
  return ant[b.length];
};
const lerDado = n => { try { return JSON.parse(fs.readFileSync(path.join(RAIZ, 'strumenti', 'dati', n), 'utf8')); } catch { return {}; } };

export class Risolutore {
  constructor() {
    const { dados, contee } = JSON.parse(fs.readFileSync(path.join(RAIZ, 'sito', 'data', 'comuni.json'), 'utf8'));
    // sigla = nome do county; pop 0 = desconhecida (GeoNames só tem população das cidades maiores): rango desempata
    this.comuni = new Map(dados.map(([istat, nome, ci, reg, , , pop, rango]) => [istat, { istat, nome, sigla: contee[ci] ?? '', reg, pop, rango }]));
    this.porNome = new Map();
    for (const c of this.comuni.values()) if (!this.porNome.has(c.nome) || c.rango > this.porNome.get(c.nome).rango) this.porNome.set(c.nome, c);
    this.idx = new Map();
    this.fuzzy = new Map();
    const add = (k, istat, paraFuzzy = false) => {
      if (!k) return;
      for (const chave of k.includes(' ') ? [k, k.replace(/ /g, '')] : [k]) {   // também escrito junto: "stokeontrent"
        if (!this.idx.has(chave)) this.idx.set(chave, new Set());
        this.idx.get(chave).add(istat);
      }
      if (paraFuzzy && k.length >= 5) { const p = k[0]; if (!this.fuzzy.has(p)) this.fuzzy.set(p, new Set()); this.fuzzy.get(p).add(k); }
    };
    const addNome = (nome, istat, paraFuzzy) => {
      for (const parte of nome.split('/')) {
        const toks = norm(parte).split(' ');
        add(toks.join(' '), istat, paraFuzzy);
        add(toks.filter(t => !STOP.has(t)).join(' '), istat, paraFuzzy);
        if (toks[0] === 'saint') add(['st', ...toks.slice(1)].join(' '), istat);
        if (toks[0] === 'st') add(['saint', ...toks.slice(1)].join(' '), istat);
      }
    };
    for (const c of this.comuni.values()) addNome(c.nome, c.istat, true);
    // nomes em galês, Gaelic e Irish ("Caerdydd", "Glaschu", "Béal Feirste")
    for (const [istat, nomes] of Object.entries(lerDado('nomi-alternativi.json'))) if (this.comuni.has(istat)) for (const n of nomes) addNome(n, istat, false);
    // bairros de Londres: só quando nenhuma outra cidade tem o nome, ou com "London" escrito junto
    this.quartieri = new Map(Object.entries(lerDado('quartieri.json')).map(([k, v]) => [norm(k), v]));
    this.postcode = lerDado('postcode.json');
    this.alias = new Map();
    for (const [k, nome] of Object.entries(ALIAS)) this.alias.set(k, nome ? this.porNome.get(nome)?.istat ?? null : null);
    this.nazioni = new Map();
    for (const [cod, nomes] of Object.entries(NAZIONI)) for (const n of nomes) this.nazioni.set(n, cod);
    // counties por extenso (oficiais e históricos) -> conjunto de nomes de county
    this.contee = new Map();
    for (const n of new Set(contee)) this.contee.set(norm(n), new Set([n]));
    for (const [k, lista] of Object.entries(CONTEE_EXTRA)) this.contee.set(k, new Set([...(this.contee.get(k) ?? []), ...lista]));
    this.esteri = new Set(ESTERI);
    this.cache = new Map();
  }

  risolvere(testo) {
    const k = testo ?? '';
    if (this.cache.has(k)) return this.cache.get(k);
    const r = this._risolvere(k);
    if (this.cache.size < 200000) this.cache.set(k, r);
    return r;
  }

  _risolvere(testo) {
    const limpo = testo.replace(/https?:\/\/\S+/g, ' ').replace(/@[\w.]+/g, ' ').replace(/#[\w]+/g, ' ');
    // postcode: completo ("LS6 2AB") em qualquer caixa, ou só o district em maiúsculas ("LS6", "BT9")
    const postcodes = new Set();
    for (const m of limpo.matchAll(/\b([A-Za-z]{1,2}\d[A-Za-z\d]?)\s*\d[A-Za-z]{2}\b/g)) postcodes.add(m[1].toUpperCase());
    for (const m of limpo.matchAll(/(?:^|[\s,(\-])([A-Z]{1,2}\d[A-Z\d]?)(?=$|[\s,)\.!\-])/g)) postcodes.add(m[1]);
    const pcIds = [...postcodes].map(p => this.postcode[p]).filter(Boolean);
    const toks = norm(limpo).split(' ').filter(Boolean);
    if (!toks.length) return { istat: null, motivo: 'vuoto' };
    const originais = limpo.split(/[^\p{L}\p{N}']+/u).filter(Boolean);
    const maiuscula = t => originais.some(o => norm(o) === t && /^\p{Lu}/u.test(o));
    const significativos = toks.filter(t => !STOP.has(t) && !COMUNS.has(t)).length;

    // citazioni: counties escritos, com a posição (um county só confirma a cidade escrita em OUTRO lugar do comentário)
    const regs = new Set(), citazioni = [], achados = [], usadoRegiao = new Set();
    let estero = false;
    for (let n = Math.min(6, toks.length); n >= 1; n--) {
      for (let i = 0; i + n <= toks.length; i++) {
        const g = toks.slice(i, i + n), k1 = g.join(' '), k2 = g.filter(t => !STOP.has(t)).join(' ');
        if (!k2) continue;
        const reg = this.nazioni.get(k1) ?? this.nazioni.get(k2);
        if (reg && !(k1 === 'ireland' && toks[i - 1] === 'northern')) { regs.add(reg); for (let j = i; j < i + n; j++) usadoRegiao.add(j); }
        const ct = this.contee.get(k1) ?? this.contee.get(k2);
        if (ct) {
          citazioni.push({ nomi: ct, ini: i, fim: i + n });
          // Cardiff, Newport, Reading, Bristol...: o county tem o nome de uma cidade dele -> a palavra é a cidade
          // (Nottingham, Derby, Leicester: unitary authority com o nome da cidade, que nos dados está no shire)
          const mesmas = this.idx.get(k1) ?? this.idx.get(k2);
          const ehCidade = id => { const c = this.comuni.get(id); return ct.has(c.sigla) || (c.rango >= 2 && [...ct].some(nm => norm(nm) === norm(c.nome))); };
          if (!mesmas || ![...mesmas].some(ehCidade)) for (let j = i; j < i + n; j++) usadoRegiao.add(j);
        }
        // "ireland" sozinho (sem "northern" antes) e os outros países: fora do mapa
        if (this.esteri.has(k1) && !(k1 === 'ireland' && ['northern', 'n'].includes(toks[i - 1]))) estero = true;
        let ids = this.idx.get(k1) ?? this.idx.get(k2) ?? (n > 1 ? this.idx.get(g.join('')) : null), tipo = 'esatto';
        const al = this.alias.has(k1) ? this.alias.get(k1) : this.alias.has(k2) ? this.alias.get(k2) : undefined;
        if (al !== undefined) { ids = al ? new Set([al]) : null; tipo = 'alias'; }
        if (!ids && this.quartieri.has(k1)) { ids = new Set([this.quartieri.get(k1)]); tipo = 'quartiere'; }
        if (ids) achados.push({ ids: [...ids], ini: i, fim: i + n, peso: k2.split(' ').length, tipo });
      }
    }
    // fora do Reino Unido (sem nação britânica citada): recusa
    if (estero && !regs.size) return { istat: null, motivo: 'estero' };
    // para aproximar: só counties de verdade (não a palavra que é a própria cidade, como "reading")
    const conteeCit = new Set(citazioni.filter(z => usadoRegiao.has(z.ini)).flatMap(z => [...z.nomi]));
    const confirmaEm = a => c => regs.has(c.reg) || pcIds.includes(c.istat) || citazioni.some(z => (z.fim <= a.ini || z.ini >= a.fim) && z.nomi.has(c.sigla));
    const confirma = c => regs.has(c.reg) || pcIds.includes(c.istat) || conteeCit.has(c.sigla);
    // remove achados contidos em outros maiores; remove nomes que só são a nação/county
    let cand = achados.filter(a => !achados.some(b => b !== a && b.ini <= a.ini && b.fim >= a.fim && b.fim - b.ini > a.fim - a.ini));
    cand = cand.filter(a => !(a.fim - a.ini === 1 && usadoRegiao.has(a.ini) && !a.ids.some(id => confirmaEm(a)(this.comuni.get(id)))));
    // palavras comuns / vilas sozinhas exigem confirmação
    cand = cand.filter(a => {
      if (a.peso > 1 || a.tipo === 'alias') return true;
      const t = toks[a.ini], cs = a.ids.map(id => this.comuni.get(id));
      if (cs.some(confirmaEm(a))) return true;
      if (COMUNI_PAROLE.has(t) || COMUNS.has(t)) return maiuscula(t) && significativos <= 2;
      if (Math.max(...cs.map(c => c.rango)) < 2 && Math.max(...cs.map(c => c.pop)) < 3000) return maiuscula(t) || significativos <= 2;
      return true;
    });
    // bairro de Londres só vale se não sobrou outra cidade, ou se "London" foi escrito
    if (cand.some(a => a.tipo !== 'quartiere')) cand = cand.filter(a => a.tipo !== 'quartiere' || toks.includes('london'));

    if (!cand.length) {
      const f = this.aproximar(toks, regs, conteeCit, maiuscula, significativos, 1, usadoRegiao);
      if (f) return f;
      // só o postcode: vale o district
      if (pcIds.length === 1 || (pcIds.length && pcIds.every(id => id === pcIds[0]))) return { istat: pcIds[0], nome: this.comuni.get(pcIds[0]).nome, motivo: 'postcode' };
      return { istat: null, motivo: regs.size || conteeCit.size ? 'solo_regione' : 'nessuna_citta' };
    }

    // filtra por nação/county/postcode citados
    for (const a of cand) {
      const ok = a.ids.filter(id => confirmaEm(a)(this.comuni.get(id)));
      const outras = regs.size || pcIds.length || citazioni.some(z => z.fim <= a.ini || z.ini >= a.fim);
      a.consistente = outras ? ok.length > 0 : true;
      if (ok.length) a.ids = ok;
    }
    cand.sort((a, b) => (b.consistente - a.consistente) || (b.peso - a.peso) || (a.ini - b.ini));
    const top = cand[0];
    // a cidade exata não bate com a nação citada ("Livepool, England" achou outra coisa): tenta aproximar dentro dela
    if (!top.consistente) {
      const f = this.aproximar(toks, regs, conteeCit, maiuscula, significativos, 1, usadoRegiao);
      if (f) return f;
    }
    // sobrou palavra ao lado do nome achado ("Kirkby Lonsdle" achou só "Kirkby"): tenta um nome mais longo por aproximação
    const sobra = toks.filter((t, j) => !STOP.has(t) && !COMUNS.has(t) && !usadoRegiao.has(j) && !(j >= top.ini && j < top.fim) && !/\d/.test(t)).length;
    if (sobra > 0 && top.tipo !== 'alias') {
      const f = this.aproximar(toks, regs, conteeCit, maiuscula, significativos, top.peso + 1, usadoRegiao);
      if (f && !top.ids.includes(f.istat)) return f;
    }
    const distintos = new Set(cand.filter(a => a.consistente === top.consistente && a.peso === top.peso).flatMap(a => a.ids));
    let ids = top.ids;
    if (ids.length > 1) {
      // mesmo nome em vários lugares: vence a cidade claramente maior (população ou importância); senão, revisão manual
      const cs = ids.map(id => this.comuni.get(id)).sort((a, b) => b.pop - a.pop || b.rango - a.rango);
      if (cs[0].pop >= 4 * Math.max(cs[1].pop, 1) || (cs[0].rango >= 2 && cs[0].rango > cs[1].rango + 1)) ids = [cs[0].istat];
      else return { istat: null, motivo: 'omonimo', candidati: cs.slice(0, 8).map(c => `${c.nome} (${c.sigla})`) };
    }
    return { istat: ids[0], nome: this.comuni.get(ids[0]).nome, motivo: distintos.size > 1 ? 'piu_citta' : top.tipo };
  }

  // aproximação por erro de digitação: dos nomes mais longos (4 palavras) para os mais curtos
  aproximar(toks, regs, contee, maiuscula = () => true, significativos = 1, minPalavras = 1, regiao = new Set()) {
    const confirmado = regs.size || contee.size;
    for (let n = Math.min(4, toks.length); n >= 1; n--) {
      let melhor = null, md = Infinity, empate = false;
      for (let i = 0; i + n <= toks.length; i++) {
        const idxs = Array.from({ length: n }, (_, j) => i + j);
        if (idxs.every(j => regiao.has(j))) continue;
        const g = idxs.map(j => toks[j]).filter(t => !STOP.has(t));
        if (g.length < minPalavras || g.some(t => COMUNS.has(t) || /\d/.test(t))) continue;
        if (g.length === 1 && COMUNI_PAROLE.has(g[0]) && !maiuscula(g[0])) continue;   // "reading this" não é Reading
        // só com alguma confiança: nação/county citado, maiúscula ou comentário curto
        if (!confirmado && !maiuscula(g[0]) && significativos > 2) continue;
        const k = g.join(' ');
        if (k.length < 5) continue;
        const max = k.length >= 9 ? 2 : 1;
        for (const chave of this.fuzzy.get(k[0]) ?? []) {
          const d = distancia(k, chave, max);
          if (d > max) continue;
          let ids = [...this.idx.get(chave)];
          if (confirmado) ids = ids.filter(id => { const c = this.comuni.get(id); return regs.has(c.reg) || contee.has(c.sigla); });
          if (!ids.length) continue;
          if (d < md) { md = d; melhor = ids; empate = false; } else if (d === md && ids.some(id => !melhor.includes(id))) empate = true;
        }
      }
      if (empate) return null;
      if (melhor) {
        if (melhor.length > 1) {
          const cs = melhor.map(id => this.comuni.get(id)).sort((a, b) => b.pop - a.pop || b.rango - a.rango);
          if (!(cs[0].pop >= 4 * Math.max(cs[1].pop, 1) || (cs[0].rango >= 2 && cs[0].rango > cs[1].rango + 1))) return null;
          melhor = [cs[0].istat];
        }
        return { istat: melhor[0], nome: this.comuni.get(melhor[0]).nome, motivo: 'fuzzy' };
      }
    }
    return null;
  }
}

// "vote @fulano" / "voting for fulano" -> conta votada
export function estrairVoto(testo) {
  // "vote @fulano", "voting for @fulano" ou "vote for fulano" (sem @ só com "for": "I voted yesterday" não é voto)
  const m = (testo ?? '').match(/\b(?:vote|voting)\b\s*(?:for\s+)?@([a-z0-9._]{2,30})|\b(?:vote|voting)\s+for\s+([a-z0-9._]{2,30})/i);
  return m ? (m[1] ?? m[2]).toLowerCase().replace(/\.$/, '') : null;
}
export const estrairTags = testo => [...new Set([...(testo ?? '').matchAll(/@([a-zA-Z0-9._]{1,30})/g)].map(m => m[1].toLowerCase().replace(/\.$/, '')))];
