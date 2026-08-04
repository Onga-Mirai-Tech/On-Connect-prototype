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

- Node.js / npm / AWS CLI / CDK CLI / GitHub CLI（`gh`）はローカルに導入済み
- AWS SSOプロファイル `dev`（アカウント `978841974977`、`AdministratorAccess`、リージョン `ap-northeast-1`）でログイン可能
- `cdk bootstrap` 実行済み。**`OnConnect-dev`スタックは一度デプロイ・実機疎通確認した後、`cdk destroy`
  ＋孤立したCognito User Poolの手動削除まで完了済み（20.参照）。現在AWS上にdev環境のリソースは無く、
  課金は発生していない**
- GitHubリモート`origin`（`Onga-Mirai-Tech/On-Connect-prototype`）に対して`gh auth login --web`でCLI認証済み。
  `git push`が通る状態（credential helperは`gh auth setup-git`で設定）
- Web: `npm run build --workspace apps/web` 成功
- Mobile: `npx tsc --noEmit`（apps/mobile内）成功。シミュレータでの実機確認は未実施
- `infra`: `cdk synth` と Jestテスト（5件）成功

## 3. 主要な意思決定・変更履歴（時系列）

1. **雛形作成**：design.mdを基にinfra(CDK)/apps/web/apps/mobile/packages/sharedの一式を新規作成
2. **動作確認**：`npm install`、`cdk synth`、web build、ブラウザ実クリック確認を実施。バグ2件を発見・修正
   （`infra/tsconfig.json`の`typeRoots`設定ミス、Lambda環境変数`TZ`予約キー問題、ダークモードCSSバグ）
3. **通知ステータス毎朝7時自動リセット**：EventBridge Scheduler（`cron(0 7 * * ? *)`, Asia/Tokyo）+ Lambda
   （`infra/lambda/users/dailyNotificationReset.ts`）で**実装済み**（DynamoDB Scan/Update含め本実装）
4. **個別メッセージの窓口**：チャット一覧に「個別メッセージ」導線を追加（web/mobile）
5. **公式アイコン制作**：design.md記載の「ミント角丸＋トグルスイッチ＋3つ穴コンセント」をPillowで生成
   → フィードバックにより「3つ穴コンセント」モチーフを撤回し、
   「ON/OFFトグルスイッチ＋メンバー3人が線でつながっている」デザインに再生成（現行版）
6. **メンバー一覧タブ追加**：下部タブに新設。通知ON/OFF表示、個別チャット・音声通話（デモ）をその場から起動可能
7. **カレンダー機能の廃止 → 復活**：一度は「リンク集への直接リンクのみ」に廃止したが、
   「閲覧のハードルを下げたい」との要望で**復活**（詳細は15.参照）。最終的には月/週表示を持たない
   シンプルな「今後の予定」リスト表示に落ち着いた（16.参照）
8. **用語統一「職員→メンバー」**：UI文言だけでなくコード識別子まで全面リネーム
   （`StaffCategory`→`MemberCategory`、DynamoDBテーブル名、Cognitoグループ`Staff`→`Member`など）
9. **管理者機能はブラウザ版限定**：モバイルから`AdminScreen`ごと削除。Web側も管理者権限を
   持つメンバーにのみ「管理者」タブを表示（`mockCurrentUserIsAdmin`で判定、現状はダミーデータ判定）
10. **角丸デザインへの統一**：Web側は`index.css`にグローバル角丸ルール追加、Mobile側は各画面の
    `borderRadius`を個別に底上げ。カテゴリ/タブ切り替えもチップ風に統一
11. **下部タブバーの追従化**：Web側`HomeLayout`のnavを`position: fixed`化（Mobileは標準で対応済み）
12. **検索・ソート機能**：チャット一覧（本文検索）／メンバー一覧（氏名検索＋ロール別グループ表示）／
    掲示板（本文検索、カテゴリフィルタと併用可）
13. **ふりがな対応**：`User`型に`furigana`フィールド追加、全9名分設定。
    `memberMatchesQuery`で氏名・ふりがな両方に一致する検索を共通化
14. **ヘッダーにログイン中メンバー表示**：Web/Mobile双方のヘッダー左側に「氏名＋通知ON/OFF」を表示。
    `NotificationStatusContext`（web/mobile双方）で個人設定画面の通知トグルとヘッダー表示を同期
15. **グループチャット名にGC_接頭辞／参加メンバー表示／個人チャットの相手の通知状態表示**：
    グループ作成時に自動で`GC_`を付与（`GroupChatCreatePage/Screen`でプレフィックス固定表示）、
    グループチャット詳細に参加メンバー一覧、1対1チャットに相手のON/OFF状態を表示
