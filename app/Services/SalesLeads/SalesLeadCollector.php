<?php

namespace App\Services\SalesLeads;

use App\Models\SalesLead;
use Illuminate\Support\Facades\Log;

/**
 * 1つの (業種, 都道府県) 組について Google Places を検索し、
 * 除外判定 → 重複チェック → 公式サイトからの連絡先抽出 → 保存 を行う。
 */
class SalesLeadCollector
{
    public function __construct(
        private GooglePlacesClient $placesClient,
        private WebsiteContactExtractor $contactExtractor,
        private LeadExclusionFilter $exclusionFilter,
    ) {
    }

    /**
     * @return array{found: int, saved: int, excluded: int, duplicated: int}
     */
    public function collectForQuery(string $industryKey, string $query, string $prefecture, int $maxToSave): array
    {
        $stats = ['found' => 0, 'saved' => 0, 'excluded' => 0, 'duplicated' => 0];

        if ($maxToSave <= 0) {
            return $stats;
        }

        $pageToken = null;
        $searchText = trim($query . ' ' . $prefecture);

        do {
            if ($pageToken) {
                // Google Places API: 発行直後のpageTokenは短時間有効化されないため少し待つ
                sleep(2);
            }
            $result = $this->placesClient->textSearch($searchText, $pageToken);
            $places = $result['places'];
            $stats['found'] += count($places);

            foreach ($places as $place) {
                if ($stats['saved'] >= $maxToSave) {
                    break;
                }

                $placeId = $place['id'] ?? null;
                $name = $place['displayName']['text'] ?? null;
                if (!$placeId || !$name) {
                    continue;
                }

                if (SalesLead::where('google_place_id', $placeId)->exists()) {
                    $stats['duplicated']++;
                    continue;
                }

                $types = $place['types'] ?? [];
                $exclusionReason = $this->exclusionFilter->matchExclusionReason($name, $types);
                if ($exclusionReason) {
                    $stats['excluded']++;
                    continue;
                }

                $websiteUrl = $place['websiteUri'] ?? null;
                $contacts = ['email' => null, 'instagram_url' => null, 'facebook_url' => null, 'tiktok_url' => null];
                if ($websiteUrl) {
                    try {
                        $contacts = $this->contactExtractor->extract($websiteUrl);
                    } catch (\Throwable $e) {
                        Log::debug('[SalesLeads] contact extraction failed: ' . $e->getMessage());
                    }
                }

                SalesLead::create([
                    'google_place_id' => $placeId,
                    'company_name' => $name,
                    'industry_category' => $industryKey,
                    'prefecture' => $prefecture,
                    'address' => $place['formattedAddress'] ?? null,
                    'phone' => $place['nationalPhoneNumber'] ?? $place['internationalPhoneNumber'] ?? null,
                    'website_url' => $websiteUrl,
                    'email' => $contacts['email'],
                    'instagram_url' => $contacts['instagram_url'],
                    'facebook_url' => $contacts['facebook_url'],
                    'tiktok_url' => $contacts['tiktok_url'],
                    'raw_place_types' => $types,
                    'status' => 'new',
                    'source' => 'google_places',
                    'discovered_at' => now(),
                ]);

                $stats['saved']++;
            }

            $pageToken = $stats['saved'] < $maxToSave ? $result['nextPageToken'] : null;
        } while ($pageToken && $stats['saved'] < $maxToSave);

        return $stats;
    }
}
