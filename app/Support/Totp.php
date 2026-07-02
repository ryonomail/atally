<?php

namespace App\Support;

/**
 * 依存パッケージ不要の TOTP（RFC 6238 / Google Authenticator互換）実装。
 * - HMAC-SHA1・30秒ステップ・6桁。
 * - シークレットは Base32。
 */
class Totp
{
    private const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

    /** ランダムなBase32シークレットを生成（既定160bit=32文字） */
    public static function generateSecret(int $length = 32): string
    {
        $s = '';
        for ($i = 0; $i < $length; $i++) {
            $s .= self::ALPHABET[random_int(0, 31)];
        }
        return $s;
    }

    /** otpauth:// URI（認証アプリのQR/手動登録用） */
    public static function provisioningUri(string $secret, string $account, string $issuer): string
    {
        $label = rawurlencode($issuer . ':' . $account);
        $q = http_build_query([
            'secret'    => $secret,
            'issuer'    => $issuer,
            'algorithm' => 'SHA1',
            'digits'    => 6,
            'period'    => 30,
        ]);
        return "otpauth://totp/{$label}?{$q}";
    }

    /** コード検証（前後の時間ずれを $window ステップ許容） */
    public static function verify(string $secret, string $code, int $window = 1): bool
    {
        $code = preg_replace('/\D/', '', $code);
        if (strlen($code) !== 6) return false;
        $timestep = (int) floor(time() / 30);
        for ($i = -$window; $i <= $window; $i++) {
            if (hash_equals(self::codeAt($secret, $timestep + $i), $code)) {
                return true;
            }
        }
        return false;
    }

    /** 指定タイムステップの6桁コード */
    private static function codeAt(string $secret, int $timestep): string
    {
        $key = self::base32Decode($secret);
        if ($key === '') return '______';
        $bin = pack('N*', 0) . pack('N*', $timestep); // 8バイトのカウンタ(上位32bitは0)
        $hash = hash_hmac('sha1', $bin, $key, true);
        $offset = ord($hash[19]) & 0x0f;
        $part = (
            ((ord($hash[$offset]) & 0x7f) << 24) |
            ((ord($hash[$offset + 1]) & 0xff) << 16) |
            ((ord($hash[$offset + 2]) & 0xff) << 8) |
            (ord($hash[$offset + 3]) & 0xff)
        );
        return str_pad((string) ($part % 1000000), 6, '0', STR_PAD_LEFT);
    }

    private static function base32Decode(string $b32): string
    {
        $b32 = strtoupper(preg_replace('/[^A-Z2-7]/', '', $b32));
        if ($b32 === '') return '';
        $bits = '';
        foreach (str_split($b32) as $c) {
            $bits .= str_pad(decbin(strpos(self::ALPHABET, $c)), 5, '0', STR_PAD_LEFT);
        }
        $bytes = '';
        foreach (str_split($bits, 8) as $byte) {
            if (strlen($byte) === 8) {
                $bytes .= chr(bindec($byte));
            }
        }
        return $bytes;
    }
}
