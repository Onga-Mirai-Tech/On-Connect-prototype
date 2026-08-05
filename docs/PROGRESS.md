# On-Connect 実装進捗まとめ（〜2026-08-05時点）

このファイルは、コンテキストウィンドウのリセットに備えて、これまでの会話で決まったこと・作った物・
残っている作業を1つにまとめたものです。新しいセッションではまず本ファイルと
[docs/DESIGN.md](DESIGN.md)（元の設計企画書）を読めば、経緯を再現できます。

**注意**：ここに書かれた内容は執筆時点のスナップショットです。ファイルパスや実装状況は
実際のコード（`git log`、各ディレクトリの中身）で必ず裏取りしてください。

---

## 0. まず読むべきこと（最優先・今回のセッションの要約）

直近のセッションで、当初の「Users/Roles/MemberCategories CRUD実装」から大きく発展し、
**大規模な機能拡張（権限モデルの再設計＋カレンダー独立DB化＋休日/当番/シフト管理）**を
6フェーズに分けて計画・実装した。詳細な設計議論と各フェーズの内容は
**実装計画ファイル `/Users/ikkounobuyuki/.claude/plans/elegant-wobbling-lollipop.md` に記録済み**
（Plan modeで作成したもの。Context・全6フェーズの変更ファイル一覧が載っている）。

### 完了したフェーズ
- **Phase 1（権限モデルの再設計）**：完了・ローカルテスト確認済み
- **Phase 2（カレンダー独立DB化＋カテゴリー管理）**：完了・ローカルテスト確認済み
- **Phase 3（休日・当番・シフトの統合管理）**：完了・ローカルテスト確認済み。
  ただし**ユーザーから追加の詰め要望あり（下記9章参照、次回セッションの最優先タスク）**

### 未着手のフェーズ（計画ファイル参照）
- Phase 4：メニュー画面・ナビゲーション再編
- Phase 5：チャットのメンション機能
- Phase 6：カレンダーの個別予定`.ics`エクスポート＋リマインド

### 現在のコミット状況
このセッションの最後に**コミット＆プッシュ済み**（`git log`で確認すること）。
Phase1後半〜Phase3までの変更が1つ（または複数）のコミットに含まれている。

### AWSデプロイの状況
**Phase 1〜3の変更はAWSにデプロイされていない**（ローカルの`npm test`・`cdk synth`のみで確認）。
以前（このセッションより前）に一度`OnConnect-dev`をデプロイして実機確認したが、確認後に
`cdk destroy`＋孤立したCognito User Poolの手動削除まで完了済みで、現在AWS上にリソースは無い。
再デプロイする場合は必ずユーザーの明示的な承認を得ること（過去にAWS課金についての合意プロセスあり）。

---

## 1. プロジェクト概要

- **On-Connect**：幼稚園・保育園・学校向け職員間コミュニケーションアプリ
- モノレポ構成：
  - `infra/` — AWS CDK（TypeScript）
  - `apps/web/` — React + Vite（Webクライアント）
  - `apps/mobile/` — React Native + Expo（モバイルクライアント）
  - `packages/shared/` — web/mobile/infraで共有する型定義・ダミーデータ
  - `docs/DESIGN.md` — 元の設計企画書（オリジナルのまま、編集していない）
  - `docs/PROGRESS.md` — 本ファイル
  - `assets/brand/` — 公式アイコン画像、`scripts/generate-brand-icon.py` — アイコン生成スクリプト（Pillow製）

## 2. 環境まわりの確認済み事項

- Node.js / npm / AWS CLI / CDK CLI / GitHub CLI（`gh`）はローカルに導入済み
- AWS SSOプロファイル `dev`（アカウント `978841974977`、`AdministratorAccess`、リージョン `ap-northeast-1`）でログイン可能
- `cdk bootstrap` 実行済み。**現在AWS上にdev環境のリソースは無く、課金は発生していない**
  （一度デプロイ・実機疎通確認後、`cdk destroy`＋孤立Cognito User Poolの手動削除まで完了済み）
- GitHubリモート`origin`（`Onga-Mirai-Tech/On-Connect-prototype`）に対して`gh auth login --web`でCLI認証済み。
  `git push`が通る状態（credential helperは`gh auth setup-git`で設定）
