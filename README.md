# On-Connect

幼稚園・保育園・学校向け 職員間コミュニケーションアプリ「**On-Connect**」

詳細な設計企画書は [docs/DESIGN.md](docs/DESIGN.md) を参照。開発理念・機能要件・データ設計・予算感などはすべてそちらに記載している。

## モノレポ構成

```
On-Connect-prototype/
├── infra/            AWSインフラ定義（AWS CDK / TypeScript）
├── apps/
│   ├── web/          Webクライアント（React + Vite、Chromeブラウザ想定）
│   └── mobile/        モバイルクライアント（React Native / Expo、iOS・Android）
├── packages/
│   └── shared/        web・mobile・infraで共有するドメイン型定義（TypeScript）
├── assets/brand/      公式アイコン（ブランドデザイン準拠、生成元スクリプトはscripts/参照）
└── docs/
    └── DESIGN.md       設計企画書
```

npm workspaces によるモノレポ管理を採用しており、ルートで `npm install` すると全ワークスペースの依存関係がまとめてインストールされる。

## 対応環境・技術スタック

| レイヤー | 技術 |
|---|---|
| Web | React（Vite） |
| Mobile | React Native（Expo） |
| API / 業務ロジック | Amazon API Gateway + AWS Lambda |
| リアルタイムチャット | AWS AppSync（GraphQL Subscriptions） |
| 認証 | Amazon Cognito |
| データベース | Amazon DynamoDB |
| ファイル保存 | Amazon S3 + CloudFront |
| 音声通話 | Amazon Chime SDK（1対1） |
| 予約送信 | Amazon EventBridge Scheduler |
| プッシュ通知 | Amazon Pinpoint / Amazon SNS |
| インフラ管理 | AWS CDK（TypeScript） |

詳細は [docs/DESIGN.md](docs/DESIGN.md) 4章「システム全体構成（アーキテクチャ）」を参照。

## セットアップ

```bash
npm install
```

Node.js 20系を推奨（`.nvmrc` 参照）。

### Web

```bash
npm run web:dev
```

### Mobile（Expo）

```bash
npm run mobile:start
```

Expo Go アプリ、または `expo run:ios` / `expo run:android` で実機・シミュレータ確認を行う。詳細は [apps/mobile/README.md](apps/mobile/README.md) を参照。

### Infra（AWS CDK）

```bash
npm run infra:synth
npm run infra:diff
npm run infra:deploy
```

事前に `aws configure` によるAWS認証情報の設定、および初回のみ `cdk bootstrap` が必要。詳細は [infra/README.md](infra/README.md) を参照。

## 現在のスコープ

- ユーザー管理（ログイン／ステータス／ロール／メンバーカテゴリ）
- チャット（予約送信／グループチャット／緊急通知／1対1音声通話／本文検索）
- メンバー一覧（通知ON/OFF状況の確認、個別チャット・音声通話の開始）
- 掲示板（カテゴリー表示／ファイル添付／閲覧権限／本文検索）
- 外部リンク集（ブックマーク、Googleカレンダーへのリンクを含む）

申請機能は本スコープから除外し、Googleフォーム等の既存無料サービスへのリンク（外部リンク集）で代替する。
カレンダービュー機能（アプリ内でのGoogleカレンダー閲覧）は廃止し、リンク集からGoogleカレンダーのURLへ直接遷移する方式に変更した。

補足として、以下は設計企画書の記載を補う運用上の決定事項：
- **通知ステータスの毎朝自動リセット**：メンバーからの要望を受け、毎朝7:00（Asia/Tokyo）に全メンバーの通知ステータスを自動的にONへ戻す（`infra`のEventBridge Scheduler定期実行、実装済み）。
- **個別メッセージの窓口**：チャット一覧画面の「個別メッセージ」からメンバーを検索し、1対1チャットを開始する（web/mobile UI実装済み、バックエンドはTODO）。
- **管理者機能はブラウザ版限定**：管理者用設定画面はWeb版のみに提供し、モバイル版にはタブを設けない。Web側でも管理者権限を持つメンバーにのみ表示する。

## 現状（雛形段階）

各ワークスペースの画面・Lambdaハンドラは、設計企画書の章番号を紐づけたコメント付きのプレースホルダーとして実装されている。実装が必要な箇所は各ワークスペースの `README.md` および各ファイル内の `TODO` コメントを参照。

- [infra/README.md](infra/README.md)
- [apps/web/README.md](apps/web/README.md)
- [apps/mobile/README.md](apps/mobile/README.md)
