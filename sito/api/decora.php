<?php
// Pedido de casa decorada (decori.js): confere as contas no mapa e os efeitos, guarda em CARTELLA/decori/<id>.json
// e devolve o id. Hotmart: o id vai como "sck" no link de pagamento. Stripe (data/negozio.json decora.provedor = "stripe",
// ou o código de teste STRIPE_PROVA): cria a Checkout Session e devolve a url dela.
// Só aparece no mapa depois que o webhook (hotmart.php / stripe.php) confirma o pagamento.
declare(strict_types=1);
require is_file(__DIR__ . '/../../privato/config.php') ? __DIR__ . '/../../privato/config.php' : __DIR__ . '/../privato/config.php';
$arqStripe = is_file(__DIR__ . '/../../privato/stripe.php') ? __DIR__ . '/../../privato/stripe.php' : __DIR__ . '/../privato/stripe.php';
if (is_file($arqStripe)) require $arqStripe;

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
function resposta(int $codigo, array $dados): void { http_response_code($codigo); echo json_encode($dados, JSON_UNESCAPED_UNICODE); exit; }
function erro(string $msg): void { resposta(400, ['ok' => false, 'erro' => $msg]); }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') resposta(405, ['ok' => false]);

$pasta = CARTELLA . '/decori';
if (!is_dir($pasta)) mkdir($pasta, 0750, true);

// limite simples: 20 pedidos por hora por IP
$ip = hash('sha256', (string)($_SERVER['REMOTE_ADDR'] ?? '') . APP_SECRET);
$arqIp = $pasta . '/.limite-' . substr($ip, 0, 16);
$agora = time();
$tentativas = array_filter(is_file($arqIp) ? array_map('intval', file($arqIp, FILE_IGNORE_NEW_LINES)) : [], fn($t) => $t > $agora - 3600);
if (count($tentativas) >= 20) resposta(429, ['ok' => false, 'erro' => 'Too many requests. Please try again in an hour.']);
$tentativas[] = $agora;
file_put_contents($arqIp, implode("\n", $tentativas), LOCK_EX);

$d = json_decode((string)file_get_contents('php://input'), true);
if (!is_array($d)) erro('Invalid request.');
$conta = strtolower(ltrim(trim((string)($d['conta'] ?? '')), '@'));
$modo = ($d['modo'] ?? '') === 'regalo' ? 'regalo' : 'mia';
$da = strtolower(ltrim(trim((string)($d['da'] ?? '')), '@'));
$squadra = (string)($d['squadra'] ?? '');
$modello = (string)($d['modello'] ?? '');
$extra = array_values(array_unique(array_map('strval', (array)($d['extra'] ?? []))));

// mesmas listas de decori.js e speciali.js (presente: só coisas positivas, sem cores de time nem Union Jack)
$SQUADRE = ['reds', 'blues', 'skyblues', 'claret', 'magpies', 'amber', 'redblue', 'tangerine', 'greens'];
$COMUNS = ['oro', 'neon', 'arcobaleno', 'cuori', 'neve', 'ufo', 'corona', 'fuochi', 'campione', 'cornice'];
$EFFETTI = array_merge($COMUNS, $modo === 'regalo' ? ['palloncini'] : ['tricolore']);
$MODELLI = ['faro', 'castello', 'mulino', 'barca', 'bus', 'albero', 'capanne', 'pastore', 'collina', 'stregata', 'osservatorio', 'zenzero', 'cabina', 'teiera', 'razzo'];
if ($squadra !== '' && ($modo === 'regalo' || !in_array($squadra, $SQUADRE, true))) erro('Invalid colours.');
if ($modello !== '' && !in_array($modello, $MODELLI, true)) erro('Invalid house.');
if (array_diff($extra, $EFFETTI)) erro('Invalid effect.');
if ($squadra === '' && $modello === '' && !$extra) erro('Pick at least one effect.');
if (in_array('oro', $extra, true) && $squadra !== '') erro('Pick the golden house or your team colours, not both.');
if ($modello !== '' && ($squadra !== '' || in_array('oro', $extra, true))) erro('A rare house can\'t have team colours or gold.');

// as contas precisam ter casa no mapa (o "da @" aparece em público: só @ de quem joga, nada de texto livre)
if (!preg_match('/^[a-z0-9._]{1,30}$/', $conta)) erro('Invalid account.');
if ($modo === 'regalo' && !preg_match('/^[a-z0-9._]{1,30}$/', $da)) erro('Type your @.');
if ($modo === 'regalo' && $da === $conta) erro('You can\'t send a gift to yourself.');
$snap = json_decode((string)@file_get_contents(__DIR__ . '/../data/snapshot.json'), true);
$conte = array_flip(array_map(fn($c) => (string)$c[0], (array)($snap['case'] ?? [])));
if (!isset($conte[$conta])) erro("@$conta hasn't got a house on the map yet.");
if ($modo === 'regalo' && !isset($conte[$da])) erro("@$da hasn't got a house on the map yet.");

