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
                        <td style="padding: 32px 40px; text-align: center;">
                            <h1 style="margin: 0 0 8px; font-size: 20px; color: #18181b;">Atally</h1>
                            <p style="margin: 0 0 24px; font-size: 14px; color: #71717a;">パスワードリセットのご案内</p>

                            <p style="margin: 0 0 16px; font-size: 14px; color: #3f3f46; line-height: 1.6;">
                                パスワードリセットのリクエストを受け付けました。<br>
                                以下のコードを入力して、新しいパスワードを設定してください。
                            </p>

                            <div style="margin: 24px 0; padding: 20px; background: #f4f4f5; border-radius: 8px;">
                                <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #18181b;">{{ $code }}</span>
                            </div>

                            <p style="margin: 0 0 8px; font-size: 12px; color: #a1a1aa;">
                                このコードは60分間有効です。
                            </p>
                            <p style="margin: 0; font-size: 12px; color: #a1a1aa;">
                                このメールに心当たりがない場合は、無視してください。
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
