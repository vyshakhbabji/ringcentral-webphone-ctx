Object.defineProperty(exports, "__esModule", {value: !0});
exports.HDXMS_VERSION = "1.2.0.2";
var VersionData = function () {
    return function (a, e, c, b) {
        this.major = a;
        this.minor = e;
        this.revision = c;
        this.build = b
    }
}();
exports.VersionData = VersionData;
var FeatureData = function () {
    return function () {
    }
}();
exports.FeatureData = FeatureData;
var WebrpcFeatureInfo = function () {
        return function (a, e) {
            this.fature = a;
            this.version = e
        }
    }(), FEATURE_ms_teams_redirection = "ms_teams_redirection",
    FEATURE_ms_teams_desktop_sharing = "ms_teams_desktop_sharing",
    FEATURE_ms_teams_speaking_indicator = "ms_teams_speaking_indicator",
    feature_map = [new WebrpcFeatureInfo(FEATURE_ms_teams_redirection, new VersionData(1, 1, 0, 0)), new WebrpcFeatureInfo(FEATURE_ms_teams_desktop_sharing, new VersionData(1, 2, 0, 0)), new WebrpcFeatureInfo(FEATURE_ms_teams_speaking_indicator, new VersionData(1,
        2, 0, 0))], class_id_t;
(function (a) {
    a[a.EngineControl = 0] = "EngineControl";
    a[a.RTCPeerConnection = 1] = "RTCPeerConnection";
    a[a.RTCSessionDescription = 2] = "RTCSessionDescription";
    a[a.RTCIceCandidate = 3] = "RTCIceCandidate";
    a[a.RTCIceCandidateEvent = 4] = "RTCIceCandidateEvent";
    a[a.MediaDevices = 5] = "MediaDevices";
    a[a.MediaDeviceInfo = 6] = "MediaDeviceInfo";
    a[a.MediaStreamTrack = 7] = "MediaStreamTrack";
    a[a.MediaStreamEvent = 8] = "MediaStreamEvent";
    a[a.MediaStream = 9] = "MediaStream";
    a[a.NavigatorUserMedia = 10] = "NavigatorUserMedia";
    a[a.VideoElement = 11] =
        "VideoElement";
    a[a.AudioElement = 12] = "AudioElement";
    a[a.RTCRtpReceiver = 13] = "RTCRtpReceiver"
})(class_id_t = exports.class_id_t || (exports.class_id_t = {}));
var method_id_EngineControl_t;
(function (a) {
    a[a.ctor = 0] = "ctor";
    a[a.version = 1] = "version";
    a[a.feature_flags = 2] = "feature_flags";
    a[a.version_info = 3] = "version_info"
})(method_id_EngineControl_t = exports.method_id_EngineControl_t || (exports.method_id_EngineControl_t = {}));
var method_id_RTCPeerConnection_t;
(function (a) {
    a[a.ctor = 0] = "ctor";
    a[a.localDescription = 1] = "localDescription";
    a[a.remoteDescription = 2] = "remoteDescription";
    a[a.readyState = 3] = "readyState";
    a[a.iceState = 4] = "iceState";
    a[a.localStreams = 5] = "localStreams";
    a[a.remoteStreams = 6] = "remoteStreams";
    a[a.createOffer = 7] = "createOffer";
    a[a.createAnswer = 8] = "createAnswer";
    a[a.setLocalDescription = 9] = "setLocalDescription";
    a[a.setRemoteDescription = 10] = "setRemoteDescription";
    a[a.updateIce = 11] = "updateIce";
    a[a.addIceCandidate = 12] = "addIceCandidate";
    a[a.addStream =
        13] = "addStream";
    a[a.removeStream = 14] = "removeStream";
    a[a.close = 15] = "close";
    a[a.iceConnectionState = 16] = "iceConnectionState";
    a[a.iceGatheringState = 17] = "iceGatheringState";
    a[a.signalingState = 18] = "signalingState";
    a[a.onaddstream = 19] = "onaddstream";
    a[a.onicecandidate = 20] = "onicecandidate";
    a[a.oniceconnectionstatechange = 21] = "oniceconnectionstatechange";
    a[a.onicegatheringstatechange = 22] = "onicegatheringstatechange";
    a[a.onsignalingstatechange = 23] = "onsignalingstatechange";
    a[a.onnegotiationneeded = 24] = "onnegotiationneeded";
    a[a.onremovestream = 25] = "onremovestream";
    a[a.getStats = 26] = "getStats";
    a[a.getReceivers = 27] = "getReceivers"
})(method_id_RTCPeerConnection_t = exports.method_id_RTCPeerConnection_t || (exports.method_id_RTCPeerConnection_t = {}));
var method_id_MediaDevices_t;
(function (a) {
    a[a.ctor = 0] = "ctor";
    a[a.enumerateDevices = 1] = "enumerateDevices";
    a[a.getDisplayMedia = 2] = "getDisplayMedia";
    a[a.ondevicechange = 3] = "ondevicechange"
})(method_id_MediaDevices_t = exports.method_id_MediaDevices_t || (exports.method_id_MediaDevices_t = {}));
var method_id_MediaDeviceInfo_t;
(function (a) {
    a[a.ctor = 0] = "ctor";
    a[a.deviceId = 1] = "deviceId";
    a[a.kind = 2] = "kind";
    a[a.label = 3] = "label";
    a[a.groupId = 4] = "groupId"
})(method_id_MediaDeviceInfo_t = exports.method_id_MediaDeviceInfo_t || (exports.method_id_MediaDeviceInfo_t = {}));
var method_id_RTCSessionDescription_t;
(function (a) {
    a[a.ctor = 0] = "ctor";
    a[a.type = 1] = "type";
    a[a.sdp = 2] = "sdp"
})(method_id_RTCSessionDescription_t = exports.method_id_RTCSessionDescription_t || (exports.method_id_RTCSessionDescription_t = {}));
var method_id_MediaStreamTrack_t;
(function (a) {
    a[a.ctor = 0] = "ctor";
    a[a.kind = 1] = "kind";
    a[a.id = 2] = "id";
    a[a.label = 3] = "label";
    a[a.enabled = 4] = "enabled";
    a[a.muted = 5] = "muted";
    a[a.readyState = 6] = "readyState";
    a[a.onended = 7] = "onended";
    a[a.onmute = 8] = "onmute";
    a[a.onunmute = 9] = "onunmute";
    a[a.clone = 10] = "clone";
    a[a.stop = 11] = "stop";
    a[a.getCapabilities = 12] = "getCapabilities";
    a[a.getSettings = 13] = "getSettings";
    a[a.applyConstraints = 14] = "applyConstraints"
})(method_id_MediaStreamTrack_t = exports.method_id_MediaStreamTrack_t || (exports.method_id_MediaStreamTrack_t =
    {}));
