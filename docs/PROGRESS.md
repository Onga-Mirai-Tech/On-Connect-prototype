# On-Connect 実装進捗まとめ（〜2026-08-07時点、Phase 10完了・デプロイ済み）

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
に記録済み**）。続けてPhase 8bとして、Users/Roles/MemberCategoriesのREST接続をweb/mobile全画面に展開した
（**実装計画は`/Users/ikkounobuyuki/.claude/plans/reactive-purring-castle.md`に記録済み**）。
さらにPhase 8cとして、残りのREST接続（OrgLinks・掲示板カテゴリー/投稿本体・カレンダーカテゴリー/予定本体・
当番シフト種別/日次記録）を一通り実装した。8cは事前調査（3エージェント並行）→タスク一覧化→
ユーザーとの1点の設計判断（シフト月表示の取得方式）を経て順次実装した流れで、8a/8bのような
独立した実装計画ファイルは作成していない（本ファイルの3章32.が詳細の記録）。
最後にPhase 8dとして、チャット機能をAppSyncに接続した。8a〜8cと違いバックエンド
（ルーム一覧取得クエリ・ルーム作成mutation）に構造的な欠落があったため、infra追加実装
（スキーマ拡張＋リゾルバ新設）から着手した点が特徴（実装計画は
`/Users/ikkounobuyuki/.claude/plans/reactive-purring-castle.md`に記録済み、8bの計画ファイルを
8d用に上書きして再利用）。**これでPhase 8（Cognito認証・REST/AppSync接続）が全て完了した**。
Phase 8a〜8dともに実際のCognitoへのデプロイをまだ行っていなかったが、本セッションでユーザーの
承認を得て`OnConnect-dev`スタックを初めて実際にAWSへデプロイし、初回管理者アカウント作成・
ログイン・REST API疎通・AppSyncチャット（ルーム作成・送信・永続化・リアルタイム購読）まで
一通り実機確認した（**これでPhase 8a〜8dの「未検証」が解消**、詳細は下記3章34.参照）。
その過程で実装時には発覚していなかった本物のデプロイでしか顕在化しないバグを2件発見・修正済み
（①REST Lambda共通ヘルパーがCORSヘッダーを実レスポンスに付与しておらずブラウザから見ると
全リクエストがCORSエラーに見える、②チャットのSendMessage VTLリゾルバがJS風三項演算子を使っており
AppSyncのVTLでは構文エラーになる）。**この初回デプロイ後のAWSリソース（`OnConnect-dev`）は
destroyせず、そのまま起動状態で残している**（以降のセッションもこのdev環境に対して開発を続ける想定）。
続くセッションで、実機確認中に発覚した2件のバグ（カテゴリー系プルダウンの初期値が古いまま残る問題、
シフト月表示の日次ループ取得がLambda同時実行数上限に達し500エラーになる問題）と、モバイル版の
Expo Go非互換・ログイン直後に古いモックデータが一瞬表示される問題を修正した（コミット`0720bd9`・
`8ae54e9`、詳細はこのファイルには未記載・`git log`で参照）。

その後、シフト管理画面の左列固定・自分の行ハイライト表示・カレンダー月表示のドット→予定タイトル表示化
（モバイル版のみ、Web版は既に予定タイトル表示だった）というUI改善を実施（コミット`fa53dcd`）。
続けて**Phase 9（リアクション/コメントの永続化）**に着手・完了した：チャットメッセージ・掲示板投稿の
絵文字リアクション、掲示板のコメントは従来ローカルstateのみで画面リロードで消えていたのを、
新規`BulletinCommentsTable`＋REST 2エンドポイント（コメントCRUD・投稿リアクショントグル）、
および**このプロジェクト初のLambda裏付けAppSyncリゾルバ**（`toggleMessageReaction`、
チャットメッセージのリアクショントグルはread-modify-writeが必要でVTLだけでは表現できないため）で
永続化した。あわせて`bulletin/notifyOnPost.ts`（従来`console.log`のみのスタブ）も実装した。
投稿リアクションは`reactions`属性のみを更新し`updatedAt`は変更しない設計とすることで、
リアクション操作が`notifyOnPost.ts`の「投稿更新通知」を誤発火させない工夫をしている
（詳細は`/Users/ikkounobuyuki/.claude/plans/rosy-twirling-fox.md`に実装計画を記録済み）。
infra全117テスト・`cdk synth`・web build・mobile tscが通過し、`OnConnect-dev`スタックへの
再デプロイ（新テーブル1件・新Lambda2件・スキーマ変更、破壊的変更なし）とブラウザでの実機確認
（コメント投稿・リアクショントグルがページリロード後も残ることを確認）まで完了している
（コミット`941f633`）。**これでPhase 9が完了し、Phase 1〜9が全て完了した**。

続けて**Phase 10（予約送信の実スケジューリング）**に着手・完了した。着手前の本ファイルは
「`onMessageStreamChange.ts`・`sendScheduled.ts`は実装済みだが未検証」と記録していたが、
実際は**両方とも中身がTODOコメントのみのスタブ**で、実装自体がゼロからだった
（このズレ自体が「本ファイルは執筆時点のスナップショットに過ぎず必ず裏取りすること」という
冒頭の注意書き通りの事例）。加えて調査の過程で、Web版の予約日時入力が`AWSDateTime`の要求する
秒・タイムゾーン付き形式になっておらずミューテーションが必ず失敗する状態だったこと、
`cancelScheduledMessage`ミューテーションがスキーマ・リゾルバとも存在するのに呼び出し側
（UI）が一切無かったこと、モバイル版に予約送信の入力欄自体が無かったこと、
`listMessagesForRoom`が`status`でフィルタしておらず予約中メッセージの本文が送信予定時刻より
前に他のメンバーへ見えてしまうことも発覚し、実質的に設計書5.2.2の初実装となった
（実装計画は`/Users/ikkounobuyuki/.claude/plans/rosy-twirling-fox.md`に記録済み、Phase 9用に
作成したファイルをPhase 10用に上書き再利用）。
- **バックエンド**：`onMessageStreamChange.ts`でMessages Streamsの`INSERT`(status:scheduled)→
  `CreateSchedule`、`REMOVE`/`MODIFY`でscheduledから離脱→`DeleteSchedule`を実装
  （EventBridge Scheduler、スケジュール名は`messageId`単体。`${roomId}_${messageId}`だと
  UUID2つの連結で名前上限64文字を超えるため）。`sendScheduled.ts`は条件付き`UpdateItem`で
  `status: sent`に更新後、新規`deliverScheduledMessage`ミューテーションを**このプロジェクト初の
  Lambda→AppSync呼び出し**（IAM署名、`common/appsyncSigner.ts`新設）で叩き`onMessageSent`購読を
  発火させて即時配信する。`listMessagesForRoom`のレスポンスVTLに、予約中メッセージは送信者本人
  にのみ見せるフィルタを追加。`pushNotification.ts`はscheduled→sentのMODIFYも通知対象に追加。
- **フロントエンド**：`cancelScheduledMessage`をweb/mobile双方の`chatClient.ts`に接続し取消ボタンを
  新設、モバイルに予約送信入力欄（ネイティブ日時ピッカーは新規ネイティブ依存のリスクを避け
  プレーンな`TextInput`）を新設、web側の`scheduledAt`フォーマット不備を修正。