- Web: `npm run build --workspace apps/web` 成功
- Mobile: `npx tsc --noEmit`（apps/mobile内）成功。シミュレータでの実機確認は未実施
- `infra`: `cdk synth` と Jestテスト成功（Phase3完了時点で**76件**）
- **エクセルファイル読み込みの注意**：macOSの`~/.Trash`（ゴミ箱）はTCC制限で`openpyxl`等から直接読めない
  （`Operation not permitted`）。ユーザーにデスクトップ等へ移動してもらう必要がある

## 3. 主要な意思決定・変更履歴（時系列）

1. **雛形作成**：design.mdを基にinfra(CDK)/apps/web/apps/mobile/packages/sharedの一式を新規作成
2. **動作確認**：`npm install`、`cdk synth`、web build、ブラウザ実クリック確認を実施。バグ2件を発見・修正
   （`infra/tsconfig.json`の`typeRoots`設定ミス、Lambda環境変数`TZ`予約キー問題、ダークモードCSSバグ）
3. **通知ステータス毎朝7時自動リセット**：EventBridge Scheduler（`cron(0 7 * * ? *)`, Asia/Tokyo）+ Lambda
   （`infra/lambda/users/dailyNotificationReset.ts`）で実装（→24.で休日連動ロジックに拡張）
4. **個別メッセージの窓口**：チャット一覧に「個別メッセージ」導線を追加（web/mobile）
5. **公式アイコン制作**：ON/OFFトグルスイッチ＋メンバー3人が線でつながっているデザイン（現行版）
6. **メンバー一覧タブ追加**：下部タブに新設。通知ON/OFF表示、個別チャット・音声通話（デモ）をその場から起動可能
7. **カレンダー機能の廃止 → 復活 → 独立DB化**：最終形態は24.参照
8. **用語統一「職員→メンバー」**：UI文言だけでなくコード識別子まで全面リネーム
9. **管理者機能はブラウザ版限定**：モバイルから`AdminScreen`ごと削除
10. **角丸デザインへの統一**
11. **下部タブバーの追従化**
12. **検索・ソート機能**：チャット一覧／メンバー一覧／掲示板
13. **ふりがな対応**：`User`型に`furigana`フィールド追加
14. **ヘッダーにログイン中メンバー表示**：`NotificationStatusContext`で同期
15. **グループチャット名にGC_接頭辞／参加メンバー表示／個人チャットの相手の通知状態表示**
16. **カレンダー機能の再実装＋簡素化**：後に22.でGoogleカレンダー同期自体を廃止し独立DB化
17. **チャットにリアクション機能**：`ReactionBar`コンポーネント、`toggleReaction`関数で共通化
18. **掲示板の構成変更（タイトル＋HTML本文＋添付ファイル）**：`HtmlEditor`コンポーネント、
    掲示板詳細画面でリアクション・コメント機能
19. **infra Lambda CRUD実装（Users/Roles/MemberCategories、BulletinPosts、OrgLinks）**：
    `common/http.ts`・`dynamo.ts`共通ヘルパー新設。「最後の1名の管理者は削除・降格できない」ガード実装
20. **`OnConnect-dev`スタックを初回デプロイ、Cognitoテストユーザーで実機疎通確認**：
    実機確認中に`updateRole`の管理者ガード条件式が反転しているバグを発見・修正（ユニットテストでは
    未検出、実機curl確認で発覚）。確認後`cdk destroy`＋孤立Cognito User Pool手動削除で後片付け完了
21. **Users/Roles/MemberCategoriesの呼び出し元権限チェック（認可）を実装**：`common/authz.ts`新設。
    この時点では「ロールが権限を持つ」「休日は本人が自己申告できる」というモデルだった
    （→22.で権限モデル自体を再設計、休日の自己申告も→24.で撤回）
22. **【Phase 1】権限モデルの再設計：ロール単位→メンバー個別**：
    - `Role`から`permissions`を削除（`{roleId, name}`のみの表示ラベルに）。`User`に`permissions: RolePermissions`
      を追加し、メンバー1人1人が個別に権限フラグを持つ方式に変更（新規作成時は全項目`false`）
    - `RolePermissions`に`manageCalendarCategories`・`manageShifts`を追加（8項目に）
    - `common/authz.ts`を簡略化（Rolesテーブル参照が不要になり、Usersテーブルの参照のみに）
    - `users/index.ts`の「最後の管理者ガード」をUser直下の`permissions.manageUsers`を直接見る形に書き換え
      （Role経由の判定・`updateRole`内の管理者ガードは削除、実質シンプルになった）
    - `AdminPage.tsx`：「ロール」タブは名前だけのシンプル表示に、「ユーザー」タブにメンバーごとの
      8項目権限チェックボックスUIを追加（展開式の行、ブラウザで動作確認済み）
