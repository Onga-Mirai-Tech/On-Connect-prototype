process.env.CALENDAR_EVENTS_TABLE_NAME = "test-CalendarEvents";
process.env.CALENDAR_CATEGORIES_TABLE_NAME = "test-CalendarCategories";
process.env.USERS_TABLE_NAME = "test-Users";

import { mockClient } from "aws-sdk-client-mock";
import { DeleteCommand, DynamoDBDocumentClient, GetCommand, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import type { CalendarCategory, CalendarEvent, RolePermissions, User } from "@on-connect/shared";
import { handler } from "../../lambda/calendar/crud";

const ddbMock = mockClient(DynamoDBDocumentClient);

const noPermissions: RolePermissions = {
  manageUsers: false,
  sendForceNotify: false,
  manageBulletinCategories: false,
  manageOrgLinks: false,
  manageRoles: false,
  manageMemberCategories: false,
  manageCalendarCategories: false,
  manageShifts: false,
};

const calendarCategoryAdminPermissions: RolePermissions = { ...noPermissions, manageCalendarCategories: true };

const caller: User = {
  userId: "caller-1",
  displayName: "田中",
  furigana: "たなか",
  email: "tanaka@example.com",
  roleId: "role-member",
  memberCategoryId: "cat-parttime",
  notificationStatus: "ON",
  permissions: noPermissions,
};

function buildEvent(overrides: Partial<APIGatewayProxyEvent>): APIGatewayProxyEvent {
  return {
    resource: "/calendar-events",
    httpMethod: "GET",
    path: "/calendar-events",
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    headers: {},
    multiValueHeaders: {},
    body: null,
    isBase64Encoded: false,
    stageVariables: null,
    requestContext: { authorizer: { claims: { sub: "caller-1" } } } as never,
    ...overrides,
  } as APIGatewayProxyEvent;
}

async function invoke(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const result = await handler(event, {} as never, (() => {}) as never);
  return result as APIGatewayProxyResult;
}

beforeEach(() => {
  ddbMock.reset();
  ddbMock.on(GetCommand, { TableName: "test-Users", Key: { userId: "caller-1" } }).resolves({ Item: caller });
});

describe("CalendarEvents CRUD", () => {
  test("GET /calendar-events は閲覧権限のある予定だけ、開始日時の昇順で返す", async () => {
    const visible: CalendarEvent = {
      eventId: "e1",
      title: "全体公開の予定",
      startAt: "2026-08-10T09:00:00+09:00",
      endAt: "2026-08-10T10:00:00+09:00",
      visibleCategoryIds: [],
      authorId: "author-1",
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
    };
    const earlierVisible: CalendarEvent = {
      ...visible,
      eventId: "e2",
      title: "パート向けの予定",
      startAt: "2026-08-05T09:00:00+09:00",
      visibleCategoryIds: ["cat-parttime"],
    };
    const hidden: CalendarEvent = {
      ...visible,
      eventId: "e3",
      title: "正職員向けの予定",
      startAt: "2026-08-03T09:00:00+09:00",
      visibleCategoryIds: ["cat-fulltime"],
    };
    ddbMock.on(ScanCommand, { TableName: "test-CalendarEvents" }).resolves({ Items: [visible, earlierVisible, hidden] });

    const res = await invoke(buildEvent({ resource: "/calendar-events", httpMethod: "GET" }));

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as CalendarEvent[];
    expect(body.map((e) => e.eventId)).toEqual(["e2", "e1"]); // startAt昇順、非公開(e3)は除外
  });

  test("GET /calendar-events/{eventId} は閲覧権限がなければ403", async () => {
    const hidden: CalendarEvent = {
      eventId: "e3",
      title: "正職員向けの予定",
      startAt: "2026-08-03T09:00:00+09:00",
      endAt: "2026-08-03T10:00:00+09:00",
      visibleCategoryIds: ["cat-fulltime"],
      authorId: "author-1",
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
    };
    ddbMock.on(GetCommand, { TableName: "test-CalendarEvents", Key: { eventId: "e3" } }).resolves({ Item: hidden });

    const res = await invoke(
      buildEvent({ resource: "/calendar-events/{eventId}", httpMethod: "GET", pathParameters: { eventId: "e3" } }),
    );

    expect(res.statusCode).toBe(403);
  });

  test("POST /calendar-events は権限チェック無しで誰でも作成できる", async () => {
    ddbMock.on(PutCommand).resolves({});

    const res = await invoke(
      buildEvent({
        resource: "/calendar-events",
        httpMethod: "POST",
        body: JSON.stringify({
          title: "夏祭り",
          startAt: "2026-08-08T10:00:00+09:00",
          endAt: "2026-08-08T14:00:00+09:00",
        }),
      }),
    );

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body) as CalendarEvent;
    expect(body.title).toBe("夏祭り");
    expect(body.authorId).toBe("caller-1");
    expect(body.visibleCategoryIds).toEqual([]);
  });

  test("POST /calendar-events はtitle/startAt/endAt不足で400", async () => {
    const res = await invoke(
      buildEvent({ resource: "/calendar-events", httpMethod: "POST", body: JSON.stringify({ title: "予定" }) }),
    );

    expect(res.statusCode).toBe(400);
  });

  test("PUT /calendar-events/{eventId} は作成者以外でも権限チェック無しで更新できる", async () => {
    const existing: CalendarEvent = {
      eventId: "e1",
      title: "旧タイトル",
      startAt: "2026-08-10T09:00:00+09:00",
      endAt: "2026-08-10T10:00:00+09:00",
      visibleCategoryIds: [],
      authorId: "someone-else",
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
    };
    ddbMock.on(GetCommand, { TableName: "test-CalendarEvents", Key: { eventId: "e1" } }).resolves({ Item: existing });
    ddbMock.on(PutCommand).resolves({});

    const res = await invoke(
      buildEvent({
        resource: "/calendar-events/{eventId}",
        httpMethod: "PUT",
        pathParameters: { eventId: "e1" },
        body: JSON.stringify({ title: "新タイトル" }),
      }),
    );

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).title).toBe("新タイトル");
  });

  test("DELETE /calendar-events/{eventId} は作成者以外でも権限チェック無しで削除できる", async () => {
    ddbMock
      .on(GetCommand, { TableName: "test-CalendarEvents", Key: { eventId: "e1" } })
      .resolves({ Item: { eventId: "e1", authorId: "someone-else" } });
    ddbMock.on(DeleteCommand).resolves({});

    const res = await invoke(
      buildEvent({ resource: "/calendar-events/{eventId}", httpMethod: "DELETE", pathParameters: { eventId: "e1" } }),
    );

    expect(res.statusCode).toBe(204);
  });
});