- **実機デプロイで発覚し修正した3件の実バグ**（いずれもユニットテスト・`cdk synth`では検出不可能で、
  実際にスケジュールし発火まで待つ実地検証だったからこそ発見できたもの）：
  ①EventBridge SchedulerがLambdaターゲットを直接起動する場合、`Target.Input`のJSONは
  `event.detail`にラップされず、そのままイベントオブジェクトとして渡される
  （`.detail`ラップはEventBridge Rules経由の場合のみ。`ScheduledHandler`型を信用して
  `event.detail`を参照していたため毎回即座に失敗していた）。
  ②`additionalAuthorizationModes`追加後、ディレクティブ無しのフィールドはデフォルト認証
  （Cognito User Pool）のみが有効で、IAM署名で呼ぶ`deliverScheduledMessage`が
  "Not Authorized"で失敗した。`@aws_iam`をミューテーション・レスポンスの参照フィールド双方に
  明示する必要があった。
  ③予約登録した瞬間（INSERT）でstatusを見ずに常に通知していたため、送信予定時刻より前に
  プッシュ通知が飛んでいた（Phase 10着手前から存在した既存バグ）。
  **また②の修正時、`Message.messageId`に`@aws_iam`のみを付けてしまい、暗黙のデフォルト認証
  （Cognito User Pool）が失われる回帰を引き起こし、本番相当環境で通常ユーザーの全チャット取得が
  一時的に壊れた**（`@aws_iam @aws_cognito_user_pools`の併記で復旧、詳細はコミット`238b184`）。
  ディレクティブは「1つでも付けると暗黙のデフォルト認証が失われ、明示したモードのみになる」という
  仕様を実地で学んだ。
- infra全129テスト・`cdk synth`・web build・mobile tscが通過。`OnConnect-dev`への複数回の
  再デプロイと、テスト用アカウント（`staff02`、確認後削除済み）を使った2ユーザー間の実機検証
  （予約中は送信者以外に見えないこと、発火後に`sent`表示へ切り替わりリアルタイム配信されること、
  取消でEventBridge Schedule自体も削除され二度と発火しないことを`aws scheduler get-schedule`で
  確認）まで完了（コミット`70cceb9`・`238b184`）。**これでPhase 10が完了し、Phase 1〜10が
  全て完了した**。

続けて**Phase 11（Amazon Chime SDK音声通話実装）**に着手・完了した。設計書5.2.4の実装で、
`initiateCall.ts`が`501 Not implemented`を返すだけのスタブだったため実質ゼロからの実装だった。
モバイル版の音声通話について、AWSがReact Native向けの公式Chime SDKを提供していないため
「Web版のみ実装（推奨）」か「モバイルもネイティブ実装する」かをユーザーに確認したところ、
**「モバイルもネイティブ音声通話を実装する」を明示的に選択された**（推奨案ではない方）。
- **バックエンド**：`POST /calls`（Chime `CreateMeeting`/`CreateAttendee`を呼び、発信者には
  レスポンスで即座にMeeting/Attendee情報を返し、着信者には新規`notifyIncomingCall`ミューテーション
  （Noneデータソース、Phase10の`appsyncSigner.ts`を再利用したIAM署名付き呼び出し）で通知）、
  `POST /calls/{callId}/end`（`DeleteMeeting`＋`CallLogs`へ1回だけ記録、
  `ConditionExpression: attribute_not_exists`で発信者タイムアウトと着信者操作の競合に対処）を実装。
  通知OFFのユーザーには発信自体を`409`で拒否する設計。infra11テスト新規・全140テスト・
  `cdk synth`通過。
- **Web**：`amazon-chime-sdk-js`を新規導入し、`IncomingCallPage.tsx`を発信中/着信中/通話中の
  3状態を持つ実UIに拡張。`router.tsx`にログイン中常時`onIncomingCall`を購読するグローバル
  着信リスナーを追加。`amazon-chime-sdk-component-library-react`は`styled-components`前提で
  このプロジェクトの一貫したインラインstyle方針と合わないため採用せず、自前でUIを組んだ。
- **Mobile**：AWSの公式RN SDKが無いため、**Expo Modules API**で`modules/chime-audio-call/`という
  ローカルネイティブモジュールを新規作成し、iOS（Swift、実際の`AmazonChimeSDK.xcframework`の
  `.swiftinterface`をXcodeビルド後に読んで正確なAPI形状を確認しながら実装）・
  Android（Kotlin、`expo.modules.interfaces.permissions.Permissions`でマイク権限リクエストを
  実装）双方のブリッジを書いた。ローカルモジュールは`apps/mobile/package.json`に
  `"chime-audio-call": "file:./modules/chime-audio-call"`として追加し、
  `expo-modules-autolinking`が自動検出する構成（`expo-module.config.json`の`platforms`は
  このExpo SDK 51世代では`"ios"`表記が必要、`"apple"`表記だと検出されないことを実機検証で発見）。
  `pod install`で実際に`AmazonChimeSDK 0.25.2`が解決されることを確認し、iOSシミュレータで
  実機ビルド・起動まで確認した（ビルド中に`LogLevel.info`→`LogLevel.INFO`という実コンパイル
  エラーを発見・修正）。**Androidはこのセッションにビルド環境が無く、コンパイル確認ができていない**
  （ユーザーが`expo run:android`で確認する必要がある）。
- **実機デプロイ・実機テストで発覚し修正した2件の実バグ**（いずれもユニットテストでは検出不可能）：
  ①`InitiateCallFn`がCDKデフォルトの3秒Lambdaタイムアウトのままで、Chime API 2回・AppSync通知・
  SNS publishを直列で呼ぶ実処理がコールドスタート時に間に合わずタイムアウトしていた
  （`timeout: Duration.seconds(15)`を明示して解決）。②`amazon-chime-sdk-js`がNode.jsの`global`を
  参照するが、Viteはデフォルトでポリフィルしないため、実際にChime Meetingへ参加しようとした瞬間に
  `ReferenceError: global is not defined`で必ず失敗していた（`vite.config.ts`に
  `define: { global: "globalThis" }`を追加して解決）。
- 修正後、`OnConnect-dev`への再デプロイと、一時テストアカウントを使ったWeb版での実機確認
  （発信→実際のChime Meeting/Attendee作成→クライアント側での実セッション参加→
  ハングアップ→`CallLogs`への`missed`記録まで）を完了（コミット`0098d1a`・`f33383f`）。
  **着信側の応答・通話中UI・実際の2者間音声疎通は、2つの同時ログインセッションを安定して
  維持する手段がこのセッションの検証環境に無かったため未検証**（発信側の実処理は上記の通り
  実機で確認済み）。iOS実機での2者間音声疎通・Android全般も未検証。
  **これでPhase 11が完了し、Phase 1〜11が全て完了した**（残る検証はPhase 12着手前に
  改めて実施することが望ましい）。

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
- **Phase 8b（Users/Roles/MemberCategoriesのREST接続）**：コード実装完了。web build・mobile tscは
  通過済み（infra側の変更は無し）。ただし**実際のAPIへの疎通確認はできていない**（デプロイ前のため、
  未接続時のダミーデータへのフォールバック動作のみ確認）。詳細は下記3章31.参照
- **Phase 8c（残りのREST接続：OrgLinks・掲示板・カレンダー・シフト）**：コード実装完了。web build・
  mobile tscは通過済み（infra側の変更は無し）。ただし**実際のAPIへの疎通確認はできていない**
  （デプロイ前のため、未接続時のダミーデータへのフォールバック動作のみ確認）。詳細は下記3章32.参照
- **Phase 8d（チャットのAppSync接続）**：コード実装完了。infra全101テスト・`cdk synth`・web
  build・mobile tscは通過済み。ただし**実際のAppSyncへの疎通確認はできていない**（デプロイ前のため、
  未接続時のダミーデータへのフォールバック動作のみ確認）。詳細は下記3章33.参照。
  **これでPhase 8（8a〜8d）が全て完了**
- **Phase 9（リアクション/コメントの永続化）**：完了・`OnConnect-dev`へデプロイ済み、ブラウザで
  実機確認済み（コメント投稿・リアクショントグルがリロード後も残ることを確認）。詳細は上記0章参照
  （独立した3章番号は割り当てていない。実装計画は
  `/Users/ikkounobuyuki/.claude/plans/rosy-twirling-fox.md`参照）
- **Phase 10（予約送信の実スケジューリング）**：完了・`OnConnect-dev`へデプロイ済み、2ユーザー間の
  実機検証済み（予約中は送信者以外に見えない・発火後sentに切り替わる・取消でスケジュールも
  消えることを確認）。着手前は「実装済みだが未検証」と記録されていたが実際はスタブで、
  実質的に設計書5.2.2の初実装だった。詳細・実地検証で発見した3件の実バグは上記0章参照
  （独立した3章番号は割り当てていない）
