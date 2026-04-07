<?php

require_once __DIR__ . '/../vendor/autoload.php';

use Dotenv\Dotenv;
use App\SupabaseService;
use App\TelegramAuth;

// Завантажуємо змінні оточення
$dotenv = Dotenv::createImmutable(__DIR__ . '/../');
$dotenv->load();

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *'); // Увага: для продакшену вкажіть конкретні домени
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Telegram-Init-Data');

// Обробка OPTIONS запитів (preflight для CORS)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$supabaseUrl = $_ENV['SUPABASE_URL'] ?? null;
$supabaseKey = $_ENV['SUPABASE_KEY'] ?? null;
$telegramBotToken = $_ENV['TELEGRAM_BOT_TOKEN'] ?? null;

if (!$supabaseUrl || !$supabaseKey || !$telegramBotToken) {
    http_response_code(500);
    echo json_encode(['error' => 'Server configuration error: Missing environment variables.']);
    exit();
}

$supabase = new SupabaseService($supabaseUrl, $supabaseKey);
$telegramAuth = new TelegramAuth($telegramBotToken);

// Отримуємо initData з заголовка
$initData = $_SERVER['HTTP_X_TELEGRAM_INIT_DATA'] ?? '';
$tgUser = false;

if (!empty($initData)) {
    $tgUser = $telegramAuth->validateInitData($initData);
}

// Якщо це не Telegram WebApp або initData не валідна, можемо встановити режим "адміна"
// або відхилити запит, залежно від вашої логіки.
// Для простоти, якщо initData не валідна, ми вважаємо, що це не авторизований запит.
// Якщо initData відсутня, ми можемо дозволити доступ для розробки/адміна.
$isTelegramUser = ($tgUser !== false);
$isAdminMode = !$isTelegramUser && empty($initData); // Якщо немає initData, вважаємо адміном

// Маршрутизація запитів
$requestUri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$path = str_replace('/api', '', $requestUri); // Припускаємо, що API доступний за /api

// --- Допоміжна функція для отримання дозволів ---
function getUserPermissions($supabase, $tgUser, $isAdminMode) {
    if ($isAdminMode) {
        // Для адмін-режиму (без initData) надаємо повні права
        return [
            'promoter_id' => null, 'dashboard' => true, 'top_stats' => true, 'sales_charts' => true, 'users' => true, 'devices' => true, 'recent_orders' => true,
            'cities' => true, 'gender' => true, 'top_events' => true, 'traffic_seo' => true, 'countries' => true, 'funnel' => true
        ];
    }

    if ($tgUser) {
        $userPermissionsResult = $supabase->selectSingle('user_permissions', '*', [
            'tg_id.eq' => $tgUser['id']
        ]);
        if ($userPermissionsResult['error']) {
            error_log("Failed to fetch user permissions for TG ID " . $tgUser['id'] . ": " . json_encode($userPermissionsResult['error']));
            return null;
        }
        return $userPermissionsResult['data'];
    }
    return null;
}

// --- Ендпоінт для автентифікації ---
if ($path === '/auth/telegram' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    if ($tgUser || $isAdminMode) {
        $permissions = getUserPermissions($supabase, $tgUser, $isAdminMode);

        if (!$permissions || !($permissions['dashboard'] ?? false)) {
            http_response_code(403);
            echo json_encode(['error' => 'Access denied or no dashboard permissions.', 'user' => $tgUser]);
            exit();
        }

        echo json_encode(['success' => true, 'user' => $tgUser, 'permissions' => $permissions]);
    } else {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid Telegram initData or not in admin mode.']);
    }
    exit();
}

// --- Перевірка дозволів для всіх інших API ендпоінтів ---
$userPermissions = getUserPermissions($supabase, $tgUser, $isAdminMode);
if (!$userPermissions || !($userPermissions['dashboard'] ?? false)) {
    http_response_code(403);
    echo json_encode(['error' => 'Access denied. User not authenticated or lacks dashboard permissions.']);
    exit();
}

// --- Допоміжна функція для отримання promoter_ids ---
function getPromoterIdsFromPermissions($userPermissions) {
    $pids = $userPermissions['promoter_id'] ?? null;
    if (is_string($pids)) {
        try { $pids = json_decode($pids, true); } catch (\Exception $e) { $pids = explode(',', $pids); }
    }
    if (is_numeric($pids)) { $pids = [$pids]; }
    return is_array($pids) ? array_filter(array_map('intval', $pids), fn($id) => $id > 0) : null;
}