23. **【Phase 2】カレンダー独立DB化＋カレンダー/掲示板カテゴリー管理**：
    - Googleカレンダー同期（`ScheduleCache`/`OrgSettings`テーブル、`syncGoogleCalendar.ts`）を完全廃止。
      `CalendarEvents`（全メンバーが作成・編集・削除可、バックエンド権限チェック無し、削除確認はフロント側の
      責務）・`CalendarCategories`（`manageCalendarCategories`権限で保護）を新設
    - 掲示板にも表示カテゴリー管理を追加：`BulletinCategories`テーブル新設、`BulletinPost.category`
      （フリーテキスト）→`categoryId`（参照）に変更。`manageBulletinCategories`権限で保護
      （これは以前から権限フラグだけあって実体が無かった機能で、このタイミングで合わせて実装）
    - `common/visibility.ts`新設：`isVisibleToCategory`を掲示板・カレンダーで共通化
    - Web/Mobile：`CalendarPage`/`Screen`刷新、`CalendarEventEditPage`/`Screen`・`CalendarDetailPage`/`Screen`
      新設（削除確認ダイアログ、作成者以外の削除時は警告文を強調）
    - `AdminPage.tsx`のカレンダータブ（旧：Google連携カレンダーID設定）→カレンダーカテゴリー管理に置き換え
24. **【Phase 3】休日・当番・シフトの統合管理**：ユーザーの勤務表Excel（参考資料）を読み込んで設計。
    - **権限方針の転換**：「休日は本人が自己申告できる」という21.の方針を撤回し、**休日・当番・シフトの
      全項目を`manageShifts`権限を持つ人のみが編集**（本人の分も自己申告不可）に統一
      （実務では管理者がExcelで一元管理している実態に合わせた）
    - `DutyTypes`/`ShiftTypes`テーブル新設（`{id, name, isActive}`、`manageShifts`権限で保護）。
      `isActive`フラグは「学期中と夏休み等の長期休暇でコード体系が大きく変わる」という実務上の悩みへの対処
      （無効化しても過去データは残る。入力候補からのみ外れる）
    - `MemberDailyStatus`テーブル新設（PK=`date`、SK=`userId`。「その日の全員分」を1クエリで取得するための設計）：
      `leaveType`（`FULL`/`AM`/`PM`）、`leaveReason`（`REQUESTED`＝希望休／`ASSIGNED`＝指定休、記録用で
      通知ロジックには影響しない）、`amShiftTypeId`/`pmShiftTypeId`（午前午後で別シフトを持てる。
      「早出（AM）＋午後休（PM）」のような組み合わせに対応するため）、`dutyTypeIds`（配列、複数当番を兼務可）
    - `infra/lambda/shifts/crud.ts`新設：DutyTypes/ShiftTypes/MemberDailyStatusの3系統CRUD。
      PUTは「未指定キーは現状維持、明示的な`null`はクリア、値があれば置き換え」というマージロジック
      （`resolveField`関数）。GET単体は「レコードが無い＝正常な状態」として404にせず空オブジェクトを返す
    - `dailyNotificationReset.ts`書き換え：休み初日（今日は休み・昨日は休みでない）→強制OFF、
      休み継続中（今日も昨日も休み）→何もしない（本人の手動設定を維持）、休みでない→既存のOFF→ONリセット、
      の3分岐に変更。休み明けの朝は自然に3つ目の分岐に入るので追加ジョブ無しで「休み明け自動ON」を実現
    - Web/Mobile：`ShiftManagementPage`/`Screen`新設。行＝メンバー、列＝日付の月間グリッド、
      セルをタップすると編集パネル（休日／午前・午後シフト／当番複数選択）が開く。`manageShifts`が無い
      ユーザーには「閲覧のみ」と表示しセル編集を無効化。ブラウザで実データ（早出+午後休の午前午後分割
      表示、複数当番の重複表示）を目視確認済み
    - **ルーティングのみ追加、ナビゲーションへの組み込みはPhase 4でまとめて行う**（計画通り）
    - テスト：`shifts.test.ts`・`dailyNotificationReset.test.ts`新設。プロジェクト全体で76件、全green

## 4. 現在のダミー登録ユーザーの設定