describe("GET /calendar-events/{eventId}/ical", () => {
  const event: CalendarEvent = {
    eventId: "e1",
    title: "夏祭り",
    description: "園庭で開催します",
    startAt: "2026-08-08T10:00:00+09:00",
    endAt: "2026-08-08T14:00:00+09:00",
    visibleCategoryIds: [],
    authorId: "author-1",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
  };

  test("閲覧権限があればtext/calendar形式で.icsを返す", async () => {
    ddbMock.on(GetCommand, { TableName: "test-CalendarEvents", Key: { eventId: "e1" } }).resolves({ Item: event });

    const res = await invoke(
      buildEvent({
        resource: "/calendar-events/{eventId}/ical",
        httpMethod: "GET",
        pathParameters: { eventId: "e1" },
      }),
    );

    expect(res.statusCode).toBe(200);
    expect(res.headers?.["Content-Type"]).toBe("text/calendar; charset=utf-8");
    expect(res.headers?.["Content-Disposition"]).toBe('attachment; filename="event-e1.ics"');
    expect(res.body).toContain("BEGIN:VCALENDAR");
    expect(res.body).toContain("SUMMARY:夏祭り");
    expect(res.body).toContain("UID:e1@on-connect.app");
  });

  test("閲覧権限が無ければ403", async () => {
    const hidden: CalendarEvent = { ...event, visibleCategoryIds: ["cat-fulltime"] };
    ddbMock.on(GetCommand, { TableName: "test-CalendarEvents", Key: { eventId: "e1" } }).resolves({ Item: hidden });

    const res = await invoke(
      buildEvent({
        resource: "/calendar-events/{eventId}/ical",
        httpMethod: "GET",
        pathParameters: { eventId: "e1" },
      }),
    );

    expect(res.statusCode).toBe(403);
  });

  test("予定が存在しなければ404", async () => {
    ddbMock.on(GetCommand, { TableName: "test-CalendarEvents", Key: { eventId: "e404" } }).resolves({});

    const res = await invoke(
      buildEvent({
        resource: "/calendar-events/{eventId}/ical",
        httpMethod: "GET",
        pathParameters: { eventId: "e404" },
      }),
    );

    expect(res.statusCode).toBe(404);
  });
});

