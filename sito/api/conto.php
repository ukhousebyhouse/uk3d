<?php
// Conta do site (js/conto.js). POST JSON {a: ação, ...}. Sessão por cookie httpOnly (ukhh_s).
//   codice {email}           manda o código de 6 dígitos por e-mail (vale 30 min; até 3 valem juntos)
//   entra {email, codice}    confere o código, cria a conta se for nova e abre a sessão
//   io                       dados da conta (confere sozinho se o @ já foi confirmado)
//   premio                   prêmio do dia: 2 💰 (+20 no 7º dia seguido, +100 no 30º); precisa de @ confirmado com casa
//   collega {conta}          pede o código HOUSE-1234 para ligar o @ (comentar num post; o robô confere)
//   scollega                 desiste do @ pendente
//   ricarica {pacco}         abre a página de pagamento da Stripe (só com crediti.json ricarica_aperta e dentro do limite mensal)
//   esci                     fecha a sessão
//   esci_tutti               fecha TODAS as sessões da conta (também pelo link GET ?esci_tutti=<token> do e-mail de acesso novo)
// Segurança: e-mail a cada acesso novo (conta já existente), recibo por e-mail a cada recarga/reembolso (_conti.php).
declare(strict_types=1);
require __DIR__ . '/_conti.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
function resposta(array $d, int $c = 200): void { http_response_code($c); echo json_encode(['ok' => true] + $d, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); exit; }
function erro(string $msg, int $c = 400, array $extra = []): void { http_response_code($c); echo json_encode(['ok' => false, 'erro' => $msg] + $extra, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); exit; }
// responde já e só depois faz o trabalho lento (e-mail), para a pessoa não esperar o SMTP
function resposta_e_poi(array $d, callable $dopo): void {
    ignore_user_abort(true);
    echo json_encode(['ok' => true] + $d, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if (function_exists('litespeed_finish_request')) litespeed_finish_request();
    elseif (function_exists('fastcgi_finish_request')) fastcgi_finish_request();
    else flush();
    $dopo();
    exit;
}

// link do e-mail «Wasn't you?»: sai de todos os dispositivos (GET, página simples)
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['esci_tutti'])) {
    header('Content-Type: text/html; charset=utf-8');
    $tok = (string)$_GET['esci_tutti'];
    $id = substr($tok, 0, 16);
    $u = preg_match('/^[0-9a-f]{16}\.[0-9a-f]{24}$/', $tok) ? conti_leggi($id) : null;
    $ok = $u && hash_equals(conti_token_revoca($id, (int)($u['gen'] ?? 0)), $tok);
    if ($ok) conti_revoca_tutti($id);
    $msg = $ok ? '✅ Done: your account has been logged out on every device.<br>To get back in you need a new code, which only goes to your email.'
               : 'This link has already been used or isn’t valid any more: if you’ve already tapped it, your devices are already logged out.';
    echo '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Account · UK House by House</title>'
        . '<body style="margin:0;background:#8EBFD2;font-family:system-ui,sans-serif;color:#152033"><main style="max-width:480px;margin:40px auto;background:#fff;border:4px solid #152033;border-radius:24px;padding:24px;font-weight:700;line-height:1.5">'
        . "<h1 style=\"font-size:22px\">🔒 Account security</h1><p>$msg</p><p><a href=\"/#conto\" style=\"color:#152033\">Back to the map</a></p></main>";
    exit;
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST' || !str_contains((string)($_SERVER['CONTENT_TYPE'] ?? ''), 'json')) erro('Invalid method.', 405);

$ip = (string)($_SERVER['REMOTE_ADDR'] ?? '');
if (!conti_limite("ip|$ip", 240, 3600)) erro('Too many requests. Please try again in a bit.', 429);
$d = json_decode((string)file_get_contents('php://input', false, null, 0, 4000), true);
if (!is_array($d)) erro('Invalid request.');
$acao = (string)($d['a'] ?? '');
$cfg = conti_cfg();

// o que o navegador vê da conta
function profilo(array $u): array {
    $cfg = conti_cfg(); $oggi = conti_oggi();
    $serie = $u['serie'] ?? ['n' => 0, 'ultimo' => null];
    $viva = in_array($serie['ultimo'] ?? '', [$oggi, conti_ieri($oggi)], true) ? (int)$serie['n'] : 0;
    return [
        'email' => conti_maschera((string)$u['email']),
        'conta' => $u['conta'] ?? null,
        'attesa' => isset($u['attesa']) ? ['conta' => $u['attesa']['conta'], 'codice' => $u['attesa']['codice']] : null,
        'saldo' => (int)($u['saldo'] ?? 0),
        'serie' => $viva,
        'premio_oggi' => ($serie['ultimo'] ?? '') === $oggi,
        'ultimi' => array_slice((array)($u['ultimi'] ?? []), 0, 10),
        'pg' => $u['pg'] ?? null,
        'oggetti' => array_values((array)($u['oggetti'] ?? [])),
        'ricarica' => (bool)($cfg['ricarica_aperta'] ?? false),
        'prima_ricarica' => !empty($cfg['ricarica_aperta']) && empty($u['proprietario']) && conti_prima_ricarica(conti_id((string)$u['email'])),
        'proprietario' => !empty($u['proprietario']),
        'deco_prova' => !empty($u['proprietario']) ? (object)($u['deco_prova'] ?? []) : null,
        'tesori' => (($u['tesori']['giorno'] ?? '') === $oggi) ? array_values((array)$u['tesori']['presi']) : [],
    ];
}
// @ pendente já confirmado pelo robô? liga na conta
function conferma_attesa(string $id): ?array {
    $u = conti_leggi($id);
    if (!$u) return null;
    $at = $u['attesa'] ?? null;
    if ($at && conti_vincolato((string)$at['conta'], $id)) {
        conti_assegna_conta((string)$at['conta'], $id);
        $u = conti_modifica($id, function (array &$u) use ($at) { $u['conta'] = $at['conta']; unset($u['attesa']); return $u; });
    }
    return $u;
}

// ---------- sem sessão ----------
// contador do funil da recarga: apre (abriu a recarga; da = de onde) · pacco (tocou num pacote) · annulla (desistiu no aviso)
if ($acao === 'traccia') {
    if (!conti_limite("traccia|$ip", 120, 3600)) resposta(['ok' => true]);
    $ev = (string)($d['ev'] ?? '');
    if (in_array($ev, ['apre', 'pacco', 'annulla'], true)) conti_traccia($ev, (string)($d['pacco'] ?? ''), (string)($d['da'] ?? ''), conti_sessione_id() ?? '');
    resposta(['ok' => true]);
}
if ($acao === 'codice') {
    $email = strtolower(trim((string)($d['email'] ?? '')));
    if (!conti_email_ok($email)) erro('Please type a valid email.');
    if (conti_e_proprietario($email)) resposta(['inviato' => true]);   // dono: código fixo, nenhum e-mail (não gasta o limite do dia)
    // nos picos dos reels o e-mail atrasa; a pessoa pedia de novo e o código novo ANULAVA o anterior.
    // Agora: até 3 códigos valem juntos por 30 min; pedir de novo em menos de 60 s não manda outro e-mail.
    $id = conti_id($email);
    $arq = conti_dir('codici') . "/$id.json";
    $c = json_decode((string)@file_get_contents($arq), true) ?: [];
    $lista = array_values(array_filter((array)($c['codici'] ?? []), fn($x) => (int)($x['scade'] ?? 0) > time()));
    if ($lista && time() - (int)($c['ultimo'] ?? 0) < 60) resposta(['inviato' => true, 'gia' => true]);
    // limites por pessoa e por conexão (no celular muita gente divide o mesmo IP); o do dia só segura abuso grande
    if (!conti_limite("email|$email", 6, 3600) || !conti_limite("cod-ip|$ip", 60, 3600)) erro('You’ve asked for too many codes. Please try again in an hour.', 429);
    if (!conti_limite('email-giorno', (int)($cfg['email_giorno_max'] ?? 3000), 86400)) erro('Too many requests right now. Please try again in a few hours.', 503);
    $cod = (string)random_int(100000, 999999);
    $lista[] = ['h' => hash('sha256', $cod . '|' . $id . '|' . APP_SECRET), 'scade' => time() + 1800];
    $novo = ['codici' => array_slice($lista, -3), 'ultimo' => time(), 'tent' => (int)($c['tent'] ?? 0)];
    file_put_contents($arq, json_encode($novo), LOCK_EX);
    $corpo = "Hi!\n\nYour code to sign in to UK House by House is:\n\n    $cod\n\nIt works for 30 minutes. If you didn't ask for it, just ignore this email: nobody can get in without the code.\n\nUK House by House\nhttps://ukhousebyhouse.com";
    // no PC (localhost): nunca manda e-mail, devolve o código na resposta para testar
    if (conti_locale()) resposta(['inviato' => true, 'dev_codice' => $cod]);
    [$ok, $info] = conti_smtp($email, "Your code: $cod", $corpo);
    if (!$ok) {
        error_log("conto codice: $info");
        $novo['codici'] = array_slice($novo['codici'], 0, -1); $novo['ultimo'] = 0;   // não ficou valendo: pode pedir de novo já
        file_put_contents($arq, json_encode($novo), LOCK_EX);
        erro('We can’t send the email right now. Please try again in a minute.', 503);
    }
    resposta(['inviato' => true]);
}

if ($acao === 'entra') {
    $email = strtolower(trim((string)($d['email'] ?? '')));
    $cod = preg_replace('/\D/', '', (string)($d['codice'] ?? ''));
    if (!conti_email_ok($email) || strlen($cod) !== 6) erro('Invalid code.');
    $id = conti_id($email);
    if (conti_e_proprietario($email)) {
        if (!conti_limite("prop-ip|$ip", 10, 3600) || !conti_limite('prop', 40, 3600)) erro('Too many tries. Please try again in an hour.', 429);
        if (!password_verify($cod, conti_proprietario()['hash'])) erro('Wrong code. Check your email and try again.');
        $gen = conti_modifica($id, function (array &$u) {
            $u['proprietario'] = true; $u['ultimo_accesso'] = gmdate('c');
            if ((int)($u['saldo'] ?? 0) < 500000) conti_movimento($u, 1000000 - (int)($u['saldo'] ?? 0), 'regalo', 'owner test credits');
            return (int)($u['gen'] ?? 0);
        }, $email);
        conti_sessione_crea($id, $gen);
        resposta(['nuovo' => false, 'profilo' => profilo(conti_leggi($id))]);
    }
    $arq = conti_dir('codici') . "/$id.json";
    $c = json_decode((string)@file_get_contents($arq), true);
    $lista = is_array($c) ? array_values(array_filter((array)($c['codici'] ?? []), fn($x) => (int)($x['scade'] ?? 0) > time())) : [];
    if (!$lista) { @unlink($arq); erro('That code has expired. Ask for a new one.'); }
    $hc = hash('sha256', $cod . '|' . $id . '|' . APP_SECRET);
    $certo = false; foreach ($lista as $x) if (hash_equals((string)$x['h'], $hc)) $certo = true;   // vale qualquer um dos últimos códigos
    if (!$certo) {
        $c['tent'] = (int)($c['tent'] ?? 0) + 1;
        if ($c['tent'] >= 8) { @unlink($arq); erro('Too many tries. Ask for a new code.'); }
        file_put_contents($arq, json_encode($c), LOCK_EX);
        erro('Wrong code. Use the code from the latest email and try again.');
    }
    @unlink($arq);
    $nuovo = !conti_leggi($id);
    $gen = conti_modifica($id, function (array &$u) { $u['ultimo_accesso'] = gmdate('c'); return (int)($u['gen'] ?? 0); }, $email);
    conti_sessione_crea($id, $gen);
    $uu = conferma_attesa($id);
    $prof = profilo($uu);
    if ($nuovo) resposta(['nuovo' => true, 'profilo' => $prof]);
    // aviso de acesso novo só para contas com algo a proteger (compras ou crediti): nos picos, metade dos e-mails era este
    if (empty($uu['oggetti']) && (int)($uu['saldo'] ?? 0) < 100) resposta(['nuovo' => false, 'profilo' => $prof]);
    // conta que já existia: avisa por e-mail do acesso novo, com o link para sair de todos os dispositivos
    resposta_e_poi(['nuovo' => false, 'profilo' => $prof], function () use ($email, $id, $gen) {
        $link = 'https://ukhousebyhouse.com/api/conto.php?esci_tutti=' . conti_token_revoca($id, $gen);
        $corpo = "Hi!\n\nThere's been a new sign-in to your UK House by House account:\n\n"
            . "• When: " . conti_ora_uk() . " (UK time)\n• Device: " . conti_dispositivo() . "\n\n"
            . "If it was you, you don't need to do anything.\n\n"
            . "Don't recognise it? Tap here to log out on every device:\n$link\n\n"
            . "Without the code that comes to this email, nobody can get into your account.\n\nUK House by House\nhttps://ukhousebyhouse.com";
        conti_smtp($email, 'New sign-in to your account', $corpo);
    });
}

// ---------- com sessão ----------
$id = conti_sessione_id();
if ($acao === 'io' && !$id) resposta(['profilo' => null]);
if (!$id) erro('Sign in to your account to carry on.', 401, ['uscito' => true]);
$u = conferma_attesa($id);
if (!$u) { conti_sessione_chiudi(); erro('Account not found. Please sign in again.', 401, ['uscito' => true]); }

if ($acao === 'io') resposta(['profilo' => profilo($u)]);

if ($acao === 'esci') { conti_sessione_chiudi(); resposta([]); }

if ($acao === 'esci_tutti') { conti_revoca_tutti($id); conti_sessione_chiudi(); resposta([]); }

if ($acao === 'collega') {
    $conta = strtolower(ltrim(trim((string)($d['conta'] ?? '')), '@'));
    if (!preg_match('/^[a-z0-9._]{1,30}$/', $conta)) erro('Type your Instagram name, with no spaces.');
    if (!conti_tem_casa($conta)) erro("@$conta hasn't got a house on the map yet. Comment your town under one of our posts to get one, then come back here.");
    if (($u['conta'] ?? null) === $conta) resposta(['profilo' => profilo($u)]);
    // dono: usa qualquer casa para testar, na hora, SEM tirar o @ do jogador (não mexe em conte.json)
    if (!empty($u['proprietario'])) resposta(['profilo' => profilo(conti_modifica($id, function (array &$u) use ($conta) { $u['conta'] = $conta; unset($u['attesa']); return $u; }))]);
    $cod = conti_codice_collega($conta, $id);
    $u = conti_modifica($id, function (array &$u) use ($conta, $cod) { $u['attesa'] = ['conta' => $conta, 'codice' => $cod, 'em' => gmdate('c')]; return $u; });
    resposta(['profilo' => profilo(conferma_attesa($id) ?? $u)]);
}

// personagem da passeggiata (opções grátis iguais às de js/personaggio.js OPZ; itens pagos da loja)
if ($acao === 'personaggio') {
    $p = is_array($d['pg'] ?? null) ? $d['pg'] : [];
    $c = (string)($p['c'] ?? '');
    $CAP = ['uomo' => ['corti', 'ciuffo', 'ricci', 'rasati', 'calvo'], 'donna' => ['lunghi', 'coda', 'caschetto', 'ricci', 'chignon']];
    if (!isset($CAP[$c])) erro('Pick Man or Woman.');
    $n = fn($k, $max) => (is_int($p[$k] ?? null) && $p[$k] >= 0 && $p[$k] < $max) ? $p[$k] : 0;
    $pg = ['c' => $c, 'pelle' => $n('pelle', 5), 'capelli' => in_array($p['capelli'] ?? '', $CAP[$c], true) ? $p['capelli'] : $CAP[$c][0],
        'colCap' => $n('colCap', 6), 'maglia' => $n('maglia', 8), 'pant' => $n('pant', 8), 'gonna' => $c === 'donna' && !empty($p['gonna'])];
    // itens pagos vestidos: só os que a conta comprou (pg_<id>); 1 chapéu e 1 roupa especial de cada vez
    $own = (array)($u['oggetti'] ?? []);
    $acc = array_values(array_filter(array_unique(array_map('strval', (array)($p['acc'] ?? []))), fn($a) => in_array("pg_$a", $own, true)));
    $GRUPPI = [['cappello', 'borsalino', 'natale'], ['tifoso', 'elegante', 'carnevale', 'natale']];
    foreach ($GRUPPI as $gr) { $dentro = array_values(array_intersect($acc, $gr)); if (count($dentro) > 1) $acc = array_values(array_diff($acc, array_slice($dentro, 1))); }
    if ($acc) $pg['acc'] = array_slice($acc, 0, 6);
    if (in_array('tifoso', $acc, true)) $pg['squadra'] = $n('squadra', 9);
    $u = conti_modifica($id, function (array &$u) use ($pg) { $u['pg'] = $pg; return $u; });
    resposta(['profilo' => profilo($u)]);
}

// loja: compra com créditos (preço do servidor, recibo por e-mail)
if ($acao === 'compra') {
    if ((int)$u['saldo'] < 0) erro('Your balance is negative after a refund: top up to buy things again.');
    [$nuovo, $e] = conti_compra($id, (string)($d['item'] ?? ''));
    if ($e) erro($e);
    resposta(['profilo' => profilo($nuovo)]);
}

// decoração de fora (própria casa grátis com "your home"; presente 490/990 💰), para sempre, sem pontos
if ($acao === 'decora') {
    if ((int)$u['saldo'] < 0) erro('Your balance is negative after a refund: top up to buy things again.');
    if (!conti_limite("decora|$id", 40, 3600)) erro('Too many changes. Please try again in a bit.', 429);
    [$nuovo, $e] = conti_decora($id, strtolower(ltrim(trim((string)($d['conta'] ?? '')), '@')), (string)($d['squadra'] ?? ''), (array)($d['extra'] ?? []), (string)($d['modello'] ?? ''));
    if ($e) erro($e);
    resposta(['profilo' => profilo($nuovo)]);
}

if ($acao === 'scollega') {
    $u = conti_modifica($id, function (array &$u) { unset($u['attesa']); return $u; });
    resposta(['profilo' => profilo($u)]);
}

if ($acao === 'premio') {
    if (!empty($u['proprietario'])) erro('Owner account: the daily reward is for the players.');
    $conta = (string)($u['conta'] ?? '');
    if ($conta === '') erro('Link your Instagram first to get your daily credits.');
    if (!conti_tem_casa($conta)) erro("@$conta hasn't got a house on the map any more.");
    $oggi = conti_oggi();
    // um prêmio por @ por dia, mesmo trocando de conta
    $arqDia = conti_dir() . "/premi-$oggi.txt";
    $f = fopen($arqDia, 'c+');
    if (!$f || !flock($f, LOCK_EX)) erro('Please try again in a moment.', 503);
    $ja = str_contains("\n" . stream_get_contents($f), "\n$conta\n");
    $r = null;
    if (!$ja) {
        $r = conti_modifica($id, function (array &$u) use ($oggi, $cfg, $conta) {
            $s = $u['serie'] ?? ['n' => 0, 'ultimo' => null];
            if (($s['ultimo'] ?? '') === $oggi) return null;
            $n = ($s['ultimo'] ?? '') === conti_ieri($oggi) ? (int)$s['n'] + 1 : 1;
            $g = $cfg['giornaliero'] ?? ['base' => 2, 'serie' => []];
            $bonus = 0;
            foreach ((array)($g['serie'] ?? []) as [$ogni, $extra]) if ($n % (int)$ogni === 0) { $bonus = (int)$extra; break; }
            $u['serie'] = ['n' => $n, 'ultimo' => $oggi];
            conti_movimento($u, (int)$g['base'] + $bonus, $bonus ? 'serie' : 'giornaliero', "$conta $oggi");
            return ['crediti' => (int)$g['base'] + $bonus, 'bonus' => $bonus, 'serie' => $n];
        });
        if ($r) fwrite($f, "$conta\n");
    }
    flock($f, LOCK_UN); fclose($f);
    if (mt_rand(1, 20) === 1) foreach (glob(conti_dir() . '/premi-*.txt') ?: [] as $v) if (filemtime($v) < time() - 5 * 86400) @unlink($v);
    resposta(['premio' => $r, 'profilo' => profilo(conti_leggi($id))]);
}

// treasure hunt (passeggiata): 1 baú por cidade por dia + 1 na frente de cada loja; no máximo N por dia (crediti.json "tesori")
if ($acao === 'tesoro') {
    $conta = (string)($u['conta'] ?? '');
    if ($conta === '') erro('Link your Instagram first to collect treasure.');
    if (!conti_limite("tesoro|$id", 30, 3600)) erro('Too much treasure too quickly. Please try again later.', 429);
    $T = $cfg['tesori'] ?? ['citta' => 2, 'negozio' => 3, 'max' => 5];
    $tipo = (string)($d['tipo'] ?? ''); $rif = (string)($d['id'] ?? '');
    if ($tipo === 'citta' && preg_match('/^\d{1,8}$/', $rif)) $k = "c$rif";
    elseif ($tipo === 'negozio' && preg_match('/^[a-z0-9-]{4,40}$/i', $rif)) $k = "n$rif";
    else erro('Invalid treasure.');
    $val = (int)($T[$tipo] ?? 2); $max = (int)($T['max'] ?? 5); $oggi = conti_oggi();
    $r = conti_modifica($id, function (array &$u) use ($k, $val, $max, $oggi) {
        $t = $u['tesori'] ?? [];
        if (($t['giorno'] ?? '') !== $oggi) $t = ['giorno' => $oggi, 'presi' => []];
        if (in_array($k, $t['presi'], true)) return ['gia' => true, 'n' => count($t['presi'])];
        if (count($t['presi']) >= $max) return ['pieno' => true, 'n' => count($t['presi'])];
        $t['presi'][] = $k; $u['tesori'] = $t;
        conti_movimento($u, $val, 'tesoro', "$k $oggi");
        return ['crediti' => $val, 'n' => count($t['presi'])];
    });
    resposta(['tesoro' => $r + ['max' => $max], 'profilo' => profilo(conti_leggi($id))]);
}

// recarga: cria a Checkout Session da Stripe (preço do crediti.json, nunca do navegador); o webhook (stripe.php) credita
if ($acao === 'ricarica') {
    if (!($cfg['ricarica_aperta'] ?? false)) erro('Top-ups are opening soon!');
    if (!empty($u['proprietario'])) erro('Owner account: you’ve already got test credits.');
    $p = null;
    foreach ((array)($cfg['pacchi'] ?? []) as $x) if ($x['id'] === ($d['pacco'] ?? '')) $p = $x;
    if (!$p) erro('That pack isn’t available.');
    $lim = (float)($cfg['limite_mese_euro'] ?? 150);
    if (conti_euro_mese($id) + (float)$p['prezzo'] > $lim) erro("You can top up a maximum of £" . number_format($lim, 0, '.', ',') . " every 30 days.");
    if (!conti_limite("ricarica|$id", 20, 3600)) erro('Too many tries. Please try again in a bit.', 429);
    $arqStripe = is_file(__DIR__ . '/../../privato/stripe.php') ? __DIR__ . '/../../privato/stripe.php' : __DIR__ . '/../privato/stripe.php';
    if (is_file($arqStripe)) require_once $arqStripe;
    if (!defined('STRIPE_SECRET') || STRIPE_SECRET === '') erro('Top-ups aren’t available right now. Please try again later.', 503);
    $rif = 'c' . date('ymd') . '-' . bin2hex(random_bytes(4));
    $nome = number_format((int)$p['crediti'], 0, '.', ',') . ' credits · UK House by House';
    $base = (conti_https() ? 'https' : 'http') . '://' . ($_SERVER['HTTP_HOST'] ?? 'ukhousebyhouse.com');
    $meta = ['tipo' => 'crediti', 'conto' => $id, 'pacco' => (string)$p['id'], 'rif' => $rif];
    $dados = [
        'mode' => 'payment',
        'locale' => 'en-GB',
        'customer_email' => (string)$u['email'],
        'client_reference_id' => $rif,
        'metadata' => $meta,
        'payment_intent_data' => ['description' => $nome, 'metadata' => $meta],
        'line_items' => [['quantity' => 1, 'price_data' => [
            'currency' => 'gbp', 'unit_amount' => (int)round((float)$p['prezzo'] * 100),
            'product_data' => ['name' => $nome, 'description' => 'Credits for your UK House by House account. They never turn back into money and can’t buy points, roles or votes.'],
        ]]],
        'success_url' => "$base/?ricarica=ok#conto",
        'cancel_url' => "$base/#conto",
    ];
    $ctx = stream_context_create(['http' => [
        'method' => 'POST', 'timeout' => 20, 'ignore_errors' => true,
        'header' => "Authorization: Bearer " . STRIPE_SECRET . "\r\nContent-Type: application/x-www-form-urlencoded\r\nIdempotency-Key: crediti-$rif\r\n",
        'content' => http_build_query($dados),
    ]]);
    $sessao = json_decode((string)@file_get_contents('https://api.stripe.com/v1/checkout/sessions', false, $ctx), true) ?: [];
    if (empty($sessao['url'])) { error_log('ricarica stripe: ' . ($sessao['error']['message'] ?? 'sem resposta')); erro('We couldn’t open the payment page. Please try again in a minute.', 502); }
    conti_traccia('checkout', (string)$p['id'], (string)($d['da'] ?? ''), $id);   // foi para a Stripe
    // consentimento para o agradecimento no reel (só com o quadradinho marcado; nunca marcado por padrão)
    $gr = !empty($d['grazie']);
    conti_modifica($id, function (array &$u) use ($gr, $p) { if ($gr) $u['grazie'] = ['em' => gmdate('c'), 'pacco' => (string)$p['id']]; else unset($u['grazie']); return $u; });
    resposta(['url' => $sessao['url']]);
}

erro('Unknown action.');
