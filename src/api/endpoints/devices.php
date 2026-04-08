<?php
/**
 * API Endpoint: /api/endpoints/devices.php
 * Returns device statistics
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../auth.php';

$user = requireAuth();
$promoterIds = getPromoterIds($user);

$start = $_GET['start'] ?? date('Y-m-d');
$end = $_GET['end'] ?? date('Y-m-d');

$cacheKey = getCacheKey("devices", ['start' => $start, 'end' => $end, 'promoter_id' => $promoterIds]);
$cached = getFromCache($cacheKey);

if ($cached) {
    echo json_encode($cached);
    exit;
}

try {
    $params = [
        'visit_date' => "gte.$start,lte.$end",
        'select' => 'device_category, total_users'
    ];

    if ($promoterIds) {
        $params['promoter_id'] = 'in.(' . implode(',', $promoterIds) . ')';
    }

    $data = supabaseRequest('GET', 'device_stats', $params);

    $stats = ['mobile' => 0, 'desktop' => 0, 'tablet' => 0, 'smart tv' => 0];

    foreach ($data as $item) {
        $cat = strtolower($item['device_category'] ?? '');
        if (isset($stats[$cat])) {
            $stats[$cat] += (int)($item['total_users'] ?? 0);
        }
    }

    saveToCache($cacheKey, $stats);
    echo json_encode($stats);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
