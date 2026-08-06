# On-Connect 実装進捗まとめ（〜2026-08-06時点、Phase 8a完了）

このファイルは、コンテキストウィンドウのリセットに備えて、これまでの会話で決まったこと・作った物・
残っている作業を1つにまとめたものです。新しいセッションではまず本ファイルと
[docs/DESIGN.md](DESIGN.md)（元の設計企画書）を読めば、経緯を再現できます。

**注意**：ここに書かれた内容は執筆時点のスナップショットです。ファイルパスや実装状況は
実際のコード（`git log`、各ディレクトリの中身）で必ず裏取りしてください。

---

## 0. まず読むべきこと（最優先・今回のセッションの要約）

当初の「Users/Roles/MemberCategories CRUD実装」から大きく発展し、
**大規模な機能拡張（権限モデルの再設計＋カレンダー独立DB化＋休日/当番/シフト管理）**を
6フェーズに分けて計画・実装した。詳細な設計議論と各フェーズの内容は
**実装計画ファイル `/Users/ikkounobuyuki/.claude/plans/elegant-wobbling-lollipop.md` に記録済み**
（Plan modeで作成したもの。Context・全6フェーズの変更ファイル一覧が載っている。Phase1〜6は全て完了済み）。

その後、カレンダーのUI改善（月表示・週表示対応、Phase 7）を追加実装。あわせてこれまでの議論で
当初計画から大きく発展した内容を整理し、残っている作業をPhase 8〜12として再洗い出しした上で、
最優先のPhase 8のうち認証基盤部分（8a）を実装した（**Phase 7の技術方針＋Phase 8〜12のロードマップ＋
Phase 8aの実装計画・決定事項は`/Users/ikkounobuyuki/.claude/plans/effervescent-gliding-patterson.md`
に記録済み**）。Phase 8aは実際のCognitoへのデプロイをまだ行っていないため、本物のログイン動作の
確認はできていない点に注意（8a〜8dが一通り終わった段階でユーザーに確認の上デプロイする既定方針）。

### 完了したフェーズ
- **Phase 1（権限モデルの再設計）**：完了・ローカルテスト確認済み
- **Phase 2（カレンダー独立DB化＋カテゴリー管理）**：完了・ローカルテスト確認済み
- **Phase 3（休日・当番・シフトの統合管理）**：完了・ローカルテスト確認済み
- **Phase 3 追加要望（曜日/祝日・メモ欄・当番人数集計・月間サマリー）**：完了・ブラウザ確認済み（9章参照）
- **Phase 4（メニュー画面・ナビゲーション再編）**：完了・web/mobile双方でブラウザ/型チェック確認済み
  （詳細は下記3章26.参照）
- **Phase 5（チャットのメンション機能）**：完了・web/mobile双方でブラウザ/型チェック確認済み
  （詳細は下記3章27.参照）
- **Phase 6（カレンダーの個別予定`.ics`エクスポート＋リマインド）**：完了・web/mobile双方で
  ブラウザ/型チェック確認済み（詳細は下記3章28.参照）。**これで実装計画ファイルの全6フェーズが完了**
- **Phase 7（カレンダー月表示・週表示対応）**：完了・web/mobile双方でブラウザ/型チェック確認済み
  （詳細は下記3章29.参照）。当初「Googleカレンダーへのリンクのみ」という設計だったためリスト表示
  しか計画されていなかったが、独立DB化（Phase 2）で前提が変わったため今回対応した
- **Phase 8a（Cognito認証基盤）**：コード実装完了。infra全101テスト・`cdk synth`・web
  build・mobile tscは通過済み。ただし**実際のCognitoにはまだ一度もデプロイしておらず、
  本物のログインの動作確認はできていない**（設計時からの既定方針。8a〜8dが一通り終わった段階で
  改めてユーザーに確認してからデプロイする）。詳細は下記3章30.参照

### Phase 8b〜12（未着手、優先順に記載。詳細は8章参照）
- **Phase 8b〜8d: 残りのREST/AppSync接続**（8aで作った認証基盤の上に、Users以外のリソース・
  チャットのAppSyncを順次接続する）
- **Phase 9: リアクション/コメントの永続化**（Phase 8後）
- **Phase 10: 予約送信の実スケジューリング**（Phase 8後、既存インフラの実地検証が中心）
- **Phase 11: Amazon Chime SDK音声通話実装**（Phase 8後、実機検証にAWSデプロイが必要）
- **Phase 12: 実際のモバイルプッシュ配信**（Phase 8後）

