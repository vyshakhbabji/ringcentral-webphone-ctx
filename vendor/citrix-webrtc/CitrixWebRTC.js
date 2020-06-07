var vdishim = require("./peerconnection"), rmshim = require("./remotemedia"), videoelem = require("./videoelement"),
    audioelem = require("./audioelement"), frametracker = require("./frametracker"),
    logger = require("./logger").logger, remotesession = require("./remotesession"),
    garbagecollector = require("./garbagecollector").gc, remoteDevices = new rmshim.RemoteDevices;
module.exports.CitrixPeerConnection = vdishim.PeerConnection;
module.exports.getUserMedia = function (a, c, b) {
    return (new rmshim.NavigatorUserMedia).webkitGetUserMedia(a, c, b)
};
module.exports.enumerateDevices = function () {
    return remoteDevices.enumerateDevices()
};
module.exports.mapVideoElement = function (a) {
    var c = new frametracker.FrameTracker;
    logger.log("VDI New Video Element Created, Creating Mapping to VDA");
    void 0 !== a.VDAVideoElement ? logger.log("Video element is already configured!") : (Object.defineProperty(a, "VDAVideoElement", {
        writable: !0,
        value: null
    }), a.VDAVideoElement = new videoelem.VideoElement, a.VDAVideoElement.onloadedmetadata = function () {
        var b = new Event("loadedmetadata");
        a.dispatchEvent(b)
    }, a.VDAVideoElement.ontimeupdate = function () {
        var b = new Event("timeupdate");
        a.dispatchEvent(b)
    }, a.VDAVideoElement.onconnectionstatechange = function () {
        "connected" == a.VDAVideoElement.connectionState ? c.track(a, function (b) {
            a.VDAVideoElement.setFrame(b)
        }) : c.untrack(a)
    }, Object.defineProperty(a, "sinkId", {
        get: function () {
            return a.VDAVideoElement.sinkId
        }, set: function (b) {
            logger.log("VDI Shim set video element SinkId value = " + b);
            a.VDAVideoElement.sinkId = b
        }
    }), Object.defineProperty(a, "srcObject", {
        get: function () {
            return a.VDAVideoElement.srcObject
        }, set: function (b) {
            logger.log("VDI Shim set video element srcObject");
            a.VDAVideoElement.srcObject = b
        }
    }), Object.defineProperty(a, "videoWidth", {
        get: function () {
            return a.VDAVideoElement.videoWidth
        }
    }), Object.defineProperty(a, "videoHeight", {
        get: function () {
            return a.VDAVideoElement.videoHeight
        }
    }))
};
module.exports.mapAudioElement = function (curAudioElem) {
	logger.log("VDI New Audio Element Created, Creating Mapping to VDA");
	if (curAudioElem['VDAAudioElement'] !== undefined) {
		logger.log('Audio element is already configured!');
		return;
	}

	Object.defineProperty(curAudioElem, 'VDAAudioElement', {
		writable: true,
		value: null
	});
	curAudioElem.VDAAudioElement = new audioelem.AudioElement();

	Object.defineProperty(curAudioElem, 'sinkId', {
		get: function () {
			return curAudioElem.VDAAudioElement.sinkId;
		},
		set: function (v) {
			logger.log("VDI Shim set audio element SinkId value = " + v);
			curAudioElem.VDAAudioElement.sinkId = v;
		}
	});

	Object.defineProperty(curAudioElem, 'srcObject', {
		get: function () {
			return curAudioElem.VDAAudioElement.srcObject;
		},
		set: function (v) {
			logger.log('VDI Shim set video element srcObject');
			curAudioElem.VDAAudioElement.srcObject = v;
			if (v === null || v === undefined) {
				//TODO - delete if actually setting srcObject on AudioElement
				if (curAudioElem.VDAAudioElement.srcObject !== null) {
					let audio_tr = teamsAudioElem.remoteAudioElement.srcObject.getTracks();
					for (let next of audio_tr) {
						next.enabled = false;
					}
				}
				curAudioElem.VDAAudioElement.release();
			}
			else {
				curAudioElem.VDAAudioElement.srcObject = v;
				console.log(v);
				let audio_tr = v.getTracks();
				for (let next of audio_tr) {
					next.enabled = true;
				}
			}
		},
	});
}
module.exports.addClipRect = function (a) {
    logger.log("VDI Adding Occlusion " + JSON.stringify(a));
    null === videoElementFrameTracker && (videoElementFrameTracker = new frametracker.FrameTracker);
    videoElementFrameTracker.addOcclusion(a)
};
module.exports.removeClipRect = function (a) {
    logger.log("VDI Removing Occlusion " + JSON.stringify(a));
    null === videoElementFrameTracker && (videoElementFrameTracker = new frametracker.FrameTracker);
    videoElementFrameTracker.removeOcclusion(a)
};
onVMEvent = void 0;
module.exports.setVMEventCallback = function (a) {
    onVMEvent = a;
    logger.log("VDI Event Callback Set")
};
window.onVdiClientDisconnected = function () {
    logger.log("VDI Event: vdiClientDisconnected");
    cleanup();
    remotefailure_notified = !1;
    try {
        onVMEvent({event: "vdiClientDisconnected", request: "endCalls"})
    } catch (a) {
        logger.log("onVMEvent(): exception: " + a.message)
    }
};
var remoteSession = new remotesession.RemoteSession;
window.onVdiClientDisconnectedTimer = function () {
    logger.log("VDI Event: onVdiClientDisconnectedTimer");
    null === remoteSession && (remoteSession = new remotesession.RemoteSession)
};
window.onVdiClientConnected = function () {
    logger.log("VDI Event: vdiClientConnected");
    sendSessionInfo();
    null === remoteDevices && (remoteDevices = new rmshim.RemoteDevices, originalEnumerateDevices = remoteDevices.enumerateDevices, originalGetDisplayMedia = remoteDevices.getDisplayMedia, navigator.mediaDevices.dispatchEvent(new CustomEvent("devicechange")))
};
var remotefailure_notified = !1;
window.onVdiUnableToRemote = function () {
    logger.log("VDI Event: vdiUnableToRemote");
    cleanup();
    if (!1 === remotefailure_notified) {
        logger.log("VDI Event: vdiUnableToRemote reported");
        remotefailure_notified = !0;
        try {
            onVMEvent({event: "vdiUnableToRemote"})
        } catch (a) {
            logger.log("onVMEvent(): exception: " + a.message)
        }
    }
};

