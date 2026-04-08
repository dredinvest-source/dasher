<?php
/**
 * API Endpoint: /api/endpoints/cities.php
 * Returns city statistics
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../auth.php';

$user = requireAuth();
$promoterIds = getPromoterIds($user);

$start = $_GET['start'] ?? date('Y-m-d');
$end = $_GET['end'] ?? date('Y-m-d');

$cacheKey = getCacheKey("cities", ['start' => $start, 'end' => $end, 'promoter_id' => $promoterIds]);
$cached = getFromCache($cacheKey);

if ($cached) {
    echo json_encode($cached);
    exit;
}

try {
    $params = [
        'visit_date' => "gte.$start,lte.$end",
        'select' => 'city_ua, city_name, total_users, region_code, region_ua'
    ];

    if ($promoterIds) {
        $params['promoter_id'] = 'in.(' . implode(',', $promoterIds) . ')';
    }

    $data = supabaseRequest('GET', 'city_stats', $params);

    $cityData = [];
    $mapData = [];

    foreach ($data as $item) {
        $users = (int)($item['total_users'] ?? 0);
        $region = $item['region_code'] ?? null;
        $regionUa = $item['region_ua'] ?? null;

        if ($regionUa) {
            $cityData[$regionUa] = ($cityData[$regionUa] ?? 0) + $users;
        }

        if ($region) {
            if (!isset($mapData[$region])) {
                $mapData[$region] = ['value' => 0, 'cities' => [], 'uaName' => $regionUa];
            }
            $mapData[$region]['value'] += $users;

            $cityName = $item['city_ua'] ?? null;
            if ($cityName && !in_array($cityName, $mapData[$region]['cities'])) {
                $mapData[$region]['cities'][] = $cityName;
            }
        }
    }

    $result = ['cities' => $cityData, 'map' => $mapData];

    saveToCache($cacheKey, $result);
    echo json_encode($result);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
