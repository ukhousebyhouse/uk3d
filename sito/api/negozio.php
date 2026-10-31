<?php
// Recebe o pedido de um comércio/outdoor (negozio.html) e guarda em CARTELLA/negozi/<id>.json (+ logo).
// Nada vai para o mapa sem aprovação manual (node strumenti/amministra.mjs negozi / approva).
declare(strict_types=1);
require is_file(__DIR__ . '/../../privato/config.php') ? __DIR__ . '/../../privato/config.php' : __DIR__ . '/../privato/config.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
function resposta(int $codigo, array $dados): void { http_response_code($codigo); echo json_encode($dados, JSON_UNESCAPED_UNICODE); exit; }
// tamanho em caracteres sem depender da extensão mbstring
function tam(string $s): int { return (int)preg_match_all('/./us', $s); }
function erro(string $campo, string $msg): void { resposta(400, ['ok' => false, 'campo' => $campo, 'erro' => $msg]); }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') resposta(405, ['ok' => false]);

$pasta = CARTELLA . '/negozi';
if (!is_dir($pasta)) mkdir($pasta, 0750, true);

// ?clic=<id>: a pessoa tocou em "Vai al pagamento" (sendBeacon) — só marca a hora, uma vez
$clic = (string)($_GET['clic'] ?? '');
if ($clic !== '') {
    if (preg_match('/^\d{6}-[0-9a-f]{8}$/', $clic) && is_file("$pasta/$clic.json")) {
        $p = json_decode((string)file_get_contents("$pasta/$clic.json"), true) ?: [];
        if (empty($p['clic_pagamento'])) {
            $p['clic_pagamento'] = gmdate('c');
            file_put_contents("$pasta/$clic.json", json_encode($p, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);
        }
    }
    http_response_code(204); exit;
}

// limite simples: 8 pedidos por hora por IP
$ip = hash('sha256', (string)($_SERVER['REMOTE_ADDR'] ?? '') . APP_SECRET);
$arqIp = $pasta . '/.limite-' . substr($ip, 0, 16);
$agora = time();
$tentativas = array_filter(is_file($arqIp) ? array_map('intval', file($arqIp, FILE_IGNORE_NEW_LINES)) : [], fn($t) => $t > $agora - 3600);
if (count($tentativas) >= 8) resposta(429, ['ok' => false, 'erro' => 'Too many requests. Please try again in an hour.']);
$tentativas[] = $agora;
file_put_contents($arqIp, implode("\n", $tentativas), LOCK_EX);

$d = json_decode((string)file_get_contents('php://input'), true);
if (!is_array($d)) erro('', 'Invalid request.');
$txt = fn(string $k) => trim(preg_replace('/\s+/u', ' ', strip_tags((string)($d[$k] ?? ''))) ?? '');

$prodotto = in_array($d['prodotto'] ?? '', ['negozio', 'cartellone'], true) ? $d['prodotto'] : 'negozio';
$nome = $txt('nome');
if (tam($nome) < 2 || tam($nome) > 40) erro('nome', 'Type your business name (2 to 40 characters).');
$instagram = ltrim($txt('instagram'), '@');
if ($instagram !== '' && !preg_match('/^[A-Za-z0-9._]{1,30}$/', $instagram)) erro('instagram', 'Letters, numbers, full stops and underscores only (up to 30).');
$tipo = preg_match('/^[a-z]{2,20}$/', (string)($d['tipo'] ?? '')) ? $d['tipo'] : 'altro';
$istat = (string)($d['istat'] ?? '');
if (!preg_match('/^\d{4,9}$/', $istat)) erro('citta', 'Pick the town from the list.');
$colore = preg_match('/^#[0-9A-Fa-f]{6}$/', (string)($d['colore'] ?? '')) ? strtoupper($d['colore']) : '#E0473C';
$descrizione = $txt('descrizione');
if (tam($descrizione) > 200) erro('descrizione', '200 characters max.');
$testo = $txt('testo');
if (tam($testo) > 60) erro('testo', '60 characters max.');
$whatsapp = preg_replace('/[^\d+]/', '', (string)($d['whatsapp'] ?? ''));
$cifre = preg_replace('/\D/', '', $whatsapp);
if (strlen($cifre) < 8 || strlen($cifre) > 15) erro('whatsapp', 'Type your WhatsApp number (with the country code if it isn\'t a UK number).');
if (preg_match('/^(\d)\1+$/', ltrim($cifre, '0') ?: '0') || preg_match('/^(\d)\1+$/', $cifre)) erro('whatsapp', 'Use your real WhatsApp number: that\'s where customers will message you.');
$giocatore = strtolower(ltrim(trim((string)($d['giocatore'] ?? '')), '@'));
if ($giocatore !== '' && !preg_match('/^[a-z0-9._]{1,30}$/', $giocatore)) erro('giocatore', 'Letters, numbers, full stops and underscores only.');
$email = trim((string)($d['email'] ?? ''));
if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 120) erro('email', 'Please check your email.');
// e-mails de teste e erros de digitação comuns (gmail.con, gmial.com...)
if (preg_match('/^(test|prova|esempio|example|asd|aaa+|xxx+)@|@(example|test)\./i', $email)) erro('email', 'Use your real email: that\'s where we send the confirmation.');
if (preg_match('/@(gmail|hotmail|yahoo|outlook|icloud|live|btinternet|sky|virginmedia|aol)\.(con|cm|om|co|comm)$|@(gmial|gmai|gamil|hotmial|hotmal)\./i', $email)) erro('email', 'Please check your email: there seems to be a typo.');
if (empty($d['consenso'])) erro('consenso', 'To carry on, please accept the terms.');
// parolacce nel nome, nella descrizione o nel messaggio
$VIETATE = '/\b(f+u+c+k\w*|sh[i1]t\w*|c+u+n+t\w*|wank\w*|twat\w*|bollock\w*|bastard\w*|bitch\w*|dick\w*|prick\w*|slag\w*|whore\w*|nonce\w*|knob\w*|tosser\w*|paki\w*|nigg\w*|fag\w*|retard\w*)\b/iu';
foreach (['nome' => $nome, 'descrizione' => $descrizione, 'testo' => $testo, 'email' => str_replace(['@', '.'], ' ', $email)] as $campo => $v) if (preg_match($VIETATE, $v)) erro($campo, 'That text isn\'t suitable for the map: please reword it.');

