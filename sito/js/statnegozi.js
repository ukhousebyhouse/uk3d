// Contagem ANÔNIMA por loja/cartellone (para mostrar ao lojista o retorno real na renovação):
//  vista = a cidade da loja apareceu de perto na tela (1x por sessão), apri = abriu o cartão da loja,
//  wa / ig = tocou no botão de WhatsApp / Instagram. Vai em lote para api/visita.php {t:'n', ev:[[id, tipo], ...]}.
const fila = [], vistos = new Set();
let timer = null;

function manda() {
  timer = null;
  if (!fila.length) return;
  const ev = fila.splice(0, 60);
  try { navigator.sendBeacon?.('api/visita.php', JSON.stringify({ t: 'n', ev })); } catch { /* sem rede */ }
  if (fila.length) timer = setTimeout(manda, 500);
}

export function contaNegozio(id, tipo) {
  if (!id || /webdriver/.test(navigator.userAgent) || navigator.webdriver) return;
  if (tipo === 'vista' || tipo === 'apri') { const k = `${tipo}:${id}`; if (vistos.has(k)) return; vistos.add(k); }
  fila.push([id, tipo]);
  if (!timer) timer = setTimeout(manda, 3000);
}

// "vista": câmera perto (≤ 3 km) e a loja dentro do enquadramento aproximado
export function osservaNegozi(mappa, D) {
  mappa.aoMover.push(() => {
    if (mappa.dist > 3) return;
    const R = Math.max(0.6, mappa.dist * 1.2);
    for (const cm of D.commerci) if (Math.hypot(cm.luogo.x - mappa.alvo.x, cm.luogo.z - mappa.alvo.z) < R) contaNegozio(cm.id, 'vista');
  });
  addEventListener('pagehide', manda);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') manda(); });
}
