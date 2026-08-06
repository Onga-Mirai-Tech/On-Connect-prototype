process.env.USERS_TABLE_NAME = "test-Users";
process.env.ROLES_TABLE_NAME = "test-Roles";
process.env.MEMBER_CATEGORIES_TABLE_NAME = "test-MemberCategories";
process.env.USER_POOL_ID = "test-pool";

import { mockClient } from "aws-sdk-client-mock";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminGetUserCommand,
  AdminSetUserPasswordCommand,
  CognitoIdentityProviderClient,
  UserNotFoundException,
} from "@aws-sdk/client-cognito-identity-provider";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import type { MemberCategory, Role, RolePermissions, User } from "@on-connect/shared";
import { handler } from "../../lambda/users/index";

const ddbMock = mockClient(DynamoDBDocumentClient);
const cognitoMock = mockClient(CognitoIdentityProviderClient);

const allPermissionsOff: RolePermissions = {
  manageUsers: false,
  sendForceNotify: false,
  manageBulletinCategories: false,
  manageOrgLinks: false,
  manageRoles: false,
  manageMemberCategories: false,
  manageCalendarCategories: false,
  manageShifts: false,
};

const allPermissionsOn: RolePermissions = {
  manageUsers: true,
  sendForceNotify: true,
  manageBulletinCategories: true,
  manageOrgLinks: true,
  manageRoles: true,
  manageMemberCategories: true,
  manageCalendarCategories: true,
  manageShifts: true,
};

// デフォルトの呼び出し元(sub: "caller-1")を管理者/一般メンバーとして扱いたい場合のダミーユーザー
const adminCallerUser: User = {
  userId: "caller-1",
  loginId: "staff-caller-1",
  displayName: "呼び出し管理者",
  furigana: "よびだしかんりしゃ",
  email: "admin-caller@example.com",
  roleId: "role-admin",
  memberCategoryId: "cat-1",
  notificationStatus: "ON",
  permissions: allPermissionsOn,
};

const memberCallerUser: User = {
  ...adminCallerUser,
  displayName: "呼び出し一般メンバー",
  permissions: allPermissionsOff,
};

/** 呼び出し元(caller-1)が全ての管理権限を持つようにモックする（Usersテーブルの参照のみで完結） */
function mockCallerAsAdmin() {
  ddbMock.on(GetCommand, { TableName: "test-Users", Key: { userId: "caller-1" } }).resolves({ Item: adminCallerUser });
}

/** 呼び出し元(caller-1)が何の管理権限も持たない一般メンバーであるようにモックする */
function mockCallerAsMember() {
  ddbMock
    .on(GetCommand, { TableName: "test-Users", Key: { userId: "caller-1" } })
    .resolves({ Item: memberCallerUser });
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
  cognitoMock.reset();
});

