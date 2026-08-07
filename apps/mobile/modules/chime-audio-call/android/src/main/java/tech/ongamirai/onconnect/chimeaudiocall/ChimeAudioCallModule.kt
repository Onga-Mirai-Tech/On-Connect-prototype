package tech.ongamirai.onconnect.chimeaudiocall

import android.Manifest
import com.amazonaws.services.chime.sdk.meetings.audiovideo.AttendeeInfo
import com.amazonaws.services.chime.sdk.meetings.audiovideo.AudioVideoObserver
import com.amazonaws.services.chime.sdk.meetings.audiovideo.SignalUpdate
import com.amazonaws.services.chime.sdk.meetings.audiovideo.VolumeUpdate
import com.amazonaws.services.chime.sdk.meetings.audiovideo.video.RemoteVideoSource
import com.amazonaws.services.chime.sdk.meetings.realtime.RealtimeObserver
import com.amazonaws.services.chime.sdk.meetings.session.DefaultMeetingSession
import com.amazonaws.services.chime.sdk.meetings.session.MeetingSession
import com.amazonaws.services.chime.sdk.meetings.session.MeetingSessionConfiguration
import com.amazonaws.services.chime.sdk.meetings.session.MeetingSessionCredentials
import com.amazonaws.services.chime.sdk.meetings.session.MeetingSessionStatus
import com.amazonaws.services.chime.sdk.meetings.session.MeetingSessionURLs
import com.amazonaws.services.chime.sdk.meetings.session.defaultUrlRewriter
import com.amazonaws.services.chime.sdk.meetings.utils.logger.ConsoleLogger
import com.amazonaws.services.chime.sdk.meetings.utils.logger.LogLevel
import expo.modules.interfaces.permissions.PermissionsResponse
import expo.modules.interfaces.permissions.PermissionsStatus
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONObject

private const val TAG = "ChimeAudioCall"

class InvalidPayloadException :
  CodedException("Meeting/Attendeeの情報を解釈できませんでした")

class MicrophonePermissionException :
  CodedException("マイクの権限が許可されていません")

/**
 * 1対1音声通話（Phase 11、design doc 5.2.4）のネイティブブリッジ。映像は扱わない（音声のみ）ため、
 * AWSサンプル（aws-samples/amazon-chime-react-native-demo）のVideoTileObserver/DataMessageObserver
 * 相当は実装しない。RealtimeObserverで相手の参加（発信側の「発信中→通話中」判定）を、
 * AudioVideoObserverでセッション終了（相手の切断・通信断）を検知しJS側へ中継する。
 */
class ChimeAudioCallModule : Module(), RealtimeObserver, AudioVideoObserver {
  private var meetingSession: MeetingSession? = null
  private val logger = ConsoleLogger(LogLevel.INFO)

  override fun definition() = ModuleDefinition {
    Name("ChimeAudioCall")

    Events("onAttendeeJoined", "onAttendeeLeft", "onSessionStopped", "onError")

    AsyncFunction("startMeeting") { meetingJson: String, attendeeJson: String, promise: Promise ->
      startMeeting(meetingJson, attendeeJson, promise)
    }

    AsyncFunction("stopMeeting") {
      meetingSession?.audioVideo?.stop()
      meetingSession = null
    }

    AsyncFunction("setMuted") { muted: Boolean ->
      val audioVideo = meetingSession?.audioVideo ?: return@AsyncFunction false
      if (muted) audioVideo.realtimeLocalMute() else audioVideo.realtimeLocalUnmute()
    }
  }

