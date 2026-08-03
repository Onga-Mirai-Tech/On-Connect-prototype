import type { APIGatewayProxyHandler } from "aws-lambda";

/**
 * カレンダービュー（5.4）：Googleカレンダーの閲覧専用連携。
 *
 * 【基本方針】
 * 共有カレンダーの作成・編集はあくまでGoogleカレンダー側で行う。アプリ内は閲覧専用とし、
 * 「共有カレンダーはGoogleカレンダーで管理する」という運用を変えずに、メンバーがアプリを
 * 離れずに予定を確認できるようにして閲覧のハードルを下げることが目的。
 *
 * 【表示するカレンダーアカウントの設定方法】
 * 園ごとに「どのGoogleカレンダーを表示するか」は OrgSettings テーブルの
 * 1件（settingId: "googleCalendar"）に calendarId を保持し、管理者画面から
 * GET/PUT /calendar/config で設定・参照する（AdminPage「カレンダー連携設定」タブ）。
 *
 * 認証方式は、個々の職員がGoogleアカウントでログインするOAuth2.0の認可コードフローではなく、
 * サービスアカウント方式を推奨する（閲覧対象が「園の共有カレンダー」1つに限定されるため）。
 *   1. Google Cloudプロジェクトでサービスアカウントを作成し、秘密鍵をAWS Secrets Managerに保管
 *   2. 対象のGoogleカレンダー（園の共有カレンダー）の共有設定で、
 *      サービスアカウントのメールアドレスに「閲覧権限」を付与
 *   3. 管理者はこの画面でカレンダーID（例: xxxx@group.calendar.google.com、
 *      個人カレンダーの場合はそのGoogleアカウントのメールアドレス）を入力するだけでよく、
 *      メンバー一人ひとりがGoogleでサインインする必要はない。
 * このハンドラは GET /calendar/events からの呼び出しに応じてScheduleCacheの内容を返す想定。
 *
 * TODO: Secrets Managerからのサービスアカウント鍵取得、Google Calendar APIからの定期同期処理、
 *       GET/PUT /calendar/config（OrgSettingsテーブルの読み書き）を実装する。
 */
export const handler: APIGatewayProxyHandler = async () => {
  return {
    statusCode: 501,
    body: JSON.stringify({ message: "Not implemented yet" }),
  };
};
