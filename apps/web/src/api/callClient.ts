import { fetchAuthSession } from "aws-amplify/auth";
import { generateClient, type GraphQLSubscription } from "aws-amplify/api";
import type { CallLog, CallStatus } from "@on-connect/shared";

const API_URL = import.meta.env.VITE_API_URL;
const GRAPHQL_API_URL = import.meta.env.VITE_GRAPHQL_API_URL;

class CallApiError extends Error {}

const client = generateClient();

export interface InitiateCallResult {
  callId: string;
  meeting: unknown;
  callerAttendee: unknown;
}

export interface EndCallInput {
  callerId: string;
  calleeId: string;
  startTime: string;
  status: CallStatus;
}

/** onIncomingCall購読の1件分。meeting/calleeAttendeeはamazon-chime-sdk-jsへJSON文字列のまま渡す */
export interface IncomingCallNotification {
  callId: string;
  callerId: string;
  callerName: string;
  calleeId: string;
  meetingJson: string;
  calleeAttendeeJson: string;
}

/** Cognitoのトークンを付けてREST APIを呼ぶ（orgApi.ts・chatClient.tsと同じ形） */
async function authFetch(path: string, options: RequestInit = {}): Promise<Response> {
  if (!API_URL) throw new CallApiError("API未接続");
  const session = await fetchAuthSession();
  const token = session.tokens?.idToken?.toString() ?? "";
  return fetch(`${API_URL}${path}`, {
    ...options,
    headers: { ...options.headers, Authorization: token, "Content-Type": "application/json" },
  });
}

async function authFetchJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await authFetch(path, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { message?: string });
    throw new CallApiError(body.message ?? `リクエストに失敗しました（${res.status}）`);
  }
  return (await res.json()) as T;
}

const onIncomingCallSubscription = `subscription OnIncomingCall($calleeId: ID!) {
  onIncomingCall(calleeId: $calleeId) {
    callId
    callerId
    callerName
    calleeId
    meetingJson
    calleeAttendeeJson
  }
}`;

export const callClient = {
  /** 1対1音声通話の発信。成功時、自分（発信者）のMeeting/Attendee情報を返す（着信者には別途AppSync/プッシュで通知される） */
  initiateCall: (calleeId: string) =>
    authFetchJson<InitiateCallResult>("/calls", { method: "POST", body: JSON.stringify({ calleeId }) }),

  /** 通話終了の記録（completed/missed/declined）。どちらの当事者からでも呼べる（バックエンド側で1回だけ記録） */
  endCall: (callId: string, input: EndCallInput) =>
    authFetchJson<CallLog>(`/calls/${callId}/end`, { method: "POST", body: JSON.stringify(input) }),

  /** 自分（calleeId）宛ての着信を購読する。戻り値の関数を呼ぶと購読解除する。 */
  subscribeToIncomingCalls: (
    calleeId: string,
    onNext: (call: IncomingCallNotification) => void,
  ): (() => void) => {
    if (!GRAPHQL_API_URL) return () => {};
    const sub = client
      .graphql<GraphQLSubscription<{ onIncomingCall: IncomingCallNotification }>>({
        query: onIncomingCallSubscription,
        variables: { calleeId },
      })
      .subscribe({
        next: ({ data }) => {
          if (data?.onIncomingCall) onNext(data.onIncomingCall);
        },
        error: (err) => console.error("subscribeToIncomingCalls error", err),
      });
    return () => sub.unsubscribe();
  },
};
