# 営業リスト ダッシュボード（PythonAnywhere 版）

業種・エリアを指定して「収集」を押すと、企業を自動で集めて一覧・地図・CSV で管理できる Flask アプリです。
GitHub の `main` に push すると、テスト → PythonAnywhere へ反映 → 自動リロードまで行われます（手動 Reload 不要）。

## できること
- **収集元**
  - CSV 取り込み：ハローワーク等で集めた企業一覧（会社名・住所・HP・業種・求人数）
  - Googleマップ（Places API）：ホームページを持たない店舗・企業も取得
  - OpenStreetMap：APIキー不要
- **自動調査**（求人数の多い企業から 1 回 150 件ずつ）
  - HP がある → トップ・お問い合わせ・会社概要ページからメールアドレスと SNS（Instagram / X / Facebook / TikTok / YouTube / LINE）を抽出
  - HP がない → Web 検索（Brave Search API）で公式サイトと SNS を特定。Indeed・求人/口コミ/企業DB サイトは公式サイトとみなさない
  - 住所 → 緯度経度（国土地理院API）で地図にピン表示
  - **PHP製サイトの判定**：レスポンスヘッダー（X-Powered-By / PHPSESSID）、WordPress・EC-CUBE 等の CMS、`.php` リンクから判定。
    バージョンが分かれば PHP 公式のサポート期限と照合し「サポート終了」「終了間近」を表示（公開ページを見るだけで、脆弱性スキャンはしない）
  - サイトに「営業メールお断り」等の表記があれば記録し、自動送信の対象から外す
- **メール自動送信**（「メール配信」タブ）
  - キャンペーンごとに件名・本文（{会社名}{PHP状況} などの差し込み）・送信対象（全企業 / PHP製 / PHPサポート終了・間近）・1日の上限を設定
  - 「自動送信」を ON にすると 1 通ずつ間隔を空けて送信。新しく条件に合った企業にも自動で送る。送信後はステータスを「連絡済み」に
  - 送信者名・住所・連絡先・配信停止リンクを必ず末尾に付与（消せない）。配信停止したアドレスには二度と送らない
  - 同じアドレスへは同じキャンペーンで1回まで、別キャンペーンでも14日以内は再送しない。商談中・成約・失注・対象外には送らない
- 営業ステータス・メモ管理、絞り込み（HP / メール / SNS / 取得元）、CSV 出力（Excel 対応）

## 構成

```
GitHub (main に push)
   └─ GitHub Actions: pytest → PythonAnywhere の /deploy を HMAC 署名付きで POST
         └─ PythonAnywhere: git fetch/reset → (requirements 変更時) pip install → DB 更新
                            → WSGI ファイルを touch ＝ Web アプリが自動リロード
```

| ファイル | 役割 |
|---|---|
| `app.py` | Flask アプリ（画面・API・ログイン・/deploy） |
| `collector.py` | 収集・調査エンジン（少しずつ進む step 方式） |
| `db.py` | SQLite（`data/leads.sqlite3`、git 管理外） |
| `deploy.py` | 自動デプロイ処理 |
| `worker.py` | 常駐ワーカー（任意・有料プランの Always-on task 用） |
| `deploy/setup_pythonanywhere.sh` | 初回セットアップスクリプト |

## 初回セットアップ（10 分程度）

### 0. 事前に用意するもの
1. **PythonAnywhere アカウント**
   無料プランは外部アクセス先が許可リストのサイトに限られるため、企業サイトの巡回（メール抽出）ができません。
   **有料プラン（Hacker 以上）を推奨**します。
2. **GitHub トークン**（private リポジトリの取得用）
   GitHub → Settings → Developer settings → Fine-grained tokens → `ryonomail/atally` の **Contents: Read-only** で発行
3. **PythonAnywhere API トークン**（任意。Web アプリ設定を自動化）
   PythonAnywhere → Account → API Token

### 1. PythonAnywhere の Bash コンソールで実行

```bash
curl -fsSL -H "Authorization: Bearer <GitHubトークン>" \
  https://raw.githubusercontent.com/ryonomail/atally/main/lead-dashboard/deploy/setup_pythonanywhere.sh -o setup.sh
GITHUB_TOKEN=<GitHubトークン> PA_API_TOKEN=<PythonAnywhere APIトークン> bash setup.sh
```

- `lead-dashboard` フォルダだけを `~/atally` に取得し、virtualenv（`~/.virtualenvs/leads`）を作成します
- `.env` を自動生成し、**ログインパスワード** と **PA_DEPLOY_SECRET** を表示します（控えてください）
- `PA_API_TOKEN` を付けた場合は Web アプリの作成・設定・リロードまで自動で行います。付けない場合は表示される手順で Web タブから設定してください
- EU アカウントの場合は `PA_HOST=eu.pythonanywhere.com` を付けて実行してください