- **Phase 11（Amazon Chime SDK音声通話実装）**：完了・`OnConnect-dev`へデプロイ済み。発信側の
  実処理（Chime Meeting作成〜クライアント参加〜CallLogs記録）はWeb版で実機確認済み、発見した
  2件の実バグも修正済み。**着信応答・通話中UI・実際の2者間音声疎通、iOS実機・Android全般は
  未検証**（次フェーズ着手前に改めて確認することが望ましい）。モバイルはネイティブ実装を選択、
  `modules/chime-audio-call/`新設（iOS Swift/Android Kotlin）。詳細は上記0章参照
  （独立した3章番号は割り当てていない）

### Phase 12〜13（未着手、優先順に記載。詳細は8章参照）
- **Phase 12: チャット・掲示板のファイル添付実装**（ユーザーからの要望、2026-08-07）
  1. チャット機能の改修：ファイルの送受信を実装したい。モバイル版からの写真添付を
     よく行う可能性がある（＝モバイルのカメラロール/カメラ連携を優先的に検討すること）
  2. ファイル管理：ストレージとして無期限に使うわけではないため、チャット添付は期間限定
     （例：1年）で自動削除して問題ない。**ただし掲示板にアップロードされた添付ファイルは
     手動削除しない限り保存し続けたい**（チャットと掲示板で保持ポリシーを分ける）
  3. セキュリティ：現状の構成（S3非公開＋SSE-S3暗号化＋HTTPS強制＋CloudFront OAC、
     Cognito/IAM認証）で「特に大きな問題がなければこのままでOK」との回答。ただし設計書
     （5.3.2）が謳う「署名付きURL（有効期限付き）配信」がCloudFront側に未実装（
     `trustedKeyGroups`等が無い）という指摘は伝達済みで、実装時にはここも含めて対応する
  既存基盤：`S3AttachmentsBucket`・`CloudFrontDistribution`は`StorageConstruct`で
  プロビジョニング済み、`attachmentKeys?: string[]`は`Message`/`BulletinPost`型に既存。
  ただし**S3へのアップロード・署名付きURL発行を行うLambdaコードは現状ゼロ**
  （`S3Client`を使うコードがinfra全体に1つも無い）ため、実質新規実装。
- **Phase 13: 実際のモバイルプッシュ配信**

### 現在のコミット状況
Phase 1〜11まで全て**コミット済み・pushも完了済み**（直近のコミットハッシュ`f33383f`まで、
`git log`で確認すること。この間の詳細な変更内容は本ファイルに書ききれていないコミットもあるため、
必ず`git log`を一次情報として確認すること）。

### AWSデプロイの状況
`OnConnect-dev`スタックを`ap-northeast-1`（アカウント`978841974977`、SSOプロファイル`dev`）に
デプロイ済みで**現在もAWS上にリソースが存在している**（Cognito・DynamoDB 16テーブル・AppSync・
S3+CloudFront・EventBridge Scheduler・API Gateway一式）。以降のセッションもこのdev環境に対して
コードを変更したら都度`cdk deploy --profile dev --context envName=dev`で反映していく運用
（destroyはしていない）。初回管理者アカウント（`loginId: staff01`、Cognito `AdminCreateUser`＋
DynamoDB Usersテーブルへの直接`put-item`で作成、`RolePermissions`は全項目`true`）を作成済み。
**staff01のパスワードはPhase 11の実機確認のため`TempPass123!`にリセット済み**（元のパスワードが
不明だったため。継続利用する場合は変更を検討すること）。動作確認用に一時的に作成した2人目の
テストユーザー（Phase 10では`staff02`、Phase 11でも同名で再作成）・テストチャットルーム・
テストメッセージ・テストCallLogは確認後に都度削除済みで、現在Usersテーブルには`staff01`
（テスト管理者）のみが存在する。継続利用する場合は`staff01`のログインID・表示名を実運用向けに
整理するか、追加の管理者アカウントを作成すること。
**再デプロイ・スタック削除など今後のAWS操作も引き続き必ずユーザーの明示的な承認を得ること**
（過去にAWS課金についての合意プロセスあり）。

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
31. **【Phase 8b】Users/Roles/MemberCategoriesのREST接続をweb/mobile全画面に展開**：
    `infra/lambda/users/index.ts`が扱う3リソース（Users・Roles・MemberCategories）は元々CRUD API・
    権限チェックとも実装済みだったが、AdminPageの一部を除きweb/mobileの全画面が
    `packages/shared/src/mockData.ts`のダミーデータを直接参照していた。本フェーズでこれを解消した
    （infra側の変更は無し）。
    - 新規`apps/web/src/api/orgApi.ts`／`apps/mobile/src/api/orgApi.ts`：AdminPage内に閉じていた
      `authFetch`（Cognito IDトークンを`Authorization`ヘッダーに生の値でセット、`Bearer`接頭辞なし）を
      共通クライアントとして切り出した。web版はUsers/Roles/MemberCategoriesの全CRUDを持つが、
      mobile版は管理画面が無い（既存方針）ため読み取り専用（`listUsers`/`listRoles`/`listMemberCategories`のみ）
    - 新規`apps/web/src/context/OrgDataContext.tsx`／`apps/mobile/src/context/OrgDataContext.tsx`：
      `NotificationStatusContext.tsx`と同じProvider+フック形式。アプリ起動後にUsers/Roles/
      MemberCategoriesをまとめて取得し全画面に配る。`API_URL`未設定・取得失敗時はダミーデータに
      フォールバックする（Phase 8aのAdminPageと同じ方針）。`AuthContext.fetchOwnProfile`
      （「自分は誰か」の早期解決用、`GET /users/{userId}`単体）とは役割を分け、あえて統合していない
      （循環依存を避けるため）。`App.tsx`で`AuthProvider`→`OrgDataProvider`→`NotificationStatusProvider`
      の順に配線
    - web 9画面・mobile 9画面（メンバー一覧・チャット一覧/詳細/個別メッセージ開始・シフト管理・
      カレンダー詳細/編集・掲示板詳細/編集）で`mockMembers`/`mockRoles`/`mockMemberCategories`の
      直接importを`useOrgData()`参照に置き換えた（機械的な一括変更、7章の索引にファイル一覧は載せず
      パターンのみ記載）。`MemberPicker`（web/mobile共通コンポーネント）はpropsで受け取る設計のため
      変更不要
    - `AdminPage.tsx`：独自`authFetch`と`useEffect`でのユーザー一覧取得を廃止し`orgApi`＋
      `useOrgData()`に統合。ユーザー管理タブの権限チェックボックス（`togglePermission`）を
      `PUT /users/{userId}`に接続（従来はローカルstateのみのTODOだった）。ロール管理・
      メンバーカテゴリ管理タブは従来「名前だけの`<ul>`表示」（追加・編集UI自体が無かった）だったが、
      スタッフ追加フォームと同系統の簡易フォーム（追加・インライン改名・削除）を新設し
      `orgApi`のCRUDに接続した（実店舗でスタッフ追加時にロール・メンバーカテゴリの実データが
      無いと選択肢が破綻するため、Users単体でなくこの3リソースを一体で扱う判断）。
      掲示板カテゴリー・リンク集・カレンダーカテゴリータブは対象外のまま（8c、別リソース）
    - テスト：infra側の変更が無いため既存101件のテストに影響なし。`npm run build --workspace apps/web`・
      `npx tsc --noEmit`（mobile）を通過。ブラウザでログイン画面が引き続き正常表示され、
      コンソールエラーが出ないことを確認済み（Cognito未デプロイのためログイン後の画面群は
      実地確認できず、型チェック・ビルド通過のみで確認。実デプロイ後に改めて確認する）
    - **未検証**：実際のAPIに対するUsers/Roles/MemberCategoriesの取得・作成・更新・削除の動作、
      ログイン後の各画面での実データ表示。実デプロイが必要（8a〜8d完了後にユーザーへ確認してから実施）
