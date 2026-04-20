<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"></head>
<body style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2>Atally チーム招待</h2>
    <p>{{ $companyName }} のチームメンバーとして招待されました。</p>
    <p>以下の情報でログインしてください：</p>
    <table style="border-collapse: collapse; width: 100%;">
        <tr>
            <td style="padding: 8px; border: 1px solid #ddd; background: #f5f5f5;">ログインURL</td>
            <td style="padding: 8px; border: 1px solid #ddd;"><a href="{{ $loginUrl }}">{{ $loginUrl }}</a></td>
        </tr>
        <tr>
            <td style="padding: 8px; border: 1px solid #ddd; background: #f5f5f5;">仮パスワード</td>
            <td style="padding: 8px; border: 1px solid #ddd; font-family: monospace;">{{ $temporaryPassword }}</td>
        </tr>
    </table>
    <p style="margin-top: 20px; color: #e53e3e;">ログイン後、すぐにパスワードを変更してください。</p>
    <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
    <p style="font-size: 12px; color: #999;">このメールに心当たりのない場合は無視してください。</p>
</body>
</html>
