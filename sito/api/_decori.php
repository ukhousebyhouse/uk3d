<?php
// Comum aos webhooks de pagamento (hotmart.php e stripe.php): muda o estado de um pedido de casa decorada
// (CARTELLA/decori/<id>.json) e refaz a lista pública data/decori.json.

// $novo: 'pagato' | 'rimborsato' | 'annullato'; $extra: campos a gravar no pedido (transação, valor...)
// $minuti: duração de teste (Stripe em modo de teste: some em minutos, não em dias)
function aggiornaPedido(string $id, string $novo, array $extra = [], ?int $minuti = null): bool {
    $pasta = CARTELLA . '/decori';
    if (!preg_match('/^\d{6}-[0-9a-f]{8}$/', $id) || !is_file("$pasta/$id.json")) return false;
    $p = json_decode((string)file_get_contents("$pasta/$id.json"), true) ?: [];
    if ($novo === 'pagato' && empty($p['scade'])) {
        $cfg = json_decode((string)@file_get_contents(__DIR__ . '/../data/negozio.json'), true) ?: [];
        $giorni = max(1, (int)($cfg['decora']['giorni'] ?? 10));
        $p['attivo_da'] = gmdate('c');
        $p['scade'] = gmdate('c', time() + ($minuti !== null ? $minuti * 60 : $giorni * 86400));
    }
    // a confirmação pode chegar repetida ou atrasada: não desfaz um reembolso
    if (!($novo === 'pagato' && ($p['pagamento'] ?? '') === 'rimborsato')) $p['pagamento'] = $novo;
    $p = array_merge($p, $extra, ['pagamento_em' => gmdate('c')]);
    file_put_contents("$pasta/$id.json", json_encode($p, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);
    rigeneraDecori($pasta, __DIR__ . '/../data/decori.json');
    return true;
}

// lista pública das decorações ativas (o site lê data/decori.json): a compra mais recente de cada conta vale
// (amministra.mjs "decori rimuovi" refaz a mesma lista no PC)
function rigeneraDecori(string $pasta, string $destino): void {
    $agora = time(); $por = [];
    foreach (glob("$pasta/[0-9][0-9][0-9][0-9][0-9][0-9]-*.json") ?: [] as $a) {
        $p = json_decode((string)file_get_contents($a), true) ?: [];
        if (!in_array($p['pagamento'] ?? '', ['pagato', 'omaggio'], true) || ($p['stato'] ?? '') === 'rimosso' || strtotime((string)($p['scade'] ?? '')) <= $agora) continue;
        $c = (string)$p['conta'];
        if (!isset($por[$c]) || strcmp((string)$p['attivo_da'], (string)$por[$c]['attivo_da']) > 0) $por[$c] = $p;
    }
    $lista = array_values(array_map(fn($p) => ['id' => $p['id'], 'conta' => $p['conta'], 'da' => $p['da'] ?? '', 'squadra' => $p['squadra'] ?? '', 'modello' => $p['modello'] ?? '', 'extra' => $p['extra'] ?? [], 'scade' => $p['scade']], $por));
    $tmp = "$destino.tmp";
    file_put_contents($tmp, json_encode(['agg' => gmdate('c'), 'decori' => $lista], JSON_UNESCAPED_UNICODE), LOCK_EX);
    rename($tmp, $destino);
}