32. **【Phase 8c】残りのREST接続：OrgLinks・掲示板・カレンダー・シフト**：
    Users以外に残っていたリソース（OrgLinks、BulletinCategories/BulletinPosts、
    CalendarCategories/CalendarEvents、DutyTypes/ShiftTypes/MemberDailyStatus/DailyNote）を
    web/mobile全画面に接続した（infra側の変更は無し、全リソースとも8bより前の時点で
    バックエンドは実装済みだった）。着手前に3エージェント並行でモック依存箇所とバックエンドAPI形状を
    調査し、タスク一覧化してから実装した（8a/8bと違い独立した実装計画ファイルは作成していない）。
    - `orgApi.ts`（web/mobile）に9リソース分のCRUD関数を追加（OrgLinks・BulletinCategories・
      BulletinPosts・CalendarCategories・CalendarEvents・DutyTypes・ShiftTypes・
      MemberDailyStatus・DailyNote）。mobileは元々書き込みUIがある箇所（BulletinPosts・
      CalendarEvents・MemberDailyStatus・DailyNote）のみ書き込み関数を持つ（他は読み取り専用、
      8bで確立した「mobileに管理画面が無いリソースは読み取り専用」方針を踏襲）
    - `OrgDataContext`（web/mobile）を拡張：`orgLinks`・`bulletinCategories`・`calendarCategories`・
      `dutyTypes`・`shiftTypes`を追加（roles/memberCategoriesと同様の「軽量な参照リスト、
      アプリ起動時に一括取得」という性質のため）。一方`BulletinPosts`・`CalendarEvents`・
      `MemberDailyStatus`・`DailyNote`は「本体データ」（一覧規模・絞り込み条件がページごとに違う）
      としてOrgDataContextに含めず、各ページが自分でfetchする設計にした（一貫した使い分けの基準として
      記録）
    - **OrgLinks**：AdminPageのリンク集管理タブに追加・編集（インラインフォーム）・削除UIを新設
      （タイトル・URL・カテゴリ・並び順の4項目）。`LinksPage`/`Screen`を`useOrgData().orgLinks`に接続
    - **BulletinCategories/CalendarCategories**：AdminPageの該当タブを「名前だけの`<ul>`表示」から
      Roles/MemberCategoriesと同じ追加・改名・削除UIに刷新。各種消費箇所（一覧・詳細・編集画面の
      カテゴリー名解決・カテゴリー選択プルダウン）を接続
    - **BulletinPosts/CalendarEvents本体**：一覧・詳細（+CalendarEventsは削除）・作成編集を接続。
      BulletinPostsは投稿本体のみが対象で、**コメント・リアクションは対象外のまま**
      （バックエンドにエンドポイント自体が存在せず、Phase 9で新規実装予定）。
      CalendarEventsの`.ics`エクスポートは既存の`buildIcsForEvent`クライアント側生成のままで
      変更不要（バックエンドの`/calendar-events/{id}/ical`は呼び出していない）
    - **Shifts（DutyTypes/ShiftTypes/MemberDailyStatus/DailyNote）**：
      - DutyTypes/ShiftTypesの管理UIをAdminPageに新規タブとして追加（従来はどこにも管理UIが
        無かった）。名前・有効/無効チェックボックスを持つ追加・改名・削除UI
      - `MemberDailyStatus`のGET・`DailyNote`のGETはバックエンドが1日単位のみ対応（範囲取得APIが
        無い）。月表示のたびに日付ごとにループしてリクエストする方式で実装（ユーザーに確認済み、
        最大31回/月のリクエストになるが数十名規模の小規模事業者では体感上問題ない想定。
        範囲取得APIの新規追加＝infra変更は見送った）
      - `ShiftManagementPage`/`Screen`：月切り替えのたびに`refetchMonth`関数で該当月の全日付を
        再取得。セル編集・メモ編集の保存/削除操作後も同じ関数で再取得し画面に反映
    - テスト：infra側の変更が無いため既存101件のテストに影響なし。`npm run build --workspace apps/web`・
      `npx tsc --noEmit`（mobile）を通過。ブラウザでログイン画面が引き続き正常表示され、
      コンソールエラーが出ないことを確認済み（Cognito未デプロイのためログイン後の画面群は
      実地確認できず、型チェック・ビルド通過のみで確認）
    - **未検証**：実際のAPIに対する各リソースの取得・作成・更新・削除の動作、ログイン後の各画面での
      実データ表示。実デプロイが必要（8a〜8d完了後にユーザーへ確認してから実施）
33. **【Phase 8d】チャットのAppSync接続**：
    8a〜8cと異なり、バックエンド（AppSync GraphQL）に構造的な欠落があったため、infra追加実装
    から着手した（「自分が参加しているルーム一覧を取得するクエリ」も「ルームを作成するmutation」も
    元々存在しなかった）。事前調査（Explore agent 1件）→計画作成（Plan mode、
    `reactive-purring-castle.md`を8d用に上書き再利用）→ユーザー承認、の流れで実装した。
    - **infra**：`infra/graphql/schema.graphql`に`Query.listChatRoomsForUser(userId)`・
      `Mutation.createRoom(input: CreateRoomInput!)`（`{isGroup, name, memberUserIds}`）を追加。
      `infra/lib/constructs/chat-construct.ts`にリゾルバ2件を追加：
      `ListChatRoomsForUserResolver`は`ChatRoomsTable`への**Scan**＋
      `FilterExpression: contains(memberUserIds, :userId)`（GSIは追加せず、`dailyReminder.ts`が
      `CalendarEventsTable`を全件スキャンしている前例に揃えた設計判断。組織規模35人程度・
      ルーム数も少数という前提）、`CreateRoomResolver`は`SendMessageResolver`と同じ素直な
      PutItemパターン。1:1 DMの重複作成防止はサーバー側では行わず、フロント側の
      「既存ルームを先に探す」ロジックに委ねる意図的な簡略化（小規模組織向けツールという前提）。
      `on-connect-stack.test.ts`のAppSyncアサーションはリソース数のみの検証のため
      既存101件のテストに影響なし（`npm test`で確認済み）
    - **リアクションは対象外のまま**：`Message`型にリアクション用フィールドが元々無く、
      掲示板のコメント・リアクション（Phase 8cで対象外にした）と合わせてPhase 9で対応する方針に統一
    - **web/mobile: AppSyncクライアント新設**：`apps/web/src/api/chatClient.ts`・
      `apps/mobile/src/api/chatClient.ts`を新設。`aws-amplify`はPhase 8aでCognito認証用に
      導入済みだったため追加の依存パッケージは不要で、`aws-amplify/api`の`generateClient()`を
      そのまま利用できた（`aws-amplify/api`は`@aws-amplify/api-graphql`を内包）。GraphQL文字列は
      `orgApi.ts`と同じ「コード生成を使わず手書き」のスタイルに統一。TypeScriptの型解決には
      Amplifyの`GraphQLQuery<T>`/`GraphQLSubscription<T>`ヘルパー型が必要だった
      （素朴に`client.graphql<T>()`と書いただけでは、クエリ/ミューテーション用のPromise型と
      サブスクリプション用のObservable型のどちらになるかコード生成を使わない場合は型推論できず、
      `res.data`や`.subscribe()`でコンパイルエラーになる。ビルドして初めて判明した詰まりどころ）
    - `amplifyConfig.ts`（web/mobile）に`API.GraphQL`設定を追加（`endpoint`/`region`/
      `defaultAuthMode: "userPool"`）。`apps/web/.env.example`に`VITE_GRAPHQL_API_URL`、
      `apps/mobile/.env.example`に`EXPO_PUBLIC_GRAPHQL_API_URL`を追加（`AWS_REGION`は8aで
      追加済みのものを流用）。値は`infra/lib/on-connect-stack.ts`の`GraphqlApiUrl`
      （CfnOutput、既存）から取得する運用
    - **画面接続**：`chatClient`呼び出し失敗時は全画面で`mockChatRooms`/`mockMessages`に
      フォールバックする方針を`orgApi`と統一。
      - `ChatListPage`/`Screen`：`listChatRoomsForUser`でルーム一覧取得後、各ルームの
        `listMessagesForRoom`（デフォルトlimit=50）でプレビュー・検索対象を取得
      - `ChatRoomPage`/`Screen`：`getChatRoom`＋`listMessagesForRoom`で初期表示、
        `onMessageSent`/`onMessageRead`を購読しリアルタイム反映（同一messageIdなら置き換え、
        無ければ追加する`upsertMessage`関数で一本化）。`sendMessage`で送信、自分宛て
        （送信者以外）の未読メッセージを表示した時点で`markMessageRead`を呼ぶ（既読UI自体は
        新設せず、mutationの発火のみ）。リアクションはローカルstateのまま変更なし
      - `NewDirectMessagePage`/`Screen`：`listChatRoomsForUser`の結果から既存1:1ルームを探し、
        無ければ`createRoom`で新規作成。**`MembersPage`/`Screen`の「チャット」ボタンも
        同じロジックに接続**（計画時点では対象外だったが、実装中に同じ「既存ルーム検索→
        無ければ仮IDへ遷移」という古いパターンが残っていることに気づき、Phase 8dのゴール
        （チャットの主要な入口が実際に機能すること）を満たすために追加対応した）
      - `GroupChatCreatePage`/`Screen`：**メンバー個別選択UIを新規実装**（従来はグループ名入力欄
        のみで、メンバーを選ぶ手段自体が無くグループが作成不可能だった）。`memberMatchesQuery`で
        検索できるチェックボックス一覧を追加し、`createRoom({isGroup: true, ...})`に接続。
        「メンバーカテゴリから一括選択」は既存のTODOのまま対象外（個別選択のみで最低限機能させる
        という計画通りのスコープ）
    - テスト：infra側は`npm test --workspace infra`（101件）・`cdk synth`で確認。
      `npm run build --workspace apps/web`・`npx tsc --noEmit`（mobile）を通過。ブラウザで
      ログイン画面が正常表示され、コンソールエラーが無いことを確認済み（Cognito/AppSync未デプロイの
      ためログイン後の画面群は実地確認できず、型チェック・ビルド通過のみで確認）
    - **未検証**：実際のAppSyncに対するルーム一覧取得・作成・送信・購読・既読の動作。実デプロイが
      必要（8a〜8dが一通り完了したため、次はユーザーにデプロイの可否を確認するタイミング）