### 現在のコミット状況
Phase1〜Phase3（休日・当番・シフトの統合管理まで）＋Phase3追加要望（9章・3章25.）＋Phase 4（3章26.）＋
Phase 5（3章27.）＋Phase 6（3章28.）＋Phase 7（3章29.）＋Phase 8決定事項の記録は**コミット済み・未push**
（`git log`で確認すること。コミットハッシュ`19a94bb`まで）。**Phase 8a（3章30.）の変更は、
本セッション終了時点でまだ未コミット**（作業ツリーに残っている）。次回セッション開始時は
`git status`で確認し、必要ならユーザーに確認の上コミットすること。

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
- `infra`: `cdk synth` と Jestテスト成功（Phase8a完了時点で**101件**）
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
25. **【Phase 3 追加要望】シフト管理グリッドに曜日/祝日・メモ欄・当番人数集計・月間サマリーを追加**：
    9章の要望4件に対応（詳細は9章参照）。`@holiday-jp/holiday_jp`（npm、依存ゼロの祝日データライブラリ）を
    `packages/shared`に追加し、`holidays.ts`で`weekdayLabelForDate`/`holidayNameForDate`を提供。
    日付単位（メンバーに紐づかない）の自由メモは新規`DailyNote`型＋`DailyNotesTable`（PK`date`）＋
    `manageShifts`権限で保護されたCRUD（`GET/PUT/DELETE /daily-notes/{date}`、`shifts/crud.ts`に追加）で実装。
    当番人数集計・月間サマリーはバックエンドAPI変更なし、フロント側の集計ロジックのみで対応
    （`ShiftManagementPage.tsx`/`Screen.tsx`内でstatuses配列から都度算出）。
    テスト：`shifts.test.ts`にDailyNoteのケース6件追加、`on-connect-stack.test.ts`のテーブル数を15に更新。
    プロジェクト全体で82件、全green。ブラウザで実データ表示・メモ編集パネルの開閉を目視確認済み
26. **【Phase 4】メニュー画面・ナビゲーション再編**：
    - Web：新規`MenuPage.tsx`（メンバー・シフト管理・リンク集・個人設定への導線＋`manageUsers`権限保持者
      のみ管理者設定リンクを表示）。`HomeLayout.tsx`の下部タブをチャット／掲示板／カレンダー／メニューの
      4つに削減し、`mockCurrentUserIsAdmin`参照とタブ出し分けロジックをMenuPageに移設。
      `router.tsx`に`/menu`ルート追加（`members`/`shift-management`/`links`/`settings`/`admin`は
      既存パスのまま、遷移元がタブからメニュー画面に変わるだけ）
    - Mobile：新規`MenuScreen.tsx`＋`MenuStackNavigator`新設（`Members`/`ShiftManagement`/`Links`/`Settings`
      をこの配下に移動。Phase 3で画面のみ作成済みだった`ShiftManagementScreen`をここで初めてナビゲーションに
      組み込んだ）。`HomeTabParamList`を`ChatTab`/`BulletinTab`/`Calendar`/`MenuTab`の4タブに削減。
      管理者機能はブラウザ版限定という既存方針を維持しモバイルには追加しない
    - `MembersScreen.tsx`がタブ直下から`MenuStack`配下（1階層深く）に移動したことに伴い、他タブへの遷移
      （チャット開始・音声通話デモ）を`navigation.getParent()`一段だけでなく二段
      （`MenuStack→HomeTab→RootStack`）で辿るよう navigation 呼び出しを修正
    - テスト：Lambda/CDK変更無し。`npm run build --workspace apps/web`・`npx tsc --noEmit`（mobile）で
      型エラー無しを確認。ブラウザで4タブ構成・メニュー画面からの遷移・管理者/非管理者での表示切り替え
      （`mockCurrentUserId`を一時的に`user-01`に切り替えて確認、確認後`user-03`に戻し済み）を目視確認済み
27. **【Phase 5】チャットのメンション機能**：
    - `packages/shared/src/types.ts`の`Message`に`mentionedUserIds?: string[]`追加。
      `infra/graphql/schema.graphql`の`Message`・`SendMessageInput`にも追加、`chat-construct.ts`の
      `SendMessageResolver` VTLで`attachmentKeys`と同じ「未指定なら空配列」パターンで属性を書き込むよう対応
    - 新規`infra/lambda/common/push.ts`：SNS発行の共通ヘルパー`publishPush(topicArn, payload)`
      （このプロジェクトで初めてSNS発行を実装。Phase 6のリマインドもここを再利用する予定）
    - `infra/lambda/messages/pushNotification.ts`を実装（それまでは`console.log`のみのスタブだった）：
      判定優先順位は「①`forceNotify`→メンション有無・`notificationStatus`を無視しルーム全員、
      ②メンションあり→メンション先のみ（`notificationStatus`は考慮）、③どちらでもなし→ルーム全員のうち
      `notificationStatus === "ON"`」。送信者自身は常に除外。ルームメンバー取得のため`ChatRoomsTable`への
      読み取り権限を`notification-construct.ts`に追加（`on-connect-stack.ts`で`chatRoomsTable`を渡すよう変更）
    - `infra/package.json`に`@aws-sdk/client-sns`・`@aws-sdk/util-dynamodb`を追加
    - Web/Mobile共通コンポーネント`MemberPicker`新設（`apps/web/src/components/`・`apps/mobile/src/components/`）：
      ルームメンバーを`memberMatchesQuery`で検索・選択できる。グループチャット作成画面の
      「メンバー個別選択」（現状TODOのまま）でも将来使える汎用的な作りだが、今回はそちらへの組み込みは未実施
    - `ChatRoomPage.tsx`/`ChatRoomScreen.tsx`：本文末尾が`@検索語`にマッチする間（正規表現
      `/@([^\s@]*)$/`によるカーソル末尾前提の簡易実装）`MemberPicker`を表示し、選択すると
      `@表示名 `を本文に挿入して`mentionedUserIds`に追加。メッセージ表示側にも「@メンバー名 宛」タグを追加
      （forceNotifyの「緊急連絡」タグと同じ見た目のパターン）。チャット機能自体がバックエンド未接続のため
      今回もローカルstateのみで完結
    - テスト：新規`infra/test/lambda/pushNotification.test.ts`（forceNotify優先・メンション限定・
      デフォルト全員通知・送信者除外・対象0人ならSNS非発行・INSERT以外は無視の6ケース、
      `aws-sdk-client-mock`で`DynamoDBDocumentClient`と`SNSClient`の両方をモック）。
      プロジェクト全体で88件、全green。`cdk synth`でGraphQLスキーマ・VTLの構文も確認済み
    - ブラウザでグループチャットに実際に`@`入力→候補表示→選択→本文挿入→送信→メンションタグ表示までの
      一連の流れを目視確認済み