16. **カレンダー機能の再実装＋簡素化**：サービスアカウント方式の閲覧専用ビューとしてinfra
    （`ScheduleCacheTable`/`OrgSettingsTable`/`lambda/calendar/`/関連APIルート）を復元。
    その後の要望で月表示／週表示のトグルは削除し、**「今後の予定」のみのリスト表示**に変更
    （過去のイベントはフィルタで非表示）。リンク集の「園の共有カレンダー」直リンクも並行して維持
17. **チャットにリアクション機能**：メッセージに絵文字リアクション（👍❤️😂😮😢）を追加。
    共通コンポーネント`ReactionBar`（web/mobileそれぞれに実装）、トグルロジックは
    `packages/shared`の`toggleReaction`関数で共通化
18. **掲示板の構成変更（タイトル＋HTML本文＋添付ファイル）**：
    - `BulletinPost`に`title`フィールドを追加、`body`はHTML文字列として扱う設計に変更
    - 投稿・編集画面に簡易HTML編集ツールバー（太字/斜体/下線/リンク/箇条書き）+ ライブプレビューを実装
      （`HtmlEditor`コンポーネント。Mobileは`react-native-webview`でプレビュー描画）
    - 一覧画面はタイトルを太字で強調し、本文はHTMLタグを除いた冒頭プレビューを表示
    - 新設した「掲示板詳細画面」（`BulletinDetailPage`/`BulletinDetailScreen`）で本文全文表示・
      リアクション・コメント機能を実装（`BulletinComment`型、`mockBulletinComments`を追加）
19. **infra Lambda CRUD実装（Users/Roles/MemberCategories、BulletinPosts、OrgLinks）** — ローカル単体テストのみ、
    **AWSへの実デプロイはまだ行っていない**：
    - `infra/lambda/common/http.ts`・`dynamo.ts`にレスポンス生成／エラーハンドリング／認証claims取得の共通処理を追加
    - `infra/lambda/users/index.ts`：Users CRUDに加え、`/roles`・`/member-categories`もパスルーティングで同居
      （CDK側は元々このLambdaにRoles/MemberCategoriesテーブルの権限を付与済みだったが、APIルートが無かったため
      `infra/lib/constructs/api-construct.ts`に`/roles`・`/member-categories`リソースを追加）
    - 「最後の1名の管理者は削除・降格できない」ガード（5.1.3）を実装：`Roles.permissions.manageUsers`を
      元に判定。ロール削除・メンバーカテゴリ削除も、ユーザーに割り当て中の場合は409で拒否
    - `infra/lambda/bulletin/crud.ts`：BulletinPosts CRUD＋`visibleCategoryIds`による閲覧フィルタ（5.3.3）。
      呼び出し元の`memberCategoryId`を引くため、`bulletinFn`にUsersテーブルの読み取り権限・環境変数を追加
      （元のCDKコードには無かった）
    - `infra/lambda/links/crud.ts`：OrgLinks CRUD（シンプル）
    - `userId`はCognitoの`sub`と一致させる前提（`event.requestContext.authorizer.claims.sub`から取得）。
      ユーザー作成時に呼び出し側が`userId`を明示指定する必要がある（Cognito側のユーザー作成は別途必要、未実装）
    - 添付ファイルの署名付きURL発行（アップロード／ダウンロード）は今回のスコープ外、`attachmentKeys`の
      文字列配列を保存・返却するのみ
    - `@on-connect/shared`をinfraの依存に追加し、Lambda側もドメイン型定義を共有するように変更
    - テストは`aws-sdk-client-mock`でDynamoDBDocumentClientをモック化し、
      `infra/test/lambda/{users,bulletin,links}.test.ts`に31件のユニットテストを追加（全件green）。
      `npm run build --workspace infra`・`cdk synth`も成功を確認済み
20. **`OnConnect-dev`スタックを初回デプロイ、Cognitoテストユーザーで実機疎通確認** — **この時点からAWS課金が発生している**：
    - `cdk deploy`でCognito・DynamoDB10テーブル・AppSync・S3+CloudFront・API Gateway等一式を初回作成
      （デプロイ時間約249秒。出力: `RestApiUrl`・`UserPoolId`・`UserPoolClientId`等）
    - Cognitoにテストユーザー（`on-connect-smoketest@example.com`）を`admin-create-user`で作成し、
      `initiate-auth`（USER_PASSWORD_AUTH）でIDトークンを取得。curlで全CRUDエンドポイントを実地確認（成功）
    - **疎通確認中にバグを発見・修正**：`infra/lambda/users/index.ts`の`updateRole`内、
      「唯一の管理者ロールからmanageUsers権限を剥奪しようとした場合に拒否する」ガードの条件式が反転しており、
      本来拒否すべきケースで200を返してしまっていた（ユニットテストでは未検出、実機のcurl確認で発覚）。
      `otherAdminCount === 0`で拒否するよう修正し、再現テストを追加した上で再デプロイ・再検証済み
    - 「最後の管理者を削除・降格できない」「ロール／メンバーカテゴリを使用中に削除できない」の
      4パターンすべて実機で409になることを確認済み
    - 目視確認は不要とのことで、疎通確認後に`cdk destroy`で`OnConnect-dev`スタックを削除済み。
      **Cognito User Poolのみ`RemovalPolicy.RETAIN`（`infra/lib/constructs/auth-construct.ts`）のため
      スタック削除時に自動では消えず孤立して残った**が、これも手動で`delete-user-pool`して削除済み。
      現時点で`dev`環境のAWSリソースは残っておらず、課金は発生していない
    - **未実装のまま残っている課題**：呼び出し元のロール権限（`manageUsers`等）をチェックする認可ロジックが
      まだ無く、認証済みユーザーなら誰でもUsers/Roles/MemberCategoriesを操作できてしまう
      （5.1.3が本来想定する権限チェックとは別物。→21.で対応済み）
