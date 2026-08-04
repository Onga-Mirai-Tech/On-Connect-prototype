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

async function invoke(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const result = await handler(event, {} as never, (() => {}) as never);
  return result as APIGatewayProxyResult;
}

beforeEach(() => {
  ddbMock.reset();
});

describe("Users CRUD", () => {
  test("GET /users は一覧を返す", async () => {
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

  test("POST /users は新規作成できる", async () => {
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

  test("POST /users はuserId重複時に409を返す", async () => {
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

  test("PUT /users/{userId} で最後の管理者を一般ロールへ降格しようとすると409", async () => {
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
      }),
    );

    expect(res.statusCode).toBe(200);
  });

  test("DELETE /users/{userId} は最後の管理者を削除できない", async () => {
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
      buildEvent({ resource: "/users/{userId}", httpMethod: "DELETE", pathParameters: { userId: "u1" } }),
    );

    expect(res.statusCode).toBe(409);
  });

  test("DELETE /users/{userId} は一般メンバーなら削除できる", async () => {
    const memberUser: User = {
      userId: "u3",
      displayName: "一般",
      furigana: "いっぱん",
      email: "member@example.com",
      roleId: "role-member",
      memberCategoryId: "cat-1",
      notificationStatus: "ON",
    };
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
  test("POST /roles で新規ロールを作成できる", async () => {
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

  test("DELETE /roles/{roleId} は割り当て中のユーザーがいる場合409", async () => {
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
  test("POST /member-categories で新規作成できる", async () => {
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

  test("DELETE /member-categories/{categoryId} は割り当て中の場合409", async () => {
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
