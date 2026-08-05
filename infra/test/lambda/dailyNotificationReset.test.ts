process.env.USERS_TABLE_NAME = "test-Users";
process.env.MEMBER_DAILY_STATUS_TABLE_NAME = "test-MemberDailyStatus";

import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient, QueryCommand, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { tokyoDateString } from "../../lambda/common/date";
import { handler } from "../../lambda/users/dailyNotificationReset";

const ddbMock = mockClient(DynamoDBDocumentClient);

const today = tokyoDateString(0);
const yesterday = tokyoDateString(-1);

beforeEach(() => {
  ddbMock.reset();
});

test("休み初日の人は強制OFF、休み継続中の人は維持、休みでない人は既存のOFF→ONリセットのみ行う", async () => {
  // userA: 休み初日（今日は休み、昨日は休みでない）→ 強制OFF
  // userB: 休み継続中（今日も昨日も休み）→ 何もしない（本人が手動でONにしていてもそのまま）
  // userC: 休みでない、現在OFF → ONにリセット
  // userD: 休みでない、現在ON → 何もしない
  ddbMock
    .on(QueryCommand, { TableName: "test-MemberDailyStatus", ExpressionAttributeValues: { ":date": today } })
    .resolves({ Items: [{ userId: "userA" }, { userId: "userB" }] });
  ddbMock
    .on(QueryCommand, { TableName: "test-MemberDailyStatus", ExpressionAttributeValues: { ":date": yesterday } })
    .resolves({ Items: [{ userId: "userB" }] });
  ddbMock.on(ScanCommand, { TableName: "test-Users" }).resolves({
    Items: [
      { userId: "userA", notificationStatus: "ON" },
      { userId: "userB", notificationStatus: "ON" },
      { userId: "userC", notificationStatus: "OFF" },
      { userId: "userD", notificationStatus: "ON" },
    ],
  });
  ddbMock.on(UpdateCommand).resolves({});

  await handler();

  const updateCalls = ddbMock.commandCalls(UpdateCommand).map((call) => ({
    userId: (call.args[0].input.Key as { userId: string }).userId,
    status: (call.args[0].input.ExpressionAttributeValues as { ":status": string })[":status"],
  }));

  expect(updateCalls).toContainEqual({ userId: "userA", status: "OFF" });
  expect(updateCalls).toContainEqual({ userId: "userC", status: "ON" });
  expect(updateCalls.find((c) => c.userId === "userB")).toBeUndefined();
  expect(updateCalls.find((c) => c.userId === "userD")).toBeUndefined();
});

test("誰も休みでなければ、現在OFFの人だけをONに戻す（既存動作）", async () => {
  ddbMock.on(QueryCommand, { TableName: "test-MemberDailyStatus" }).resolves({ Items: [] });
  ddbMock.on(ScanCommand, { TableName: "test-Users" }).resolves({
    Items: [
      { userId: "userC", notificationStatus: "OFF" },
      { userId: "userD", notificationStatus: "ON" },
    ],
  });
  ddbMock.on(UpdateCommand).resolves({});

  await handler();

  const updateCalls = ddbMock.commandCalls(UpdateCommand);
  expect(updateCalls).toHaveLength(1);
  expect(updateCalls[0].args[0].input.Key).toEqual({ userId: "userC" });
});