28. **【Phase 6】カレンダーの個別予定`.ics`エクスポート＋当日リマインド**：
    - 新規`packages/shared/src/ics.ts`：`buildIcsForEvent(event: CalendarEvent): string`という純粋関数。
      RFC5545準拠のiCalendar(VEVENT)文字列を生成（TEXT値のエスケープ処理込み、75octet行折り返しは
      対象イベントが短文中心のため未対応＝意図的に省略）。Lambda・Web・Mobileの3箇所から共通利用
    - **バンドルサイズの問題を発見・修正**：`calendar/crud.ts`から`buildIcsForEvent`を
      `@on-connect/shared`のバレル(`index.ts`)経由でimportしたところ、同じバレルが`export * from "./holidays"`
      している影響で、tree-shake不可なCJSライブラリ`@holiday-jp/holiday_jp`（祝日データ、1.4MB）が
      丸ごとバンドルされ`CalendarFn`が11.7KB→276KBに肥大化する問題が`cdk synth`のログで発覚。
      `@on-connect/shared/src/ics`から直接importする形に変更して13.7KBに復旧（このLambdaで唯一の
      実行時import。他のLambdaは`@on-connect/shared`から型のみimportしているため影響なし）
    - `infra/lambda/common/http.ts`に`rawResponse`ヘルパー追加（JSON以外のレスポンス用）。
      `infra/lambda/common/date.ts`に`toTokyoDateString(isoString)`追加（任意のISO日時をAsia/Tokyo基準の
      日付文字列に変換。既存の`tokyoDateString(offsetDays)`は「今日から何日後」専用だったため別関数に）
    - `infra/lambda/calendar/crud.ts`：`GET /calendar-events/{eventId}/ical`を追加。既存の`getEvent`と同じ
      `isVisibleToCategory`閲覧チェックを通した上で`buildIcsForEvent`の結果を`text/calendar`・
      `Content-Disposition: attachment`で返す。`api-construct.ts`にルート配線
    - 新規`infra/lambda/calendar/dailyReminder.ts`：毎朝7:00（Asia/Tokyo）、`CalendarEventsTable`を全件
      スキャンし、開始日〜終了日（Asia/Tokyo基準）に今日が含まれる予定（単日・複数日どちらも対象）を抽出。
      `isVisibleToCategory`＋`notificationStatus === "ON"`で対象者を絞り込み、`publishPush`
      （Phase 5で新設した共通ヘルパー）で通知。`scheduler-construct.ts`に既存の
      `DailyNotificationResetSchedule`と同じ`cron(0 7 * * ? *)`・`scheduleGroup`・
      `schedulerInvocationRole`を共用する`CalendarDailyReminderSchedule`を追加
    - `on-connect-stack.ts`：`SchedulerConstruct`が`pushTopic`を必要とするため、`NotificationConstruct`を
      先にインスタンス化する順序に変更（計画通り）
    - `infra/package.json`に変更無し（`@aws-sdk/client-sns`はPhase 5で追加済みのものを再利用）
    - Web：`CalendarDetailPage.tsx`に「カレンダーに追加（.icsをダウンロード）」ボタンを追加。
      `buildIcsForEvent`をクライアント側で直接呼び出し、Blob+`<a download>`で即ダウンロード
      （バックエンド接続無しで動作、ブラウザで実際にクリックしてエラー無く動作することを確認済み）
    - Mobile：`apps/mobile/package.json`に`expo-file-system`(`~17.0.1`)・`expo-sharing`(`~12.0.1`)を追加
      （Expo SDK 51対応バージョン）。`CalendarDetailScreen.tsx`に同様のボタンを追加し、
      `FileSystem.writeAsStringAsync`でキャッシュディレクトリに`.ics`を書き出した後
      `Sharing.shareAsync`でシェアシート経由で共有する方式（ファイル名はOS非対応文字を`_`に置換）
    - テスト：新規`infra/test/lambda/dailyReminder.test.ts`（単日イベント・複数日イベント（今日を跨ぐ）・
      対象外イベント・閲覧カテゴリーフィルタ・対象0人ならSNS非発行の5ケース）。
      `infra/test/lambda/calendar.test.ts`に`ical`エンドポイントのテスト3件
      （200・text/calendarヘッダー確認、閲覧権限無し403、予定無し404）を追加。
      プロジェクト全体で96件、全green。`cdk synth`でスケジュール・VTL含め構文確認済み
