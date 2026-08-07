process.env.CALL_LOGS_TABLE_NAME = "test-CallLogs";
process.env.USERS_TABLE_NAME = "test-Users";
process.env.CHAT_API_URL = "https://example.appsync-api.ap-northeast-1.amazonaws.com/graphql";
process.env.PUSH_TOPIC_ARN = "arn:aws:sns:ap-northeast-1:123456789012:test-topic";

import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import {
  ChimeSDKMeetingsClient,
  CreateMeetingCommand,
  CreateAttendeeCommand,
  DeleteMeetingCommand,
} from "@aws-sdk/client-chime-sdk-meetings";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import type { User } from "@on-connect/shared";

const callAppSyncGraphQL = jest.fn();
jest.mock("../../lambda/common/appsyncSigner", () => ({
  callAppSyncGraphQL: (...args: unknown[]) => callAppSyncGraphQL(...args),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { handler } = require("../../lambda/calls/initiateCall");

const ddbMock = mockClient(DynamoDBDocumentClient);
const snsMock = mockClient(SNSClient);
const chimeMock = mockClient(ChimeSDKMeetingsClient);

const caller: User = {
  userId: "caller-1",
  loginId: "staff-caller-1",
  displayName: "田中",
  furigana: "たなか",
  roleId: "role-member",
  memberCategoryId: "cat-a",
  notificationStatus: "ON",
  permissions: {
    manageUsers: false,
    sendForceNotify: false,
    manageBulletinCategories: false,
    manageOrgLinks: false,
    manageRoles: false,
    manageMemberCategories: false,
    manageCalendarCategories: false,
    manageShifts: false,
  },
};

function buildEvent(overrides: Partial<APIGatewayProxyEvent>): APIGatewayProxyEvent {
  return {
    resource: "/calls",
    httpMethod: "POST",
    path: "/calls",
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

function mockUsers(users: User[]) {
  for (const user of users) {
    ddbMock.on(GetCommand, { TableName: "test-Users", Key: { userId: user.userId } }).resolves({ Item: user });
  }
}

beforeEach(() => {
  ddbMock.reset();
  snsMock.reset();
  chimeMock.reset();
  callAppSyncGraphQL.mockReset();
});

describe("POST /calls", () => {
  test("通知OFFの相手には発信できない（409）", async () => {
    mockUsers([caller, { ...caller, userId: "callee-1", notificationStatus: "OFF" }]);

    const res = await invoke(buildEvent({ body: JSON.stringify({ calleeId: "callee-1" }) }));

    expect(res.statusCode).toBe(409);
    expect(chimeMock.commandCalls(CreateMeetingCommand)).toHaveLength(0);
  });

  test("自分自身には発信できない（400）", async () => {
    mockUsers([caller]);

    const res = await invoke(buildEvent({ body: JSON.stringify({ calleeId: "caller-1" }) }));

    expect(res.statusCode).toBe(400);
  });

  test("着信者が存在しない場合は404", async () => {
    mockUsers([caller]);
    ddbMock.on(GetCommand, { TableName: "test-Users", Key: { userId: "missing-user" } }).resolves({});

    const res = await invoke(buildEvent({ body: JSON.stringify({ calleeId: "missing-user" }) }));

    expect(res.statusCode).toBe(404);
  });

  test("正常系：Meeting/Attendeeを作成し、着信通知（AppSync・プッシュ）を送る", async () => {
    mockUsers([caller, { ...caller, userId: "callee-1", displayName: "鈴木", notificationStatus: "ON" }]);
    chimeMock.on(CreateMeetingCommand).resolves({ Meeting: { MeetingId: "meeting-1" } });
    chimeMock
      .on(CreateAttendeeCommand, { MeetingId: "meeting-1", ExternalUserId: "caller-1" })
      .resolves({ Attendee: { AttendeeId: "attendee-caller", ExternalUserId: "caller-1" } });
    chimeMock
      .on(CreateAttendeeCommand, { MeetingId: "meeting-1", ExternalUserId: "callee-1" })
      .resolves({ Attendee: { AttendeeId: "attendee-callee", ExternalUserId: "callee-1" } });
    callAppSyncGraphQL.mockResolvedValue({ notifyIncomingCall: { callId: "any" } });
    snsMock.on(PublishCommand).resolves({});

    const res = await invoke(buildEvent({ body: JSON.stringify({ calleeId: "callee-1" }) }));

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body) as { callId: string; meeting: unknown; callerAttendee: unknown };
    expect(typeof body.callId).toBe("string");
    expect(body.meeting).toEqual({ Meeting: { MeetingId: "meeting-1" } });
    expect(body.callerAttendee).toEqual({ Attendee: { AttendeeId: "attendee-caller", ExternalUserId: "caller-1" } });

    expect(callAppSyncGraphQL).toHaveBeenCalledTimes(1);
    const [, , variables] = callAppSyncGraphQL.mock.calls[0] as [string, string, { input: Record<string, unknown> }];
    expect(variables.input.calleeId).toBe("callee-1");
    expect(variables.input.callerName).toBe("田中");

    expect(snsMock.commandCalls(PublishCommand)).toHaveLength(1);
    const payload = JSON.parse(snsMock.commandCalls(PublishCommand)[0].args[0].input.Message as string);
    expect(payload.type).toBe("incoming_call");
    expect(payload.targetUserIds).toEqual(["callee-1"]);
  });

  test("AppSync通知の呼び出しが失敗しても、発信自体は成功する（プッシュ通知が別経路で残るため）", async () => {
    mockUsers([caller, { ...caller, userId: "callee-1", notificationStatus: "ON" }]);
    chimeMock.on(CreateMeetingCommand).resolves({ Meeting: { MeetingId: "meeting-1" } });
    chimeMock.on(CreateAttendeeCommand).resolves({ Attendee: { AttendeeId: "attendee-1" } });
    callAppSyncGraphQL.mockRejectedValue(new Error("boom"));
    snsMock.on(PublishCommand).resolves({});

    const res = await invoke(buildEvent({ body: JSON.stringify({ calleeId: "callee-1" }) }));

    expect(res.statusCode).toBe(201);
  });
});

describe("POST /calls/{callId}/end", () => {
  function endEvent(overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
    return buildEvent({
      resource: "/calls/{callId}/end",
      httpMethod: "POST",
      pathParameters: { callId: "call-1" },
      ...overrides,
    });
  }

  test("必須項目が無ければ400", async () => {
    const res = await invoke(endEvent({ body: JSON.stringify({ callerId: "caller-1" }) }));
    expect(res.statusCode).toBe(400);
  });

  test("通話の当事者以外は記録できない（403）", async () => {
    const res = await invoke(
      endEvent({
        requestContext: { authorizer: { claims: { sub: "someone-else" } } } as never,
        body: JSON.stringify({
          callerId: "caller-1",
          calleeId: "callee-1",
          startTime: "2026-08-07T00:00:00.000Z",
          status: "completed",
        }),
      }),
    );
    expect(res.statusCode).toBe(403);
  });

  test("正常系（completed）：Meetingを削除し、durationSecondsを算出してCallLogsに書く", async () => {
    chimeMock.on(DeleteMeetingCommand).resolves({});
    ddbMock.on(PutCommand).resolves({});
    jest.useFakeTimers().setSystemTime(new Date("2026-08-07T00:05:00.000Z"));

    const res = await invoke(
      endEvent({
        body: JSON.stringify({
          callerId: "caller-1",
          calleeId: "callee-1",
          startTime: "2026-08-07T00:00:00.000Z",
          status: "completed",
        }),
      }),
    );

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe("completed");
    expect(body.durationSeconds).toBe(300);
    expect(chimeMock.commandCalls(DeleteMeetingCommand)[0].args[0].input.MeetingId).toBe("call-1");

    jest.useRealTimers();
  });

  test("missed/declinedはdurationSecondsを持たない", async () => {
    chimeMock.on(DeleteMeetingCommand).resolves({});
    ddbMock.on(PutCommand).resolves({});

    const res = await invoke(
      endEvent({
        body: JSON.stringify({
          callerId: "caller-1",
          calleeId: "callee-1",
          startTime: "2026-08-07T00:00:00.000Z",
          status: "missed",
        }),
      }),
    );

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe("missed");
    expect(body.durationSeconds).toBeUndefined();
  });

  test("Meeting削除が失敗してもCallLogsの記録は続行する", async () => {
    chimeMock.on(DeleteMeetingCommand).rejects(new Error("not found"));
    ddbMock.on(PutCommand).resolves({});

    const res = await invoke(
      endEvent({
        body: JSON.stringify({
          callerId: "caller-1",
          calleeId: "callee-1",
          startTime: "2026-08-07T00:00:00.000Z",
          status: "declined",
        }),
      }),
    );

    expect(res.statusCode).toBe(200);
    expect(ddbMock.commandCalls(PutCommand)).toHaveLength(1);
  });
});
