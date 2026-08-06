import type { AttributeValue } from "@aws-sdk/client-dynamodb";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import type { DynamoDBStreamHandler } from "aws-lambda";
import type { BulletinPost, User } from "@on-connect/shared";
import { docClient } from "../common/dynamo";
import { isVisibleToCategory } from "../common/visibility";
import { publishPush } from "../common/push";

const USERS_TABLE_NAME = process.env.USERS_TABLE_NAME!;
const PUSH_TOPIC_ARN = process.env.PUSH_TOPIC_ARN!;

/**
 * 掲示板の新規投稿・更新通知（5.3.4）
 * 通知対象 = visibleCategoryIdsに該当するmemberCategoryIdを持ち、かつnotificationStatusがONのユーザー。
 * MODIFYはupdatedAtが変化した場合のみ通知する。reactions属性だけの更新はupdatedAtを変更しないため
 * （bulletin/crud.tsのtoggleBulletinReaction参照）、リアクション操作では通知を送らずに済む。
 */
export const handler: DynamoDBStreamHandler = async (event) => {
  const users = await fetchAllUsers();

  for (const record of event.Records) {
    if (record.eventName !== "INSERT" && record.eventName !== "MODIFY") continue;
    if (!record.dynamodb?.NewImage) continue;

    const post = unmarshall(record.dynamodb.NewImage as Record<string, AttributeValue>) as BulletinPost;

    if (record.eventName === "MODIFY") {
      const oldPost = record.dynamodb.OldImage
        ? (unmarshall(record.dynamodb.OldImage as Record<string, AttributeValue>) as BulletinPost)
        : undefined;
      if (oldPost?.updatedAt === post.updatedAt) continue;
    }

    const targetUserIds = users
      .filter((u) => isVisibleToCategory(post.visibleCategoryIds, u.memberCategoryId) && u.notificationStatus === "ON")
      .map((u) => u.userId);
    if (targetUserIds.length === 0) continue;

    await publishPush(PUSH_TOPIC_ARN, {
      type: "bulletin_post",
      postId: post.postId,
      title: post.title,
      targetUserIds,
    });
  }
};

async function fetchAllUsers(): Promise<Pick<User, "userId" | "memberCategoryId" | "notificationStatus">[]> {
  const users: Pick<User, "userId" | "memberCategoryId" | "notificationStatus">[] = [];
  let lastEvaluatedKey: Record<string, unknown> | undefined;

  do {
    const result = await docClient.send(
      new ScanCommand({
        TableName: USERS_TABLE_NAME,
        ProjectionExpression: "userId, memberCategoryId, notificationStatus",
        ExclusiveStartKey: lastEvaluatedKey,
      }),
    );
    users.push(
      ...((result.Items as Pick<User, "userId" | "memberCategoryId" | "notificationStatus">[] | undefined) ?? []),
    );
    lastEvaluatedKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastEvaluatedKey);

  return users;
}
