// Identidade de cada nação (e das regiões da England): símbolo, cumprimento, gíria, festa.
// Usado nos painéis, rótulos e imagens. Só símbolos neutros em Northern Ireland (nada de bandeiras).
export const NAZIONI = {
  ENG: { emoji: '🌹', simbolo: 'Tudor rose', saluto: 'Alright?', cheers: 'Cheers!', festa: "St George's Day · 23 April", cor: '#CE1124' },
  SCT: { emoji: '🦄', simbolo: 'unicorn & thistle', saluto: 'Awright?', cheers: 'Slàinte!', festa: "St Andrew's Day · 30 November", cor: '#005EB8' },
  WLS: { emoji: '🐉', simbolo: 'red dragon & daffodil', saluto: 'Shwmae!', cheers: 'Iechyd da!', festa: "St David's Day · 1 March", cor: '#00B140', nome_cy: 'Cymru' },
  NIR: { emoji: '⬢', simbolo: 'Causeway stones & flax flower', saluto: 'What about ye?', cheers: 'Cheers, big lad!', festa: "St Patrick's Day · 17 March", cor: '#3A7D7C' },
};

// a England é das regiões: cada canto tem o seu "olá"
const SALUTI_CONTEA = [
  [/Yorkshire|East Riding|Hull/, 'Ey up!'],
  [/Tyne and Wear|Northumberland|Durham|Newcastle/, 'Howay!'],
  [/Merseyside/, 'Alright la?'],
  [/Greater Manchester/, 'Alright, our kid?'],
  [/West Midlands/, 'Alright, bab?'],
  [/Greater London/, 'Wotcha!'],
  [/Cornwall|Isles of Scilly/, 'Proper job!'],
  [/Bristol|Somerset|Devon|Gloucestershire|Wiltshire|Dorset/, 'Alright, my lover?'],
  [/Lancashire|Blackpool|Blackburn/, 'Ey up, love!'],
  [/Highland|Na h-Eileanan Siar|Argyll/, 'Fàilte!'],
];

export function saluto(reg, contea = '') {
  for (const [re, s] of SALUTI_CONTEA) if (re.test(contea)) return s;
  return NAZIONI[reg]?.saluto ?? 'Alright?';
}

// nome com a placa bilíngue: "Swansea · Abertawe"
export const nomeBil = c => (c.bil ? `${c.nome} · ${c.bil}` : c.nome);
