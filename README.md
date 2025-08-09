# SmartThreads

モバイルファーストのThreads投稿管理アプリケーション。複数アカウント対応、投稿スケジューリング、一括削除、分析機能を提供します。

## 🚀 機能

### コア機能
- **マルチアカウント管理**: 複数のThreadsアカウントを一元管理
- **投稿スケジューリング**: 指定時刻での自動投稿
- **一括削除**: 複数投稿の効率的な削除
- **メディア管理**: 画像/動画の自動圧縮とEXIF削除
- **分析ダッシュボード**: エンゲージメント率、時系列分析
- **PWA対応**: オフライン機能、プッシュ通知、アプリインストール

### セキュリティ
- JWT認証 (アクセス/リフレッシュトークン)
- ロールベースアクセス制御 (Admin/Editor/Viewer)
- AES-256-GCM暗号化
- カラムレベル暗号化
- CSP/CSRF/XSS対策

## 📋 要件

- Node.js 18+
- Docker & Docker Compose
- PostgreSQL 15
- Redis 7

## 🛠️ セットアップ

### 1. リポジトリのクローン

```bash
git clone https://github.com/yourusername/smartthreads.git
cd smartthreads
```

### 2. 環境変数の設定

```bash
cp .env.example .env
# .envファイルを編集して必要な値を設定
```

### 3. 開発環境の起動

```bash
# Dockerコンテナの起動
./scripts/deploy.sh dev deploy

# または手動で
docker-compose up -d
```

### 4. アクセス

- フロントエンド: http://localhost:3001
- バックエンドAPI: http://localhost:3000
- MinIO Console: http://localhost:9001

## 🏗️ アーキテクチャ

### 技術スタック

**フロントエンド**
- Next.js 15 (App Router)
- TypeScript
- TailwindCSS
- React Query
- PWA (Service Worker)

**バックエンド**
- NestJS
- TypeORM
- PostgreSQL
- Redis (BullMQ)
- MinIO (S3互換ストレージ)

### ディレクトリ構成

```
smartthreads/
├── smartthreads-frontend/    # Next.jsフロントエンド
│   ├── src/
│   │   ├── app/             # App Router
│   │   ├── components/      # UIコンポーネント
│   │   ├── hooks/           # カスタムフック
│   │   ├── lib/             # ユーティリティ
│   │   └── providers/       # Context Providers
│   └── public/              # 静的ファイル
│
├── smartthreads-backend/     # NestJSバックエンド
│   ├── src/
│   │   ├── auth/            # 認証
│   │   ├── accounts/        # アカウント管理
│   │   ├── posts/           # 投稿管理
│   │   ├── media/           # メディア処理
│   │   ├── analytics/       # 分析
│   │   └── common/          # 共通モジュール
│   └── test/                # テスト
│
├── scripts/                  # デプロイメントスクリプト
├── nginx/                    # Nginx設定
└── docker-compose.yml        # Docker構成
```

## 🔧 開発

### バックエンド開発

```bash
cd smartthreads-backend
npm install
npm run start:dev  # 開発サーバー起動
npm run test       # テスト実行
npm run build      # ビルド
```

### フロントエンド開発

```bash
cd smartthreads-frontend
npm install
npm run dev        # 開発サーバー起動
npm run build      # ビルド
npm run test       # テスト実行
```

### データベースマイグレーション

```bash
cd smartthreads-backend
npm run migration:generate -- -n MigrationName
npm run migration:run
npm run migration:revert
```

## 📊 API仕様

### 主要エンドポイント

#### 認証
- `POST /auth/register` - ユーザー登録
- `POST /auth/login` - ログイン
- `POST /auth/refresh` - トークンリフレッシュ
- `GET /auth/profile` - プロフィール取得

#### アカウント管理
- `POST /v1/accounts/link` - Threadsアカウント連携
- `GET /v1/accounts` - アカウント一覧
- `DELETE /v1/accounts/:id` - アカウント削除

#### 投稿管理
- `POST /v1/scheduled-posts` - 投稿作成/スケジュール
- `GET /v1/scheduled-posts` - 投稿一覧
- `PUT /v1/scheduled-posts/:id` - 投稿更新
- `DELETE /v1/scheduled-posts/:id` - 投稿削除
- `POST /v1/scheduled-posts/batch-delete` - 一括削除

#### 分析
- `GET /v1/analytics/accounts/:id` - アカウント分析
- `GET /v1/analytics/time-series` - 時系列データ
- `GET /v1/analytics/export` - CSVエクスポート

## 🧪 テスト

```bash
# 単体テスト
npm run test

# E2Eテスト
npm run test:e2e

# カバレッジレポート
npm run test:cov
```

## 🚀 デプロイメント

### 本番環境デプロイ

```bash
# 環境変数を本番用に設定
cp .env.production .env

# デプロイ実行
./scripts/deploy.sh production deploy
```

### Docker Composeでの起動

```bash
# 本番環境
docker-compose --profile production up -d

# ステージング環境
docker-compose -f docker-compose.yml -f docker-compose.staging.yml up -d
```

## 📝 環境変数

主要な環境変数（詳細は`.env.example`参照）:

- `DATABASE_*` - PostgreSQL接続設定
- `REDIS_*` - Redis接続設定
- `JWT_*` - JWT認証設定
- `THREADS_*` - Threads API設定
- `S3_*` - S3/MinIO設定
- `ENCRYPTION_KEY` - 暗号化キー

## 🔒 セキュリティ

- すべての認証情報は暗号化して保存
- JWTトークンによる認証
- ロールベースのアクセス制御
- レート制限の実装
- セキュリティヘッダーの設定

## 📄 ライセンス

MIT License

## 🤝 コントリビューション

プルリクエストは歓迎します。大きな変更の場合は、まずissueを開いて変更内容を議論してください。

## 📧 サポート

問題が発生した場合は、[Issues](https://github.com/yourusername/smartthreads/issues)でお知らせください。