- `mockCurrentUserId = "user-03"`（田中 美咲、一般メンバー、`permissions`は全項目`false`）が「ログイン中の自分」
- 管理者相当（`permissions`が全項目`true`）は `user-01`（佐藤 陽子）・`user-02`（高橋 誠）の2名
- 管理者視点の画面を見たい場合は `packages/shared/src/mockData.ts` の `mockCurrentUserId` を
  `"user-01"` 等に変更する（Webの「管理者」タブ、シフト管理の編集権限等が現れる）
- 権限はロールでなく`User.permissions`が個別に持つ点に注意（22.参照）。`mockRoles`は名前ラベルのみ

## 5. 実装状況（本実装 vs スタブ）

### 本実装済み（実際に動くロジック、ローカルテスト確認済み・AWS未デプロイ）
- CDKインフラのリソース定義一式（Cognito、DynamoDB **14テーブル**、AppSync、S3+CloudFront、
  EventBridge Scheduler、API Gateway）
- 通知ステータス毎朝7時自動リセット＋休日連動ロジック（`dailyNotificationReset.ts`、24.参照）
- Users/Roles/MemberCategories・BulletinPosts/BulletinCategories・CalendarEvents/CalendarCategories・
  OrgLinks・DutyTypes/ShiftTypes/MemberDailyStatusの全CRUD Lambda（19,22,23,24参照）
- 呼び出し元の権限チェック（`manageUsers`/`manageRoles`/`manageMemberCategories`/`manageBulletinCategories`/
  `manageCalendarCategories`/`manageShifts`）。**bulletin/calendar/shiftsのカテゴリー管理系は権限チェック
  済みだが、CalendarEvents本体・BulletinPosts本体には権限チェックが無い**（全メンバーが作成編集削除可、
  設計上の意図的な選択）
- Web/Mobileの全画面UI（ダミーデータ`packages/shared/src/mockData.ts`で表示。シフト管理画面含む）
- 検索・フィルタ・ソート・ヘッダー連携・リアクション・コメント投稿などのフロントエンドロジック
  （いずれもローカルstateで完結。リロードで消える＝バックエンド未接続）

### 未実装（TODOコメントあり、501スタブ等）
- Messagesテーブル streams → EventBridge Scheduler の CreateSchedule/DeleteSchedule（予約送信の実装）
- プッシュ通知Lambda内の実際の送信ロジック（SNS発行、Phase 5で初めて実装予定）
- リアクション/コメントの永続化API（掲示板コメント用のDynamoDBテーブルは未作成）
- Amazon Chime SDK Meeting/Attendee作成（音声通話は現状デモの着信画面遷移のみ）
- Cognito認証・AppSyncクライアント接続（web/mobileともにログインはダミーで素通り。チャット機能全体が
  バックエンド未接続）
- チャットのメンション機能（Phase 5）
- カレンダーの`.ics`エクスポート・リマインド（Phase 6）
- メニュー画面・ナビゲーション再編（Phase 4）

## 6. 会話内で回答した設計質問（コード変更なし、方針のみ）

- **通知音の設定方針**：未着手・要検討事項
- **通知OFF中の通知の扱い**：メッセージ・掲示板本体はサーバーに保存されアプリを開けば閲覧可能。
  抑制されるのはOS通知（バナー・音）のみ。緊急連絡フラグ付きメッセージだけは例外的にOFF中でも配信、
  音声通話の着信のみ例外なく届かない
- **Googleカレンダー連携は完全に廃止**（23.参照）。理由：対象者が実質1〜2名（ユーザー本人・理事長）で
  他メンバーへの影響が薄く、常時同期の仕組みは過剰と判断。代わりにPhase 6で個別予定の`.ics`
  ダウンロードボタンのみ実装予定

## 7. 主要ファイルの場所（初見の人向け索引）

