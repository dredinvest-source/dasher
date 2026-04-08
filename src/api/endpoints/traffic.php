<?php
/**
 * API Endpoint: /api/endpoints/traffic.php
 * Returns traffic sources statistics
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../auth.php';

$user = requireAuth();
$promoterIds = getPromoterIds($user);

$start = $_GET['start'] ?? date('Y-m-d');
$end = $_GET['end'] ?? date('Y-m-d');

$cacheKey = getCacheKey("traffic", ['start' => $start, 'end' => $end, 'promoter_id' => $promoterIds]);
$cached = getFromCache($cacheKey);

if ($cached) {
    echo json_encode($cached);
    exit;
}

try {
    $params = [
        'visit_date' => "gte.$start,lte.$end",
        'select' => 'visit_date, source_medium, total_users',
        'order' => 'visit_date.asc'
    ];

    if ($promoterIds) {
        $params['promoter_id'] = 'in.(' . implode(',', $promoterIds) . ')';
    }

    $data = supabaseRequest('GET', 'traffic_sources_stats', $params);

    // Group by date and source
    $grouped = [];
    $sources = [];
    $dates = [];

    foreach ($data as $item) {
        $date = $item['visit_date'] ?? '';
        $source = $item['source_medium'] ?? 'unknown';
        $users = (int)($item['total_users'] ?? 0);

        if (!in_array($date, $dates)) $dates[] = $date;
        if (!in_array($source, $sources)) $sources[] = $source;

        if (!isset($grouped[$date])) $grouped[$date] = [];
        $grouped[$date][$source] = $users;
    }

    $result = ['grouped' => $grouped, 'sources' => $sources, 'dates' => $dates];

    saveToCache($cacheKey, $result);
    echo json_encode($result);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