29. **【Phase 7】カレンダー月表示・週表示対応**：ユーザーからの修正依頼で対応
    （元々「Googleカレンダーのリンクを掲示するだけ」という設計だったためリスト表示のみで計画していたが、
    独立DB化＝Phase2で前提が変わったのにUIが据え置きだったため）。
    - 新規`packages/shared/src/calendarGrid.ts`：`toDateKey`/`parseDateKey`/`addDays`/`addMonths`/
      `startOfWeek`/`buildMonthGrid`（6週×7日=42マス固定、前後月パディング込み）/`buildWeekDays`/
      `eventsOnDate`（複数日イベントは該当する全日にマッチする）という純粋関数群。Lambdaからは
      importされないためPhase6のholiday-jpバンドル肥大化問題は起きない（念のため依存させていない）
    - Web `CalendarPage.tsx`/Mobile `CalendarScreen.tsx`を書き換え、`viewMode`
      （`"month" | "week" | "list"`、デフォルト`"month"`）と`refDate`（月表示・週表示共通のアンカー日付）
      をローカルstateで管理。表示モード切り替え・prev/next月/週移動はURLを使わずコンポーネント内状態のみ
      （ShiftManagementPageの月ナビゲーションと同じ考え方）
    - Web：月表示はCSS Grid 7列×6行、日付セルに予定チップ（最大3件+overflow件数）、セルクリックで
      その日を含む週表示へドリルダウン、チップクリックで予定詳細へ。週表示は7列グリッドで各日に
      予定のタイトル・時刻を表示。曜日・祝日の色分けはShiftManagementPageと同じくインラインロジック
      （日曜/祝日=`colors.danger`、土曜=`colors.brandDark`）で`packages/shared`には出していない
    - Mobile：画面幅の制約から月表示・週表示ともWebとは異なるレイアウトを採用。月表示はタイトル文字を
      表示せずドット（最大3つ+overflow表示）のみ、セルタップで週表示へドリルダウン。週表示は7列グリッド
      ではなく縦積みのアジェンダ形式（曜日・日付・祝日名の見出し→その日の予定を既存リスト行スタイルで
      表示、を7日分繰り返す）
    - リスト表示は既存の挙動（`endAt >= now`で未来の予定のみ、`startAt`昇順）を変更せず維持。
      「＋ 予定を追加」ボタンは表示モードによらず常時表示
    - バックエンド変更無し（`GET /calendar-events`は既にサーバー側で閲覧権限フィルタ済みの全件を
      返しており、月表示・週表示のレンダリングに必要なデータは揃っている）
    - テスト：`npm run build --workspace apps/web`・`npx tsc --noEmit`（mobile）で型エラー無しを確認。
      ブラウザで月表示（2026年8月、複数日イベントevt-03が8/12〜14の全日に正しく表示、当番8/6ハイライト、
      日祝の色分け）→週表示（8/2〜8/8、時刻付きで表示）→リスト表示（未来の予定のみ）の切り替え、
      日付セルクリックでの週表示ドリルダウン、予定チップクリックでの詳細画面遷移を実際に動かして確認済み。
      packages/sharedにはテストランナーが無い既存方針を踏襲し、`calendarGrid.ts`自体の自動テストは
      追加していない（ブラウザでの動作確認で代替）