34. **【初回AWSデプロイ＋Phase 8a〜8d実機検証】**：ユーザーの承認を得て`OnConnect-dev`スタックを
    `ap-northeast-1`（アカウント`978841974977`）に初めてデプロイし、Phase 8a〜8dで「未検証」のまま
    残っていた実際のCognito/API Gateway/AppSyncへの疎通を一通り確認した。
    - **デプロイ手順**：`aws sso login --profile dev`→`cdk deploy --profile dev`。初回管理者は
      API経由では作成できない（Phase 8a・3章30.で既述の通り、全APIルートがCognito認証必須のため
      「テーブルが空なら」ガードが機能しない設計）ため、`aws cognito-idp admin-create-user`
      （`UserAttributes`に`name`を指定する必要あり、後述）＋DynamoDB Usersテーブルへの直接
      `put-item`（`Role`・`MemberCategory`もダミーで1件ずつ作成）で手動作成した
    - **バグ①CORSヘッダー欠落（重大・全REST接続をブロック）**：`defaultCorsPreflightOptions`は
      OPTIONSプリフライトのみにCORSヘッダーを付与し、Lambda proxy統合の実レスポンス（GET/POST等）
      には付与しないというAPI Gateway CDKの仕様を見落としていたため、実際にブラウザで叩くと
      ステータスに関わらず全リクエストが「CORSポリシーでブロック」される状態だった
      （`curl`は素通りするため単体テスト・`cdk synth`・これまでのローカル確認では気づけなかった）。
      `infra/lambda/common/http.ts`の`jsonResponse`/`rawResponse`に`Access-Control-Allow-Origin: *`
      を追加して修正。あわせて、API Gateway自体がLambdaに到達せず返す401/403等
      （トークン期限切れ時などに典型）にもCORSヘッダーが無くブラウザからは同じくCORSエラーに
      見えることに気づき、`infra/lib/constructs/api-construct.ts`に`DEFAULT_4XX`/`DEFAULT_5XX`の
      Gateway Responseへ明示的にCORSヘッダーを付与する設定を追加。スタブのまま`headers`を
      持っていなかった`infra/lambda/calls/initiateCall.ts`（Phase 11待ちの音声通話）にも同様に追加
    - **バグ②チャット送信VTLの構文エラー（AppSyncチャット送信が全滅）**：
      `chat-construct.ts`の`SendMessageResolver`が
      `$util.isNull($ctx.args.input.scheduledAt) ? "sent" : "scheduled"`というJS風三項演算子を
      使っていたが、AppSyncのVTL（Apache Velocity）はこの構文をサポートしておらず
      `Lexical error, Encountered: "?"`で全ての`sendMessage`呼び出しが失敗していた（`cdk synth`は
      VTLの中身を実行しないため検出できず、実際にAppSyncへ送信して初めて発覚）。
      `#if`/`#set`で事前に`$status`変数を計算してから参照する形に書き換えて修正
    - **リアルタイム購読の検証で分かった注意点（コード修正なし、知見として記録）**：
      `onMessageSent`/`onMessageRead`は`@aws_subscribe`ディレクティブによるAppSync標準の
      自動配信で、専用リゾルバは無い。動作検証中、`sendMessage`をGraphQL選択セットの一部フィールド
      （`readByUserIds`等の非null必須フィールド）を省略して呼ぶと、その回だけ購読側に
      `Cannot return null for non-nullable type`エラーが飛ぶ（＝その時点でWS購読していた
      全クライアントへの配信が失敗する）という挙動を確認した。アプリ本体の`chatClient.ts`は
      常にフルフィールド（`MESSAGE_FIELDS`）を選択しているため実運用では問題ないが、
      デバッグ目的で`sendMessage`を手動実行する際は必ずフルフィールドを選択すること。
      また、`chatClient.ts`（web/mobile）の`subscribeToMessages`/`subscribeToReads`に
      `error`ハンドラが無く、購読エラーが発生してもコンソールにすら出ず気づけなかったため、
      `console.error`を出す`error`ハンドラを追加した（副産物の改善、挙動は変えていない）
    - **確認済み**：Cognitoログイン（初回パスワード設定含む）、AdminPageでの実データ表示
      （`テスト管理者`が実際にUsersテーブルから表示される）、REST API（Users/Roles等）の
      取得・表示、AppSyncでのグループチャット作成（`createRoom`）・メッセージ送信
      （`sendMessage`、DynamoDB Messagesテーブルへの永続化を確認）・リアルタイム購読
      （別クライアントからの送信がリロード無しで即座に画面へ反映されることを確認）
    - **未確認のまま残っているもの**：既読（`markMessageRead`）の実地動作、予約送信
      （Phase 10対象）、Bulletin/Calendar/Shifts等REST接続の実データでの動作（Users/Roles以外は
      未確認）、モバイル（Expo）での実機確認
    - テスト：修正後`npm test --workspace infra`（101件）・`cdk synth`・
      `npm run build --workspace apps/web`・`npx tsc --noEmit`（mobile）で確認
