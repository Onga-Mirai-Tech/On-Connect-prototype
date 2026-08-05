process.env.DUTY_TYPES_TABLE_NAME = "test-DutyTypes";
process.env.SHIFT_TYPES_TABLE_NAME = "test-ShiftTypes";
process.env.MEMBER_DAILY_STATUS_TABLE_NAME = "test-MemberDailyStatus";
process.env.USERS_TABLE_NAME = "test-Users";

import { mockClient } from "aws-sdk-client-mock";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import type { DutyType, MemberDailyStatus, RolePermissions, ShiftType, User } from "@on-connect/shared";
import { handler } from "../../lambda/shifts/crud";

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

const shiftAdminPermissions: RolePermissions = { ...noPermissions, manageShifts: true };

const memberCaller: User = {
  userId: "caller-1",
  displayName: "田中",
  furigana: "たなか",
  email: "tanaka@example.com",
  roleId: "role-member",
  memberCategoryId: "cat-1",
  notificationStatus: "ON",
  permissions: noPermissions,
};

function mockCallerAsMember() {
  ddbMock.on(GetCommand, { TableName: "test-Users", Key: { userId: "caller-1" } }).resolves({ Item: memberCaller });
}
function mockCallerAsShiftAdmin() {
  ddbMock
    .on(GetCommand, { TableName: "test-Users", Key: { userId: "caller-1" } })
    .resolves({ Item: { ...memberCaller, permissions: shiftAdminPermissions } });
}

function buildEvent(overrides: Partial<APIGatewayProxyEvent>): APIGatewayProxyEvent {
  return {
    resource: "/member-daily-status",
    httpMethod: "GET",
    path: "/member-daily-status",
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
});

describe("DutyTypes CRUD", () => {
  test("GET /duty-types は権限チェック無しで一覧を返す", async () => {
    const items: DutyType[] = [{ dutyTypeId: "d1", name: "早出", isActive: true }];
    ddbMock.on(ScanCommand, { TableName: "test-DutyTypes" }).resolves({ Items: items });

    const res = await invoke(buildEvent({ resource: "/duty-types", httpMethod: "GET" }));

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual(items);
  });

  test("POST /duty-types はmanageShifts権限が無いと403", async () => {
    mockCallerAsMember();

    const res = await invoke(
      buildEvent({ resource: "/duty-types", httpMethod: "POST", body: JSON.stringify({ name: "日直" }) }),
    );

    expect(res.statusCode).toBe(403);
  });

  test("POST /duty-types はmanageShifts権限があれば作成できる（isActive未指定はtrue）", async () => {
    mockCallerAsShiftAdmin();
    ddbMock.on(PutCommand).resolves({});

    const res = await invoke(
      buildEvent({ resource: "/duty-types", httpMethod: "POST", body: JSON.stringify({ name: "日直" }) }),
    );

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body) as DutyType;
    expect(body.name).toBe("日直");
    expect(body.isActive).toBe(true);
  });

  test("DELETE /duty-types/{id} はmanageShifts権限が無いと403", async () => {
    mockCallerAsMember();

    const res = await invoke(
      buildEvent({ resource: "/duty-types/{dutyTypeId}", httpMethod: "DELETE", pathParameters: { dutyTypeId: "d1" } }),
    );

    expect(res.statusCode).toBe(403);
  });
});

describe("ShiftTypes CRUD", () => {
  test("PUT /shift-types/{id} はmanageShifts権限があれば更新できる", async () => {
    mockCallerAsShiftAdmin();
    ddbMock
      .on(GetCommand, { TableName: "test-ShiftTypes", Key: { shiftTypeId: "s1" } })
      .resolves({ Item: { shiftTypeId: "s1", name: "早番", isActive: true } as ShiftType });
    ddbMock.on(PutCommand).resolves({});

    const res = await invoke(
      buildEvent({
        resource: "/shift-types/{shiftTypeId}",
        httpMethod: "PUT",
        pathParameters: { shiftTypeId: "s1" },
        body: JSON.stringify({ isActive: false }),
      }),
    );

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).isActive).toBe(false);
  });
});

