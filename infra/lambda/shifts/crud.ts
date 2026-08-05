import { randomUUID } from "node:crypto";
import type { APIGatewayProxyEvent, APIGatewayProxyHandler } from "aws-lambda";
import { DeleteCommand, GetCommand, PutCommand, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import type { DailyNote, DutyType, LeaveReason, LeaveType, MemberDailyStatus, ShiftType } from "@on-connect/shared";
import { requirePermission } from "../common/authz";
import { docClient } from "../common/dynamo";
import {
  HttpError,
  getCurrentUserId,
  handleRequest,
  jsonResponse,
  parseJsonBody,
  requireParam,
} from "../common/http";

const DUTY_TYPES_TABLE_NAME = process.env.DUTY_TYPES_TABLE_NAME!;
const SHIFT_TYPES_TABLE_NAME = process.env.SHIFT_TYPES_TABLE_NAME!;
const MEMBER_DAILY_STATUS_TABLE_NAME = process.env.MEMBER_DAILY_STATUS_TABLE_NAME!;
const DAILY_NOTES_TABLE_NAME = process.env.DAILY_NOTES_TABLE_NAME!;
const USERS_TABLE_NAME = process.env.USERS_TABLE_NAME!;

/**
 * 休日・当番・シフトの管理API。全ての書き込み（本人の分も含む）はmanageShifts権限が必要、
 * 閲覧は認証済みなら誰でも可能（「誰が今日休みか」を全員に見せることが本機能の肝のため）。
 */
export const handler: APIGatewayProxyHandler = async (event) =>
  handleRequest(async () => {
    const { resource, httpMethod } = event;

    if (resource === "/duty-types") {
      if (httpMethod === "GET") return listDutyTypes();
      if (httpMethod === "POST") return createDutyType(event);
    }
    if (resource === "/duty-types/{dutyTypeId}") {
      const dutyTypeId = requireParam(event, "dutyTypeId");
      if (httpMethod === "PUT") return updateDutyType(dutyTypeId, event);
      if (httpMethod === "DELETE") return deleteDutyType(dutyTypeId, event);
    }
    if (resource === "/shift-types") {
      if (httpMethod === "GET") return listShiftTypes();
      if (httpMethod === "POST") return createShiftType(event);
    }
    if (resource === "/shift-types/{shiftTypeId}") {
      const shiftTypeId = requireParam(event, "shiftTypeId");
      if (httpMethod === "PUT") return updateShiftType(shiftTypeId, event);
      if (httpMethod === "DELETE") return deleteShiftType(shiftTypeId, event);
    }
    if (resource === "/member-daily-status") {
      if (httpMethod === "GET") return listStatusesForDate(event);
    }
    if (resource === "/member-daily-status/{date}/{userId}") {
      const date = requireParam(event, "date");
      const userId = requireParam(event, "userId");
      if (httpMethod === "GET") return getStatus(date, userId);
      if (httpMethod === "PUT") return upsertStatus(date, userId, event);
      if (httpMethod === "DELETE") return deleteStatus(date, userId, event);
    }
    if (resource === "/daily-notes/{date}") {
      const date = requireParam(event, "date");
      if (httpMethod === "GET") return getDailyNote(date);
      if (httpMethod === "PUT") return upsertDailyNote(date, event);
      if (httpMethod === "DELETE") return deleteDailyNote(date, event);
    }

    throw new HttpError(404, `対応していないルートです: ${httpMethod} ${resource}`);
  });

// ---------------------------------------------------------------------------
// MemberDailyStatus
// ---------------------------------------------------------------------------

async function listStatusesForDate(event: APIGatewayProxyEvent) {
  const date = event.queryStringParameters?.date;
  if (!date) throw new HttpError(400, "date クエリパラメータは必須です");

  const result = await docClient.send(
    new QueryCommand({
      TableName: MEMBER_DAILY_STATUS_TABLE_NAME,
      KeyConditionExpression: "#date = :date",
      ExpressionAttributeNames: { "#date": "date" },
      ExpressionAttributeValues: { ":date": date },
    }),
  );
  return jsonResponse(200, result.Items ?? []);
}

async function getStatus(date: string, userId: string) {
  const status = await fetchStatus(date, userId);
  // レコードが無い(=その日は何も設定されていない)ことは正常な状態であり、404にはしない。
  return jsonResponse(200, status ?? { date, userId });
}

async function upsertStatus(date: string, userId: string, event: APIGatewayProxyEvent) {
  await requirePermission(event, "manageShifts", USERS_TABLE_NAME);

  const input = parseJsonBody<{
    leaveType?: LeaveType | null;
    leaveReason?: LeaveReason | null;
    amShiftTypeId?: string | null;
    pmShiftTypeId?: string | null;
    dutyTypeIds?: string[] | null;
  }>(event);
  const current = await fetchStatus(date, userId);

  const merged: MemberDailyStatus = {
    date,
    userId,
    leaveType: resolveField(current?.leaveType, input.leaveType),
    leaveReason: resolveField(current?.leaveReason, input.leaveReason),
    amShiftTypeId: resolveField(current?.amShiftTypeId, input.amShiftTypeId),
    pmShiftTypeId: resolveField(current?.pmShiftTypeId, input.pmShiftTypeId),
    dutyTypeIds: resolveField(current?.dutyTypeIds, input.dutyTypeIds),
    updatedAt: new Date().toISOString(),
    updatedBy: getCurrentUserId(event),
  };

  await docClient.send(new PutCommand({ TableName: MEMBER_DAILY_STATUS_TABLE_NAME, Item: merged }));
  return jsonResponse(200, merged);
}

async function deleteStatus(date: string, userId: string, event: APIGatewayProxyEvent) {
  await requirePermission(event, "manageShifts", USERS_TABLE_NAME);
  await docClient.send(new DeleteCommand({ TableName: MEMBER_DAILY_STATUS_TABLE_NAME, Key: { date, userId } }));
  return jsonResponse(204, {});
}

async function fetchStatus(date: string, userId: string): Promise<MemberDailyStatus | undefined> {
  const result = await docClient.send(
    new GetCommand({ TableName: MEMBER_DAILY_STATUS_TABLE_NAME, Key: { date, userId } }),
  );
  return result.Item as MemberDailyStatus | undefined;
}

/** inputのキーが無ければ現状維持、明示的なnullはクリア、値があれば置き換える */
function resolveField<T>(current: T | undefined, incoming: T | null | undefined): T | undefined {
  if (incoming === undefined) return current;
  if (incoming === null) return undefined;
  return incoming;
}

// ---------------------------------------------------------------------------
// DailyNote（日付単位、メンバーに紐づかない自由メモ）
// ---------------------------------------------------------------------------

async function getDailyNote(date: string) {
  const note = await fetchDailyNote(date);
  // レコードが無い(=その日はメモ無し)ことは正常な状態であり、404にはしない。
  return jsonResponse(200, note ?? { date, note: "" });
}

async function upsertDailyNote(date: string, event: APIGatewayProxyEvent) {
  await requirePermission(event, "manageShifts", USERS_TABLE_NAME);

  const input = parseJsonBody<{ note: string }>(event);
  if (typeof input.note !== "string") throw new HttpError(400, "note は必須です");

  const updated: DailyNote = {
    date,
    note: input.note,
    updatedAt: new Date().toISOString(),
    updatedBy: getCurrentUserId(event),
  };

  await docClient.send(new PutCommand({ TableName: DAILY_NOTES_TABLE_NAME, Item: updated }));
  return jsonResponse(200, updated);
}

async function deleteDailyNote(date: string, event: APIGatewayProxyEvent) {
  await requirePermission(event, "manageShifts", USERS_TABLE_NAME);
  await docClient.send(new DeleteCommand({ TableName: DAILY_NOTES_TABLE_NAME, Key: { date } }));
  return jsonResponse(204, {});
}

async function fetchDailyNote(date: string): Promise<DailyNote | undefined> {
  const result = await docClient.send(new GetCommand({ TableName: DAILY_NOTES_TABLE_NAME, Key: { date } }));
  return result.Item as DailyNote | undefined;
}

// ---------------------------------------------------------------------------
// DutyTypes
// ---------------------------------------------------------------------------

async function listDutyTypes() {
  const result = await docClient.send(new ScanCommand({ TableName: DUTY_TYPES_TABLE_NAME }));
  return jsonResponse(200, result.Items ?? []);
}

async function createDutyType(event: APIGatewayProxyEvent) {
  await requirePermission(event, "manageShifts", USERS_TABLE_NAME);

  const input = parseJsonBody<Pick<DutyType, "name"> & Partial<DutyType>>(event);
  if (!input.name) throw new HttpError(400, "name は必須です");

  const dutyType: DutyType = { dutyTypeId: randomUUID(), name: input.name, isActive: input.isActive ?? true };
  await docClient.send(new PutCommand({ TableName: DUTY_TYPES_TABLE_NAME, Item: dutyType }));
  return jsonResponse(201, dutyType);
}

async function updateDutyType(dutyTypeId: string, event: APIGatewayProxyEvent) {
  await requirePermission(event, "manageShifts", USERS_TABLE_NAME);

  const input = parseJsonBody<Partial<DutyType>>(event);
  const current = await fetchDutyType(dutyTypeId);
  if (!current) throw new HttpError(404, "当番の種類が見つかりません");

  const updated: DutyType = { ...current, ...input, dutyTypeId };
  await docClient.send(new PutCommand({ TableName: DUTY_TYPES_TABLE_NAME, Item: updated }));
  return jsonResponse(200, updated);
}

async function deleteDutyType(dutyTypeId: string, event: APIGatewayProxyEvent) {
  await requirePermission(event, "manageShifts", USERS_TABLE_NAME);

  const current = await fetchDutyType(dutyTypeId);
  if (!current) throw new HttpError(404, "当番の種類が見つかりません");

  await docClient.send(new DeleteCommand({ TableName: DUTY_TYPES_TABLE_NAME, Key: { dutyTypeId } }));
  return jsonResponse(204, {});
}

async function fetchDutyType(dutyTypeId: string): Promise<DutyType | undefined> {
  const result = await docClient.send(new GetCommand({ TableName: DUTY_TYPES_TABLE_NAME, Key: { dutyTypeId } }));
  return result.Item as DutyType | undefined;
}

// ---------------------------------------------------------------------------
// ShiftTypes
// ---------------------------------------------------------------------------

async function listShiftTypes() {
  const result = await docClient.send(new ScanCommand({ TableName: SHIFT_TYPES_TABLE_NAME }));
  return jsonResponse(200, result.Items ?? []);
}

async function createShiftType(event: APIGatewayProxyEvent) {
  await requirePermission(event, "manageShifts", USERS_TABLE_NAME);

  const input = parseJsonBody<Pick<ShiftType, "name"> & Partial<ShiftType>>(event);
  if (!input.name) throw new HttpError(400, "name は必須です");

  const shiftType: ShiftType = { shiftTypeId: randomUUID(), name: input.name, isActive: input.isActive ?? true };
  await docClient.send(new PutCommand({ TableName: SHIFT_TYPES_TABLE_NAME, Item: shiftType }));
  return jsonResponse(201, shiftType);
}

async function updateShiftType(shiftTypeId: string, event: APIGatewayProxyEvent) {
  await requirePermission(event, "manageShifts", USERS_TABLE_NAME);

  const input = parseJsonBody<Partial<ShiftType>>(event);
  const current = await fetchShiftType(shiftTypeId);
  if (!current) throw new HttpError(404, "シフトの種類が見つかりません");

  const updated: ShiftType = { ...current, ...input, shiftTypeId };
  await docClient.send(new PutCommand({ TableName: SHIFT_TYPES_TABLE_NAME, Item: updated }));
  return jsonResponse(200, updated);
}

async function deleteShiftType(shiftTypeId: string, event: APIGatewayProxyEvent) {
  await requirePermission(event, "manageShifts", USERS_TABLE_NAME);

  const current = await fetchShiftType(shiftTypeId);
  if (!current) throw new HttpError(404, "シフトの種類が見つかりません");

  await docClient.send(new DeleteCommand({ TableName: SHIFT_TYPES_TABLE_NAME, Key: { shiftTypeId } }));
  return jsonResponse(204, {});
}

async function fetchShiftType(shiftTypeId: string): Promise<ShiftType | undefined> {
  const result = await docClient.send(new GetCommand({ TableName: SHIFT_TYPES_TABLE_NAME, Key: { shiftTypeId } }));
  return result.Item as ShiftType | undefined;
}
