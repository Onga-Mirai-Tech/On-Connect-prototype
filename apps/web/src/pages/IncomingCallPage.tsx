import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Phone, PhoneOff, Mic, MicOff } from "lucide-react";
import {
  DefaultDeviceController,
  DefaultMeetingSession,
  MeetingSessionConfiguration,
  ConsoleLogger,
  LogLevel,
  type AudioVideoObserver,
} from "amazon-chime-sdk-js";
import type { CallStatus } from "@on-connect/shared";
import { colors } from "../theme/colors";
import { useAuth } from "../context/AuthContext";
import { callClient } from "../api/callClient";

/** 応答待ちのタイムアウト（着信・呼び出し中とも共通、5.2.4） */
const RING_TIMEOUT_MS = 30_000;

type CallLocationState =
  | {
      role: "caller";
      callId: string;
      calleeId: string;
      calleeName: string;
      meeting: unknown;
      callerAttendee: unknown;
      startTime: string;
    }
  | {
      role: "callee";
      callId: string;
      callerId: string;
      callerName: string;
      meetingJson: string;
      calleeAttendeeJson: string;
      startTime: string;
    };

type Phase = "outgoing" | "incoming" | "in-call";

/**
 * 通話画面（7章 5番）：発信中／着信中／通話中の3状態を持つフルスクリーン画面（5.2.4）。
 * 発信側（role: "caller"）は遷移直後にChime SDK Meetingへ即参加し、着信側の応答（presence）を
 * 検知するまで「発信中」を表示する。着信側（role: "callee"）は応答するまでMeetingへ参加しない
 * （同意前にマイクを起動しないため）。
 * CallLogsへの記録（POST /calls/{callId}/end）はどちらの端末からでも呼べ、バックエンド側で
 * 最初の1回だけ記録される（発信者のタイムアウトと着信者の操作が競合するケースへの対処）。
 */
