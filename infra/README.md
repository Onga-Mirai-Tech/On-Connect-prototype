# infra — On-Connect AWS CDK

[docs/DESIGN.md](../docs/DESIGN.md) 4章「システム全体構成」に基づくインフラ定義（TypeScript / AWS CDK v2）。

## 構成

| Construct | 内容 | 対応する設計書の章 |
|---|---|---|
| `AuthConstruct` | Cognito User Pool・アプリクライアント・グループ(Admin/Member) | 5.1.1, 5.1.3 |
| `DatabaseConstruct` | DynamoDBテーブル（Users/Roles/MemberCategories/ChatRooms/Messages/BulletinPosts/CallLogs/OrgLinks） | 8章 |
| `StorageConstruct` | 添付ファイル用S3バケット + CloudFront配信 | 5.2.1, 5.3.2 |
| `ChatConstruct` | AppSync GraphQL API（チャットのリアルタイム配信・予約送信の保存・既読管理） | 5.2 |
| `SchedulerConstruct` | Messagesテーブルのstreamsを起点にEventBridge Schedulerへ登録するLambda群、および通知ステータスの毎朝自動リセット（cron 7:00 Asia/Tokyo） | 5.2.2, 5.1.2拡張 |
| `NotificationConstruct` | 新着チャット・掲示板更新のプッシュ通知（通知ON/OFF・緊急通知の判定） | 5.1.2, 5.2.3, 5.3.4 |
| `ApiConstruct` | ユーザー管理／掲示板CRUD／リンク集／音声通話発信のREST API | 5.1, 5.3, 5.5, 5.2.4 |

カレンダー機能（閲覧専用ビュー）は廃止し、リンク集からGoogleカレンダーのURLへ直接遷移する方式に変更した。

`bin/infra.ts` がエントリポイントで、`OnConnectStack` を1つ合成する。環境名は `-c envName=prod` のように CDK context で切り替える（未指定時は `dev`）。

## セットアップ

```bash
npm install
```

## 主なコマンド

```bash
# CloudFormationテンプレートの生成確認
npm run synth --workspace infra

# 差分確認
npm run diff --workspace infra

# デプロイ（要 AWS認証情報 / 事前に cdk bootstrap）
npm run deploy --workspace infra -- -c envName=dev

# ユニットテスト
npm test --workspace infra
```

## 実装済み範囲 / TODO

雛形段階のため、Lambdaハンドラは基本的にスタブ（`501 Not Implemented` またはログ出力のみ）です。`infra/lambda/**/*.ts` 内の `TODO` コメントを参照し、以下を実装してください。

- Users/Roles/MemberCategories・掲示板・リンク集のDynamoDB CRUD実装
- Messagesテーブル Streams → EventBridge Scheduler の CreateSchedule/DeleteSchedule 実装（予約送信の取消・編集に対応）
- プッシュ通知Lambda内での `notificationStatus` / `forceNotify` 判定ロジック（音声通話の着信通知には `forceNotify` を適用しない点に注意）
- Amazon Chime SDK Meeting/Attendee作成、CallLogsへの記録

`lambda/users/dailyNotificationReset.ts`（毎朝7:00 Asia/Tokyo に notificationStatus を一律ONへ戻す）は実装済み。

## 未検討・要判断事項（docs/DESIGN.md 11章より）

- 緊急通知フラグの濫用防止策（利用ログの可視化）
- CallKit / ConnectionService連携の要否（次フェーズ）
- オフライン時のメッセージ送信キューイング
