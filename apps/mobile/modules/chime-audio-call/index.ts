import { EventEmitter, requireNativeModule, type Subscription } from "expo-modules-core";
import type { ChimeAttendeeEventPayload, ChimeErrorEventPayload } from "./src/ChimeAudioCall.types";

type ChimeAudioCallNativeModule = {
  startMeeting(meetingJson: string, attendeeJson: string): Promise<void>;
  stopMeeting(): Promise<void>;
  setMuted(muted: boolean): Promise<boolean>;
};

const nativeModule = requireNativeModule<ChimeAudioCallNativeModule>("ChimeAudioCall");
// NativeModuleの各フィールドが全てoptionalなため、プロパティが1つも重ならないとTSが構造的に
// 弾く（TS2559）。Sweet APIのモジュールは実行時に__expo_module_name__を持つため実際は安全。
const emitter = new EventEmitter(nativeModule as unknown as ConstructorParameters<typeof EventEmitter>[0]);

/**
 * 音声通話用のMeetingへ参加する（マイクを起動する）。
 * meetingJson/attendeeJsonは、Chime SDK MeetingsのCreateMeetingCommand/CreateAttendeeCommandの
 * 生レスポンス（{"Meeting": {...}} / {"Attendee": {...}}）をJSON.stringifyした文字列をそのまま渡す
 * （バックエンド・Web版と同じ生JSON形式、apps/mobile/src/api/callClient.ts参照）。
 */
export function startMeeting(meetingJson: string, attendeeJson: string): Promise<void> {
  return nativeModule.startMeeting(meetingJson, attendeeJson);
}

/** Meetingから退出する（マイクを停止する）。 */
export function stopMeeting(): Promise<void> {
  return nativeModule.stopMeeting();
}

/** ミュート状態を切り替える。戻り値は成否。 */
export function setMuted(muted: boolean): Promise<boolean> {
  return nativeModule.setMuted(muted);
}

/** 相手（着信者）がMeetingに参加したことを検知する（発信側の「発信中→通話中」判定に使う）。 */
export function addAttendeeJoinedListener(
  listener: (event: ChimeAttendeeEventPayload) => void,
): Subscription {
  return emitter.addListener("onAttendeeJoined", listener);
}

export function addAttendeeLeftListener(
  listener: (event: ChimeAttendeeEventPayload) => void,
): Subscription {
  return emitter.addListener("onAttendeeLeft", listener);
}

/** 相手の切断・通信断などでオーディオセッションが終了した（自分からの明示的な切断は含まない）。 */
export function addSessionStoppedListener(listener: () => void): Subscription {
  return emitter.addListener("onSessionStopped", listener);
}

export function addErrorListener(listener: (event: ChimeErrorEventPayload) => void): Subscription {
  return emitter.addListener("onError", listener);
}

export type { ChimeAttendeeEventPayload, ChimeErrorEventPayload };
