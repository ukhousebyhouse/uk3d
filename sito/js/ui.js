// Interface: busca, abas, painéis (casa, cidade, nação, Number 10, league table, scoreboard, up for grabs, how it works).
import { REGOLE, NOMI_CARICHE, NOMI_CARICHE_CY, DESCR_CARICHE, FONTI, COME_GUADAGNARE, num, punti, dataBreve, dataLunga, ora, prossimoTraguardo, sogliaDi, nomePub } from './regole.js';
import { iconaLivello } from './icone.js';
import { Fotografo } from './foto.js';
import { immagineCasa, immagineFondazione, immagineCitta, PERFIL } from './storie.js';
import { tipoDi, linkWhatsapp } from './commerci.js';
import { NAZIONI, saluto, nomeBil } from './nazioni.js';

// contagem regressiva "05:42:09"
const relogio = ms => { const s = Math.max(0, Math.floor(ms / 1000)); return [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map(n => String(n).padStart(2, '0')).join(':'); };

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9._ ']/g, '').trim();
const ler = k => { try { return localStorage.getItem(k); } catch { return null; } };
const gravar = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sem storage */ } };
const IG = `https://www.instagram.com/${PERFIL}/`;
const UK_POP = 68_265_200;   // soma das estimativas ONS de meados de 2023 (as 4 nações)
// nome do cargo; na Wales vem também em galês ("Mayor · Maer")
const nomeCarica = (tipo, reg) => (reg === 'WLS' && NOMI_CARICHE_CY[tipo] ? `${NOMI_CARICHE[tipo]} · ${NOMI_CARICHE_CY[tipo]}` : NOMI_CARICHE[tipo]);
const nacao = r => `${NAZIONI[r.cod]?.emoji ?? ''} ${esc(r.nome)}`;

export class UI {
  constructor(D, mappa, citta, etichette, festa = null, decori = null) {
    this.D = D; this.mappa = mappa; this.citta = citta; this.et = etichette; this.festa = festa; this.decori = decori;
    this.painel = $('#pannello');
    this.conteudo = $('#pannello-contenuto');
    this.minha = ler('minha_casa');
    if (this.minha && !D.porConta.has(this.minha)) this.minha = null;
    this.et.destaque = this.minha;
    this.mandatoFim = Date.parse(D.snap.mandato.fine);
    this.fot = new Fotografo(mappa, citta);

    this.ligarBusca();
    this.ligarAbas();
    this.ligarPainel();
    this.ligarChips();
    this.ligarControles();
    this.rodape();
    if (D.snap.demo) $('#avviso-demo').hidden = false;
    setInterval(() => { const c = $('#conto'); if (c) c.textContent = this.contagem(); }, 1000);
    this.rota(location.hash.slice(1));
    addEventListener('hashchange', () => this.rota(location.hash.slice(1)));
  }

  // voa deixando o ponto fora da área coberta pelo painel
  focar(x, z, dist, az) {
    const k = innerWidth >= 900 ? [-0.32, 0] : [0, 0.13];   // [lateral, para a câmera]
    const dx = Math.cos(az) * k[0] * dist + Math.sin(az) * k[1] * dist;
    const dz = -Math.sin(az) * k[0] * dist + Math.cos(az) * k[1] * dist;
    this.mappa.voar({ x: x + dx, z: z + dz, dist, az });
  }

  // ---------- painel ----------
  abrir(html, aba = null) {
    this.conteudo.innerHTML = html;
    this.painel.hidden = false;
    this.painel.classList.remove('mini');
    this.painel.scrollTop = 0;
    this.conteudo.scrollTop = 0;
    const atual = this.conteudo.querySelector('.scala .attuale');
    if (atual) atual.parentElement.scrollLeft = atual.offsetLeft - atual.parentElement.clientWidth / 2 + atual.clientWidth / 2;
    document.querySelectorAll('#schede button').forEach(b => b.classList.toggle('attiva', b.dataset.aba === (aba ?? '')));
  }
  fechar() {
    this.decori?.chiudi();
    this.painel.hidden = true;
    this.citta.evidenzia(null);
    document.querySelectorAll('#schede button').forEach(b => b.classList.toggle('attiva', b.dataset.aba === 'mappa'));
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  }
  ligarPainel() {
    this.painel.querySelector('.chiudi').onclick = () => this.fechar();
    this.painel.querySelector('.maniglia').onclick = () => this.painel.classList.toggle('mini');
    // ações dentro dos painéis (delegadas)
    this.painel.addEventListener('click', e => {
      const t = e.target.closest('button, [data-casa], [data-luogo], [data-regione], [data-comune], [data-commercio]');
      if (!t) return;
      const d = t.dataset;
      if (d.casa) this.casa(this.D.porConta.get(d.casa));
      else if (d.luogo) this.luogo(this.D.luoghi[+d.luogo]);
      else if (d.regione) this.regione(this.D.regPorCod.get(d.regione));
      else if (d.comune) this.comuneVuoto(this.D.comunePorIstat.get(d.comune));
      else if (d.commercio) { const cm = this.D.commerci.find(x => x.id === d.commercio); if (cm) { const p = this.citta.posCommercio?.(cm); if (p) this.focar(p.x, p.z, 0.4, 0.6); this.commercio(cm); } }
      else if ('minha' in d) this.definirMinha(d.minha);
      else if (d.storia) this.storiaCasa(this.D.porConta.get(d.storia));
      else if (d.atto) this.attoFondazione(this.D.luoghi[+d.atto]);
      else if ('condividi' in d) this.condividir(d.condividi);
      else if ('copia' in d) this.copiarConvite(t);
      else if (d.dp) this.decori?.azione(t);
      else if (d.decora) this.decori?.apri(d.decora, d.modo);
      else if (d.ir) this.rota(d.ir);
    });
  }

  aviso(txt) {
    let t = $('#avviso');
    if (!t) { t = document.createElement('div'); t.id = 'avviso'; document.body.appendChild(t); }
    t.textContent = txt;
    t.classList.add('on');
    clearTimeout(this._av);
    this._av = setTimeout(() => t.classList.remove('on'), 2600);
  }

  // faixa grande da Bonfire Night (só no dia 5): aparece ao abrir o site, fecha no ✕ ou sozinha depois de 14 s
  faixaBonfire() {
    if (document.getElementById('faixa-festa')) return;
    const notte = !!this.festa?.notte, f = document.createElement('div');
    f.id = 'faixa-festa';
    f.innerHTML = `<button type="button" aria-label="Close">✕</button>
      <b>🎆 Happy Bonfire Night! 🔥</b>
      <i>“Remember, remember the 5th of November”</i>
      <span>${notte ? 'Fireworks are lighting up the skies across Great Britain right now. Zoom into your town 👀'
        : 'Tonight at dusk, fireworks light up the skies across Great Britain. Come back after dark 👀'}</span>`;
    const fecha = () => { f.classList.remove('on'); setTimeout(() => f.remove(), 400); };
    f.querySelector('button').onclick = fecha;
    document.body.appendChild(f);
    requestAnimationFrame(() => f.classList.add('on'));
    setTimeout(fecha, 14000);
  }

  rota(r) {
    const mapa = { palazzo: () => this.palazzo(), classifica: () => this.classifica(), tabellone: () => this.tabellone(), negozi: () => this.negozi(), senzapadrone: () => this.senzaPadrone(), fiamme: () => this.fiamme(), 'come-funziona': () => this.comeFunziona(), video: () => this.video(), decora: () => this.decori?.aperto && this.decori.home(), derby: () => this.derby(), meta: () => this.meta(), gran: () => this.granElezione(), sfida: () => this.sfida() };
    if (mapa[r]) mapa[r]();
  }

