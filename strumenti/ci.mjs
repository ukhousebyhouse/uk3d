// Roda no GitHub Actions a cada 10 minutos: monta as configurações a partir dos Secrets,
// pega no servidor o token renovado e as configurações do jogo, atualiza o mapa e publica.
// Secrets: IG_TOKEN, STORIE_URL, FTP_HOST, FTP_USER, FTP_PASSWORD
import fs from 'node:fs';
import path from 'node:path';
import { conectar, pubblicare, CONFIG_GIOCO } from './pubblica.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const arq = (...p) => path.join(RAIZ, ...p);
const env = k => { const v = process.env[k]?.trim(); if (!v) throw new Error(`falta o Secret ${k} no GitHub`); return v; };
const lerJson = (f, padrao) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return padrao; } };

try {
  fs.mkdirSync(arq('dati-grezzi', 'instagram'), { recursive: true });
  fs.writeFileSync(arq('config', 'hostinger.json'), JSON.stringify({ host: env('FTP_HOST'), utente: env('FTP_USER'), password: env('FTP_PASSWORD') }));
  const ftp = conectar();

  // token: o renovado pelo robô (guardado no servidor) vale mais que o do Secret
  let token = env('IG_TOKEN');
  const doServidor = ftp.baixar(`${ftp.priv}ig-token.json`, arq('dati-grezzi', 'ig-token.json')) ? lerJson(arq('dati-grezzi', 'ig-token.json'), {}) : {};
  if (doServidor.token) token = doServidor.token;
  if (doServidor.em) {   // evita renovar de novo se o cache do GitHub foi apagado
    const st = lerJson(arq('dati-grezzi', 'instagram', 'stato.json'), {});
    st.token_em = Math.max(st.token_em ?? 0, doServidor.em);
    fs.writeFileSync(arq('dati-grezzi', 'instagram', 'stato.json'), JSON.stringify(st));
  }
  const gioco = lerJson(arq('config', 'gioco.json'), {});
  // api e ig_id (Unified login) vêm do gioco.json do repositório: não são segredo
  fs.writeFileSync(arq('config', 'instagram.json'), JSON.stringify({ token, inizio: gioco.inizio, versione: gioco.versione ?? 'v25.0', ...(gioco.api && { api: gioco.api }), ...(gioco.ig_id && { ig_id: gioco.ig_id }), webhook_storie: env('STORIE_URL') }));

  // correções, moderação, pontos em dobro e stories manuais feitas no PC (amministra.mjs envia para o servidor)
  const baixadas = CONFIG_GIOCO.filter(n => ftp.baixar(`${ftp.priv}config-gioco/${n}`, arq('config', n)));
  console.log(`configurações do jogo do servidor: ${baixadas.join(', ') || 'nenhuma (usando as do repositório)'}`);

  // lojas e outdoors pagos (Stripe): aprova sozinho e já entram nesta atualização (o dono pode tirar com "amministra rimuovi")
  try {
    const { approvaPagati } = await import('./negozi.mjs'), { Risolutore } = await import('./risolutore.mjs');
    const n = approvaPagati({ ftp, comuni: new Risolutore().comuni });
    if (n) console.log(`${n} loja(s)/outdoor(s) pago(s) aprovado(s) automaticamente`);
  } catch (e) { console.log(`aviso: aprovação automática das lojas falhou (${e.message})`); }

  const { aggiornare } = await import('./aggiorna.mjs');
  await aggiornare({ completo: process.argv.includes('--completo') });
  pubblicare();

  // token renovado nesta execução: guarda no servidor para as próximas
  const novo = lerJson(arq('config', 'instagram.json'), {}).token;
  if (novo && novo !== token) {
    fs.writeFileSync(arq('dati-grezzi', 'ig-token.json'), JSON.stringify({ token: novo, em: Date.now() }));
    ftp.enviar([{ local: arq('dati-grezzi', 'ig-token.json'), remoto: `${ftp.priv}ig-token.json` }]);
    console.log('token renovado guardado no servidor');
  }
} catch (e) {
  console.error(`ERRO: ${e.message}`);
  process.exit(1);
}
