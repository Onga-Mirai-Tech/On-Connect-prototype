process.env.USERS_TABLE_NAME = "test-Users";
process.env.ROLES_TABLE_NAME = "test-Roles";
process.env.MEMBER_CATEGORIES_TABLE_NAME = "test-MemberCategories";

import { mockClient } from "aws-sdk-client-mock";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import type { MemberCategory, Role, User } from "@on-connect/shared";
import { handler } from "../../lambda/users/index";

const ddbMock = mockClient(DynamoDBDocumentClient);

const adminRole: Role = {
  roleId: "role-admin",
  name: "管理者",
  permissions: {
    manageUsers: true,
    sendForceNotify: true,
    manageBulletinCategories: true,
    manageOrgLinks: true,
    manageRoles: true,
    manageMemberCategories: true,
  },
};

const memberRole: Role = {
  roleId: "role-member",
  name: "一般メンバー",
  permissions: {
    manageUsers: false,
    sendForceNotify: false,
    manageBulletinCategories: false,
    manageOrgLinks: false,
    manageRoles: false,
    manageMemberCategories: false,
  },
};

// デフォルトの呼び出し元(sub: "caller-1")を管理者/一般メンバーとして扱いたい場合のダミーユーザー
const adminCallerUser: User = {
  userId: "caller-1",
  displayName: "呼び出し管理者",
  furigana: "よびだしかんりしゃ",
  email: "admin-caller@example.com",
  roleId: "role-admin",
  memberCategoryId: "cat-1",
  notificationStatus: "ON",
};

const memberCallerUser: User = {
  ...adminCallerUser,
  displayName: "呼び出し一般メンバー",
  roleId: "role-member",
};

/** 呼び出し元(caller-1)がmanageUsers/manageRoles/manageMemberCategoriesを全て持つ管理者であるようにモックする */
function mockCallerAsAdmin() {
  ddbMock.on(GetCommand, { TableName: "test-Users", Key: { userId: "caller-1" } }).resolves({ Item: adminCallerUser });
  ddbMock.on(GetCommand, { TableName: "test-Roles", Key: { roleId: "role-admin" } }).resolves({ Item: adminRole });
}

/** 呼び出し元(caller-1)が何の管理権限も持たない一般メンバーであるようにモックする */
function mockCallerAsMember() {
  ddbMock
    .on(GetCommand, { TableName: "test-Users", Key: { userId: "caller-1" } })
    .resolves({ Item: memberCallerUser });
  ddbMock.on(GetCommand, { TableName: "test-Roles", Key: { roleId: "role-member" } }).resolves({ Item: memberRole });
}