  // ---------- abas, chips, controles ----------
  ligarAbas() {
    document.querySelectorAll('#schede button').forEach(b => b.addEventListener('click', () => {
      const a = b.dataset.aba;
      if (a === 'mappa') this.fechar();
      else this.rota(a);
    }));
    // no celular as abas rolam de lado: o degradê na direita some quando chega ao fim
    const sc = $('#schede'), fim = () => sc.classList.toggle('fine', sc.scrollLeft + sc.clientWidth >= sc.scrollWidth - 4);
    sc.addEventListener('scroll', fim, { passive: true }); addEventListener('resize', fim); fim();
    $('#aiuto').onclick = () => this.comeFunziona();
    $('#fai-video').onclick = () => this.video();
  }
  // chips sob a busca: um de cada vez, em rodízio
  ligarChips() {
    const D = this.D, agora = Date.now(), caixa = $('#chips'), lista = [];
    this.emFiamme = D.casas.filter(c => c.fiamme > agora / 1000).sort((a, b) => b.tot - a.tot);
    const add = (id, html, fn) => {
      let b = document.getElementById(id);
      if (!b) { b = document.createElement('button'); b.id = id; b.type = 'button'; b.className = 'chip'; caixa.appendChild(b); }
      b.innerHTML = html; b.onclick = fn; b.hidden = true;
      lista.push(b);
    };
    // festas do dia (Bonfire Night, dia de cada nação, eleição...) vêm primeiro
    for (const [i, txt] of (this.festa?.avvisi ?? []).entries()) add(`chip-festa-${i}`, esc(txt), () => {
      const f = this.festa, pres = D.snap.cariche.presidente;
      if (txt.startsWith('🏛') && pres) return this.casa(D.porConta.get(pres.conta));
      if (f.nazioneOggi) return this.regione(D.regPorCod.get(f.nazioneOggi));
      this.mappa.verPais();
    });
    if (this.festa?.bonfireOggi) this.faixaBonfire();
    this.doppio = (D.snap.doppi ?? []).find(d => agora >= Date.parse(d.da) && agora < Date.parse(d.a)) ?? null;
    if (this.doppio) add('chip-doppi', `⚡ <b>Double points</b> ${this.doppio.tipi.includes('storia') ? 'on stories ' : ''}until ${ora(Date.parse(this.doppio.a))}`, () => this.comeFunziona());
    if (this.emFiamme.length) add('chip-fiamme', `🔥 <b>${num(this.emFiamme.length)}</b> ${this.emFiamme.length === 1 ? 'house on fire' : 'houses on fire'} now`, () => this.fiamme());
    const dz = D.snap.derby;
    if (dz) add('chip-derby', `⚔️ ${esc(D.comunePorIstat.get(dz.a).nome)} <b>${num(dz.pts_a)}</b> – <b>${num(dz.pts_b)}</b> ${esc(D.comunePorIstat.get(dz.b).nome)}`, () => this.derby());
    const g = D.snap.cariche.guerra?.[0];
    if (g?.pts) add('chip-nazioni', `${NAZIONI[g.cod]?.emoji ?? ''} <b>${esc(D.regPorCod.get(g.cod).nome)}</b> top the Battle of the Nations`, () => this.palazzo());
    // desafio relâmpago: contagem regressiva até o fim (o chip se atualiza sozinho a cada segundo)
    const sf = D.snap.sfida;
    if (sf) {
      add('chip-sfida', '', () => this.sfida());
      const b = document.getElementById('chip-sfida'), ini = Date.parse(sf.inizio), fim = Date.parse(sf.fine);
      const tic = () => {
        const t = Date.now();
        b.innerHTML = t >= fim ? `🏆 <b>${esc(sf.titolo)}</b>: ${sf.classifica[0] ? `@${esc(sf.classifica[0].conta)} won!` : 'results'}`
          : t < ini ? `⏳ <b>${esc(sf.titolo)}</b> starts at ${ora(ini)}`
            : `⏱️ <b>${relogio(fim - t)}</b> left · ${esc(sf.titolo)}`;
      };
      tic(); clearInterval(this._sfida); this._sfida = setInterval(tic, 1000);
    }
    const ge = D.snap.gran_elezione;
    if (ge) add('chip-gran', ge.conclusa ? '🏛️ <b>The first First Ministers</b> are in' : `🏛️ <b>Grand Election</b> · ${dataBreve(Date.parse(ge.data))}, ${ora(Date.parse(ge.data))}`, () => this.granElezione());
    const meta = this.metaCase();
    add('chip-meta', `🎯 <b>${num(D.casas.length)}</b> / ${num(meta)} houses`, () => this.meta());
    // celular: um chip por vez, em rodízio; tela larga: até 3 juntos (rodando os seguintes)
    let i = 0;
    const girar = () => {
      const juntos = innerWidth >= 900 ? Math.min(3, lista.length) : 1;
      lista.forEach((b, k) => { b.hidden = !Array.from({ length: juntos }, (_, j) => (i + j) % lista.length).includes(k); });
      i = (i + juntos) % lista.length;
    };
    girar();
    clearInterval(this._chips);
    if (lista.length > 1) this._chips = setInterval(girar, 4500);
  }
  metaCase() { const p = REGOLE.meta_passo; return Math.ceil((this.D.casas.length + 1) / p) * p; }
  ligarControles() {
    $('#zoom-piu').onclick = () => this.mappa.zoom(0.45);
    $('#zoom-meno').onclick = () => this.mappa.zoom(2.2);
    $('#vedi-paese').onclick = () => { this.mappa.verPais(); };
    const ir = $('#vai-casa');
    ir.hidden = !this.minha;
    ir.onclick = () => this.minha && this.casa(this.D.porConta.get(this.minha));
  }
  rodape() {
    const s = this.D.snap, t = Date.parse(s.dati_fino);
    $('#versione').textContent = `Updated: ${dataBreve(t)} ${new Date(t).getFullYear()}, ${ora(t)} (UK time) · ${s.versao}`;
  }

  // ---------- busca ----------
  ligarBusca() {
    const D = this.D, q = $('#q'), res = $('#risultati');
    this.idxContas = D.casas.map(c => [c.conta.toLowerCase(), c]).sort((a, b) => b[1].tot - a[1].tot);
    // nome inglês e nome galês/Gaelic ("Abertawe" também acha Swansea)
    this.idxComuni = D.comuni.flatMap(c => (c.bil ? [[norm(c.nome), c], [norm(c.bil), c]] : [[norm(c.nome), c]]))
      .sort((a, b) => (b[1].luogo?.case ?? -1) - (a[1].luogo?.case ?? -1) || b[1].rango - a[1].rango || b[1].pop - a[1].pop);
    this.idxReg = D.regioni.flatMap(r => [[norm(r.nome), r], ...(r.cod === 'NIR' ? [['ni', r]] : []), ...(NAZIONI[r.cod]?.nome_cy ? [[norm(NAZIONI[r.cod].nome_cy), r]] : [])]);
    const mostrar = () => {
      const bruto = q.value.trim(), t = bruto.replace(/^@/, '');
      if (t.length < 2) { res.hidden = true; return; }
      res.innerHTML = this.sugestoes(t, bruto.startsWith('@')) || '<div class="vuoto">Nothing found. Have you commented your town yet?</div>';
      res.hidden = false;
    };
    q.addEventListener('input', mostrar);
    q.addEventListener('focus', mostrar);
    document.addEventListener('pointerdown', e => { if (!e.target.closest('#cerca, #risultati')) res.hidden = true; });
    $('#cerca').addEventListener('submit', e => {
      e.preventDefault();
      const primeiro = res.querySelector('[data-r]');
      if (primeiro) primeiro.click(); else mostrar();
    });
    res.addEventListener('click', e => {
      const t = e.target.closest('[data-r]');
      if (!t) return;
      const [tipo, id] = t.dataset.r.split(':');
      res.hidden = true; q.blur();
      if (tipo === 'c') this.casa(D.porConta.get(id));
      else if (tipo === 'm') { const c = D.comunePorIstat.get(id); c.luogo ? this.luogo(c.luogo) : this.comuneVuoto(c); }
      else if (tipo === 'r') this.regione(D.regPorCod.get(id));
    });
  }
  sugestoes(t, contaPrimeiro) {
    const lc = t.toLowerCase(), n = norm(t), out = [];
    for (const [k, c] of this.idxContas) { if (k.startsWith(lc)) out.push(c); if (out.length >= 5) break; }
    const com = [];
    for (const [k, c] of this.idxComuni) { if (k.startsWith(n) && !com.includes(c)) com.push(c); if (com.length >= 5) break; }
    const reg = [...new Set(this.idxReg.filter(([k]) => k.startsWith(n)).map(([, r]) => r))].slice(0, 2);
    const D = this.D;
    const contas = out.map(c => `<button data-r="c:${esc(c.conta)}"><b>@${esc(c.conta)}</b><small>${esc(D.luoghi[c.luogo].nome)} · ${punti(c.tot)}</small></button>`);
    const lugares = [
      ...reg.map(r => `<button data-r="r:${r.cod}"><b>${nacao(r)}</b><small>${num(r.case)} houses</small></button>`),
      ...com.map(c => `<button data-r="m:${c.istat}"><b>📍 ${esc(nomeBil(c))}</b><small>${c.sigla ? `${esc(c.sigla)}, ` : ''}${esc(D.regPorCod.get(c.reg).nome)} · ${c.luogo ? `${num(c.luogo.case)} ${c.luogo.case === 1 ? 'house' : 'houses'}` : 'no houses yet'}</small></button>`),
    ];
    return (contaPrimeiro ? [...contas, ...lugares] : [...lugares, ...contas]).join('');
  }

