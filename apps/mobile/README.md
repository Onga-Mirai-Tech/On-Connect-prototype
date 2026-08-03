# apps/mobile — On-Connect Mobile (iOS / Android)

Expo（React Native + TypeScript）によるモバイルクライアントの雛形。
[docs/DESIGN.md](../../docs/DESIGN.md) 7章「画面構成」に沿った画面を `src/screens/` に配置している。

## なぜExpoか

`ios/` `android/` ネイティブプロジェクトを手作業・非対話環境で正しく生成するのは非現実的なため、
Managed Workflowで開始できるExpoを採用した。Amazon Chime SDK（音声通話）やCallKit/ConnectionService
連携（次フェーズ）などネイティブモジュールが必要になった時点で、
[`expo prebuild`](https://docs.expo.dev/workflow/prebuild/) や Dev Client でネイティブ層を生成する。
バニラのReact Native CLI構成にしたい場合は、この方針を変更して差し支えない。

## セットアップ

実機・シミュレータでの確認には Xcode（iOS）／Android Studio（Android）、および
[Expo Go](https://expo.dev/client) アプリ、もしくは `expo run:ios` / `expo run:android` が必要（このリポジトリのサンドボックス環境にはNode.js自体が未導入のため未検証）。

```bash
npm install
npm run start --workspace apps/mobile
```

## 構成

- `App.tsx` — エントリーポイント
- `src/navigation/AppNavigator.tsx` — React Navigation構成（RootStack: Login/Home/IncomingCall、Home配下はBottomTab）
- `src/screens/` — 画面コンポーネント（各ファイル冒頭コメントに対応する設計書の章番号を記載）
- `src/theme/colors.ts` — ブランドカラー（`#66FFCC`）
- `@on-connect/shared` — web/infraと共有するドメイン型定義

## 未実装（TODO）

- AWS Amplify Auth（Cognito）でのログイン・セッション管理
- AppSync GraphQL クライアント（チャットのクエリ・ミューテーション・サブスクリプション接続）
- REST API（ユーザー／掲示板／リンク集／通話発信）のAPIクライアント実装
- プッシュ通知（`expo-notifications` によるデバイストークン登録、Amazon Pinpoint/SNSとの連携）
- Amazon Chime SDK for React Native を用いた音声通話の実装（着信時のバックグラウンド確実性向上のためのCallKit/ConnectionService対応は次フェーズ、docs/DESIGN.md 11章）
