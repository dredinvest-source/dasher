<?php
/**
 * Authentication and Authorization
 * Verify Telegram user and get permissions
 */

require_once __DIR__ . '/config.php';

/**
 * Get Telegram user from JavaScript (passed via header or POST)
 */
function getTelegramUser() {
    // Try to get from POST data (sent from JS)
    $data = json_decode(file_get_contents('php://input'), true) ?? [];

    if (isset($data['tg_id'])) {
        return ['id' => $data['tg_id']];
    }

    // Try to get from query parameter (for testing)
    if (isset($_GET['tg_id'])) {
        return ['id' => (int)$_GET['tg_id']];
    }

    return null;
}

/**
 * Verify user and get permissions from database
 */
function verifyTelegramUser() {
    $tgUser = getTelegramUser();

    if (!$tgUser || !isset($tgUser['id'])) {
        error_log("DEBUG: getTelegramUser failed or no ID: " . json_encode($tgUser));
        return null;
    }

    $tgId = $tgUser['id'];
    error_log("DEBUG: Telegram ID received: " . $tgId);

    try {
        $response = supabaseRequest('GET', 'user_permissions', [
            'tg_id' => 'eq.' . $tgId,
            'limit' => 1
        ]);

        error_log("DEBUG: Supabase response: " . json_encode($response));

        if (is_array($response) && count($response) > 0) {
            $user = $response[0];
            error_log("DEBUG: User found: " . json_encode($user));

            // Перевіряємо чи має доступ до дашborду
            if (!isset($user['dashboard'])) {
                error_log("DEBUG: 'dashboard' field not found in user data");
                return null;
            }

            if ($user['dashboard'] !== true && $user['dashboard'] !== 1) {
                error_log("DEBUG: dashboard is " . json_encode($user['dashboard']) . ", expected true/1");
                return null;
            }

            return $user;
        } else {
            error_log("DEBUG: No user found in database for tg_id=" . $tgId);
        }
    } catch (Exception $e) {
        error_log("Auth error: " . $e->getMessage());
    }

    return null;
}

/**
 * Get promoter IDs from user permissions
 */
function getPromoterIds($userRecord) {
    // Якщо браузер (немає tg_id) - не фільтрувати дані
    if ($userRecord === true) {
        return null;
    }

    if (!$userRecord || !isset($userRecord['promoter_id'])) {
        return null;
    }

    $pids = $userRecord['promoter_id'];

    // Handle different formats
    if (is_string($pids)) {
        try {
            $pids = json_decode($pids, true);
        } catch (Exception $e) {
            $pids = array_map('trim', explode(',', $pids));
        }
    } elseif (is_numeric($pids)) {
        $pids = [(int)$pids];
    }

    if (is_array($pids)) {
        $result = array_map('intval', array_filter($pids, fn($id) => is_numeric($id) && $id > 0));
        return !empty($result) ? $result : null;
    }

    return null;
}

/**
 * Require authentication
 * - Браузер (без tg_id): дай доступ
 * - Mini App (з tg_id): перевір дозволи
 */
function requireAuth() {
    $tgUser = getTelegramUser();

    // Якщо немає tg_id (браузер) - дай безумовний доступ
    if (!$tgUser || !isset($tgUser['id'])) {
        error_log("DEBUG: No tg_id provided - assuming browser access, granting access");
        return true;
    }

    // Якщо є tg_id (Mini App) - перевір дозволи в БД
    $user = verifyTelegramUser();

    if (!$user) {
        error_log("DEBUG: verifyTelegramUser failed for tg_id=" . $tgUser['id']);
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        exit;
    }

    return $user;
}