function buildEvent(overrides: Partial<APIGatewayProxyEvent>): APIGatewayProxyEvent {
  return {
    resource: "/users",
    httpMethod: "GET",
    path: "/users",
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

function asUser(sub: string, overrides: Partial<APIGatewayProxyEvent> = {}): Partial<APIGatewayProxyEvent> {
  return { requestContext: { authorizer: { claims: { sub } } } as never, ...overrides };
}

async function invoke(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const result = await handler(event, {} as never, (() => {}) as never);
  return result as APIGatewayProxyResult;
}

beforeEach(() => {
  ddbMock.reset();
});

describe("Users CRUD", () => {
  test("GET /users は一覧を返す（権限チェック無し）", async () => {
    const users: User[] = [
      {
        userId: "u1",
        displayName: "田中",
        furigana: "たなか",
        email: "tanaka@example.com",
        roleId: "role-member",
        memberCategoryId: "cat-1",
        notificationStatus: "ON",
      },
    ];
    ddbMock.on(ScanCommand, { TableName: "test-Users" }).resolves({ Items: users });

    const res = await invoke(buildEvent({ resource: "/users", httpMethod: "GET" }));

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual(users);
  });

  test("POST /users はUsersテーブルが空なら権限チェック無しで作成できる（初期セットアップ）", async () => {
    ddbMock.on(ScanCommand, { TableName: "test-Users" }).resolves({ Items: [] }); // isTableEmpty -> true
    ddbMock.on(GetCommand, { TableName: "test-Users" }).resolves({});
    ddbMock.on(PutCommand).resolves({});

    const input: User = {
      userId: "u2",
      displayName: "佐藤",
      furigana: "さとう",
      email: "sato@example.com",
      roleId: "role-member",
      memberCategoryId: "cat-1",
      notificationStatus: "ON",
    };
    const res = await invoke(
      buildEvent({ resource: "/users", httpMethod: "POST", body: JSON.stringify(input) }),
    );

    expect(res.statusCode).toBe(201);
    expect(JSON.parse(res.body)).toMatchObject(input);
  });

  test("POST /users はUsersテーブルが空でなければmanageUsers権限が無いと403", async () => {
    ddbMock.on(ScanCommand, { TableName: "test-Users" }).resolves({ Items: [memberCallerUser] });
    mockCallerAsMember();

    const res = await invoke(
      buildEvent({
        resource: "/users",
        httpMethod: "POST",
        body: JSON.stringify({
          userId: "u2",
          displayName: "佐藤",
          furigana: "さとう",
          email: "sato@example.com",
          roleId: "role-member",
          memberCategoryId: "cat-1",
        }),
      }),
    );

    expect(res.statusCode).toBe(403);
  });

  test("POST /users はmanageUsers権限があれば作成できる", async () => {
    ddbMock.on(ScanCommand, { TableName: "test-Users" }).resolves({ Items: [adminCallerUser] });
    mockCallerAsAdmin();
    ddbMock.on(GetCommand, { TableName: "test-Users", Key: { userId: "u2" } }).resolves({});
    ddbMock.on(PutCommand).resolves({});

    const res = await invoke(
      buildEvent({
        resource: "/users",
        httpMethod: "POST",
        body: JSON.stringify({
          userId: "u2",
          displayName: "佐藤",
          furigana: "さとう",
          email: "sato@example.com",
          roleId: "role-member",
          memberCategoryId: "cat-1",
        }),
      }),
    );

    expect(res.statusCode).toBe(201);
  });

  test("POST /users はuserId重複時に409を返す", async () => {
    ddbMock.on(ScanCommand, { TableName: "test-Users" }).resolves({ Items: [] }); // 初期セットアップ扱いで権限チェックを回避
    ddbMock.on(GetCommand, { TableName: "test-Users" }).resolves({ Item: { userId: "u2" } });

    const res = await invoke(
      buildEvent({
        resource: "/users",
        httpMethod: "POST",
        body: JSON.stringify({
          userId: "u2",
          displayName: "佐藤",
          furigana: "さとう",
          email: "sato@example.com",
          roleId: "role-member",
          memberCategoryId: "cat-1",
        }),
      }),
    );

    expect(res.statusCode).toBe(409);
  });

  test("PUT /users/{userId} は本人が自分のnotificationStatusだけ変更する場合は権限チェック無しで成功する", async () => {
    const self: User = {
      userId: "u5",
      displayName: "自分",
      furigana: "じぶん",
      email: "self@example.com",
      roleId: "role-member",
      memberCategoryId: "cat-1",
      notificationStatus: "ON",
    };
    ddbMock.on(GetCommand, { TableName: "test-Users", Key: { userId: "u5" } }).resolves({ Item: self });
    ddbMock.on(PutCommand).resolves({});

    const res = await invoke(
      buildEvent({
        resource: "/users/{userId}",
        httpMethod: "PUT",
        pathParameters: { userId: "u5" },
        body: JSON.stringify({ notificationStatus: "OFF" }),
        ...asUser("u5"),
      }),
    );

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).notificationStatus).toBe("OFF");
  });

  test("PUT /users/{userId} は本人でもnotificationStatus以外を変更するにはmanageUsers権限が必要", async () => {
    const self: User = {
      userId: "u5",
      displayName: "自分",
      furigana: "じぶん",
      email: "self@example.com",
      roleId: "role-member",
      memberCategoryId: "cat-1",
      notificationStatus: "ON",
    };
    ddbMock.on(GetCommand, { TableName: "test-Users", Key: { userId: "u5" } }).resolves({ Item: self });
    ddbMock.on(GetCommand, { TableName: "test-Roles", Key: { roleId: "role-member" } }).resolves({ Item: memberRole });

    const res = await invoke(
      buildEvent({
        resource: "/users/{userId}",
        httpMethod: "PUT",
        pathParameters: { userId: "u5" },
        body: JSON.stringify({ displayName: "新しい名前" }),
        ...asUser("u5"),
      }),
    );

    expect(res.statusCode).toBe(403);
  });

  test("PUT /users/{userId} は他人の情報をmanageUsers権限無しで変更しようとすると403", async () => {
    const target: User = {
      userId: "u6",
      displayName: "他人",
      furigana: "たにん",
      email: "other@example.com",
      roleId: "role-member",
      memberCategoryId: "cat-1",
      notificationStatus: "ON",
    };
    ddbMock.on(GetCommand, { TableName: "test-Users", Key: { userId: "u6" } }).resolves({ Item: target });
    mockCallerAsMember();

    const res = await invoke(
      buildEvent({
        resource: "/users/{userId}",
        httpMethod: "PUT",
        pathParameters: { userId: "u6" },
        body: JSON.stringify({ displayName: "改ざん" }),
      }),
    );

    expect(res.statusCode).toBe(403);
  });

  test("PUT /users/{userId} で最後の管理者(本人)を一般ロールへ降格しようとすると409", async () => {
    const adminUser: User = {
      userId: "u1",
      displayName: "園長",
      furigana: "えんちょう",
      email: "encho@example.com",
      roleId: "role-admin",
      memberCategoryId: "cat-1",
      notificationStatus: "ON",
    };
    ddbMock.on(GetCommand, { TableName: "test-Users", Key: { userId: "u1" } }).resolves({ Item: adminUser });
    ddbMock.on(GetCommand, { TableName: "test-Roles", Key: { roleId: "role-admin" } }).resolves({ Item: adminRole });
    ddbMock.on(GetCommand, { TableName: "test-Roles", Key: { roleId: "role-member" } }).resolves({ Item: memberRole });
    ddbMock.on(ScanCommand, { TableName: "test-Roles" }).resolves({ Items: [adminRole, memberRole] });
    // ユーザーは自分1人だけ（=自分が最後の管理者）
    ddbMock.on(ScanCommand, { TableName: "test-Users" }).resolves({ Items: [adminUser] });

    const res = await invoke(
      buildEvent({
        resource: "/users/{userId}",
        httpMethod: "PUT",
        pathParameters: { userId: "u1" },
        body: JSON.stringify({ roleId: "role-member" }),
        ...asUser("u1"), // 本人(管理者)が自分自身を降格しようとするケース
      }),
    );

    expect(res.statusCode).toBe(409);
  });

  test("PUT /users/{userId} で他に管理者がいれば降格できる", async () => {
    const adminUser1: User = {
      userId: "u1",
      displayName: "園長",
      furigana: "えんちょう",
      email: "encho@example.com",
      roleId: "role-admin",
      memberCategoryId: "cat-1",
      notificationStatus: "ON",
    };
    const adminUser2: User = { ...adminUser1, userId: "u2", displayName: "主任" };

    ddbMock.on(GetCommand, { TableName: "test-Users", Key: { userId: "u1" } }).resolves({ Item: adminUser1 });
    ddbMock.on(GetCommand, { TableName: "test-Roles", Key: { roleId: "role-admin" } }).resolves({ Item: adminRole });
    ddbMock.on(GetCommand, { TableName: "test-Roles", Key: { roleId: "role-member" } }).resolves({ Item: memberRole });
    ddbMock.on(ScanCommand, { TableName: "test-Roles" }).resolves({ Items: [adminRole, memberRole] });
    ddbMock.on(ScanCommand, { TableName: "test-Users" }).resolves({ Items: [adminUser1, adminUser2] });
    ddbMock.on(PutCommand).resolves({});

    const res = await invoke(
      buildEvent({
        resource: "/users/{userId}",
        httpMethod: "PUT",
        pathParameters: { userId: "u1" },
        body: JSON.stringify({ roleId: "role-member" }),
        ...asUser("u1"),
      }),
    );

    expect(res.statusCode).toBe(200);
  });

  test("DELETE /users/{userId} はmanageUsers権限が無いと403", async () => {
    mockCallerAsMember();

    const res = await invoke(
      buildEvent({ resource: "/users/{userId}", httpMethod: "DELETE", pathParameters: { userId: "u3" } }),
    );

    expect(res.statusCode).toBe(403);
  });

  test("DELETE /users/{userId} は最後の管理者(本人)を削除できない", async () => {
    const adminUser: User = {
      userId: "u1",
      displayName: "園長",
      furigana: "えんちょう",
      email: "encho@example.com",
      roleId: "role-admin",
      memberCategoryId: "cat-1",
      notificationStatus: "ON",
    };
    ddbMock.on(GetCommand, { TableName: "test-Users", Key: { userId: "u1" } }).resolves({ Item: adminUser });
    ddbMock.on(GetCommand, { TableName: "test-Roles", Key: { roleId: "role-admin" } }).resolves({ Item: adminRole });
    ddbMock.on(ScanCommand, { TableName: "test-Roles" }).resolves({ Items: [adminRole, memberRole] });
    ddbMock.on(ScanCommand, { TableName: "test-Users" }).resolves({ Items: [adminUser] });

    const res = await invoke(
      buildEvent({
        resource: "/users/{userId}",
        httpMethod: "DELETE",
        pathParameters: { userId: "u1" },
        ...asUser("u1"),
      }),
    );

    expect(res.statusCode).toBe(409);
  });

  test("DELETE /users/{userId} はmanageUsers権限を持つ別の管理者なら一般メンバーを削除できる", async () => {
    const memberUser: User = {
      userId: "u3",
      displayName: "一般",
      furigana: "いっぱん",
      email: "member@example.com",
      roleId: "role-member",
      memberCategoryId: "cat-1",
      notificationStatus: "ON",
    };
    mockCallerAsAdmin();
    ddbMock.on(GetCommand, { TableName: "test-Users", Key: { userId: "u3" } }).resolves({ Item: memberUser });
    ddbMock.on(GetCommand, { TableName: "test-Roles", Key: { roleId: "role-member" } }).resolves({ Item: memberRole });
    ddbMock.on(DeleteCommand).resolves({});

    const res = await invoke(
      buildEvent({ resource: "/users/{userId}", httpMethod: "DELETE", pathParameters: { userId: "u3" } }),
    );

    expect(res.statusCode).toBe(204);
  });

  test("存在しないユーザーのGETは404", async () => {
    ddbMock.on(GetCommand, { TableName: "test-Users" }).resolves({});

    const res = await invoke(
      buildEvent({ resource: "/users/{userId}", httpMethod: "GET", pathParameters: { userId: "unknown" } }),
    );

    expect(res.statusCode).toBe(404);
  });
});