describe("CalendarCategories CRUD", () => {
  test("GET /calendar-categories は権限チェック無しで一覧を返す", async () => {
    const categories: CalendarCategory[] = [{ categoryId: "cc-1", name: "会議" }];
    ddbMock.on(ScanCommand, { TableName: "test-CalendarCategories" }).resolves({ Items: categories });

    const res = await invoke(buildEvent({ resource: "/calendar-categories", httpMethod: "GET" }));

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual(categories);
  });

  test("POST /calendar-categories はテーブルが空でなければmanageCalendarCategories権限が無いと403", async () => {
    ddbMock.on(ScanCommand, { TableName: "test-CalendarCategories" }).resolves({ Items: [{ categoryId: "cc-1" }] });

    const res = await invoke(
      buildEvent({ resource: "/calendar-categories", httpMethod: "POST", body: JSON.stringify({ name: "行事" }) }),
    );

    expect(res.statusCode).toBe(403);
  });

  test("POST /calendar-categories はmanageCalendarCategories権限があれば作成できる", async () => {
    ddbMock
      .on(GetCommand, { TableName: "test-Users", Key: { userId: "caller-1" } })
      .resolves({ Item: { ...caller, permissions: calendarCategoryAdminPermissions } });
    ddbMock.on(ScanCommand, { TableName: "test-CalendarCategories" }).resolves({ Items: [{ categoryId: "cc-1" }] });
    ddbMock.on(GetCommand, { TableName: "test-CalendarCategories" }).resolves({});
    ddbMock.on(PutCommand).resolves({});

    const res = await invoke(
      buildEvent({ resource: "/calendar-categories", httpMethod: "POST", body: JSON.stringify({ name: "行事" }) }),
    );

    expect(res.statusCode).toBe(201);
  });

  test("DELETE /calendar-categories/{categoryId} は予定に使用中の場合409", async () => {
    ddbMock
      .on(GetCommand, { TableName: "test-Users", Key: { userId: "caller-1" } })
      .resolves({ Item: { ...caller, permissions: calendarCategoryAdminPermissions } });
    ddbMock
      .on(GetCommand, { TableName: "test-CalendarCategories", Key: { categoryId: "cc-1" } })
      .resolves({ Item: { categoryId: "cc-1", name: "会議" } });
    ddbMock
      .on(ScanCommand, { TableName: "test-CalendarEvents", FilterExpression: "categoryId = :categoryId" })
      .resolves({ Items: [{ eventId: "e1" }] });

    const res = await invoke(
      buildEvent({
        resource: "/calendar-categories/{categoryId}",
        httpMethod: "DELETE",
        pathParameters: { categoryId: "cc-1" },
      }),
    );

    expect(res.statusCode).toBe(409);
  });

  test("DELETE /calendar-categories/{categoryId} は未使用なら削除できる", async () => {
    ddbMock
      .on(GetCommand, { TableName: "test-Users", Key: { userId: "caller-1" } })
      .resolves({ Item: { ...caller, permissions: calendarCategoryAdminPermissions } });
    ddbMock
      .on(GetCommand, { TableName: "test-CalendarCategories", Key: { categoryId: "cc-1" } })
      .resolves({ Item: { categoryId: "cc-1", name: "会議" } });
    ddbMock
      .on(ScanCommand, { TableName: "test-CalendarEvents", FilterExpression: "categoryId = :categoryId" })
      .resolves({ Items: [] });
    ddbMock.on(DeleteCommand).resolves({});

    const res = await invoke(
      buildEvent({
        resource: "/calendar-categories/{categoryId}",
        httpMethod: "DELETE",
        pathParameters: { categoryId: "cc-1" },
      }),
    );

    expect(res.statusCode).toBe(204);
  });
});

test("未定義ルートは404", async () => {
  const res = await invoke(buildEvent({ resource: "/unknown", httpMethod: "GET" }));
  expect(res.statusCode).toBe(404);
});