35. **【残りのREST接続実地検証＋バグ2件発見・修正】**：34.で未確認のまま残っていた
    掲示板・カレンダー・シフト・リンク集のREST接続と、チャットの既読（`markMessageRead`）を
    実際のAPIで検証した。検証中に新たなバグを2件発見・修正した。
    - **バグ③新規作成フォームのカテゴリー初期値がモックIDに固定される**：`BulletinEditPage.tsx`・
      `CalendarEventEditPage.tsx`（web）で、新規作成時のデフォルトカテゴリーを
      `useEffect(() => { setCategoryId(bulletinCategories[0]?.categoryId ?? ""); }, [postId])`
      のように`postId`のみに依存する形で設定していたため、マウント直後（`OrgDataContext`が
      ローディング中のモックフォールバック値をまだ返している瞬間）の値で固定されてしまい、
      実データ取得完了後も更新されなかった。結果、表示上は実カテゴリー名（たまたま同名）が
      選択されているように見えても、実際に送信されるcategoryIdはモックのID
      （例：`bc-announcement`）のままで、DynamoDBに存在しないカテゴリーIDが保存されていた。
      `OrgDataContext`に既にあった`isLoading`フラグを使い、取得試行完了（成功/フォールバック
      いずれか確定）後にのみデフォルト値を設定するよう修正（`useOrgData()`の`bulletinCategories`
      等は「未ロード時はモックで初期化される」設計のため、配列の中身だけでは実データか
      判定できない点に注意。mobile版の`BulletinEditScreen.tsx`・`CalendarEventEditScreen.tsx`は
      同じ値を`useState`にキャッシュせず保存時に`bulletinCategories`を都度参照する実装だった
      ため、この不具合は無く修正不要だった）
    - **バグ④シフト管理画面の月間一括取得がAWSアカウントのLambda同時実行数上限に達し500エラー**：
      `ShiftManagementPage`/`Screen`の`refetchMonth`が`Promise.all`で最大31日×2種類=62件を
      一度に並列リクエストしており、このAWSアカウントのLambda同時実行数上限が**10**
      （`aws lambda get-account-settings`で確認。標準は1000だがこのアカウントは10のまま）
      だったため、大半が`API Gatewayの{"message": "Internal server error"}`
      （Lambda呼び出し自体のスロットリングによる汎用500、アプリのエラーハンドラが返す
      `{"message": "内部エラーが発生しました"}`とは別物）で失敗し、該当日のデータが
      ダミーデータにフォールバックしていた（`curl`で1件ずつ順次確認すると全て200で成功する
      ため、単体テストでは気づけない類のバグ）。31件のcurl並列実行で再現确認。
      **対処1（AWS側）**：Service Quotas経由でLambda同時実行数の引き上げを1000へ申請済み
      （`aws service-quotas request-service-quota-increase`、本ファイル執筆時点`CASE_OPENED`
      で未承認）。**対処2（コード側）**：`packages/shared/src/concurrency.ts`に
      `mapWithConcurrency`（同時実行数を指定して配列を処理する汎用ヘルパー）を新設し、
      `ShiftManagementPage`/`Screen`の日別fetch（同時実行数5）と、`OrgDataContext`
      （web/mobile）の起動時8件一括取得（同時実行数4、こちらも同じ上限に抵触し得るため
      合わせて対処）に適用。Quota引き上げが未承認の状態でも、この2箇所を合計9同時実行以下に
      抑えることで500エラーが発生しないことを確認済み
    - **確認済み**：掲示板（カテゴリー作成・投稿作成・一覧/詳細表示）、カレンダー
      （カテゴリー作成・予定作成・月表示への反映）、シフト管理（当番種別・シフト種別の作成、
      `member-daily-status`のGET/PUT/DELETE、実データでのグリッド表示）、リンク集
      （作成・一覧表示）、チャットの既読（`markMessageRead`呼び出し後に`readByUserIds`へ
      実際に自分のuserIdが追加されることをDynamoDBで確認）。検証用に作成したテストデータ
      （2人目のテストユーザー・テストチャットルーム等）は確認後に削除済み。一部
      （掲示板投稿1件・カレンダーカテゴリー/予定各1件・リンク1件・当番種別/シフト種別各1件）は
      動作確認の実データとしてそのまま残している
    - **未確認のまま残っているもの**：モバイル（Expo）のシミュレータ実機確認
      （このMacにフルのXcodeが入っておらず`npx expo start --ios`が失敗するため未実施。
      ユーザーにXcodeインストール＋`sudo xcode-select`実行を依頼済み、次回セッションで再開）
    - テスト：`npm test --workspace infra`（101件）・`npm run build --workspace apps/web`・
      `npx tsc --noEmit`（mobile）で確認
36. **【モバイル（Expo）初のシミュレータ実機確認＋バグ4件発見・修正】**：ユーザーがXcodeを
    インストールし`sudo xcode-select`を実行後、iOSシミュレータ（iPhone 17、iOS 26.5）で
    On-Connectモバイルアプリを**このプロジェクトで初めて**実際に起動・操作した。モバイルは
    これまで`npx tsc --noEmit`の型チェックのみで実機確認は一度も行われていなかったため、
    起動するだけで4件の実在するバグを発見・修正することになった。
    - **バグ⑤モノレポでのMetroエントリポイント解決失敗**：npm workspacesで`expo`が
      ワークスペースルートの`node_modules`にホイストされるため、`package.json`の
      `"main": "node_modules/expo/AppEntry.js"`（相対パスのリテラル指定）が
      `apps/mobile/node_modules/expo/...`を探しに行ってしまい`ConfigError: Cannot resolve
      entry file`で起動不能だった。さらに`"main": "expo/AppEntry.js"`（bare specifierとして
      Node解決に任せる形）に変更しても、`expo/AppEntry.js`自身が`import App from '../../App'`
      という「自分のファイル位置からの相対パス」でアプリ本体を読み込む実装のため、ホイスト先の
      `<リポジトリルート>/node_modules/expo/`を基準に`<リポジトリルート>/App`を探してしまい
      根本的に解決不能（`apps/mobile/App.tsx`には辿り着けない）と判明。Expo公式のモノレポ対応
      パターンに従い、`apps/mobile/index.js`を新設して`import App from "./App"`を明示的に
      `registerRootComponent`する形に変更し、`main`を`"index.js"`に。あわせて
      `apps/mobile/metro.config.js`を新設し`watchFolders`／`nodeModulesPaths`にワークスペース
      ルートを追加（モジュール解決自体はこちらが本題だが、上記のエントリポイント解決は
      metro.config.jsではなく`main`フィールド自体の問題だったため両方の対応が必要だった）
    - **バグ⑥`@react-native-community/netinfo`の依存漏れ**：`aws-amplify/api`
      （Phase 8dで導入、AppSyncクライアント用）が内部で参照する`ReachabilityMonitor`が
      `@react-native-community/netinfo`を要求するが、`apps/mobile/package.json`に追加されて
      いなかったため`Unable to resolve module @react-native-community/netinfo`でバンドル
      エラーになっていた。`npx expo install @react-native-community/netinfo`で追加
    - **バグ⑦`react-native-get-random-values`はExpo Goでは動作しない（ネイティブモジュール）**：
      上記2件を直しアプリの起動自体には成功したが、ログイン（Cognito SRP認証）を試みると
      `Unknown: An unknown error has occurred.`という空のエラーで必ず失敗した。
      Expo Go（App Store配布の汎用クライアント）は事前ビルドされた固定のネイティブモジュール
      セットしか持たず、サードパーティのネイティブコード（`react-native-get-random-values`が
      提供するネイティブ`crypto.getRandomValues`実装）は含まれないため、SRP認証の乱数生成が
      サイレントに失敗していたと判明（Phase 8aの時点で「RN 0.74.5への対応のため
      `react-native-get-random-values`は1.11.0を使う」という記録はあったが、Expo Goでの
      動作可否は検証されていなかった）。`npx expo run:ios`でカスタム開発ビルド（Dev Client、
      ネイティブモジュールを実際にコンパイルしてリンクしたもの）を作成したところログインが
      成功することを確認した。`apps/mobile/package.json`の`ios`/`android`スクリプトを
      `expo start --ios/--android`（Expo Go前提）から`expo run:ios`/`expo run:android`
      （カスタム開発ビルド前提）に変更した。**今後モバイルを実機/シミュレータで確認する際は
      必ず`npm run ios --workspace apps/mobile`（内部的に`expo run:ios`）でカスタム開発
      ビルドを使うこと。Expo Goでは認証が機能しない**。なお`apps/mobile/ios`・`android`
      ディレクトリは`expo prebuild`が生成する成果物で`.gitignore`済み（コミット対象外）。
      初回の`pod install`は環境のLANG未設定（`LANG=en_US.UTF-8`が必要、CocoaPods+Rubyの
      既知の非ASCII文字処理エラー`Encoding::CompatibilityError`が起きる）でも一度失敗した
      （このホスト固有の問題で、修正はコード側ではなく環境変数設定）
    - **バグ⑧`OrgDataContext`の初回一括取得がログイン確立前に走り、以後ずっとモックのまま**：
      上記を全て解消してログインには成功したが、ログイン後の画面（掲示板のカテゴリーフィルタ、
      シフト管理のメンバー行）が実データ（`テスト管理者`1名、`お知らせ`カテゴリーのみ）ではなく
      モックデータ（9人のダミーメンバー、`お知らせ`/`行事`/`緊急連絡`の3カテゴリー）のままに
      なっていることに気づいた。原因は`OrgDataProvider`（web/mobile共通の設計）が
      アプリマウント時に一度だけ8リソースを取得する`useEffect`の依存配列が空（正確には
      `useCallback`の参照のみで実質固定）だったこと。この`Provider`はログイン前の画面
      （ログイン画面自体）でも常にマウントされているため、初回マウント時点でまだAmplifyの
      セッションが確立していないと`fetchAuthSession()`が有効なトークンを返せず8件とも認証
      エラーでモックにフォールバックし、**ログインが後から成功してもこの`useEffect`は
      二度と再実行されないため、モックに固定されたままアプリを再起動するまで戻らない**という
      構造的な不具合だった（web版もこれまでは既にログイン済みのセッションが残ったままの
      リロードでしか動作確認しておらず、「ログイン画面から新規にログインした直後」という
      経路を今回モバイルで初めて実地検証したことで顕在化した。理論上はwebでも同じ条件
      （ブラウザのローカルストレージを空にした状態からの初回ログイン）で再現する可能性がある）。
      `OrgDataContext.tsx`（web/mobile）に`useAuth()`の`currentUserId`を`useEffect`の依存に
      追加し、ログイン完了（`currentUserId`が確定）時にも再取得が走るよう修正
    - **確認済み**（カスタム開発ビルド、実機同然のiOSシミュレータで）：ログイン画面の表示、
      Cognitoログイン（`staff01`）成功、ログイン後のヘッダー表示（`テスト管理者`）、
      チャット・掲示板・メニュー・シフト管理の各タブの表示、掲示板の実投稿（web側で作成した
      「実機確認テスト投稿3」）とカテゴリーフィルタの実データ表示、シフト管理の実メンバー
      （`テスト管理者`1名）表示。いずれもモックへのフォールバックなく実際のAPIからのデータで
      あることを確認済み
    - **未確認のまま残っているもの**：メッセージ送信・掲示板投稿作成等の書き込み操作を
      モバイルの実機UIから行う一連の流れ（今回は起動・表示・ログインの確認が中心で、
      書き込み系操作はweb側で既に確認済みのため対象外とした）、Android実機/エミュレータでの確認
    - テスト：修正後`npm test --workspace infra`（101件）・`npm run build --workspace apps/web`・
      `npx tsc --noEmit`（mobile）で確認

