import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { AppSyncResolverHandler } from "aws-lambda";
import type { Message } from "@on-connect/shared";
import { toggleReaction } from "@on-connect/shared";
import { docClient } from "../common/dynamo";

const MESSAGES_TABLE_NAME = process.env.MESSAGES_TABLE_NAME!;

interface ToggleReactionInput {
  roomId: string;
  messageId: string;
  emoji: string;
  userId: string;
}

/**
 * チャットメッセージの絵文字リアクショントグル（Phase 9）。
 * 絵文字ごとのuserIds配列への追加/削除・0人になったら要素ごと削除、というトグルロジックは
 * DynamoDBのUpdateExpressionだけでは表現できない（read-modify-writeが必要）ため、
 * chat-construct.ts内の他のリゾルバ（VTL＋DynamoDBデータソース）とは異なり、
 * このミューテーションだけLambda裏付けのリゾルバにしている。
 */
export const handler: AppSyncResolverHandler<{ input: ToggleReactionInput }, Message> = async (event) => {
  const { roomId, messageId, emoji, userId } = event.arguments.input;

  const existing = await docClient.send(new GetCommand({ TableName: MESSAGES_TABLE_NAME, Key: { roomId, messageId } }));
  const message = existing.Item as Message | undefined;
  if (!message) throw new Error("メッセージが見つかりません");

  const reactions = toggleReaction(message.reactions, emoji, userId);
  await docClient.send(
    new UpdateCommand({
      TableName: MESSAGES_TABLE_NAME,
      Key: { roomId, messageId },
      UpdateExpression: "SET reactions = :reactions",
      ExpressionAttributeValues: { ":reactions": reactions },
    }),
  );

  return { ...message, reactions };
};
