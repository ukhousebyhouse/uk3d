// Música ambiente britânica gerada no navegador (Web Audio): nenhum arquivo de áudio, só este código.
// Dança de village green original em ré maior (6/8): rabeca (fiddle) + tin whistle + violão no "pá" + baixo.
// 1ª volta: a rabeca canta e o whistle dobra as notas longas; 2ª volta: o whistle canta uma oitava acima e a rabeca acompanha.
// Ao entrar: "rounds" de sinos de igreja (change ringing inglês, 6 sinos descendo a escala).
// O AudioContext vem pronto de fora: precisa nascer dentro do toque da pessoa (regra do iPhone/Chrome).

const BPM = 108, CROMA = 60 / BPM / 3;   // 6/8: 108 semínimas pontuadas por minuto; colcheia em segundos (compasso = 6 colcheias)
const hz = m => 440 * 2 ** ((m - 69) / 12);

// acordes por compasso: [baixo, quinta, acorde]
const AC = {
  D: [50, 57, [62, 66, 69]], G: [43, 50, [62, 67, 71]], A: [45, 52, [61, 64, 69]], A7: [45, 52, [61, 64, 67]], Bm: [47, 54, [62, 66, 71]],
};
const HARM = ['D', 'D', 'G', 'A', 'D', 'G', 'A', 'D', 'Bm', 'Bm', 'G', 'A', 'G', 'D', 'A7', 'D'];
// melodia: [nota MIDI, colcheias] (cada compasso soma 6)
const MEL = [
  [[66, 2], [69, 1], [74, 2], [73, 1]], [[74, 1], [73, 1], [71, 1], [69, 3]],
  [[71, 2], [74, 1], [79, 2], [78, 1]], [[76, 3], [73, 2], [69, 1]],
  [[66, 2], [69, 1], [74, 2], [76, 1]], [[78, 1], [76, 1], [74, 1], [71, 2], [74, 1]],
  [[73, 2], [71, 1], [69, 2], [64, 1]], [[62, 3], [62, 2], [69, 1]],
  [[71, 2], [74, 1], [78, 2], [74, 1]], [[78, 1], [79, 1], [78, 1], [76, 3]],
  [[74, 2], [71, 1], [67, 2], [71, 1]], [[73, 2], [76, 1], [81, 3]],
  [[79, 2], [78, 1], [76, 2], [74, 1]], [[78, 2], [74, 1], [69, 2], [66, 1]],
  [[67, 2], [69, 1], [73, 2], [76, 1]], [[74, 4], [69, 2]],
];

export class Musica {
  constructor(ctx) {
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 3;
    this.master.connect(comp).connect(ctx.destination);
    // reverb curto (ruído que decai): o "ar" de um salão de vila
    this.seco = ctx.createGain();
    const rev = ctx.createConvolver(), molhado = ctx.createGain();
    rev.buffer = this.impulso(1.6);
    molhado.gain.value = 0.24;
    this.seco.connect(this.master);
    this.seco.connect(rev).connect(molhado).connect(this.master);
    this.ruido = this.bufRuido(0.3);
    this.compasso = 0; this.prox = 0; this.timer = null; this.ligada = false;
  }