30. **【Phase 8a】Cognito認証基盤**：ダミーのログイン画面を実際のAWS Amplify＋Cognito認証に置き換えた。
    このフェーズの範囲は「実際にログインできる」「アプリ全体が『今ログインしている人』を把握できる」の
    2点まで。チャット・掲示板等の業務データは引き続きモックのまま（8b/8c以降の対象）。
    - `packages/shared/src/types.ts`：`User`に`loginId`（Cognitoのusername）を追加、`email`を任意化。
      `mockData.ts`の9人のダミーメンバーにも`loginId`（staff01〜09）を付与
    - 新規`infra/lambda/common/cognito.ts`：`generateTemporaryPassword`（紛らわしい文字を除いた
      文字集合からランダム生成、紙に手書きする運用を考慮）、`createCognitoUser`/`getCognitoUserStatus`/
      `reissueTemporaryPassword`
    - `infra/lambda/users/index.ts`：`POST /users`を書き換え、呼び出し側が`userId`を指定する方式から
      `loginId`を指定してCognitoアカウントを作成し、返ってきた`sub`を`userId`として使う方式に変更
      （元々のコードに「userIdはCognitoの発行するsubと一致させる想定」というコメントがあり、
      設計時からこの形が意図されていたことが分かった）。DynamoDB書き込み失敗時は`AdminDeleteUser`で
      Cognito側もロールバックする。`GET /users`はCognitoの`AdminGetUser`を都度呼び`loginStatus`
      （初回ログイン未了/完了/未発行）を付加。新規`POST /users/{userId}/reset-password`
      （管理者によるパスワード再発行、`manageUsers`権限必須）
    - **全APIルートが元々Cognito認証必須だったため、初回セットアップ用の権限チェック回避ロジックは
      「テーブルが空なら」を条件にしていたが、API Gateway自体が未認証リクエストをそもそも通さないため
      機能しないことが判明**。最初の管理者アカウントは今後AWS CLI/コンソールから手動作成する運用とし、
      コードでは解決しない（この事実は実装中に発見、設計判断として記録）
    - `infra/lib/constructs/api-construct.ts`：`usersFn`に`USER_POOL_ID`環境変数と
      `cognito-idp:AdminCreateUser`/`AdminGetUser`/`AdminSetUserPassword`/`AdminDeleteUser`の
      IAMポリシー（UserPool ARNにスコープ）を追加、`/users/{userId}/reset-password`ルート追加
    - `apps/web/src/pages/AdminPage.tsx`：「ユーザー管理」タブに「スタッフを追加」フォーム
      （表示名・ふりがな・ログインID（次のstaffNNを自動サジェスト、編集可）・ロール・メンバーカテゴリ）、
      作成後の仮パスワード表示パネル（再表示不可の警告付き）、メンバー一覧に「ログイン状況」列、
      「パスワード再発行」ボタンを追加。この管理機能は本物のREST APIを呼ぶ（未デプロイ時は
      失敗を捕捉しダミーデータへフォールバック）。他のタブ（ロール/カテゴリー管理等）は変更なし
    - Web：新規`AuthContext.tsx`（`NotificationStatusContext.tsx`と同じProvider+フック形式。
      Amplifyの`signIn`/`confirmSignIn`/`signOut`/`getCurrentUser`/`fetchAuthSession`をラップ）。
      `LoginPage.tsx`を通常サインイン＋初回ログイン時の「新しいパスワードを設定」の2段階フォームに
      作り直し。`router.tsx`に`RequireAuth`（未ログイン時`/login`へリダイレクト）、`App.tsx`で
      `AuthProvider`が`NotificationStatusProvider`の外側に来るよう変更しローディング中はブランク表示。
      `NotificationStatusContext.tsx`はモジュールスコープの mock 参照をやめ`useAuth().currentUser`から
      初期値を取る形に変更。`mockCurrentUserId`を参照していた18ファイル中、モジュールスコープでの参照が
      あった`HomeLayout.tsx`と`NotificationStatusContext.tsx`に加え、当初のリストに無かった
      `MenuPage.tsx`（`mockCurrentUserIsAdmin`という派生定数を参照）も構造変更が必要と判明。
      残りは`useAuth().currentUserId`への単純置き換え
    - Mobile：`aws-amplify`・`@aws-amplify/react-native`・`@react-native-async-storage/async-storage`・
      `react-native-get-random-values`・`react-native-url-polyfill`を追加。
      **`react-native-get-random-values`の最新版(2.0.0)はReact Native 0.81以上が必要でこのプロジェクトの
      0.74.5と非互換だったため、1.11.0を使用**（`npm install`時にpeer dependencyエラーで発覚、
      Phase 6のexpo-file-system等と同様のバージョン確認が必要なケース）。`App.tsx`の先頭で
      ポリフィルをimportしてから`amplifyConfig.ts`でAmplify設定、Provider入れ子順は
      `AuthProvider`→`NotificationStatusProvider`→`AppNavigator`。`LoginScreen.tsx`・
      `AppNavigator.tsx`（`useAuth().currentUserId`の有無でLogin/Home系統を出し分け、
      以前のように両方を常時登録する形はやめた）も同様に変更。`HeaderStatus.tsx`・mobile版
      `NotificationStatusContext.tsx`も構造変更、残り9画面は単純置き換え。`MenuScreen.tsx`/
      `MenuPage.tsx`双方に「サインアウト」導線を追加（元の計画には無かったが、実際にログイン基盤を
      作る以上サインアウト手段が無いと機能として片手落ちのため追加）
    - 環境変数：`apps/web/.env.example`（`VITE_USER_POOL_ID`等）、`apps/mobile/.env.example`
      （`EXPO_PUBLIC_USER_POOL_ID`等）。デプロイ前は空文字列でも起動時エラーにはならず、
      実際にログインを試みた時点でAmplify側のエラーになる設計（ブラウザで実際に確認：
      「Auth UserPool not configured.」という分かりやすいエラーが表示され、クラッシュや無限ループは
      起きないことを確認済み）
    - テスト：`infra/test/lambda/users.test.ts`にCognito関連7ケース追加
      （アカウント作成成功・ログインID重複409・DynamoDB失敗時のCognitoロールバック・
      ログイン状況の付加（CONFIRMED/UNPROVISIONED）・パスワード再発行3ケース）、
      プロジェクト全体で101件、全green。`cdk synth`でIAM文・環境変数配線を確認。
      `npm run build --workspace apps/web`・`npx tsc --noEmit`（mobile）も通過。
      ブラウザで未ログイン時に`/`へアクセスすると`/login`へリダイレクトされること、
      ログインフォームが「メールアドレス」ではなく「ログインID」表記になっていること、
      送信するとAmplifyの設定エラーが正しく捕捉されて画面に表示されることを確認済み
    - **未検証**：実際のCognitoに対するログイン成功/失敗、AdminPageのスタッフ追加・パスワード再発行の
      実地動作、8bで予定しているUsersリソースの本接続。いずれも実デプロイが必要（8a〜8d完了後に
      ユーザーへ確認してから実施する既定方針のまま）

