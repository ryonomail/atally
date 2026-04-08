<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="padding: 40px 20px;">
        <tr>
            <td align="center">
                <table width="480" cellpadding="0" cellspacing="0" style="background: #ffffff; border-radius: 8px; overflow: hidden;">
                    <tr>
                        <td style="padding: 32px 40px;">
                            <h1 style="margin: 0 0 8px; font-size: 20px; color: #18181b;">Atally</h1>
                            <p style="margin: 0 0 24px; font-size: 14px; color: #71717a;">決済に失敗しました</p>

                            <div style="margin: 0 0 20px; padding: 16px; background: #fef2f2; border-radius: 8px; border-left: 4px solid #ef4444;">
                                <p style="margin: 0; font-size: 14px; color: #991b1b; font-weight: 600;">
                                    クレジットカードへの請求が失敗したため、掲載を一時停止しました
                                </p>
                            </div>

                            <p style="margin: 0 0 16px; font-size: 14px; color: #3f3f46; line-height: 1.6;">
                                {{ $company->company_name }} 様<br><br>
                                以下の{{ $targetType === 'campaign' ? 'キャンペーン' : '求人' }}の
                                継続課金に失敗しました。掲載は自動的に一時停止されています。
                            </p>

                            <div style="margin: 16px 0; padding: 16px; background: #f4f4f5; border-radius: 8px;">
                                <p style="margin: 0 0 8px; font-size: 13px; color: #71717a;">
                                    {{ $targetType === 'campaign' ? 'キャンペーン名' : '求人名' }}
                                </p>
                                <p style="margin: 0 0 12px; font-size: 16px; font-weight: 600; color: #18181b;">
                                    {{ $targetName }}
                                </p>
                                <p style="margin: 0 0 4px; font-size: 13px; color: #71717a;">請求予定額</p>
                                <p style="margin: 0; font-size: 18px; font-weight: 700; color: #ef4444;">
                                    ¥{{ number_format($amount) }}
                                </p>
                            </div>

                            <p style="margin: 16px 0; font-size: 14px; color: #3f3f46; line-height: 1.6;">
                                カード情報をご確認のうえ、管理画面から再度お支払い方法を登録してください。
                                登録後、求人を手動で「配信中」に戻すと掲載が再開されます。
                            </p>

                            <table cellpadding="0" cellspacing="0" style="margin: 24px 0;">
                                <tr>
                                    <td style="background: #18181b; border-radius: 6px; padding: 12px 24px;">
                                        <a href="{{ config('app.url') }}/payment"
                                           style="color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600;">
                                            カード情報を更新する →
                                        </a>
                                    </td>
                                </tr>
                            </table>

                            <p style="margin: 24px 0 0; font-size: 12px; color: #a1a1aa; line-height: 1.5;">
                                ※ このメールに心当たりがない場合は、サポートまでご連絡ください。<br>
                                ※ カード情報の更新後、求人管理画面から掲載を再開できます。
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