// mesmo e-mail + mesmo nome, ainda sem pagamento, nas últimas 48 h: atualiza esse pedido em vez de criar outro
$id = '';
$chaveNome = strtolower(preg_replace('/\W+/u', '', $nome) ?? '');
foreach (glob("$pasta/[0-9][0-9][0-9][0-9][0-9][0-9]-*.json") ?: [] as $a) {
    $p = json_decode((string)file_get_contents($a), true) ?: [];
    if (strtolower((string)($p['email'] ?? '')) === strtolower($email) && strtolower(preg_replace('/\W+/u', '', (string)($p['nome'] ?? '')) ?? '') === $chaveNome
        && ($p['stato'] ?? '') === 'nuovo' && empty($p['pagamento']) && strtotime((string)($p['creato'] ?? '')) > $agora - 48 * 3600) { $id = $p['id']; break; }
}
$id = $id ?: date('ymd') . '-' . bin2hex(random_bytes(4));
$logo = '';
if (!empty($d['logo'])) {
    if (!preg_match('#^data:image/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$#', (string)$d['logo'], $m)) erro('logo', 'The logo must be PNG, JPG or WebP.');
    $bin = base64_decode($m[2], true);
    if ($bin === false || strlen($bin) > 1048576) erro('logo', 'The logo must be PNG, JPG or WebP, up to 1 MB.');
    $info = @getimagesizefromstring($bin);
    if (!$info || !in_array($info['mime'], ['image/png', 'image/jpeg', 'image/webp'], true)) erro('logo', 'The logo must be PNG, JPG or WebP.');
    $ext = ['image/png' => 'png', 'image/jpeg' => 'jpg', 'image/webp' => 'webp'][$info['mime']];
    $logo = "$id.$ext";
    file_put_contents("$pasta/$logo", $bin, LOCK_EX);
}

