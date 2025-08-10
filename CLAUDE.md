# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Communication Language

**すべてのやりとりは日本語で行ってください。**
- コード内のコメントも日本語で記述する
- To Doリストの作成・更新も日本語で行う
- エラーメッセージやログの説明も日本語で提供する
- 技術的な説明や議論も日本語で実施する

Claude Codeとの対話において、特別な理由がない限りすべて日本語でコミュニケーションを取ること。

## デザインルール

**厳格な色彩制限 - モノクロデザインの徹底**

### 🚫 使用禁止色彩
- **カラフルな色は一切使用禁止**
- 赤、緑、黄色、紫、ピンク、オレンジなどの色彩は使わない
- グラデーションや複数色の組み合わせは使わない
- 絵文字の使用は一切禁止（技術的にやむを得ない場合を除く）

### ✅ 許可される色彩
**基本色（必須）:**
- **白** (`#ffffff`, `white`)
- **黒** (`#000000`, `black`) 
- **グレースケール** (`gray-50`, `gray-100`, `gray-200`, `gray-300`, `gray-400`, `gray-500`, `gray-600`, `gray-700`, `gray-800`, `gray-900`)

**例外色（最小限の使用）:**
- **選択状態のみ**: 青色 (`blue-500`, `blue-600`) - アクティブタブ、選択ボタンのみ
- **エラー表示のみ**: 赤色 (`red-500`, `red-600`) - エラーメッセージ、削除ボタンのみ

### 🎨 デザイン原則
1. **モノクロベース**: すべてのUIコンポーネントは白・黒・グレーで構成
2. **最小限のアクセント**: 青色は選択状態でのみ使用
3. **視覚的階層**: グレーの濃淡で情報の重要度を表現
4. **シンプルアイコン**: Lucide Reactの単色アイコンのみ使用

### 📝 エラーメッセージ・通知
- **すべて日本語で表示**
- 英語のエラーメッセージは即座に日本語に翻訳
- ユーザーに分かりやすい表現を使用
- 技術的なエラーは一般ユーザー向けに平易化

### 🚨 実装時の注意事項
- `className`で色を指定する際は必ず上記ルールを確認
- 新しいコンポーネント作成時は既存のモノクロデザインを参考にする
- 外部ライブラリ使用時も色彩制限を適用
- プロダクトロゴやブランド要素も可能な限りモノクロ化

## Project Overview

SmartThreads is a mobile-first web application for managing Threads (Meta) posts, scheduling, and bulk operations. It's designed as a PWA optimized for iOS/Android browsers with a focus on safe and efficient content management for multiple accounts.

## Technology Stack

### Frontend
- **Framework**: Next.js with TypeScript
- **PWA Support**: Service Workers for offline functionality
- **UI Optimization**: Mobile-first, single-handed operation design
- **State Management**: TBD based on implementation choice

### Backend
- **API Framework**: Node.js (NestJS) or Python (FastAPI) 
- **Database**: PostgreSQL
- **Queue System**: Redis + BullMQ (or equivalent)
- **Storage**: S3-compatible object storage
- **Monitoring**: OpenTelemetry

### Security
- KMS encryption for credentials
- Session tokens with role-based access
- CSP, XSS/CSRF protection
- Column-level encryption for sensitive data

## Development Commands

*To be added when project is initialized with chosen stack*

## Architecture Overview

### Core Components

1. **Account Management**
   - OAuth credential handling (CLIENT_ID, CLIENT_SECRET, ACCESS_TOKEN)
   - Multi-account support with health monitoring
   - Automatic token validation and expiry notifications

2. **Post Management**
   - Create, schedule, and delete posts
   - Media handling with automatic compression and EXIF removal
   - Draft auto-save functionality

3. **Scheduling System**
   - Queue-based job processing
   - Exponential backoff retry logic (max 3 attempts)
   - Rate limit handling with slot control

4. **API Structure**
   - RESTful endpoints under /v1/
   - Idempotency support for critical operations
   - Structured error responses with retry information

### Data Models

- `users`: User accounts with roles (admin, editor, viewer)
- `accounts`: Connected Threads accounts
- `credentials`: Encrypted OAuth tokens (column-level encryption)
- `scheduled_posts`: Queue for scheduled content
- `published_posts_cache`: Published content tracking
- `jobs`: Background job queue
- `audit_logs`: Security and compliance logging

### Key API Endpoints

- `POST /v1/accounts/link` - Connect Threads account
- `POST /v1/scheduled-posts` - Create scheduled post
- `GET /v1/published-posts` - Retrieve published posts
- `DELETE /v1/published-posts/{postId}` - Delete posts

## Performance Requirements

- Mobile LCP: < 2.5 seconds
- TTI for main operations: < 3 seconds
- Scheduling success rate: 99.9%
- Average scheduling delay: < 1 minute

## Security Considerations

- Never store raw credentials in frontend
- All sensitive data must be encrypted at rest
- Implement proper CSRF/XSS protection
- Use environment variables for API limits and validation rules
- Audit log all critical operations without storing sensitive values

## Testing Requirements

- Unit tests for validators and helpers
- Integration tests for account linking flow
- E2E tests for core user journeys
- Load testing for concurrent scheduling
- Security testing for permission escalation

## Important Implementation Notes

1. **Timezone Handling**: Default to Asia/Tokyo, user-configurable
2. **Rate Limiting**: Implement queue distribution and user notifications
3. **Error Handling**: Provide specific error messages by type
4. **Accessibility**: WCAG AA compliance, screen reader support
5. **Internationalization**: i18n ready with locale-specific formatting

## Development Workflow

*To be updated when development environment is set up*

## Quality Assurance & Review Agent

SmartThreads includes an automated Playwright-based review agent for continuous quality assurance and validation.

### Review Agent Configuration

The review agent is configured via `.claude-review.json` and provides:

- **Application Validation**: Startup verification, health checks, and core functionality testing
- **UI/UX Testing**: Mobile-first design validation, touch interaction testing, and responsive design verification
- **Performance Monitoring**: Real-time performance metrics against defined thresholds (LCP < 2.5s, TTI < 3s)
- **Visual Regression Testing**: Screenshot-based UI consistency checks
- **Accessibility Compliance**: WCAG AA compliance validation and screen reader support testing

### Review Triggers

- **Manual**: Use `/review` command for comprehensive application review
- **Automated**: Configurable triggers for file changes and pre-commit hooks (currently disabled)
- **Continuous**: Background monitoring during development

### Review Reports

Reports are generated in `docs/review-reports/` and include:
- JSON structured results
- HTML formatted reports
- Screenshots of UI states
- Network and console logs
- Performance metrics
- Accessibility audit results

### Agent Capabilities

The reviewer agent operates in read-only mode and focuses on:
1. Quality assurance validation
2. Requirement compliance checking  
3. Performance threshold monitoring
4. User experience verification
5. Security and accessibility auditing

**Note**: The review agent does NOT modify code - it only provides detailed analysis and recommendations for improvement.

For detailed agent documentation, see `docs/reviewer-agent.md`.