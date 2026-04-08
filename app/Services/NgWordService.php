<?php

namespace App\Services;

class NgWordService
{
    /**
     * NGワードリスト（職業安定法・雇用対策法・男女雇用機会均等法等に基づく禁止表現）
     */
    private array $ngWords = [
        // 年齢差別（雇用対策法第10条）
        '若い人歓迎', '若者限定', '年齢制限', '若い方', '若手限定',
        '20代限定', '30代限定', '40代限定', '50代以下',
        '定年前の方', 'シニア不可', '年齢不問と言いつつ',

        // 性差別（男女雇用機会均等法第5条）
        '男性のみ', '女性のみ', '男性限定', '女性限定',
        '男性歓迎', '女性歓迎', '主婦歓迎', '主夫歓迎',
        '看護婦', '保母', 'ウェイトレス', 'カメラマン',
        '営業マン', 'ガードマン', 'セールスマン',

        // 国籍・人種差別
        '日本人のみ', '外国人不可', '日本人限定', '日本国籍限定',

        // 容姿差別
        '容姿端麗', '見た目重視', 'ルックス重視', '美人',
        '身長制限', '体重制限',

        // 違法・不当な表現
        '闇バイト', '高額バイト', '即日現金', '裏バイト',
        '簡単に稼げる', '誰でも高収入', '日払い現金手渡し',

        // 差別的表現
        '健常者のみ', '障害者不可', '持病のある方不可',

        // 虚偽・誇大表現
        '業界最高給与', '絶対に稼げる', '必ず昇進',
    ];

    /**
     * テキスト中のNGワードチェック（containsNgWordのエイリアス）
     */
    public function check(string $text): bool
    {
        return $this->containsNgWord($text);
    }

    /**
     * テキスト中にNGワードが含まれるか判定
     */
    public function containsNgWord(?string $text): bool
    {
        if (!$text) {
            return false;
        }
        foreach ($this->ngWords as $word) {
            if (mb_strpos($text, $word) !== false) {
                return true;
            }
        }
        return false;
    }

    /**
     * 検出されたNGワードのリストを返す
     */
    public function detect(?string $text): array
    {
        if (!$text) {
            return [];
        }
        $detected = [];
        foreach ($this->ngWords as $word) {
            if (mb_strpos($text, $word) !== false) {
                $detected[] = $word;
            }
        }
        return $detected;
    }
}