describe("Roles CRUD", () => {
  test("POST /roles はRolesテーブルが空なら権限チェック無しで作成できる（初期セットアップ）", async () => {
    ddbMock.on(ScanCommand, { TableName: "test-Roles" }).resolves({ Items: [] });
    ddbMock.on(GetCommand, { TableName: "test-Roles" }).resolves({});
    ddbMock.on(PutCommand).resolves({});

    const res = await invoke(
      buildEvent({
        resource: "/roles",
        httpMethod: "POST",
        body: JSON.stringify({ name: "事務職員", permissions: memberRole.permissions }),
      }),
    );

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body) as Role;
    expect(body.name).toBe("事務職員");
    expect(typeof body.roleId).toBe("string");
  });

  test("POST /roles はRolesテーブルが空でなければmanageRoles権限が無いと403", async () => {
    ddbMock.on(ScanCommand, { TableName: "test-Roles" }).resolves({ Items: [adminRole] });
    mockCallerAsMember();

    const res = await invoke(
      buildEvent({
        resource: "/roles",
        httpMethod: "POST",
        body: JSON.stringify({ name: "事務職員", permissions: memberRole.permissions }),
      }),
    );

    expect(res.statusCode).toBe(403);
  });

  test("PUT /roles/{roleId} はmanageRoles権限が無いと403", async () => {
    mockCallerAsMember();

    const res = await invoke(
      buildEvent({
        resource: "/roles/{roleId}",
        httpMethod: "PUT",
        pathParameters: { roleId: "role-member" },
        body: JSON.stringify({ name: "改名" }),
      }),
    );

    expect(res.statusCode).toBe(403);
  });

  test("PUT /roles/{roleId} で唯一の管理者ロールからmanageUsersを外すと409", async () => {
    ddbMock.on(GetCommand, { TableName: "test-Users", Key: { userId: "caller-1" } }).resolves({ Item: adminCallerUser });
    ddbMock.on(GetCommand, { TableName: "test-Roles", Key: { roleId: "role-admin" } }).resolves({ Item: adminRole });
    // adminRoleを除外すると管理者ロールが無い(=他に管理者がいない)状態
    ddbMock.on(ScanCommand, { TableName: "test-Roles" }).resolves({ Items: [adminRole, memberRole] });

    const res = await invoke(
      buildEvent({
        resource: "/roles/{roleId}",
        httpMethod: "PUT",
        pathParameters: { roleId: "role-admin" },
        body: JSON.stringify({ permissions: { ...adminRole.permissions, manageUsers: false } }),
      }),
    );

    expect(res.statusCode).toBe(409);
  });

  test("PUT /roles/{roleId} は他に管理者ロールがあればmanageUsersを外せる", async () => {
    const secondAdminRole: Role = { ...adminRole, roleId: "role-admin-2" };
    const secondAdminUser: User = {
      userId: "u9",
      displayName: "副管理者",
      furigana: "ふくかんりしゃ",
      email: "vice@example.com",
      roleId: "role-admin-2",
      memberCategoryId: "cat-1",
      notificationStatus: "ON",
    };
    ddbMock.on(GetCommand, { TableName: "test-Users", Key: { userId: "caller-1" } }).resolves({ Item: adminCallerUser });
    ddbMock.on(GetCommand, { TableName: "test-Roles", Key: { roleId: "role-admin" } }).resolves({ Item: adminRole });
    ddbMock.on(ScanCommand, { TableName: "test-Roles" }).resolves({ Items: [adminRole, secondAdminRole, memberRole] });
    ddbMock.on(ScanCommand, { TableName: "test-Users" }).resolves({ Items: [secondAdminUser] });
    ddbMock.on(PutCommand).resolves({});

    const res = await invoke(
      buildEvent({
        resource: "/roles/{roleId}",
        httpMethod: "PUT",
        pathParameters: { roleId: "role-admin" },
        body: JSON.stringify({ permissions: { ...adminRole.permissions, manageUsers: false } }),
      }),
    );

    expect(res.statusCode).toBe(200);
  });

  test("DELETE /roles/{roleId} はmanageRoles権限が無いと403", async () => {
    mockCallerAsMember();

    const res = await invoke(
      buildEvent({ resource: "/roles/{roleId}", httpMethod: "DELETE", pathParameters: { roleId: "role-member" } }),
    );

    expect(res.statusCode).toBe(403);
  });

  test("DELETE /roles/{roleId} は割り当て中のユーザーがいる場合409", async () => {
    mockCallerAsAdmin();
    ddbMock.on(GetCommand, { TableName: "test-Roles", Key: { roleId: "role-member" } }).resolves({ Item: memberRole });
    ddbMock
      .on(ScanCommand, { TableName: "test-Users", FilterExpression: "roleId = :roleId" })
      .resolves({ Items: [{ userId: "u1" }] });

    const res = await invoke(
      buildEvent({ resource: "/roles/{roleId}", httpMethod: "DELETE", pathParameters: { roleId: "role-member" } }),
    );

    expect(res.statusCode).toBe(409);
  });

  test("DELETE /roles/{roleId} は未使用なら削除できる", async () => {
    mockCallerAsAdmin();
    ddbMock.on(GetCommand, { TableName: "test-Roles", Key: { roleId: "role-member" } }).resolves({ Item: memberRole });
    ddbMock
      .on(ScanCommand, { TableName: "test-Users", FilterExpression: "roleId = :roleId" })
      .resolves({ Items: [] });
    ddbMock.on(DeleteCommand).resolves({});

    const res = await invoke(
      buildEvent({ resource: "/roles/{roleId}", httpMethod: "DELETE", pathParameters: { roleId: "role-member" } }),
    );

    expect(res.statusCode).toBe(204);
  });
});