21. **Users/Roles/MemberCategoriesの呼び出し元権限チェック（認可）を実装** — 20.で見つけた「認証さえ通れば
    誰でも操作できる」穴への対応：
    - `infra/lambda/common/authz.ts`を新設。`getCurrentUserPermissions`/`requirePermission`で、
      呼び出し元(Cognito sub)→Usersテーブル→Rolesテーブルの順に辿って`RolePermissions`を取得し、
      指定した権限フラグが無ければ403を返す
    - `users/index.ts`に適用：Users作成/削除・Roles全操作・MemberCategories全操作の書き込み系に
      `manageUsers`/`manageRoles`/`manageMemberCategories`をそれぞれ要求
    - **自己サービス例外**：自分自身の`notificationStatus`のみを変更するPUT（5.1.2の通知ON/OFF切替）は
      権限チェック無しで本人が行える。それ以外のフィールド変更や他人の更新は`manageUsers`が必要
    - **初期セットアップのブートストラップ例外**：Users/Roles/MemberCategoriesの各テーブルが完全に空の場合
      （組織の初回セットアップ前）に限り、最初の1件目の作成は権限チェック無しで行える。
      これが無いと「誰も管理者権限を持っていないので誰も管理者ロールを作れない」という
      鶏卵問題になるため（前回のdev環境での動作確認で実際にこの手順を踏んだ）
    - GET系（一覧・単体取得）は権限チェック対象外（メンバー一覧タブ等、一般メンバーからの閲覧を想定）
    - bulletin/links（`manageBulletinCategories`/`manageOrgLinks`）には未適用。今回はUsers/Roles/
      MemberCategoriesのみに絞った（範囲を広げる場合は別タスク）
    - `infra/test/lambda/users.test.ts`を大幅に拡充（403/ブートストラップ許可/自己サービス例外を含め27件、
      プロジェクト全体で44件）。dev環境は削除済みのため、今回は**ローカル単体テストのみで確認**
      （実機での再デプロイ・再検証はまだ行っていない）

## 4. 現在のダミー登録ユーザーの設定

- `mockCurrentUserId = "user-03"`（田中 美咲、一般メンバー、非管理者）が「ログイン中の自分」
- 管理者は `user-01`（佐藤 陽子）・`user-02`（高橋 誠）の2名
- 管理者視点の画面を見たい場合は `packages/shared/src/mockData.ts` の `mockCurrentUserId` を
  `"user-01"` 等に変更する（Webの「管理者」タブや管理者向け表示が現れる）

## 5. 実装状況（本実装 vs スタブ）

### 本実装済み（実際に動くロジック）
- CDKインフラのリソース定義一式（Cognito、DynamoDB **10テーブル**、AppSync、S3+CloudFront、
  EventBridge Scheduler、API Gateway。カレンダー関連の`ScheduleCache`/`OrgSettings`含む）
- 通知ステータス毎朝7時自動リセットLambda（`dailyNotificationReset.ts`）
- Users/Roles/MemberCategories・BulletinPosts・OrgLinksのCRUD Lambda（18.参照。**ローカル単体テストのみ確認済み、
  AWSへの実デプロイは未実施**）
- Web/Mobileの全画面UI（ダミーデータ`packages/shared/src/mockData.ts`で表示）
- 検索・フィルタ・ソート・ヘッダー連携・リアクション・コメント投稿などのフロントエンドロジック
  （いずれもローカルstateで完結。リロードで消える＝バックエンド未接続）

### 未実装（TODOコメントあり、501スタブ等）
- **Google Calendar API連携**：`infra/lambda/calendar/syncGoogleCalendar.ts`はまだ501スタブ。
  サービスアカウント認証・Calendar API呼び出し・ScheduleCacheへの保存は未実装
  （ユーザーへ確認済み：「現状はこのままでOK」、実装は今後の課題として保留中）