// casa rara: só uma de cada por cidade (confere as decorações ativas de data/decori.json)
if ($modello !== '') {
    $cidade = [];
    foreach ((array)($snap['case'] ?? []) as $c) $cidade[(string)$c[0]] = $c[1] ?? null;
    $ativas = json_decode((string)@file_get_contents(__DIR__ . '/../data/decori.json'), true)['decori'] ?? [];
    foreach ((array)$ativas as $x) {
        $outra = (string)($x['conta'] ?? '');
        if (($x['modello'] ?? '') === $modello && $outra !== $conta && strtotime((string)($x['scade'] ?? '')) > time()
            && ($cidade[$outra] ?? -1) === ($cidade[$conta] ?? -2)) erro("Someone in this town already has that one (@$outra). Pick another rare house!");
    }
}

$id = date('ymd') . '-' . bin2hex(random_bytes(4));
$cfg = json_decode((string)@file_get_contents(__DIR__ . '/../data/negozio.json'), true)['decora'] ?? [];
$prova = defined('STRIPE_PROVA') && STRIPE_PROVA !== '' && hash_equals(STRIPE_PROVA, (string)($d['prova'] ?? ''));
$usaStripe = defined('STRIPE_SECRET') && STRIPE_SECRET !== '' && (($cfg['provedor'] ?? 'hotmart') === 'stripe' || $prova);
$pedido = ['id' => $id, 'creato' => gmdate('c'), 'stato' => 'nuovo', 'modo' => $modo, 'conta' => $conta, 'da' => $modo === 'regalo' ? $da : '', 'squadra' => $squadra, 'modello' => $modello, 'extra' => $extra, 'provedor' => $usaStripe ? 'stripe' : 'hotmart'];
file_put_contents("$pasta/$id.json", json_encode($pedido, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);
if (!$usaStripe) resposta(200, ['ok' => true, 'id' => $id]);

// ---------- Stripe Checkout ----------
$giorni = max(1, (int)($cfg['giorni'] ?? 10));
$NOMI = ['faro' => 'Lighthouse', 'castello' => 'Castle', 'mulino' => 'Windmill', 'barca' => 'Narrowboat', 'bus' => 'Double-decker', 'albero' => 'Treehouse', 'capanne' => 'Beach huts', 'pastore' => "Shepherd's hut", 'collina' => 'Hillside house', 'stregata' => 'Haunted manor', 'osservatorio' => 'Observatory', 'zenzero' => 'Gingerbread house', 'cabina' => 'Giant phone box', 'teiera' => 'Teapot cottage', 'razzo' => 'Rocket'];
$nome = $modello !== '' ? "Rare house: {$NOMI[$modello]} · @$conta" : ($modo === 'regalo' ? "Gift for @$conta" : "House decoration · @$conta");
$base = ((($_SERVER['HTTPS'] ?? '') !== '' && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http') . '://' . ($_SERVER['HTTP_HOST'] ?? 'ukhousebyhouse.com');
$dados = [
    'mode' => 'payment',
    'locale' => 'en-GB',
    'client_reference_id' => $id,
    'metadata' => ['pedido' => $id, 'conta' => $conta],
    'payment_intent_data' => ['description' => $nome, 'metadata' => ['pedido' => $id, 'conta' => $conta]],
    'line_items' => [['quantity' => 1, 'price_data' => [
        'currency' => 'gbp', 'unit_amount' => (int)($cfg['prezzo'] ?? 499),
        'product_data' => ['name' => $nome, 'description' => "Shown on the UK House by House map for $giorni days" . ($modo === 'regalo' ? ", with \"from @$da\" above the house" : '') . '. Looks only: no points.'],
    ]]],
    'success_url' => "$base/?pagato=1",
    'cancel_url' => "$base/#decora",
];
$ctx = stream_context_create(['http' => [
    'method' => 'POST', 'timeout' => 20, 'ignore_errors' => true,
    'header' => "Authorization: Bearer " . STRIPE_SECRET . "\r\nContent-Type: application/x-www-form-urlencoded\r\nIdempotency-Key: decora-$id\r\n",
    'content' => http_build_query($dados),
]]);
$sessao = json_decode((string)@file_get_contents('https://api.stripe.com/v1/checkout/sessions', false, $ctx), true) ?: [];
if (empty($sessao['url'])) {
    file_put_contents("$pasta/$id.json", json_encode($pedido + ['erro_stripe' => $sessao['error']['message'] ?? 'sem resposta'], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);
    resposta(502, ['ok' => false, 'erro' => 'We couldn\'t open the payment page. Please try again in a minute.']);
}
$pedido['sessione'] = $sessao['id'];
$pedido['test'] = empty($sessao['livemode']);
file_put_contents("$pasta/$id.json", json_encode($pedido, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);
resposta(200, ['ok' => true, 'id' => $id, 'url' => $sessao['url']]);