  // ---------- helpers de conteúdo ----------
  cargoTexto(c) {
    if (!c?.carica) return '';
    const k = c.carica, reg = this.D.luoghi[c.luogo].comune.reg;
    if (k.tipo === 'presidente') return NOMI_CARICHE.presidente;
    if (k.regione) return `${nomeCarica(k.tipo, reg)} · ${this.D.regPorCod.get(k.regione).nome}`;
    return `${nomeCarica(k.tipo, reg)} of ${this.D.comunePorIstat.get(k.comune).nome}`;
  }
  linhaRank(c, i, extra = '') {
    const l = this.D.luoghi[c.luogo], fogo = c.fiamme > Date.now() / 1000;
    const TAG = { presidente: 'PM', senatore: 'LORD', presidente_regione: 'FIRST MIN.', deputato: 'MP', sindaco: 'MAYOR', consigliere: 'COUNCILLOR' };
    const tag = c.carica ? `<span class="tag-carica c-${c.carica.tipo}">${TAG[c.carica.tipo] ?? ''}</span> · ` : '';
    return `<li data-casa="${esc(c.conta)}"${c.conta === this.minha ? ' class="mia"' : ''}><span class="pos">${i + 1}</span><span class="ico-liv">${iconaLivello(c.livello)}</span><span class="quem"><b>${fogo ? '🔥 ' : ''}@${esc(c.conta)}</b><small>${tag}${esc(l.nome)}${extra}</small></span><span class="pts">${num(c.sett)}</span></li>`;
  }
  contagem() {
    let s = Math.max(0, Math.floor((this.mandatoFim - Date.now()) / 1000));
    const g = Math.floor(s / 86400); s %= 86400;
    const h = Math.floor(s / 3600); s %= 3600;
    const m = Math.floor(s / 60); s %= 60;
    return `${g}d ${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
  }
  fimMandato() { return `${dataLunga(this.mandatoFim)}, ${ora(this.mandatoFim)}`; }

  // ---------- casa ----------
  casa(c, voar = true) {
    if (!c) return;
    if (this.decori?.ed) this.decori.chiudi();   // tocou outra casa no meio da prévia: desfaz
    const D = this.D, l = D.luoghi[c.luogo], r = l.regione, niv = REGOLE.livelli;
    if (voar) { const p = this.citta.posCasa(c); this.focar(p.x, p.z, 0.6, 0.62); }
    this.et.destaque = c.conta;
    this.citta.evidenzia(c);
    const agora = Date.now() / 1000, fogo = c.fiamme > agora;
    const prox = niv[c.livello + 1];
    const pct = prox ? Math.round(100 * (c.tot - niv[c.livello].min) / (prox.min - niv[c.livello].min)) : 100;
    const fondatore = l.fondatore === c.conta;
    const tot = c.fonti.reduce((a, b) => a + b, 0);
    const barra = FONTI.map(([k, , cor], i) => c.fonti[i] ? `<i style="width:${(100 * c.fonti[i] / tot).toFixed(2)}%;background:${cor}" title="${k}"></i>` : '').join('');
    const legenda = FONTI.map(([, nome, cor], i) => c.fonti[i] ? `<div class="leg"><i style="background:${cor}"></i><span>${nome}</span><b>+${num(c.fonti[i])}</b></div>` : '').join('');
    const eMinha = this.minha === c.conta;
    this.abrir(`
      <div class="tag-luogo" data-luogo="${l.id}">📍 ${esc(nomeBil(l.comune))} · ${nacao(r)}</div>
      <h2 class="conta">@${esc(c.conta)}</h2>
      <div class="sub">${esc(saluto(r.cod, l.comune.sigla))} House no. ${num(c.lote + 1)} in ${esc(l.nome)} · since ${dataBreve(c.ts)}</div>
      <div class="badges">
        ${this.eletto(c.conta) ? `<span class="badge fond">🏛️ 1st ${esc(REGOLE.gran_elezione.titolo)} of ${esc(D.regPorCod.get(this.eletto(c.conta)).nome)}</span>` : ''}
        ${fondatore ? `<span class="badge fond">🔵 Blue plaque · founded ${esc(l.nome)}</span>` : ''}
        ${c.fonti[8] > 0 ? '<span class="badge mec">🏅 Patron · has a business on the map</span>' : ''}
        ${c.carica ? `<span class="badge car c-${c.carica.tipo}">🏛 ${esc(this.cargoTexto(c))}</span>` : ''}
        ${fogo ? `<span class="badge fuoco">🔥 on fire until ${ora(c.fiamme * 1000)}</span>` : ''}
        ${this.decori?.badge(c) ?? ''}
      </div>
      <div class="cresce">
        <div class="cresce-topo"><b>Your house · level ${c.livello + 1} of ${niv.length}</b><span>${esc(niv[c.livello].nome)}</span></div>
        <div class="scala">${niv.map((n, i) => `<div class="gradino ${i < c.livello ? 'passato' : i === c.livello ? 'attuale' : 'futuro'}">${iconaLivello(i)}<small>${esc(n.nome)}</small></div>`).join('')}</div>
        <div class="progresso"><i style="width:${pct}%"></i></div>
        <div class="prossimo">${prox ? `<b>${punti(prox.min - c.tot)}</b> to go until: ${esc(prox.nome)}` : "You're at the top of the map! 👑"}</div>
      </div>
      <h3>Where your points come from <small>(${num(tot)} in total)</small></h3>
      <div class="pila">${barra}</div>
      <div class="legenda">${legenda}</div>
      <div class="linha"><span>Points this term (${D.snap.mandato.n})</span><span><b>${num(c.sett)}</b> · no. ${num(c.pos)} in the UK</span></div>
      <div class="linha"><span>Role</span><span>${c.carica ? esc(this.cargoTexto(c)) : '—'}</span></div>
      <div class="linha"><span>Streak</span><span>${c.serie ? `🔥 <b>${num(c.serie)}</b> ${c.serie === 1 ? 'day' : 'days in a row'}` : 'comment today to start one'}</span></div>
      <button class="storia" data-storia="${esc(c.conta)}">📸 Put your house on your story<small>tag @${PERFIL}: +${REGOLE.punti.storia * (this.doppio?.tipi.includes('storia') ? 2 : 1)} points${this.doppio ? ' (doubled today!)' : ''} (once a day) and your house is on fire for 24 h</small></button>
      <h3>How to earn more points</h3>
      <div class="azioni">${COME_GUADAGNARE(REGOLE.punti).filter(([k]) => k !== 'casa').map(([k, nome, txt]) => `<div class="azione"><i style="background:${FONTI.find(f => f[0] === k)[2]}"></i><div><b>${nome}</b><small>${txt}</small></div></div>`).join('')}</div>
      <div class="bottoni">
        <button class="sec" data-luogo="${l.id}">see ${esc(l.nome)}</button>
        ${eMinha ? '<button class="sec" data-minha="">not my house</button>' : `<button data-minha="${esc(c.conta)}">this is my house 🏠</button>`}
      </div>
      ${this.decori?.bottone(c, eMinha) ?? ''}`);
  }
  definirMinha(conta) {
    this.minha = conta || null;
    gravar('minha_casa', conta || '');
    this.et.destaque = this.minha;
    $('#vai-casa').hidden = !this.minha;
    if (conta) { this.aviso('Sorted! The 🏠 button brings you back here.'); this.casa(this.D.porConta.get(conta), false); }
    else this.fechar();
  }

  // ---------- cidade ----------
  // desbloqueios da cidade: os conquistados, o próximo (com a barra) e os 2 seguintes
  sblocchi(l) {
    const T = REGOLE.traguardi, prox = prossimoTraguardo(l.case), ip = prox ? T.indexOf(prox) : T.length;
    const ant = ip > 0 ? T[ip - 1].case : 0;
    const pal = (Math.floor(l.case / REGOLE.marchi.palazzinaOgni) + 1) * REGOLE.marchi.palazzinaOgni;
    const falta = prox ? prox.case - l.case : pal - l.case;
    const pct = prox ? Math.round(100 * (l.case - ant) / (prox.case - ant)) : Math.round(100 * (l.case % 100) / 100);
    const item = (t, k) => `<div class="sblocco ${k < ip ? 'fatto' : k === ip ? 'attuale' : ''}"><span>${k < ip ? '✅' : '🔒'} ${t.emoji} ${esc(t.nome)}</span><b>${num(t.case)}</b></div>`;
    return `
      <h3>🔓 Unlock ${esc(l.nome)}</h3>
      <div class="carta meta"><b>${prox ? `${prox.emoji} ${esc(prox.nome)}` : '🏢 Another block of flats'}: ${num(falta)} ${falta === 1 ? 'house' : 'houses'} to go</b>
        <div class="progresso"><i style="width:${pct}%"></i></div>
        <small>Every new neighbour counts. Tag a mate from ${esc(l.nome)} on our latest post: when they join you get <b>+${REGOLE.punti.recluta} points</b>.</small></div>
      <div class="sblocchi">${T.slice(0, Math.min(T.length, ip + 3)).map(item).join('')}</div>`;
  }
  // nome do pub votado pelos moradores
  pubCitta(l) {
    const nome = nomePub(l.comune.istat, l.pub), aperto = l.case >= sogliaDi('chiesa'), v = l.pub ?? [];
    return `
      <h3>🍺 ${aperto ? `${esc(nome)}, the town pub` : 'Name the town pub'}</h3>
      ${v.length ? `<div class="sblocchi">${v.slice(0, 3).map(([i, n], k) => `<div class="sblocco ${k ? '' : 'attuale'}"><span>${k ? '' : '👑 '}${esc(REGOLE.pub_nomi[i])}</span><b>${num(n)} ${n === 1 ? 'vote' : 'votes'}</b></div>`).join('')}</div>` : ''}
      <p class="nota">${aperto ? '' : `The pub opens at ${num(sogliaDi('chiesa'))} houses. `}Live in ${esc(l.nome)}? Comment <b>pub ${esc(REGOLE.pub_nomi[0].replace(/^The /, ''))}</b> (or another name below) on our latest post: most votes wins, and you can change your vote.${v.length ? '' : ` No votes yet: for now it's ${esc(nome)}.`}</p>
      <p class="nota">${REGOLE.pub_nomi.map(esc).join(' · ')}</p>`;
  }
  luogo(l, voar = true) {
    if (!l) return;
    const D = this.D, k = D.snap.cariche, reg = l.regione.cod;
    if (voar) this.focar(l.x, l.z, Math.min(5, 0.9 + Math.sqrt(l.case) * 0.075), 0.55);
    const sindaco = k.sindaci[l.comune.istat], cons = k.consiglieri[l.comune.istat] ?? [];
    const casas = l.casas.map(i => D.casas[i]).sort((a, b) => b.sett - a.sett || a.ts - b.ts);
    this.abrir(`
      <h2>${esc(l.nome)}${l.comune.bil ? ` <small class="bil">${esc(l.comune.bil)}</small>` : ''}</h2>
      <div class="sub">${l.comune.sigla ? `${esc(l.comune.sigla)}, ` : ''}<span data-regione="${reg}" class="link">${nacao(l.regione)}</span> · ${num(l.case)} ${l.case === 1 ? 'house' : 'houses'}${l.comune.pop ? ` · pop. ${num(l.comune.pop)}` : ''}</div>
      <div class="carta plaque" data-casa="${esc(l.fondatore)}"><b>@${esc(l.fondatore)}</b><span>founded ${esc(l.nome)}</span><small>first house · ${dataBreve(l.fondatore_ts)} ${new Date(l.fondatore_ts).getFullYear()} · forever</small></div>
      <h3>Running ${esc(l.nome)}</h3>
      <div class="linha"><span>${nomeCarica('sindaco', reg)}</span><span>${sindaco ? `<a data-casa="${esc(sindaco.conta)}">@${esc(sindaco.conta)}</a> · elected on Sunday · ${num(sindaco.pts)} pts` : 'elected on Sunday at 9pm'}</span></div>
      <div class="linha"><span>🏁 Next election</span><span>${casas[0]?.sett ? `leading: <a data-casa="${esc(casas[0].conta)}">@${esc(casas[0].conta)}</a> · ${punti(casas[0].sett)}` : 'nobody has points this week yet'}</span></div>
      <div class="linha col"><span>${reg === 'WLS' ? 'Councillors · Cynghorwyr' : 'Councillors'} (${cons.length}/${REGOLE.posti.consiglieri})</span><span class="chips-mini">${cons.map(x => `<a data-casa="${esc(x.conta)}">@${esc(x.conta)}</a>`).join('') || '—'}</span></div>
      ${this.sblocchi(l)}
      ${this.pubCitta(l)}
      <h3>${esc(l.nome)} league table <small>(points this term)</small></h3>
      <ol class="ranking">${casas.slice(0, 10).map((c, i) => this.linhaRank(c, i)).join('')}</ol>
      <div class="bottoni"><button data-condividi="luogo:${l.id}">📸 Share ${esc(l.nome)}</button><button class="sec" data-atto="${l.id}">🔵 Blue plaque</button></div>
      ${this.attivitaCitta(l)}`);
  }
  // comércios da cidade + convite para anunciar
  attivitaCitta(l) {
    const lista = l.commerci ?? [];
    return `
      <h3>🏪 ${esc(l.nome)} high street</h3>
      ${lista.length ? `<ol class="ranking citta">${lista.map(cm => { const [, e, t] = tipoDi(cm.tipo); return `<li data-commercio="${esc(cm.id)}"><span class="pos">${e}</span><span class="quem"><b>${esc(cm.nome)}</b><small>${esc(t)}${cm.prodotto === 'cartellone' ? ' · billboard' : ''}</small></span></li>`; }).join('')}</ol>` : ''}
      <div class="carta meta"><b>${lista.length ? 'Fancy joining them?' : `No businesses in ${esc(l.nome)} yet: the first one stands out most!`}</b><small>A 3D shop with your name, logo and WhatsApp, right here in town. Seen by everyone looking for their house in ${esc(l.nome)}.</small>
      <div class="bottoni"><a class="botao" href="negozio.html?citta=${l.comune.istat}">🏪 Your shop in ${esc(l.nome)}</a><a class="botao sec" href="negozio.html?prodotto=cartellone&citta=${l.comune.istat}">📣 Billboard</a></div></div>`;
  }
  comuneVuoto(c) {
    if (!c) return;
    if (c.luogo) return this.luogo(c.luogo);
    this.mappa.voar({ x: c.x, z: c.z, dist: 14, az: 0.3 });
    const r = this.D.regPorCod.get(c.reg);
    this.abrir(`
      <h2>🪧 Empty plot in ${esc(nomeBil(c))}</h2>
      <div class="sub">${c.sigla ? `${esc(c.sigla)}, ` : ''}${nacao(r)}${c.pop ? ` · pop. ${num(c.pop)}` : ''} · no houses yet</div>
      <div class="carta meta"><b>Be the founder of ${esc(c.nome)}!</b><small>Comment <b>${esc(c.nome)}, ${esc(r.nome)}</b> on the latest post by @${PERFIL}: the first house in town is yours, with a blue plaque, forever.</small></div>
      <p class="nota">Know someone from ${esc(c.nome)}? Tag them in the comments: if they join, you get +${REGOLE.punti.recluta} points.</p>`);
  }

  // ---------- lote livre, outdoor e comércios ----------
  convite(l) {
    const url = `${location.origin}${location.pathname}?luogo=${encodeURIComponent(l.nome)}`;
    return `Come and live in ${l.nome}! 🏠 Comment "${l.nome}, ${l.regione.nome}" on the latest post by @${PERFIL} and get a house with your @ on the 3D map of the UK: ${url}`;
  }
  lotto(a) {
    const l = a.luogo;
    this.abrir(`
      <h2>🏡 Empty plot in ${esc(l.nome)}</h2>
      <div class="sub">${nacao(l.regione)} · ${num(l.case)} ${l.case === 1 ? 'house' : 'houses'} · ${a.stato === 'lavori' ? 'under construction' : 'for sale'}</div>
      <div class="carta meta"><b>${a.ordem === 0 ? `${esc(l.nome)}'s next neighbour will live here.` : 'This plot is waiting for your mate.'}</b><small>Tag a mate in the comments on the latest post by @${PERFIL}. If they comment "${esc(l.nome)}, ${esc(l.regione.nome)}", their house goes up here and you get <b>+${REGOLE.punti.recluta} points</b>.</small></div>
      <h3>Invite, ready to send</h3>
      <textarea class="convite" readonly rows="4">${esc(this.convite(l))}</textarea>
      <div class="bottoni"><button data-copia>📋 Copy the invite</button><button class="sec" data-luogo="${l.id}">see ${esc(l.nome)}</button></div>
      <p class="nota">Empty plots are just a drawing: they don't count as houses and have no owner until someone comments.</p>`);
  }
  copiarConvite(botao) {
    const ta = this.conteudo.querySelector('textarea.convite');
    if (!ta) return;
    const ok = () => { botao.textContent = '✅ Copied! Paste it in a comment or on WhatsApp'; };
    if (navigator.clipboard) navigator.clipboard.writeText(ta.value).then(ok, () => { ta.select(); });
    else { ta.select(); try { document.execCommand('copy'); ok(); } catch { /* seleção manual */ } }
  }
  pubblicita(l) {
    this.abrir(`
      <h2>📣 Ad space in ${esc(l.nome)}</h2>
      <div class="sub">${nacao(l.regione)} · ${num(l.case)} houses · billboard free</div>
      <div class="carta meta"><b>Your brand here, in 3D.</b><small>This billboard is seen by everyone looking for their house in and around ${esc(l.nome)}. Add your name, a message and your logo: one tap and customers message you on WhatsApp.</small></div>
      <div class="bottoni"><a class="botao" href="negozio.html?prodotto=cartellone&citta=${l.comune.istat}">Book the billboard</a><a class="botao sec" href="negozio.html?citta=${l.comune.istat}">🏪 A shop in town</a></div>
      <p class="nota">Every business is checked before it goes on the map.</p>`);
  }
  commercio(cm) {
    if (!cm) return;
    const l = cm.luogo, [, emoji, tipo] = tipoDi(cm.tipo);
    const wa = linkWhatsapp(cm.whatsapp, 'Hiya! Found you on UK House by House 🏠');
    const ig = cm.instagram ? `https://instagram.com/${encodeURIComponent(cm.instagram)}` : null;
    this.abrir(`
      <div class="tag-luogo" data-luogo="${l.id}">📍 ${esc(l.nome)} · ${nacao(l.regione)}</div>
      <h2>${emoji} ${esc(cm.nome)}</h2>
      <div class="sub">${esc(tipo)}${cm.prodotto === 'cartellone' ? ' · billboard' : ''}</div>
      ${cm.logo ? `<img class="logo-commercio" src="${esc(cm.logo)}" alt="">` : ''}
      ${cm.descrizione ? `<p class="intro">${esc(cm.descrizione)}</p>` : ''}
      <div class="bottoni">
        ${wa ? `<a class="botao" href="${esc(wa)}" target="_blank" rel="noopener">💬 Message on WhatsApp</a>` : ''}
        ${ig ? `<a class="botao sec" href="${esc(ig)}" target="_blank" rel="noopener">📸 @${esc(cm.instagram)}</a>` : ''}
      </div>
      ${cm.giocatore && this.D.porConta.get(cm.giocatore) ? `<div class="carta fond" data-casa="${esc(cm.giocatore)}">🏅 <b>Patron: @${esc(cm.giocatore)}</b><small>the house of whoever put this business on the map</small></div>` : ''}
      <p class="nota">A business on the ${esc(l.nome)} map. <a href="negozio.html?citta=${l.comune.istat}">Want yours too?</a></p>`);
  }

