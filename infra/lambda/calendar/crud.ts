import { randomUUID } from "node:crypto";
import type { APIGatewayProxyEvent, APIGatewayProxyHandler } from "aws-lambda";
import { DeleteCommand, GetCommand, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import type { CalendarCategory, CalendarEvent, User } from "@on-connect/shared";
// holidays.ts経由で@holiday-jp/holiday_jp（CJS、tree-shake不可）が芋づる式にバンドルされるのを避けるため、
// バレル(@on-connect/shared)ではなくics.tsを直接importする（このLambdaで唯一の実行時import）
import { buildIcsForEvent } from "@on-connect/shared/src/ics";
import { requirePermission } from "../common/authz";
import { docClient, isTableEmpty } from "../common/dynamo";
import {
  HttpError,
  getCurrentUserId,
  handleRequest,
  jsonResponse,
  parseJsonBody,
  rawResponse,
  requireParam,
} from "../common/http";
import { isVisibleToCategory } from "../common/visibility";

const CALENDAR_EVENTS_TABLE_NAME = process.env.CALENDAR_EVENTS_TABLE_NAME!;
const CALENDAR_CATEGORIES_TABLE_NAME = process.env.CALENDAR_CATEGORIES_TABLE_NAME!;
const USERS_TABLE_NAME = process.env.USERS_TABLE_NAME!;

/**
 * カレンダーCRUD（設計書5.4、Googleカレンダーとは同期しない独立DB管理）。
 * イベント自体は全メンバーが作成・編集・削除できる（バックエンドでの権限チェックは無く、
 * 誤操作防止の確認ダイアログはフロント側の責務）。表示カテゴリーの管理のみ権限で保護する。
 */
export const handler: APIGatewayProxyHandler = async (event) =>
  handleRequest(async () => {
    const { resource, httpMethod } = event;

    if (resource === "/calendar-events") {
      if (httpMethod === "GET") return listEvents(event);
      if (httpMethod === "POST") return createEvent(event);
    }
    if (resource === "/calendar-events/{eventId}") {
      const eventId = requireParam(event, "eventId");
      if (httpMethod === "GET") return getEvent(eventId, event);
      if (httpMethod === "PUT") return updateEvent(eventId, event);
      if (httpMethod === "DELETE") return deleteEvent(eventId);
    }
    if (resource === "/calendar-events/{eventId}/ical") {
      const eventId = requireParam(event, "eventId");
      if (httpMethod === "GET") return getEventIcal(eventId, event);
    }
    if (resource === "/calendar-categories") {
      if (httpMethod === "GET") return listCategories();
      if (httpMethod === "POST") return createCategory(event);
    }
    if (resource === "/calendar-categories/{categoryId}") {
      const categoryId = requireParam(event, "categoryId");
      if (httpMethod === "PUT") return updateCategory(categoryId, event);
      if (httpMethod === "DELETE") return deleteCategory(categoryId, event);
    }

    throw new HttpError(404, `対応していないルートです: ${httpMethod} ${resource}`);
  });

// ---------------------------------------------------------------------------
// CalendarEvents
// ---------------------------------------------------------------------------

async function listEvents(event: APIGatewayProxyEvent) {
  const memberCategoryId = await currentUserMemberCategoryId(event);
  const result = await docClient.send(new ScanCommand({ TableName: CALENDAR_EVENTS_TABLE_NAME }));
  const events = (result.Items as CalendarEvent[] | undefined) ?? [];
  const visible = events
    .filter((e) => isVisibleToCategory(e.visibleCategoryIds, memberCategoryId))
    .sort((a, b) => a.startAt.localeCompare(b.startAt));
  return jsonResponse(200, visible);
}

async function getEvent(eventId: string, event: APIGatewayProxyEvent) {
  const calendarEvent = await fetchEvent(eventId);
  if (!calendarEvent) throw new HttpError(404, "予定が見つかりません");

  const memberCategoryId = await currentUserMemberCategoryId(event);
  if (!isVisibleToCategory(calendarEvent.visibleCategoryIds, memberCategoryId)) {
    throw new HttpError(403, "この予定を閲覧する権限がありません");
  }
  return jsonResponse(200, calendarEvent);
}

async function getEventIcal(eventId: string, event: APIGatewayProxyEvent) {
  const calendarEvent = await fetchEvent(eventId);
  if (!calendarEvent) throw new HttpError(404, "予定が見つかりません");

  const memberCategoryId = await currentUserMemberCategoryId(event);
  if (!isVisibleToCategory(calendarEvent.visibleCategoryIds, memberCategoryId)) {
    throw new HttpError(403, "この予定を閲覧する権限がありません");
  }

  return rawResponse(200, "text/calendar; charset=utf-8", buildIcsForEvent(calendarEvent), {
    "Content-Disposition": `attachment; filename="event-${eventId}.ics"`,
  });
}

async function createEvent(event: APIGatewayProxyEvent) {
  const authorId = getCurrentUserId(event);
  const input = parseJsonBody<Pick<CalendarEvent, "title" | "startAt" | "endAt"> & Partial<CalendarEvent>>(
    event,
  );
  if (!input.title) throw new HttpError(400, "title は必須です");
  if (!input.startAt) throw new HttpError(400, "startAt は必須です");
  if (!input.endAt) throw new HttpError(400, "endAt は必須です");

  const now = new Date().toISOString();
  const calendarEvent: CalendarEvent = {
    eventId: randomUUID(),
    title: input.title,
    startAt: input.startAt,
    endAt: input.endAt,
    authorId,
    visibleCategoryIds: input.visibleCategoryIds ?? [],
    ...(input.description ? { description: input.description } : {}),
    ...(input.categoryId ? { categoryId: input.categoryId } : {}),
    createdAt: now,
    updatedAt: now,
  };

  await docClient.send(new PutCommand({ TableName: CALENDAR_EVENTS_TABLE_NAME, Item: calendarEvent }));
  return jsonResponse(201, calendarEvent);
}

async function updateEvent(eventId: string, event: APIGatewayProxyEvent) {
  const input = parseJsonBody<Partial<CalendarEvent>>(event);
  const current = await fetchEvent(eventId);
  if (!current) throw new HttpError(404, "予定が見つかりません");

  const updated: CalendarEvent = {
    ...current,
    ...input,
    eventId,
    updatedAt: new Date().toISOString(),
  };

  await docClient.send(new PutCommand({ TableName: CALENDAR_EVENTS_TABLE_NAME, Item: updated }));
  return jsonResponse(200, updated);
}

async function deleteEvent(eventId: string) {
  const current = await fetchEvent(eventId);
  if (!current) throw new HttpError(404, "予定が見つかりません");

  await docClient.send(new DeleteCommand({ TableName: CALENDAR_EVENTS_TABLE_NAME, Key: { eventId } }));
  return jsonResponse(204, {});
}

async function fetchEvent(eventId: string): Promise<CalendarEvent | undefined> {
  const result = await docClient.send(new GetCommand({ TableName: CALENDAR_EVENTS_TABLE_NAME, Key: { eventId } }));
  return result.Item as CalendarEvent | undefined;
}

async function currentUserMemberCategoryId(event: APIGatewayProxyEvent): Promise<string> {
  const userId = getCurrentUserId(event);
  const result = await docClient.send(new GetCommand({ TableName: USERS_TABLE_NAME, Key: { userId } }));
  const user = result.Item as User | undefined;
  if (!user) throw new HttpError(403, "ユーザー情報が見つかりません");
  return user.memberCategoryId;
}

// ---------------------------------------------------------------------------
// CalendarCategories（表示カテゴリー一覧。manageCalendarCategories権限を持つ人のみ変更可）
// ---------------------------------------------------------------------------

async function listCategories() {
  const result = await docClient.send(new ScanCommand({ TableName: CALENDAR_CATEGORIES_TABLE_NAME }));
  return jsonResponse(200, result.Items ?? []);
}

async function createCategory(event: APIGatewayProxyEvent) {
  // テーブルが空(=組織初期セットアップ前)の場合に限り、権限チェック無しで作成できる。
  if (!(await isTableEmpty(CALENDAR_CATEGORIES_TABLE_NAME))) {
    await requirePermission(event, "manageCalendarCategories", USERS_TABLE_NAME);
  }

  const input = parseJsonBody<Omit<CalendarCategory, "categoryId"> & { categoryId?: string }>(event);
  if (!input.name) throw new HttpError(400, "name は必須です");

  const categoryId = input.categoryId ?? randomUUID();
  const existing = await fetchCategory(categoryId);
  if (existing) throw new HttpError(409, "このcategoryIdは既に登録されています");

  const category: CalendarCategory = { categoryId, name: input.name };
  await docClient.send(new PutCommand({ TableName: CALENDAR_CATEGORIES_TABLE_NAME, Item: category }));
  return jsonResponse(201, category);
}

async function updateCategory(categoryId: string, event: APIGatewayProxyEvent) {
  await requirePermission(event, "manageCalendarCategories", USERS_TABLE_NAME);

  const input = parseJsonBody<Partial<CalendarCategory>>(event);
  const current = await fetchCategory(categoryId);
  if (!current) throw new HttpError(404, "カレンダーカテゴリーが見つかりません");

  const updated: CalendarCategory = { ...current, ...input, categoryId };
  await docClient.send(new PutCommand({ TableName: CALENDAR_CATEGORIES_TABLE_NAME, Item: updated }));
  return jsonResponse(200, updated);
}

async function deleteCategory(categoryId: string, event: APIGatewayProxyEvent) {
  await requirePermission(event, "manageCalendarCategories", USERS_TABLE_NAME);

  const current = await fetchCategory(categoryId);
  if (!current) throw new HttpError(404, "カレンダーカテゴリーが見つかりません");

  const eventsWithCategory = await docClient.send(
    new ScanCommand({
      TableName: CALENDAR_EVENTS_TABLE_NAME,
      FilterExpression: "categoryId = :categoryId",
      ExpressionAttributeValues: { ":categoryId": categoryId },
      ProjectionExpression: "eventId",
    }),
  );
  if ((eventsWithCategory.Items ?? []).length > 0) {
    throw new HttpError(409, "このカテゴリーは現在予定に使用されているため削除できません");
  }

  await docClient.send(new DeleteCommand({ TableName: CALENDAR_CATEGORIES_TABLE_NAME, Key: { categoryId } }));
  return jsonResponse(204, {});
}

async function fetchCategory(categoryId: string): Promise<CalendarCategory | undefined> {
  const result = await docClient.send(
    new GetCommand({ TableName: CALENDAR_CATEGORIES_TABLE_NAME, Key: { categoryId } }),
  );
  return result.Item as CalendarCategory | undefined;
}