$promoterIds = getPromoterIdsFromPermissions($userPermissions);
$isPromoterMode = !empty($promoterIds);

// --- Ендпоінт для sales-stats ---
if ($path === '/dashboard/sales-stats' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    if (!($userPermissions['top_stats'] ?? false)) {
        http_response_code(403);
        echo json_encode(['error' => 'Access denied for sales stats.']);
        exit();
    }

    $startDate = $_GET['start_date'] ?? null;
    $endDate = $_GET['end_date'] ?? null;
    $prevStartDate = $_GET['prev_start_date'] ?? null;
    $prevEndDate = $_GET['prev_end_date'] ?? null;

    if (!$startDate || !$endDate || !$prevStartDate || !$prevEndDate) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing date parameters.']);
        exit();
    }

    $filtersCurrent = ['visit_date.gte' => $startDate, 'visit_date.lte' => $endDate];
    $filtersPrevious = ['visit_date.gte' => $prevStartDate, 'visit_date.lte' => $prevEndDate];

    if ($isPromoterMode) {
        $currentOrders = [];
        $offset = 0;
        $limit = 1000;
        while (true) {
            $currentResult = $supabase->selectWithRange('orders', 'tickets_count, subtotal_amount, seller_id', array_merge($filtersCurrent, ['promoterId.in' => '(' . implode(',', $promoterIds) . ')']), $offset, $offset + $limit - 1);
            if ($currentResult['error']) {
                http_response_code(500);
                echo json_encode(['error' => 'Supabase error fetching current orders', 'details' => $currentResult['error']]);
                exit();
            }
            $currentOrders = array_merge($currentOrders, $currentResult['data']);
            if (count($currentResult['data']) < $limit) break;
            $offset += $limit;
        }

        $previousOrders = [];
        $offset = 0;
        while (true) {
            $previousResult = $supabase->selectWithRange('orders', 'tickets_count, subtotal_amount, seller_id', array_merge($filtersPrevious, ['promoterId.in' => '(' . implode(',', $promoterIds) . ')']), $offset, $offset + $limit - 1);
            if ($previousResult['error']) {
                http_response_code(500);
                echo json_encode(['error' => 'Supabase error fetching previous orders', 'details' => $previousResult['error']]);
                exit();
            }
            $previousOrders = array_merge($previousOrders, $previousResult['data']);
            if (count($previousResult['data']) < $limit) break;
            $offset += $limit;
        }
        echo json_encode(['current' => $currentOrders, 'previous' => $previousOrders, 'promoter_mode' => true]);

    } else {
        $currentResult = $supabase->select('portal_sales_daily', '*', $filtersCurrent);
        $previousResult = $supabase->select('portal_sales_daily', '*', $filtersPrevious);

        if ($currentResult['error'] || $previousResult['error']) {
            http_response_code(500);
            echo json_encode(['error' => 'Supabase error fetching portal sales daily', 'details' => $currentResult['error'] ?? $previousResult['error']]);
            exit();
        }
        echo json_encode(['current' => $currentResult['data'], 'previous' => $previousResult['data'], 'promoter_mode' => false]);
    }
    exit();
}

// --- Ендпоінт для general-stats ---
if ($path === '/dashboard/general-stats' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    if (!($userPermissions['top_stats'] ?? false)) {
        http_response_code(403);
        echo json_encode(['error' => 'Access denied for general stats.']);
        exit();
    }
    $startDate = $_GET['start_date'] ?? null;
    $endDate = $_GET['end_date'] ?? null;
    $prevStartDate = $_GET['prev_start_date'] ?? null;
    $prevEndDate = $_GET['prev_end_date'] ?? null;

    if (!$startDate || !$endDate || !$prevStartDate || !$prevEndDate) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing date parameters.']);
        exit();
    }

    $currFilters = ['visit_date.gte' => $startDate, 'visit_date.lte' => $endDate];
    $prevFilters = ['visit_date.gte' => $prevStartDate, 'visit_date.lte' => $prevEndDate];

    if ($isPromoterMode) {
        $currFilters['promoter_id.in'] = '(' . implode(',', $promoterIds) . ')';
        $prevFilters['promoter_id.in'] = '(' . implode(',', $promoterIds) . ')';
    }

    $currResult = $supabase->select('google_analytics_daily', 'total_users, user_type', $currFilters);
    $prevResult = $supabase->select('google_analytics_daily', 'total_users', $prevFilters);

    if ($currResult['error'] || $prevResult['error']) {
        http_response_code(500);
        echo json_encode(['error' => 'Supabase error fetching general stats', 'details' => $currResult['error'] ?? $prevResult['error']]);
        exit();
    }
    echo json_encode(['current' => $currResult['data'], 'previous' => $prevResult['data']]);
    exit();
}

