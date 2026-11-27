// Natal: neve nos telhados e neve caindo.
// conNeve(mat): cópia do material em que toda face virada para cima (telhado, topo de muro, copa de árvore, piazza)
// fica branca — funciona com qualquer modelo de casa, sem geometria nova.
// Nevicata: flocos caindo numa caixa em volta da câmera, só quando ela está perto do chão (cidades e passeggiata).
import * as THREE from 'three';

export function conNeve(mat, forza = 0.92) {
  const m = mat.clone();
  m.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vNeveY;')
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
  {
    vec3 nn = objectNormal;
    #ifdef USE_INSTANCING
      nn = mat3(instanceMatrix) * nn;
    #endif
    vNeveY = normalize(mat3(modelMatrix) * nn).y;
  }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vNeveY;')
      .replace('#include <color_fragment>', `#include <color_fragment>
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.95, 0.97, 1.0), smoothstep(0.45, 0.75, vNeveY) * ${forza.toFixed(2)});`);
  };
  m.customProgramCacheKey = () => `neve${forza}`;
  return m;
}

function texturaFiocco() {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.85)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

export class Nevicata {
  constructor(mappa, n = 2400) {
    this.mappa = mappa;
    const pos = new Float32Array(n * 3);
    this.vel = new Float32Array(n);
    this.fase = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = Math.random() * 2 - 1; pos[i * 3 + 1] = Math.random() * 2 - 1; pos[i * 3 + 2] = Math.random() * 2 - 1;
      this.vel[i] = 0.22 + Math.random() * 0.18; this.fase[i] = Math.random() * 6.28;
    }
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.mat = new THREE.PointsMaterial({ map: texturaFiocco(), size: 0.004, transparent: true, depthWrite: false, opacity: 0.9 });
    this.punti = new THREE.Points(this.geo, this.mat);
    this.punti.frustumCulled = false;
    this.punti.visible = false;
    mappa.scene.add(this.punti);
    this.t0 = 0;
    mappa.aoFrame.push(t => this.passo(t));
    mappa.aoMover?.push(() => this.ligar());
    this.ligar();
  }

  // altura da câmera sobre o chão (km): perto do chão = neve visível
  altura() { const c = this.mappa.camera.position; return c.y - this.mappa.altura(c.x, c.z); }

  ligar() {
    const perto = this.altura() < 4;
    if (perto) this.mappa.animatori.add(this); else this.mappa.animatori.delete(this);
    if (!perto && this.punti.visible) { this.punti.visible = false; this.mappa.sujo = true; }
  }

  passo(t) {
    const h = this.altura();
    if (h >= 4) { this.punti.visible = false; return; }
    const dt = Math.min(0.1, this.t0 ? (t - this.t0) / 1000 : 0); this.t0 = t;
    const s = Math.min(1.5, Math.max(0.03, h * 0.9));   // meia largura da caixa de flocos
    const c = this.mappa.camera.position;
    this.punti.position.copy(c);
    this.punti.scale.setScalar(s);
    this.mat.size = s * 0.02;
    const p = this.geo.attributes.position.array;
    for (let i = 0; i < this.vel.length; i++) {
      let y = p[i * 3 + 1] - this.vel[i] * dt;
      if (y < -1) y += 2;
      p[i * 3 + 1] = y;
      p[i * 3] += Math.sin(t / 900 + this.fase[i]) * 0.06 * dt;
      if (p[i * 3] > 1) p[i * 3] -= 2; else if (p[i * 3] < -1) p[i * 3] += 2;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.punti.visible = true;
  }
}