describe("MemberCategories CRUD", () => {
  test("POST /member-categories はMemberCategoriesテーブルが空なら権限チェック無しで作成できる", async () => {
    ddbMock.on(ScanCommand, { TableName: "test-MemberCategories" }).resolves({ Items: [] });
    ddbMock.on(GetCommand, { TableName: "test-MemberCategories" }).resolves({});
    ddbMock.on(PutCommand).resolves({});

    const res = await invoke(
      buildEvent({
        resource: "/member-categories",
        httpMethod: "POST",
        body: JSON.stringify({ name: "パート・アルバイト" }),
      }),
    );

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body) as MemberCategory;
    expect(body.name).toBe("パート・アルバイト");
  });

  test("POST /member-categories はテーブルが空でなければmanageMemberCategories権限が無いと403", async () => {
    ddbMock.on(ScanCommand, { TableName: "test-MemberCategories" }).resolves({ Items: [{ categoryId: "cat-1" }] });
    mockCallerAsMember();

    const res = await invoke(
      buildEvent({
        resource: "/member-categories",
        httpMethod: "POST",
        body: JSON.stringify({ name: "パート・アルバイト" }),
      }),
    );

    expect(res.statusCode).toBe(403);
  });

  test("PUT /member-categories/{categoryId} はmanageMemberCategories権限が無いと403", async () => {
    mockCallerAsMember();

    const res = await invoke(
      buildEvent({
        resource: "/member-categories/{categoryId}",
        httpMethod: "PUT",
        pathParameters: { categoryId: "cat-1" },
        body: JSON.stringify({ name: "改名" }),
      }),
    );

    expect(res.statusCode).toBe(403);
  });

  test("DELETE /member-categories/{categoryId} は割り当て中の場合409", async () => {
    mockCallerAsAdmin();
    ddbMock
      .on(GetCommand, { TableName: "test-MemberCategories", Key: { categoryId: "cat-1" } })
      .resolves({ Item: { categoryId: "cat-1", name: "正職員" } });
    ddbMock
      .on(ScanCommand, { TableName: "test-Users", FilterExpression: "memberCategoryId = :categoryId" })
      .resolves({ Items: [{ userId: "u1" }] });

    const res = await invoke(
      buildEvent({
        resource: "/member-categories/{categoryId}",
        httpMethod: "DELETE",
        pathParameters: { categoryId: "cat-1" },
      }),
    );

    expect(res.statusCode).toBe(409);
  });
});

test("未定義ルートは404", async () => {
  const res = await invoke(buildEvent({ resource: "/unknown", httpMethod: "GET" }));
  expect(res.statusCode).toBe(404);
});