var method_id_MediaStream_t;
(function (a) {
    a[a.ctor = 0] = "ctor";
    a[a.id = 1] = "id";
    a[a.getAudioTracks = 2] = "getAudioTracks";
    a[a.getVideoTracks = 3] = "getVideoTracks";
    a[a.getTracks = 4] = "getTracks";
    a[a.getTrackById = 5] = "getTrackById";
    a[a.addTrack = 6] = "addTrack";
    a[a.removeTrack = 7] = "removeTrack";
    a[a.clone = 8] = "clone";
    a[a.active = 9] = "active"
})(method_id_MediaStream_t = exports.method_id_MediaStream_t || (exports.method_id_MediaStream_t = {}));
var method_id_NavigatorUserMedia_t;
(function (a) {
    a[a.ctor = 0] = "ctor";
    a[a.getUserMedia = 1] = "getUserMedia"
})(method_id_NavigatorUserMedia_t = exports.method_id_NavigatorUserMedia_t || (exports.method_id_NavigatorUserMedia_t = {}));
var method_id_RTCIceCandidate_t;
(function (a) {
    a[a.ctor = 0] = "ctor";
    a[a.candidate = 1] = "candidate";
    a[a.sdpMid = 2] = "sdpMid";
    a[a.sdpMLineIndex = 3] = "sdpMLineIndex"
})(method_id_RTCIceCandidate_t = exports.method_id_RTCIceCandidate_t || (exports.method_id_RTCIceCandidate_t = {}));
var method_id_RTCIceCandidateEvent_t;
(function (a) {
    a[a.ctor = 0] = "ctor";
    a[a.candidate = 1] = "candidate"
})(method_id_RTCIceCandidateEvent_t = exports.method_id_RTCIceCandidateEvent_t || (exports.method_id_RTCIceCandidateEvent_t = {}));
var method_id_MediaStreamEvent_t;
(function (a) {
    a[a.ctor = 0] = "ctor";
    a[a.stream = 1] = "stream"
})(method_id_MediaStreamEvent_t = exports.method_id_MediaStreamEvent_t || (exports.method_id_MediaStreamEvent_t = {}));
var method_id_VideoElement_t;
(function (a) {
    a[a.ctor = 0] = "ctor";
    a[a.sinkId = 1] = "sinkId";
    a[a.connectTo = 2] = "connectTo";
    a[a.disconnect = 3] = "disconnect";
    a[a.setFrame = 4] = "setFrame";
    a[a.addClipRect = 5] = "addClipRect";
    a[a.removeClipRect = 6] = "removeClipRect";
    a[a.onerror = 7] = "onerror";
    a[a.onvideoframechanged = 8] = "onvideoframechanged"
})(method_id_VideoElement_t = exports.method_id_VideoElement_t || (exports.method_id_VideoElement_t = {}));
var method_id_AudioElement_t;
(function (a) {
    a[a.ctor = 0] = "ctor";
    a[a.sinkId = 1] = "sinkId";
    a[a.srcObject = 2] = "srcObject";
    a[a.src = 3] = "src";
    a[a.play = 4] = "play";
    a[a.pause = 5] = "pause"
})(method_id_AudioElement_t = exports.method_id_AudioElement_t || (exports.method_id_AudioElement_t = {}));
var method_id_RTCRtpReceiver_t;
(function (a) {
    a[a.ctor = 0] = "ctor";
    a[a.track = 1] = "track";
    a[a.getContributingSources = 2] = "getContributingSources"
})(method_id_RTCRtpReceiver_t = exports.method_id_RTCRtpReceiver_t || (exports.method_id_RTCRtpReceiver_t = {}));
var WebrpcMethodInfo = function () {
    return function (a, e, c, b, d) {
        void 0 === d && (d = FEATURE_ms_teams_redirection);
        this.iid = a;
        this.mid = e;
        this.name = c;
        this.isprop = b;
        this.feature = d
    }
}();
exports.WebrpcMethodInfo = WebrpcMethodInfo;
var WebrpcClassInfo = function () {
    return function (a, e, c) {
        this.id = a;
        this.name = e;
        this.methods = c
    }
}();
exports.WebrpcClassInfo = WebrpcClassInfo;
var WebrpcClassLibInfo = function () {
        return function (a, e) {
            this.name = a;
            this.classes = e
        }
    }(),
    class_lib_info = new WebrpcClassLibInfo("msteams_class_library", [new WebrpcClassInfo(class_id_t.EngineControl, "EngineControl", [new WebrpcMethodInfo(class_id_t.EngineControl, method_id_EngineControl_t.ctor, "ctor", !1), new WebrpcMethodInfo(class_id_t.EngineControl, method_id_EngineControl_t.version, "version", !0), new WebrpcMethodInfo(class_id_t.EngineControl, method_id_EngineControl_t.feature_flags, "feature_flags", !0), new WebrpcMethodInfo(class_id_t.EngineControl,
        method_id_EngineControl_t.version_info, "version_info", !0, FEATURE_ms_teams_desktop_sharing)]), new WebrpcClassInfo(class_id_t.RTCPeerConnection, "RTCPeerConnection", [new WebrpcMethodInfo(class_id_t.RTCPeerConnection, method_id_RTCPeerConnection_t.ctor, "ctor", !1), new WebrpcMethodInfo(class_id_t.RTCPeerConnection, method_id_RTCPeerConnection_t.localDescription, "localDescription", !0), new WebrpcMethodInfo(class_id_t.RTCPeerConnection, method_id_RTCPeerConnection_t.remoteDescription, "remoteDescription", !0),
        new WebrpcMethodInfo(class_id_t.RTCPeerConnection, method_id_RTCPeerConnection_t.readyState, "readyState", !0), new WebrpcMethodInfo(class_id_t.RTCPeerConnection, method_id_RTCPeerConnection_t.iceState, "iceState", !0), new WebrpcMethodInfo(class_id_t.RTCPeerConnection, method_id_RTCPeerConnection_t.localStreams, "localStreams", !0), new WebrpcMethodInfo(class_id_t.RTCPeerConnection, method_id_RTCPeerConnection_t.remoteStreams, "remoteStreams", !0), new WebrpcMethodInfo(class_id_t.RTCPeerConnection, method_id_RTCPeerConnection_t.createOffer,
            "createOffer", !1), new WebrpcMethodInfo(class_id_t.RTCPeerConnection, method_id_RTCPeerConnection_t.createAnswer, "createAnswer", !1), new WebrpcMethodInfo(class_id_t.RTCPeerConnection, method_id_RTCPeerConnection_t.setLocalDescription, "setLocalDescription", !1), new WebrpcMethodInfo(class_id_t.RTCPeerConnection, method_id_RTCPeerConnection_t.setRemoteDescription, "setRemoteDescription", !1), new WebrpcMethodInfo(class_id_t.RTCPeerConnection, method_id_RTCPeerConnection_t.updateIce, "updateIce", !0), new WebrpcMethodInfo(class_id_t.RTCPeerConnection,
            method_id_RTCPeerConnection_t.addIceCandidate, "addIceCandidate", !0), new WebrpcMethodInfo(class_id_t.RTCPeerConnection, method_id_RTCPeerConnection_t.addStream, "addStream", !0), new WebrpcMethodInfo(class_id_t.RTCPeerConnection, method_id_RTCPeerConnection_t.removeStream, "removeStream", !0), new WebrpcMethodInfo(class_id_t.RTCPeerConnection, method_id_RTCPeerConnection_t.close, "close", !0), new WebrpcMethodInfo(class_id_t.RTCPeerConnection, method_id_RTCPeerConnection_t.iceConnectionState, "iceConnectionState",
            !0), new WebrpcMethodInfo(class_id_t.RTCPeerConnection, method_id_RTCPeerConnection_t.iceGatheringState, "iceGatheringState", !0), new WebrpcMethodInfo(class_id_t.RTCPeerConnection, method_id_RTCPeerConnection_t.signalingState, "signalingState", !0), new WebrpcMethodInfo(class_id_t.RTCPeerConnection, method_id_RTCPeerConnection_t.onaddstream, "onaddstream", !0), new WebrpcMethodInfo(class_id_t.RTCPeerConnection, method_id_RTCPeerConnection_t.onicecandidate, "onicecandidate", !0), new WebrpcMethodInfo(class_id_t.RTCPeerConnection,
            method_id_RTCPeerConnection_t.oniceconnectionstatechange, "oniceconnectionstatechange", !0), new WebrpcMethodInfo(class_id_t.RTCPeerConnection, method_id_RTCPeerConnection_t.onicegatheringstatechange, "onicegatheringstatechange", !0), new WebrpcMethodInfo(class_id_t.RTCPeerConnection, method_id_RTCPeerConnection_t.onsignalingstatechange, "onsignalingstatechange", !0), new WebrpcMethodInfo(class_id_t.RTCPeerConnection, method_id_RTCPeerConnection_t.onnegotiationneeded, "onnegotiationneeded", !0), new WebrpcMethodInfo(class_id_t.RTCPeerConnection,
            method_id_RTCPeerConnection_t.onremovestream, "onremovestream", !0), new WebrpcMethodInfo(class_id_t.RTCPeerConnection, method_id_RTCPeerConnection_t.getStats, "getStats", !1), new WebrpcMethodInfo(class_id_t.RTCPeerConnection, method_id_RTCPeerConnection_t.getReceivers, "getReceivers", !1, FEATURE_ms_teams_speaking_indicator)]), new WebrpcClassInfo(class_id_t.RTCSessionDescription, "RTCSessionDescription", [new WebrpcMethodInfo(class_id_t.RTCSessionDescription, method_id_RTCSessionDescription_t.ctor, "ctor", !1),
        new WebrpcMethodInfo(class_id_t.RTCSessionDescription, method_id_RTCSessionDescription_t.type, "type", !0), new WebrpcMethodInfo(class_id_t.RTCSessionDescription, method_id_RTCSessionDescription_t.sdp, "sdp", !0)]), new WebrpcClassInfo(class_id_t.RTCIceCandidate, "RTCIceCandidate", [new WebrpcMethodInfo(class_id_t.RTCIceCandidate, method_id_RTCIceCandidate_t.ctor, "ctor", !1), new WebrpcMethodInfo(class_id_t.RTCIceCandidate, method_id_RTCIceCandidate_t.candidate, "candidate", !0), new WebrpcMethodInfo(class_id_t.RTCIceCandidate,
        method_id_RTCIceCandidate_t.sdpMid, "sdpMid", !0), new WebrpcMethodInfo(class_id_t.RTCIceCandidate, method_id_RTCIceCandidate_t.sdpMLineIndex, "sdpMLineIndex", !0)]), new WebrpcClassInfo(class_id_t.RTCIceCandidateEvent, "RTCIceCandidateEvent", [new WebrpcMethodInfo(class_id_t.RTCIceCandidateEvent, method_id_RTCIceCandidateEvent_t.ctor, "ctor", !1), new WebrpcMethodInfo(class_id_t.RTCIceCandidateEvent, method_id_RTCIceCandidateEvent_t.candidate, "candidate", !0)]), new WebrpcClassInfo(class_id_t.MediaDevices, "MediaDevices",
        [new WebrpcMethodInfo(class_id_t.MediaDevices, method_id_MediaDevices_t.ctor, "ctor", !1), new WebrpcMethodInfo(class_id_t.MediaDevices, method_id_MediaDevices_t.enumerateDevices, "enumerateDevices", !1), new WebrpcMethodInfo(class_id_t.MediaDevices, method_id_MediaDevices_t.getDisplayMedia, "getDisplayMedia", !1, FEATURE_ms_teams_desktop_sharing), new WebrpcMethodInfo(class_id_t.MediaDevices, method_id_MediaDevices_t.ondevicechange, "ondevicechange", !0, FEATURE_ms_teams_speaking_indicator)]), new WebrpcClassInfo(class_id_t.MediaDeviceInfo,
        "MediaDeviceInfo", [new WebrpcMethodInfo(class_id_t.MediaDeviceInfo, method_id_MediaDeviceInfo_t.ctor, "ctor", !1), new WebrpcMethodInfo(class_id_t.MediaDeviceInfo, method_id_MediaDeviceInfo_t.deviceId, "deviceId", !0), new WebrpcMethodInfo(class_id_t.MediaDeviceInfo, method_id_MediaDeviceInfo_t.kind, "kind", !0), new WebrpcMethodInfo(class_id_t.MediaDeviceInfo, method_id_MediaDeviceInfo_t.label, "label", !0), new WebrpcMethodInfo(class_id_t.MediaDeviceInfo, method_id_MediaDeviceInfo_t.groupId, "groupId", !0)]), new WebrpcClassInfo(class_id_t.MediaStreamTrack,
        "MediaStreamTrack", [new WebrpcMethodInfo(class_id_t.MediaStreamTrack, method_id_MediaStreamTrack_t.ctor, "ctor", !1), new WebrpcMethodInfo(class_id_t.MediaStreamTrack, method_id_MediaStreamTrack_t.clone, "clone", !1), new WebrpcMethodInfo(class_id_t.MediaStreamTrack, method_id_MediaStreamTrack_t.stop, "stop", !1), new WebrpcMethodInfo(class_id_t.MediaStreamTrack, method_id_MediaStreamTrack_t.getCapabilities, "getCapabilities", !1), new WebrpcMethodInfo(class_id_t.MediaStreamTrack, method_id_MediaStreamTrack_t.getSettings,
            "getSettings", !1), new WebrpcMethodInfo(class_id_t.MediaStreamTrack, method_id_MediaStreamTrack_t.applyConstraints, "applyConstraints", !1, FEATURE_ms_teams_desktop_sharing), new WebrpcMethodInfo(class_id_t.MediaStreamTrack, method_id_MediaStreamTrack_t.kind, "kind", !0), new WebrpcMethodInfo(class_id_t.MediaStreamTrack, method_id_MediaStreamTrack_t.id, "id", !0), new WebrpcMethodInfo(class_id_t.MediaStreamTrack, method_id_MediaStreamTrack_t.label, "label", !0), new WebrpcMethodInfo(class_id_t.MediaStreamTrack, method_id_MediaStreamTrack_t.enabled,
            "enabled", !0), new WebrpcMethodInfo(class_id_t.MediaStreamTrack, method_id_MediaStreamTrack_t.muted, "muted", !0), new WebrpcMethodInfo(class_id_t.MediaStreamTrack, method_id_MediaStreamTrack_t.readyState, "readyState", !0), new WebrpcMethodInfo(class_id_t.MediaStreamTrack, method_id_MediaStreamTrack_t.onended, "onended", !0), new WebrpcMethodInfo(class_id_t.MediaStreamTrack, method_id_MediaStreamTrack_t.onmute, "onmute", !0), new WebrpcMethodInfo(class_id_t.MediaStreamTrack, method_id_MediaStreamTrack_t.onunmute,
            "onunmute", !0)]), new WebrpcClassInfo(class_id_t.MediaStream, "MediaStream", [new WebrpcMethodInfo(class_id_t.MediaStream, method_id_MediaStream_t.ctor, "ctor", !1), new WebrpcMethodInfo(class_id_t.MediaStream, method_id_MediaStream_t.id, "id", !0), new WebrpcMethodInfo(class_id_t.MediaStream, method_id_MediaStream_t.getAudioTracks, "getAudioTracks", !1), new WebrpcMethodInfo(class_id_t.MediaStream, method_id_MediaStream_t.getVideoTracks, "getVideoTracks", !1), new WebrpcMethodInfo(class_id_t.MediaStream, method_id_MediaStream_t.getTracks,
        "getTracks", !1), new WebrpcMethodInfo(class_id_t.MediaStream, method_id_MediaStream_t.getTrackById, "getTrackById", !1), new WebrpcMethodInfo(class_id_t.MediaStream, method_id_MediaStream_t.addTrack, "addTrack", !1), new WebrpcMethodInfo(class_id_t.MediaStream, method_id_MediaStream_t.removeTrack, "removeTrack", !1), new WebrpcMethodInfo(class_id_t.MediaStream, method_id_MediaStream_t.clone, "clone", !0), new WebrpcMethodInfo(class_id_t.MediaStream, method_id_MediaStream_t.active, "active", !0)]), new WebrpcClassInfo(class_id_t.NavigatorUserMedia,
        "NavigatorUserMedia", [new WebrpcMethodInfo(class_id_t.NavigatorUserMedia, method_id_NavigatorUserMedia_t.ctor, "ctor", !1), new WebrpcMethodInfo(class_id_t.NavigatorUserMedia, method_id_NavigatorUserMedia_t.getUserMedia, "getUserMedia", !1)]), new WebrpcClassInfo(class_id_t.MediaStreamEvent, "MediaStreamEvent", [new WebrpcMethodInfo(class_id_t.MediaStreamEvent, method_id_MediaStreamEvent_t.ctor, "ctor", !1), new WebrpcMethodInfo(class_id_t.MediaStreamEvent, method_id_MediaStreamEvent_t.stream, "stream", !0)]), new WebrpcClassInfo(class_id_t.VideoElement,
        "VideoElement", [new WebrpcMethodInfo(class_id_t.VideoElement, method_id_VideoElement_t.ctor, "ctor", !1), new WebrpcMethodInfo(class_id_t.VideoElement, method_id_VideoElement_t.sinkId, "sinkId", !0), new WebrpcMethodInfo(class_id_t.VideoElement, method_id_VideoElement_t.connectTo, "connectTo", !1), new WebrpcMethodInfo(class_id_t.VideoElement, method_id_VideoElement_t.disconnect, "disconnect", !1), new WebrpcMethodInfo(class_id_t.VideoElement, method_id_VideoElement_t.setFrame, "setFrame", !1), new WebrpcMethodInfo(class_id_t.VideoElement,
            method_id_VideoElement_t.addClipRect, "addClipRect", !1), new WebrpcMethodInfo(class_id_t.VideoElement, method_id_VideoElement_t.removeClipRect, "removeClipRect", !1), new WebrpcMethodInfo(class_id_t.VideoElement, method_id_VideoElement_t.onerror, "onerror", !0), new WebrpcMethodInfo(class_id_t.VideoElement, method_id_VideoElement_t.onvideoframechanged, "onvideoframechanged", !0)]), new WebrpcClassInfo(class_id_t.AudioElement, "AudioElement", [new WebrpcMethodInfo(class_id_t.AudioElement, method_id_AudioElement_t.ctor,
        "ctor", !1), new WebrpcMethodInfo(class_id_t.AudioElement, method_id_AudioElement_t.sinkId, "sinkId", !0), new WebrpcMethodInfo(class_id_t.AudioElement, method_id_AudioElement_t.srcObject, "srcObject", !0), new WebrpcMethodInfo(class_id_t.AudioElement, method_id_AudioElement_t.src, "src", !0), new WebrpcMethodInfo(class_id_t.AudioElement, method_id_AudioElement_t.play, "play", !1), new WebrpcMethodInfo(class_id_t.AudioElement, method_id_AudioElement_t.pause, "pause", !1)]), new WebrpcClassInfo(class_id_t.RTCRtpReceiver,
        "RTCRtpReceiver", [new WebrpcMethodInfo(class_id_t.RTCRtpReceiver, method_id_RTCRtpReceiver_t.ctor, "ctor", !1, FEATURE_ms_teams_speaking_indicator), new WebrpcMethodInfo(class_id_t.RTCRtpReceiver, method_id_RTCRtpReceiver_t.track, "track", !0, FEATURE_ms_teams_speaking_indicator), new WebrpcMethodInfo(class_id_t.RTCRtpReceiver, method_id_RTCRtpReceiver_t.getContributingSources, "getContributingSources", !1, FEATURE_ms_teams_speaking_indicator)])]),
    WebrpcClassLibInfoUtil = function () {
        function a() {
        }

        a.getInterfaceByid =
            function (a) {
                for (var c = 0, b = class_lib_info.classes; c < b.length; c++) {
                    var d = b[c];
                    if (d.id == a) return d
                }
                return null
            };
        a.getMethodByid = function (a, c) {
            var b = this.getInterfaceByid(a);
            if (null != b) for (var d = 0, b = b.methods; d < b.length; d++) {
                var f = b[d];
                if (f.mid == c) return f
            }
            return null
        };
        a.getMethodFeatureByid = function (a, c) {
            var b = this.getInterfaceByid(a);
            if (null != b) for (var d = 0, b = b.methods; d < b.length; d++) {
                var f = b[d];
                if (f.mid == c) return f.feature
            }
            return null
        };
        a.composeClassInfoData = function (a) {
            a = a.hdr;
            if (void 0 == a) return "*** Invalid packet: Couldn't find hdr object ***";
            var c = a.proc;
            if (void 0 == c) return "";
            a = c.iid;
            for (var c = c.methodid, b = 0, d = class_lib_info.classes; b < d.length; b++) {
                var f = d[b];
                if (f.id == a) for (var g = 0, h = f.methods; g < h.length; g++) {
                    var k = h[g];
                    if (k.mid == c) return f.name + "::" + k.name
                }
            }
            return ""
        };
        return a
    }();
exports.WebrpcClassLibInfoUtil = WebrpcClassLibInfoUtil;
