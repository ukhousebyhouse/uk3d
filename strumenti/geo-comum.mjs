// Projeção usada em todo o projeto: sinusoidal centrada no Reino Unido, em km.
// (a equiretangular da Itália deformava ±12% entre a Cornualha e Shetland; a sinusoidal mantém a forma)
// x cresce para leste, z cresce para sul (norte = -z, como no three.js visto de cima).
export const PROJ = { tipo: 'sinusoidale', LON0: -3.2, LAT0: 55.0, KM: 111.32, KZ: 110.57 };
export const BBOX = { x0: -470, x1: 340, z0: -665, z1: 577 };
const RAD = Math.PI / 180;
export const proj = (lon, lat) => [(lon - PROJ.LON0) * PROJ.KM * Math.cos(lat * RAD), (PROJ.LAT0 - lat) * PROJ.KZ];
export const desproj = (x, z) => { const lat = PROJ.LAT0 - z / PROJ.KZ; return [x / (PROJ.KM * Math.cos(lat * RAD)) + PROJ.LON0, lat]; };
