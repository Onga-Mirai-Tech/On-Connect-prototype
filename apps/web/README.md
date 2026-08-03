# apps/web — On-Connect Web

Vite + React + TypeScript によるWeb（Chrome想定）クライアントの雛形。
[docs/DESIGN.md](../../docs/DESIGN.md) 7章「画面構成」に沿ったページを `src/pages/` に配置している。

## セットアップ

```bash
npm install
npm run dev --workspace apps/web
```

`http://localhost:5173` で起動する。

## 構成

- `src/router.tsx` — 画面遷移定義（ログイン／ホーム配下のタブ構成）
- `src/pages/` — 画面コンポーネント（各ファイル冒頭コメントに対応する設計書の章番号を記載）
- `src/theme/colors.ts` — ブランドカラー（`#66FFCC`）
- `@on-connect/shared` — mobile/infraと共有するドメイン型定義

## 未実装（TODO）

- Amazon Cognito 認証（`amazon-cognito-identity-js` または `aws-amplify` の導入）
- AppSync GraphQL クライアント（チャットのクエリ・ミューテーション・サブスクリプション接続）
- REST API（ユーザー／掲示板／リンク集／通話発信）のAPIクライアント実装
- Amazon Chime SDK for JavaScript を用いた音声通話UIの実装