  // aba High Street: todos os comércios do mapa, com busca e "near me" (pela casa marcada como minha)
  negozi(filtro = 'tutti', busca = '') {
    const D = this.D, minha = this.minha && D.porConta.get(this.minha), base = minha && D.luoghi[minha.luogo];
    let lista = [...D.commerci];
    if (filtro === 'vicino' && base) lista.sort((a, b) => Math.hypot(a.luogo.x - base.x, a.luogo.z - base.z) - Math.hypot(b.luogo.x - base.x, b.luogo.z - base.z));
    const n = norm(busca);
    if (n) lista = lista.filter(cm => norm(`${cm.nome} ${cm.luogo.nome} ${tipoDi(cm.tipo)[2]}`).includes(n));
    // distância em milhas, como nas placas britânicas
    const riga = (cm, i) => {
      const [, e, t] = tipoDi(cm.tipo);
      const mi = filtro === 'vicino' && base ? ` · ${num(Math.round(Math.hypot(cm.luogo.x - base.x, cm.luogo.z - base.z) / 1.609))} miles` : '';
      return `<li data-commercio="${esc(cm.id)}"><span class="pos">${i + 1}</span><span class="quem"><b>${e} ${esc(cm.nome)}</b><small>${esc(t)} · ${esc(cm.luogo.nome)}${mi}</small></span><span class="visita">visit</span></li>`;
    };
    this.abrir(`
      <h2>🏪 The High Street</h2>
      <div class="sub">${num(D.commerci.length)} ${D.commerci.length === 1 ? 'business on the map' : 'businesses on the map'}</div>
      <div class="filtri"><button data-filtro="tutti" class="${filtro === 'tutti' ? 'on' : ''}">all</button><button data-filtro="vicino" class="${filtro === 'vicino' ? 'on' : ''}">near me</button></div>
      ${filtro === 'vicino' && !base ? '<p class="nota">To see shops near you, find your house and tap "this is my house".</p>' : ''}
      <input class="cerca-negozi" type="search" placeholder="search shop, town or type" value="${esc(busca)}">
      ${lista.length ? `<ol class="ranking negozi">${lista.map(riga).join('')}</ol>` : `<p class="nota">${D.commerci.length ? 'No shop with that name.' : 'No shops yet: the first one stands out most!'}</p>`}
      <a class="botao tratteggiato" href="negozio.html">＋ put your shop on the map</a>
      <p class="nota">Advertising. Shops on the map are symbolic: they don't show each business's real address.</p>`, 'negozi');
    this.conteudo.querySelectorAll('[data-filtro]').forEach(b => { b.onclick = () => this.negozi(b.dataset.filtro, this.conteudo.querySelector('.cerca-negozi').value); });
    const inp = this.conteudo.querySelector('.cerca-negozi');
    inp.oninput = () => {
      const v = inp.value, pos = inp.selectionStart;
      this.negozi(filtro, v);
      const novo = this.conteudo.querySelector('.cerca-negozi');
      novo.focus(); novo.setSelectionRange(pos, pos);
    };
  }

