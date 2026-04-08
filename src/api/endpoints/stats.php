<?php
/**
 * API Endpoint: /api/endpoints/stats.php
 * Returns sales and general statistics
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../auth.php';

$user = requireAuth();
$promoterIds = getPromoterIds($user);

// Parse query parameters
$action = $_GET['action'] ?? 'sales';
$start = $_GET['start'] ?? date('Y-m-d', strtotime('-1 day'));
$end = $_GET['end'] ?? date('Y-m-d');
$prevStart = $_GET['prev_start'] ?? date('Y-m-d', strtotime('-2 day'));
$prevEnd = $_GET['prev_end'] ?? date('Y-m-d', strtotime('-1 day'));

// Cache key based on parameters
$cacheKey = getCacheKey("stats_$action", ['start' => $start, 'end' => $end, 'promoter_id' => $promoterIds]);
$cached = getFromCache($cacheKey);

if ($cached) {
    echo json_encode($cached);
    exit;
}

try {
    if ($action === 'sales') {
        // Get current period data
        $params = [
            'visit_date' => "gte." . $start . ",lte." . $end,
            'select' => 'tickets_count, subtotal_amount, seller_id'
        ];

        if ($promoterIds) {
            $params['promoterId'] = 'in.(' . implode(',', $promoterIds) . ')';
        }

        $currData = supabaseRequest('GET', 'orders', $params);

        // Get previous period data
        $prevParams = [
            'visit_date' => "gte." . $prevStart . ",lte." . $prevEnd,
            'select' => 'tickets_count, subtotal_amount, seller_id'
        ];

        if ($promoterIds) {
            $prevParams['promoterId'] = 'in.(' . implode(',', $promoterIds) . ')';
        }

        $prevData = supabaseRequest('GET', 'orders', $prevParams);

        // Group by seller
        $groupRawOrders = function($data) {
            $acc = [
                'all' => ['orders' => 0, 'revenue' => 0],
                'numotamo' => ['orders' => 0, 'revenue' => 0],
                'karabas' => ['orders' => 0, 'revenue' => 0],
                'mticket' => ['orders' => 0, 'revenue' => 0],
                'internet_bilet' => ['orders' => 0, 'revenue' => 0],
                'others' => ['orders' => 0, 'revenue' => 0]
            ];

            foreach ($data as $row) {
                $rev = (float)($row['subtotal_amount'] ?? 0);
                $sId = (int)($row['seller_id'] ?? 0);

                $acc['all']['orders'] += 1;
                $acc['all']['revenue'] += $rev;

                // SELLER_IDS from constants.js
                if ($sId === 344460) { // NUMOTAMO
                    $acc['numotamo']['orders'] += 1;
                    $acc['numotamo']['revenue'] += $rev;
                } elseif ($sId === 6617) { // KARABAS
                    $acc['karabas']['orders'] += 1;
                    $acc['karabas']['revenue'] += $rev;
                } elseif ($sId === 59153) { // MTICKET
                    $acc['mticket']['orders'] += 1;
                    $acc['mticket']['revenue'] += $rev;
                } elseif ($sId === 6618) { // INTERNET_BILET
                    $acc['internet_bilet']['orders'] += 1;
                    $acc['internet_bilet']['revenue'] += $rev;
                } else {
                    $acc['others']['orders'] += 1;
                    $acc['others']['revenue'] += $rev;
                }
            }

            return $acc;
        };

        $currPeriod = $groupRawOrders($currData);
        $prevPeriod = $groupRawOrders($prevData);

        $result = ['current' => $currPeriod, 'previous' => $prevPeriod];
    } else { // action === 'general'
        $params = [
            'visit_date' => "gte.$start,lte.$end",
            'select' => 'total_users, user_type'
        ];

        if ($promoterIds) {
            $params['promoter_id'] = 'in.(' . implode(',', $promoterIds) . ')';
        }

        $currData = supabaseRequest('GET', 'google_analytics_daily', $params);

        $prevParams = [
            'visit_date' => "gte.$prevStart,lte.$prevEnd",
            'select' => 'total_users'
        ];

        if ($promoterIds) {
            $prevParams['promoter_id'] = 'in.(' . implode(',', $promoterIds) . ')';
        }

        $prevData = supabaseRequest('GET', 'google_analytics_daily', $prevParams);

        $total = 0;
        $newUsers = 0;
        $returningUsers = 0;

        foreach ($currData as $row) {
            $count = (int)($row['total_users'] ?? 0);
            $type = strtolower(trim($row['user_type'] ?? ''));
            $total += $count;
            if ($type === 'new') $newUsers += $count;
            elseif ($type === 'returning') $returningUsers += $count;
        }

        $prevTotal = array_reduce($prevData, fn($sum, $row) => $sum + (int)($row['total_users'] ?? 0), 0);

        $result = [
            'current' => ['total' => $total, 'new' => $newUsers, 'returning' => $returningUsers],
            'previous' => ['total' => $prevTotal]
        ];
    }

    saveToCache($cacheKey, $result);
    echo json_encode($result);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
