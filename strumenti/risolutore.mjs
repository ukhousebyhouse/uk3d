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
  'newcastle under lyme': 'Newcastle under Lyme', 'st andrews': 'Saint Andrews', 'st albans': 'St Albans', 'st helens': 'St Helens', 'st ives': 'St Ives',
  // revisão de 4/11/2026 (comentários pendentes): bairros de Londres, nomes curtos, erros comuns e lugares fora da base -> o vizinho mais próximo
  // (valor: nome, "Nome (County)" ou id GeoNames; se o county/nação citado não bater, vale o nome original)
  bromley: 'London', crayford: 'London', enfield: 'London', bexley: 'London', putney: 'London', hornchurch: 'London', hornchuch: 'London', londen: 'London',
  southend: 'Southend-on-Sea', benfleet: 'South Benfleet', wimborne: 'Wimborne Minster', wallacey: 'Wallasey', wigston: 'Wigston Magna', adwick: 'Adwick le Street',
  blandford: 'Blandford Forum', hayling: 'South Hayling', 'hayling island': 'South Hayling', dereham: 'East Dereham',
  blairgowrie: 'Blairgowrie and Rattray', mk: 'Milton Keynes', burmingham: 'Birmingham', lestershire: 'Leicester', gloustershire: 'Gloucester',
  // "~": lugar fora da base -> vizinho (incerto: se a conta escrever outro lugar exato, vale esse)
  bidbourgh: 'Bidborough', tedburn: 'Tedburn Saint Mary', cardrona: 'Cardrona Mains', ystrad: '~Rhondda', danesmoor: '~Clay Cross', heamoor: '~Penzance',
  teemore: '~Derrylin', knoydart: '~Inverie', benone: '~Castlerock', niwbwrch: '2641706', 'isle of mull': '7290043', mull: '7290043', 'isle of lewis': '~Stornoway',
  rousay: '~Kirkwall', shapinsay: '~Kirkwall', 'barton seagrave': '~Kettering', 'deeping st james': '~Market Deeping', 'deeping saint james': '~Market Deeping', methilhill: '~Methil',
  llanfairpwllgwyngyllgogerychwyrndrobwllllantysiliogogogoch: 'Llanfairpwllgwyngyll', llanfairpwllgwyllgychgogerochwyndrobwillantysilliogogogoch: 'Llanfairpwllgwyngyll', llanfairpwll: 'Llanfairpwllgwyngyll',
  crosby: 'Great Crosby', barrow: 'Barrow in Furness', 'barrow ribble valley': '12265949', 'minster on sea': '2642434', melton: 'Melton Mowbray',
  'hythe dibden': 'Hythe (Hampshire)',
};
// mesmo nome em vários lugares, sem um claramente maior: o mais provável (só quando county/nação citados não decidem)
const PREFERITI = {
  attleborough: 'Attleborough (Norfolk)', balloch: 'Balloch (West Dunbartonshire)', neston: 'Neston (Cheshire West and Chester)', ravensthorpe: 'Ravensthorpe (West Yorkshire)',
  reepham: 'Reepham (Norfolk)', lowton: 'Lowton (Greater Manchester)', rhynie: 'Rhynie (Aberdeenshire)', coleshill: 'Coleshill (Warwickshire)', hythe: 'Hythe (Kent)',
  comrie: 'Comrie (Perth and Kinross)', dromore: 'Dromore (Armagh City, Banbridge and Craigavon)', featherstone: 'Featherstone (West Yorkshire)', royston: 'Royston (Hertfordshire)',
  symington: 'Symington (South Ayrshire)', watton: 'Watton (Norfolk)', blackburn: 'Blackburn (West Lothian)', newport: 'Newport (Isle of Wight)', kirkheaton: 'Kirkheaton (West Yorkshire)',
  hadleigh: 'Hadleigh (Essex)',
};
// só o county escrito ("Essex, England", "Cornwall"): a casa vai para a cidade principal dele
// (se a mesma conta escrever a cidade em outro comentário, vale a cidade: ver aggiorna.mjs)
const CAPOLUOGHI = {
  essex: 'Chelmsford', wirral: 'Birkenhead', 'the wirral': 'Birkenhead', cornwall: 'Truro', 'isle of wight': 'Newport (Isle of Wight)', surrey: 'Guildford',
  fife: 'Glenrothes', somerset: 'Taunton', cheshire: 'Chester', hampshire: 'Winchester', hants: 'Winchester', dorset: 'Dorchester (Dorset)', cumbria: 'Carlisle', devon: 'Exeter',
  leicestershire: 'Leicester', leics: 'Leicester', hertfordshire: 'Hertford', herts: 'Hertford', norfolk: 'Norwich', warwickshire: 'Warwick', warks: 'Warwick',
  flintshire: 'Mold', shetland: 'Lerwick', 'shetland islands': 'Lerwick', anglesey: 'Llangefni', 'isle of anglesey': 'Llangefni', 'ynys mon': 'Llangefni',
  derbyshire: 'Derby', derbys: 'Derby', sussex: 'Lewes', 'east sussex': 'Lewes', 'west sussex': 'Chichester', orkney: 'Kirkwall', 'orkney islands': 'Kirkwall',
  pembrokeshire: 'Haverfordwest', 'county durham': 'Durham', carmarthenshire: 'Carmarthen', renfrewshire: 'Paisley', wiltshire: 'Trowbridge', wilts: 'Trowbridge',
  suffolk: 'Ipswich', ayrshire: 'Ayr', 'south ayrshire': 'Ayr', buckinghamshire: 'Aylesbury', bucks: 'Aylesbury', cambridgeshire: 'Cambridge', cambs: 'Cambridge',
  gwynedd: 'Caernarfon', worcestershire: 'Worcester', worcs: 'Worcester', herefordshire: 'Hereford', gloucestershire: 'Gloucester', glos: 'Gloucester',
  merseyside: 'Liverpool', medway: 'Gillingham (Medway)', kent: 'Maidstone', berkshire: 'Reading', berks: 'Reading', tyrone: 'Omagh', shropshire: 'Shrewsbury',
  shrops: 'Shrewsbury', lancashire: 'Preston', lancs: 'Preston', lincolnshire: 'Lincoln', lincs: 'Lincoln', staffordshire: 'Stafford', staffs: 'Stafford',
  nottinghamshire: 'Nottingham', northamptonshire: 'Northampton', northants: 'Northampton', oxfordshire: 'Oxford', oxon: 'Oxford', bedfordshire: 'Bedford',
  northumberland: 'Morpeth', 'west yorkshire': 'Leeds', 'south yorkshire': 'Sheffield', 'north yorkshire': 'York', 'east riding of yorkshire': 'Beverley',
  'greater manchester': 'Manchester', 'tyne and wear': 'Newcastle upon Tyne', 'west midlands': 'Birmingham', highland: 'Inverness', highlands: 'Inverness',
  aberdeenshire: 'Aberdeen', 'scottish borders': 'Galashiels', borders: 'Galashiels', 'dumfries and galloway': 'Dumfries', 'west lothian': 'Livingston',
  'east lothian': 'Haddington', midlothian: 'Dalkeith', 'north ayrshire': 'Irvine', 'east ayrshire': 'Kilmarnock', 'north lanarkshire': 'Motherwell',
  'south lanarkshire': 'Hamilton', lanarkshire: 'Hamilton', angus: 'Forfar', moray: 'Elgin', 'argyll and bute': 'Oban', 'perth and kinross': 'Perth',
  'na h eileanan siar': 'Stornoway', 'western isles': 'Stornoway', powys: 'Llandrindod Wells', ceredigion: 'Aberystwyth', conwy: 'Conwy', denbighshire: 'Ruthin',
  monmouthshire: 'Monmouth', fermanagh: 'Enniskillen', antrim: 'Antrim', armagh: 'Armagh', 'county down': 'Downpatrick', 'co down': 'Downpatrick',
  rutland: 'Oakham', 'isles of scilly': 'Hugh Town',
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
  staffs: ['Staffordshire', 'Stoke-on-Trent'], warks: ['Warwickshire'], worcs: ['Worcestershire'], derbys: ['Derbyshire', 'Derby'], shrops: ['Shropshire', 'Telford and Wrekin'], shropshire: ['Shropshire', 'Telford and Wrekin'],
  shetland: ['Shetland Islands'], orkney: ['Orkney Islands'],
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
  'south wales': ['Cardiff', 'Swansea', 'Newport', 'Carmarthenshire', 'Pembrokeshire', 'Vale of Glamorgan', 'Rhondda Cynon Taf', 'Bridgend', 'Neath Port Talbot', 'Caerphilly', 'Merthyr Tydfil', 'Blaenau Gwent', 'Torfaen', 'Monmouthshire'],
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
// outros países: não recusam ("Manchester, from Romania" vale), mas desligam a aproximação ("Jordan Amman" não é Jordans)
const PAESI = new Set(['jordan', 'syria', 'iraq', 'iran', 'kuwait', 'uae', 'dubai', 'abu dhabi', 'saudi', 'saudi arabia', 'qatar', 'oman', 'yemen', 'lebanon', 'israel', 'palestine',
  'egypt', 'algeria', 'morocco', 'tunisia', 'libya', 'kenya', 'ghana', 'ethiopia', 'somalia', 'turkey', 'turkiye', 'kurdistan', 'pakistan', 'bangladesh', 'nepal', 'sri lanka',
  'afghanistan', 'uzbekistan', 'kazakhstan', 'tajikistan', 'kyrgyzstan', 'russia', 'ukraine', 'belarus', 'romania', 'hungary', 'bulgaria', 'serbia', 'croatia', 'bosnia',
  'albania', 'kosovo', 'greece', 'cyprus', 'lithuania', 'latvia', 'estonia', 'finland', 'sweden', 'norway', 'norwey', 'denmark', 'netherlands', 'nederland', 'nederlands',
  'belgium', 'switzerland', 'austria', 'czech', 'czechia', 'slovakia', 'slovenia', 'portugal', 'brazil', 'brasil', 'mexico', 'argentina', 'colombia', 'chile', 'peru',
  'china', 'japan', 'korea', 'vietnam', 'thailand', 'malaysia', 'singapore', 'indonesia', 'philippines', 'phillipines', 'philipines',
  'moscow', 'jakarta', 'mumbai', 'delhi', 'kolkata', 'karachi', 'lahore', 'tehran', 'baghdad', 'amman', 'cairo', 'istanbul', 'riyadh', 'manila']);

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
        // "Chalfont Saint Peter" = "Chalfont St Peter" (em qualquer posição)
        if (toks.includes('saint')) add(toks.map(t => t === 'saint' ? 'st' : t).join(' '), istat);
        if (toks.includes('st')) add(toks.map(t => t === 'st' ? 'saint' : t).join(' '), istat);
      }
    };
    for (const c of this.comuni.values()) addNome(c.nome, c.istat, true);
    // nomes em galês, Gaelic e Irish ("Caerdydd", "Glaschu", "Béal Feirste")
    for (const [istat, nomes] of Object.entries(lerDado('nomi-alternativi.json'))) if (this.comuni.has(istat)) for (const n of nomes) addNome(n, istat, false);
    // bairros de Londres: só quando nenhuma outra cidade tem o nome, ou com "London" escrito junto
    this.quartieri = new Map(Object.entries(lerDado('quartieri.json')).map(([k, v]) => [norm(k), v]));
    this.postcode = lerDado('postcode.json');
    // "Nome", "Nome (County)" ou id GeoNames -> id (null se não existe na base)
    const achar = v => {
      if (!v) return null;
      v = v.replace(/^~/, '');
      if (/^\d+$/.test(v)) return this.comuni.has(v) ? v : null;
      const m = v.match(/^(.*) \((.*)\)$/);
      if (m) return [...this.comuni.values()].find(c => c.nome === m[1] && c.sigla === m[2])?.istat ?? null;
      return this.porNome.get(v)?.istat ?? null;
    };
    this.alias = new Map();
    for (const [k, nome] of Object.entries(ALIAS)) this.alias.set(k, achar(nome));
    this.vicini = new Set(Object.entries(ALIAS).filter(([, v]) => v?.startsWith('~')).map(([k]) => k));
    this.preferiti = new Map(Object.entries(PREFERITI).map(([k, v]) => [k, achar(v)]).filter(([, v]) => v));
    this.capoluoghi = new Map(Object.entries(CAPOLUOGHI).map(([k, v]) => [k, achar(v)]).filter(([, v]) => v));
    this.mancanti = [...Object.entries(ALIAS), ...Object.entries(PREFERITI), ...Object.entries(CAPOLUOGHI)].filter(([, v]) => v && !achar(v)).map(([k, v]) => `${k} -> ${v}`);
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
          citazioni.push({ nomi: ct, ini: i, fim: i + n, k: this.contee.has(k1) ? k1 : k2 });
          // Cardiff, Newport, Reading, Bristol...: o county tem o nome de uma cidade dele -> a palavra é a cidade
          // (Nottingham, Derby, Leicester: unitary authority com o nome da cidade, que nos dados está no shire)
          const mesmas = this.idx.get(k1) ?? this.idx.get(k2);
          const ehCidade = id => { const c = this.comuni.get(id); return ct.has(c.sigla) || (c.rango >= 2 && [...ct].some(nm => norm(nm) === norm(c.nome))); };
          if (!mesmas || ![...mesmas].some(ehCidade)) for (let j = i; j < i + n; j++) usadoRegiao.add(j);
        }
        // "ireland" sozinho (sem "northern" antes) e os outros países: fora do mapa
        if (this.esteri.has(k1) && !(k1 === 'ireland' && ['northern', 'n'].includes(toks[i - 1]))) estero = true;
        let ids = this.idx.get(k1) ?? this.idx.get(k2) ?? (n > 1 ? this.idx.get(g.join('')) : null), tipo = 'esatto';
        const orig = ids ? [...ids] : null;
        const al = this.alias.has(k1) ? this.alias.get(k1) : this.alias.has(k2) ? this.alias.get(k2) : undefined;
        if (al !== undefined) { ids = al ? new Set([al]) : null; tipo = this.vicini.has(this.alias.has(k1) ? k1 : k2) ? 'vicino' : 'alias'; }
        if (!ids && this.quartieri.has(k1)) { ids = new Set([this.quartieri.get(k1)]); tipo = 'quartiere'; }
        if (ids) achados.push({ ids: [...ids], ini: i, fim: i + n, peso: k2.split(' ').length, tipo, orig: tipo !== 'esatto' && tipo !== 'quartiere' ? orig : null });
      }
    }
    // fora do Reino Unido (sem nação britânica citada): recusa
    if (estero && !regs.size) return { istat: null, motivo: 'estero' };
    const paese = !regs.size && toks.some((t, i) => PAESI.has(t) || PAESI.has(`${t} ${toks[i + 1]}`));
    const aprox = (...a) => paese ? null : this.aproximar(...a);
    // para aproximar: só counties de verdade (não a palavra que é a própria cidade, como "reading")
    const conteeCit = new Set(citazioni.filter(z => usadoRegiao.has(z.ini)).flatMap(z => [...z.nomi]));
    const confirmaEm = a => c => regs.has(c.reg) || pcIds.includes(c.istat) || citazioni.some(z => (z.fim <= a.ini || z.ini >= a.fim) && z.nomi.has(c.sigla));
    const confirma = c => regs.has(c.reg) || pcIds.includes(c.istat) || conteeCit.has(c.sigla);
    // remove achados contidos em outros maiores; remove nomes que só são a nação/county
    let cand = achados.filter(a => !achados.some(b => b !== a && b.ini <= a.ini && b.fim >= a.fim && b.fim - b.ini > a.fim - a.ini));
    cand = cand.filter(a => !(a.fim - a.ini === 1 && usadoRegiao.has(a.ini) && !a.ids.some(id => confirmaEm(a)(this.comuni.get(id)))));
    // palavras comuns / vilas sozinhas exigem confirmação
    cand = cand.filter(a => {
      if (a.peso > 1 || a.tipo === 'alias' || a.tipo === 'vicino') return true;
      const t = toks[a.ini], cs = a.ids.map(id => this.comuni.get(id));
      if (cs.some(confirmaEm(a))) return true;
      if (COMUNI_PAROLE.has(t) || COMUNS.has(t)) return maiuscula(t) && significativos <= 2;
      if (Math.max(...cs.map(c => c.rango)) < 2 && Math.max(...cs.map(c => c.pop)) < 3000) return maiuscula(t) || significativos <= 2;
      return true;
    });
    // bairro de Londres só vale se não sobrou outra cidade, ou se "London" foi escrito
    if (cand.some(a => a.tipo !== 'quartiere')) cand = cand.filter(a => a.tipo !== 'quartiere' || toks.includes('london'));

    if (!cand.length) {
      const f = aprox(toks, regs, conteeCit, maiuscula, significativos, 1, usadoRegiao);
      if (f) return f;
      // só o postcode: vale o district
      if (pcIds.length === 1 || (pcIds.length && pcIds.every(id => id === pcIds[0]))) return { istat: pcIds[0], nome: this.comuni.get(pcIds[0]).nome, motivo: 'postcode' };
      // só um county escrito: a cidade principal dele
      // ("County Durham" também cita "durham": vale só o trecho maior)
      const cits = new Set(citazioni.filter(z => usadoRegiao.has(z.ini) && !citazioni.some(w => w !== z && w.ini <= z.ini && w.fim >= z.fim && w.fim - w.ini > z.fim - z.ini)).map(z => z.k));
      const cap = cits.size === 1 ? this.capoluoghi.get([...cits][0]) : null;
      if (cap) return { istat: cap, nome: this.comuni.get(cap).nome, motivo: 'contea' };
      return { istat: null, motivo: regs.size || conteeCit.size ? 'solo_regione' : 'nessuna_citta' };
    }

    // filtra por nação/county/postcode citados
    // county escrito vale mais que a nação: "Fawley, Hampshire, England" -> só a Fawley de Hampshire
    const porConto = a => c => pcIds.includes(c.istat) || citazioni.some(z => (z.fim <= a.ini || z.ini >= a.fim) && z.nomi.has(c.sigla));
    for (const a of cand) {
      const filtra = ids => { const fc = ids.filter(id => porConto(a)(this.comuni.get(id))); return fc.length ? fc : ids.filter(id => confirmaEm(a)(this.comuni.get(id))); };
      let ok = filtra(a.ids);
      // apelido que não bate com o county/nação citado ("Barrow, Suffolk"): volta para o nome original
      if (!ok.length && a.orig) { const ok2 = filtra(a.orig); if (ok2.length) { a.ids = ok2; a.tipo = 'esatto'; ok = ok2; } }
      const outras = regs.size || pcIds.length || citazioni.some(z => z.fim <= a.ini || z.ini >= a.fim);
      a.consistente = outras ? ok.length > 0 : true;
      if (ok.length) a.ids = ok;
    }
    cand.sort((a, b) => (b.consistente - a.consistente) || (b.peso - a.peso) || (a.ini - b.ini));
    const top = cand[0];
    // a cidade exata não bate com a nação citada ("Livepool, England" achou outra coisa): tenta aproximar dentro dela
    if (!top.consistente) {
      const f = aprox(toks, regs, conteeCit, maiuscula, significativos, 1, usadoRegiao);
      if (f) return f;
    }
    // sobrou palavra ao lado do nome achado ("Kirkby Lonsdle" achou só "Kirkby"): tenta um nome mais longo por aproximação
    const sobra = toks.filter((t, j) => !STOP.has(t) && !COMUNS.has(t) && !usadoRegiao.has(j) && !(j >= top.ini && j < top.fim) && !/\d/.test(t)).length;
    if (sobra > 0 && top.tipo !== 'alias' && top.tipo !== 'vicino') {
      const f = aprox(toks, regs, conteeCit, maiuscula, significativos, top.peso + 1, usadoRegiao);
      if (f && !top.ids.includes(f.istat)) return f;
    }
    const distintos = new Set(cand.filter(a => a.consistente === top.consistente && a.peso === top.peso).flatMap(a => a.ids));
    let ids = top.ids;
    if (ids.length > 1) {
      // mesmo nome em vários lugares: vence a cidade claramente maior (população ou importância); senão, revisão manual
      const cs = ids.map(id => this.comuni.get(id)).sort((a, b) => b.pop - a.pop || b.rango - a.rango);
      const pref = this.preferiti.get(norm(cs[0].nome));
      if (cs[0].pop >= 4 * Math.max(cs[1].pop, 1) || (cs[0].rango >= 2 && cs[0].rango > cs[1].rango + 1)) ids = [cs[0].istat];
      else if (pref && ids.includes(pref)) return { istat: pref, nome: this.comuni.get(pref).nome, motivo: 'preferito' };
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
