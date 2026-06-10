# 東京VPS ＋ Cloudflare 移行手順書（Renderから）

目的: シンガポール(Render)から**東京リージョンのVPS**へ移し、読み込みのレイテンシを削減する。
構成: `docker-compose.prod.yml`（app + PostgreSQL + Redis + Caddy）＋ Cloudflare(CDN/TLS)。

> 想定ダウンタイム: 10〜30分（DBダンプ→リストアの間だけ）。
> 目標規模(200万PV/月)は本構成＋Cloudflareで十分さばけます。

---

## 0. 事前に用意するもの（オーナー作業）

| 項目 | 入手先 | 備考 |
|---|---|---|
| **VPS（東京）** | さくらのVPS / ConoHa など | **4コア / 8GBメモリ** 推奨。Ubuntu 24.04。**固定IP必須** |
| ドメイン | 取得済み（例: atally.jp） | DNSをCloudflareに移管する |
| Cloudflareアカウント | cloudflare.com（無料） | 後でDNSを管理 |
| Renderの各種シークレット | Render Dashboard | APP_KEY, Stripe, Google, Mail, HELLOWORK_* など |
| RenderのDB外部URL | Render > atally-db > External URL | DB移行に使用 |

> ⚠️ **ハローワークAPIのIP再登録が最重要**。VPSの固定IPを、ハローワーク求人情報提供サービスに**事前申請**しておくこと（反映に数日かかる場合あり）。登録前は求人同期だけ失敗しますが、サイト自体は動きます。

---

## 1. VPSの初期設定

```bash
# rootでログイン後、Docker をインストール
apt update && apt -y upgrade
curl -fsSL https://get.docker.com | sh

# ファイアウォール（SSH/HTTP/HTTPSのみ許可）
apt -y install ufw
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# アプリ配置
mkdir -p /opt/atally && cd /opt/atally
git clone git@github.com:ryonomail/atally.git .
```

---

## 2. 環境変数の設定

```bash
cd /opt/atally
cp .env.vps.example .env
nano .env   # 値を埋める
```

最低限埋めるもの:
- `APP_KEY`（RenderのものをそのままコピーでOK。無ければ後述のkey:generate）
- `APP_URL` / `DOMAIN`（例: https://atally.jp / atally.jp）
- `DB_PASSWORD`（新規に強いパスワードを設定）
- `HELLOWORK_BASE_URL` / `HELLOWORK_ID` / `HELLOWORK_PASS`
- `STRIPE_*` / `GOOGLE_*` / `MAIL_*`

APP_KEY を新規生成する場合:
```bash
docker run --rm -v "$PWD":/app -w /app php:8.3-cli \
  sh -c "php -r 'echo \"base64:\".base64_encode(random_bytes(32)).PHP_EOL;'"
# 出力を .env の APP_KEY= に貼る
```

---

## 3. DB・Redisだけ先に起動 → Renderのデータを移行

```bash
cd /opt/atally
# db を先に起動
docker compose -f docker-compose.prod.yml up -d db
sleep 10

# Renderからデータ移行（RenderのExternal URLを指定）
RENDER_DATABASE_URL="postgres://USER:PASS@xxx.singapore-postgres.render.com/atally" \
  bash scripts/migrate-db-from-render.sh
```

---

## 4. 全サービス起動

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml logs -f app   # 起動ログ確認（Ctrl+Cで抜ける）
```

起動時にエントリポイントが自動で:
- `migrate --force`（新カラム適用）
- `config/route/view:cache`
- **ハローワーク一度きり同期**（IP登録済みなら成功。未登録ならスキップ/失敗→IP登録後に再起動で再試行）

---

## 5. DNS / Cloudflare 切替（ダウンタイムを最小化する順序）

1. **Cloudflareにドメインを追加**し、ネームサーバーをレジストラ側でCloudflareに変更
2. Aレコード `atally.jp` → **VPSの固定IP**。最初は **「DNS only（グレー雲）」** にする
3. 数十秒待ち、`https://atally.jp` にアクセス → Caddyが Let's Encrypt 証明書を自動取得し表示されることを確認
4. 確認できたら Cloudflareを **「Proxied（オレンジ雲）」** に切替
5. Cloudflare > SSL/TLS > 暗号化モードを **Full (strict)** に設定（Flexibleは使わない）
6. Cloudflare > Speed/Caching で「Auto Minify」「Brotli」を有効化（静的配信がさらに速くなる）

> Google OAuth / Stripe Webhook のリダイレクトURL・許可ドメインが新URLで正しいか確認。

---

## 6. 切替後の確認

```bash
# サイト疎通
curl -I https://atally.jp/api/stats

# ハローワーク同期の結果（IP登録済みなら）
docker compose -f docker-compose.prod.yml exec app cat /tmp/hw-boot-sync.log

# キュー/スケジューラが動いているか
docker compose -f docker-compose.prod.yml exec app php artisan schedule:list
```

チェックリスト:
- [ ] トップ/求人検索/求人詳細/履歴書作成が表示される
- [ ] ログイン（Google含む）ができる
- [ ] 管理画面が開ける
- [ ] 求人詳細にハローワークの会社情報が出る（IP登録＆同期後）
- [ ] 体感速度が改善している

---

## 7. 日次バックアップを仕込む

```bash
crontab -e
# 末尾に追記（毎日03:00）
0 3 * * * cd /opt/atally && bash scripts/backup-db.sh >> /var/log/atally-backup.log 2>&1
```

---

## 8. Renderの停止

新環境で1〜2日問題なく動くのを確認してから、Renderのサービスを停止/削除してコストを止める。
（DNSのTTL切替が完全に行き渡るまで旧環境は残しておく）

---

## デプロイ（移行後の通常運用）

```bash
cd /opt/atally
git pull
docker compose -f docker-compose.prod.yml up -d --build
```
※ `git pull` 後の再起動で、エントリポイントが migrate と各種キャッシュ再生成を自動実行します。

---

## ロールバック

切替後に致命的な問題が出たら、CloudflareのAレコードを**RenderのURL/IPに戻す**だけで即座に旧環境へ戻せます（Renderを8章まで残しておく理由）。