  // ---------- nação ----------
  regione(r) {
    if (!r) return;
    const D = this.D, k = r.carica ?? {}, guerra = D.snap.cariche.guerra, pos = guerra.findIndex(g => g.cod === r.cod) + 1, N = NAZIONI[r.cod] ?? {};
    const luoghi = D.luoghi.filter(l => l.regione === r).sort((a, b) => b.case - a.case);
    const ext = luoghi.length ? luoghi.reduce((m, l) => Math.max(m, Math.hypot(l.x - r.lx, l.z - r.lz)), 0) : 60;
    this.mappa.voar({ x: r.lx, z: r.lz, dist: Math.min(900, Math.max(140, ext * 3.2)), az: 0 });
    const ord = ['', '1st', '2nd', '3rd', '4th'];
    this.abrir(`
      <h2>${N.emoji ?? ''} ${esc(r.nome)}${N.nome_cy ? ` <small class="bil">${esc(N.nome_cy)}</small>` : ''}</h2>
      <div class="sub">${esc(N.saluto ?? '')} ${num(r.case)} houses in ${num(r.luoghi)} of ${num(r.comuni)} towns and villages · ${ord[pos] ?? pos} in the Battle of the Nations</div>
      <div class="carta nazione" style="--naz:${N.cor ?? '#1F3A6B'}"><b>${esc(N.simbolo ?? '')}</b><small>${esc(N.festa ?? '')} · ${esc(N.cheers ?? '')}</small></div>
      <h3>Who runs ${esc(r.nome)}</h3>
      <div class="linha"><span>${nomeCarica('presidente_regione', r.cod)}</span><span>${k.presidente ? `<a data-casa="${esc(k.presidente.conta)}">@${esc(k.presidente.conta)}</a> · ${num(k.presidente.pts)} pts` : '—'}</span></div>
      <div class="linha col"><span>Lords & Ladies (${(k.senatori ?? []).length}/${REGOLE.posti.senatoriPerRegione})</span><span class="chips-mini">${(k.senatori ?? []).map(x => `<a data-casa="${esc(x.conta)}">@${esc(x.conta)}</a>`).join('') || '—'}</span></div>
      <div class="linha col"><span>MPs (${(k.deputati ?? []).length})</span><span class="chips-mini">${(k.deputati ?? []).map(x => `<a data-casa="${esc(x.conta)}">@${esc(x.conta)}</a>`).join('') || '—'}</span></div>
      <h3>Towns with the most houses</h3>
      <ol class="ranking citta">${luoghi.slice(0, 10).map((l, i) => `<li data-luogo="${l.id}"><span class="pos">${i + 1}</span><span class="quem"><b>${esc(nomeBil(l.comune))}</b><small>founded by @${esc(l.fondatore)}</small></span><span class="pts">${num(l.case)}</span></li>`).join('')}</ol>`);
  }

  // ---------- Number 10 ----------
  palazzo() {
    const D = this.D, k = D.snap.cariche, p = k.presidente, pc = p && D.porConta.get(p.conta);
    const max = k.guerra[0]?.per_milione || 1;
    this.abrir(`
      <h2>🚪 Number 10</h2>
      <div class="sub">Term ${D.snap.mandato.n} · ends ${this.fimMandato()} (UK time)</div>
      <div class="conto"><span id="conto">${this.contagem()}</span><small>until the end of the term</small></div>
      <h3>${NOMI_CARICHE.presidente}</h3>
      ${pc ? `<div class="carta pres"><b class="grande">@${esc(pc.conta)}</b><small>${esc(D.luoghi[pc.luogo].nome)}, ${esc(D.luoghi[pc.luogo].regione.nome)} · elected on Sunday (term ${p.eletto_nel_mandato}) with ${num(p.pts_elezione)} points · ${num(pc.sett)} points this week</small><button data-casa="${esc(pc.conta)}">see house</button></div>` : '<div class="carta meta"><b>No Prime Minister yet</b><small>The first Prime Minister will be elected on Sunday at 9pm with this week\'s points.</small></div>'}
      <div class="elezione">🏁 Next election: ${k.leader ? `leading: <a data-casa="${esc(k.leader.conta)}">@${esc(k.leader.conta)}</a> with ${punti(k.leader.pts)}` : 'nobody has points yet'} · ends ${this.fimMandato()}</div>
      <h3>Battle of the Nations <small>(points per million people, this term)</small></h3>
      <div class="guerra">${k.guerra.map((g, i) => `<div class="riga" data-regione="${g.cod}" style="--naz:${NAZIONI[g.cod]?.cor ?? '#1F3A6B'}"><span>${i + 1}. ${nacao(D.regPorCod.get(g.cod))}</span><b>${num(g.per_milione ?? g.pts)}</b><i style="width:${(100 * (g.per_milione ?? g.pts) / max).toFixed(1)}%"></i></div>`).join('')}</div>
      <p class="nota">Per million people, so Wales and Northern Ireland can beat England. Fair's fair.</p>
      <h3>First Ministers</h3>
      <ol class="ranking">${D.regioni.map(r => r.carica?.presidente ? `<li data-casa="${esc(r.carica.presidente.conta)}"><span class="pos">${NAZIONI[r.cod]?.emoji ?? '🏛'}</span><span class="quem"><b>@${esc(r.carica.presidente.conta)}</b><small>${esc(r.nome)}</small></span><span class="pts">${num(r.carica.presidente.pts)}</span></li>` : '').join('')}</ol>
      <a class="botao segui" href="${IG}" target="_blank" rel="noopener">📲 Follow @${PERFIL} to see who wins on Sunday</a>
      <p class="nota">Non-partisan game: all roles are just for fun.</p>`, 'palazzo');
  }