- Messagesテーブル streams → EventBridge Scheduler の CreateSchedule/DeleteSchedule
  （予約送信メッセージの実スケジューリング）
- プッシュ通知Lambda内の実際の送信ロジック、リアクション/コメントの永続化API
- Amazon Chime SDK Meeting/Attendee作成（音声通話は現状デモの着信画面遷移のみ）
- Cognito認証・AppSyncクライアント接続（web/mobileともにログインはダミーで素通り）

## 6. 会話内で回答した設計質問（コード変更なし、方針のみ）

- **通知音の設定方針**：未着手・要検討事項。OS標準音を基本とし、緊急連絡は専用音、
  音声通話着信はループ再生の着信音的UIが必要になる見込み、という方向性を提示済み
- **通知OFF中の通知の扱い**：メッセージ・掲示板本体はサーバーに保存されアプリを開けば閲覧可能。
  抑制されるのはOS通知（バナー・音）のみ。緊急連絡フラグ付きメッセージだけは例外的にOFF中でも配信、
  音声通話の着信のみ例外なく届かない
- **Googleカレンダーの共有設定方法**：専用の共有カレンダーを新規作成し、カレンダーIDを控えたうえで
  「特定のユーザーとの共有」（閲覧権限）またはサービスアカウントのメールアドレスへ共有する手順を案内済み。
  ただし実際にAPI連携するバックエンド実装（上記5.参照）はまだ無いため、現時点ではカレンダーIDを
  用意してもアプリが自動取得することはできない旨を明示済み

## 7. 主要ファイルの場所（初見の人向け索引）

| 内容 | パス |
|---|---|
| 設計企画書（オリジナル） | `docs/DESIGN.md` |
| 本ファイル | `docs/PROGRESS.md` |
| 共有ドメイン型定義 | `packages/shared/src/types.ts` |
| ダミーデータ・検索/リアクションヘルパー | `packages/shared/src/mockData.ts` |
| CDKスタック本体 | `infra/lib/on-connect-stack.ts` |
| CDK各種construct | `infra/lib/constructs/*.ts` |
| Lambdaハンドラ | `infra/lambda/**/*.ts` |
| Lambda共通ヘルパー（レスポンス生成・DynamoDBクライアント） | `infra/lambda/common/http.ts` / `dynamo.ts` |
| Lambda単体テスト（aws-sdk-client-mock使用） | `infra/test/lambda/*.test.ts` |
| Web: ルーティング | `apps/web/src/router.tsx` |
| Web: 共通レイアウト・ヘッダー・下部タブ | `apps/web/src/pages/HomeLayout.tsx` |
| Web: リアクションバー / HTML編集 | `apps/web/src/components/ReactionBar.tsx` / `HtmlEditor.tsx` |
| Web: 掲示板詳細（リアクション・コメント） | `apps/web/src/pages/BulletinDetailPage.tsx` |
| Web: 通知状態Context | `apps/web/src/context/NotificationStatusContext.tsx` |
| Mobile: ナビゲーション定義 | `apps/mobile/src/navigation/AppNavigator.tsx` |
| Mobile: ヘッダー左側コンポーネント | `apps/mobile/src/navigation/HeaderStatus.tsx` |
| Mobile: リアクションバー / HTML編集 | `apps/mobile/src/components/ReactionBar.tsx` / `HtmlEditor.tsx` |
| Mobile: 掲示板詳細 | `apps/mobile/src/screens/BulletinDetailScreen.tsx` |
| Mobile: 通知状態Context | `apps/mobile/src/context/NotificationStatusContext.tsx` |
| ブランドアイコン生成スクリプト／画像 | `scripts/generate-brand-icon.py` / `assets/brand/*.png` |

## 8. 次にやりそうなこと（候補）

- **21.の権限チェックをdev環境に再デプロイして実機確認**（今回はローカル単体テストのみ。
  bulletin/OrgLinksへの同種の権限チェック拡張を含めるかも要検討）
- リアクション/コメントの永続化（掲示板コメント用のDynamoDBテーブルは未作成）、`notifyOnPost.ts`の実装
- 予約送信の実スケジューリング（`onMessageStreamChange.ts`/`sendScheduled.ts`）
- 添付ファイルのS3署名付きURL発行（アップロード／ダウンロード）
- Mobileをシミュレータ/実機で見た目確認
- Google Calendar API連携の実装（サービスアカウント認証、定期同期Lambda）— ユーザーは現状保留でOKとのこと
- Cognito認証・AppSyncクライアント接続（ログインを実際に機能させる。現状Web/Mobileともフロントは
  APIを一切呼んでおらず、全画面`mockData`直参照のまま）
- 通知音の仕様確定
- Amazon Chime SDKの音声通話実装
