import { Sha256 } from "@aws-crypto/sha256-js";
import { defaultProvider } from "@aws-sdk/credential-provider-node";
import { SignatureV4 } from "@smithy/signature-v4";
import type { HttpRequest } from "@smithy/types";

const REGION = process.env.AWS_REGION!;

/**
 * IAM(SigV4)署名付きでAppSyncのGraphQLエンドポイントを呼び出す共通ヘルパー。
 * このプロジェクト唯一のLambda→AppSync呼び出し（sendScheduled.tsの予約送信配信で使用）。
 * 呼び出し先のAppSync GraphQL APIにadditionalAuthorizationModesとしてIAMを追加している前提
 * （infra/lib/constructs/chat-construct.ts参照）。IAM側の権限は呼び出すフィールド単位で
 * `GraphqlApi.grant()`により絞り込む。
 */
export async function callAppSyncGraphQL<T>(
  apiUrl: string,
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const url = new URL(apiUrl);
  const body = JSON.stringify({ query, variables });

  const signer = new SignatureV4({
    service: "appsync",
    region: REGION,
    credentials: defaultProvider(),
    sha256: Sha256,
  });

  const request: HttpRequest = {
    method: "POST",
    protocol: url.protocol,
    hostname: url.hostname,
    path: url.pathname,
    headers: {
      host: url.hostname,
      "content-type": "application/json",
    },
    body,
  };

  const signed = await signer.sign(request);

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: signed.headers as Record<string, string>,
    body,
  });

  const json = (await res.json()) as { data?: T; errors?: unknown[] };
  if (!res.ok || json.errors) {
    throw new Error(`AppSync呼び出しに失敗しました: ${JSON.stringify(json.errors ?? res.statusText)}`);
  }
  return json.data as T;
}
