// Comércios no mapa: tipos de negócio, planos por tamanho de cidade e links (usado pelo site e por negozio.html).
// Tipos da high street britânica (o chippy, o pub e a curry house no lugar da pizzeria e da gelateria).
export const TIPI = [
  ['chippy', '🐟', 'Chippy / takeaway'],
  ['pub', '🍺', 'Pub / bar'],
  ['cafe', '☕', 'Café / tea room'],
  ['ristorante', '🍛', 'Restaurant / curry house'],
  ['alimentari', '🥖', 'Bakery / corner shop'],
  ['abbigliamento', '👕', 'Clothes / shoes'],
  ['parrucchiere', '💈', 'Hairdresser / barber'],
  ['estetica', '💅', 'Beauty / nails'],
  ['palestra', '🏋️', 'Gym / sport'],
  ['fiori', '💐', 'Florist / gifts'],
  ['servizi', '🧰', 'Trades / services'],
  ['altro', '🏪', 'Other'],
];
export const tipoDi = k => TIPI.find(t => t[0] === k) ?? TIPI[TIPI.length - 1];

export const PRODOTTI = {
  negozio: { nome: 'Shop in town', emoji: '🏪', descr: 'A 3D shop with your name, your colour and your logo, on the high street. One tap and customers message you on WhatsApp.' },
  cartellone: { nome: 'Billboard', emoji: '📣', descr: 'A giant billboard with your name, your message and your logo, in town. One tap and customers message you on WhatsApp.' },
};

// plano pela população da cidade (config em data/negozio.json)
export function pianoDi(cfg, pop) {
  return cfg.piani.find(p => pop >= p.da) ?? cfg.piani[cfg.piani.length - 1];
}
export const sterlina = c => (c / 100).toLocaleString('en-GB', { style: 'currency', currency: 'GBP' });
export const euro = sterlina;   // nome antigo (negozio.html e decori.js ainda importam "euro")

// WhatsApp: só dígitos; celular britânico "07…" (11 dígitos) vira +44 sem o zero
export function linkWhatsapp(n, testo) {
  let d = String(n ?? '').replace(/\D/g, '');
  if (!/[1-9]/.test(d) || /^(\d)\1+$/.test(d)) return null;   // vazio ou falso (00000000000): sem botão
  if (d.startsWith('00')) d = d.slice(2);
  else if (d.startsWith('0')) d = `44${d.slice(1)}`;
  return `https://wa.me/${d}${testo ? `?text=${encodeURIComponent(testo)}` : ''}`;
}