  // league table com abas: cidade, nação ou Reino Unido inteiro
  classifica(ambito = 'italia', id = null) {
    const D = this.D, mia = this.minha && D.porConta.get(this.minha);
    const top = [...D.luoghi].sort((a, b) => b.case - a.case);
    let lista = D.ranking, titolo = 'United Kingdom', n = D.casas.length;
    if (ambito === 'citta') {
      const l = D.luoghi[id ?? (mia ? mia.luogo : top[0].id)];
      id = l.id; titolo = l.nome; n = l.case;
      lista = l.casas.map(i => D.casas[i]).sort((a, b) => b.sett - a.sett || a.ts - b.ts);
    } else if (ambito === 'regione') {
      const r = D.regPorCod.get(id ?? (mia ? D.luoghi[mia.luogo].regione.cod : D.regioni[0].cod));
      id = r.cod; titolo = r.nome; n = r.case;
      lista = D.ranking.filter(c => D.luoghi[c.luogo].regione === r);
    }
    const agora = Date.now() / 1000, fuoco = lista.filter(c => c.fiamme > agora).length;
    const scelta = ambito === 'citta'
      ? `<select class="scegli" data-ambito="citta">${(mia ? [D.luoghi[mia.luogo]] : []).concat(top.slice(0, 300)).filter((l, i, a) => a.indexOf(l) === i).map(l => `<option value="${l.id}"${l.id === id ? ' selected' : ''}>${esc(l.nome)} (${num(l.case)})</option>`).join('')}</select>`
      : ambito === 'regione' ? `<select class="scegli" data-ambito="regione">${D.regioni.map(r => `<option value="${r.cod}"${r.cod === id ? ' selected' : ''}>${esc(r.nome)}</option>`).join('')}</select>` : '';
    const posMia = mia ? lista.indexOf(mia) : -1;
    this.abrir(`
      <h2>🏆 League Table</h2>
      <div class="sub">Term ${D.snap.mandato.n} · ends ${this.fimMandato()} (UK time)</div>
      <div class="ambiti">${[['citta', 'Town', 'choose'], ['regione', 'Nation', 'choose'], ['italia', 'UK', 'the whole lot']].map(([k, t, s]) => `<button data-ambito-tab="${k}" class="${k === ambito ? 'on' : ''}"><b>${t}</b><small>${s}</small></button>`).join('')}</div>
      ${scelta}
      <div class="rk-testa"><b>${esc(titolo)}</b> <small>${num(n)} houses</small>${fuoco ? `<span class="rk-fuoco" data-ir="fiamme">🔥 ${num(fuoco)} on fire now</span>` : ''}</div>
      <div class="rk-col"><span>Pos · @ · role</span><span>Pts</span></div>
      <ol class="ranking">${lista.slice(0, 100).map((c, i) => this.linhaRank(c, i)).join('') || '<p class="nota">Nobody has points here yet.</p>'}</ol>
      <p class="nota">Points for term ${D.snap.mandato.n} (Sunday 9pm to Sunday 9pm, UK time). On a tie, the older house wins.</p>
      <div class="rk-piede">${mia ? (posMia >= 0 ? `<span data-casa="${esc(mia.conta)}">You: <b>no. ${num(posMia + 1)}</b> here · ${punti(mia.sett)}</span>` : `<span data-casa="${esc(mia.conta)}">Your house isn't in this table</span>`) : 'And you? <a data-ir="cerca">Find your house</a> and tap "this is my house" to see yourself here'}</div>`, 'classifica');
    this.conteudo.querySelectorAll('[data-ambito-tab]').forEach(b => { b.onclick = () => this.classifica(b.dataset.ambitoTab); });
    const sel = this.conteudo.querySelector('.scegli');
    if (sel) sel.onchange = () => this.classifica(sel.dataset.ambito, sel.dataset.ambito === 'citta' ? +sel.value : sel.value);
    const cerca = this.conteudo.querySelector('[data-ir="cerca"]');
    if (cerca) cerca.onclick = e => { e.stopPropagation(); this.fechar(); $('#q').focus(); };
  }

  tabellone() {
    const D = this.D, k = D.snap.contatori, top = [...D.luoghi].sort((a, b) => b.case - a.case).slice(0, 50);
    const regioniCasa = D.regioni.filter(r => r.case > 0).length, agora = Date.now() / 1000;
    const pct = v => `${(100 * v).toLocaleString('en-GB', { maximumFractionDigits: 1 })}%`;
    const conSindaco = Object.keys(D.snap.cariche.sindaci ?? {}).length;
    this.abrir(`
      <h2>📊 Scoreboard</h2>
      <div class="sub">The map right now · ${esc(D.snap.versao)}</div>
      <div class="segna"><b>${num(k.case)}</b><small>houses on the map</small></div>
      <div class="tessere">
        <div><b>${num(D.luoghi.length)}</b><small>towns</small></div>
        <div><b>${regioniCasa}/${D.regioni.length}</b><small>nations</small></div>
        <div><b>${pct(D.luoghi.length / D.comuni.length)}</b><small>of all towns & villages</small></div>
        <div><b>${num(D.snap.cariche.guerra.reduce((s, g) => s + g.pts, 0))}</b><small>points this term</small></div>
      </div>
      <div class="bottoni"><button data-condividi="tabellone">📤 Share the scoreboard</button></div>
      <div class="linha"><span>Comments read</span><span>${num(k.commenti)}</span></div>
      <div class="linha"><span>Accounts who commented</span><span>${num(k.contas)}</span></div>
      <div class="linha"><span>Founders (blue plaques)</span><span>${num(D.luoghi.length)}</span></div>
      <div class="linha"><span>Followers</span><span>${num(k.follower)}</span></div>
      <div class="linha"><span>Houses on fire now 🔥</span><span>${num(D.casas.filter(c => c.fiamme > agora).length)}</span></div>
      <div class="linha"><span>Towns with a mayor</span><span>${num(conSindaco)} of ${num(D.comuni.length)}</span></div>
      <h3>🏙 Towns with the most houses</h3>
      <ol class="ranking citta">${top.map((l, i) => `<li data-luogo="${l.id}"><span class="pos">${i + 1}</span><span class="quem"><b>${esc(nomeBil(l.comune))}</b><small>${nacao(l.regione)}</small></span><span class="pts">${num(l.case)}</span></li>`).join('')}</ol>
      <h3>📰 Latest from the map</h3>
      <div class="notizie">${this.notizie()}</div>
      <p class="nota">One house per account: commenting again doesn't add another.</p>`, 'tabellone');
  }

  notizie() {
    const D = this.D, nomeCom = ist => esc(D.comunePorIstat.get(ist)?.nome ?? '?'), quem = c => `<a data-casa="${esc(c)}">@${esc(c)}</a>`;
    const fa = ts => { const m = Math.round((Date.parse(D.snap.dati_fino) - Date.parse(ts)) / 60000); return m < 60 ? `${Math.max(1, m)} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; };
    const txt = e => ({
      citta_fondata: () => `🔵 ${quem(e.fondatore)} founded <b>${nomeCom(e.luogo)}</b>`,
      disputa: () => `⚔️ Photo finish in <b>${nomeCom(e.luogo)}</b>: ${quem(e.fondatore)} beat ${quem(e.secondo)} by ${e.differenza_s} seconds`,
      traguardo: () => { const t = REGOLE.traguardi.find(x => x.id === e.id); return t ? `🔓 <b>${nomeCom(e.luogo)}</b> unlocked: ${t.emoji} ${esc(t.nome)} (${num(t.case)} houses)` : ''; },
      sfida_vinta: () => `🏆 ${quem(e.conta)} won <b>${esc(e.titolo)}</b> with ${num(e.n)} new ${e.n === 1 ? 'mate' : 'mates'} on the map`,
      gran_eletto: () => `🏛️ ${quem(e.conta)} is the first ever ${esc(REGOLE.gran_elezione?.titolo ?? 'First Minister')} of <b>${esc(D.regPorCod.get(e.regione)?.nome ?? '')}</b>, with ${punti(e.pts)}`,
      livello: () => `🏗️ ${quem(e.conta)}'s house is now a <b>${esc(REGOLE.livelli[e.livello].nome)}</b>`,
      presidente_eletto: () => `🚪 ${quem(e.conta)} was elected ${NOMI_CARICHE.presidente} with ${punti(e.pts)}`,
    }[e.tipo]?.() ?? '');
    return (D.snap.eventi ?? []).slice(0, 20).map(e => `<div class="notizia"><span>${txt(e)}</span><small>${fa(e.ts)}</small></div>`).join('') || '<p class="nota">No news yet.</p>';
  }

