<?php
/**
 * API Configuration
 * Load environment variables and initialize Supabase client
 */

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

// Load .env file if exists (production should use server environment variables)
if (file_exists(__DIR__ . '/.env')) {
    $env = parse_ini_file(__DIR__ . '/.env');
    foreach ($env as $key => $value) {
        if (!getenv($key)) {
            putenv("$key=$value");
        }
    }
}

// Supabase credentials from environment (MUST be set in .env on production)
$supabaseUrl = getenv('SUPABASE_URL');
$supabaseKey = getenv('SUPABASE_KEY');

if (!$supabaseUrl || !$supabaseKey) {
    http_response_code(500);
    die(json_encode(['error' => 'Supabase credentials not configured. Please set SUPABASE_URL and SUPABASE_KEY in .env']));
}

define('SUPABASE_URL', $supabaseUrl);
define('SUPABASE_KEY', $supabaseKey);

// Cache configuration
define('CACHE_TTL', (int)getenv('CACHE_TTL') ?: 300);
define('CACHE_DIR', getenv('CACHE_DIR') ?: __DIR__ . '/cache');

// Ensure cache directory exists
if (!is_dir(CACHE_DIR)) {
    mkdir(CACHE_DIR, 0755, true);
}

/**
 * Make HTTP request to Supabase API using cURL
 */
function supabaseRequest($method, $table, $params = []) {
    $url = SUPABASE_URL . '/rest/v1/' . $table;

    $ch = curl_init();

    $headers = [
        'apikey: ' . SUPABASE_KEY,
        'Authorization: Bearer ' . SUPABASE_KEY,
        'Content-Type: application/json'
    ];

    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 10,
        CURLOPT_CUSTOMREQUEST => $method
    ]);

    if (!empty($params)) {
        if ($method === 'GET') {
            curl_setopt($ch, CURLOPT_URL, $url . '?' . http_build_query($params));
        } else {
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($params));
        }
    }

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if ($error) {
        throw new Exception("cURL Error: $error");
    }

    if ($httpCode >= 400) {
        error_log("Supabase HTTP Error: $httpCode. Response: " . $response);
    }

    if (!$response) {
        return [];
    }

    return json_decode($response, true) ?? [];
}

/**
 * Simple file-based cache for reducing API calls
 */
function getCacheKey($prefix, $params = []) {
    return md5($prefix . json_encode($params));
}

function getFromCache($key) {
    $cacheFile = CACHE_DIR . '/' . $key . '.cache';

    if (file_exists($cacheFile)) {
        $cached = json_decode(file_get_contents($cacheFile), true);
        if (isset($cached['expires']) && $cached['expires'] > time()) {
            return $cached['data'];
        }
        unlink($cacheFile);
    }

    return null;
}

function saveToCache($key, $data) {
    $cacheFile = CACHE_DIR . '/' . $key . '.cache';
    $cached = [
        'data' => $data,
        'expires' => time() + CACHE_TTL
    ];
    file_put_contents($cacheFile, json_encode($cached), LOCK_EX);
}
