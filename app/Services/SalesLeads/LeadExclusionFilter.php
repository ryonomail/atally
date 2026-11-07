<?php

namespace App\Services\SalesLeads;

/**
 * Web制作・マーケティング会社を機械的に除外するフィルタ。
 * 会社名・Google Placesのtypes・公式サイトのタイトル/説明文に除外キーワードが
 * 含まれていれば除外対象と判定する。
 */
class LeadExclusionFilter
{
    /** @var string[] */
    private array $keywords;

    public function __construct()
    {
        $this->keywords = array_map('mb_strtolower', config('sales_leads.exclude_keywords', []));
    }

    /**
     * @param string[] $placeTypes
     * @return string|null 除外理由（マッチしたキーワード）。除外対象でなければ null
     */
    public function matchExclusionReason(string $companyName, array $placeTypes, ?string $websiteHtmlSnippet = null): ?string
    {
        $haystack = mb_strtolower($companyName . ' ' . implode(' ', $placeTypes) . ' ' . ($websiteHtmlSnippet ?? ''));

        foreach ($this->keywords as $keyword) {
            if ($keyword !== '' && mb_strpos($haystack, $keyword) !== false) {
                return $keyword;
            }
        }

        return null;
    }
}
