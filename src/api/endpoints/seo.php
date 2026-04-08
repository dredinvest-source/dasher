<?php
/**
 * API Endpoint: /api/endpoints/seo.php
 * Returns SEO performance statistics
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../auth.php';

$user = requireAuth();
$promoterIds = getPromoterIds($user);

$start = $_GET['start'] ?? date('Y-m-d', strtotime('-30 day'));
$end = $_GET['end'] ?? date('Y-m-d');

$cacheKey = getCacheKey("seo", ['start' => $start, 'end' => $end, 'promoter_id' => $promoterIds]);
$cached = getFromCache($cacheKey);

if ($cached) {
    echo json_encode($cached);
    exit;
}

try {
    $params = [
        'visit_date' => "gte.$start,lte.$end",
        'select' => 'visit_date, google_search_clicks, google_search_impressions, google_search_avg_position, organic_ctr'
    ];

    if ($promoterIds) {
        $params['prom_id'] = 'in.(' . implode(',', $promoterIds) . ')';
    }

    $data = supabaseRequest('GET', 'seo_performance_daily', $params);

    $daysMap = [];
    $monthTotalPos = 0;
    $monthDays = 0;

    foreach ($data as $row) {
        if (!isset($row['visit_date'])) continue;

        $d = substr($row['visit_date'], 0, 10);
        $c = (int)($row['google_search_clicks'] ?? 0);
        $im = (int)($row['google_search_impressions'] ?? 0);
        $po = (float)($row['google_search_avg_position'] ?? 0);
        $ctr = ((float)($row['organic_ctr'] ?? 0)) * 100;

        if (!isset($daysMap[$d])) {
            $daysMap[$d] = ['clicks' => 0, 'impressions' => 0, 'position' => 0, 'ctr' => 0];
        }

        $daysMap[$d]['clicks'] += $c;
        $daysMap[$d]['impressions'] += $im;
        $daysMap[$d]['position'] = $daysMap[$d]['position'] ? (($daysMap[$d]['position'] + $po) / 2) : $po;
        $daysMap[$d]['ctr'] = $daysMap[$d]['ctr'] ? (($daysMap[$d]['ctr'] + $ctr) / 2) : $ctr;

        if ($po > 0) {
            $monthTotalPos += $po;
            $monthDays++;
        }
    }

    $avgPos = $monthDays > 0 ? ($monthTotalPos / $monthDays) : 0;
    $result = ['data' => $daysMap, 'avg_position' => $avgPos];

    saveToCache($cacheKey, $result);
    echo json_encode($result);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
