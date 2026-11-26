<?php
// Christmas on the map (patrocínio de Natal para lojistas) — no UK o pagamento é pela STRIPE (na Itália é Hotmart).
// Link que mandamos para a loja (e-mail / DM):  https://ukhousebyhouse.com/api/natale.php?shop=<id da loja>&offer=<oferta>[&day=AAAA-MM-DD]
//   offer: negozio (Christmas shop) · rinnovo (Christmas shop, preço de quem renova a loja) · avvento (1 dia do Advent, 1–24 dez) · sponsor (1 só no país)
// Abre o checkout da Stripe; o webhook (api/stripe.php, metadata tipo=natale) registra o pagamento e avisa por e-mail.
// A ativação é AUTOMÁTICA (o webhook grava data/natale.json na hora do pagamento); strumenti/natale.mjs serve para ajustes à mão.
declare(strict_types=1);
require is_file(__DIR__ . '/../../privato/config.php') ? __DIR__ . '/../../privato/config.php' : __DIR__ . '/../privato/config.php';
$arqStripe = is_file(__DIR__ . '/../../privato/stripe.php') ? __DIR__ . '/../../privato/stripe.php' : __DIR__ . '/../privato/stripe.php';
if (is_file($arqStripe)) require $arqStripe;
header('Cache-Control: no-store');

// preços em libras, IVA (VAT) incluído
const OFFERTE = [
    'negozio' => ['prezzo' => 9.99, 'nome' => 'Christmas shop on the map', 'desc' => 'Your shop dressed up for Christmas on the UK House by House 3D map (snow, fairy lights, wreath and a little tree) and listed in the Christmas Market at the top of the High Street, 28 November – 6 January.'],
    'rinnovo' => ['prezzo' => 7.99, 'nome' => 'Christmas shop on the map (renewal price)', 'desc' => 'Your shop dressed up for Christmas on the UK House by House 3D map and listed in the Christmas Market, 28 November – 6 January. Price for shops that renew.'],
    'avvento' => ['prezzo' => 19.99, 'nome' => 'A day of the Advent calendar', 'desc' => 'For one day (1–24 December) the whole map says "today\'s brought to you by" your business and the treasure outside your shop is worth double. Christmas shop included.'],
    'sponsor' => ['prezzo' => 149.00, 'nome' => 'Official Christmas sponsor', 'desc' => 'Only one in the whole UK: "Christmas on the map is brought to you by" your business across the whole map, 28 November – 6 January. Christmas shop included.'],
];

function pagina(int $codigo, string $titulo, string $txt): void {
    http_response_code($codigo);
    header('Content-Type: text/html; charset=utf-8');
    $e = fn($s) => htmlspecialchars($s, ENT_QUOTES, 'UTF-8');
    echo '<!doctype html><html lang="en-GB"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' . $e($titulo) . ' · UK House by House</title>'
        . '<body style="font-family:system-ui,sans-serif;max-width:520px;margin:40px auto;padding:0 16px;line-height:1.5;color:#152033">'
        . '<h1 style="font-size:22px">🎄 ' . $e($titulo) . '</h1><p>' . $e($txt) . '</p>'
        . '<p>Questions? Just reply to our email or write to <a href="mailto:privacy@ukhousebyhouse.com">privacy@ukhousebyhouse.com</a>.</p>'
        . '<p><a href="/">← Back to the map</a></p></body></html>';
    exit;
}

$shop = (string)($_GET['shop'] ?? '');
$offer = (string)($_GET['offer'] ?? '');
$day = (string)($_GET['day'] ?? '');
if (!preg_match('/^\d{6}-[0-9a-f]{8}$/', $shop) || !isset(OFFERTE[$offer])) pagina(400, 'Link not valid', 'This Christmas link isn\'t complete. Please use the link from our email.');

