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
        return null;
    }

    $tgId = $tgUser['id'];

    try {
        $response = supabaseRequest('GET', 'user_permissions', [
            'tg_id' => 'eq.' . $tgId,
            'limit' => 1
        ]);

        if (is_array($response) && count($response) > 0) {
            $user = $response[0];

            // Перевіряємо чи має доступ до дашborду
            if (!isset($user['dashboard']) || $user['dashboard'] !== true) {
                return null;
            }

            return $user;
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
 */
function requireAuth() {
    $user = verifyTelegramUser();

    if (!$user) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        exit;
    }

    return $user;
}
