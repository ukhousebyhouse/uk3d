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
        // renovação: se a conta ainda tem uma decoração ativa, os dias novos começam quando ela acaba
        $base = time();
        if ($minuti === null) foreach (glob("$pasta/[0-9][0-9][0-9][0-9][0-9][0-9]-*.json") ?: [] as $a) {
            $q = json_decode((string)file_get_contents($a), true) ?: [];
            if (($q['id'] ?? '') === $id || ($q['conta'] ?? '') !== ($p['conta'] ?? '') || !in_array($q['pagamento'] ?? '', ['pagato', 'omaggio'], true) || ($q['stato'] ?? '') === 'rimosso') continue;
            $base = max($base, (int)strtotime((string)($q['scade'] ?? '')));
        }
        $p['attivo_da'] = gmdate('c');
        $p['scade'] = gmdate('c', $base + ($minuti !== null ? $minuti * 60 : $giorni * 86400));
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
    $agora = time(); $por = []; $rec = [];
    foreach (glob("$pasta/[0-9][0-9][0-9][0-9][0-9][0-9]-*.json") ?: [] as $a) {
        $p = json_decode((string)file_get_contents($a), true) ?: [];
        if (!in_array($p['pagamento'] ?? '', ['pagato', 'omaggio'], true) || ($p['stato'] ?? '') === 'rimosso') continue;
        $c = (string)$p['conta'];
        $fim = (int)strtotime((string)($p['scade'] ?? ''));
        // recentes (pagas, vencem ou venceram nos últimos 30 dias): o site oferece renovar com as mesmas escolhas
        if ($p['pagamento'] === 'pagato' && $fim > $agora - 30 * 86400 && (!isset($rec[$c]) || strcmp((string)$p['scade'], (string)$rec[$c]['scade']) > 0)) $rec[$c] = $p;
        if ($fim <= $agora) continue;
        if (!isset($por[$c]) || strcmp((string)$p['attivo_da'], (string)$por[$c]['attivo_da']) > 0) $por[$c] = $p;
    }
    $pub = fn($p) => ['id' => $p['id'], 'conta' => $p['conta'], 'da' => $p['da'] ?? '', 'squadra' => $p['squadra'] ?? '', 'modello' => $p['modello'] ?? '', 'extra' => $p['extra'] ?? [], 'scade' => $p['scade']];
    $lista = array_values(array_map($pub, $por));
    $recenti = array_values(array_map(fn($p) => ['conta' => $p['conta'], 'squadra' => $p['squadra'] ?? '', 'modello' => $p['modello'] ?? '', 'extra' => $p['extra'] ?? [], 'scade' => $p['scade']], $rec));
    $tmp = "$destino.tmp";
    file_put_contents($tmp, json_encode(['agg' => gmdate('c'), 'decori' => $lista, 'recenti' => $recenti], JSON_UNESCAPED_UNICODE), LOCK_EX);
    rename($tmp, $destino);
}
