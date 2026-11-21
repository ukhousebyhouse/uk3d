// Conta do site (botão no topo à esquerda): entrar com e-mail + código (sem senha), ligar o Instagram com o código
// HOUSE-1234, créditos 💰 do dia (pegos sozinhos ao abrir o site) e a loja.
// Servidor: api/conto.php (sessão por cookie httpOnly). Preços e pacotes: data/crediti.json. Recarga: Stripe (conto.php ricarica).
import { PERFIL } from './storie.js';
import { EditorPersonaggio } from './personaggio.js';

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const n = v => Number(v).toLocaleString('en-GB');
const libra = v => `£${Number(v).toFixed(2)}`;
const ler = k => { try { return localStorage.getItem(k); } catch { return null; } };
const gravar = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sem storage */ } };
const NOVITA = 'conto-v1';
const TIPI = { giornaliero: '🎁 Daily credits', serie: '🔥 Streak bonus', ricarica: '💳 Top-up', rimborso: '↩️ Refund', regalo: '🎁 Gift', acquisto: '🛍️ Purchase', tesoro: '🧭 Treasure found', regalo_deco: '🎁 Decoration gift' };

export class Conto {
  constructor(D, ui) {
    this.D = D; this.ui = ui;
    this.p = null;              // perfil (null = fora)
    this.cfg = null;            // data/crediti.json
    this.email = '';            // e-mail digitado (passo do código)
    this.passo = 'email';
    this.editor = new EditorPersonaggio(ui, this);
    this.bt = $('#mio-conto');
    this.bt.onclick = () => this.apri();
    this.bt.classList.toggle('novita', ler('conto_visto') !== NOVITA);
    this.desenharBotao();
    this.iniciar();
  }

  async iniciar() {
    const v = document.querySelector('meta[name="versione"]')?.content ?? '';
    fetch(`data/crediti.json?v=${v}`).then(r => r.json()).then(j => { this.cfg = j; }).catch(() => {});
    try { this.p = (await this.api('io')).profilo; } catch { this.p = null; }
    await this.depoisDeEntrar(location.hash === '#conto');
    // voltou da Stripe: o webhook credita em alguns segundos
    if (new URLSearchParams(location.search).get('ricarica') === 'ok' && this.p) this.aspettaRicarica(this.p.saldo);
  }
  async aspettaRicarica(antes, tent = 0) {
    if (tent === 0) { this.ui.aviso('⏳ Payment received: your credits are on their way…'); history.replaceState(null, '', location.pathname + location.hash); }
    try { this.p = (await this.api('io')).profilo; } catch { return; }
    this.desenharBotao();
    if (this.p.saldo > antes) { this.ui.aviso(`🎉 +${n(this.p.saldo - antes)} 💰 added. Thank you!`); if (!this.ui.painel.hidden && location.hash === '#conto') this.apri(); return; }
    if (tent < 12) setTimeout(() => this.aspettaRicarica(antes, tent + 1), 5000);
    else this.ui.aviso('Your credits haven’t shown up yet: they’ll arrive in a few minutes. You’ll get a receipt by email.');
  }

