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
                            <p style="margin: 0 0 24px; font-size: 14px; color: #71717a;">求人への応募が未対応です</p>

                            <div style="margin: 0 0 20px; padding: 16px; background: #fef3c7; border-radius: 8px; border-left: 4px solid #f59e0b;">
                                <p style="margin: 0; font-size: 14px; color: #92400e; font-weight: 600;">
                                    {{ $stalledDays }}日以上、応募者への対応がありません
                                </p>
                            </div>

                            <p style="margin: 0 0 12px; font-size: 14px; color: #3f3f46; line-height: 1.6;">
                                以下の求人に応募が届いていますが、{{ $stalledDays }}日以上対応がありません。
                            </p>

                            <div style="margin: 16px 0; padding: 16px; background: #f4f4f5; border-radius: 8px;">
                                <p style="margin: 0; font-size: 16px; font-weight: 600; color: #18181b;">
                                    {{ $job->title }}
                                </p>
                            </div>

                            <p style="margin: 0 0 16px; font-size: 14px; color: #3f3f46; line-height: 1.6;">
                                応募者は返信を待っています。早めの対応をお願いいたします。
                            </p>

                            <p style="margin: 24px 0 0; font-size: 12px; color: #a1a1aa; line-height: 1.5;">
                                ※ 60日以上未対応の場合、求人一覧に「返信が遅い可能性があります」と表示されます。<br>
                                ※ 90日以上未対応の場合、求人は自動的に非公開になります。
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
