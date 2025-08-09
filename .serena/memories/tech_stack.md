# SmartThreads 技術スタック

## フロントエンド
- **Framework**: Next.js 15（App Router）
- **言語**: TypeScript 5
- **スタイリング**: TailwindCSS 4
- **状態管理**: React Query（@tanstack/react-query）
- **PWA**: next-pwa、Service Workers
- **UI**: 独自コンポーネント（モバイル最適化）
- **日付処理**: date-fns
- **チャート**: Recharts
- **HTTP クライアント**: Axios

## バックエンド
- **Framework**: NestJS 11
- **言語**: TypeScript 5
- **データベース**: PostgreSQL 15 + TypeORM
- **キュー**: Redis 7 + BullMQ
- **ストレージ**: MinIO（S3互換）
- **認証**: Passport + JWT
- **バリデーション**: class-validator, class-transformer
- **セキュリティ**: Helmet, bcrypt, CSURF
- **ドキュメント**: Swagger/OpenAPI
- **レート制限**: @nestjs/throttler

## インフラ・運用
- **コンテナ**: Docker + Docker Compose
- **プロキシ**: Nginx
- **モニタリング**: OpenTelemetry（設定予定）
- **暗号化**: AES-256-GCM
- **ファイル処理**: Sharp（画像最適化）

## 開発・品質管理
- **リンティング**: ESLint 9 + TypeScript ESLint
- **フォーマッティング**: Prettier 3
- **テスト**: Jest + Supertest
- **型チェック**: TypeScript strict mode
- **CI/CD**: GitHub Actions（設定予定）