  // grande eleição: em cada nação, quem tem mais pontos no jogo inteiro vira o 1º First Minister da história
  eletto(conta) {
    const ge = this.D.snap.gran_elezione;
    if (!ge?.conclusa) return null;
    return Object.entries(ge.nazioni).find(([, l]) => l[0]?.conta === conta)?.[0] ?? null;
  }
  // desafio relâmpago: regra, tempo que falta e o placar ao vivo
  sfida() {
    const D = this.D, sf = D.snap.sfida;
    if (!sf) return;
    const ini = Date.parse(sf.inizio), fim = Date.parse(sf.fine), t = Date.now(), aberta = t >= ini && t < fim;
    const lista = sf.classifica.length ? `<ol class="ranking">${sf.classifica.map((x, i) => `<li data-casa="${esc(x.conta)}"><span class="pos">${i ? i + 1 : (sf.conclusa ? '🏆' : '1')}</span><span class="quem"><b>@${esc(x.conta)}</b><small>${esc(D.luoghi[D.porConta.get(x.conta)?.luogo]?.nome ?? '')}</small></span><span class="pts">${num(x.n)} ${x.n === 1 ? 'mate' : 'mates'}</span></li>`).join('')}</ol>`
      : '<p class="nota">No new mates yet: the first one takes the lead!</p>';
    this.abrir(`
      <h2>🏆 ${esc(sf.titolo)}</h2>
      <div class="sub">${sf.conclusa || t >= fim ? 'Finished' : aberta ? `<b id="sfida-tempo">${relogio(fim - t)}</b> left` : `Starts ${dataBreve(ini)}, ${ora(ini)}`} · until ${ora(fim - 1000)} (UK time)</div>
      <div class="carta meta"><b>Bring the most new players to the map and win ${esc(sf.premio)}.</b><small>Tag your mates in the comments of our posts. Every mate you tagged who comments their town and gets a house during the challenge counts for you. You get +${REGOLE.punti.recluta} points per mate and, today only, they get a +${REGOLE.punti.invitato} welcome bonus too. It all counts for the First Minister election. On a tie, whoever got there first wins. <a href="terms.html#challenges" target="_blank" rel="noopener">Rules</a></small></div>
      ${lista}
      <p class="nota">The board updates every half hour or so, with the map.</p>`);
    clearInterval(this._sfidaPainel);
    if (aberta) this._sfidaPainel = setInterval(() => { const el = $('#sfida-tempo'); if (!el) return clearInterval(this._sfidaPainel); el.textContent = relogio(fim - Date.now()); }, 1000);
  }
  granElezione() {
    const D = this.D, ge = D.snap.gran_elezione;
    if (!ge) return;
    const t = Date.parse(ge.data), quando = `${dataLunga(t)}, ${ora(t)}`;
    const blocco = cod => {
      const r = D.regPorCod.get(cod), l = ge.nazioni[cod] ?? [];
      return `<h3>${nacao(r)}</h3>${l.length ? `<ol class="ranking">${l.map((x, i) => `<li data-casa="${esc(x.conta)}"><span class="pos">${i ? i + 1 : (ge.conclusa ? '🏛️' : '1')}</span><span class="quem"><b>@${esc(x.conta)}</b><small>${esc(D.luoghi[D.porConta.get(x.conta)?.luogo]?.nome ?? '')}</small></span><span class="pts">${num(x.pts)}</span></li>`).join('')}</ol>` : `<p class="nota">Nobody here yet: the first house in ${esc(r.nome)} starts in the lead!</p>`}`;
    };
    this.abrir(`
      <h2>🏛️ The Grand Election</h2>
      <div class="sub">${ge.conclusa ? `Held on ${quando} (UK time)` : `${quando} (UK time)`}</div>
      <div class="carta meta"><b>${ge.conclusa ? 'The first ever First Ministers of the four nations.' : 'Four nations, four winners: the first ever First Ministers.'}</b><small>In England, Scotland, Wales and Northern Ireland, whoever has the most points in the whole game ${ge.conclusa ? 'became' : 'on that night becomes'} the nation's first ever ${esc(REGOLE.gran_elezione.titolo)}. All your points count, from day one. Points from a business on the map don't. On a tie, the older house wins.</small></div>
      ${['ENG', 'SCT', 'WLS', 'NIR'].filter(c => D.regPorCod.has(c)).map(blocco).join('')}
      ${ge.conclusa ? '' : `<p class="nota">How to climb: comment on every post (+${REGOLE.punti.commento}), tag your mates (+${REGOLE.punti.tag} each) and get them to join (+${REGOLE.punti.recluta}).</p>`}`);
  }

  derby() {
    const D = this.D, dz = D.snap.derby;
    if (!dz) return;
    const [a, b] = [D.comunePorIstat.get(dz.a), D.comunePorIstat.get(dz.b)];
    const tot = dz.pts_a + dz.pts_b || 1, pa = Math.round(100 * dz.pts_a / tot);
    const top = c => (c.luogo?.casas ?? []).map(i => D.casas[i]).sort((x, y) => y.sett - x.sett).slice(0, 5);
    const lado = c => `<h3>Pushing for ${esc(c.nome)}</h3><ol class="ranking">${top(c).map((x, i) => this.linhaRank(x, i)).join('')}</ol>`;
    this.abrir(`
      <h2>⚔️ Derby of the Week</h2>
      <div class="sub">Term ${D.snap.mandato.n} · ends ${this.fimMandato()} (UK time)</div>
      <div class="derby">
        <div data-luogo="${a.luogo?.id}"><b>${esc(a.nome)}</b><span>${num(dz.pts_a)}</span></div>
        <em>VS</em>
        <div data-luogo="${b.luogo?.id}"><b>${esc(b.nome)}</b><span>${num(dz.pts_b)}</span></div>
      </div>
      <div class="barra-derby"><i style="width:${pa}%"></i></div>
      <div class="carta meta"><b>${esc(a.nome)} or ${esc(b.nome)}?</b><small>Comment on the latest post by @${PERFIL}: every point you score this week goes to your town.</small></div>
      ${lado(a)}${lado(b)}`);
  }

  meta() {
    const D = this.D, alvo = this.metaCase(), n = D.casas.length, pct = Math.round(100 * n / alvo);
    const com = D.luoghi.length;
    this.abrir(`
      <h2>🎯 Next milestone</h2>
      <div class="sub">All together: every comment with your town and country is one more house</div>
      <div class="conto"><span>${num(n)} / ${num(alvo)}</span><small>houses on the map</small></div>
      <div class="progresso grande"><i style="width:${pct}%"></i></div>
      <p class="intro"><b>${num(alvo - n)}</b> houses to go. Tag a mate who hasn't got a house yet: when they join you get <b>+${REGOLE.punti.recluta} points</b>.</p>
      <div class="linha"><span>Towns with at least one house</span><span><b>${num(com)}</b> of ${num(D.comuni.length)}</span></div>
      <div class="linha"><span>A house for every Brit</span><span>we're at <b>${(100 * n / UK_POP).toLocaleString('en-GB', { maximumFractionDigits: 3 })}%</b> 😅</span></div>
      <div class="bottoni"><button data-ir="senzapadrone">🏚 See the towns up for grabs</button></div>`);
  }

