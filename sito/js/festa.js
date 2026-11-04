// Noite (pelo sol no centro do Reino Unido), luzes das cidades, fogos de artifício e o calendário britânico.
// Testes: ?notte=1 / ?notte=0 forçam a noite; ?fuochi=bonfire|hogmanay|nazione|elezione|flypast forçam uma festa;
// ?festa=SCT|WLS|NIR|ENG força o dia de uma nação.
import * as THREE from 'three';
import { posLote, DIST_CIDADE } from './citta.js';
import { halloweenAttivo, bonfireAttivo, festeNazioneOggi } from './regole.js';

const qs = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
const RAD = Math.PI / 180;

// nascer e pôr do sol em 54°N, 2°W (aproximação astronômica, erro de poucos minutos); devolve horas UTC
function sole(ts) {
  const d = new Date(ts), inizio = Date.UTC(d.getUTCFullYear(), 0, 0), N = Math.floor((ts - inizio) / 86400e3);
  const decl = 23.44 * Math.sin(2 * Math.PI * (284 + N) / 365) * RAD, lat = 54 * RAD;
  const w0 = Math.acos(Math.max(-1, Math.min(1, (Math.sin(-0.83 * RAD) - Math.sin(lat) * Math.sin(decl)) / (Math.cos(lat) * Math.cos(decl))))) / RAD;
  const B = 2 * Math.PI * (N - 81) / 364, eqt = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);   // minutos
  const mezzodi = 12 + 2 / 15 - eqt / 60;
  return { alba: mezzodi - w0 / 15, tramonto: mezzodi + w0 / 15 };
}
export function notteAttiva(ts = Date.now()) {
  const f = qs.get('notte');
  if (f !== null) return f !== '0';
  const { alba, tramonto } = sole(ts), d = new Date(ts), h = d.getUTCHours() + d.getUTCMinutes() / 60;
  return h < alba - 0.3 || h > tramonto + 0.45;   // um pouco depois do pôr do sol já fica escuro
}

// data e hora em Londres
const londra = ts => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', weekday: 'short', hourCycle: 'h23' }).formatToParts(new Date(ts)).map(x => [x.type, x.value]));
  return { md: `${p.month}-${p.day}`, ano: +p.year, ora: +p.hour, dom: p.weekday === 'Sun' };
};
// Remembrance Sunday: segundo domingo de novembro (dia sóbrio: sem fogos)
function remembrance(ano) {
  const d = new Date(Date.UTC(ano, 10, 1)), primoDom = 1 + ((7 - d.getUTCDay()) % 7);
  return `11-${String(primoDom + 7).padStart(2, '0')}`;
}

const PAL = { oro: ['#FFD66B', '#FFF1B8'], rosso: ['#FF5A4E', '#FFC2B8'], verde: ['#3FE07A', '#C9FFD9'], bianco: ['#FFFFFF', '#DDE8FF'], blu: ['#5AA8FF', '#CDE6FF'], rosa: ['#FF6FB5', '#FFD0EA'] };
const UNION = ['rosso', 'bianco', 'blu'];
// cores dos fogos no dia de cada nação (Northern Ireland: dourado e branco, neutros)
const PAL_NAZIONE = { ENG: ['rosso', 'bianco'], SCT: ['blu', 'bianco'], WLS: ['verde', 'bianco', 'rosso'], NIR: ['oro', 'bianco'] };
const EMOJI_FESTA = { "St Andrew's Day": '🦄', 'Burns Night': '🥃', "St Dwynwen's Day": '💕', "St David's Day": '🌼', "St Patrick's Day": '☘️', "St George's Day": '🌹' };

export class Festa {
  constructor(mappa, D) {
    this.mappa = mappa; this.D = D;
    this.comune = id => D.comunePorIstat.get(id);
    this.notte = null;
    this.criarLuci();
    this.criarFuochi();
    this.criarFrecce();
    this.aggiorna();
    setInterval(() => this.aggiorna(), 60e3);
    mappa.aoFrame.push(t => this.passo(t));
  }