## 4. 現在のダミー登録ユーザーの設定

- `mockCurrentUserId = "user-03"`（田中 美咲、一般メンバー、`permissions`は全項目`false`）が「ログイン中の自分」
- 管理者相当（`permissions`が全項目`true`）は `user-01`（佐藤 陽子）・`user-02`（高橋 誠）の2名
- 管理者視点の画面を見たい場合は `packages/shared/src/mockData.ts` の `mockCurrentUserId` を
  `"user-01"` 等に変更する（Webの「管理者」タブ、シフト管理の編集権限等が現れる）
- 権限はロールでなく`User.permissions`が個別に持つ点に注意（22.参照）。`mockRoles`は名前ラベルのみ

## 5. 実装状況（本実装 vs スタブ）

### 本実装済み（実際に動くロジック、ローカルテスト確認済み。AWSデプロイ・実地検証状況は各項目に記載）
- CDKインフラのリソース定義一式（Cognito、DynamoDB **15テーブル**、AppSync、S3+CloudFront、
  EventBridge Scheduler、API Gateway）
- 通知ステータス毎朝7時自動リセット＋休日連動ロジック（`dailyNotificationReset.ts`、24.参照）
- Users/Roles/MemberCategories・BulletinPosts/BulletinCategories・CalendarEvents/CalendarCategories・
  OrgLinks・DutyTypes/ShiftTypes/MemberDailyStatus/DailyNoteの全CRUD Lambda（19,22,23,24,25参照）
- 呼び出し元の権限チェック（`manageUsers`/`manageRoles`/`manageMemberCategories`/`manageBulletinCategories`/
  `manageCalendarCategories`/`manageShifts`）。**bulletin/calendar/shiftsのカテゴリー管理系は権限チェック
  済みだが、CalendarEvents本体・BulletinPosts本体には権限チェックが無い**（全メンバーが作成編集削除可、
  設計上の意図的な選択）
- Web/Mobileの全画面UI（シフト管理・メニュー画面含む）。Users/Roles/MemberCategories/OrgLinks/
  BulletinCategories/BulletinPosts/CalendarCategories/CalendarEvents/DutyTypes/ShiftTypes/
  MemberDailyStatus/DailyNoteは`orgApi`＋`OrgDataContext`（一部は各ページの直接fetch）経由で本物の
  APIから取得する（Phase 8b・8c、31./32.参照。未接続時は`mockData.ts`にフォールバック）。
  チャット（ChatRooms/Messages）も`chatClient`経由でAppSyncに接続済み（Phase 8d、33.参照）。
  **これで全リソースがバックエンド接続済みになった**（掲示板コメント・チャット/掲示板の
  リアクションのみPhase 9待ち、下記参照）
- 検索・フィルタ・ソート・ヘッダー連携・コメント投稿などのフロントエンドロジック（いずれも
  ローカルstateで完結。リロードで消える）。**リアクション（チャット・掲示板とも）と掲示板コメントは
  バックエンドにAPI自体が無くPhase 9まで対象外**
- チャット新着メッセージのプッシュ通知判定＋SNS発行ロジック（`pushNotification.ts`、27.参照）。
  forceNotify優先・メンション限定・デフォルト全員通知の3分岐、送信者除外まで実装・テスト済み
  （実際のモバイルプッシュ配信＝SNSトピック以降のAPNs/FCM接続は未実装）
- カレンダー予定の個別`.ics`エクスポート（`buildIcsForEvent`、Web/Mobile/Lambdaで共通利用）と
  当日リマインド通知（`dailyReminder.ts`、28.参照）。単日・複数日イベントの判定、閲覧カテゴリー
  フィルタ、通知OFF除外まで実装・テスト済み
- Cognito認証（Phase 8a、30.参照）。ログイン・初回パスワード設定・サインアウト、管理者による
  アカウント発行・ログイン状況確認・パスワード再発行。**本セッションで初めて実際のCognitoに
  デプロイし、ログイン・初回パスワード設定の実地動作を確認済み**（34.参照。管理者によるアカウント
  発行・パスワード再発行UI自体は未確認）
- Users/Roles/MemberCategoriesのREST接続（Phase 8b、31.参照）。全CRUD（web）・全画面での参照（web/mobile）
  を実装済み。**本セッションで実際のAPIへの疎通（取得・表示）を確認済み**（34.参照。作成・更新・
  削除の実地動作は未確認）
