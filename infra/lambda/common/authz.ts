import type { APIGatewayProxyEvent } from "aws-lambda";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import type { Role, RolePermissions, User } from "@on-connect/shared";
import { docClient } from "./dynamo";
import { HttpError, getCurrentUserId } from "./http";

/** 呼び出し元ユーザーのRolePermissionsを取得する（設計書5.1.3）。 */
export async function getCurrentUserPermissions(
  event: APIGatewayProxyEvent,
  usersTableName: string,
  rolesTableName: string,
): Promise<RolePermissions> {
  const userId = getCurrentUserId(event);
  const userResult = await docClient.send(new GetCommand({ TableName: usersTableName, Key: { userId } }));
  const user = userResult.Item as User | undefined;
  if (!user) throw new HttpError(403, "ユーザー情報が見つかりません");

  const roleResult = await docClient.send(
    new GetCommand({ TableName: rolesTableName, Key: { roleId: user.roleId } }),
  );
  const role = roleResult.Item as Role | undefined;
  if (!role) throw new HttpError(403, "ロール情報が見つかりません");

  return role.permissions;
}

/** 指定した権限フラグを呼び出し元が持たない場合は403を投げる。 */
export async function requirePermission(
  event: APIGatewayProxyEvent,
  permission: keyof RolePermissions,
  usersTableName: string,
  rolesTableName: string,
): Promise<void> {
  const permissions = await getCurrentUserPermissions(event, usersTableName, rolesTableName);
  if (!permissions[permission]) {
    throw new HttpError(403, `この操作には${permission}権限が必要です`);
  }
}