  private fun startMeeting(meetingJson: String, attendeeJson: String, promise: Promise) {
    meetingSession?.audioVideo?.stop()
    meetingSession = null

    val configuration = try {
      parseConfiguration(meetingJson, attendeeJson)
    } catch (exception: Exception) {
      promise.reject(InvalidPayloadException())
      return
    }

    val context = appContext.reactContext ?: run {
      promise.reject(Exceptions.AppContextLost())
      return
    }

    val session = DefaultMeetingSession(configuration, logger, context)
    meetingSession = session

    val permissions = appContext.permissions ?: run {
      promise.reject(MicrophonePermissionException())
      return
    }
    permissions.askForPermissions(
      { result ->
        val granted = result.values.all { it.status == PermissionsStatus.GRANTED }
        if (!granted) {
          promise.reject(MicrophonePermissionException())
          return@askForPermissions
        }
        session.audioVideo.addRealtimeObserver(this)
        session.audioVideo.addAudioVideoObserver(this)
        session.audioVideo.start()
        promise.resolve(null)
      },
      Manifest.permission.RECORD_AUDIO,
      Manifest.permission.MODIFY_AUDIO_SETTINGS,
    )
  }

  private fun parseConfiguration(meetingJson: String, attendeeJson: String): MeetingSessionConfiguration {
    val meeting = JSONObject(meetingJson).getJSONObject("Meeting")
    val mediaPlacement = meeting.getJSONObject("MediaPlacement")
    val attendee = JSONObject(attendeeJson).getJSONObject("Attendee")

    return MeetingSessionConfiguration(
      meeting.getString("MeetingId"),
      MeetingSessionCredentials(
        attendee.getString("AttendeeId"),
        attendee.getString("ExternalUserId"),
        attendee.getString("JoinToken"),
      ),
      MeetingSessionURLs(
        mediaPlacement.getString("AudioFallbackUrl"),
        mediaPlacement.getString("AudioHostUrl"),
        mediaPlacement.getString("TurnControlUrl"),
        mediaPlacement.getString("SignalingUrl"),
        ::defaultUrlRewriter,
      ),
    )
  }

  // RealtimeObserver
  override fun onAttendeesJoined(attendeeInfo: Array<AttendeeInfo>) {
    attendeeInfo.forEach {
      sendEvent("onAttendeeJoined", mapOf("attendeeId" to it.attendeeId, "externalUserId" to it.externalUserId))
    }
  }

  override fun onAttendeesLeft(attendeeInfo: Array<AttendeeInfo>) {
    attendeeInfo.forEach {
      sendEvent("onAttendeeLeft", mapOf("attendeeId" to it.attendeeId, "externalUserId" to it.externalUserId))
    }
  }

  override fun onAttendeesDropped(attendeeInfo: Array<AttendeeInfo>) {
    attendeeInfo.forEach {
      sendEvent("onAttendeeLeft", mapOf("attendeeId" to it.attendeeId, "externalUserId" to it.externalUserId))
    }
  }

  override fun onAttendeesMuted(attendeeInfo: Array<AttendeeInfo>) {}
  override fun onAttendeesUnmuted(attendeeInfo: Array<AttendeeInfo>) {}
  override fun onSignalStrengthChanged(signalUpdates: Array<SignalUpdate>) {}
  override fun onVolumeChanged(volumeUpdates: Array<VolumeUpdate>) {}

  // AudioVideoObserver
  override fun onAudioSessionStartedConnecting(reconnecting: Boolean) {}
  override fun onAudioSessionStarted(reconnecting: Boolean) {}
  override fun onAudioSessionCancelledReconnect() {}
  override fun onAudioSessionDropped() {}

  override fun onAudioSessionStopped(sessionStatus: MeetingSessionStatus) {
    meetingSession = null
    sendEvent("onSessionStopped")
  }

  override fun onConnectionBecamePoor() {}
  override fun onConnectionRecovered() {}
  override fun onVideoSessionStartedConnecting() {}
  override fun onVideoSessionStarted(sessionStatus: MeetingSessionStatus) {}
  override fun onVideoSessionStopped(sessionStatus: MeetingSessionStatus) {}
  override fun onRemoteVideoSourceAvailable(sources: List<RemoteVideoSource>) {}
  override fun onRemoteVideoSourceUnavailable(sources: List<RemoteVideoSource>) {}
  override fun onCameraSendAvailabilityUpdated(available: Boolean) {}
}
