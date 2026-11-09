# 営業リスト ダッシュボード（PythonAnywhere 版）

業種・エリアを指定して「収集」を押すと、企業を自動で集めて一覧・地図・CSV で管理できる Flask アプリです。
GitHub の `main` に push すると、テスト → PythonAnywhere へ反映 → 自動リロードまで行われます（手動 Reload 不要）。

## できること
- **収集元**
  - ハローワーク求人：Atally 本体に取り込み済みの求人から事業所を取得（エクスポートAPI、または CSV アップロード）
  - Googleマップ（Places API）：ホームページを持たない店舗・企業も取得
  - OpenStreetMap：APIキー不要
- **自動調査**（求人数の多い企業から 1 回 150 件ずつ）
  - HP がある → トップ・お問い合わせ・会社概要ページからメールアドレスと SNS（Instagram / X / Facebook / TikTok / YouTube / LINE）を抽出
  - HP がない → Web 検索（Brave Search API）で公式サイトと SNS を特定。Indeed・求人/口コミ/企業DB サイトは公式サイトとみなさない
  - 住所 → 緯度経度（国土地理院API）で地図にピン表示
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
| `HELLOWORK_EXPORT_URL` / `HELLOWORK_EXPORT_TOKEN` | Atally 本体からハローワーク事業所を取得。本体の `.env` に `LEAD_EXPORT_TOKEN`（`openssl rand -hex 32`）を設定し、同じ値を入れる |
| `GOOGLE_PLACES_API_KEY` | Googleマップから収集（Google Cloud で「Places API (New)」を有効化） |
| `BRAVE_SEARCH_API_KEY` | HP の無い企業の公式サイト・SNS 検索（無料枠 月2,000件） |
| `LEAD_SEARCH_LIMIT` | 1 回の調査で Web 検索する最大件数（既定 50） |

`.env` を編集したら Web タブで Reload（またはWSGIファイルを touch）してください。
ハローワークのエクスポートAPIを使わない場合は、画面の「CSV取り込み」から `会社名(事業所名), 住所, ホームページ, 業種, 求人数` 列の CSV を読み込めます。

### 4. （任意）常駐ワーカー
既定ではダッシュボードを開いている間にブラウザが処理を少しずつ進めます。
ページを閉じても処理を続けたい場合は、有料プランの **Tasks → Always-on tasks** に登録します。

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
- ハローワーク求人情報提供サービスのデータを営業目的に使う場合は、同サービスの利用規約（目的外利用）をご確認ください
- 集めたアドレスへ営業メールを送る場合は特定電子メール法（オプトイン原則、公表アドレスの例外、「送信お断り」表示時の禁止、送信者表示・配信停止方法の記載）に従ってください
- PythonAnywhere の無料プランは 3 か月ごとに Web アプリの延長操作が必要です
- デプロイ履歴は `data/deploy.log` に記録されます