function sendSessionInfo() {
    logger.log("VDI: sendSessionInfo");
    remoteSession && remoteSession.getSessionInfo().then(function (a) {
        a.event = "vdiClientConnected";
        logger.log("getSessionInfo success! info:" + JSON.stringify(a));
        try {
            onVMEvent(a)
        } catch (c) {
            logger.log("onVMEvent(): exceptionvar vdishim = require(\"./peerconnection\"), rmshim = require(\"./remotemedia\"), videoelem = require(\"./videoelement\"),\n" +
                "    audioelem = require(\"./audioelement\"), frametracker = require(\"./frametracker\"),\n" +
                "    logger = require(\"./logger\").logger, remotesession = require(\"./remotesession\"),\n" +
                "    garbagecollector = require(\"./garbagecollector\").gc, remoteDevices = new rmshim.RemoteDevices;\n" +
                "module.exports.CitrixPeerConnection = vdishim.PeerConnection;\n" +
                "module.exports.getUserMedia = function (a, c, b) {\n" +
                "    return (new rmshim.NavigatorUserMedia).webkitGetUserMedia(a, c, b)\n" +
                "};\n" +
                "module.exports.enumerateDevices = function () {\n" +
                "    return remoteDevices.enumerateDevices()\n" +
                "};\n" +
                "module.exports.mapVideoElement = function (a) {\n" +
                "    var c = new frametracker.FrameTracker;\n" +
                "    logger.log(\"VDI New Video Element Created, Creating Mapping to VDA\");\n" +
                "    void 0 !== a.VDAVideoElement ? logger.log(\"Video element is already configured!\") : (Object.defineProperty(a, \"VDAVideoElement\", {\n" +
                "        writable: !0,\n" +
                "        value: null\n" +
                "    }), a.VDAVideoElement = new videoelem.VideoElement, a.VDAVideoElement.onloadedmetadata = function () {\n" +
                "        var b = new Event(\"loadedmetadata\");\n" +
                "        a.dispatchEvent(b)\n" +
                "    }, a.VDAVideoElement.ontimeupdate = function () {\n" +
                "        var b = new Event(\"timeupdate\");\n" +
                "        a.dispatchEvent(b)\n" +
                "    }, a.VDAVideoElement.onconnectionstatechange = function () {\n" +
                "        \"connected\" == a.VDAVideoElement.connectionState ? c.track(a, function (b) {\n" +
                "            a.VDAVideoElement.setFrame(b)\n" +
                "        }) : c.untrack(a)\n" +
                "    }, Object.defineProperty(a, \"sinkId\", {\n" +
                "        get: function () {\n" +
                "            return a.VDAVideoElement.sinkId\n" +
                "        }, set: function (b) {\n" +
                "            logger.log(\"VDI Shim set video element SinkId value = \" + b);\n" +
                "            a.VDAVideoElement.sinkId = b\n" +
                "        }\n" +
                "    }), Object.defineProperty(a, \"srcObject\", {\n" +
                "        get: function () {\n" +
                "            return a.VDAVideoElement.srcObject\n" +
                "        }, set: function (b) {\n" +
                "            logger.log(\"VDI Shim set video element srcObject\");\n" +
                "            a.VDAVideoElement.srcObject = b\n" +
                "        }\n" +
                "    }), Object.defineProperty(a, \"videoWidth\", {\n" +
                "        get: function () {\n" +
                "            return a.VDAVideoElement.videoWidth\n" +
                "        }\n" +
                "    }), Object.defineProperty(a, \"videoHeight\", {\n" +
                "        get: function () {\n" +
                "            return a.VDAVideoElement.videoHeight\n" +
                "        }\n" +
                "    }))\n" +
                "};\n" +
                "module.exports.addClipRect = function (a) {\n" +
                "    logger.log(\"VDI Adding Occlusion \" + JSON.stringify(a));\n" +
                "    null === videoElementFrameTracker && (videoElementFrameTracker = new frametracker.FrameTracker);\n" +
                "    videoElementFrameTracker.addOcclusion(a)\n" +
                "};\n" +
                "module.exports.removeClipRect = function (a) {\n" +
                "    logger.log(\"VDI Removing Occlusion \" + JSON.stringify(a));\n" +
                "    null === videoElementFrameTracker && (videoElementFrameTracker = new frametracker.FrameTracker);\n" +
                "    videoElementFrameTracker.removeOcclusion(a)\n" +
                "};\n" +
                "onVMEvent = void 0;\n" +
                "module.exports.setVMEventCallback = function (a) {\n" +
                "    onVMEvent = a;\n" +
                "    logger.log(\"VDI Event Callback Set\")\n" +
                "};\n" +
                "window.onVdiClientDisconnected = function () {\n" +
                "    logger.log(\"VDI Event: vdiClientDisconnected\");\n" +
                "    cleanup();\n" +
                "    remotefailure_notified = !1;\n" +
                "    try {\n" +
                "        onVMEvent({event: \"vdiClientDisconnected\", request: \"endCalls\"})\n" +
                "    } catch (a) {\n" +
                "        logger.log(\"onVMEvent(): exception: \" + a.message)\n" +
                "    }\n" +
                "};\n" +
                "var remoteSession = new remotesession.RemoteSession;\n" +
                "window.onVdiClientDisconnectedTimer = function () {\n" +
                "    logger.log(\"VDI Event: onVdiClientDisconnectedTimer\");\n" +
                "    null === remoteSession && (remoteSession = new remotesession.RemoteSession)\n" +
                "};\n" +
                "window.onVdiClientConnected = function () {\n" +
                "    logger.log(\"VDI Event: vdiClientConnected\");\n" +
                "    sendSessionInfo();\n" +
                "    null === remoteDevices && (remoteDevices = new rmshim.RemoteDevices, originalEnumerateDevices = remoteDevices.enumerateDevices, originalGetDisplayMedia = remoteDevices.getDisplayMedia, navigator.mediaDevices.dispatchEvent(new CustomEvent(\"devicechange\")))\n" +
                "};\n" +
                "var remotefailure_notified = !1;\n" +
                "window.onVdiUnableToRemote = function () {\n" +
                "    logger.log(\"VDI Event: vdiUnableToRemote\");\n" +
                "    cleanup();\n" +
                "    if (!1 === remotefailure_notified) {\n" +
                "        logger.log(\"VDI Event: vdiUnableToRemote reported\");\n" +
                "        remotefailure_notified = !0;\n" +
                "        try {\n" +
                "            onVMEvent({event: \"vdiUnableToRemote\"})\n" +
                "        } catch (a) {\n" +
                "            logger.log(\"onVMEvent(): exception: \" + a.message)\n" +
                "        }\n" +
                "    }\n" +
                "};\n" +
                "\n" +
                "function sendSessionInfo() {\n" +
                "    logger.log(\"VDI: sendSessionInfo\");\n" +
                "    remoteSession && remoteSession.getSessionInfo().then(function (a) {\n" +
                "        a.event = \"vdiClientConnected\";\n" +
                "        logger.log(\"getSessionInfo success! info:\" + JSON.stringify(a));\n" +
                "        try {\n" +
                "            onVMEvent(a)\n" +
                "        } catch (c) {\n" +
                "            logger.log(\"onVMEvent(): exception: \" + c.message)\n" +
                "        }\n" +
                "    })[\"catch\"](function () {\n" +
                "        logger.log(\"getSessionInfo failure! session is not fully connected yet...\")\n" +
                "    })\n" +
                "}\n" +
                "\n" +
                "function cleanup() {\n" +
                "    logger.log(\"VDI : cleanup\");\n" +
                "    videoElementFrameTracker = remoteDevices = remoteUserMedia = null;\n" +
                "    audioNotifications = [];\n" +
                "    remoteSession && remoteSession.release();\n" +
                "    remoteSession = null;\n" +
                "    garbagecollector.reset();\n" +
                "    logger.log(\"VDI : cleanup done\")\n" +
                "};\n: " + c.message)
        }
    })["catch"](function () {
        logger.log("getSessionInfo failure! session is not fully connected yet...")
    })
}

function cleanup() {
    logger.log("VDI : cleanup");
    videoElementFrameTracker = remoteDevices = remoteUserMedia = null;
    audioNotifications = [];
    remoteSession && remoteSession.release();
    remoteSession = null;
    garbagecollector.reset();
    logger.log("VDI : cleanup done")
};
