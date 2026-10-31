// Ícones SVG dos 15 níveis (traço escuro, tijolo vermelho, ardósia, sash windows brancas, chaminés).
const S = 'stroke="#152033" stroke-width="2.6" stroke-linejoin="round"';
const MURO = '#C2603F', TETTO = '#5C6878', PORTA = '#1F3A6B', ORO = '#F2C230', VETRO = '#9CC3D8', PIETRA = '#E2D8C4', BIANCO = '#F4F1EA', VERDE = '#3F7F3A';
const r = (x, y, w, h, f = MURO) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${f}" ${S}/>`;
const p = (pts, f = TETTO) => `<polygon points="${pts}" fill="${f}" ${S}/>`;
// sash window: moldura branca com vidro azul e a barra do meio
const fin = (x, y, w = 6, h = 7) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${VETRO}" stroke="${BIANCO}" stroke-width="1.6"/><line x1="${x}" y1="${y + h / 2}" x2="${x + w}" y2="${y + h / 2}" stroke="${BIANCO}" stroke-width="1.4"/>`;
const porta = (x, y, w = 6, f = PORTA) => `<rect x="${x}" y="${y}" width="${w}" height="${56 - y}" fill="${f}" stroke="#152033" stroke-width="1.8"/>`;
const camino = (x, y, h = 8) => `<rect x="${x}" y="${y}" width="5" height="${h}" fill="${MURO}" stroke="#152033" stroke-width="1.8"/><rect x="${x + 1}" y="${y - 3}" width="3" height="3" fill="#C8693A"/>`;
const albero = (x, f = '#5CB64E') => `<rect x="${x - 1.5}" y="42" width="3" height="14" fill="#6E4A2D" stroke="#152033" stroke-width="1.8"/><circle cx="${x}" cy="38" r="8" fill="${f}" ${S}/>`;
const siepe = (x, w) => `<rect x="${x}" y="49" width="${w}" height="7" rx="3" fill="${VERDE}" stroke="#152033" stroke-width="1.8"/>`;
const chao = '<line x1="2" y1="56" x2="62" y2="56" stroke="#152033" stroke-width="3" stroke-linecap="round"/>';