## 4. 現在のダミー登録ユーザーの設定

- `mockCurrentUserId = "user-03"`（田中 美咲、一般メンバー、`permissions`は全項目`false`）が「ログイン中の自分」
- 管理者相当（`permissions`が全項目`true`）は `user-01`（佐藤 陽子）・`user-02`（高橋 誠）の2名
- 管理者視点の画面を見たい場合は `packages/shared/src/mockData.ts` の `mockCurrentUserId` を
  `"user-01"` 等に変更する（Webの「管理者」タブ、シフト管理の編集権限等が現れる）
- 権限はロールでなく`User.permissions`が個別に持つ点に注意（22.参照）。`mockRoles`は名前ラベルのみ

## 5. 実装状況（本実装 vs スタブ）

### 本実装済み（実際に動くロジック、ローカルテスト確認済み・AWS未デプロイ）
- CDKインフラのリソース定義一式（Cognito、DynamoDB **15テーブル**、AppSync、S3+CloudFront、
  EventBridge Scheduler、API Gateway）
- 通知ステータス毎朝7時自動リセット＋休日連動ロジック（`dailyNotificationReset.ts`、24.参照）
- Users/Roles/MemberCategories・BulletinPosts/BulletinCategories・CalendarEvents/CalendarCategories・
  OrgLinks・DutyTypes/ShiftTypes/MemberDailyStatus/DailyNoteの全CRUD Lambda（19,22,23,24,25参照）
- 呼び出し元の権限チェック（`manageUsers`/`manageRoles`/`manageMemberCategories`/`manageBulletinCategories`/
  `manageCalendarCategories`/`manageShifts`）。**bulletin/calendar/shiftsのカテゴリー管理系は権限チェック
  済みだが、CalendarEvents本体・BulletinPosts本体には権限チェックが無い**（全メンバーが作成編集削除可、
  設計上の意図的な選択）
- Web/Mobileの全画面UI（ダミーデータ`packages/shared/src/mockData.ts`で表示。シフト管理・メニュー画面含む）
- 検索・フィルタ・ソート・ヘッダー連携・リアクション・コメント投稿・チャットの`@`メンションなどの
  フロントエンドロジック（いずれもローカルstateで完結。リロードで消える＝バックエンド未接続）
- チャット新着メッセージのプッシュ通知判定＋SNS発行ロジック（`pushNotification.ts`、27.参照）。
  forceNotify優先・メンション限定・デフォルト全員通知の3分岐、送信者除外まで実装・テスト済み
  （実際のモバイルプッシュ配信＝SNSトピック以降のAPNs/FCM接続は未実装）
- カレンダー予定の個別`.ics`エクスポート（`buildIcsForEvent`、Web/Mobile/Lambdaで共通利用）と
  当日リマインド通知（`dailyReminder.ts`、28.参照）。単日・複数日イベントの判定、閲覧カテゴリー
  フィルタ、通知OFF除外まで実装・テスト済み
- Cognito認証（Phase 8a、30.参照）。ログイン・初回パスワード設定・サインアウト、管理者による
  アカウント発行・ログイン状況確認・パスワード再発行。**コードは実装済みだが実際のCognitoに
  デプロイしておらず、本物のログイン成功/失敗の動作確認はまだできていない**

### 未実装（TODOコメントあり、501スタブ等）
- Messagesテーブル streams → EventBridge Scheduler の CreateSchedule/DeleteSchedule（予約送信の実装）
- 掲示板の新規投稿通知Lambda（`bulletin/notifyOnPost.ts`）の実際の送信ロジック（`console.log`のみのスタブのまま。
  チャット側の`pushNotification.ts`とは別ファイルで、Phase 5・6のどちらでも対応対象外だった）
- リアクション/コメントの永続化API（掲示板コメント用のDynamoDBテーブルは未作成）
- Amazon Chime SDK Meeting/Attendee作成（音声通話は現状デモの着信画面遷移のみ）
- AppSyncクライアント接続（チャット機能は全体がバックエンド未接続のまま。8a完了時点でも
  チャット周りの画面はローカルstateのまま変更していない。REST API側（users以外）の接続も8b/8c待ち）
- 実際のモバイルプッシュ配信（SNSトピック以降のAPNs/FCM接続。チャット・カレンダーリマインドとも
  SNS発行までは実装済みだが、その先のデバイス配信は未接続）

## 6. 会話内で回答した設計質問（コード変更なし、方針のみ）

- **通知音の設定方針**：未着手・要検討事項
- **通知OFF中の通知の扱い**：メッセージ・掲示板本体はサーバーに保存されアプリを開けば閲覧可能。
  抑制されるのはOS通知（バナー・音）のみ。緊急連絡フラグ付きメッセージだけは例外的にOFF中でも配信、
  音声通話の着信のみ例外なく届かない
- **Googleカレンダー連携は完全に廃止**（23.参照）。理由：対象者が実質1〜2名（ユーザー本人・理事長）で
  他メンバーへの影響が薄く、常時同期の仕組みは過剰と判断。代わりに28.（Phase 6）で個別予定の`.ics`
  ダウンロードボタンを実装済み

## 7. 主要ファイルの場所（初見の人向け索引）