describe("Users CRUD", () => {
  test("GET /users は一覧をログイン状況付きで返す（権限チェック無し）", async () => {
    const users: User[] = [
      {
        userId: "u1",
        loginId: "staff01",
        displayName: "田中",
        furigana: "たなか",
        email: "tanaka@example.com",
        roleId: "role-member",
        memberCategoryId: "cat-1",
        notificationStatus: "ON",
        permissions: allPermissionsOff,
      },
    ];
    ddbMock.on(ScanCommand, { TableName: "test-Users" }).resolves({ Items: users });
    cognitoMock.on(AdminGetUserCommand, { Username: "staff01" }).resolves({ UserStatus: "CONFIRMED" });

    const res = await invoke(buildEvent({ resource: "/users", httpMethod: "GET" }));

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body[0]).toMatchObject({ ...users[0], loginStatus: "CONFIRMED" });
  });

  test("GET /users はCognitoアカウント未発行のユーザーをUNPROVISIONEDとして返す", async () => {
    const users: User[] = [
      {
        userId: "u2",
        loginId: "staff02",
        displayName: "佐藤",
        furigana: "さとう",
        roleId: "role-member",
        memberCategoryId: "cat-1",
        notificationStatus: "ON",
        permissions: allPermissionsOff,
      },
    ];
    ddbMock.on(ScanCommand, { TableName: "test-Users" }).resolves({ Items: users });
    cognitoMock.on(AdminGetUserCommand).rejects(new UserNotFoundException({ message: "not found", $metadata: {} }));

    const res = await invoke(buildEvent({ resource: "/users", httpMethod: "GET" }));

    const body = JSON.parse(res.body);
    expect(body[0].loginStatus).toBe("UNPROVISIONED");
  });

  test("POST /users はUsersテーブルが空なら権限チェック無しでCognitoアカウント＋レコードを作成できる（初期セットアップ）", async () => {
    ddbMock.on(ScanCommand, { TableName: "test-Users" }).resolves({ Items: [] }); // isTableEmpty -> true、loginId重複チェックも空
    ddbMock.on(PutCommand).resolves({});
    cognitoMock
      .on(AdminCreateUserCommand)
      .resolves({ User: { Attributes: [{ Name: "sub", Value: "cognito-sub-2" }] } });

    const input = {
      loginId: "staff02",
      displayName: "佐藤",
      furigana: "さとう",
      roleId: "role-member",
      memberCategoryId: "cat-1",
    };
    const res = await invoke(
      buildEvent({ resource: "/users", httpMethod: "POST", body: JSON.stringify(input) }),
    );

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body) as { user: User; temporaryPassword: string };
    expect(body.user).toMatchObject(input);
    expect(body.user.userId).toBe("cognito-sub-2"); // Cognitoが発行したsubがuserIdになる
    expect(body.user.permissions).toEqual(allPermissionsOff);
    expect(typeof body.temporaryPassword).toBe("string");
    expect(body.temporaryPassword.length).toBeGreaterThanOrEqual(10);

    const createUserCall = cognitoMock.commandCalls(AdminCreateUserCommand)[0].args[0].input;
    expect(createUserCall.Username).toBe("staff02");
    expect(createUserCall.MessageAction).toBe("SUPPRESS");
    expect(createUserCall.UserAttributes).toContainEqual({ Name: "name", Value: "佐藤" });
  });

  test("POST /users はUsersテーブルが空でなければmanageUsers権限が無いと403", async () => {
    ddbMock.on(ScanCommand, { TableName: "test-Users" }).resolves({ Items: [memberCallerUser] });
    mockCallerAsMember();

    const res = await invoke(
      buildEvent({
        resource: "/users",
        httpMethod: "POST",
        body: JSON.stringify({
          loginId: "staff02",
          displayName: "佐藤",
          furigana: "さとう",
          roleId: "role-member",
          memberCategoryId: "cat-1",
        }),
      }),
    );

    expect(res.statusCode).toBe(403);
    expect(cognitoMock.commandCalls(AdminCreateUserCommand)).toHaveLength(0);
  });

  test("POST /users はmanageUsers権限があれば作成できる", async () => {
    ddbMock.on(ScanCommand, { TableName: "test-Users" }).resolves({ Items: [adminCallerUser] });
    ddbMock
      .on(ScanCommand, { TableName: "test-Users", FilterExpression: "loginId = :loginId" })
      .resolves({ Items: [] });
    mockCallerAsAdmin();
    ddbMock.on(PutCommand).resolves({});
    cognitoMock
      .on(AdminCreateUserCommand)
      .resolves({ User: { Attributes: [{ Name: "sub", Value: "cognito-sub-2" }] } });

    const res = await invoke(
      buildEvent({
        resource: "/users",
        httpMethod: "POST",
        body: JSON.stringify({
          loginId: "staff02",
          displayName: "佐藤",
          furigana: "さとう",
          roleId: "role-member",
          memberCategoryId: "cat-1",
        }),
      }),
    );

    expect(res.statusCode).toBe(201);
  });

  test("POST /users はログインID重複時に409を返す（Cognitoアカウントは作成しない）", async () => {
    ddbMock.on(ScanCommand, { TableName: "test-Users" }).resolves({ Items: [] }); // isTableEmpty -> true（初期セットアップ扱い）
    ddbMock
      .on(ScanCommand, { TableName: "test-Users", FilterExpression: "loginId = :loginId" })
      .resolves({ Items: [{ userId: "existing-user" }] });

    const res = await invoke(
      buildEvent({
        resource: "/users",
        httpMethod: "POST",
        body: JSON.stringify({
          loginId: "staff02",
          displayName: "佐藤",
          furigana: "さとう",
          roleId: "role-member",
          memberCategoryId: "cat-1",
        }),
      }),
    );

    expect(res.statusCode).toBe(409);
    expect(cognitoMock.commandCalls(AdminCreateUserCommand)).toHaveLength(0);
  });

  test("POST /users はDynamoDB書き込み失敗時にCognitoアカウントを削除してロールバックする", async () => {
    ddbMock.on(ScanCommand, { TableName: "test-Users" }).resolves({ Items: [] });
    cognitoMock
      .on(AdminCreateUserCommand)
      .resolves({ User: { Attributes: [{ Name: "sub", Value: "cognito-sub-9" }] } });
    cognitoMock.on(AdminDeleteUserCommand).resolves({});
    ddbMock.on(PutCommand).rejects(new Error("DynamoDB failure"));

    const res = await invoke(
      buildEvent({
        resource: "/users",
        httpMethod: "POST",
        body: JSON.stringify({
          loginId: "staff99",
          displayName: "失敗太郎",
          furigana: "しっぱいたろう",
          roleId: "role-member",
          memberCategoryId: "cat-1",
        }),
      }),
    );

    expect(res.statusCode).toBe(500);
    const deleteCalls = cognitoMock.commandCalls(AdminDeleteUserCommand);
    expect(deleteCalls).toHaveLength(1);
    expect(deleteCalls[0].args[0].input.Username).toBe("staff99");
  });

  test("PUT /users/{userId} は本人が自分のnotificationStatusだけ変更する場合は権限チェック無しで成功する", async () => {
    const self: User = {
      userId: "u5",
      loginId: "staff05",
      displayName: "自分",
      furigana: "じぶん",
      email: "self@example.com",
      roleId: "role-member",
      memberCategoryId: "cat-1",
      notificationStatus: "ON",
      permissions: allPermissionsOff,
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
      loginId: "staff05",
      displayName: "自分",
      furigana: "じぶん",
      email: "self@example.com",
      roleId: "role-member",
      memberCategoryId: "cat-1",
      notificationStatus: "ON",
      permissions: allPermissionsOff,
    };
    ddbMock.on(GetCommand, { TableName: "test-Users", Key: { userId: "u5" } }).resolves({ Item: self });

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
      loginId: "staff06",
      displayName: "他人",
      furigana: "たにん",
      email: "other@example.com",
      roleId: "role-member",
      memberCategoryId: "cat-1",
      notificationStatus: "ON",
      permissions: allPermissionsOff,
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

  test("PUT /users/{userId} で最後の管理者(本人)からmanageUsersを外そうとすると409", async () => {
    const adminUser: User = {
      userId: "u1",
      loginId: "staff01",
      displayName: "園長",
      furigana: "えんちょう",
      email: "encho@example.com",
      roleId: "role-admin",
      memberCategoryId: "cat-1",
      notificationStatus: "ON",
      permissions: allPermissionsOn,
    };
    ddbMock.on(GetCommand, { TableName: "test-Users", Key: { userId: "u1" } }).resolves({ Item: adminUser });
    // ユーザーは自分1人だけ（=自分が最後の管理者）。FilterExpressionで自分自身は除外される想定なのでItemsは空。
    ddbMock.on(ScanCommand, { TableName: "test-Users" }).resolves({ Items: [] });

    const res = await invoke(
      buildEvent({
        resource: "/users/{userId}",
        httpMethod: "PUT",
        pathParameters: { userId: "u1" },
        body: JSON.stringify({ permissions: allPermissionsOff }),
        ...asUser("u1"), // 本人(管理者)が自分自身のmanageUsersを外そうとするケース
      }),
    );

    expect(res.statusCode).toBe(409);
  });

  test("PUT /users/{userId} で他に管理者がいればmanageUsersを外せる", async () => {
    const adminUser1: User = {
      userId: "u1",
      loginId: "staff01",
      displayName: "園長",
      furigana: "えんちょう",
      email: "encho@example.com",
      roleId: "role-admin",
      memberCategoryId: "cat-1",
      notificationStatus: "ON",
      permissions: allPermissionsOn,
    };
    const adminUser2: User = { ...adminUser1, userId: "u2", loginId: "staff02", displayName: "主任" };

    ddbMock.on(GetCommand, { TableName: "test-Users", Key: { userId: "u1" } }).resolves({ Item: adminUser1 });
    ddbMock.on(ScanCommand, { TableName: "test-Users" }).resolves({ Items: [adminUser1, adminUser2] });
    ddbMock.on(PutCommand).resolves({});

    const res = await invoke(
      buildEvent({
        resource: "/users/{userId}",
        httpMethod: "PUT",
        pathParameters: { userId: "u1" },
        body: JSON.stringify({ permissions: allPermissionsOff }),
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
      loginId: "staff01",
      displayName: "園長",
      furigana: "えんちょう",
      email: "encho@example.com",
      roleId: "role-admin",
      memberCategoryId: "cat-1",
      notificationStatus: "ON",
      permissions: allPermissionsOn,
    };
    ddbMock.on(GetCommand, { TableName: "test-Users", Key: { userId: "u1" } }).resolves({ Item: adminUser });
    // FilterExpressionで自分自身は除外される想定なのでItemsは空（=他に管理者がいない）。
    ddbMock.on(ScanCommand, { TableName: "test-Users" }).resolves({ Items: [] });

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
      loginId: "staff03",
      displayName: "一般",
      furigana: "いっぱん",
      email: "member@example.com",
      roleId: "role-member",
      memberCategoryId: "cat-1",
      notificationStatus: "ON",
      permissions: allPermissionsOff,
    };
    mockCallerAsAdmin();
    ddbMock.on(GetCommand, { TableName: "test-Users", Key: { userId: "u3" } }).resolves({ Item: memberUser });
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

describe("POST /users/{userId}/reset-password", () => {
  test("manageUsers権限が無いと403", async () => {
    mockCallerAsMember();

    const res = await invoke(
      buildEvent({
        resource: "/users/{userId}/reset-password",
        httpMethod: "POST",
        pathParameters: { userId: "u3" },
      }),
    );

    expect(res.statusCode).toBe(403);
    expect(cognitoMock.commandCalls(AdminSetUserPasswordCommand)).toHaveLength(0);
  });

  test("manageUsers権限があれば新しい仮パスワードを発行する", async () => {
    const target: User = {
      userId: "u3",
      loginId: "staff03",
      displayName: "一般",
      furigana: "いっぱん",
      roleId: "role-member",
      memberCategoryId: "cat-1",
      notificationStatus: "ON",
      permissions: allPermissionsOff,
    };
    mockCallerAsAdmin();
    ddbMock.on(GetCommand, { TableName: "test-Users", Key: { userId: "u3" } }).resolves({ Item: target });
    cognitoMock.on(AdminSetUserPasswordCommand).resolves({});

    const res = await invoke(
      buildEvent({
        resource: "/users/{userId}/reset-password",
        httpMethod: "POST",
        pathParameters: { userId: "u3" },
      }),
    );

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { temporaryPassword: string };
    expect(typeof body.temporaryPassword).toBe("string");
    expect(body.temporaryPassword.length).toBeGreaterThanOrEqual(10);

    const setPasswordCall = cognitoMock.commandCalls(AdminSetUserPasswordCommand)[0].args[0].input;
    expect(setPasswordCall.Username).toBe("staff03");
    expect(setPasswordCall.Permanent).toBe(false);
  });

  test("存在しないユーザーは404", async () => {
    mockCallerAsAdmin();
    ddbMock.on(GetCommand, { TableName: "test-Users", Key: { userId: "unknown" } }).resolves({});

    const res = await invoke(
      buildEvent({
        resource: "/users/{userId}/reset-password",
        httpMethod: "POST",
        pathParameters: { userId: "unknown" },
      }),
    );

    expect(res.statusCode).toBe(404);
  });
});

describe("Roles CRUD（名前だけのラベル、権限は持たない）", () => {
  test("POST /roles はRolesテーブルが空なら権限チェック無しで作成できる（初期セットアップ）", async () => {
    ddbMock.on(ScanCommand, { TableName: "test-Roles" }).resolves({ Items: [] });
    ddbMock.on(GetCommand, { TableName: "test-Roles" }).resolves({});
    ddbMock.on(PutCommand).resolves({});

    const res = await invoke(
      buildEvent({ resource: "/roles", httpMethod: "POST", body: JSON.stringify({ name: "事務職員" }) }),
    );

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body) as Role;
    expect(body.name).toBe("事務職員");
    expect(typeof body.roleId).toBe("string");
    expect((body as unknown as { permissions?: unknown }).permissions).toBeUndefined();
  });

  test("POST /roles はRolesテーブルが空でなければmanageRoles権限が無いと403", async () => {
    ddbMock.on(ScanCommand, { TableName: "test-Roles" }).resolves({ Items: [{ roleId: "role-admin" }] });
    mockCallerAsMember();

    const res = await invoke(
      buildEvent({ resource: "/roles", httpMethod: "POST", body: JSON.stringify({ name: "事務職員" }) }),
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

  test("PUT /roles/{roleId} はmanageRoles権限があれば名前を変更できる", async () => {
    mockCallerAsAdmin();
    ddbMock
      .on(GetCommand, { TableName: "test-Roles", Key: { roleId: "role-member" } })
      .resolves({ Item: { roleId: "role-member", name: "一般メンバー" } });
    ddbMock.on(PutCommand).resolves({});

    const res = await invoke(
      buildEvent({
        resource: "/roles/{roleId}",
        httpMethod: "PUT",
        pathParameters: { roleId: "role-member" },
        body: JSON.stringify({ name: "パート" }),
      }),
    );

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).name).toBe("パート");
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
    ddbMock
      .on(GetCommand, { TableName: "test-Roles", Key: { roleId: "role-member" } })
      .resolves({ Item: { roleId: "role-member", name: "一般メンバー" } });
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
    ddbMock
      .on(GetCommand, { TableName: "test-Roles", Key: { roleId: "role-member" } })
      .resolves({ Item: { roleId: "role-member", name: "一般メンバー" } });
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
