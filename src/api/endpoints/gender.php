<?php
/**
 * API Endpoint: /api/endpoints/gender.php
 * Returns gender statistics
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../auth.php';

$user = requireAuth();
$promoterIds = getPromoterIds($user);

$start = $_GET['start'] ?? date('Y-m-d');
$end = $_GET['end'] ?? date('Y-m-d');

$cacheKey = getCacheKey("gender", ['start' => $start, 'end' => $end, 'promoter_id' => $promoterIds]);
$cached = getFromCache($cacheKey);

if ($cached) {
    echo json_encode($cached);
    exit;
}

try {
    $params = [
        'visit_date' => "gte.$start,lte.$end",
        'select' => 'user_gender, total_users'
    ];

    if ($promoterIds) {
        $params['promoter_id'] = 'in.(' . implode(',', $promoterIds) . ')';
    }

    $data = supabaseRequest('GET', 'gender_stats', $params);

    $aggregated = ['male' => 0, 'female' => 0, 'unknown' => 0];

    foreach ($data as $item) {
        $g = strtolower($item['user_gender'] ?? '');
        if (isset($aggregated[$g])) {
            $aggregated[$g] += (int)($item['total_users'] ?? 0);
        }
    }

    saveToCache($cacheKey, $aggregated);
    echo json_encode($aggregated);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
