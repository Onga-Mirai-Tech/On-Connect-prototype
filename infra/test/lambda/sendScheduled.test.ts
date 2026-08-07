process.env.MESSAGES_TABLE_NAME = "test-Messages";
process.env.CHAT_API_URL = "https://example.appsync-api.ap-northeast-1.amazonaws.com/graphql";

import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const callAppSyncGraphQL = jest.fn();
jest.mock("../../lambda/common/appsyncSigner", () => ({
  callAppSyncGraphQL: (...args: unknown[]) => callAppSyncGraphQL(...args),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { handler } = require("../../lambda/messages/sendScheduled");

const ddbMock = mockClient(DynamoDBDocumentClient);

// EventBridge SchedulerがLambdaターゲットを直接起動する場合、Target.Inputで指定したJSONは
// event.detailにラップされず、そのままイベントオブジェクトとして渡される（.detailラップは
// EventBridge Rules経由の呼び出しの場合のみ。実デプロイでの実地検証で発覚した実際の形）
function buildEvent(): { roomId: string; messageId: string } {
  return { roomId: "room-1", messageId: "msg-1" };
}

beforeEach(() => {
  ddbMock.reset();
  callAppSyncGraphQL.mockReset();
});

test("正常系：statusをsentに更新し、deliverScheduledMessageミューテーションを呼ぶ", async () => {
  ddbMock.on(UpdateCommand).resolves({});
  callAppSyncGraphQL.mockResolvedValue({ deliverScheduledMessage: { messageId: "msg-1" } });

  await handler(buildEvent(), {} as never, (() => {}) as never);

  const updateCalls = ddbMock.commandCalls(UpdateCommand);
  expect(updateCalls).toHaveLength(1);
  expect(updateCalls[0].args[0].input.Key).toEqual({ roomId: "room-1", messageId: "msg-1" });
  expect(updateCalls[0].args[0].input.ConditionExpression).toBe("#status = :scheduled");

  expect(callAppSyncGraphQL).toHaveBeenCalledTimes(1);
  expect(callAppSyncGraphQL).toHaveBeenCalledWith(
    process.env.CHAT_API_URL,
    expect.stringContaining("deliverScheduledMessage"),
    { roomId: "room-1", messageId: "msg-1" },
  );
});

test("既に取消・配信済み（ConditionalCheckFailedException）の場合は何もせず正常終了する", async () => {
  const error = new Error("conditional check failed");
  error.name = "ConditionalCheckFailedException";
  ddbMock.on(UpdateCommand).rejects(error);

  await expect(handler(buildEvent(), {} as never, (() => {}) as never)).resolves.not.toThrow();
  expect(callAppSyncGraphQL).not.toHaveBeenCalled();
});

test("それ以外のDynamoDBエラーは再スローする", async () => {
  ddbMock.on(UpdateCommand).rejects(new Error("boom"));

  await expect(handler(buildEvent(), {} as never, (() => {}) as never)).rejects.toThrow("boom");
  expect(callAppSyncGraphQL).not.toHaveBeenCalled();
});
