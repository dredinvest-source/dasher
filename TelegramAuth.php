<?php

namespace App;

class TelegramAuth
{
    private string $botToken;

    public function __construct(string $botToken)
    {
        $this->botToken = $botToken;
    }

    /**
     * Validates Telegram WebApp initData.
     * @param string $initData The initData string received from Telegram WebApp.
     * @return array|false Returns decoded user data if valid, false otherwise.
     */
    public function validateInitData(string $initData): array|false
    {
        $pairs = explode('&', $initData);
        $dataCheckString = [];
        $hash = '';

        foreach ($pairs as $pair) {
            list($key, $value) = explode('=', $pair, 2);
            $value = urldecode($value);

            if ($key === 'hash') {
                $hash = $value;
            } else {
                $dataCheckString[] = $key . '=' . $value;
            }
        }

        sort($dataCheckString);
        $dataCheckString = implode("\n", $dataCheckString);

        $secretKey = hash_hmac('sha256', $this->botToken, 'WebAppData', true);
        $calculatedHash = hash_hmac('sha256', $dataCheckString, $secretKey);

        if ($calculatedHash === $hash) {
            return json_decode(urldecode(str_replace('user=', '', $initData)), true)['user'] ?? [];
        }
        return false;
    }
}