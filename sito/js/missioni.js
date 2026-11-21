// Games do site (aba 🎮 Games). Fase 1: "Guess the Town": 3 clues, uma tentativa por dia, a cidade na lista.
// O servidor (api/missioni.php) guarda a resposta e mede o tempo; aqui só se mostra. Pontos: motore.mjs (regole.missioni).
// Quem joga: o @ digitado (precisa ter casa). Para os pontos contarem, o celular é vinculado comentando o código
// HOUSE-1234 num post (uma vez por celular); até lá as partidas ficam "waiting" e contam depois, retroativamente.
import { REGOLE, num, ora } from './regole.js';
import { PERFIL } from './storie.js';
import { GiocoPisa, PISA_PIANI } from './pisa.js';

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ']/g, ' ').replace(/\s+/g, ' ').trim();
const ler = k => { try { return localStorage.getItem(k); } catch { return null; } };
const gravar = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* sem storage */ } };
const tempo = ms => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const SITO = 'https://ukhousebyhouse.com';
const NOVITA = 'giochi-v1';

export class Missioni {
  constructor(D, ui) {
    this.D = D; this.ui = ui;
    this.cfg = REGOLE.missioni;
    this.ms = D.snap.missioni ?? { classifica: [], serie: {}, campione: null, giocatori: 0 };
    let dev = ler('ms_dev');
    if (!/^[a-f0-9]{32}$/.test(dev ?? '')) {
      dev = [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join('');
      gravar('ms_dev', dev);
    }
    this.dev = dev;
    const c = ler('ms_conta') || ui.minha;
    this.conta = c && D.porConta.has(c) ? c : null;
    this.stato = null;            // última resposta de "stato" (código, vínculo, partida de hoje)
    this.tela = null;             // 'home' | 'gioco' | 'esito'
    this.idxComuni = D.comuni.map(c => [norm(c.nome), c]).sort((a, b) => b[1].pop - a[1].pop);
    this.pisa = new GiocoPisa(ui, this);
    // selo NEW na aba até a pessoa abrir uma vez
    const aba = $('#schede [data-aba="giochi"]');
    if (aba) { aba.hidden = !this.cfg?.attive; aba.classList.toggle('novita', ler('ms_vista') !== NOVITA); }
  }

  // ---------- servidor ----------
  async api(a, extra = {}) {
    let j = null;
    try {
      const r = await fetch('api/missioni.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ a, conta: this.conta, dev: this.dev, ...extra }) });
      j = await r.json();
    } catch { throw new Error('No connection. Please try again in a moment.'); }
    if (!j?.ok) throw new Error(j?.erro || 'Something went wrong. Please try again.');
    return j;
  }
  erroTela(e) {
    this.ui.abrir(`<h2>🎮 Games</h2><div class="ms-avviso">${esc(e.message)}</div><div class="bottoni"><button data-ms="home">↩ Back to games</button></div>`, 'giochi');
  }

  // ---------- painel da casa (ui.js) ----------
  badge(casa) {
    const out = [];
    if (casa.conta === this.ms.campione?.conta) out.push(`<span class="badge ms">🏆 Games Champion · ${num(this.ms.campione.punti)} points</span>`);
    const n = this.ms.serie?.[casa.conta] ?? 0, premi = (this.cfg?.serie ?? []).filter(([min]) => n >= min);
    if (premi.length) out.push(`<span class="badge ms">🎮 ${n} days of games in a row ${premi.map(p => p[2]).join('')}</span>`);
    return out.join('');
  }

  // ---------- telas ----------
  async home() {
    this.tela = 'home';
    this.pararRelogio();
    gravar('ms_vista', NOVITA);
    $('#schede [data-aba="giochi"]')?.classList.remove('novita');
    if (this.conta) {
      this.ui.abrir('<h2>🎮 Games</h2><p class="nota">Loading…</p>', 'giochi');
      try { this.stato = await this.api('stato'); } catch (e) { this.stato = null; this.erroStato = e.message; }
      if (this.tela !== 'home') return;
    }
    this.ui.abrir(this.htmlHome(), 'giochi');
    this.ligarChi();
  }

  htmlHome() {
    const c = this.cfg, s = this.stato, p = s?.partita;
    const premi = c.premi.map(x => `+${x}`).join('/');
    let quem;
    if (!this.conta) {
      quem = `<div class="ms-chi"><label for="ms-conta">Who are you? Type your Instagram @</label>
        <div class="ms-campo"><span>@</span><input id="ms-conta" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="your_account"></div>
        <div id="ms-sug" class="ms-sug"></div></div>`;
    } else quem = `<div class="ms-io">Playing as <b>@${esc(this.conta)}</b> · <button class="link" data-ms="cambia">change</button></div>`;
    let stato = '';
    if (this.conta && s) {
      if (s.avviso) stato += `<div class="ms-avviso">${esc(s.avviso)}</div>`;
      stato += s.vincolato
        ? `<div class="ms-ok">✔ Phone linked: your points go to @${esc(this.conta)}'s house</div>`
        : `<div class="ms-codice">⏳ <b>To get your points</b> comment <b class="cod">${esc(s.codice)}</b> under any @${PERFIL} post (from @${esc(this.conta)}'s profile). Once per phone is enough: today's games count too.
          <button data-ms="copia" data-v="${esc(s.codice)}">📋 Copy the code and open Instagram</button></div>`;
    } else if (this.conta && this.erroStato) stato = `<div class="ms-avviso">${esc(this.erroStato)}</div>`;
    const btn = !this.conta ? '<button disabled>Play</button>'
      : p?.fine ? `<button class="sec" data-ms="esito">${p.ok ? '✅' : '❌'} Done · see</button>`
      : p ? '<button data-ms="gioca">⏳ Carry on</button>' : `<button data-ms="gioca"${s?.avviso ? ' disabled' : ''}>▶ Play</button>`;
    const n = this.conta ? this.ms.serie?.[this.conta] ?? 0 : 0;
    const prox = c.serie.find(([min]) => n < min);
    const serie = this.conta ? `<div class="ms-serie">🔥 Streak: <b>${n} ${n === 1 ? 'day' : 'days'}</b> in a row${prox ? ` · at ${prox[0]}: ${prox[2]} ${esc(prox[3])} on your house` : ' · you\'ve got every prize! 🏅'}</div>` : '';
    const fim = Date.parse(this.D.snap.mandato.fine);
    const rk = this.ms.classifica ?? [];
    const lista = rk.slice(0, 10).map((r, i) => `<li class="${r.conta === this.conta ? 'io' : ''}" data-casa="${esc(r.conta)}"><span class="pos">${i < 3 ? ['🥇', '🥈', '🥉'][i] : `${i + 1}.`}</span><span class="chi">@${esc(r.conta)}</span><b>${num(r.p)}</b></li>`).join('');
    const mio = this.conta ? rk.findIndex(r => r.conta === this.conta) : -1;
    const camp = this.ms.campione;
    return `<h2>🎮 Games</h2>
      <div class="sub">Play every day and grow your house</div>
      ${quem}
      <div class="ms-card"><span class="ms-ic">🗺️</span><div class="ms-tx"><b>Guess the Town</b><small>${s?.numero ? `#${s.numero} · ` : ''}3 clues · 1 guess a day · +${REGOLE.punti.missione} points if you get it</small></div>${btn}</div>
      <div class="ms-card"><span class="ms-ic">🕰️</span><div class="ms-tx"><b>Big Ben <span class="ps-new">NEW</span></b><small>Stack the floors: get past ${PISA_PIANI} to reach the clock and +${REGOLE.punti.missione} points · your first game today counts</small></div>${!this.conta ? '<button disabled>Play</button>'
        : s?.pisa?.fine ? `<button class="sec" data-ms="pisa">${s.pisa.piani >= PISA_PIANI ? '🏆' : '🧱'} ${s.pisa.piani} floors</button>` : `<button data-ms="pisa"${s?.avviso ? ' disabled' : ''}>▶ Play</button>`}</div>
      <div class="ms-card"><span class="ms-ic">🧭</span><div class="ms-tx"><b>Treasure hunt</b><small>Walk around towns with your character: every day there's a treasure chest in each town and one outside every shop. Free credits 💰!</small></div><button data-ms="tesoro">🚶 Go</button></div>
      ${stato}${serie}
      <h3>🏆 This week's leaderboard</h3>
      <p class="nota">Closes ${ora(fim) === '21:00' ? 'Sunday at 9pm' : `on ${new Date(fim).toLocaleDateString('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'long' })}`} · top 3: ${premi} points for their house, and 1st becomes <b>Games Champion</b> for a week.</p>
      ${lista ? `<ol class="ms-rank">${lista}</ol>` : '<p class="nota">Nobody yet this week: be the first!</p>'}
      ${mio >= 10 ? `<p class="nota">You're <b>#${mio + 1}</b> with ${num(rk[mio].p)} points.</p>` : ''}
      ${camp ? `<p class="ms-camp" data-casa="${esc(camp.conta)}">🏆 Last week's champion: <b>@${esc(camp.conta)}</b> (${num(camp.punti)} points)</p>` : ''}
      <h3>How it works</h3>
      <ul class="ms-regole">
        <li>Every day there's a mystery town: read the clue and pick the town. Only one guess!</li>
        <li>The fewer clues you use and the quicker you are, the more leaderboard points you get (up to 400).</li>
        <li>Get it right: <b>+${REGOLE.punti.missione} points</b> for your house. For elections, games count for ${c.tetto_mandato} points a day at most.</li>
        <li>Play every day: ${c.serie.map(([d, , em, nome]) => `${d} days = ${em} ${esc(nome)}`).join(', ')} on your house (until you miss a day).</li>
        <li>🕰️ Big Ben: your first game today counts. Get past ${PISA_PIANI} floors to reach the clock: <b>+${REGOLE.punti.missione} points</b>; every floor is worth 12 leaderboard points.</li>
        <li>Points reach the map within the hour.</li>
      </ul>`;
  }

  // escolha do @: só contas com casa
  ligarChi() {
    const q = $('#ms-conta'), sug = $('#ms-sug');
    if (!q) return;
    const mostrar = () => {
      const t = q.value.trim().replace(/^@/, '').toLowerCase();
      if (t.length < 2) { sug.innerHTML = ''; return; }
      const exatos = this.D.casas.filter(c => c.conta.startsWith(t)).sort((a, b) => b.tot - a.tot).slice(0, 5);
      sug.innerHTML = exatos.length
        ? exatos.map(c => `<button data-ms="sono" data-v="${esc(c.conta)}">@${esc(c.conta)} <small>${esc(this.D.luoghi[c.luogo].nome)}</small></button>`).join('')
        : '<div class="vuoto">No house with that @. Comment your town under one of our posts to get one!</div>';
    };
    q.addEventListener('input', mostrar);
    setTimeout(() => q.focus(), 50);
  }

  async gioca() {
    try { const r = await this.api('inizia'); this.partita = r.partita; } catch (e) { return this.erroTela(e); }
    if (this.partita.fine) return this.esito();
    this.telaGioco();
  }

  telaGioco() {
    const p = this.partita;
    this.tela = 'gioco';
    this.ui.abrir(`<h2>🗺️ Guess the Town #${p.numero}</h2>
      <div class="ms-tempo">⏱ <span id="ms-tempo">${tempo(p.trascorsi)}</span></div>
      <ol class="ms-indizi">${p.indizi.map((t, i) => `<li><small>Clue ${i + 1}</small>${esc(t)}</li>`).join('')}</ol>
      ${p.n < 3 ? '<button class="sec ms-altro" data-ms="indizio">💡 Another clue <small>(−100 points)</small></button>' : ''}
      <div class="ms-risp">
        <div class="ms-campo"><span>📍</span><input id="ms-comune" type="text" autocomplete="off" spellcheck="false" placeholder="Type the name of the town…"></div>
        <div id="ms-com-sug" class="ms-sug"></div>
      </div>
      <button id="ms-invia" class="ms-invia" data-ms="rispondi" disabled>Answer</button>
      <p class="nota">Only one guess: choose carefully! Your time counts for the leaderboard.</p>`, 'giochi');
    const q = $('#ms-comune'), sug = $('#ms-com-sug'), invia = $('#ms-invia');
    this.scelto = null;
    q.addEventListener('input', () => {
      this.scelto = null; invia.disabled = true; invia.textContent = 'Answer';
      const t = norm(q.value);
      if (t.length < 2) { sug.innerHTML = ''; return; }
      const ini = [], meio = [];
      for (const [k, c] of this.idxComuni) {
        if (k.startsWith(t)) ini.push(c); else if (meio.length < 6 && k.includes(t)) meio.push(c);
        if (ini.length >= 6) break;
      }
      const lista = [...ini, ...meio].slice(0, 6);
      sug.innerHTML = lista.length ? lista.map(c => `<button data-ms="comune" data-v="${c.istat}">${esc(c.nome)} <small>${esc(c.sigla)} · ${esc(this.D.regPorCod.get(c.reg)?.nome ?? '')}</small></button>`).join('') : '<div class="vuoto">No town with that name.</div>';
    });
    setTimeout(() => q.focus(), 50);
    this.ligarRelogio(p.trascorsi);
  }
  ligarRelogio(base) {
    this.pararRelogio();
    const t0 = Date.now() - base;
    this._rel = setInterval(() => { const e = $('#ms-tempo'); if (!e || this.tela !== 'gioco') return this.pararRelogio(); e.textContent = tempo(Date.now() - t0); }, 500);
  }
  pararRelogio() { clearInterval(this._rel); this._rel = null; }

  esito() {
    const p = this.partita, c = this.D.comunePorIstat.get(p.risposta), t = this.D.comunePorIstat.get(p.tentativo);
    this.tela = 'esito';
    this.pararRelogio();
    const s = this.stato;
    const punti = !p.ok ? '' : s?.vincolato
      ? `<div class="ms-ok">⭐ <b>+${REGOLE.punti.missione} points</b> for @${esc(this.conta)}'s house: they'll be on the map within the hour.</div>`
      : `<div class="ms-codice">⭐ <b>+${REGOLE.punti.missione} points waiting.</b> To get them, comment <b class="cod">${esc(s?.codice ?? '')}</b> under any @${PERFIL} post. Once per phone is enough.
          <button data-ms="copia" data-v="${esc(s?.codice ?? '')}">📋 Copy the code and open Instagram</button></div>`;
    const n = (this.ms.serie?.[this.conta] ?? 0);
    this.ui.abrir(`<h2>${p.ok ? '✅ Spot on!' : '❌ Unlucky!'}</h2>
      <div class="ms-esito">The town was <b>${esc(c?.nome ?? '?')}</b>${c ? ` <small>(${esc(c.sigla)})</small>` : ''}${!p.ok && t ? `<br><small>You picked ${esc(t.nome)}</small>` : ''}</div>
      <div class="ms-quadri">${this.quadri(p)}</div>
      <div class="ms-pt"><b>${num(p.punteggio)}</b> leaderboard points<small>⏱ ${tempo(p.ms)} · ${p.n} ${p.n === 1 ? 'clue' : 'clues'}</small></div>
      ${punti}
      <div class="bottoni">
        ${c ? `<button class="sec" data-ms="vedi" data-v="${c.istat}">📍 See it on the map</button>` : ''}
        <button data-ms="condividi">📤 Challenge a mate</button>
      </div>
      <p class="nota">A new town tomorrow${n ? ` · 🔥 streak: ${n} ${n === 1 ? 'day' : 'days'}` : ''}. <button class="link" data-ms="home">Back to games</button></p>`, 'giochi');
  }
  // 🟨 clue usada, 🟩 a que acertou, 🟥 errou, ⬛ não usada
  quadri(p) { return [0, 1, 2].map(i => (i >= p.n ? '⬛' : !p.ok ? '🟥' : i === p.n - 1 ? '🟩' : '🟨')).join(''); }

  async condividi() {
    const p = this.partita;
    const txt = `🗺️ Guess the Town #${p.numero}\n${p.ok ? `✅ in ${tempo(p.ms)}` : '❌'} ${this.quadri(p)}\nCan you beat that? 👇`;
    const url = `${SITO}/?da=gioco#giochi`;
    try {
      if (navigator.share) { await navigator.share({ text: txt, url }); return; }
    } catch (e) { if (e?.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(`${txt}\n${url}`); this.ui.aviso('Copied! Paste it wherever you like.'); } catch { this.ui.aviso(url); }
  }

  // ---------- ações (botões data-ms dentro do painel, delegados pelo ui.js) ----------
  async azione(t) {
    const d = t.dataset, v = d.v;
    if (d.ms === 'home') return this.home();
    if (d.ms === 'sono') { this.conta = v; gravar('ms_conta', v); this.stato = null; this.erroStato = null; return this.home(); }
    if (d.ms === 'cambia') { this.conta = null; gravar('ms_conta', null); this.stato = null; return this.home(); }
    if (d.ms === 'gioca') { t.disabled = true; return this.gioca(); }
    if (d.ms === 'esito') { this.partita = this.stato?.partita; return this.partita ? this.esito() : this.home(); }
    if (d.ms === 'indizio') {
      t.disabled = true;
      try { this.partita = (await this.api('indizio')).partita; } catch (e) { return this.erroTela(e); }
      const val = $('#ms-comune')?.value ?? '';
      this.telaGioco();
      if (val) { const q = $('#ms-comune'); q.value = val; q.dispatchEvent(new Event('input')); }
      return;
    }
    if (d.ms === 'comune') {
      const c = this.D.comunePorIstat.get(v);
      if (!c) return;
      this.scelto = v;
      $('#ms-comune').value = c.nome;
      $('#ms-com-sug').innerHTML = '';
      const b = $('#ms-invia'); b.disabled = false; b.textContent = `Answer: ${c.nome}`;
      return;
    }
    if (d.ms === 'rispondi') {
      if (!this.scelto) return;
      t.disabled = true; t.textContent = '…';
      try { this.partita = (await this.api('rispondi', { istat: this.scelto })).partita; } catch (e) { return this.erroTela(e); }
      if (this.stato) this.stato.partita = this.partita;
      this.esito();
      return;
    }
    if (d.ms === 'vedi') {
      const c = this.D.comunePorIstat.get(v);
      if (c) { this.ui.focar(c.x, c.z, c.luogo ? 1.4 : 2.2, 0.55); this.ui.painel.classList.add('mini'); }
      return;
    }
    if (d.ms === 'condividi') return this.condividi();
    if (d.ms === 'pisa') { t.disabled = true; return this.pisa.apri(false); }
    if (d.ms === 'pisa_treno') return this.pisa.apri(true);
    if (d.ms === 'pisa_condividi') return this.pisa.condividi();
    if (d.ms === 'tesoro') {
      const conto = this.ui.conto, mia = this.D.porConta.get(conto?.p?.conta) ?? this.D.porConta.get(this.conta);
      if (!conto?.p) { this.ui.aviso('🧭 Sign in to your account (it\'s free) for the treasure hunt.'); return conto?.apri(); }
      return this.ui.passeggio?.avvia(mia ? `casa:${mia.conta}` : `luogo:0`);
    }
    if (d.ms === 'copia') {
      try { await navigator.clipboard.writeText(v); } catch { /* sem permissão: a pessoa copia à mão */ }
      this.ui.aviso(`Copied ${v}: paste it in a comment`);
      setTimeout(() => { location.href = `https://www.instagram.com/${PERFIL}/`; }, 900);
    }
  }
}
