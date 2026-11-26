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

// ---------- recargas de créditos (conto.php "ricarica"): credita na conta; reembolso/contestação tira de volta ----------
// a transação é o payment_intent (o reembolso chega pela cobrança, que só traz o payment_intent)
$ehCrediti = ($obj['metadata']['tipo'] ?? '') === 'crediti';
if (!$ehCrediti && in_array($tipo, ['charge.refunded', 'charge.dispute.created'], true) && ($obj['payment_intent'] ?? '') !== '') {
    $T = json_decode((string)@file_get_contents(CARTELLA . '/conti/transazioni.json'), true) ?: [];
    $ehCrediti = isset($T[(string)$obj['payment_intent']]);
}
if ($ehCrediti) {
    require_once __DIR__ . '/_conti.php';
    $pi = (string)($obj['payment_intent'] ?? '');
    $m = (array)($obj['metadata'] ?? []);
    $esito = 'nulla';
    if (in_array($tipo, ['checkout.session.completed', 'checkout.session.async_payment_succeeded'], true) && ($obj['payment_status'] ?? '') === 'paid' && $pi !== '')
        $esito = conti_ricarica((string)($obj['customer_details']['email'] ?? $obj['customer_email'] ?? ''), (string)($m['conto'] ?? ''), (string)($m['pacco'] ?? ''), $pi, 'pagato', $valor);
    elseif (in_array($tipo, ['charge.refunded', 'charge.dispute.created'], true) && $pi !== '')
        $esito = conti_ricarica('', '', '', $pi, 'rimborsato', null);
    file_put_contents(conti_dir() . '/ricariche.log', gmdate('c') . " $tipo $pi " . ($m['pacco'] ?? '') . " £$valor " . ($teste ? '[teste] ' : '') . "=> $esito\n", FILE_APPEND | LOCK_EX);
    fim(200);
}

