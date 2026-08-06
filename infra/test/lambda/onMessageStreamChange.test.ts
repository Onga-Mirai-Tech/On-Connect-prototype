process.env.SCHEDULE_GROUP_NAME = "test-schedule-group";
process.env.TARGET_LAMBDA_ARN = "arn:aws:lambda:ap-northeast-1:123456789012:function:test-send-scheduled";
process.env.SCHEDULER_ROLE_ARN = "arn:aws:iam::123456789012:role/test-scheduler-role";

import { mockClient } from "aws-sdk-client-mock";
import { SchedulerClient, CreateScheduleCommand, DeleteScheduleCommand, ResourceNotFoundException } from "@aws-sdk/client-scheduler";
import { marshall } from "@aws-sdk/util-dynamodb";
import type { DynamoDBStreamEvent } from "aws-lambda";
import type { Message } from "@on-connect/shared";
import { handler } from "../../lambda/messages/onMessageStreamChange";

const schedulerMock = mockClient(SchedulerClient);

function buildMessage(overrides: Partial<Message> = {}): Message {
  return {
    messageId: "msg1234567890abcdef1234567890ab",
    roomId: "room-1",
    senderId: "sender-1",
    body: "こんにちは",
    readByUserIds: [],
    status: "sent",
    forceNotify: false,
    createdAt: "2026-08-05T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  schedulerMock.reset();
});

test("INSERTかつstatus:scheduledならCreateScheduleを呼ぶ", async () => {
  schedulerMock.on(CreateScheduleCommand).resolves({});
  const message = buildMessage({ status: "scheduled", scheduledAt: "2026-08-07T15:30:00+09:00" });
  const event: DynamoDBStreamEvent = {
    Records: [{ eventName: "INSERT", dynamodb: { NewImage: marshall(message, { removeUndefinedValues: true }) as never } }],
  } as DynamoDBStreamEvent;

  await handler(event, {} as never, (() => {}) as never);

  const calls = schedulerMock.commandCalls(CreateScheduleCommand);
  expect(calls).toHaveLength(1);
  expect(calls[0].args[0].input.Name).toBe(message.messageId);
  expect(calls[0].args[0].input.GroupName).toBe("test-schedule-group");
  expect(calls[0].args[0].input.ScheduleExpression).toBe("at(2026-08-07T15:30:00)");
  expect(calls[0].args[0].input.ScheduleExpressionTimezone).toBe("Asia/Tokyo");
  expect(calls[0].args[0].input.Target?.Arn).toBe(process.env.TARGET_LAMBDA_ARN);
  expect(JSON.parse(calls[0].args[0].input.Target!.Input!)).toEqual({
    roomId: "room-1",
    messageId: message.messageId,
  });
});

test("INSERTでもstatus:sent（即時送信）ならCreateScheduleを呼ばない", async () => {
  const message = buildMessage({ status: "sent" });
  const event: DynamoDBStreamEvent = {
    Records: [{ eventName: "INSERT", dynamodb: { NewImage: marshall(message, { removeUndefinedValues: true }) as never } }],
  } as DynamoDBStreamEvent;

  await handler(event, {} as never, (() => {}) as never);

  expect(schedulerMock.commandCalls(CreateScheduleCommand)).toHaveLength(0);
});

test("REMOVE（取消）でstatus:scheduledだったならDeleteScheduleを呼ぶ", async () => {
  schedulerMock.on(DeleteScheduleCommand).resolves({});
  const message = buildMessage({ status: "scheduled", scheduledAt: "2026-08-07T15:30:00+09:00" });
  const event: DynamoDBStreamEvent = {
    Records: [{ eventName: "REMOVE", dynamodb: { OldImage: marshall(message, { removeUndefinedValues: true }) as never } }],
  } as DynamoDBStreamEvent;

  await handler(event, {} as never, (() => {}) as never);

  const calls = schedulerMock.commandCalls(DeleteScheduleCommand);
  expect(calls).toHaveLength(1);
  expect(calls[0].args[0].input.Name).toBe(message.messageId);
});

test("MODIFYでstatusがscheduledから離脱（配信完了）したらDeleteScheduleを呼ぶ", async () => {
  schedulerMock.on(DeleteScheduleCommand).resolves({});
  const oldMessage = buildMessage({ status: "scheduled", scheduledAt: "2026-08-07T15:30:00+09:00" });
  const newMessage = buildMessage({ status: "sent", scheduledAt: "2026-08-07T15:30:00+09:00" });
  const event: DynamoDBStreamEvent = {
    Records: [
      {
        eventName: "MODIFY",
        dynamodb: {
          OldImage: marshall(oldMessage, { removeUndefinedValues: true }) as never,
          NewImage: marshall(newMessage, { removeUndefinedValues: true }) as never,
        },
      },
    ],
  } as DynamoDBStreamEvent;

  await handler(event, {} as never, (() => {}) as never);

  expect(schedulerMock.commandCalls(DeleteScheduleCommand)).toHaveLength(1);
});

test("MODIFYでstatusがscheduledのまま変化しない場合（リアクション更新等）は何もしない", async () => {
  const oldMessage = buildMessage({ status: "scheduled", scheduledAt: "2026-08-07T15:30:00+09:00", reactions: [] });
  const newMessage = buildMessage({
    status: "scheduled",
    scheduledAt: "2026-08-07T15:30:00+09:00",
    reactions: [{ emoji: "👍", userIds: ["u1"] }],
  });
  const event: DynamoDBStreamEvent = {
    Records: [
      {
        eventName: "MODIFY",
        dynamodb: {
          OldImage: marshall(oldMessage, { removeUndefinedValues: true }) as never,
          NewImage: marshall(newMessage, { removeUndefinedValues: true }) as never,
        },
      },
    ],
  } as DynamoDBStreamEvent;

  await handler(event, {} as never, (() => {}) as never);

  expect(schedulerMock.commandCalls(CreateScheduleCommand)).toHaveLength(0);
  expect(schedulerMock.commandCalls(DeleteScheduleCommand)).toHaveLength(0);
});

test("DeleteSchedule時にResourceNotFoundExceptionが起きても無視する（発火後の自動削除と競合するケース）", async () => {
  schedulerMock.on(DeleteScheduleCommand).rejects(
    new ResourceNotFoundException({ message: "not found", Message: "not found", $metadata: {} }),
  );
  const message = buildMessage({ status: "scheduled", scheduledAt: "2026-08-07T15:30:00+09:00" });
  const event: DynamoDBStreamEvent = {
    Records: [{ eventName: "REMOVE", dynamodb: { OldImage: marshall(message, { removeUndefinedValues: true }) as never } }],
  } as DynamoDBStreamEvent;

  await expect(handler(event, {} as never, (() => {}) as never)).resolves.not.toThrow();
});