// --- Ендпоінт для sales-charts ---
if ($path === '/dashboard/sales-charts' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    if (!($userPermissions['sales_charts'] ?? false)) {
        http_response_code(403);
        echo json_encode(['error' => 'Access denied for sales charts.']);
        exit();
    }
    $chartStartISO = $_GET['chart_start_date'] ?? null;
    if (!$chartStartISO) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing chart_start_date parameter.']);
        exit();
    }

    if ($isPromoterMode) {
        $data = [];
        $offset = 0;
        $limit = 1000;
        while (true) {
            $result = $supabase->selectWithRange('orders', 'visit_date, subtotal_amount, tickets_count, seller_id', ['visit_date.gte' => $chartStartISO, 'promoterId.in' => '(' . implode(',', $promoterIds) . ')'], $offset, $offset + $limit - 1);
            if ($result['error']) {
                http_response_code(500);
                echo json_encode(['error' => 'Supabase error fetching orders for charts', 'details' => $result['error']]);
                exit();
            }
            $data = array_merge($data, $result['data']);
            if (count($result['data']) < $limit) break;
            $offset += $limit;
        }
        echo json_encode(['data' => $data, 'promoter_mode' => true]);
    } else {
        $result = $supabase->select('portal_sales_daily', 'visit_date, total_revenue, total_orders, total_tickets, report_type', ['visit_date.gte' => $chartStartISO]);
        if ($result['error']) {
            http_response_code(500);
            echo json_encode(['error' => 'Supabase error fetching portal sales daily for charts', 'details' => $result['error']]);
            exit();
        }
        echo json_encode(['data' => $result['data'], 'promoter_mode' => false]);
    }
    exit();
}

// --- Ендпоінт для device-stats ---
if ($path === '/dashboard/device-stats' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    if (!($userPermissions['devices'] ?? false)) {
        http_response_code(403);
        echo json_encode(['error' => 'Access denied for device stats.']);
        exit();
    }
    $startDate = $_GET['start_date'] ?? null;
    $endDate = $_GET['end_date'] ?? null;
    if (!$startDate || !$endDate) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing date parameters.']);
        exit();
    }
    $filters = ['visit_date.gte' => $startDate, 'visit_date.lte' => $endDate];
    if ($isPromoterMode) {
        $filters['promoter_id.in'] = '(' . implode(',', $promoterIds) . ')';
    }
    $result = $supabase->select('device_stats', 'device_category, total_users', $filters);
    if ($result['error']) {
        http_response_code(500);
        echo json_encode(['error' => 'Supabase error fetching device stats', 'details' => $result['error']]);
        exit();
    }
    echo json_encode(['data' => $result['data']]);
    exit();
}

// --- Ендпоінт для orders-table ---
if ($path === '/dashboard/orders-table' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    if (!($userPermissions['recent_orders'] ?? false)) {
        http_response_code(403);
        echo json_encode(['error' => 'Access denied for recent orders.']);
        exit();
    }
    $startDate = $_GET['start_date'] ?? null;
    $endDate = $_GET['end_date'] ?? null;
    if (!$startDate || !$endDate) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing date parameters.']);
        exit();
    }
    $filters = ['visit_date.gte' => $startDate, 'visit_date.lte' => $endDate];
    if ($isPromoterMode) {
        $filters['promoterId.in'] = '(' . implode(',', $promoterIds) . ')';
    }
    $result = $supabase->select('orders', '*', $filters, 10, null, 'date_created', false);
    if ($result['error']) {
        http_response_code(500);
        echo json_encode(['error' => 'Supabase error fetching recent orders', 'details' => $result['error']]);
        exit();
    }
    echo json_encode(['data' => $result['data']]);
    exit();
}

