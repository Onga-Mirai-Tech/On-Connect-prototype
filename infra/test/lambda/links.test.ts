process.env.ORG_LINKS_TABLE_NAME = "test-OrgLinks";

import { mockClient } from "aws-sdk-client-mock";
import { DeleteCommand, DynamoDBDocumentClient, GetCommand, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import type { OrgLink } from "@on-connect/shared";
import { handler } from "../../lambda/links/crud";

const ddbMock = mockClient(DynamoDBDocumentClient);

function buildEvent(overrides: Partial<APIGatewayProxyEvent>): APIGatewayProxyEvent {
  return {
    resource: "/org-links",
    httpMethod: "GET",
    path: "/org-links",
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

test("GET /org-links はsortOrder順で一覧を返す", async () => {
  const links: OrgLink[] = [
    { linkId: "l2", title: "備品購入申請", url: "https://example.com/b", sortOrder: 2, createdBy: "u1", updatedAt: "2026-08-01T00:00:00.000Z" },
    { linkId: "l1", title: "休暇申請", url: "https://example.com/a", sortOrder: 1, createdBy: "u1", updatedAt: "2026-08-01T00:00:00.000Z" },
  ];
  ddbMock.on(ScanCommand, { TableName: "test-OrgLinks" }).resolves({ Items: links });

  const res = await invoke(buildEvent({ resource: "/org-links", httpMethod: "GET" }));

  expect(res.statusCode).toBe(200);
  const body = JSON.parse(res.body) as OrgLink[];
  expect(body.map((l) => l.linkId)).toEqual(["l1", "l2"]);
});

test("POST /org-links で新規作成できる", async () => {
  ddbMock.on(PutCommand).resolves({});

  const res = await invoke(
    buildEvent({
      resource: "/org-links",
      httpMethod: "POST",
      body: JSON.stringify({ title: "休暇申請フォーム", url: "https://example.com/leave" }),
    }),
  );

  expect(res.statusCode).toBe(201);
  const body = JSON.parse(res.body) as OrgLink;
  expect(body.title).toBe("休暇申請フォーム");
  expect(body.createdBy).toBe("caller-1");
  expect(body.sortOrder).toBe(0);
  expect(typeof body.linkId).toBe("string");
});

test("POST /org-links はurl不足で400", async () => {
  const res = await invoke(
    buildEvent({ resource: "/org-links", httpMethod: "POST", body: JSON.stringify({ title: "タイトルのみ" }) }),
  );

  expect(res.statusCode).toBe(400);
});

test("PUT /org-links/{linkId} で更新できる", async () => {
  const existing: OrgLink = {
    linkId: "l1",
    title: "旧タイトル",
    url: "https://example.com/old",
    sortOrder: 1,
    createdBy: "u1",
    updatedAt: "2026-08-01T00:00:00.000Z",
  };
  ddbMock.on(GetCommand, { TableName: "test-OrgLinks", Key: { linkId: "l1" } }).resolves({ Item: existing });
  ddbMock.on(PutCommand).resolves({});

  const res = await invoke(
    buildEvent({
      resource: "/org-links/{linkId}",
      httpMethod: "PUT",
      pathParameters: { linkId: "l1" },
      body: JSON.stringify({ title: "新タイトル" }),
    }),
  );

  expect(res.statusCode).toBe(200);
  const body = JSON.parse(res.body) as OrgLink;
  expect(body.title).toBe("新タイトル");
  expect(body.url).toBe(existing.url);
});

test("DELETE /org-links/{linkId} で削除できる", async () => {
  ddbMock.on(GetCommand, { TableName: "test-OrgLinks", Key: { linkId: "l1" } }).resolves({ Item: { linkId: "l1" } });
  ddbMock.on(DeleteCommand).resolves({});

  const res = await invoke(
    buildEvent({ resource: "/org-links/{linkId}", httpMethod: "DELETE", pathParameters: { linkId: "l1" } }),
  );

  expect(res.statusCode).toBe(204);
});

test("存在しないリンクのDELETEは404", async () => {
  ddbMock.on(GetCommand, { TableName: "test-OrgLinks" }).resolves({});

  const res = await invoke(
    buildEvent({ resource: "/org-links/{linkId}", httpMethod: "DELETE", pathParameters: { linkId: "unknown" } }),
  );

  expect(res.statusCode).toBe(404);
});
