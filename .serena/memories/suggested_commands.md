# SmartThreads 推奨コマンド

## 開発環境セットアップ

### 初回セットアップ
```bash
# 環境変数設定
cp .env.example .env
# .envファイルを編集して必要な値を設定

# 開発環境起動（Docker）
./scripts/deploy.sh dev deploy

# または手動で
docker-compose up -d
```

### アクセスURL
- フロントエンド: http://localhost:3001
- バックエンドAPI: http://localhost:3000
- MinIO Console: http://localhost:9001

## フロントエンド開発

### 基本コマンド
```bash
cd smartthreads-frontend
npm install                    # 依存関係インストール
npm run dev                   # 開発サーバー起動
npm run build                 # プロダクションビルド
npm run start                 # プロダクションサーバー起動
```

### 品質チェック
```bash
npm run lint                  # ESLintチェック
npm run type-check           # TypeScriptタイプチェック
npm run format               # Prettierフォーマット
npm run format:check         # フォーマットチェック（CI用）
npm run analyze              # バンドルサイズ分析
```

## バックエンド開発

### 基本コマンド
```bash
cd smartthreads-backend
npm install                   # 依存関係インストール
npm run start:dev            # 開発サーバー起動（ウォッチモード）
npm run start:debug          # デバッグモード起動
npm run build                # プロダクションビルド
npm run start:prod           # プロダクションサーバー起動
```

### データベース操作
```bash
npm run migration:generate -- -n MigrationName  # マイグレーション生成
npm run migration:run                           # マイグレーション実行
npm run migration:revert                        # マイグレーション取り消し
```

### 品質チェック・テスト
```bash
npm run lint                 # ESLintチェック・自動修正
npm run format               # Prettierフォーマット
npm run test                 # 単体テスト
npm run test:watch          # テストウォッチモード
npm run test:cov            # カバレッジレポート
npm run test:e2e            # E2Eテスト
```

### ワーカー起動
```bash
npm run worker:dev          # バックグラウンドワーカー起動（開発）
```

## Docker操作

### 開発環境
```bash
docker-compose up -d        # 全サービス起動
docker-compose down         # 全サービス停止
docker-compose ps           # サービス状態確認
docker-compose logs         # ログ確認
```

### デプロイメント
```bash
./scripts/deploy.sh dev deploy      # 開発環境デプロイ
./scripts/deploy.sh staging deploy  # ステージングデプロイ
./scripts/deploy.sh production deploy  # 本番デプロイ（確認あり）
./scripts/deploy.sh [env] rollback   # ロールバック
./scripts/deploy.sh [env] status     # 状態確認
./scripts/deploy.sh [env] cleanup    # クリーンアップ
```

## タスク完了時の必須コマンド

### フロントエンド
```bash
npm run type-check && npm run lint && npm run format:check
```

### バックエンド
```bash
npm run lint && npm run format && npm run test
```

## システムコマンド（macOS）

### 基本コマンド
```bash
ls -la                      # ファイル一覧表示
find . -name "*.ts"         # ファイル検索
grep -r "searchterm" ./src  # テキスト検索（ripgrepのrgを推奨）
rg "searchterm" ./src       # 高速テキスト検索
```

### Git操作
```bash
git status                  # 状態確認
git add .                   # ステージング
git commit -m "message"     # コミット
git push origin main        # プッシュ
```