// --- Ендпоінт для city-stats ---
if ($path === '/dashboard/city-stats' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    if (!($userPermissions['cities'] ?? false)) {
        http_response_code(403);
        echo json_encode(['error' => 'Access denied for city stats.']);
        exit();
    }
    $startDate = $_GET['start_date'] ?? null;
    $endDate = $_GET['end_date'] ?? null;
    if (!$startDate || !$endDate) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing date parameters.']);
        exit();
    }
    $filters = ['visit_date.gte' => $startDate, 'visit_date.lte' => $endDate];
    if ($isPromoterMode) {
        $filters['promoter_id.in'] = '(' . implode(',', $promoterIds) . ')';
    }
    $result = $supabase->select('city_stats', 'city_ua, city_name, total_users, region_code, region_ua', $filters);
    if ($result['error']) {
        http_response_code(500);
        echo json_encode(['error' => 'Supabase error fetching city stats', 'details' => $result['error']]);
        exit();
    }
    echo json_encode(['data' => $result['data']]);
    exit();
}

// --- Ендпоінт для gender-stats ---
if ($path === '/dashboard/gender-stats' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    if (!($userPermissions['gender'] ?? false)) {
        http_response_code(403);
        echo json_encode(['error' => 'Access denied for gender stats.']);
        exit();
    }
    $startDate = $_GET['start_date'] ?? null;
    $endDate = $_GET['end_date'] ?? null;
    if (!$startDate || !$endDate) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing date parameters.']);
        exit();
    }
    $filters = ['visit_date.gte' => $startDate, 'visit_date.lte' => $endDate];
    if ($isPromoterMode) {
        $filters['promoter_id.in'] = '(' . implode(',', $promoterIds) . ')';
    }
    $result = $supabase->select('gender_stats', 'user_gender, total_users', $filters);
    if ($result['error']) {
        http_response_code(500);
        echo json_encode(['error' => 'Supabase error fetching gender stats', 'details' => $result['error']]);
        exit();
    }
    echo json_encode(['data' => $result['data']]);
    exit();
}

// --- Ендпоінт для top-events ---
if ($path === '/dashboard/top-events' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    if (!($userPermissions['top_events'] ?? false)) {
        http_response_code(403);
        echo json_encode(['error' => 'Access denied for top events.']);
        exit();
    }
    $startDate = $_GET['start_date'] ?? null;
    $endDate = $_GET['end_date'] ?? null;
    if (!$startDate || !$endDate) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing date parameters.']);
        exit();
    }
    $filters = ['visit_date.gte' => $startDate, 'visit_date.lte' => $endDate];
    if ($isPromoterMode) {
        $filters['promoterId.in'] = '(' . implode(',', $promoterIds) . ')';
    }
    // Fetch all orders for the period to aggregate on backend
    $allOrders = [];
    $offset = 0;
    $limit = 1000;
    while (true) {
        $result = $supabase->selectWithRange('orders', 'title, subtotal_amount, tickets_count', $filters, $offset, $offset + $limit - 1);
        if ($result['error']) {
            http_response_code(500);
            echo json_encode(['error' => 'Supabase error fetching all orders for top events', 'details' => $result['error']]);
            exit();
        }
        $allOrders = array_merge($allOrders, $result['data']);
        if (count($result['data']) < $limit) break;
        $offset += $limit;
    }

    $eventsMap = [];
    foreach ($allOrders as $order) {
        $name = trim($order['title'] ?? 'Невідома подія');
        if (!isset($eventsMap[$name])) {
            $eventsMap[$name] = ['tickets' => 0, 'totalRevenue' => 0];
        }
        $eventsMap[$name]['tickets'] += (int)($order['tickets_count'] ?? 0);
        $eventsMap[$name]['totalRevenue'] += (float)($order['subtotal_amount'] ?? 0);
    }

    $topEvents = array_map(function($title, $stats) {
        return ['title' => $title, 'tickets' => $stats['tickets'], 'totalRevenue' => $stats['totalRevenue']];
    }, array_keys($eventsMap), $eventsMap);

    usort($topEvents, function($a, $b) {
        return $b['tickets'] <=> $a['tickets'];
    });

    echo json_encode(['data' => array_slice($topEvents, 0, 10)]);
    exit();
}

