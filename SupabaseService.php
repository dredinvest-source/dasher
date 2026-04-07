<?php

namespace App;

class SupabaseService
{
    private string $supabaseUrl;
    private string $supabaseKey;

    public function __construct(string $url, string $key)
    {
        $this->supabaseUrl = $url;
        $this->supabaseKey = $key;
    }

    private function makeRequest(string $method, string $path, array $params = [], array $body = null, array $extraHeaders = []): array
    {
        $url = $this->supabaseUrl . '/rest/v1/' . $path;
        if (!empty($params)) {
            $url .= '?' . http_build_query($params);
        }

        $headers = [
            'apikey: ' . $this->supabaseKey,
            'Authorization: Bearer ' . $this->supabaseKey,
            'Content-Type: application/json',
            'Accept: application/json'
        ];

        $headers = array_merge($headers, $extraHeaders);

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

        if ($method === 'POST') {
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
        } elseif ($method === 'PATCH') {
            curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PATCH');
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
        } elseif ($method === 'PUT') {
            curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PUT');
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
        } elseif ($method === 'DELETE') {
            curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'DELETE');
        }

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($error) {
            error_log("cURL Error: " . $error);
            return ['data' => null, 'error' => ['message' => 'cURL Error: ' . $error, 'code' => $httpCode]];
        }

        $decodedResponse = json_decode($response, true);

        if ($httpCode >= 400) {
            return ['data' => null, 'error' => $decodedResponse ?? ['message' => 'Unknown error', 'code' => $httpCode]];
        }

        return ['data' => $decodedResponse, 'error' => null];
    }

    public function select(string $table, string $columns = '*', array $filters = [], int $limit = null, int $offset = null, string $orderBy = null, bool $ascending = true): array
    {
        $params = ['select' => $columns];
        foreach ($filters as $key => $value) {
            $params[$key] = $value;
        }
        if ($limit !== null) {
            $params['limit'] = $limit;
        }
        if ($offset !== null) {
            $params['offset'] = $offset;
        }
        if ($orderBy !== null) {
            $params['order'] = $orderBy . '.' . ($ascending ? 'asc' : 'desc');
        }

        return $this->makeRequest('GET', $table, $params);
    }

    public function selectWithRange(string $table, string $columns = '*', array $filters = [], int $from = 0, int $to = 999, string $orderBy = null, bool $ascending = true): array
    {
        $params = ['select' => $columns];
        foreach ($filters as $key => $value) {
            $params[$key] = $value;
        }
        if ($orderBy !== null) {
            $params['order'] = $orderBy . '.' . ($ascending ? 'asc' : 'desc');
        }

        $extraHeaders = [
            'Range: ' . $from . '-' . $to
        ];

        return $this->makeRequest('GET', $table, $params, null, $extraHeaders);
    }

    public function selectSingle(string $table, string $columns = '*', array $filters = []): array
    {
        $result = $this->select($table, $columns, $filters, 1);
        if ($result['error']) {
            return $result;
        }
        return ['data' => $result['data'][0] ?? null, 'error' => null];
    }

    // Можна додати інші методи: insert, update, delete
}