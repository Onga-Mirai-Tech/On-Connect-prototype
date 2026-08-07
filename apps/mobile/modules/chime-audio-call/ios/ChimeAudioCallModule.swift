import ExpoModulesCore
import AmazonChimeSDK

// バックエンド（infra/lambda/calls/initiateCall.ts）がJSON.stringifyしたまま渡してくる、
// CreateMeetingCommand/CreateAttendeeCommandの生レスポンス形（PascalCaseキー）をデコードする。
// Web版（apps/web/src/pages/IncomingCallPage.tsx）が同じJSONをamazon-chime-sdk-jsへ
// そのまま渡せるのに対し、iOS/AndroidのネイティブSDKは独自の型を要求するため、ここで変換する。
private struct MeetingResponseJSON: Codable {
  struct MeetingPayload: Codable {
    struct MediaPlacementPayload: Codable {
      let AudioFallbackUrl: String
      let AudioHostUrl: String
      let SignalingUrl: String
      let TurnControlUrl: String
    }
    let MeetingId: String
    let ExternalMeetingId: String?
    let MediaRegion: String
    let MediaPlacement: MediaPlacementPayload
  }
  let Meeting: MeetingPayload
}

private struct AttendeeResponseJSON: Codable {
  struct AttendeePayload: Codable {
    let AttendeeId: String
    let ExternalUserId: String
    let JoinToken: String
  }
  let Attendee: AttendeePayload
}

enum ChimeAudioCallError: Error, LocalizedError {
  case invalidPayload

  var errorDescription: String? {
    switch self {
    case .invalidPayload: return "Meeting/Attendeeの情報を解釈できませんでした"
    }
  }
}

/**
 * 1対1音声通話（Phase 11、design doc 5.2.4）のネイティブブリッジ。映像は扱わない（音声のみ）ため、
 * AWSサンプル（aws-samples/amazon-chime-react-native-demo）のVideoTileObserver/DataMessageObserver
 * 相当は実装しない。RealtimeObserverで相手の参加（発信側の「発信中→通話中」判定）を、
 * AudioVideoObserverでセッション終了（相手の切断・通信断）を検知しJS側へ中継する。
 */
public class ChimeAudioCallModule: Module {
  private var meetingSession: DefaultMeetingSession?

  public func definition() -> ModuleDefinition {
    Name("ChimeAudioCall")

    Events("onAttendeeJoined", "onAttendeeLeft", "onSessionStopped", "onError")

    AsyncFunction("startMeeting") { (meetingJson: String, attendeeJson: String) in
      try self.startMeeting(meetingJson: meetingJson, attendeeJson: attendeeJson)
    }

    AsyncFunction("stopMeeting") {
      self.meetingSession?.audioVideo.stop()
      self.meetingSession = nil
    }

    AsyncFunction("setMuted") { (muted: Bool) -> Bool in
      guard let audioVideo = self.meetingSession?.audioVideo else { return false }
      return muted ? audioVideo.realtimeLocalMute() : audioVideo.realtimeLocalUnmute()
    }
  }

  private func startMeeting(meetingJson: String, attendeeJson: String) throws {
    if let existing = meetingSession {
      existing.audioVideo.stop()
      meetingSession = nil
    }

    guard let meetingData = meetingJson.data(using: .utf8),
      let attendeeData = attendeeJson.data(using: .utf8)
    else {
      throw ChimeAudioCallError.invalidPayload
    }

    let decoder = JSONDecoder()
    let meetingPayload = try decoder.decode(MeetingResponseJSON.self, from: meetingData).Meeting
    let attendeePayload = try decoder.decode(AttendeeResponseJSON.self, from: attendeeData).Attendee

    let mediaPlacement = MediaPlacement(
      audioFallbackUrl: meetingPayload.MediaPlacement.AudioFallbackUrl,
      audioHostUrl: meetingPayload.MediaPlacement.AudioHostUrl,
      signalingUrl: meetingPayload.MediaPlacement.SignalingUrl,
      turnControlUrl: meetingPayload.MediaPlacement.TurnControlUrl
    )
    let meeting = Meeting(
      externalMeetingId: meetingPayload.ExternalMeetingId,
      mediaPlacement: mediaPlacement,
      mediaRegion: meetingPayload.MediaRegion,
      meetingId: meetingPayload.MeetingId
    )
    let createMeetingResponse = CreateMeetingResponse(meeting: meeting)

    let attendee = Attendee(
      attendeeId: attendeePayload.AttendeeId,
      externalUserId: attendeePayload.ExternalUserId,
      joinToken: attendeePayload.JoinToken
    )
    let createAttendeeResponse = CreateAttendeeResponse(attendee: attendee)

    let configuration = MeetingSessionConfiguration(
      createMeetingResponse: createMeetingResponse,
      createAttendeeResponse: createAttendeeResponse
    )
    let logger = ConsoleLogger(name: "ChimeAudioCall", level: .INFO)
    let session = DefaultMeetingSession(configuration: configuration, logger: logger)
    meetingSession = session

    session.audioVideo.addRealtimeObserver(observer: self)
    session.audioVideo.addAudioVideoObserver(observer: self)
    try session.audioVideo.start()
  }
}

extension ChimeAudioCallModule: RealtimeObserver {
  public func attendeesDidJoin(attendeeInfo: [AttendeeInfo]) {
    for info in attendeeInfo {
      sendEvent("onAttendeeJoined", ["attendeeId": info.attendeeId, "externalUserId": info.externalUserId])
    }
  }

  public func attendeesDidLeave(attendeeInfo: [AttendeeInfo]) {
    for info in attendeeInfo {
      sendEvent("onAttendeeLeft", ["attendeeId": info.attendeeId, "externalUserId": info.externalUserId])
    }
  }

  public func attendeesDidDrop(attendeeInfo: [AttendeeInfo]) {
    for info in attendeeInfo {
      sendEvent("onAttendeeLeft", ["attendeeId": info.attendeeId, "externalUserId": info.externalUserId])
    }
  }

  public func attendeesDidMute(attendeeInfo: [AttendeeInfo]) {}
  public func attendeesDidUnmute(attendeeInfo: [AttendeeInfo]) {}
  public func volumeDidChange(volumeUpdates: [VolumeUpdate]) {}
  public func signalStrengthDidChange(signalUpdates: [SignalUpdate]) {}
}

extension ChimeAudioCallModule: AudioVideoObserver {
  public func audioSessionDidStartConnecting(reconnecting: Bool) {}

  public func audioSessionDidStart(reconnecting: Bool) {}

  public func audioSessionDidDrop() {}

  public func audioSessionDidStopWithStatus(sessionStatus: MeetingSessionStatus) {
    meetingSession = nil
    sendEvent("onSessionStopped")
  }

  public func audioSessionDidCancelReconnect() {}
  public func connectionDidBecomePoor() {}
  public func connectionDidRecover() {}
  public func videoSessionDidStartConnecting() {}
  public func videoSessionDidStartWithStatus(sessionStatus: MeetingSessionStatus) {}
  public func videoSessionDidStopWithStatus(sessionStatus: MeetingSessionStatus) {}
  public func remoteVideoSourcesDidBecomeAvailable(sources: [RemoteVideoSource]) {}
  public func remoteVideoSourcesDidBecomeUnavailable(sources: [RemoteVideoSource]) {}
  public func cameraSendAvailabilityDidChange(available: Bool) {}
}
