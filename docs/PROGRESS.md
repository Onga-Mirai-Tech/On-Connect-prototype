# On-Connect 実装進捗まとめ（〜2026-08-03時点）

このファイルは、コンテキストウィンドウのリセットに備えて、これまでの会話で決まったこと・作った物・
残っている作業を1つにまとめたものです。新しいセッションではまず本ファイルと
[docs/DESIGN.md](DESIGN.md)（元の設計企画書）を読めば、経緯を再現できます。

**注意**：ここに書かれた内容は執筆時点のスナップショットです。ファイルパスや実装状況は
実際のコード（`git log`、各ディレクトリの中身）で必ず裏取りしてください。

---

## 1. プロジェクト概要

- **On-Connect**：幼稚園・保育園・学校向け職員間コミュニケーションアプリ
- モノレポ構成：
  - `infra/` — AWS CDK（TypeScript）
  - `apps/web/` — React + Vite（Webクライアント）
  - `apps/mobile/` — React Native + Expo（モバイルクライアント）
  - `packages/shared/` — web/mobile/infraで共有する型定義・ダミーデータ
  - `docs/DESIGN.md` — 元の設計企画書（オリジナルのまま、編集していない）
  - `assets/brand/` — 公式アイコン画像、`scripts/generate-brand-icon.py` — アイコン生成スクリプト（Pillow製）

## 2. 環境まわりの確認済み事項

- Node.js / npm / AWS CLI / CDK CLI はローカルに導入済み
- AWS SSOプロファイル `dev`（アカウント `978841974977`、`AdministratorAccess`、リージョン `ap-northeast-1`）でログイン可能
- `cdk bootstrap` 実行済み（CDKToolkitスタックあり）
- **まだAWSへの実デプロイ（`cdk deploy`）は行っていない**。`cdk synth` とJestテストのみ実施し、いずれも成功
- Web: `npm run build --workspace apps/web` 成功
- Mobile: `npx tsc --noEmit`（apps/mobile内）成功。シミュレータでの実機確認は未実施

## 3. 主要な意思決定・変更履歴（時系列）

1. **雛形作成**：design.mdを基にinfra(CDK)/apps/web/apps/mobile/packages/sharedの一式を新規作成
2. **動作確認**：`npm install`、`cdk synth`、web build、ブラウザ実クリック確認を実施。バグ2件を発見・修正
   - `infra/tsconfig.json`の`typeRoots`設定ミス（npm workspacesのホイスト先を見ていなかった）
   - Lambda環境変数`TZ`はAWS予約キーで実デプロイが失敗する不具合
   - Web初期表示でダークモード時に本文が読めないCSSバグ
3. **通知ステータス毎朝7時自動リセット**：EventBridge Scheduler（`cron(0 7 * * ? *)`, Asia/Tokyo）+ Lambda
   （`infra/lambda/users/dailyNotificationReset.ts`）で**実装済み**（DynamoDB Scan/Update含め本実装、スタブではない）
4. **個別メッセージの窓口**：チャット一覧に「個別メッセージ」導線を追加（web/mobile）
5. **カレンダー表示アカウントの設定方針**：Googleサービスアカウント方式を採用する設計にした
   → **後に機能ごと廃止**（8.参照）
6. **公式アイコン制作**：design.md記載の「ミント角丸＋トグルスイッチ＋3つ穴コンセント」を
   Pillowで生成 → ユーザーフィードバックにより**「3つ穴コンセント」モチーフを撤回**し、
   「ON/OFFトグルスイッチ＋メンバー3人が線でつながっている」デザインに再生成（現行版）
7. **メンバー一覧タブ追加**：下部タブに新設。通知ON/OFF表示、個別チャット・音声通話（デモ）をその場から起動可能
8. **カレンダー機能の完全廃止**：
   - web/mobileの画面・ナビタブを削除
   - infra側も `ScheduleCacheTable` / `OrgSettingsTable` / `lambda/calendar/` / 関連APIルートを削除
     （DynamoDBテーブル数：10→**8個**、テスト更新済み）
   - 代わりにリンク集の先頭に「園の共有カレンダー」へのリンクを追加
9. **用語統一「職員→メンバー」**：UI文言だけでなくコード識別子まで全面リネーム
   （`StaffCategory`→`MemberCategory`、DynamoDBテーブル名`StaffCategories`→`MemberCategories`、
   Cognitoグループ`Staff`→`Member`など）。デプロイ前だったため安全にリネームできた
10. **管理者機能はブラウザ版限定**：モバイルから`AdminScreen`ごと削除。Web側も管理者権限を
    持つメンバーにのみ「管理者」タブを表示（`mockCurrentUserIsAdmin`で判定、現状はダミーデータ判定）
11. **角丸デザインへの統一**：Web側は`index.css`にグローバル角丸ルール追加、Mobile側は各画面の
    `borderRadius`を個別に底上げ（8→12、10→16など）。カテゴリ/タブ切り替えもチップ風に統一
12. **下部タブバーの追従化**：Web側`HomeLayout`のnavを`position: fixed`化。Mobileは
    `@react-navigation/bottom-tabs`が標準で画面下部に固定されるため変更不要