// a loja tem de estar no mapa agora (no snapshot publicado)
$snap = json_decode((string)@file_get_contents(__DIR__ . '/../data/snapshot.json'), true) ?: [];
$cm = null;
foreach ((array)($snap['commerci'] ?? []) as $x) if (($x['id'] ?? '') === $shop) $cm = $x;
if (!$cm) pagina(404, 'Shop not found', 'We couldn\'t find this shop on the map. If it has expired, please renew it first and then use the Christmas link again.');

$nat = json_decode((string)@file_get_contents(__DIR__ . '/../data/natale.json'), true) ?: [];
if ($offer === 'sponsor' && !empty($nat['sponsor']['id']) && $nat['sponsor']['id'] !== $shop) pagina(409, 'Already taken', 'Sorry, the official Christmas sponsor has already been taken. You can still get a Christmas shop or a day of the Advent calendar.');
if ($offer === 'avvento') {
    if (!preg_match('/^2026-12-(0[1-9]|1\d|2[0-4])$/', $day)) pagina(400, 'Pick a day', 'For the Advent calendar, please choose a day between 1 and 24 December (reply to our email and we\'ll send you the right link).');
    if (gmdate('Y-m-d') > $day) pagina(409, 'That day has passed', 'That day of the Advent calendar has already gone. Reply to our email and we\'ll send you a link for another day.');
    $dono = (string)($nat['avvento'][$day] ?? '');
    if ($dono !== '' && $dono !== $shop) pagina(409, 'Day already taken', 'Sorry, that day of the Advent calendar has already been taken. Reply to our email and we\'ll send you a link for a free day.');
}
if (!defined('STRIPE_SECRET') || STRIPE_SECRET === '') pagina(503, 'Payments paused', 'Payments aren\'t available right now. Please try again later.');

$o = OFFERTE[$offer];
$rif = 'n' . date('ymd') . '-' . bin2hex(random_bytes(4));
$base = ((($_SERVER['HTTPS'] ?? '') !== '' && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http') . '://' . ($_SERVER['HTTP_HOST'] ?? 'ukhousebyhouse.com');
$titulo = $o['nome'] . ($offer === 'avvento' ? ' · ' . (int)substr($day, 8) . ' December' : '') . ' · ' . (string)($cm['nome'] ?? '');
$meta = ['tipo' => 'natale', 'offerta' => $offer, 'negozio' => $shop, 'nome' => mb_substr((string)($cm['nome'] ?? ''), 0, 80), 'giorno' => $offer === 'avvento' ? $day : '', 'rif' => $rif];
$dados = [
    'mode' => 'payment',
    'locale' => 'en-GB',
    'client_reference_id' => $rif,
    'metadata' => $meta,
    'payment_intent_data' => ['description' => $titulo, 'metadata' => $meta],
    'line_items' => [['quantity' => 1, 'price_data' => [
        'currency' => 'gbp', 'unit_amount' => (int)round($o['prezzo'] * 100),
        'product_data' => ['name' => mb_substr($titulo, 0, 250), 'description' => $o['desc'] . ' Advertising: shops on the map are symbolic and don\'t show the real address.'],
    ]]],
    'success_url' => "$base/?natale=ok&da=natale#negozi",
    'cancel_url' => "$base/?da=natale#negozi",
];
$ctx = stream_context_create(['http' => [
    'method' => 'POST', 'timeout' => 20, 'ignore_errors' => true,
    'header' => "Authorization: Bearer " . STRIPE_SECRET . "\r\nContent-Type: application/x-www-form-urlencoded\r\nIdempotency-Key: natale-$rif\r\n",
    'content' => http_build_query($dados),
]]);
$sessao = json_decode((string)@file_get_contents('https://api.stripe.com/v1/checkout/sessions', false, $ctx), true) ?: [];
if (empty($sessao['url'])) { error_log('natale stripe: ' . ($sessao['error']['message'] ?? 'sem resposta')); pagina(502, 'Something went wrong', 'We couldn\'t open the payment page. Please try again in a minute.'); }
header('Location: ' . $sessao['url'], true, 303);
