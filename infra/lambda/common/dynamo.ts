import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

export const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});

/** 組織初期セットアップ前かどうかの判定に使う（テーブルが完全に空か）。 */
export async function isTableEmpty(tableName: string): Promise<boolean> {
  const result = await docClient.send(new ScanCommand({ TableName: tableName, Limit: 1 }));
  return (result.Items ?? []).length === 0;
}
