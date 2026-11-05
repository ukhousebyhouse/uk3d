<?php
// Webhook da Stripe: confere a assinatura (Stripe-Signature) e muda o estado do pedido de casa decorada.
// No painel da Stripe: Desenvolvedores > Webhooks > endpoint https://ukhousebyhouse.com/api/stripe.php com os eventos
// checkout.session.completed, checkout.session.async_payment_succeeded, checkout.session.async_payment_failed,
// checkout.session.expired, charge.refunded, charge.dispute.created. O segredo (whsec_...) vai em privato/stripe.php.
declare(strict_types=1);
require is_file(__DIR__ . '/../../privato/config.php') ? __DIR__ . '/../../privato/config.php' : __DIR__ . '/../privato/config.php';
require is_file(__DIR__ . '/../../privato/stripe.php') ? __DIR__ . '/../../privato/stripe.php' : __DIR__ . '/../privato/stripe.php';
require __DIR__ . '/_decori.php';

function fim(int $codigo, string $txt = 'ok'): void { http_response_code($codigo); echo $txt; exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST' || !defined('STRIPE_WEBHOOK') || STRIPE_WEBHOOK === '') fim(200);

// assinatura: "t=<hora>,v1=<hmac>" com HMAC-SHA256 de "<hora>.<corpo>"; aceita até 5 minutos de diferença
$corpo = (string)file_get_contents('php://input');
$t = 0; $assinaturas = [];
foreach (explode(',', (string)($_SERVER['HTTP_STRIPE_SIGNATURE'] ?? '')) as $parte) {
    [$k, $v] = array_pad(explode('=', trim($parte), 2), 2, '');
    if ($k === 't') $t = (int)$v; elseif ($k === 'v1') $assinaturas[] = $v;
}
$esperada = hash_hmac('sha256', "$t.$corpo", STRIPE_WEBHOOK);
$valida = $t && abs(time() - $t) <= 300 && array_filter($assinaturas, fn($s) => hash_equals($esperada, $s));
if (!$valida) fim(400, 'assinatura inválida');

$ev = json_decode($corpo, true) ?: [];
$tipo = (string)($ev['type'] ?? '');
$obj = $ev['data']['object'] ?? [];
$teste = empty($ev['livemode']);
$pasta = CARTELLA . '/decori';
if (!is_dir($pasta)) mkdir($pasta, 0750, true);
file_put_contents(CARTELLA . '/stripe-eventi.jsonl', json_encode(['em' => gmdate('c'), 'tipo' => $tipo, 'id' => $ev['id'] ?? '', 'teste' => $teste, 'pedido' => $obj['client_reference_id'] ?? $obj['metadata']['pedido'] ?? ''], JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND | LOCK_EX);

// reembolso e contestação chegam pela cobrança: acha o pedido pelo payment_intent gravado no pagamento
function pedidoDoPagamento(string $pasta, string $pi): string {
    if ($pi === '') return '';
    foreach (glob("$pasta/[0-9][0-9][0-9][0-9][0-9][0-9]-*.json") ?: [] as $a) {
        $p = json_decode((string)file_get_contents($a), true) ?: [];
        if (($p['payment_intent'] ?? '') === $pi) return (string)$p['id'];
    }
    return '';
}

$valor = isset($obj['amount_total']) ? $obj['amount_total'] / 100 : null;

// ---------- lojas e outdoors (negozio.php): só marca o pagamento; entra no mapa com "amministra approva" ----------
$pastaNeg = CARTELLA . '/negozi';
$idNeg = ($obj['metadata']['tipo'] ?? '') === 'negozio' ? (string)($obj['client_reference_id'] ?? $obj['metadata']['pedido'] ?? '') : '';
if ($idNeg === '' && in_array($tipo, ['charge.refunded', 'charge.dispute.created'], true)) $idNeg = pedidoDoPagamento($pastaNeg, (string)($obj['payment_intent'] ?? ''));
if ($idNeg !== '' && preg_match('/^\d{6}-[0-9a-f]{8}$/', $idNeg) && is_file("$pastaNeg/$idNeg.json")) {
    $p = json_decode((string)file_get_contents("$pastaNeg/$idNeg.json"), true) ?: [];
    $novo = null;
    switch ($tipo) {
        case 'checkout.session.completed':
        case 'checkout.session.async_payment_succeeded':
            $novo = ($obj['payment_status'] ?? '') === 'paid' ? 'pagato' : 'in_attesa';
            $p = array_merge($p, ['sessione' => $obj['id'] ?? '', 'payment_intent' => (string)($obj['payment_intent'] ?? ''), 'valore' => $valor, 'valuta' => strtoupper((string)($obj['currency'] ?? '')), 'test' => $teste]);
            if ($novo === 'pagato' && !empty($p['su_misura'])) $p['pagamento_su_misura'] = 'pagato';
            break;
        case 'checkout.session.async_payment_failed': $novo = 'annullato'; break;
        case 'checkout.session.expired': if (empty($p['pagamento'])) { $p['checkout'] = 'abbandonato'; $p['checkout_em'] = gmdate('c'); } break;
        case 'charge.refunded': case 'charge.dispute.created': $novo = 'rimborsato'; $p['motivo'] = $tipo === 'charge.dispute.created' ? 'contestazione' : 'rimborso'; break;
    }
    // a confirmação pode chegar repetida ou atrasada: não desfaz um reembolso
    if ($novo && !($novo === 'pagato' && ($p['pagamento'] ?? '') === 'rimborsato')) { $p['pagamento'] = $novo; $p['pagamento_em'] = gmdate('c'); }
    file_put_contents("$pastaNeg/$idNeg.json", json_encode($p, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);
    if ($novo === 'pagato' && defined('EMAIL_AVVISI') && EMAIL_AVVISI) {
        @mail(EMAIL_AVVISI, "PAGO: {$p['nome']} ({$p['prodotto']})" . ($teste ? ' [teste]' : ''), "Pedido $idNeg pago (£$valor).\nAprove: node strumenti/amministra.mjs approva $idNeg", 'From: ' . EMAIL_AVVISI);
    }
    fim(200);
}

// ---------- casas decoradas ----------
// pagamento de teste (chaves sk_test_): a casa fica decorada só 10 minutos
$minutos = $teste ? 10 : null;
switch ($tipo) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded':
        $id = (string)($obj['client_reference_id'] ?? '');
        $dados = ['sessione' => $obj['id'] ?? '', 'payment_intent' => (string)($obj['payment_intent'] ?? ''), 'valore' => $valor, 'valuta' => strtoupper((string)($obj['currency'] ?? '')), 'test' => $teste];
        // completed com pagamento ainda pendente (ex.: transferência): espera o async_payment_succeeded
        if (($obj['payment_status'] ?? '') === 'paid') aggiornaPedido($id, 'pagato', $dados, $minutos);
        else aggiornaPedido($id, 'in_attesa', $dados);
        break;
    case 'checkout.session.async_payment_failed':
        aggiornaPedido((string)($obj['client_reference_id'] ?? ''), 'annullato');
        break;
    case 'checkout.session.expired':
        // abriu o pagamento e não pagou (a sessão vence em 24 h): só anota, para o relatório
        $id = (string)($obj['client_reference_id'] ?? '');
        if (preg_match('/^\d{6}-[0-9a-f]{8}$/', $id) && is_file("$pasta/$id.json")) {
            $p = json_decode((string)file_get_contents("$pasta/$id.json"), true) ?: [];
            if (empty($p['pagamento'])) { $p['checkout'] = 'abbandonato'; $p['checkout_em'] = gmdate('c'); file_put_contents("$pasta/$id.json", json_encode($p, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX); }
        }
        break;
    case 'charge.refunded':
    case 'charge.dispute.created':
        $id = pedidoDoPagamento($pasta, (string)($obj['payment_intent'] ?? ''));
        if ($id !== '') aggiornaPedido($id, 'rimborsato', ['motivo' => $tipo === 'charge.dispute.created' ? 'contestazione' : 'rimborso']);
        break;
}
fim(200);
