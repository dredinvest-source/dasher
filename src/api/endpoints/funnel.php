<?php
/**
 * API Endpoint: /api/endpoints/funnel.php
 * Returns conversion funnel statistics
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../auth.php';

$user = requireAuth();
$promoterIds = getPromoterIds($user);

$start = $_GET['start'] ?? date('Y-m-d');
$end = $_GET['end'] ?? date('Y-m-d');

$cacheKey = getCacheKey("funnel", ['start' => $start, 'end' => $end, 'promoter_id' => $promoterIds]);
$cached = getFromCache($cacheKey);

if ($cached) {
    echo json_encode($cached);
    exit;
}

try {
    $params = [
        'visit_date' => "gte.$start",
        'visit_date' => "lte.$end",
        'select' => 'views, booking_view, carts, checkouts, purchases'
    ];

    if ($promoterIds) {
        $params['promoter_id'] = 'in.(' . implode(',', $promoterIds) . ')';
    }

    $data = supabaseRequest('GET', 'conversion_funnel_daily', $params);

    $totals = ['views' => 0, 'booking_view' => 0, 'carts' => 0, 'checkouts' => 0, 'purchases' => 0];

    foreach ($data as $row) {
        $totals['views'] += (int)($row['views'] ?? 0);
        $totals['booking_view'] += (int)($row['booking_view'] ?? 0);
        $totals['carts'] += (int)($row['carts'] ?? 0);
        $totals['checkouts'] += (int)($row['checkouts'] ?? 0);
        $totals['purchases'] += (int)($row['purchases'] ?? 0);
    }

    saveToCache($cacheKey, $totals);
    echo json_encode($totals);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