13. **検索・ソート機能**：
    - チャット一覧：メッセージ本文検索（該当ルームのみ表示、一致メッセージのスニペット表示）
    - メンバー一覧：氏名検索＋ロール別グループ表示（`mockRoles`定義順）
    - 掲示板：本文検索（カテゴリフィルタと併用可）
14. **ふりがな対応**：`User`型に`furigana`フィールド追加、全9名分設定。
    `memberMatchesQuery`（`packages/shared/src/mockData.ts`）で氏名・ふりがな両方に一致する検索を共通化
15. **ヘッダーにログイン中メンバー表示**：Web/Mobile双方のヘッダー左側に「氏名＋通知ON/OFF」を表示。
    `NotificationStatusContext`（web/mobile双方に実装）で個人設定画面の通知トグルとヘッダー表示を同期

## 4. 現在のダミー登録ユーザーの設定

- `mockCurrentUserId = "user-03"`（田中 美咲、一般メンバー、非管理者）が「ログイン中の自分」
- 管理者は `user-01`（佐藤 陽子）・`user-02`（高橋 誠）の2名
- 管理者視点の画面を見たい場合は `packages/shared/src/mockData.ts` の `mockCurrentUserId` を
  `"user-01"` 等に変更する（Webの「管理者」タブや管理者向け表示が現れる）

## 5. 実装状況（本実装 vs スタブ）

### 本実装済み（実際に動くロジック）
- CDKインフラのリソース定義一式（Cognito、DynamoDB 8テーブル、AppSync、S3+CloudFront、
  EventBridge Scheduler、API Gateway）
- 通知ステータス毎朝7時自動リセットLambda（`dailyNotificationReset.ts`）
- Web/Mobileの全画面UI（ダミーデータ`packages/shared/src/mockData.ts`で表示）
- 検索・フィルタ・ソート・ヘッダー連携などのフロントエンドロジック

### 未実装（TODOコメントあり、501スタブ等）
- ユーザー/掲示板/リンク集のDynamoDB CRUD Lambda（`infra/lambda/**`）
- Messagesテーブル streams → EventBridge Scheduler の CreateSchedule/DeleteSchedule
  （予約送信メッセージの実スケジューリング）
- プッシュ通知Lambda内の実際の送信ロジック（`notificationStatus`/`forceNotify`判定は設計済みだが未実装）
- Amazon Chime SDK Meeting/Attendee作成（音声通話は現状デモの着信画面遷移のみ）
- Cognito認証・AppSyncクライアント接続（web/mobileともにログインはダミーで素通り）

## 6. 会話内で回答した設計質問（コード変更なし、方針のみ）

- **通知音の設定方針**：未着手・要検討事項として整理。OS標準音を基本とし、緊急連絡は専用音、
  音声通話着信はループ再生の着信音的UIが必要になる見込み、という方向性を提示済み
  （`infra/README.md`の「未検討・要判断事項」に追記するかは未対応）
- **通知OFF中の通知の扱い**：既存設計通り、メッセージ・掲示板本体はサーバーに保存され
  アプリを開けば閲覧可能（未読バッジも機能する）。抑制されるのはOS通知（バナー・音）のみ。
  緊急連絡フラグ付きメッセージだけは例外的にOFF中でも配信、音声通話の着信のみ例外なく届かない

## 7. 主要ファイルの場所（初見の人向け索引）

| 内容 | パス |
|---|---|
| 設計企画書（オリジナル） | `docs/DESIGN.md` |
| 本ファイル | `docs/PROGRESS.md` |
| 共有ドメイン型定義 | `packages/shared/src/types.ts` |
| ダミーデータ・検索ヘルパー | `packages/shared/src/mockData.ts` |
| CDKスタック本体 | `infra/lib/on-connect-stack.ts` |
| CDK各種construct | `infra/lib/constructs/*.ts` |
| Lambdaハンドラ | `infra/lambda/**/*.ts` |
| Web: ルーティング | `apps/web/src/router.tsx` |
| Web: 共通レイアウト・ヘッダー・下部タブ | `apps/web/src/pages/HomeLayout.tsx` |
| Web: 通知状態Context | `apps/web/src/context/NotificationStatusContext.tsx` |
| Mobile: ナビゲーション定義 | `apps/mobile/src/navigation/AppNavigator.tsx` |
| Mobile: ヘッダー左側コンポーネント | `apps/mobile/src/navigation/HeaderStatus.tsx` |
| Mobile: 通知状態Context | `apps/mobile/src/context/NotificationStatusContext.tsx` |
| ブランドアイコン生成スクリプト | `scripts/generate-brand-icon.py` |
| ブランドアイコン画像 | `assets/brand/*.png` |

## 8. 次にやりそうなこと（候補）

- Mobileをシミュレータ/実機で見た目確認
- infra Lambdaの実装（TODOコメント参照、優先度が高いのはユーザー/掲示板CRUD）
- Cognito認証・AppSyncクライアント接続（ログインを実際に機能させる）
- 通知音の仕様確定
- Amazon Chime SDKの音声通話実装
- （必要なら）ここまでの変更をgitコミットする　※まだ一度もコミットしていない