- OrgLinks/BulletinCategories/BulletinPosts/CalendarCategories/CalendarEvents/DutyTypes/ShiftTypes/
  MemberDailyStatus/DailyNoteのREST接続（Phase 8c、32.参照）。**コードは実装済みだが実際のAPIへの
  疎通確認はまだできていない**（Users/Roles以外は34.の検証範囲外）
- チャットのAppSync接続（Phase 8d、33.参照）。ルーム一覧取得・ルーム作成・メッセージ送信・購読・
  既読を実装（infra側にルーム一覧取得クエリ・ルーム作成mutationを新規追加）。
  **本セッションでルーム作成・メッセージ送信・DynamoDBへの永続化・リアルタイム購読の実地動作を
  確認済み**（34.参照。既読`markMessageRead`の実地動作は未確認）。検証中に見つかった
  VTL構文エラー（バグ②）は修正済み

### 未実装（TODOコメントあり、501スタブ等）
- Messagesテーブル streams → EventBridge Scheduler の CreateSchedule/DeleteSchedule（予約送信の実装、
  実装自体は`onMessageStreamChange.ts`/`sendScheduled.ts`にあるが実際のチャット経由での動作確認は
  Phase 8dでチャットが繋がったことで初めて可能になった。次にチャットを実デプロイした際に検証する）
- 掲示板の新規投稿通知Lambda（`bulletin/notifyOnPost.ts`）の実際の送信ロジック（`console.log`のみのスタブのまま。
  チャット側の`pushNotification.ts`とは別ファイルで、Phase 5・6のどちらでも対応対象外だった）
- リアクション/コメントの永続化API（チャット・掲示板とものリアクション、掲示板コメント。
  対応するDynamoDBテーブル・GraphQLスキーマ拡張・REST/AppSyncエンドポイントとも未作成、Phase 9対象）
- Amazon Chime SDK Meeting/Attendee作成（音声通話は現状デモの着信画面遷移のみ）
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
| Web/Mobile: Users/Roles/MemberCategories APIクライアント（Phase 8b） | `apps/web/src/api/orgApi.ts` / `apps/mobile/src/api/orgApi.ts` |
| Web/Mobile: Users/Roles/MemberCategories一括取得・全画面配布（Phase 8b） | `apps/web/src/context/OrgDataContext.tsx` / `apps/mobile/src/context/OrgDataContext.tsx` |
| Web/Mobile: チャットAppSyncクライアント（Phase 8d） | `apps/web/src/api/chatClient.ts` / `apps/mobile/src/api/chatClient.ts` |
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
**Phase 8（8a〜8d）が完了し、他の全フェーズをブロックしていた最優先事項は解消済み**。
Phase 9〜12は互いに強い依存関係は無く、着手順はユーザーの優先度判断で決めてよい。

- **Phase 8: Cognito認証・AppSync/RESTクライアント接続 — 全ステップ完了**（4ステップ
  「8a: 認証基盤」「8b: REST 1リソースだけ疎通確認」「8c: 残りのリソースへ展開」
  「8d: チャットのAppSync接続」）
  - **8a（認証基盤）：コード実装完了**（詳細は3章30.参照）。ダミーのログイン画面を実際のAmplify＋
    Cognito認証に置き換え、`mockCurrentUserId`を参照していた18ファイル全てを実際の認証ユーザーIDに
    置き換えた。AdminPageに管理者によるアカウント発行（Cognitoアカウント作成＋仮パスワード発行）・
    ログイン状況確認・パスワード再発行のUIも実装済み
  - **8b（Users/Roles/MemberCategories接続）：コード実装完了**（詳細は3章31.参照）。
    `orgApi.ts`＋`OrgDataContext`を新設し、web 9画面・mobile 9画面の`mockMembers`/`mockRoles`/
    `mockMemberCategories`直接参照を解消。AdminPageのロール・メンバーカテゴリタブに追加・改名・削除UIを
    新設しAPI接続、ユーザー権限編集もPUT接続した
  - **8c（残りのリソース接続：OrgLinks/掲示板/カレンダー/シフト）：コード実装完了**（詳細は3章32.参照）。
    `orgApi.ts`・`OrgDataContext`をさらに拡張し、9リソース分のREST接続を完了。AdminPageに
    リンク集・掲示板カテゴリー・カレンダーカテゴリー・当番種別・シフト種別の管理UIを新設
  - **8d（チャットのAppSync接続）：コード実装完了**（詳細は3章33.参照）。8a〜8cと異なり
    バックエンドに構造的な欠落があった（ルーム一覧取得クエリ・ルーム作成mutationが未実装）ため、
    infra追加実装（スキーマ拡張・新規リゾルバ2件、GSIは追加せず既存の全件スキャン方式に揃えた）
    から着手。`chatClient.ts`を新設しチャット4画面＋メンバー一覧の「チャット」ボタンを接続。
    グループ作成画面には従来存在しなかったメンバー個別選択UIも新設した。
    リアクション永続化のみPhase 9へ先送り（スキーマ未対応）
  - **（この段落は執筆当初のもので現在は古い）** その後のセッションで`OnConnect-dev`スタックへの
    初回デプロイ・実機確認が完了し、以降のセッションもこのdev環境に対して開発を続けている
    （詳細は上記0章参照）。「デプロイ未実施」という前提はもう成り立たない
  `infra/lib/constructs/auth-construct.ts`のCognito設定・`infra/lambda/common/cognito.ts`・
  Web/Mobileの`AuthContext.tsx`は実装済み。詳細は
  `/Users/ikkounobuyuki/.claude/plans/effervescent-gliding-patterson.md`の
  「Phase 8a: 認証基盤 実装計画」、`/Users/ikkounobuyuki/.claude/plans/reactive-purring-castle.md`
  （Phase 8b計画を8d用に上書き再利用したもの。現在の内容は8d）、および本ファイル3章32.
  （Phase 8c、独立した計画ファイルなし）を参照。
- **Phase 9: リアクション/コメントの永続化 — 完了**（詳細は上記0章参照）
  掲示板コメント用の新規`BulletinCommentsTable`・REST 2エンドポイント（コメントCRUD・投稿リアクション
  トグル）を追加し、ローカルstateのみだった`toggleReaction`等をAPI接続に置き換えた。チャットの
  リアクションはこのプロジェクト初のLambda裏付けAppSyncリゾルバ（`toggleMessageReaction`）で対応。
  `bulletin/notifyOnPost.ts`（従来`console.log`のみのスタブ）も実装した
- **Phase 10: 予約送信の実スケジューリング — 完了**（詳細は上記0章参照）
  `onMessageStreamChange.ts`・`sendScheduled.ts`は実際には未実装（スタブのみ）だったため
  ゼロから実装した。EventBridge Schedulerでの登録/取消、このプロジェクト初のLambda→AppSync
  呼び出し（IAM署名）による配信、予約中メッセージの可視性フィルタ、取消UIの新設まで含めて
  設計書5.2.2を一通り実装し、実機で3件のバグを発見・修正した
- **Phase 11: Amazon Chime SDK音声通話実装 — 完了**（詳細は上記0章参照）
  `initiateCall.ts`（`501`スタブ）を実装に差し替え、web/mobileにChime SDKクライアントを組み込んだ。
  モバイルはユーザーの明示的な選択でネイティブ実装（Expo Modules API、iOS Swift/Android Kotlin）。
  発信側の実処理はWeb版で実機確認済み、実機デプロイで発覚した2件の実バグも修正済み。着信応答・
  通話中UI・2者間音声疎通・iOS実機・Android全般は未検証のまま残っている
- **Phase 12: チャット・掲示板のファイル添付実装**（詳細は上記3章「完了したフェーズ」直下参照）
  ユーザー要望（2026-08-07）：モバイルからの写真添付を優先、チャット添付は期間限定
  （例：1年）で自動削除可、掲示板添付は手動削除以外では保持し続ける、セキュリティは現状維持でOK
  （ただしCloudFrontの署名付きURL未実装という指摘は認識済み）
- **Phase 13: 実際のモバイルプッシュ配信**
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