  // ---------- quais festas valem agora ----------
  aggiorna() {
    const agora = Date.now(), r = londra(agora), notte = notteAttiva(agora), forca = qs.get('fuochi');
    if (notte !== this.notte) { this.notte = notte; this.mappa.definirNotte(notte); this.luci.visible = notte; }
    const D = this.D, top = [...D.luoghi].sort((a, b) => b.case - a.case);
    const fonti = [], avvisi = [];
    const citta = (l, rate, palette) => l && fonti.push({ l, rate, palette });
    this.nazioneOggi = null;
    const silenzio = r.md === remembrance(r.ano);
    if (silenzio) avvisi.push("Remembrance Sunday · two minutes' silence at 11am");
    // New Year: Hogmanay em Edinburgh e Londres com mais fogos
    const hogmanay = (r.md === '12-31' && r.ora >= 20) || (r.md === '01-01' && r.ora < 3);
    if (hogmanay || forca === 'hogmanay') {
      top.slice(0, 45).forEach(l => citta(l, 0.45));
      for (const id of ['2650225', '2643743']) citta(this.comune(id)?.luogo, 1.6);   // Edinburgh, London
      avvisi.push('🎆 Happy New Year! Happy Hogmanay!');
    }
    // Bonfire Night: só na noite do dia 5, fogos sobre England, Scotland e Wales (Northern Ireland fica de fora:
    // lá a festa quase não existe e o tema é sensível); no dia 4 só o aviso de "amanhã"
    this.bonfireOggi = false;
    if (bonfireAttivo(agora) || forca === 'bonfire') {
      if (r.md === '11-05' || forca === 'bonfire') {
        this.bonfireOggi = true;
        top.filter(l => l.regione.cod !== 'NIR').slice(0, 90).forEach((l, k) => citta(l, k < 12 ? 0.9 : 0.5));
        avvisi.push(notte ? '🎆 Happy Bonfire Night! Look up 👀' : '🎆 Happy Bonfire Night! Fireworks at dusk');
      } else avvisi.push('🎆 Bonfire Night tomorrow! Fireworks at dusk');
    }
    if (halloweenAttivo(agora)) avvisi.push("🎃 Happy Halloween! Which town's the spookiest?");
    // dia de cada nação: aviso o dia todo, fogos nas cidades da nação à noite
    const feste = festeNazioneOggi(agora);
    if (forca === 'nazione' && !feste.length) feste.push({ reg: 'WLS', nome: "St David's Day" });
    for (const f of feste) {
      avvisi.push(`${EMOJI_FESTA[f.nome] ?? '🎉'} Happy ${f.nome}! Double story points in ${D.regPorCod.get(f.reg)?.nome ?? ''}`);
      top.filter(l => l.regione.cod === f.reg).slice(0, 25).forEach(l => citta(l, 0.5, PAL_NAZIONE[f.reg]));
      this.nazioneOggi = f.reg;
    }
    // esquadrilha da fumaça (vermelho, branco e azul): desligada do calendário automático; prévia com ?fuochi=flypast
    const flypast = forca === 'flypast';
    if (flypast) avvisi.push('✈️ Flypast over the UK!');
    this.frecce.visible = flypast;
    if (flypast) this.mappa.animatori.add(this);
    // noite da eleição: domingo depois das 21h, sobre a cidade do novo Prime Minister
    const pres = D.snap.cariche.presidente, pc = pres && D.porConta.get(pres.conta);
    if (pc && ((r.dom && r.ora >= 21 && pres.eletto_nel_mandato === D.snap.mandato.n - 1) || forca === 'elezione')) {
      citta(D.luoghi[pc.luogo], 1.6, UNION);
      top.slice(0, 15).forEach(l => citta(l, 0.2));
      avvisi.push(`🏛 New Prime Minister: @${pc.conta}`);
    }
    // vizinhos novos: cidades com casas que chegaram nas últimas 2 horas (fogos pequenos)
    const recenti = new Map(), lim = Date.parse(D.snap.dati_fino) - 2 * 3600e3;
    for (const c of D.casas) if (c.ts >= lim) recenti.set(c.luogo, (recenti.get(c.luogo) ?? 0) + 1);
    [...recenti].filter(([li]) => !(this.bonfireOggi && D.luoghi[li].regione.cod === 'NIR')).sort((a, b) => b[1] - a[1]).slice(0, 25).forEach(([li, n]) => citta(D.luoghi[li], Math.min(0.25, 0.05 + n * 0.02)));
    // Remembrance Sunday: nenhum fogo no mapa
    this.fonti = notte && !silenzio ? fonti : [];
    this.avvisi = avvisi;
    if (this.fonti.length) this.mappa.animatori.add(this);
    this.mappa.sujo = true;
  }

