# Atally デプロイガイド

## デプロイ先の推奨: Render.com

### なぜ Render か
| 項目 | 内容 |
|------|------|
| 費用 | Web Service $7/月 + PostgreSQL $7/月 + Redis $10/月 = **約$24/月（約3,600円）** |
| 難易度 | GitHub と繋ぐだけで自動デプロイ、設定が最もシンプル |
| スケール | アクセス増加時にプラン変更のみで対応可 |
| 代替案 | さくらVPS（月500円〜）は最安だが自分でNginx/SSL等を設定する必要あり |

---

## Render でのデプロイ手順

### 事前準備

1. **GitHub にコードを push する**
   ```bash
   git init
   git add .
   git commit -m "initial commit"
   git remote add origin https://github.com/あなたのユーザー名/atally.git
   git push -u origin main
   ```

2. **Stripe の本番キーを取得する**
   - https://dashboard.stripe.com/apikeys にアクセス
   - 「本番キーを表示」から `pk_live_...` と `sk_live_...` を取得

3. **Google OAuth のリダイレクト URI を追加する**
   - https://console.cloud.google.com → 認証情報 → OAuth クライアント
   - 承認済みリダイレクト URI に `https://あなたのドメイン/auth/google/callback` を追加

---

### Step 1: Render でデータベースを作成

1. https://render.com にサインアップ
2. 「New +」→「PostgreSQL」
3. 設定:
   - Name: `atally-db`
   - Region: `Singapore`（日本に最も近い）
   - Plan: `Starter（$7/月）`
4. 作成後、「Internal Database URL」をメモする（後で使用）

### Step 2: Redis を作成

1. 「New +」→「Redis」
2. 設定:
   - Name: `atally-redis`
   - Region: `Singapore`
   - Plan: `Starter（$10/月）`
3. 作成後、「Internal Redis URL」をメモする

### Step 3: Web Service を作成

1. 「New +」→「Web Service」
2. GitHub リポジトリを連携して選択
3. 設定:
   - Name: `atally`
   - Region: `Singapore`
   - Branch: `main`
   - **Runtime: Docker**
   - **Dockerfile Path: `./Dockerfile.prod`**
   - Plan: `Starter（$7/月）`

4. 「Environment Variables」に以下を追加:

| キー | 値 |
|------|-----|
| `APP_ENV` | `production` |
| `APP_DEBUG` | `false` |
| `APP_KEY` | ターミナルで `docker exec atally-app php artisan key:generate --show` で生成した値 |
| `APP_URL` | `https://atally.onrender.com`（後でカスタムドメインに変更） |
| `DB_CONNECTION` | `pgsql` |
| `DB_HOST` | Render PostgreSQL の Internal Host |
| `DB_PORT` | `5432` |
| `DB_DATABASE` | Render PostgreSQL のデータベース名 |
| `DB_USERNAME` | Render PostgreSQL のユーザー名 |
| `DB_PASSWORD` | Render PostgreSQL のパスワード |
| `REDIS_HOST` | Render Redis の Internal Host |
| `REDIS_PORT` | `6379` |
| `REDIS_PASSWORD` | Render Redis のパスワード |
| `CACHE_DRIVER` | `redis` |
| `QUEUE_CONNECTION` | `redis` |
| `SESSION_DRIVER` | `redis` |
| `MAIL_MAILER` | `smtp` |
| `MAIL_HOST` | メールサービスのホスト（Amazon SES 推奨） |
| `MAIL_PORT` | `587` |
| `MAIL_USERNAME` | SMTPユーザー名 |
| `MAIL_PASSWORD` | SMTPパスワード |
| `MAIL_FROM_ADDRESS` | `noreply@your-domain.com` |
| `STRIPE_KEY` | `pk_live_...` |
| `STRIPE_SECRET` | `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...`（Step 4 で取得） |
| `GOOGLE_CLIENT_ID` | Google OAuth クライアントID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth シークレット |
| `GOOGLE_CALLBACK_URL` | `https://your-domain.com/auth/google/callback` |

5. 「Create Web Service」をクリック → 自動でビルド＆デプロイが始まる

### Step 4: Stripe Webhook を設定

1. https://dashboard.stripe.com/webhooks にアクセス
2. 「エンドポイントを追加」
3. エンドポイント URL: `https://あなたのrender URL/api/webhook/stripe`
4. 購読するイベントを選択:
   - `payment_intent.payment_failed`
   - `invoice.payment_failed`
   - `invoice.paid`
   - `invoice.payment_action_required`
   - `charge.refunded`
5. 作成後、「署名シークレット」（`whsec_...`）を Render の環境変数 `STRIPE_WEBHOOK_SECRET` に設定

### Step 5: カスタムドメインを設定（任意）

1. Render の Web Service →「Settings」→「Custom Domains」
2. 取得したドメインを追加
3. DNS の CNAME レコードを Render が指定する値に変更
4. SSL は Render が自動で Let's Encrypt を設定してくれる
5. `.env` の `APP_URL` と `GOOGLE_CALLBACK_URL` を新ドメインに更新

---

## デプロイ後の確認

```bash
# ログを確認
# Render ダッシュボード → Logs タブ

# マイグレーション状態を確認（Render の Shell タブ）
php artisan migrate:status

# admin アカウントが存在するか確認
php artisan tinker
User::where('role', 'admin')->first()
```

---

## メールサービスの推奨: Amazon SES

月100通まで無料、その後$0.10/1000通。

1. AWS コンソール → SES → 「メールアドレスを検証」
2. 「SMTP認証情報を作成」→ ユーザー名・パスワードを取得
3. ドメイン送信の場合は「ドメインを検証」して DNS に TXT/CNAME を追加
4. 最初はサンドボックスモード（自分のメールのみ送信可）→本番移行リクエストを送る

---

## よくあるトラブル

| 症状 | 原因 | 対処 |
|------|------|------|
| `APP_KEY` エラー | 環境変数未設定 | `php artisan key:generate --show` で生成して設定 |
| 500 エラー | `APP_DEBUG=true` にして Render ログを確認 | ログでエラー特定後 `false` に戻す |
| Stripe Webhook が 400 | `STRIPE_WEBHOOK_SECRET` が間違い | Stripe ダッシュボードで再確認 |
| メールが届かない | SMTP 設定ミス or SES サンドボックス | SES の送信ログを確認 |
| Google ログインが失敗 | リダイレクト URI 未登録 | Google Console でドメインを追加 |