export function IncomingCallPage() {
  const { currentUserId } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as CallLocationState | null;

  const [phase, setPhase] = useState<Phase>(state?.role === "callee" ? "incoming" : "outgoing");
  const [muted, setMuted] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const meetingSessionRef = useRef<DefaultMeetingSession | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const hasEndedRef = useRef(false);
  const connectedAtRef = useRef<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const callerId = state?.role === "caller" ? (currentUserId ?? "") : (state?.callerId ?? "");
  const calleeId = state?.role === "callee" ? (currentUserId ?? "") : (state?.calleeId ?? "");
  const displayName = state?.role === "caller" ? state.calleeName : (state?.callerName ?? "");

  const cleanupTimers = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const endCall = async (status: CallStatus) => {
    if (hasEndedRef.current || !state) return;
    hasEndedRef.current = true;
    cleanupTimers();

    if (meetingSessionRef.current) {
      meetingSessionRef.current.audioVideo.stop();
      meetingSessionRef.current = null;
    }

    try {
      await callClient.endCall(state.callId, {
        callerId,
        calleeId,
        startTime: connectedAtRef.current ?? state.startTime,
        status,
      });
    } catch (err) {
      console.error("endCall呼び出しに失敗しました", err);
    }
    navigate(-1);
  };

  const startMeetingSession = (meetingResponse: unknown, attendeeResponse: unknown) => {
    const logger = new ConsoleLogger("ChimeMeeting", LogLevel.WARN);
    const deviceController = new DefaultDeviceController(logger);
    const configuration = new MeetingSessionConfiguration(meetingResponse, attendeeResponse);
    const session = new DefaultMeetingSession(configuration, logger, deviceController);
    meetingSessionRef.current = session;

    const observer: AudioVideoObserver = {
      audioVideoDidStop: () => {
        // 相手が先に切断した場合もここに来る。自分から呼んでいなければ「完了」として記録する
        if (!hasEndedRef.current) void endCall("completed");
      },
    };
    session.audioVideo.addObserver(observer);

    session.audioVideo
      .listAudioInputDevices()
      .then((devices) => (devices[0] ? session.audioVideo.startAudioInput(devices[0].deviceId) : undefined))
      .then(() => {
        if (audioElementRef.current) return session.audioVideo.bindAudioElement(audioElementRef.current);
      })
      .then(() => session.audioVideo.start())
      .catch((err) => {
        console.error("マイクの起動に失敗しました", err);
        setErrorMessage("マイクを利用できませんでした。ブラウザのマイク権限をご確認ください。");
      });

    return session;
  };

  const beginInCall = () => {
    cleanupTimers();
    connectedAtRef.current = new Date().toISOString();
    setPhase("in-call");
    intervalRef.current = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
  };

  // 発信側：即座にMeetingへ参加し、着信側の応答（presence）を検知したら通話中へ切り替える
  useEffect(() => {
    if (!state || state.role !== "caller") return;
    const session = startMeetingSession(state.meeting, state.callerAttendee);

    const onPresence = (
      _attendeeId: string,
      present: boolean,
      externalUserId?: string,
    ) => {
      if (present && externalUserId === state.calleeId) beginInCall();
    };
    session.audioVideo.realtimeSubscribeToAttendeeIdPresence(onPresence);

    timeoutRef.current = setTimeout(() => void endCall("missed"), RING_TIMEOUT_MS);

    return () => {
      session.audioVideo.realtimeUnsubscribeToAttendeeIdPresence(onPresence);
      cleanupTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 着信側：応答が無ければタイムアウトでmissed扱いにする
  useEffect(() => {
    if (!state || state.role !== "callee") return;
    timeoutRef.current = setTimeout(() => void endCall("missed"), RING_TIMEOUT_MS);
    return cleanupTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!state || !currentUserId) {
    return (
      <div style={styles.container}>
        <p style={{ color: "#fff" }}>通話情報が見つかりません。</p>
      </div>
    );
  }

  const handleAccept = () => {
    if (state.role !== "callee") return;
    startMeetingSession(JSON.parse(state.meetingJson), JSON.parse(state.calleeAttendeeJson));
    beginInCall();
  };

  const handleDecline = () => void endCall("declined");
  const handleHangUp = () => void endCall(phase === "in-call" ? "completed" : "missed");

  const toggleMute = () => {
    const session = meetingSessionRef.current;
    if (!session) return;
    if (muted) session.audioVideo.realtimeUnmuteLocalAudio();
    else session.audioVideo.realtimeMuteLocalAudio();
    setMuted((m) => !m);
  };

  const minutes = String(Math.floor(elapsedSeconds / 60)).padStart(2, "0");
  const seconds = String(elapsedSeconds % 60).padStart(2, "0");

  return (
    <div style={styles.container}>
      <audio ref={audioElementRef} autoPlay style={{ display: "none" }} />
      <p style={{ fontSize: 14 }}>
        {phase === "outgoing" && "発信中..."}
        {phase === "incoming" && "着信中..."}
        {phase === "in-call" && `通話中 ${minutes}:${seconds}`}
      </p>
      <h1>{displayName}</h1>
      {errorMessage && <p style={{ color: colors.danger, fontSize: 13 }}>{errorMessage}</p>}
      <div style={{ display: "flex", gap: 24 }}>
        {phase === "incoming" ? (
          <>
            <button onClick={handleDecline} style={{ ...styles.circleButton, background: colors.danger }}>
              <PhoneOff color="#fff" />
            </button>
            <button onClick={handleAccept} style={{ ...styles.circleButton, background: colors.brand }}>
              <Phone color="#1A1A1A" />
            </button>
          </>
        ) : (
          <>
            {phase === "in-call" && (
              <button onClick={toggleMute} style={{ ...styles.circleButton, background: colors.surface }}>
                {muted ? <MicOff color="#1A1A1A" /> : <Mic color="#1A1A1A" />}
              </button>
            )}
            <button onClick={handleHangUp} style={{ ...styles.circleButton, background: colors.danger }}>
              <PhoneOff color="#fff" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    background: colors.brandDark,
    color: "#fff",
    gap: 24,
  },
  circleButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "50%",
    width: 64,
    height: 64,
  },
} as const;