const ICONE = [
  // 0 Tiny Cottage
  () => camino(34, 26) + r(22, 38, 20, 18) + p('19,39 32,28 45,39') + porta(29, 46, 5) + fin(24, 42, 4, 5),
  // 1 Terraced House: três casas coladas
  () => camino(22, 18) + camino(38, 18) + r(6, 30, 52, 26) + p('3,31 12,22 52,22 61,31') + '<path d="M23 30 V56 M41 30 V56" stroke="#152033" stroke-width="2"/>' + porta(8, 44, 5) + porta(26, 44, 5, '#C8102E') + porta(44, 44, 5, '#22252B') + fin(15, 34, 5, 6) + fin(33, 34, 5, 6) + fin(51, 34, 5, 6),
  // 2 Terraced House with Garden
  () => camino(20, 18) + r(6, 28, 40, 22) + p('3,29 10,21 42,21 49,29') + '<path d="M26 28 V50" stroke="#152033" stroke-width="2"/>' + porta(10, 40, 5) + porta(30, 40, 5, '#C8102E') + fin(17, 32, 5, 6) + fin(37, 32, 5, 6) + siepe(4, 44) + albero(55),
  // 3 Semi-Detached com bay windows
  () => camino(29.5, 10) + r(8, 22, 48, 34) + p('4,23 32,9 60,23') + '<line x1="32" y1="22" x2="32" y2="56" stroke="#152033" stroke-width="2"/>' + r(12, 36, 12, 20, BIANCO) + fin(14, 39, 8, 8) + r(40, 36, 12, 20, BIANCO) + fin(42, 39, 8, 8) + fin(15, 26) + fin(43, 26) + porta(26, 44, 4) + porta(34, 44, 4, '#C8102E'),
  // 4 Semi with Garage
  () => camino(19, 10) + r(6, 24, 30, 32) + p('3,25 21,11 39,25') + r(9, 38, 11, 18, BIANCO) + fin(11, 41, 7, 8) + fin(25, 28) + porta(26, 45) + r(38, 38, 22, 18, '#C9CED6') + '<path d="M40 43 H58 M40 48 H58 M40 53 H58" stroke="#152033" stroke-width="1.6"/>',
  // 5 Detached House com porch
  () => camino(14, 12) + camino(45, 12) + r(10, 24, 44, 32) + p('6,25 32,11 58,25') + fin(15, 29) + fin(43, 29) + fin(15, 42) + fin(43, 42) + p('25,40 32,35 39,40', TETTO) + porta(29, 42) + siepe(2, 8) + siepe(54, 8),
  // 6 Detached with Conservatory
  () => camino(12, 12) + r(6, 24, 30, 32) + p('3,25 21,11 39,25') + fin(10, 29) + fin(26, 29) + porta(18, 44) + r(38, 38, 22, 18, '#D7EEF5') + '<path d="M44 38 V56 M50 38 V56 M56 38 V56" stroke="' + BIANCO + '" stroke-width="2"/>' + p('36,39 49,31 62,39', '#D7EEF5'),
  // 7 Georgian Townhouse: parapeito reto, pórtico e grade
  () => camino(14, 2, 6) + camino(45, 2, 6) + r(12, 8, 40, 48) + r(10, 6, 44, 4, BIANCO) + r(12, 42, 40, 14, BIANCO) + fin(16, 13) + fin(29, 13) + fin(42, 13) + fin(16, 27) + fin(29, 27) + fin(42, 27) + porta(29, 44, 6, '#22252B') + '<path d="M26 42 L32 37 L38 42" fill="' + BIANCO + '" ' + S + '/><path d="M4 50 H60 M8 50 V56 M14 50 V56 M50 50 V56 M56 50 V56" stroke="#152033" stroke-width="1.6"/>',
  // 8 Country House: duas alas com empena
  () => r(4, 26, 16, 30) + p('2,27 12,17 22,27') + r(44, 26, 16, 30) + p('42,27 52,17 62,27') + r(20, 30, 24, 26) + p('18,31 32,21 46,31') + camino(29, 15) + fin(9, 32) + fin(49, 32) + fin(9, 44) + fin(49, 44) + fin(24, 35) + fin(34, 35) + porta(29, 45),
  // 9 Manor House Tudor: meia-enxaimel preto e branco
  () => camino(10, 6, 10) + camino(48, 6, 10) + r(6, 18, 52, 38, BIANCO) + p('3,19 32,6 61,19') + '<path d="M6 34 H58 M14 18 V56 M24 18 V34 M40 18 V34 M50 18 V56 M14 34 L24 18 M50 34 L40 18" stroke="#3A2A1E" stroke-width="2.4"/>' + r(6, 44, 52, 12, MURO) + fin(27, 22, 10, 8) + fin(18, 38, 5, 5) + fin(41, 38, 5, 5) + porta(29, 45, 6, '#3A2A1E'),
  // 10 Clock Tower
  () => r(24, 14, 16, 42, PIETRA) + p('22,14 32,1 42,14', '#3E5A50') + '<circle cx="32" cy="22" r="5.5" fill="#FFFFFF" stroke="#152033" stroke-width="2"/><path d="M32 22 V18.5 M32 22 H35" stroke="#152033" stroke-width="1.6"/>' + fin(29.5, 33, 5, 7) + r(42, 40, 16, 16) + p('40,41 50,33 60,41') + porta(29, 46, 6, '#3A2A1E'),
  // 11 Skyscraper de vidro afunilado
  () => '<polygon points="20,56 22,14 32,2 42,14 44,56" fill="' + VETRO + '" ' + S + '/><path d="M21 22 H43 M21 30 H43 M20.6 38 H43.4 M20.3 46 H43.7" stroke="#FFFFFF" stroke-width="2.2"/><line x1="32" y1="2" x2="32" y2="56" stroke="#FFFFFF" stroke-width="1.4"/>',
  // 12 Country Estate: muro de pedra, portão e a casa
  () => r(16, 24, 32, 22, PIETRA) + p('13,25 32,13 51,25', TETTO) + camino(18, 14) + camino(41, 14) + fin(20, 29) + fin(38, 29) + porta(29, 36, 6) + '<path d="M2 56 V46 H24 V56 M40 56 V46 H62 V56" fill="' + PIETRA + '" ' + S + '/><circle cx="24" cy="44" r="2.5" fill="' + PIETRA + '" ' + S + '/><circle cx="40" cy="44" r="2.5" fill="' + PIETRA + '" ' + S + '/>',
  // 13 Palace: colunas, frontão e bandeira
  () => r(4, 26, 56, 30, '#EDE6D5') + '<rect x="2" y="23" width="60" height="4" fill="#D6CDB8" ' + S + '/>' + p('20,23 32,15 44,23', '#EDE6D5') + '<path d="M22 30 V56 M28 30 V56 M36 30 V56 M42 30 V56" stroke="#152033" stroke-width="2.4"/>' + fin(8, 32) + fin(50, 32) + fin(8, 44) + fin(50, 44) + '<line x1="32" y1="15" x2="32" y2="3" stroke="#152033" stroke-width="2"/><rect x="32" y="3" width="10" height="6" fill="#1F3A6B"/><path d="M32 6 H42 M37 3 V9" stroke="#C8102E" stroke-width="1.6"/>',
  // 14 Top of the Map: torre dourada com coroa
  () => r(22, 14, 20, 42, ORO) + '<path d="M18 14 L22 4 L27 11 L32 2 L37 11 L42 4 L46 14 Z" fill="' + ORO + '" ' + S + '/><circle cx="32" cy="9" r="2.5" fill="#C8102E"/>' + '<path d="M22 24 H42 M22 34 H42 M22 44 H42" stroke="#152033" stroke-width="1.8"/>',
];

export const iconaLivello = n => `<svg viewBox="0 0 64 64" aria-hidden="true">${(ICONE[n] ?? ICONE[0])()}${chao}</svg>`;