| 内容 | パス |
|---|---|
| 設計企画書（オリジナル） | `docs/DESIGN.md` |
| 本ファイル | `docs/PROGRESS.md` |
| **実装計画（Phase1〜6の詳細、変更ファイル一覧）** | `/Users/ikkounobuyuki/.claude/plans/elegant-wobbling-lollipop.md` |
| 共有ドメイン型定義 | `packages/shared/src/types.ts` |
| ダミーデータ・検索/リアクションヘルパー | `packages/shared/src/mockData.ts` |
| CDKスタック本体 | `infra/lib/on-connect-stack.ts` |
| CDK各種construct | `infra/lib/constructs/*.ts` |
| Lambdaハンドラ | `infra/lambda/**/*.ts` |
| Lambda共通ヘルパー | `infra/lambda/common/{http,dynamo,authz,visibility,date}.ts` |
| Users/Roles/MemberCategories CRUD | `infra/lambda/users/index.ts` |
| 掲示板CRUD（BulletinCategories含む） | `infra/lambda/bulletin/crud.ts` |
| カレンダーCRUD（独立DB、CalendarCategories含む） | `infra/lambda/calendar/crud.ts` |
| 休日・当番・シフトCRUD | `infra/lambda/shifts/crud.ts` |
| 通知自動リセット（休日連動） | `infra/lambda/users/dailyNotificationReset.ts` |
| Lambda単体テスト（aws-sdk-client-mock使用、76件） | `infra/test/lambda/*.test.ts` |
| Web: ルーティング | `apps/web/src/router.tsx` |
| Web: 共通レイアウト・ヘッダー・下部タブ | `apps/web/src/pages/HomeLayout.tsx` |
| Web: 管理者設定（ユーザー権限編集・各種カテゴリー管理） | `apps/web/src/pages/AdminPage.tsx` |
| Web: カレンダー一覧/詳細/編集 | `apps/web/src/pages/Calendar{Page,DetailPage,EventEditPage}.tsx` |
| Web: シフト管理（月間グリッド） | `apps/web/src/pages/ShiftManagementPage.tsx` |
| Mobile: ナビゲーション定義 | `apps/mobile/src/navigation/AppNavigator.tsx` |
| Mobile: カレンダー一覧/詳細/編集 | `apps/mobile/src/screens/Calendar{Screen,DetailScreen,EventEditScreen}.tsx` |
| Mobile: シフト管理（月間グリッド、AppNavigator未組み込み） | `apps/mobile/src/screens/ShiftManagementScreen.tsx` |
| ブランドアイコン生成スクリプト／画像 | `scripts/generate-brand-icon.py` / `assets/brand/*.png` |

## 8. 次にやりそうなこと（候補、優先度順ではない）

- **9章のPhase3追加要望に対応**（次回セッションの最優先、下記参照）
- Phase 4：メニュー画面・ナビゲーション再編（計画ファイル参照）
- Phase 5：チャットのメンション機能（計画ファイル参照）
- Phase 6：カレンダーの`.ics`エクスポート＋リマインド（計画ファイル参照）
- リアクション/コメントの永続化、`notifyOnPost.ts`の実装
- 予約送信の実スケジューリング
- Cognito認証・AppSyncクライアント接続（チャット機能をバックエンドに繋ぐ）
- Mobileをシミュレータ/実機で見た目確認
- 通知音の仕様確定
- Amazon Chime SDKの音声通話実装

## 9. Phase 3 追加要望（次回セッションの最優先タスク）

Phase 3は一度完了したが、ユーザーから以下の追加要望があり、**コンテキストウィンドウリセット後に着手する**：

1. **日付だけでなく曜日も併記**。可能であれば祝日も表示（`ShiftManagementPage`/`Screen`のグリッドヘッダー）。
   祝日データは外部ライブラリ（`@holiday-jp/holiday_jp`等）かハードコードの祝日リストが必要になる見込み。
   ライブラリ追加の可否・データソースをどうするか要検討
2. **日付の下に自由メモ欄を設ける。権限者のみ追記可能**。
   現在の`MemberDailyStatus`は「メンバー×日付」単位だが、このメモは「日付単位」（メンバーに紐づかない）の
   ものと思われる（要確認）。新しいテーブル（例：`DailyNote { date, note, updatedAt, updatedBy }`）が必要か、
   `MemberDailyStatus`とは別の設計が要る
3. **日ごとに当番の人数を算出**（Excelファイルと同じような形式）。グリッドの各日付列の下（または別行）に
   「当番タイプ別の人数」を集計表示する機能。当番タイプごとに人数をカウントするロジックをフロント側
   （またはバックエンドの集計API）に追加する必要がある
4. **月単位で、メンバーごとに当番回数・シフト回数を表示**。グリッドの右端（または別セクション）に
   月間サマリー列（メンバーごとの当番合計回数・シフト合計回数）を追加する

これらは全て**表示・集計ロジックの追加が中心**で、データモデル（1,2番を除く）自体の大きな変更は
不要と見込まれる。着手前に、2番（メモ欄の粒度）については設計確認が必要。