  // ---------- luzes das cidades à noite (um ponto quente por casa, visto de longe) ----------
  criarLuci() {
    const D = this.D, n = D.casas.length, pos = new Float32Array(n * 3), mp = this.mappa;
    D.casas.forEach((casa, i) => {
      const l = D.luoghi[casa.luogo], q = posLote(casa.lote), x = l.x + q.x, z = l.z + q.z;
      pos.set([x, mp.altura(x, z) + 0.05, z], i * 3);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.ShaderMaterial({
      uniforms: { escala: { value: 1 }, pr: { value: mp.renderer.getPixelRatio() } },
      vertexShader: `uniform float escala; uniform float pr;
        void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = clamp(0.12 * escala / -mv.z, 2.5, 10.0) * pr; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `void main() { float d = length(gl_PointCoord - 0.5) * 2.0; if (d > 1.0) discard; gl_FragColor = vec4(vec3(1.0, 0.82, 0.45) * (1.0 - d * d), 1.0); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.luci = new THREE.Points(g, mat);
    this.luci.frustumCulled = false; this.luci.renderOrder = 6; this.luci.visible = false;
    mp.scene.add(this.luci);
    mp.aoMover.push(() => {
      mat.uniforms.escala.value = innerHeight / (2 * Math.tan(mp.camera.fov * Math.PI / 360));
      this.luci.visible = !!this.notte && mp.dist > DIST_CIDADE * 0.55;
    });
  }

  // ---------- fogos: foguete subindo + explosão de faíscas, tamanho proporcional ao zoom ----------
  criarFuochi() {
    const MAX = 4000;
    this.cap = MAX; this.scoppi = [];
    const g = new THREE.BufferGeometry();
    this.aPos = new Float32Array(MAX * 3); this.aCor = new Float32Array(MAX * 3); this.aAlfa = new Float32Array(MAX); this.aTam = new Float32Array(MAX);
    g.setAttribute('position', new THREE.BufferAttribute(this.aPos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('cor', new THREE.BufferAttribute(this.aCor, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('alfa', new THREE.BufferAttribute(this.aAlfa, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('tam', new THREE.BufferAttribute(this.aTam, 1).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.ShaderMaterial({
      uniforms: { escala: { value: 1 }, pr: { value: this.mappa.renderer.getPixelRatio() } },
      vertexShader: `attribute vec3 cor; attribute float alfa; attribute float tam; uniform float escala; uniform float pr; varying vec3 vCor; varying float vA;
        void main() { vCor = cor; vA = alfa; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = alfa <= 0.0 ? 0.0 : clamp(tam * escala / -mv.z, 3.5, 26.0) * pr; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec3 vCor; varying float vA;
        void main() { float d = length(gl_PointCoord - 0.5) * 2.0; if (d > 1.0) discard; float nucleo = smoothstep(0.55, 0.0, d), alone = (1.0 - d) * 0.45; gl_FragColor = vec4(vCor * (nucleo + alone) * vA * 2.2, 1.0); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.matF = mat;
    this.pts = new THREE.Points(g, mat);
    this.pts.frustumCulled = false; this.pts.renderOrder = 20;
    this.mappa.scene.add(this.pts);
    this.t0 = null;
  }

  // ---------- flypast: 3 rastros de fumaça (vermelho, branco, azul) de Edinburgh a Londres ----------
  criarFrecce() {
    const P = this.D.geo.proj, xz = (lat, lon) => new THREE.Vector3((lon - P.LON0) * P.KM * Math.cos(lat * RAD), 0, (P.LAT0 - lat) * P.KZ);
    const rota = [xz(55.95, -3.19), xz(54.97, -1.61), xz(53.96, -1.08), xz(53.48, -2.24), xz(52.48, -1.9), xz(51.75, -1.26), xz(51.5, -0.13)];
    this.rotaFrecce = new THREE.CatmullRomCurve3(rota, false, 'centripetal');
    this.NF = 260;                                    // pontos por rastro
    const n = this.NF * 3, g = new THREE.BufferGeometry();
    this.fPos = new Float32Array(n * 3); this.fAlfa = new Float32Array(n);
    const cor = new Float32Array(n * 3), cores = ['#E0283F', '#FFFFFF', '#2F5FC4'].map(c => new THREE.Color(c));
    for (let i = 0; i < n; i++) cores[Math.floor(i / this.NF)].toArray(cor, i * 3);
    g.setAttribute('position', new THREE.BufferAttribute(this.fPos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('alfa', new THREE.BufferAttribute(this.fAlfa, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('cor', new THREE.BufferAttribute(cor, 3));
    this.matFrecce = new THREE.ShaderMaterial({
      uniforms: { escala: { value: 1 }, tam: { value: 1 }, pr: { value: this.mappa.renderer.getPixelRatio() } },
      vertexShader: `attribute vec3 cor; attribute float alfa; uniform float escala; uniform float tam; uniform float pr; varying vec3 vCor; varying float vA;
        void main() { vCor = cor; vA = alfa; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = alfa <= 0.0 ? 0.0 : clamp(tam * escala / -mv.z, 3.0, 60.0) * pr; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec3 vCor; varying float vA;
        void main() { float d = length(gl_PointCoord - 0.5) * 2.0; if (d > 1.0) discard; gl_FragColor = vec4(vCor, vA * (1.0 - d * d)); }`,
      transparent: true, depthWrite: false,
    });
    this.frecce = new THREE.Points(g, this.matFrecce);
    this.frecce.frustumCulled = false; this.frecce.renderOrder = 19; this.frecce.visible = false;
    this.mappa.scene.add(this.frecce);
  }
  passoFrecce(t) {
    const mp = this.mappa, giro = 26, testa = (t % giro) / giro * 1.45;   // a formação percorre a rota e sai; o rastro se dissipa
    const scia = 0.55, quota = 9, larg = Math.max(0.6, mp.dist * 0.006), v = new THREE.Vector3(), tg = new THREE.Vector3();
    this.matFrecce.uniforms.escala.value = innerHeight / (2 * Math.tan(mp.camera.fov * Math.PI / 360));
    this.matFrecce.uniforms.tam.value = larg * 1.6;
    for (let r = 0; r < 3; r++) for (let k = 0; k < this.NF; k++) {
      const i = r * this.NF + k, u = testa - (k / (this.NF - 1)) * scia;
      if (u < 0 || u > 1) { this.fAlfa[i] = 0; continue; }
      this.rotaFrecce.getPointAt(u, v); this.rotaFrecce.getTangentAt(u, tg);
      const off = (r - 1) * larg, ox = -tg.z, oz = tg.x, n = Math.hypot(ox, oz) || 1, idade = k / (this.NF - 1);
      const allarga = 1 + idade * 1.4;               // a fumaça abre um pouco com o tempo
      this.fPos.set([v.x + ox / n * off * allarga, mp.altura(v.x, v.z) * 0.2 + quota, v.z + oz / n * off * allarga], i * 3);
      this.fAlfa[i] = (1 - idade) * 0.85;
    }
    const at = this.frecce.geometry.attributes;
    at.position.needsUpdate = at.alfa.needsUpdate = true;
  }

  lancia(fonte, agoraS) {
    const N = 80, l = fonte.l, cores = (fonte.palette ?? Object.keys(PAL)).map(k => PAL[k]), [c1, c2] = cores[Math.floor(Math.random() * cores.length)];
    const dirs = [];
    for (let i = 0; i < N; i++) {
      const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u), v = 0.75 + Math.random() * 0.35;
      dirs.push([Math.cos(a) * s * v, u * v, Math.sin(a) * s * v, Math.random() < 0.5 ? c1 : c2]);
    }
    this.scoppi.push({ x: l.x + (Math.random() - 0.5) * 0.8, z: l.z + (Math.random() - 0.5) * 0.8, y: this.mappa.altura(l.x, l.z), t: agoraS, dirs, col: new THREE.Color() });
  }

  passo(ms) {
    const mp = this.mappa, t = ms / 1000;
    if (this.t0 === null) this.t0 = t;
    const dt = Math.min(0.1, t - (this.ultimo ?? t)); this.ultimo = t;
    for (const f of this.fonti ?? []) if (Math.random() < f.rate * dt && this.scoppi.length < 45) this.lancia(f, t);
    this.scoppi = this.scoppi.filter(s => t - s.t < 2.6);
    if (this.scoppi.length || this.fonti?.length || this.frecce.visible) mp.animatori.add(this); else mp.animatori.delete(this);
    if (this.frecce.visible) this.passoFrecce(t);
    this.matF.uniforms.escala.value = innerHeight / (2 * Math.tan(mp.camera.fov * Math.PI / 360));
    // o tamanho da explosão acompanha a distância da câmera: sempre visível, do país ao village green
    const R = Math.max(0.05, Math.min(70, mp.dist * 0.045)), tamF = R * 0.2;
    let k = 0;
    const col = new THREE.Color();
    for (const s of this.scoppi) {
      const tau = t - s.t, salita = 0.65, apice = s.y + R * 1.6;
      if (tau < salita) {
        const p = tau / salita, yy = s.y + (apice - s.y) * (1 - (1 - p) * (1 - p));
        this.aPos.set([s.x, yy, s.z], k * 3); col.set('#FFE7B0').toArray(this.aCor, k * 3); this.aAlfa[k] = 0.9; this.aTam[k] = tamF * 0.8; k++;
        continue;
      }
      const e = tau - salita, esp = 1 - Math.exp(-3.2 * e), caduta = 0.35 * e * e, alfa = Math.max(0, 1 - e / 1.9) * (0.75 + 0.25 * Math.sin(e * 40 + s.x));
      for (const [dx, dy, dz, c] of s.dirs) {
        if (k >= this.cap) break;
        this.aPos.set([s.x + dx * R * esp, apice + dy * R * esp - caduta * R, s.z + dz * R * esp], k * 3);
        col.set(c).toArray(this.aCor, k * 3); this.aAlfa[k] = alfa; this.aTam[k] = tamF; k++;
      }
    }
    for (let i = k; i < (this.kAnt ?? this.cap); i++) this.aAlfa[i] = 0;
    this.kAnt = k;
    const at = this.pts.geometry.attributes;
    at.position.needsUpdate = at.cor.needsUpdate = at.alfa.needsUpdate = at.tam.needsUpdate = true;
    this.pts.geometry.setDrawRange(0, Math.max(k, 1));
  }
}
