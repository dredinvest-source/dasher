<?php
/**
 * API Endpoint: /api/endpoints/countries.php
 * Returns country statistics
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../auth.php';

$user = requireAuth();
$promoterIds = getPromoterIds($user);

$start = $_GET['start'] ?? date('Y-m-d');
$end = $_GET['end'] ?? date('Y-m-d');

$cacheKey = getCacheKey("countries", ['start' => $start, 'end' => $end, 'promoter_id' => $promoterIds]);
$cached = getFromCache($cacheKey);

if ($cached) {
    echo json_encode($cached);
    exit;
}

try {
    $params = [
        'visit_date' => "gte.$start,lte.$end",
        'select' => 'country_name, country_code, total_users'
    ];

    if ($promoterIds) {
        $params['promoter_id'] = 'in.(' . implode(',', $promoterIds) . ')';
    }

    $data = supabaseRequest('GET', 'country_stats', $params);

    $aggregated = [];

    foreach ($data as $item) {
        $name = (trim($item['country_name'] ?? '') !== '') ? $item['country_name'] : '(not set)';
        $code = $item['country_code'] ?? null;
        $users = (int)($item['total_users'] ?? 0);

        if (!isset($aggregated[$name])) {
            $aggregated[$name] = ['name' => $name, 'code' => $code, 'users' => 0];
        }
        $aggregated[$name]['users'] += $users;
    }

    saveToCache($cacheKey, $aggregated);
    echo json_encode($aggregated);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