  impulso(seg) {
    const sr = this.ctx.sampleRate, n = Math.floor(sr * seg), b = this.ctx.createBuffer(2, n, sr);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 3;
    }
    return b;
  }
  bufRuido(seg) {
    const sr = this.ctx.sampleRate, n = Math.floor(sr * seg), b = this.ctx.createBuffer(1, n, sr), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  // ---------- instrumentos ----------
  // rabeca: 2 serras levemente desafinadas, filtro de corpo de madeira, arco que entra suave e vibrato que chega depois
  violino(m, t, dur, vel = 1) {
    const c = this.ctx, g = c.createGain(), f = c.createBiquadFilter(), f2 = c.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 3200; f.Q.value = 0.8;
    f2.type = 'peaking'; f2.frequency.value = 1100; f2.gain.value = 5; f2.Q.value = 1.2;
    const pico = 0.075 * vel;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(pico, t + 0.035);
    g.gain.setValueAtTime(pico * 0.85, t + Math.max(0.05, dur - 0.06));
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    const lfo = c.createOscillator(), lg = c.createGain();
    lfo.frequency.value = 5.8; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(dur > 0.35 ? 12 : 4, t + Math.min(0.3, dur));
    lfo.connect(lg); lfo.start(t); lfo.stop(t + dur + 0.05);
    for (const det of [-5, 5]) {
      const o = c.createOscillator();
      o.type = 'sawtooth'; o.frequency.value = hz(m); o.detune.value = det;
      lg.connect(o.detune);
      o.connect(f); o.start(t); o.stop(t + dur + 0.05);
    }
    f.connect(f2).connect(g).connect(this.seco);
  }
  // tin whistle: seno puro com um pouco de triângulo + "sopro" (ruído filtrado no ataque)
  fischietto(m, t, dur, vel = 1) {
    const c = this.ctx, g = c.createGain();
    const pico = 0.11 * vel;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(pico, t + 0.02);
    g.gain.setValueAtTime(pico * 0.9, t + Math.max(0.03, dur - 0.05));
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    const lfo = c.createOscillator(), lg = c.createGain();
    lfo.frequency.value = 5.2; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(dur > 0.4 ? 9 : 0, t + Math.min(0.35, dur));
    lfo.connect(lg); lfo.start(t); lfo.stop(t + dur + 0.05);
    for (const [tipo, mult, gv] of [['sine', 1, 1], ['triangle', 2, 0.12]]) {
      const o = c.createOscillator(), og = c.createGain();
      o.type = tipo; o.frequency.value = hz(m) * mult; og.gain.value = gv;
      lg.connect(o.detune);
      o.connect(og).connect(g); o.start(t); o.stop(t + dur + 0.05);
    }
    // "chiff" do sopro
    const r = c.createBufferSource(), rf = c.createBiquadFilter(), rg = c.createGain();
    r.buffer = this.ruido; rf.type = 'bandpass'; rf.frequency.value = hz(m) * 2; rf.Q.value = 4;
    rg.gain.setValueAtTime(0.05 * vel, t); rg.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    r.connect(rf).connect(rg).connect(this.seco); r.start(t); r.stop(t + 0.08);
    g.connect(this.seco);
  }
  // violão: cordas dedilhadas (triângulo + serra com filtro que fecha), acorde levemente arpejado
  chitarra(notas, t, vel = 1) {
    const c = this.ctx;
    notas.forEach((m, k) => {
      const s = t + k * 0.012, g = c.createGain(), f = c.createBiquadFilter();
      f.type = 'lowpass'; f.Q.value = 0.7;
      f.frequency.setValueAtTime(2600, s); f.frequency.exponentialRampToValueAtTime(700, s + 0.25);
      g.gain.setValueAtTime(0.0001, s);
      g.gain.exponentialRampToValueAtTime(0.05 * vel, s + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, s + 0.45);
      for (const tipo of ['triangle', 'sawtooth']) {
        const o = c.createOscillator();
        o.type = tipo; o.frequency.value = hz(m);
        o.connect(f); o.start(s); o.stop(s + 0.5);
      }
      f.connect(g).connect(this.seco);
    });
  }
  basso(m, t, dur) {
    const c = this.ctx, g = c.createGain(), o = c.createOscillator(), o2 = c.createOscillator();
    o.type = 'triangle'; o.frequency.value = hz(m);
    o2.type = 'sine'; o2.frequency.value = hz(m) / 2;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.3, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); o2.connect(g); g.connect(this.seco);
    for (const x of [o, o2]) { x.start(t); x.stop(t + dur + 0.05); }
  }
  // sino de igreja (parciais fora da série harmônica)
  sino(t, m, vol = 1) {
    const c = this.ctx;
    for (const [r, a, d] of [[0.5, 0.5, 3.6], [1, 0.4, 2.8], [1.19, 0.25, 2.2], [1.5, 0.2, 1.8], [2, 0.18, 1.4], [2.74, 0.1, 1.1], [3.76, 0.06, 0.8]]) {
      const o = c.createOscillator(), g = c.createGain();
      o.frequency.value = hz(m) * r;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.14 * a * vol, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g).connect(this.seco); o.start(t); o.stop(t + d + 0.05);
    }
  }
  // "rounds": 6 sinos da torre tocando do mais agudo (treble) ao mais grave (tenor), duas vezes — o som de domingo numa vila inglesa
  campana(t = this.ctx.currentTime + 0.02) {
    const torre = [74, 73, 71, 69, 67, 66];
    for (let volta = 0; volta < 2; volta++) torre.forEach((m, k) => this.sino(t + (volta * 7 + k) * 0.21, m, k === 5 ? 1.2 : 0.9));
  }

  // ---------- partitura ----------
  tocarCompasso(n, t) {
    const i = n % 16, volta = Math.floor(n / 16) % 2, [b, quinta, acc] = AC[HARM[i]];
    // 6/8: baixo no 1 e no 4 (tônica e quinta), violão no 3 e no 6
    this.basso(b, t, CROMA * 1.8);
    this.basso(quinta, t + CROMA * 3, CROMA * 1.8);
    this.chitarra(acc, t + CROMA * 2, 0.9);
    this.chitarra(acc, t + CROMA * 5, 0.8);
    let s = t;
    for (const [m, d] of MEL[i]) {
      const dur = d * CROMA;
      if (volta === 0) {
        this.violino(m, s, dur * 0.95, 1.3);
        if (d >= 3) this.fischietto(m + 12, s, dur * 0.9, 0.45);
      } else {
        this.fischietto(m + 12, s, dur * 0.92, 1);
        this.violino(m, s, dur * 0.95, 0.55);
      }
      s += dur;
    }
  }
  agendar() {
    const ate = this.ctx.currentTime + 0.35;
    while (this.prox < ate) {
      this.tocarCompasso(this.compasso++, this.prox);
      this.prox += CROMA * 6;
    }
  }

  // ---------- controle ----------
  avvia(volume = 0.6, atraso = 0.6) {
    if (this.ligada) return;
    this.ligada = true;
    const t = this.ctx.currentTime;
    this.prox = Math.max(this.prox, t + atraso);
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(this.master.gain.value, t);
    this.master.gain.linearRampToValueAtTime(volume, t + 1.5);
    this.agendar();
    this.timer = setInterval(() => this.agendar(), 120);
  }
  volume(v, seg = 2) {
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(this.master.gain.value, t);
    this.master.gain.linearRampToValueAtTime(v, t + seg);
  }
  ferma(seg = 0.8) {
    if (!this.ligada) return;
    this.ligada = false;
    this.volume(0, seg);
    clearInterval(this.timer);
    // o que já foi agendado termina em silêncio; a próxima volta recomeça do início do compasso seguinte
    this.prox = this.ctx.currentTime + seg + 0.1;
  }
}