### 2. GitHub に Secrets を登録（自動デプロイ）
`ryonomail/atally` → Settings → Secrets and variables → Actions → New repository secret

| Name | Value |
|---|---|
| `PA_DEPLOY_URL` | `https://<ユーザー名>.pythonanywhere.com/deploy` |
| `PA_DEPLOY_SECRET` | `.env` の `DEPLOY_SECRET` の値 |

以後、`main` ブランチに `lead-dashboard/` の変更を push すると自動で反映されます。
Actions タブの「Lead dashboard (PythonAnywhere)」で結果を確認できます（手動実行は「Run workflow」）。

### 3. 収集元のキーを設定（`~/atally/lead-dashboard/.env`）

| 変数 | 用途 |
|---|---|
| `GOOGLE_PLACES_API_KEY` | Googleマップから収集（Google Cloud で「Places API (New)」を有効化） |
| `BRAVE_SEARCH_API_KEY` | HP の無い企業の公式サイト・SNS 検索（無料枠 月2,000件） |
| `LEAD_SEARCH_LIMIT` | 1 回の調査で Web 検索する最大件数（既定 50） |

`.env` を編集したら Web タブで Reload（またはWSGIファイルを touch）してください。
ハローワーク等の企業一覧は、画面の「CSV取り込み」から `会社名(事業所名), 住所, ホームページ, 業種, 求人数` 列の CSV を読み込めます。

### 3-2. メール送信の設定（`.env`）

| 変数 | 内容 |
|---|---|
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURITY` | SMTPサーバー（`starttls`=587, `ssl`=465） |
| `SMTP_USER` / `SMTP_PASSWORD` | SMTP の認証情報 |
| `MAIL_FROM` / `MAIL_FROM_NAME` / `MAIL_REPLY_TO` | 送信元アドレス・表示名・返信先 |
| `SENDER_COMPANY` / `SENDER_ADDRESS` / `SENDER_CONTACT` | **法律で表示が必要**な送信者名・住所・連絡先（全メールの末尾に自動で入る） |
| `PUBLIC_BASE_URL` | ダッシュボードのURL（配信停止リンクに使う。例 `https://ユーザー名.pythonanywhere.com`） |
| `SEND_DAILY_LIMIT` / `SEND_INTERVAL_SEC` | 全体の1日上限（既定100通）・送信間隔（既定20秒） |

- 大量送信は Gmail 等の個人向けSMTPだとアカウント停止のリスクがあります。SendGrid・Amazon SES・Mailgun などの配信サービスの SMTP を推奨します
- 送信元ドメインに SPF / DKIM / DMARC を設定しないと迷惑メール扱いになりやすくなります
- 無料プランの PythonAnywhere は外部SMTPに接続できない場合があります（有料プラン推奨）
- まず「テスト送信」で自分宛てに届くことを確認してから「自動送信」を ON にしてください

### 4. （任意）常駐ワーカー
既定ではダッシュボードを開いている間にブラウザが処理を少しずつ進めます。
メールの自動送信も同様で、ページを閉じても送り続けたい場合は、有料プランの **Tasks → Always-on tasks** に登録します。

```
/home/<ユーザー名>/.virtualenvs/leads/bin/python /home/<ユーザー名>/atally/lead-dashboard/worker.py
```

コード更新時はワーカーが自動で終了し、新しいコードで再起動されます。

## ローカルで動かす

```bash
cd lead-dashboard
python -m venv .venv && . .venv/bin/activate
pip install -r requirements-dev.txt
echo "DASHBOARD_PASSWORD=pass" > .env
SESSION_COOKIE_SECURE=0 python app.py     # http://localhost:5000
python -m pytest -q
```

## 注意事項
- Googleマップ・Indeed 等の画面スクレイピングは利用規約違反のため行わず、公式 API のみを使っています
- 営業メールは特定電子メール法の対象です。本アプリは「サイトで公表されているアドレス」宛てに送る前提で、送信者表示・配信停止・「お断り」表記の除外を自動で行いますが、
  文面の内容（誤解を招く表現をしない等）と運用の最終責任は送信者にあります
- PHP の判定はレスポンスや HTML から推定したもので、確実ではありません（バージョン非公開のサイトも多い）。
  メールでは「PHPそのものが危険」ではなく「サポート終了したバージョンを使っている」という事実ベースで案内するのが安全です
- PythonAnywhere の無料プランは 3 か月ごとに Web アプリの延長操作が必要です
- デプロイ履歴は `data/deploy.log` に記録されます