| 内容 | パス |
|---|---|
| 設計企画書（オリジナル） | `docs/DESIGN.md` |
| 本ファイル | `docs/PROGRESS.md` |
| **実装計画（Phase1〜6の詳細、変更ファイル一覧）** | `/Users/ikkounobuyuki/.claude/plans/elegant-wobbling-lollipop.md` |
| **実装計画（Phase7の技術方針＋Phase8〜12ロードマップ）** | `/Users/ikkounobuyuki/.claude/plans/effervescent-gliding-patterson.md` |
| 共有ドメイン型定義 | `packages/shared/src/types.ts` |
| ダミーデータ・検索/リアクションヘルパー | `packages/shared/src/mockData.ts` |
| CDKスタック本体 | `infra/lib/on-connect-stack.ts` |
| CDK各種construct | `infra/lib/constructs/*.ts` |
| Lambdaハンドラ | `infra/lambda/**/*.ts` |
| Lambda共通ヘルパー | `infra/lambda/common/{http,dynamo,authz,visibility,date,push}.ts` |
| Users/Roles/MemberCategories CRUD | `infra/lambda/users/index.ts` |
| 掲示板CRUD（BulletinCategories含む） | `infra/lambda/bulletin/crud.ts` |
| カレンダーCRUD（独立DB、CalendarCategories含む） | `infra/lambda/calendar/crud.ts` |
| 休日・当番・シフト・日次メモCRUD | `infra/lambda/shifts/crud.ts` |
| 曜日・祝日ヘルパー（`@holiday-jp/holiday_jp`使用） | `packages/shared/src/holidays.ts` |
| 通知自動リセット（休日連動） | `infra/lambda/users/dailyNotificationReset.ts` |
| チャット新着メッセージのプッシュ通知判定（forceNotify/メンション/デフォルト全員） | `infra/lambda/messages/pushNotification.ts` |
| カレンダー予定の当日リマインド | `infra/lambda/calendar/dailyReminder.ts` |
| GraphQLスキーマ（チャット、mentionedUserIds含む） | `infra/graphql/schema.graphql` |
| Lambda単体テスト（aws-sdk-client-mock使用、101件） | `infra/test/lambda/*.test.ts` |
| Cognitoアカウント作成・ログイン状況・パスワード再発行ヘルパー | `infra/lambda/common/cognito.ts` |
| Web/Mobile: 認証状態管理（Amplifyラップ） | `apps/web/src/context/AuthContext.tsx` / `apps/mobile/src/context/AuthContext.tsx` |
| Web: ルーティング | `apps/web/src/router.tsx` |
| Web: 共通レイアウト・ヘッダー・下部タブ（4タブ：チャット/掲示板/カレンダー/メニュー） | `apps/web/src/pages/HomeLayout.tsx` |
| Web: メニュー画面（メンバー/シフト管理/リンク集/個人設定/管理者設定への導線） | `apps/web/src/pages/MenuPage.tsx` |
| Web: 管理者設定（ユーザー権限編集・各種カテゴリー管理） | `apps/web/src/pages/AdminPage.tsx` |
| Web: カレンダー一覧（月/週/リスト表示）/詳細（`.ics`エクスポート含む）/編集 | `apps/web/src/pages/Calendar{Page,DetailPage,EventEditPage}.tsx` |
| Web: シフト管理（月間グリッド） | `apps/web/src/pages/ShiftManagementPage.tsx` |
| Web: チャット詳細（`@`メンション対応） | `apps/web/src/pages/ChatRoomPage.tsx` |
| Web/Mobile: メンバー検索・選択の共通コンポーネント | `apps/web/src/components/MemberPicker.tsx` / `apps/mobile/src/components/MemberPicker.tsx` |
| iCalendar(.ics)生成の共通純粋関数（Lambda/Web/Mobileで共通利用） | `packages/shared/src/ics.ts` |
| カレンダー月/週グリッド構築の共通純粋関数（Web/Mobileで共通利用、Lambdaは未使用） | `packages/shared/src/calendarGrid.ts` |
| Mobile: ナビゲーション定義（4タブ＋MenuStackNavigator） | `apps/mobile/src/navigation/AppNavigator.tsx` |
| Mobile: メニュー画面（メンバー/シフト管理/リンク集/個人設定への導線） | `apps/mobile/src/screens/MenuScreen.tsx` |
| Mobile: カレンダー一覧（月/週/リスト表示）/詳細（`.ics`エクスポート含む）/編集 | `apps/mobile/src/screens/Calendar{Screen,DetailScreen,EventEditScreen}.tsx` |
| Mobile: シフト管理（月間グリッド、MenuStackNavigator配下） | `apps/mobile/src/screens/ShiftManagementScreen.tsx` |
| Mobile: チャット詳細（`@`メンション対応） | `apps/mobile/src/screens/ChatRoomScreen.tsx` |
| ブランドアイコン生成スクリプト／画像 | `scripts/generate-brand-icon.py` / `assets/brand/*.png` |

## 8. 今後のロードマップ（Phase 8〜12）