describe("MemberDailyStatus", () => {
  test("GET /member-daily-status はdateクエリで一覧を返す", async () => {
    const items: MemberDailyStatus[] = [
      { date: "2026-08-05", userId: "u1", leaveType: "FULL", updatedAt: "x", updatedBy: "admin" },
    ];
    ddbMock.on(QueryCommand, { TableName: "test-MemberDailyStatus" }).resolves({ Items: items });

    const res = await invoke(
      buildEvent({
        resource: "/member-daily-status",
        httpMethod: "GET",
        queryStringParameters: { date: "2026-08-05" },
      }),
    );

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual(items);
  });

  test("GET /member-daily-status はdateクエリが無いと400", async () => {
    const res = await invoke(buildEvent({ resource: "/member-daily-status", httpMethod: "GET" }));
    expect(res.statusCode).toBe(400);
  });

  test("GET /member-daily-status/{date}/{userId} はレコードが無ければ空オブジェクトを返す(404にしない)", async () => {
    ddbMock.on(GetCommand, { TableName: "test-MemberDailyStatus" }).resolves({});

    const res = await invoke(
      buildEvent({
        resource: "/member-daily-status/{date}/{userId}",
        httpMethod: "GET",
        pathParameters: { date: "2026-08-05", userId: "u1" },
      }),
    );

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ date: "2026-08-05", userId: "u1" });
  });

  test("PUT /member-daily-status/{date}/{userId} はmanageShifts権限が無いと403（本人分でも自己申告不可）", async () => {
    mockCallerAsMember();

    const res = await invoke(
      buildEvent({
        resource: "/member-daily-status/{date}/{userId}",
        httpMethod: "PUT",
        pathParameters: { date: "2026-08-05", userId: "caller-1" },
        body: JSON.stringify({ leaveType: "FULL" }),
      }),
    );

    expect(res.statusCode).toBe(403);
  });

  test("PUT /member-daily-status/{date}/{userId} はmanageShifts権限があれば新規作成できる", async () => {
    mockCallerAsShiftAdmin();
    ddbMock.on(GetCommand, { TableName: "test-MemberDailyStatus" }).resolves({});
    ddbMock.on(PutCommand).resolves({});

    const res = await invoke(
      buildEvent({
        resource: "/member-daily-status/{date}/{userId}",
        httpMethod: "PUT",
        pathParameters: { date: "2026-08-05", userId: "u2" },
        body: JSON.stringify({ leaveType: "PM", leaveReason: "REQUESTED", amShiftTypeId: "shift-early" }),
      }),
    );

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as MemberDailyStatus;
    expect(body.leaveType).toBe("PM");
    expect(body.leaveReason).toBe("REQUESTED");
    expect(body.amShiftTypeId).toBe("shift-early");
    expect(body.updatedBy).toBe("caller-1");
  });

  test("PUT は未指定フィールドを現状維持し、nullを指定したフィールドだけクリアする", async () => {
    mockCallerAsShiftAdmin();
    const existing: MemberDailyStatus = {
      date: "2026-08-05",
      userId: "u2",
      leaveType: "PM",
      leaveReason: "REQUESTED",
      amShiftTypeId: "shift-early",
      dutyTypeIds: ["duty-nitchoku"],
      updatedAt: "2026-08-01T00:00:00.000Z",
      updatedBy: "user-01",
    };
    ddbMock.on(GetCommand, { TableName: "test-MemberDailyStatus" }).resolves({ Item: existing });
    ddbMock.on(PutCommand).resolves({});

    const res = await invoke(
      buildEvent({
        resource: "/member-daily-status/{date}/{userId}",
        httpMethod: "PUT",
        pathParameters: { date: "2026-08-05", userId: "u2" },
        body: JSON.stringify({ leaveType: null }), // 休みをクリア、他のフィールドは維持
      }),
    );

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as MemberDailyStatus;
    expect(body.leaveType).toBeUndefined();
    expect(body.amShiftTypeId).toBe("shift-early"); // 維持される
    expect(body.dutyTypeIds).toEqual(["duty-nitchoku"]); // 維持される
  });

  test("DELETE /member-daily-status/{date}/{userId} はmanageShifts権限が無いと403", async () => {
    mockCallerAsMember();

    const res = await invoke(
      buildEvent({
        resource: "/member-daily-status/{date}/{userId}",
        httpMethod: "DELETE",
        pathParameters: { date: "2026-08-05", userId: "u2" },
      }),
    );

    expect(res.statusCode).toBe(403);
  });

  test("DELETE /member-daily-status/{date}/{userId} はmanageShifts権限があれば削除できる", async () => {
    mockCallerAsShiftAdmin();
    ddbMock.on(DeleteCommand).resolves({});

    const res = await invoke(
      buildEvent({
        resource: "/member-daily-status/{date}/{userId}",
        httpMethod: "DELETE",
        pathParameters: { date: "2026-08-05", userId: "u2" },
      }),
    );

    expect(res.statusCode).toBe(204);
  });
});

test("未定義ルートは404", async () => {
  const res = await invoke(buildEvent({ resource: "/unknown", httpMethod: "GET" }));
  expect(res.statusCode).toBe(404);
});