  // ---------- imagens para a story ----------
  async mostrarImagem(titulo, nome, gerar, texto) {
    this.abrir(`<h2>📸 ${esc(titulo)}</h2><div class="sub">Putting the kettle on… making your image</div><div class="anteprima vuota"><div class="palla"></div></div>`);
    let blob;
    try {
      await new Promise(ok => requestAnimationFrame(() => setTimeout(ok, 30)));
      const canvas = await gerar();
      blob = await new Promise(ok => canvas.toBlob(ok, 'image/png'));
    } catch (e) {
      console.error(e);
      this.abrir(`<h2>📸 ${esc(titulo)}</h2><div class="sub">Sorry, we couldn't make the image. Please try again.</div>`);
      return;
    }
    const url = URL.createObjectURL(blob), file = new File([blob], nome, { type: 'image/png' });
    const podeCompartilhar = !!navigator.canShare?.({ files: [file] });
    this.abrir(`
      <h2>📸 ${esc(titulo)}</h2>
      <div class="sub">Share it on your story and tag <b>@${PERFIL}</b></div>
      <img class="anteprima" src="${url}" alt="${esc(titulo)}">
      <div class="bottoni">
        ${podeCompartilhar ? '<button id="img-condividi">📤 Share</button>' : ''}
        <a class="botao ${podeCompartilhar ? 'sec' : ''}" href="${url}" download="${esc(nome)}">⬇️ Download</a>
      </div>
      <p class="nota">On your story, add the link to the map and tag @${PERFIL}: we'll add your points at the next update.</p>`);
    $('#img-condividi')?.addEventListener('click', () => navigator.share({ files: [file], text: texto }).catch(() => {}));
  }
  storiaCasa(c) {
    if (!c) return;
    this.mostrarImagem('Your house on your story', `house-${c.conta}.png`, () => immagineCasa(this.fot, this.citta, this.D, c), `My house on UK House by House! @${PERFIL}`);
  }
  attoFondazione(l) {
    if (!l) return;
    this.mostrarImagem(`Blue plaque: ${l.nome}`, `blue-plaque-${l.nome}.png`, () => immagineFondazione(this.fot, this.citta, this.D, l), `${l.nome} was founded by @${l.fondatore} on UK House by House! @${PERFIL}`);
  }

  senzaPadrone() {
    const D = this.D, vuoti = D.comuni.filter(c => !c.luogo).sort((a, b) => b.rango - a.rango || b.pop - a.pop);
    this.abrir(`
      <h2>🏚 Up for Grabs</h2>
      <div class="sub"><b>${num(vuoti.length)}</b> of ${num(D.comuni.length)} towns and villages haven't got a single house yet</div>
      <div class="carta meta"><b>The first house in a town belongs to its founder, forever, with a blue plaque.</b><small>Comment your town and country on the latest post by @${PERFIL}. Know someone from there? Tag them: +${REGOLE.punti.recluta} points if they join.</small></div>
      <h3>The biggest towns still empty</h3>
      <ol class="ranking citta">${vuoti.slice(0, 40).map((c, i) => `<li data-comune="${c.istat}"><span class="pos">${i + 1}</span><span class="quem"><b>${esc(nomeBil(c))}</b><small>${c.sigla ? `${esc(c.sigla)}, ` : ''}${esc(D.regPorCod.get(c.reg).nome)}</small></span><span class="pts">${c.pop ? num(c.pop) : ''}</span></li>`).join('')}</ol>`, 'senzapadrone');
  }

  fiamme() {
    this.abrir(`
      <h2>🔥 On fire now</h2>
      <div class="sub">Houses with a story tagging @${PERFIL} in the last ${REGOLE.fiamme_h} hours</div>
      <ol class="ranking">${this.emFiamme.slice(0, 100).map((c, i) => this.linhaRank(c, i, ` · until ${ora(c.fiamme * 1000)}`)).join('')}</ol>
      <p class="nota">Put your house on your story and tag @${PERFIL}: +${REGOLE.punti.storia} points and your house on fire for ${REGOLE.fiamme_h} hours.</p>`);
  }

  comeFunziona() {
    const P = REGOLE.punti;
    this.abrir(`
      <h2>How does it work?</h2>
      <div class="sub">Comment your town and country on a post by @${PERFIL}: your house appears with your @</div>
      <h3>1. Your house grows</h3>
      <p class="intro">Your points grow your house on the map, all the way up the property ladder: from a tiny cottage to a palace. Every point counts forever: your house never shrinks.</p>
      <div class="scala lista">${REGOLE.livelli.map((n, i) => `<div class="gradino">${iconaLivello(i)}<small>${esc(n.nome)}</small><b>${num(n.min)}+</b></div>`).join('')}</div>
      <h3>2. Unlock your town</h3>
      <p class="intro">Every new house unlocks something for the whole town, from a red phone box to a stadium. Tag mates from your town to get there faster. Locals also vote on the name of the town pub: comment <b>pub Red Lion</b> (or another name from the list in your town's card).</p>
      <div class="sblocchi">${REGOLE.traguardi.map(t => `<div class="sblocco fatto"><span>${t.emoji} ${esc(t.nome)}</span><b>${num(t.case)}</b></div>`).join('')}</div>
      ${REGOLE.gran_elezione ? `<h3>🏛️ The Grand Election</h3>
      <p class="intro">On ${dataLunga(Date.parse(REGOLE.gran_elezione.data))} at ${ora(Date.parse(REGOLE.gran_elezione.data))}, whoever has the most points in the whole game in each nation becomes its first ever ${esc(REGOLE.gran_elezione.titolo)}. Four nations, four winners.</p>
      <div class="bottoni"><button data-ir="gran">🏛️ See who's leading</button></div>` : ''}
      <h3>3. The roles</h3>
      <p class="intro">Roles are won every week with the term's points (Sunday 9pm to Sunday 9pm, UK time). Whoever scores most runs the show, top down, one role each. The Prime Minister and the mayors are elected on Sunday at 9pm and serve all week; the other roles change live.</p>
      <ol class="ranking cariche">${REGOLE.cariche.map(k => `<li><span class="quem"><b>${NOMI_CARICHE[k]}</b><small>${DESCR_CARICHE[k]}</small></span></li>`).join('')}</ol>
      <h3>4. How to earn points</h3>
      <div class="azioni">${COME_GUADAGNARE(P).map(([k, nome, txt]) => `<div class="azione"><i style="background:${FONTI.find(f => f[0] === k)[2]}"></i><div><b>${nome}</b><small>${txt}</small></div></div>`).join('')}</div>
      <h3>5. Your story</h3>
      <p class="intro">Put your house on your story and tag @${PERFIL}: +${P.storia} points (once a day) and your house on fire for 24 hours. Find your @ on the map and tap "Put your house on your story": we'll give you the image, ready to go.</p>
      <h3>6. Battle of the Nations</h3>
      <p class="intro">England, Scotland, Wales and Northern Ireland battle it out every week. It's points per million people, so every nation has a real shot. Each nation has its own houses, its own day and its own way of saying hello.</p>
      <div class="bottoni">${this.minha ? `<button data-casa="${esc(this.minha)}">go to my house</button>` : '<button data-ir="cerca">find my house</button>'}</div>
      <a class="botao segui" href="${IG}" target="_blank" rel="noopener">📲 Follow @${PERFIL} so you don't miss elections and news</a>
      <p class="nota">A town's founder keeps the blue plaque forever; roles are won every week. Nobody can buy roles: points from putting a business on the map grow your house but don't count in elections. Non-partisan game: all roles are just for fun. <a href="privacy.html" target="_blank" rel="noopener">Rules and privacy</a>.</p>`);
    const b = this.conteudo.querySelector('[data-ir="cerca"]');
    if (b) b.onclick = () => { this.fechar(); $('#q').focus(); };
  }

  video() {
    this.abrir(`
      <h2>Fancy making videos like this? 🎬</h2>
      <div class="sub">3D maps, growing houses, towns filling up: we're building a tool so you can make videos like ours.</div>
      <form id="lista-attesa" class="modulo">
        <label>Your email<input type="email" name="email" required placeholder="name@example.co.uk"></label>
        <label>Your Instagram (optional)<input name="conta" placeholder="@your_account"></label>
        <button type="submit">Let me know first</button>
      </form>
      <p class="nota">We'll only use your email to let you know. <a href="privacy.html#lista" target="_blank" rel="noopener">Privacy</a></p>`);
    $('#lista-attesa').onsubmit = async e => {
      e.preventDefault();
      const f = new FormData(e.target), b = e.target.querySelector('button');
      b.disabled = true;
      try {
        const r = await fetch('api/lista.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: f.get('email'), conta: f.get('conta'), origem: 'video' }) });
        const j = await r.json().catch(() => ({}));
        if (!j.ok) throw new Error(j.erro || "We couldn't save that. Please try again.");
        gravar('lista_attesa', f.get('email'));
        this.abrir("<h2>Sorted! You'll be the first to know. 🎉</h2><div class=\"sub\">In the meantime, find your house on the map.</div>");
      } catch (err) {
        b.disabled = false;
        this.aviso(err.message);
      }
    };
  }

  condividir(o) {
    if (o.startsWith('luogo:')) {
      const l = this.D.luoghi[+o.split(':')[1]];
      return this.mostrarImagem(`Share ${l.nome}`, `town-${l.nome}.png`, () => immagineCitta(this.fot, this.citta, this.D, l), `Look at ${l.nome} on UK House by House! @${PERFIL}`);
    }
    const url = location.origin + location.pathname;
    const txt = o === 'tabellone' ? `The towns with the most houses on UK House by House. Where's yours? ${url}#tabellone` : `Look at ${this.D.luoghi[+o.split(':')[1]].nome} on UK House by House: ${url}`;
    if (navigator.share) navigator.share({ text: txt }).catch(() => {});
    else navigator.clipboard?.writeText(txt).then(() => this.aviso('Link copied!'), () => this.aviso(txt));
  }
}
