# Repository Guidelines

## プロジェクト構成
- `smartthreads-frontend/`: Next.js 15（TS）。`src/app`（App Router）, `src/components`, `src/lib`, `public`。
- `smartthreads-backend/`: NestJS（TS）。`src/`（`auth/`, `accounts/`, `posts/`, `media/`, `queues/`）, `test/`。ビルドは`dist/`。
- `scripts/`: デプロイ・DB補助（`deploy.sh`, `init-db.sql`）。`docker-compose.yml`でPostgres/Redis/MinIO/BE/FE/Workerを統合。

## 開発・ビルド・実行
- Backend: `cd smartthreads-backend && npm i`
  - `npm run start:dev`（:3000）/ `npm run build` / `npm run test` / `npm run test:e2e`
  - マイグレーション: `npm run migration:generate -- -n <Name>` / `migration:run`
- Frontend: `cd smartthreads-frontend && npm i`
  - `npm run dev`（:3001）/ `npm run build` / `npm run start`
  - `npm run lint` / `npm run type-check` / `npm run format`
- Docker 全体: `docker-compose up -d`（FE 3001 / BE 3000 / MinIO 9001）

## コーディング規約
- 言語: TypeScript。命名は`PascalCase`（型/クラス/React）, `camelCase`（変数/関数）, ディレクトリは`kebab-case`。
- 整形: Prettier 3（2スペース, singleQuote, semi）。FE/BEとも`npm run format`。
- Lint: ESLint 9。FEは`next/core-web-vitals`+Prettier、BEはTS-ESLint。

## テスト方針
- BE: Jest（`test`/`test:cov`/`test:e2e`）。重要モジュールのユニット/E2Eを優先。
- FE: 現状必須は`type-check`/`lint`通過。段階的にユニット導入。

## コミット/PR
- Commits: Conventional Commits（例: `feat: add schedule UI`, `fix: csrf check`）。
- PR: 目的/変更概要/関連Issue/動作確認手順/必要ならUIスクショ。CI緑を必須。

## 日本語運用ルール（エージェント）
- 既定言語: すべて日本語。CLI上のメッセージ、ユーザー向け出力、進捗更新、エラーログも日本語。
- Thinking表示: 内部推論の逐語は出さず、要点のみを短く日本語で要約（例: 「APIの認証周りを点検します」）。
- ToDo/Plan: 日本語・簡潔・能動態で1行（5–7語程度）。例: 「リフレッシュ認証の検証実装」, 「投稿キューのID固定」。
- プレアンブル: 複数コマンドを実行する直前に日本語で1–2文の予告（例: 「DB設定を確認し、マイグレーションを適用します」）。
- ユーザー対話: 質問、確認、提案は敬体の日本語。選択肢は箇条書きで提示。
- ログ/通知: 成否/警告/次アクションを日本語で簡潔に（例: 「キュー登録に成功。次は再スケジュール確認」）。
- 例外: コード、コマンド、API名、識別子は原文のまま表示可。コミットメッセージはConventional（英語）で可、PR本文は日本語推奨。
