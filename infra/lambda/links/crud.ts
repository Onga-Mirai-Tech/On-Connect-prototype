import { randomUUID } from "node:crypto";
import type { APIGatewayProxyEvent, APIGatewayProxyHandler } from "aws-lambda";
import { DeleteCommand, GetCommand, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import type { OrgLink } from "@on-connect/shared";
import { docClient } from "../common/dynamo";
import {
  HttpError,
  getCurrentUserId,
  handleRequest,
  jsonResponse,
  parseJsonBody,
  requireParam,
} from "../common/http";

const ORG_LINKS_TABLE_NAME = process.env.ORG_LINKS_TABLE_NAME!;

/** 外部リンク集（ブックマーク）のCRUD（設計書5.5） */
export const handler: APIGatewayProxyHandler = async (event) =>
  handleRequest(async () => {
    const { resource, httpMethod } = event;

    if (resource === "/org-links") {
      if (httpMethod === "GET") return listLinks();
      if (httpMethod === "POST") return createLink(event);
    }
    if (resource === "/org-links/{linkId}") {
      const linkId = requireParam(event, "linkId");
      if (httpMethod === "PUT") return updateLink(linkId, event);
      if (httpMethod === "DELETE") return deleteLink(linkId);
    }

    throw new HttpError(404, `対応していないルートです: ${httpMethod} ${resource}`);
  });

async function listLinks() {
  const result = await docClient.send(new ScanCommand({ TableName: ORG_LINKS_TABLE_NAME }));
  const links = (result.Items as OrgLink[] | undefined) ?? [];
  links.sort((a, b) => a.sortOrder - b.sortOrder);
  return jsonResponse(200, links);
}

async function createLink(event: APIGatewayProxyEvent) {
  const createdBy = getCurrentUserId(event);
  const input = parseJsonBody<Pick<OrgLink, "title" | "url"> & Partial<OrgLink>>(event);
  if (!input.title) throw new HttpError(400, "title は必須です");
  if (!input.url) throw new HttpError(400, "url は必須です");

  const link: OrgLink = {
    linkId: randomUUID(),
    title: input.title,
    url: input.url,
    ...(input.category ? { category: input.category } : {}),
    sortOrder: input.sortOrder ?? 0,
    createdBy,
    updatedAt: new Date().toISOString(),
  };

  await docClient.send(new PutCommand({ TableName: ORG_LINKS_TABLE_NAME, Item: link }));
  return jsonResponse(201, link);
}

async function updateLink(linkId: string, event: APIGatewayProxyEvent) {
  const input = parseJsonBody<Partial<OrgLink>>(event);
  const current = await fetchLink(linkId);
  if (!current) throw new HttpError(404, "リンクが見つかりません");

  const updated: OrgLink = {
    ...current,
    ...input,
    linkId,
    updatedAt: new Date().toISOString(),
  };

  await docClient.send(new PutCommand({ TableName: ORG_LINKS_TABLE_NAME, Item: updated }));
  return jsonResponse(200, updated);
}

async function deleteLink(linkId: string) {
  const current = await fetchLink(linkId);
  if (!current) throw new HttpError(404, "リンクが見つかりません");

  await docClient.send(new DeleteCommand({ TableName: ORG_LINKS_TABLE_NAME, Key: { linkId } }));
  return jsonResponse(204, {});
}

async function fetchLink(linkId: string): Promise<OrgLink | undefined> {
  const result = await docClient.send(new GetCommand({ TableName: ORG_LINKS_TABLE_NAME, Key: { linkId } }));
  return result.Item as OrgLink | undefined;
}