// --- Ендпоінт для traffic-performance ---
if ($path === '/dashboard/traffic-performance' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    if (!($userPermissions['traffic_seo'] ?? false)) {
        http_response_code(403);
        echo json_encode(['error' => 'Access denied for traffic performance.']);
        exit();
    }
    $startDate = $_GET['start_date'] ?? null;
    $endDate = $_GET['end_date'] ?? null;
    if (!$startDate || !$endDate) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing date parameters.']);
        exit();
    }
    $filters = ['visit_date.gte' => $startDate, 'visit_date.lte' => $endDate];
    if ($isPromoterMode) {
        $filters['promoter_id.in'] = '(' . implode(',', $promoterIds) . ')';
    }
    $result = $supabase->select('traffic_sources_stats', '*', $filters, null, null, 'visit_date', true);
    if ($result['error']) {
        http_response_code(500);
        echo json_encode(['error' => 'Supabase error fetching traffic sources stats', 'details' => $result['error']]);
        exit();
    }
    echo json_encode(['data' => $result['data']]);
    exit();
}

// --- Ендпоінт для seo-charts ---
if ($path === '/dashboard/seo-charts' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    if (!($userPermissions['traffic_seo'] ?? false)) {
        http_response_code(403);
        echo json_encode(['error' => 'Access denied for SEO charts.']);
        exit();
    }
    $chartStartISO = $_GET['chart_start_date'] ?? null;
    if (!$chartStartISO) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing chart_start_date parameter.']);
        exit();
    }
    $filters = ['visit_date.gte' => $chartStartISO];
    if ($isPromoterMode) {
        $filters['prom_id.in'] = '(' . implode(',', $promoterIds) . ')';
    }
    $result = $supabase->select('seo_performance_daily', '*', $filters);
    if ($result['error']) {
        http_response_code(500);
        echo json_encode(['error' => 'Supabase error fetching SEO performance daily', 'details' => $result['error']]);
        exit();
    }
    echo json_encode(['data' => $result['data']]);
    exit();
}

// --- Ендпоінт для country-stats ---
if ($path === '/dashboard/country-stats' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    if (!($userPermissions['countries'] ?? false)) {
        http_response_code(403);
        echo json_encode(['error' => 'Access denied for country stats.']);
        exit();
    }
    $startDate = $_GET['start_date'] ?? null;
    $endDate = $_GET['end_date'] ?? null;
    if (!$startDate || !$endDate) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing date parameters.']);
        exit();
    }
    $filters = ['visit_date.gte' => $startDate, 'visit_date.lte' => $endDate];
    if ($isPromoterMode) {
        $filters['promoter_id.in'] = '(' . implode(',', $promoterIds) . ')';
    }
    $result = $supabase->select('country_stats', 'country_name, country_code, total_users', $filters);
    if ($result['error']) {
        http_response_code(500);
        echo json_encode(['error' => 'Supabase error fetching country stats', 'details' => $result['error']]);
        exit();
    }
    echo json_encode(['data' => $result['data']]);
    exit();
}

// --- Ендпоінт для conversion-funnel ---
if ($path === '/dashboard/conversion-funnel' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    if (!($userPermissions['funnel'] ?? false)) {
        http_response_code(403);
        echo json_encode(['error' => 'Access denied for conversion funnel.']);
        exit();
    }
    $startDate = $_GET['start_date'] ?? null;
    $endDate = $_GET['end_date'] ?? null;
    if (!$startDate || !$endDate) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing date parameters.']);
        exit();
    }
    $filters = ['visit_date.gte' => $startDate, 'visit_date.lte' => $endDate];
    if ($isPromoterMode) {
        $filters['promoter_id.in'] = '(' . implode(',', $promoterIds) . ')';
    }
    $result = $supabase->select('conversion_funnel_daily', '*', $filters, null, null, 'visit_date', true);
    if ($result['error']) {
        http_response_code(500);
        echo json_encode(['error' => 'Supabase error fetching conversion funnel', 'details' => $result['error']]);
        exit();
    }
    echo json_encode(['data' => $result['data']]);
    exit();
}

// Якщо маршрут не знайдено
http_response_code(404);
echo json_encode(['error' => 'Not Found']);