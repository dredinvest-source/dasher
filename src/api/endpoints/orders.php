<?php
/**
 * API Endpoint: /api/endpoints/orders.php
 * Returns orders data with pagination
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../auth.php';

$user = requireAuth();
$promoterIds = getPromoterIds($user);

$action = $_GET['action'] ?? 'recent'; // recent, all, chart
$start = $_GET['start'] ?? date('Y-m-d', strtotime('-30 day'));
$end = $_GET['end'] ?? date('Y-m-d');
$offset = (int)($_GET['offset'] ?? 0);
$limit = (int)($_GET['limit'] ?? 1000);
$select = $_GET['select'] ?? '*';

$cacheKey = getCacheKey("orders_$action", ['start' => $start, 'end' => $end, 'offset' => $offset, 'promoter_id' => $promoterIds]);
$cached = getFromCache($cacheKey);

if ($cached) {
    echo json_encode($cached);
    exit;
}

try {
    $params = [
        'visit_date' => "gte.$start,lte.$end",
        'select' => $select,
        'order' => 'date_created.desc',
        'offset' => $offset,
        'limit' => $limit
    ];

    if ($promoterIds) {
        $params['promoterId'] = 'in.(' . implode(',', $promoterIds) . ')';
    }

    $data = supabaseRequest('GET', 'orders', $params);

    saveToCache($cacheKey, $data);
    echo json_encode($data);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
