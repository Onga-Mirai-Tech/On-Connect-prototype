import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as ChimeAudioCall from "chime-audio-call";
import type { CallStatus } from "@on-connect/shared";
import type { RootStackParamList } from "../navigation/AppNavigator";
import { colors } from "../theme/colors";
import { useAuth } from "../context/AuthContext";
import { callClient } from "../api/callClient";

type Props = NativeStackScreenProps<RootStackParamList, "IncomingCall">;

/** 応答待ちのタイムアウト（着信・呼び出し中とも共通、5.2.4） */
const RING_TIMEOUT_MS = 30_000;

type Phase = "outgoing" | "incoming" | "in-call";

/**
 * 通話画面（7章 5番）：発信中／着信中／通話中の3状態を持つフルスクリーン画面（5.2.4）。
 * Web版（apps/web/src/pages/IncomingCallPage.tsx）と同じ設計：発信側（role: "caller"）は
 * 画面遷移直後にChime SDK Meetingへ即参加し、着信側の応答（presence）を検知するまで
 * 「発信中」を表示する。着信側（role: "callee"）は応答するまでMeetingへ参加しない
 * （同意前にマイクを起動しないため）。
 * CallLogsへの記録（POST /calls/{callId}/end）はどちらの端末からでも呼べ、バックエンド側で
 * 最初の1回だけ記録される（発信者のタイムアウトと着信者の操作が競合するケースへの対処）。
 */
export function IncomingCallScreen({ route, navigation }: Props) {
  const { currentUserId } = useAuth();
  const params = route.params;

  const [phase, setPhase] = useState<Phase>(params.role === "callee" ? "incoming" : "outgoing");
  const [muted, setMuted] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const hasStartedRef = useRef(false);
  const hasEndedRef = useRef(false);
  const connectedAtRef = useRef<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const callerId = params.role === "caller" ? (currentUserId ?? "") : params.callerId;
  const calleeId = params.role === "callee" ? (currentUserId ?? "") : params.calleeId;
  const displayName = params.role === "caller" ? params.calleeName : params.callerName;

  const cleanupTimers = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const endCall = async (status: CallStatus) => {
    if (hasEndedRef.current) return;
    hasEndedRef.current = true;
    cleanupTimers();

    if (hasStartedRef.current) {
      hasStartedRef.current = false;
      await ChimeAudioCall.stopMeeting().catch(() => undefined);
    }

    try {
      await callClient.endCall(params.callId, {
        callerId,
        calleeId,
        startTime: connectedAtRef.current ?? params.startTime,
        status,
      });
    } catch (err) {
      console.error("endCall呼び出しに失敗しました", err);
    }
    navigation.goBack();
  };

  const beginInCall = () => {
    cleanupTimers();
    connectedAtRef.current = new Date().toISOString();
    setPhase("in-call");
    intervalRef.current = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
  };

  const startMeetingSession = async (meetingJson: string, attendeeJson: string) => {
    try {
      await ChimeAudioCall.startMeeting(meetingJson, attendeeJson);
      hasStartedRef.current = true;
    } catch (err) {
      console.error("マイクの起動に失敗しました", err);
      setErrorMessage("マイクを利用できませんでした。設定アプリでマイクの権限をご確認ください。");
    }
  };

  // イベント購読は常時（役割に関わらず）行い、セッション終了・エラーを検知する
  useEffect(() => {
    const sessionStoppedSub = ChimeAudioCall.addSessionStoppedListener(() => {
      if (!hasEndedRef.current) void endCall("completed");
    });
    const errorSub = ChimeAudioCall.addErrorListener((event) => {
      setErrorMessage(event.message);
    });
    return () => {
      sessionStoppedSub.remove();
      errorSub.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 発信側：即座にMeetingへ参加し、着信側の応答（presence）を検知したら通話中へ切り替える
  useEffect(() => {
    if (params.role !== "caller") return;
    void startMeetingSession(params.meetingJson, params.attendeeJson);

    const attendeeJoinedSub = ChimeAudioCall.addAttendeeJoinedListener((event) => {
      if (event.externalUserId === params.calleeId) beginInCall();
    });

    timeoutRef.current = setTimeout(() => void endCall("missed"), RING_TIMEOUT_MS);

    return () => {
      attendeeJoinedSub.remove();
      cleanupTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 着信側：応答が無ければタイムアウトでmissed扱いにする
  useEffect(() => {
    if (params.role !== "callee") return;
    timeoutRef.current = setTimeout(() => void endCall("missed"), RING_TIMEOUT_MS);
    return cleanupTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAccept = () => {
    if (params.role !== "callee") return;
    void startMeetingSession(params.meetingJson, params.calleeAttendeeJson).then(() => beginInCall());
  };

  const handleDecline = () => void endCall("declined");
  const handleHangUp = () => void endCall(phase === "in-call" ? "completed" : "missed");

  const toggleMute = async () => {
    const success = await ChimeAudioCall.setMuted(!muted).catch(() => false);
    if (success) setMuted((m) => !m);
  };

  const minutes = String(Math.floor(elapsedSeconds / 60)).padStart(2, "0");
  const seconds = String(elapsedSeconds % 60).padStart(2, "0");

  return (
    <View style={styles.container}>
      <Text style={styles.subtitle}>
        {phase === "outgoing" && "発信中..."}
        {phase === "incoming" && "着信中..."}
        {phase === "in-call" && `通話中 ${minutes}:${seconds}`}
      </Text>
      <Text style={styles.callerName}>{displayName}</Text>
      {errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}
      <View style={styles.actions}>
        {phase === "incoming" ? (
          <>
            <Pressable style={[styles.circle, { backgroundColor: colors.danger }]} onPress={handleDecline}>
              <Ionicons name="call-outline" size={28} color="#fff" style={{ transform: [{ rotate: "135deg" }] }} />
            </Pressable>
            <Pressable style={[styles.circle, { backgroundColor: colors.brand }]} onPress={handleAccept}>
              <Ionicons name="call-outline" size={28} color="#1A1A1A" />
            </Pressable>
          </>
        ) : (
          <>
            {phase === "in-call" && (
              <Pressable style={[styles.circle, { backgroundColor: colors.surface }]} onPress={() => void toggleMute()}>
                <Ionicons name={muted ? "mic-off-outline" : "mic-outline"} size={26} color="#1A1A1A" />
              </Pressable>
            )}
            <Pressable style={[styles.circle, { backgroundColor: colors.danger }]} onPress={handleHangUp}>
              <Ionicons name="call-outline" size={28} color="#fff" style={{ transform: [{ rotate: "135deg" }] }} />
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1A1A1A",
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
  },
  subtitle: { color: "#fff", fontSize: 14 },
  callerName: { color: "#fff", fontSize: 28, fontWeight: "700" },
  errorText: { color: colors.danger, fontSize: 13, textAlign: "center", paddingHorizontal: 24 },
  actions: { flexDirection: "row", gap: 32 },
  circle: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
});
