# SmartThreads コーディング規約

## コードスタイル設定

### Prettier設定
- **セミコロン**: あり (semi: true)
- **クォート**: シングルクォート (singleQuote: true)
- **行幅**: 100文字 (printWidth: 100)
- **インデント**: スペース2文字 (tabWidth: 2, useTabs: false)
- **トレーリングカンマ**: ES5形式 (trailingComma: "es5")
- **アロー関数**: 括弧なし (arrowParens: "avoid")
- **改行**: LF (endOfLine: "lf")

### ESLint設定
- **ベース**: Next.js + TypeScript + Prettier
- **未使用変数**: 警告（_で始まる変数は無視）
- **any型**: 警告
- **React Hooks**: エラー（rules-of-hooks）
- **アクセシビリティ**: JSX A11y ルール適用

## TypeScript規約
- **strict mode**: 有効
- **explicit return type**: 無効（型推論優先）
- **any型**: 可能な限り避ける
- **命名規約**: camelCase（変数・関数）、PascalCase（クラス・コンポーネント）

## ファイル・ディレクトリ構造

### フロントエンド（Next.js）
```
src/
├── app/           # App Router（ページ）
├── components/    # 再利用可能なUIコンポーネント
├── hooks/         # カスタムフック
├── lib/          # ユーティリティ関数
├── providers/    # Context Providers
├── types/        # TypeScript型定義
├── styles/       # グローバルスタイル
└── config/       # 設定ファイル
```

### バックエンド（NestJS）
```
src/
├── auth/         # 認証関連
├── accounts/     # アカウント管理
├── posts/        # 投稿管理
├── media/        # メディア処理
├── analytics/    # 分析機能
├── common/       # 共通モジュール
├── entities/     # データベースエンティティ
├── config/       # 設定
└── workers/      # バックグラウンド処理
```

## コメント・ドキュメント
- **日本語コメント**: 可（複雑なロジックのみ）
- **JSDoc**: パブリック関数・メソッドに推奨
- **TODOコメント**: 形式統一（// TODO: 説明）
- **API仕様**: Swagger/OpenAPI で自動生成