計画ファイルの元々の6フェーズ＋Phase7は完了済み。ここからは残っている大物5点をPhase 8〜12として
再整理したもの（詳細版は
`/Users/ikkounobuyuki/.claude/plans/effervescent-gliding-patterson.md`のパートB参照）。
**Phase 8が他の全フェーズを実質的にブロックする**ため最優先。Phase 9〜12はPhase 8完了後であれば
互いに強い依存関係は無く、着手順はユーザーの優先度判断で決めてよい。

- **Phase 8: Cognito認証・AppSyncクライアント接続**（最優先・最大規模。4ステップ「8a: 認証基盤」
  「8b: REST 1リソースだけ疎通確認」「8c: 残りのリソースへ展開」「8d: チャットのAppSync接続」に細分化）
  - **8a（認証基盤）：コード実装完了**（詳細は3章30.参照）。ダミーのログイン画面を実際のAmplify＋
    Cognito認証に置き換え、`mockCurrentUserId`を参照していた18ファイル全てを実際の認証ユーザーIDに
    置き換えた。AdminPageに管理者によるアカウント発行（Cognitoアカウント作成＋仮パスワード発行）・
    ログイン状況確認・パスワード再発行のUIも実装済み。ただし**実際のCognitoへのデプロイはまだ行っておらず、
    本物のログインの動作確認はできていない**
  - **8b〜8d（残りのリソース接続）：未着手**。それ以外のCRUD（bulletin/calendar/links/shifts、
    Usersの残り部分）はREST APIクライアント（CognitoのIDトークンをBearerで送る）に、チャットは
    AppSyncクライアント（sendMessage/markMessageRead/listMessagesForRoom/Subscription）に接続する
  `infra/lib/constructs/auth-construct.ts`のCognito設定・`infra/lambda/common/cognito.ts`・
  Web/Mobileの`AuthContext.tsx`は実装済み。詳細は
  `/Users/ikkounobuyuki/.claude/plans/effervescent-gliding-patterson.md`の
  「Phase 8a: 認証基盤 実装計画」参照。
- **Phase 9: リアクション/コメントの永続化**（Phase 8後）
  掲示板コメント用の新規DynamoDBテーブル・CRUD Lambdaを追加し、ローカルstateのみの
  `toggleReaction`等をAPI接続に置き換える。`bulletin/notifyOnPost.ts`（現状`console.log`のみの
  スタブ）の実装もここに含める。投稿者・リアクションした人の識別に実ユーザーIDが要るためPhase 8後
- **Phase 10: 予約送信の実スケジューリング**（Phase 8後）
  `onMessageStreamChange.ts`（Streams→EventBridge Scheduler登録）・`sendScheduled.ts`
  （実際の送信）は実装済みだがチャット未接続のため一度も実地検証されていない。Phase 8後にAppSync
  経由の実メッセージで動作確認し、見つかったバグを直す作業が中心になる見込み
- **Phase 11: Amazon Chime SDK音声通話実装**
  現状デモの着信画面遷移のみの`initiateCall.ts`を、Chime SDK Meetings API
  （CreateMeeting/CreateAttendee）を呼ぶ実装に差し替え、web/mobileにChime SDKクライアントを
  組み込む。Attendeeとユーザーの紐付けに実ユーザーIDが要るためPhase 8後が望ましい。
  音声ストリームはローカルでは検証できないため、着手時にAWSデプロイの是非をユーザーに確認すること
  （Phase1〜7は全てローカル`npm test`/`cdk synth`のみで確認してきた）
- **Phase 12: 実際のモバイルプッシュ配信**
  SNSトピックへのpublishはPhase5・6で実装済み。不足しているのはAPNs/FCM向けのSNS Platform
  Application、デバイストークンの登録エンドポイント（`expo-notifications`は
  `apps/mobile/package.json`に導入済み・未使用）、ユーザーID⇔デバイストークンの紐付け。Phase 8後

### その他の細かい未着手事項
- Mobileをシミュレータ/実機で見た目確認（このセッションではtscのみで確認、実機目視は未実施）
- 通知音の仕様確定（未着手・要検討事項、6章参照）

## 9. Phase 3 追加要望（対応完了、25.参照）

Phase 3完了後にユーザーから追加要望があり、本セッションで全4件に対応した：

1. **日付だけでなく曜日も併記。可能であれば祝日も表示**（`ShiftManagementPage`/`Screen`のグリッドヘッダー）。
   → `@holiday-jp/holiday_jp`（npm、依存ゼロ）を追加し対応。ライブラリ追加はユーザーに確認済み
2. **日付の下に自由メモ欄を設ける。権限者のみ追記可能**。
   → 「日付単位（メンバーに紐づかない）」の粒度で実装（ユーザーに確認済み）。新規`DailyNote`型・
   `DailyNotesTable`（PK`date`）・CRUDエンドポイントを追加
3. **日ごとに当番の人数を算出**（Excelファイルと同じような形式）。
   → グリッドに「当番人数」行を追加、当番タイプ別の人数をフロント側で集計表示
4. **月単位で、メンバーごとに当番回数・シフト回数を表示**。
   → グリッド右端に当番タイプ別・シフトタイプ別の月間合計列を追加（フロント側集計、API変更なし）

いずれもブラウザで実データ表示・編集操作を目視確認済み（`mockCurrentUserId`を一時的に`user-01`
（管理者）に切り替えて確認、確認後`user-03`に戻し済み）。詳細は3章25.参照。