// loja "su misura": só valores das listas do editor (cores #RRGGBB, opções conhecidas)
$stile = null;
$suMisura = $prodotto === 'negozio' && !empty($d['su_misura']) && is_array($d['stile'] ?? null);
if ($suMisura) {
    $s = $d['stile'];
    $cor = fn($k, $pad) => preg_match('/^#[0-9A-Fa-f]{6}$/', (string)($s[$k] ?? '')) ? strtoupper($s[$k]) : $pad;
    $um = fn($k, array $ok, $pad) => in_array($s[$k] ?? null, $ok, true) ? $s[$k] : $pad;
    $oggetti = ['pesce', 'pinta', 'tazza', 'pizza', 'gelato', 'caffe', 'cornetto', 'pane', 'torta', 'ciambella', 'maglietta', 'scarpa', 'barbiere', 'fiore', 'manubrio', 'smartphone', 'chiave', 'libro', 'zampa', 'nessuno'];
    $stile = [
        'tenda' => $um('tenda', ['righe', 'liscia', 'nessuna'], 'righe'), 'coloreTenda' => $cor('coloreTenda', $colore), 'coloreRighe' => $cor('coloreRighe', '#FFFFFF'),
        'facciata' => $cor('facciata', '#F3E2C2'), 'porta' => $cor('porta', '#7A4B2A'), 'bordo' => $cor('bordo', '#F6F3EC'),
        'piani' => $um('piani', [1, 2], 1), 'vetrina' => $um('vetrina', ['normale', 'larga', 'finestre'], 'normale'), 'serranda' => !empty($s['serranda']),
        'insegna' => $um('insegna', ['facciata', 'cassonetto', 'neon', 'bandiera'], 'facciata'), 'tetto' => !empty($s['tetto']),
        'oggetto' => $um('oggetto', $oggetti, 'nessuno'), 'scala' => max(0.5, min(1.5, round((float)($s['scala'] ?? 1), 2))),
        'ornamenti' => array_values(array_intersect(['vasi', 'dehors', 'luci', 'bandierine'], (array)($s['ornamenti'] ?? []))),
    ];
}

$pedido = [
    'id' => $id, 'stato' => 'nuovo', 'creato' => gmdate('c'), 'prodotto' => $prodotto, 'su_misura' => $suMisura, 'stile' => $stile,
    'nome' => $nome, 'instagram' => $instagram, 'tipo' => $tipo, 'istat' => $istat, 'colore' => $colore,
    'descrizione' => $descrizione, 'testo' => $testo, 'whatsapp' => $whatsapp, 'email' => $email, 'giocatore' => $giocatore, 'logo' => $logo,
    'piano' => preg_match('/^[a-z]{2,20}$/', (string)($d['piano'] ?? '')) ? $d['piano'] : '',
];
file_put_contents("$pasta/$id.json", json_encode($pedido, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);

// aviso por email ao dono do jogo (opcional: defina EMAIL_AVVISI no config.php)
if (defined('EMAIL_AVVISI') && EMAIL_AVVISI) {
    @mail(EMAIL_AVVISI, "Nuova richiesta: $nome ($prodotto)", "Pedido $id\n$nome · $prodotto · ISTAT $istat\nRode: node strumenti/amministra.mjs negozi", 'From: ' . EMAIL_AVVISI);
}
resposta(200, ['ok' => true, 'id' => $id]);