  async api(a, extra = {}) {
    let j = null;
    try {
      const r = await fetch('api/conto.php', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ a, ...extra }) });
      j = await r.json();
    } catch { throw new Error('No connection. Please try again in a moment.'); }
    if (j?.uscito) { this.p = null; this.desenharBotao(); }
    if (!j?.ok) throw new Error(j?.erro || 'Something went wrong. Please try again.');
    return j;
  }

  // entrou (ou abriu o site já logado): pega os créditos do dia sozinho e ajuda os jogos com o @
  async depoisDeEntrar(abrir) {
    this.desenharBotao();
    if (this.p?.proprietario) { await this.ui.decori?.ricaricaProprieta(); if (abrir) this.apri(); return; }   // dono: sem prêmio e sem @ automático nos jogos
    if (this.p?.conta && this.ui.missioni && !this.ui.missioni.conta && this.D.porConta.has(this.p.conta)) this.ui.missioni.conta = this.p.conta;
    if (this.p?.conta && !this.p.premio_oggi) await this.premio(true);
    if (abrir) this.apri();
  }
  async premio(silenzioso = false) {
    try {
      const j = await this.api('premio');
      this.p = j.profilo;
      this.desenharBotao();
      if (j.premio) this.ui.aviso(`🎁 +${j.premio.crediti} 💰${j.premio.bonus ? ' (bonus!)' : ''} · 🔥 ${j.premio.serie} ${j.premio.serie === 1 ? 'day' : 'days in a row'}`);
      if (!silenzioso) this.apri();
    } catch (e) { if (!silenzioso) this.ui.aviso(e.message); }
  }

  desenharBotao() {
    const p = this.p;
    this.bt.innerHTML = p ? `💰 <b>${n(p.saldo)}</b>` : '👤 <b>Sign in</b>';
    this.bt.setAttribute('aria-label', p ? `Your account: ${p.saldo} credits` : 'Sign in to your account');
    this.bt.classList.toggle('dentro', !!p);
  }

  // ---------- telas ----------
  apri() {
    gravar('conto_visto', NOVITA); this.bt.classList.remove('novita');
    if (location.hash !== '#conto') history.replaceState(null, '', '#conto');
    this.ui.abrir(this.p ? this.htmlConta() : this.htmlEntra(), null);
    const foco = $(this.p ? '#ct-conta' : this.passo === 'email' ? '#ct-email' : '#ct-cod');
    if (foco && !this.p) setTimeout(() => foco.focus(), 50);
    $('#ct-email')?.addEventListener('keydown', e => { if (e.key === 'Enter') this.azione({ dataset: { ct: 'codice' } }); });
    $('#ct-cod')?.addEventListener('input', e => { if (e.target.value.replace(/\D/g, '').length === 6) this.azione({ dataset: { ct: 'entra' } }); });
    $('#ct-conta')?.addEventListener('keydown', e => { if (e.key === 'Enter') this.azione({ dataset: { ct: 'collega' } }); });
  }

  htmlEntra() {
    const vantaggi = `<div class="ct-vantaggi"><div>💰 <b>Free credits</b> every day you visit</div><div>🔥 <b>Bonus</b> if you come back every day (+20 on day 7, +100 on day 30)</div><div>🚶 <b>Walk</b> the streets of your town</div><div>🔑 <b>Go inside your house</b> and furnish it</div><div>🏰 Villas, castles, 🚲 bikes, 🛵 scooters and 🏎️ cars</div></div>`;
    if (this.passo === 'codice') return `<h2>📩 Check your email</h2>
      <div class="sub">We've sent a 6-digit code to <b>${esc(this.email)}</b></div>
      <div class="ms-campo ct-cod"><input id="ct-cod" inputmode="numeric" autocomplete="one-time-code" maxlength="7" placeholder="123456" aria-label="Code"></div>
      <div class="bottoni"><button data-ct="entra">✅ Sign in</button><button class="sec" data-ct="indietro">✏️ Change email</button></div>
      <div class="ct-sicuro">⏳ It can take <b>1–2 minutes</b>. Check your <b>Spam</b> and <b>Promotions</b> folders too. The code works for 30 minutes: if two arrive, both work.</div>
      <p class="nota">Still nothing? <button class="ct-link" data-ct="codice" id="ct-rimanda">Send it again</button></p>`;
    return `<h2>👤 Your account</h2>
      <div class="sub">Sign in with your email: we'll send you a code. No password to remember.</div>
      ${vantaggi}
      <div class="ms-campo"><input id="ct-email" type="email" autocomplete="email" inputmode="email" placeholder="you@email.co.uk" value="${esc(this.email)}" aria-label="Email"></div>
      <div class="bottoni"><button data-ct="codice">📩 Send me the code</button></div>
      <div class="ct-sicuro">🔒 <b>Safe sign-in without a password:</b> nobody can get in without the code that comes to your email. We'll let you know about every new sign-in.</div>
      <p class="nota">We only use your email to sign you in and send receipts. <a href="privacy.html#account" class="link">Privacy</a> · <a href="terms.html#credits" class="link">Credits rules</a></p>`;
  }

  htmlConta() {
    const p = this.p, g = this.cfg?.giornaliero ?? { base: 2, serie: [[30, 100], [7, 20]] };
    // próximo bônus de série
    const prox = (g.serie ?? []).map(([ogni, extra]) => ({ giorno: Math.ceil((p.serie + 1) / ogni) * ogni, extra })).sort((a, b) => a.giorno - b.giorno)[0];
    let premio;
    if (!p.conta || p.proprietario) premio = '';
    else if (p.premio_oggi) premio = `<div class="ms-serie">✅ Today's credits collected · 🔥 <b>${p.serie} ${p.serie === 1 ? 'day' : 'days in a row'}</b>${prox ? `<br><small>Come back tomorrow: on day ${prox.giorno} in a row you get <b>+${prox.extra} 💰</b> extra.</small>` : ''}</div>`;
    else premio = `<div class="ms-card"><span class="ms-ic">🎁</span><div class="ms-tx"><b>Today's credits</b><small>+${g.base} 💰 every day you visit</small></div><button data-ct="premio">Collect</button></div>`;
    let ig;
    if (p.proprietario) ig = `<div class="ms-codice">🛠️ <b>Owner account</b> (testing): test credits, no emails, no daily reward.
        Villa, castle and your home with an inside stay yours only: they don't take the county's castle or touch the player's house.
        <br>House you're testing: <b>${p.conta ? `@${esc(p.conta)}` : 'none'}</b></div>
        <div class="ms-chi"><label for="ct-conta">Test with any @'s house (the player doesn't lose anything)</label>
        <div class="ms-campo"><span>@</span><input id="ct-conta" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="instagram_name" value=""></div>
        <div class="bottoni"><button data-ct="collega">Use this house</button></div></div>`;
    else if (p.conta) ig = `<div class="ms-ok">📸 Instagram linked: <b>@${esc(p.conta)}</b></div>`;
    else if (p.attesa) ig = `<div class="ms-codice">📸 To link <b>@${esc(p.attesa.conta)}</b>, comment this code under one of our Instagram posts:<br>
        <span class="cod">${esc(p.attesa.codice)}</span><br><small>Within about 30 minutes your account links itself and you get today's credits.</small>
        <button data-ct="copia">📋 Copy the code and open Instagram</button></div>
        <div class="bottoni"><button class="sec" data-ct="io">🔄 Check</button><button class="sec" data-ct="scollega">✏️ Change @</button></div>`;
    else ig = `<div class="ms-chi"><label for="ct-conta">📸 Link your Instagram to get credits every day</label>
        <div class="ms-campo"><span>@</span><input id="ct-conta" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="your_name" value="${esc(this.ui.minha ?? '')}"></div>
        <div class="bottoni"><button data-ct="collega">Link</button></div><small class="ct-mini">You need a house on the map with that name.</small></div>`;
    // loja: o que tem "vendita" compra direto daqui; o resto aparece como "soon"
    const own = new Set(p.oggetti ?? []);
    const cast = this.castelloMio();
    const cat = (this.cfg?.catalogo ?? []).filter(x => x.id !== 'decora').map(x => {
      const tua = own.has(x.id), ora = !!x.vendita;
      let nota = x.nota ? esc(x.nota) : '', bt = '';
      if (x.id === 'castello' && ora && !tua) {
        if (!p.conta) nota = 'Link your Instagram: the castle goes on your house';
        else if (cast?.chi) nota = `🔒 The castle of ${esc(cast.regione)} already belongs to @${esc(cast.chi)}`;
        else if (cast) nota = `🔓 The castle of ${esc(cast.regione)} is still free!`;
      }
      if (ora && !tua && (!(x.id === 'castello' && cast?.chi) || p.proprietario)) bt = `<button data-ct="compra" data-item="${x.id}">Buy</button>`;
      if (x.id === 'interni' && tua) bt = `<button class="sec" data-ct="miacasa">Go in</button>`;
      return `<div class="ct-item${ora ? ' ora' : ''}${tua ? ' tua' : ''}"><span>${x.icona}</span><b>${esc(x.nome)}</b><em>${tua ? '✅ Yours' : `${n(x.prezzo)} 💰${ora ? '' : ' · soon'}`}</em>${nota ? `<small>${nota}</small>` : ''}${bt}</div>`;
    }).join('');
    const pac = (this.cfg?.pacchetti ?? []).map(x => {
      const pieno = (this.cfg?.mobili ?? []).filter(m => x.mobili.includes(m.id)).reduce((s, m) => s + m.prezzo, 0), tutti = x.mobili.every(m => own.has(`mob_${m}`));
      return `<div class="ct-item ora${tutti ? ' tua' : ''}"><span>${x.icona}</span><b>${esc(x.nome)}</b><em>${tutti ? '✅ Yours' : `<s>${n(pieno)}</s> ${n(x.prezzo)} 💰`}</em><small>${x.mobili.length} pieces of furniture · for your home with an inside</small>${tutti ? '' : `<button data-ct="compra" data-item="pac_${x.id}">Buy</button>`}</div>`;
    }).join('');
    const pacchi = p.ricarica && !p.proprietario ? `<h3 class="ct-h" id="ct-ricarica">💳 Top up credits</h3><div class="ct-pacchi">${(this.cfg?.pacchi ?? []).map(x => `<button data-ct="ricarica" data-pacco="${x.id}">${x.etichetta ? `<i>${esc(x.etichetta)}</i>` : ''}<b>${n(x.crediti)} 💰</b><span>${libra(x.prezzo)}</span>${x.bonus ? `<small>+${x.bonus}%</small>` : ''}</button>`).join('')}</div><p class="ct-mini">Secure checkout by Stripe · card, Apple Pay, Google Pay · VAT included</p>` : '';
    const mov = (p.ultimi ?? []).map(m => `<li><span>${TIPI[m.tipo] ?? (TIPI[String(m.tipo).replace('prova_', '')] ? `🛠️ ${TIPI[m.tipo.replace('prova_', '')]}` : esc(m.tipo))}</span><small>${new Date(m.em).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })}</small><b class="${m.delta < 0 ? 'neg' : ''}">${m.delta > 0 ? '+' : ''}${n(m.delta)}</b></li>`).join('');
    return `<h2>💰 Your account</h2><div class="sub">${esc(p.email)}</div>
      <div class="ct-saldo"><b>${n(p.saldo)}</b><span>💰 credits</span></div>
      ${premio}${ig}
      <div class="ms-card"><span class="ms-ic">🧍</span><div class="ms-tx"><b>Your character</b><small>${p.pg ? 'Change your look whenever you like: it\'s free' : 'Create them: they\'re the one who walks around the towns'}</small></div><button data-ct="personaggio">${p.pg ? 'Edit' : 'Create'}</button></div>
      ${pacchi}
      <h3 class="ct-h">🛍️ Shop</h3><p class="ct-mini">What you buy is yours forever. 100 💰 = £1. Clothes and accessories: in your character.</p>
      <div class="ct-cat">${cat}</div>
      ${pac ? `<h3 class="ct-h">📦 Furniture packs</h3><div class="ct-cat">${pac}</div>` : ''}
      ${mov ? `<h3 class="ct-h">📒 Transactions</h3><ul class="ct-mov">${mov}</ul>` : ''}
      <div class="ct-sicuro">🔒 We email you about every new sign-in and send a receipt for every top-up or purchase.</div>
      <div class="bottoni"><button class="sec" data-ct="esci">Sign out</button><button class="sec" data-ct="esci_tutti">🔒 Sign out everywhere</button></div>
      <p class="nota">Credits can't buy points, votes or roles. <a href="terms.html#credits" class="link">Credits rules</a></p>`;
  }

  // castelo do county da casa do @: { regione, chi } (chi = dono, se já for de outra pessoa)
  castelloMio() {
    const c = this.D.porConta.get(this.p?.conta); if (!c) return null;
    const cod = this.D.luoghi[c.luogo].comune.sigla, x = this.ui.decori?.prop?.castelli?.[cod];
    return { regione: cod, chi: x?.conta && x.conta !== this.p.conta ? x.conta : null };
  }
  // abre a conta já na parte da recarga (pílula do mapa, "you need N 💰")
  apriRicarica(msg = '') {
    if (!this.p) { this.ui.aviso(msg || '💰 Sign in to your account to top up your credits.'); this.apri(); return; }
    this.apri();
    setTimeout(() => $('#ct-ricarica')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
    if (msg) this.ui.aviso(msg);
  }
  // compra com créditos (todas as lojas passam por aqui): confirma, compra e, se faltar saldo, oferece a recarga. true = comprou
  async compra(item, nome, prezzo, dopo = '') {
    if (!this.p) { this.ui.aviso('Sign in to your account to buy.'); this.apri(); return false; }
    const manca = prezzo - (this.p.saldo ?? 0);
    if (manca > 0) {
      if (this.p.ricarica && confirm(`${nome} costs ${n(prezzo)} 💰: you need ${n(manca)} 💰 more.\n\nWould you like to top up your credits?`)) this.apriRicarica();
      else if (!this.p.ricarica) this.ui.aviso(`You need ${n(manca)} 💰 more for ${nome}.`);
      return false;
    }
    if (!confirm(`Buy ${nome} for ${n(prezzo)} 💰?${dopo ? `\n${dopo}` : ''}\n\nYou'll have ${n(-manca)} 💰 left.`)) return false;
    try {
      this.p = (await this.api('compra', { item })).profilo;
      this.desenharBotao();
      this.ui.aviso(`🎉 ${nome}: it's yours!`);
      if (item === 'villa' || item === 'castello') await this.ui.decori?.ricaricaProprieta();
      return true;
    } catch (e) { this.ui.aviso(e.message); return false; }
  }

  // ---------- ações (ui.js delega os cliques com data-ct) ----------
  async azione(t) {
    const a = t.dataset.ct;
    try {
      if (a === 'codice') {
        const e = ($('#ct-email')?.value ?? this.email).trim();
        if (!e) return this.ui.aviso('Type your email.');
        if (this.passo === 'codice' && this._attesa && Date.now() < this._attesa) return this.ui.aviso(`⏳ Wait another ${Math.ceil((this._attesa - Date.now()) / 1000)} seconds and check your spam folder too.`);
        this.email = e;
        const j = await this.api('codice', { email: e });
        this.passo = 'codice';
        this._attesa = Date.now() + 60000;
        this.apri();
        if (j.dev_codice) { $('#ct-cod').value = j.dev_codice; console.log('test code', j.dev_codice); }
        else this.ui.aviso(j.gia ? '📩 We\'ve just sent you the code: wait a minute and check your spam folder too.' : '📩 Code sent! Check your spam folder too.');
        // conta 60 s no botão "Send it again"
        clearInterval(this._timer);
        this._timer = setInterval(() => {
          const b = $('#ct-rimanda'), s = Math.ceil((this._attesa - Date.now()) / 1000);
          if (!b) return clearInterval(this._timer);
          if (s > 0) { b.disabled = true; b.textContent = `Send it again (${s})`; } else { b.disabled = false; b.textContent = 'Send it again'; clearInterval(this._timer); }
        }, 1000);
      } else if (a === 'indietro') { this.passo = 'email'; this.apri(); }
      else if (a === 'entra') {
        const c = ($('#ct-cod')?.value ?? '').replace(/\D/g, '');
        if (c.length !== 6) return this.ui.aviso('The code has 6 digits.');
        if (this._entrando) return; this._entrando = true;
        try { const j = await this.api('entra', { email: this.email, codice: c }); this.p = j.profilo; this.passo = 'email'; } finally { this._entrando = false; }
        this.ui.aviso(this.p.saldo ? `Welcome back! 💰 ${n(this.p.saldo)}` : 'Welcome! 🎉');
        await this.depoisDeEntrar(true);
      } else if (a === 'io') { this.p = (await this.api('io')).profilo; await this.depoisDeEntrar(true); if (!this.p?.conta) this.ui.aviso('Not yet: the robot checks the comments roughly every half an hour.'); }
      else if (a === 'collega') {
        const c = ($('#ct-conta')?.value ?? '').trim().replace(/^@/, '').toLowerCase();
        if (!c) return this.ui.aviso('Type your Instagram name.');
        this.p = (await this.api('collega', { conta: c })).profilo;
        await this.depoisDeEntrar(true);
      } else if (a === 'scollega') { this.p = (await this.api('scollega')).profilo; this.apri(); }
      else if (a === 'copia') {
        try { await navigator.clipboard.writeText(this.p.attesa.codice); this.ui.aviso('Code copied!'); } catch { this.ui.aviso(this.p.attesa.codice); }
        setTimeout(() => { location.href = `https://www.instagram.com/${PERFIL}/`; }, 900);
      } else if (a === 'premio') await this.premio(false);
      else if (a === 'personaggio') this.editor.apri();
      else if (a === 'accedi') this.apri();
      else if (a === 'prova' && this.p?.proprietario) {
        this.p = (await this.api('collega', { conta: t.dataset.v })).profilo;
        this.desenharBotao();
        await this.ui.decori?.ricaricaProprieta();
        const c = this.D.porConta.get(this.p.conta);
        if (c) this.ui.casa(c, false);
        this.ui.aviso(`🛠️ Now testing @${this.p.conta}'s house`);
      }
      else if (a === 'miacasa') { const c = this.D.porConta.get(this.p?.conta); if (c) this.ui.interni?.apri(c.conta); }
      else if (a === 'compra') {
        const id = t.dataset.item, pac = id.startsWith('pac_') ? (this.cfg?.pacchetti ?? []).find(x => `pac_${x.id}` === id) : null;
        const x = pac ?? (this.cfg?.catalogo ?? []).find(i => i.id === id);
        if (!x) return;
        const DOPO = { villa: 'Your house on the map becomes a villa with a pool, forever.', castello: 'Your house becomes your county\'s castle, forever. Only 1 per county!',
          interni: 'You can furnish it and everyone can visit.' };
        const veic = x.velocita ? `You'll find it on your walk: ${x.velocita}× faster, and it takes the road to nearby towns.` : '';
        const nome = id === 'castello' && this.castelloMio() ? `the Castle of ${this.castelloMio().regione}` : x.nome;
        if (await this.compra(id, nome, x.prezzo, DOPO[id] ?? veic)) {
          this.apri();
          if (id === 'villa' || id === 'castello') { const c = this.D.porConta.get(this.p.conta); if (c) setTimeout(() => this.ui.casa(c), 600); }
        }
      }
      else if (a === 'ricarica') {
        // consentimento para entrega imediata (Consumer Contracts Regulations): sem ele não abre o pagamento
        if (!confirm('Your credits arrive in your account straight away.\n\nBy carrying on you ask for them to be delivered now and you understand that once you get them you lose your 14-day right to cancel. If the payment is refunded, the credits are taken back.\n\nUnder 18? Ask a parent or carer first.\n\nGo to payment?')) return;
        t.disabled = true;
        try { const j = await this.api('ricarica', { pacco: t.dataset.pacco }); location.href = j.url; } finally { t.disabled = false; }
      }
      else if (a === 'esci_tutti') {
        if (!confirm('Sign out of your account on every phone and computer? To get back in you\'ll need a new code by email.')) return;
        await this.api('esci_tutti'); this.p = null; this.desenharBotao(); this.ui.fechar(); this.ui.aviso('🔒 Signed out everywhere.');
      } else if (a === 'esci') { await this.api('esci'); this.p = null; this.desenharBotao(); this.ui.fechar(); this.ui.aviso('You\'ve signed out.'); }
    } catch (e) { this.ui.aviso(e.message); }
  }
}
