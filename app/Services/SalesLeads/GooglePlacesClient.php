<?php

namespace App\Services\SalesLeads;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Google Places API (New) の薄いラッパー。
 *
 * 公式APIのみを利用し、Google マップのページ自体をスクレイピングすることはしない。
 * Text Search には会社名/業種キーワード + 地名の自然文クエリを渡す（例: "不動産会社 東京都"）。
 */
class GooglePlacesClient
{
    private const BASE_URL = 'https://places.googleapis.com/v1';

    private string $apiKey;

    public function __construct()
    {
        $this->apiKey = config('services.google_places.api_key', '');
    }

    public function isConfigured(): bool
    {
        return $this->apiKey !== '';
    }

    /**
     * @return array{places: array<int, array>, nextPageToken: ?string}
     */
    public function textSearch(string $query, ?string $pageToken = null): array
    {
        if (!$this->isConfigured()) {
            Log::warning('[SalesLeads] GOOGLE_PLACES_API_KEY が未設定のため検索をスキップ');
            return ['places' => [], 'nextPageToken' => null];
        }

        $fieldMask = implode(',', [
            'places.id',
            'places.displayName',
            'places.formattedAddress',
            'places.types',
            'places.nationalPhoneNumber',
            'places.internationalPhoneNumber',
            'places.websiteUri',
            'nextPageToken',
        ]);

        $payload = [
            'textQuery' => $query,
            'languageCode' => 'ja',
            'regionCode' => 'JP',
            'pageSize' => 20,
        ];
        if ($pageToken) {
            $payload['pageToken'] = $pageToken;
        }

        try {
            $response = Http::withHeaders([
                'Content-Type' => 'application/json',
                'X-Goog-Api-Key' => $this->apiKey,
                'X-Goog-FieldMask' => $fieldMask,
            ])->timeout(10)->post(self::BASE_URL . '/places:searchText', $payload);

            if (!$response->successful()) {
                Log::warning('[SalesLeads] Places textSearch failed', [
                    'status' => $response->status(),
                    'query' => $query,
                ]);
                return ['places' => [], 'nextPageToken' => null];
            }

            $data = $response->json();

            return [
                'places' => $data['places'] ?? [],
                'nextPageToken' => $data['nextPageToken'] ?? null,
            ];
        } catch (\Throwable $e) {
            Log::warning('[SalesLeads] Places textSearch exception: ' . $e->getMessage());
            return ['places' => [], 'nextPageToken' => null];
        }
    }
}