// ---------- Christmas on the map (api/natale.php): registra o pagamento, ATIVA SOZINHO em data/natale.json e avisa por e-mail ----------
// (pagamento de teste só registra; reembolso/contestação desativa só o que aquela compra ligou)
// natale.json passa a ser "do servidor": pubblica --tutto não sobrescreve e strumenti/natale.mjs baixa a versão do site antes de mexer
function natale_aplica(string $off, string $neg, string $dia, bool $liga): string {
    $arq = __DIR__ . '/../data/natale.json';
    $fh = @fopen($arq, 'c+'); if (!$fh) return 'ERRO: não abriu data/natale.json';
    flock($fh, LOCK_EX);
    $nat = json_decode((string)stream_get_contents($fh), true) ?: [];
    $nat += ['sponsor' => null, 'negozi' => [], 'avvento' => [], 'bonus' => 2];
    $nat['avvento'] = (array)$nat['avvento'];
    $r = '';
    if ($liga) {
        if ($off === 'avvento') {
            $dono = (string)($nat['avvento'][$dia] ?? '');
            if (!preg_match('/^2026-12-(0[1-9]|1\d|2[0-4])$/', $dia)) $r = "NÃO ATIVOU: dia inválido ($dia)";
            elseif ($dono !== '' && $dono !== $neg) { $r = "NÃO ATIVOU o Advent: $dia já é de outra loja ($dono). Ganhou a loja de Natal; combine outro dia ou reembolse a diferença"; if (!in_array($neg, $nat['negozi'], true)) $nat['negozi'][] = $neg; }
            else { $nat['avvento'][$dia] = $neg; ksort($nat['avvento']); $r = "ATIVADO: Advent $dia"; }
        } elseif ($off === 'sponsor') {
            $sp = (string)($nat['sponsor']['id'] ?? '');
            if ($sp !== '' && $sp !== $neg) { $r = "NÃO ATIVOU o sponsor: já é de outra loja ($sp). Ganhou a loja de Natal; reembolse a diferença"; if (!in_array($neg, $nat['negozi'], true)) $nat['negozi'][] = $neg; }
            else { $nat['sponsor'] = ['id' => $neg]; $r = 'ATIVADO: sponsor oficial'; }
        } else { if (!in_array($neg, $nat['negozi'], true)) $nat['negozi'][] = $neg; $r = 'ATIVADO: loja de Natal'; }
    } else {
        if ($off === 'avvento') { if (($nat['avvento'][$dia] ?? '') === $neg) unset($nat['avvento'][$dia]); }
        elseif ($off === 'sponsor') { if (($nat['sponsor']['id'] ?? '') === $neg) $nat['sponsor'] = null; }
        else $nat['negozi'] = array_values(array_filter($nat['negozi'], fn($x) => $x !== $neg));
        $r = 'DESATIVADO (reembolso/contestação)';
    }
    if ($nat['avvento'] === []) $nat['avvento'] = new stdClass();   // continua {} no JSON
    ftruncate($fh, 0); rewind($fh);
    fwrite($fh, json_encode($nat, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n");
    fflush($fh); flock($fh, LOCK_UN); fclose($fh);
    return $r;
}
// reembolso/contestação chegam pela cobrança (sem metadata): acha a compra pelo payment_intent no log
$logNat = CARTELLA . '/natale-pagamenti.jsonl';
$natPi = (string)($obj['payment_intent'] ?? '');
$mNat = (array)($obj['metadata'] ?? []);
if (($mNat['tipo'] ?? '') !== 'natale' && in_array($tipo, ['charge.refunded', 'charge.dispute.created'], true) && $natPi !== '' && is_file($logNat)) {
    foreach (file($logNat, FILE_IGNORE_NEW_LINES) ?: [] as $l) { $x = json_decode($l, true) ?: []; if (($x['pi'] ?? '') === $natPi && ($x['esito'] ?? '') === 'pagato') $mNat = ['tipo' => 'natale'] + $x; }
}
if (($mNat['tipo'] ?? '') === 'natale') {
    $esito = null;
    if (in_array($tipo, ['checkout.session.completed', 'checkout.session.async_payment_succeeded'], true) && ($obj['payment_status'] ?? '') === 'paid') $esito = 'pagato';
    elseif (in_array($tipo, ['charge.refunded', 'charge.dispute.created'], true)) $esito = 'rimborsato';
    if ($esito) {
        $neg = (string)($mNat['negozio'] ?? ''); $off = (string)($mNat['offerta'] ?? ''); $dia = (string)($mNat['giorno'] ?? '');
        $ativ = $teste ? 'teste: não mexe no mapa' : (preg_match('/^\d{6}-[0-9a-f]{8}$/', $neg) ? natale_aplica($off, $neg, $dia, $esito === 'pagato') : 'ERRO: loja sem id');
        file_put_contents($logNat, json_encode(['em' => gmdate('c'), 'esito' => $esito, 'offerta' => $off, 'negozio' => $neg, 'nome' => (string)($mNat['nome'] ?? ''), 'giorno' => $dia, 'pi' => $natPi, 'valore' => $valor, 'email' => (string)($obj['customer_details']['email'] ?? ''), 'test' => $teste, 'mapa' => $ativ], JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND | LOCK_EX);
        if (defined('EMAIL_AVVISI') && EMAIL_AVVISI) {
            $falhou = !str_starts_with($ativ, 'ATIVADO') && !str_starts_with($ativ, 'DESATIVADO') && !$teste;
            @mail(EMAIL_AVVISI, ($falhou ? '⚠️ ' : '') . ($esito === 'pagato' ? 'PAGO Natal' : 'REEMBOLSO Natal') . ": " . ($mNat['nome'] ?? $neg) . " ($off" . ($dia ? " $dia" : '') . ")" . ($teste ? ' [teste]' : ''),
                "Natal UK: $off · loja $neg · £$valor\nMapa: $ativ\n(ver tudo: node strumenti/natale.mjs lista)", 'From: ' . EMAIL_AVVISI);
        }
    }
    fim(200);
}

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
