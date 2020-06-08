(
    function (root, factory) {
        if (typeof define === 'function' && define.amd) {
            define(['sip.js', './script/citrix-webrtc.js'], function (SIP, VDI) {
                return factory(SIP, VDI);
            });
        } else if (typeof module === 'object') {
            module.exports = factory(require('sip.js'), require('./script/citrix-webrtc.js'));
            module.exports.default = module.exports; //ES6
        } else {
            root.RingCentral = root.RingCentral || {};
            root.RingCentral.WebPhone = factory(root.SIP, root.CitrixWebRTC);
        }
    }(this, function (SIP, CitrixWebRTC) {

        var messages = {
            park: { reqid: 1, command: 'callpark' },
            startRecord: { reqid: 2, command: 'startcallrecord' },
            stopRecord: { reqid: 3, command: 'stopcallrecord' },
            flip: { reqid: 3, command: 'callflip', target: '' },
            monitor: { reqid: 4, command: 'monitor' },
            barge: { reqid: 5, command: 'barge' },
            whisper: { reqid: 6, command: 'whisper' },
            takeover: { reqid: 7, command: 'takeover' },
            toVoicemail: { reqid: 11, command: 'toVoicemail' },
            receiveConfirm: { reqid: 17, command: 'receiveConfirm' },
            replyWithMessage: { reqid: 14, command: 'replyWithMessage' },
        };

        var uuidKey = 'rc-webPhone-uuid';

        var responseTimeout = 60000;

        var defaultMediaConstraints = {
            audio: true,
            video: false
        };


        function uuid() {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        }

        function delay(ms) {
            return new Promise(function (resolve, reject) {
                setTimeout(resolve, ms);
            });
        }

        function extend(dst, src) {
            src = src || {};
            dst = dst || {};
            Object.keys(src).forEach(function (k) {
                dst[k] = src[k];
            });
            return dst;
        }


        //citrix related stuff
        var sdpConstraints = {
            mandatory: {
                OfferToReceiveAudio: true
                , OfferToReceiveVideo: true
            }
        };

        var localStream = undefined;
        var remoteStream = undefined;

        /*Initialization of audio/video elements used to enumerate devices*/
        var VDIaudioInput = undefined; //  audio input device source
        var VDIaudioOutput = undefined; // audio output device source
        var VDIvideo = undefined; //video input device source

        /*Initialization of video elements used in this application*/
        var VDILocal = undefined; //remoteVideoElement
        var VDIRemote = undefined;//localVideoElement

        var vdiCitrix = CitrixWebRTC;

        /*--------------------------------------------------------------------------------------------------------------------*/

        function CitrixSessionDescriptionHandler(session, options) {
            // TODO: Validate the options
            this.options = options || {};
            this.logger = session.ua.getLogger('sip.invitecontext.citrixSessionDescriptionHandler', session.id);
            this.session = session;
            this.dtmfSender = null;

            this.CONTENT_TYPE = 'application/sdp';

            this.C = {};
            this.C.DIRECTION = {
                NULL: null,
                SENDRECV: "sendrecv",
                SENDONLY: "sendonly",
                RECVONLY: "recvonly",
                INACTIVE: "inactive"
            };

            this.direction = this.C.DIRECTION.NULL;

            this.modifiers = this.options.modifiers || [];
            if (!Array.isArray(this.modifiers)) {
                this.modifiers = [this.modifiers];
            }

            // var environment = global.window || global;
            this.WebRTC = {
                MediaStream: MediaStream,
                getUserMedia: navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices),
                RTCPeerConnection: RTCPeerConnection,
                RTCSessionDescription: RTCSessionDescription
            };

            this.iceGatheringDeferred = null;
            this.iceGatheringTimeout = false;
            this.iceGatheringTimer = null;

            this.initPeerConnection(this.options.peerConnectionOptions);

            // this.constraints = this.checkAndDefaultConstraints(this.options.constraints);
        };

        CitrixSessionDescriptionHandler.prototype.defaultFactory = function defaultFactory(session, options) {
            return new CitrixSessionDescriptionHandler(session, options);
        };

        //-----------------------------------------------------------------------------------------------------------
        //  THIS IS WHERE THE setup of peerconnection happens
        // you can enable getstats here if you would like
        //-----------------------------------------------------------------------------------------------------------


        CitrixSessionDescriptionHandler.prototype.initPeerConnection = function (options) {
            var self = this;
            options = options || {};
            options = this.addDefaultIceCheckingTimeout(options);

            console.error('Initiating peerconnection');

            if (this.peerConnection) {
                console.error('Already have a peer connection for this session. Tearing down.');
                this.resetIceGatheringComplete();
                this.peerConnection.close();
            }

            var pcOptions = {
                iceServers: [{
                    urls: 'stun:stun.l.google.com:19302'
                }],
                enableDtlsSrtp: true,
                sdpSemantics: 'unified-plan',
                bundlePolicy: 'balanced'
            }

            console.error('peerConnection options ', pcOptions)
            this.peerConnection = new vdiCitrix.CitrixPeerConnection(pcOptions);
            // this.peerConnection = new RTCPeerConnection(options.rtcConfiguration);

            this.peerConnection.onaddstream = VDIhandleAddStreamEvent;
            // getStats(this.peerConnection)

            this.logger.log('New peer connection created');
            this.session.emit('peerConnection-created', this.peerConnection);

            this.peerConnection.onicecandidate = function (e) {
                console.error('onIceCandidate() callback', e);
                self.session.emit('iceCandidate', e);
                if (e.candidate) {
                    console.error('ICE candidate received: ' + (e.candidate.candidate === null ? null : e.candidate.candidate.trim()));
                } else if (e.candidate === null) {
                    console.error('ICE Gathering complete')
                    self.triggerIceGatheringComplete();
                }
            };
            //
            this.peerConnection.onicegatheringstatechange = () => {
                console.error('RTCIceGatheringState changed: ' + self.peerConnection.iceGatheringState);
                switch (self.peerConnection.iceGatheringState) {
                    case 'gathering':
                        self.session.emit('iceGathering', this);
                        if (!self.iceGatheringTimer && options.iceCheckingTimeout) {
                            self.iceGatheringTimeout = false;
                            self.iceGatheringTimer = SIP.Timers.setTimeout(function () {
                                self.logger.log('RTCIceChecking Timeout Triggered after ' + options.iceCheckingTimeout + ' milliseconds');
                                self.iceGatheringTimeout = true;
                                self.triggerIceGatheringComplete();
                            }, options.iceCheckingTimeout);
                        }
                        break;
                    case 'complete':
                        self.triggerIceGatheringComplete();
                        break;
                }
            };

            this.peerConnection.onsignalingstatechange = () => {
                console.error('onsignalingstatechange', self.peerConnection.signalingState)

            }

            this.peerConnection.onnegotiationneeded = function () {
                console.error('onnegotiationneeded')
                //what to do here? createOffer and  addStream again ?
            }


            this.peerConnection.oniceconnectionstatechange = () => {  //need e for commented out case
                console.error('oniceconnectionstatechange: ');

                var stateEvent;

                switch (self.peerConnection.iceConnectionState) {
                    case 'new':
                        stateEvent = 'iceConnection';
                        break;
                    case 'checking':
                        stateEvent = 'iceConnectionChecking';
                        break;
                    case 'connected':
                        stateEvent = 'iceConnectionConnected';
                        break;
                    case 'completed':
                        stateEvent = 'iceConnectionCompleted';
                        break;
                    case 'failed':
                        stateEvent = 'iceConnectionFailed';
                        break;
                    case 'disconnected':
                        stateEvent = 'iceConnectionDisconnected';
                        break;
                    case 'closed':
                        stateEvent = 'iceConnectionClosed';
                        break;
                    default:
                        self.logger.warn('Unknown iceConnection state:' + this.iceConnectionState);
                        return;
                }
                self.session.emit(stateEvent, this);
            };
        };

        function stripMediaDescription(sdp, description) {
            var descriptionRegExp = new RegExp("m=" + description + ".*$", "gm");
            var groupRegExp = new RegExp("^a=group:.*$", "gm");
            if (descriptionRegExp.test(sdp)) {
                var midLineToRemove_1;
                sdp = sdp.split(/^m=/gm).filter(function (section) {
                    if (section.substr(0, description.length) === description) {
                        midLineToRemove_1 = section.match(/^a=mid:.*$/gm);
                        if (midLineToRemove_1) {
                            var step = midLineToRemove_1[0].match(/:.+$/g);
                            if (step) {
                                midLineToRemove_1 = step[0].substr(1);
                            }
                        }
                        return false;
                    }
                    return true;
                }).join("m=");
                var groupLine = sdp.match(groupRegExp);
                if (groupLine && groupLine.length === 1) {
                    var groupLinePortion = groupLine[0];
                    var groupRegExpReplace = new RegExp("\ *" + midLineToRemove_1 + "[^\ ]*", "g");
                    groupLinePortion = groupLinePortion.replace(groupRegExpReplace, "");
                    sdp = sdp.split(groupRegExp).join(groupLinePortion);
                }
            }
            return sdp;
        };


        function stripVideo(description) {
            description = stripMediaDescription(description || "", "video");
            return Promise.resolve(description);
        }


        function stripTcpCandidates(description) {
            description = description.replace(/^a=candidate:\d+ \d+ tcp .*?\r\n/img, "");
            // description = description.replace(/^a=recvonly\r\n/img, "a=sendrecv\r\n");
            return Promise.resolve(description);
        }

        function stripG722(description) {
            var parts = description.match(/^m=audio.*$/gm);
            if (parts) {
                var mline = parts[0];
                mline = mline.split(" ");
                // Ignore the first 3 parameters of the mline. The codec information is after that
                for (var i = 3; i < mline.length; i = i + 1) {
                    if (mline[i] === "9") {
                        mline.splice(i, 1);
                        var numberOfCodecs = parseInt(mline[1], 10);
                        numberOfCodecs = numberOfCodecs - 1;
                        mline[1] = numberOfCodecs.toString();
                    }
                }
                mline = mline.join(" ");
                description = description.replace(/^m=audio.*$/gm, mline);
                description = description.replace(/^a=rtpmap:.*G722\/8000\r\n?/gm, "").replace();
            }
            return Promise.resolve(description);
        }

        //	this function is triggered after onAddStreamEvent 
        function getStats(peer) {
            myGetStats(peer, function (results) {
                for (var i = 0; i < results.length; ++i) {
                    var res = results[i];
                    console.warn(res);
                }

                setTimeout(function () {
                    getStats(peer);
                }, 5000);
            });
        }

        function myGetStats(peer, callback) {
            if (!!navigator.mozGetUserMedia) {
                peer.getStats(
                    function (res) {
                        var items = [];
                        res.forEach(function (result) {
                            items.push(result);
                        });
                        callback(items);
                    },
                    callback
                );
            } else {
                peer.getStats(function (res) {
                    var items = [];
                    res.result().forEach(function (result) {
                        var item = {};
                        result.names().forEach(function (name) {
                            item[name] = result.stat(name);
                        });
                        item.id = result.id;
                        item.type = result.type;
                        item.timestamp = result.timestamp;
                        items.push(item);
                    });
                    callback(items);
                });
            }
        };

        //-----------------------------------------------------------------------------------------------------------
        //  THIS IS WHERE THE remote stream is added to remoteVideoElement(AKA VDILocal happens
        //-----------------------------------------------------------------------------------------------------------

        function VDIhandleAddStreamEvent(event) {
            console.error("Inside VDIhandleAddStreamEvent", event);
            //VDILocal points to RemoteVideoElement ==> donot change
            console.warn('Event on remote stream', event.stream)
            console.warn('VDIaudioOutput', VDIaudioOutput)
            vdiCitrix.mapAudioElement(VDIaudioOutput)
            VDIaudioOutput.srcObject = event.stream;
            console.error("Setting finished remote stream to VDILocal aka RemoteVide0Element", VDIaudioOutput);
            VDIaudioOutput.play()
        }

   

        function addIceEventVDI(event) {
            console.log(event.candidate);
            if (event.candidate === null) {
                console.error('tell me when icecandidate === null')
            }
        }

        CitrixSessionDescriptionHandler.prototype.getDescription = function (options, modifiers) {
            var self = this;
            var shouldAcquireMedia = true;

            console.error('Entering getDescription');

            if (this.session.disableRenegotiation) {
                this.logger.warn("The flag \"disableRenegotiation\" is set to true for this session description handler. We will not try to renegotiate.");
                return SIP.Utils.Promise.reject(new SIP.Exceptions.RenegotiationError("disableRenegotiation flag set to true for this session description handler"));
            }

            options = options || {};
            if (options.peerConnectionOptions) {
                console.error('peerconnection options get description');
                this.initPeerConnection(options.peerConnectionOptions);
                console.error(options.peerConnectionOptions);
            }

            // Merge passed constraints with saved constraints and save
            var newConstraints = Object.assign({}, this.constraints, options.constraints);
            newConstraints = this.checkAndDefaultConstraints(newConstraints);

            if (JSON.stringify(newConstraints) !== JSON.stringify(this.constraints)) {
                this.constraints = newConstraints;
            } else {
                shouldAcquireMedia = false;
            }

            modifiers = modifiers || [];
            if (!Array.isArray(modifiers)) {
                modifiers = [modifiers];
            }
            modifiers = modifiers.concat(this.modifiers);

            //TODO:get this fixed and then next steps
            // Check to see if the peerConnection already has a local description
            if (!shouldAcquireMedia && this.peerConnection.localDescription && this.peerConnection.localDescription.sdp && this.peerConnection.localDescription.sdp !== '') {
                return this.createOfferOrAnswer(options.RTCOfferOptions, modifiers).then(function (sdp) {
                    return {
                        body: sdp,
                        contentType: self.CONTENT_TYPE
                    };
                });
            }

            var audioSource = VDIaudioInput.value;
            var videoSource = VDIvideo.value;

            const vdiConstraint = {
                audio: { deviceId: audioSource }
                // , video: {
                //     mandatory: {
                //         sourceId: videoSource,
                //         minWidth: 30,
                //         maxWidth: 30,
                //         minHeight: 30,
                //         maxHeight: 30,
                //         maxFrameRate: 30
                //     }
                // }
            };

            // GUM and set myself up
            console.error('Acquiring LocalMedia with get usermedia constraints  below: ', vdiConstraint);
            //-----------------------------------------------------------------------------------------------------------
            //  THIS IS WHERE THE assigning localstream to localVideoElemt happens
            //  SDP is processed for Invite
            //  SDP video stripping happens here
            //-----------------------------------------------------------------------------------------------------------
            return this.acquire(vdiConstraint)
                .then(function acquireSucceeded(stream) {
                    self.logger.log('Acquired succeeded Local Media Streams', stream);
                    return stream;
                }, function acquireFailed(err) {
                    self.logger.error('unable to acquire streams');
                    self.logger.error(err);
                    throw err;
                })
                .then(stream => {
                    try {
                        console.warn('Local Stream Object', stream)
                        //local stream generated from acquire -> getUserMedia  ===>  this ic correct dont change
                        console.error('Adding Local Stream to PeerConnection', stream);
                        vdiCitrix.mapVideoElement(VDIRemote);
                        VDIRemote.srcObject = stream;
                        VDIRemote.onloadedmetadata = (e) => VDIRemote.play()
                        console.error("Setting finished local stream to VDIRemote aka LocalVide0Element");
                        // VDIRemote.play();
                        console.warn('VDIRemote.srcObject', VDIRemote.srcObject)

                        self.peerConnection.addStream(stream);
                        self.session.emit('addStream')
                    } catch (e) {
                        self.logger.error('error adding stream', e);
                        return SIP.Utils.Promise.reject(e);
                    }
                    return SIP.Utils.Promise.resolve();
                })
                .then(function streamAdditionSucceeded() {
                    return self.createOfferOrAnswer(options.RTCOfferOptions, modifiers)
                })
                .then(function (sdp) {
                    return stripVideo(sdp);
                }).then(function (sdp) {
                    return stripTcpCandidates(sdp);
                })
                .then(function (sdp) {
                    return stripG722(sdp);
                })
                .then(function (sdp) {
                    // console.error('track data is', sdpTrackData);
                    console.error('track data which is added to offer sdp is', sdpTrackData);
                    // sdp=sdp+sdpTrackData;
                    return {
                        body: sdp,
                        contentType: self.CONTENT_TYPE
                    };
                })
                .catch(function (e) {
                    this.session.disableRenegotiation = true;
                    throw e;
                });
        };

        function VDIhandleError(error) {
            console.log('Error !! ', error);
        }

        //-----------------------------------------------------------------------------------------------------------
        //  THIS IS WHERE THE Aquiring local stream happens
        //-----------------------------------------------------------------------------------------------------------
        CitrixSessionDescriptionHandler.prototype.acquire = function (constraint) {
            return new SIP.Utils.Promise(function (resolve, reject) {
                /*
                 * Make the call asynchronous, so that ICCs have a chance
                 * to define callbacks to `userMediaRequest`
                 */
                this.session.emit('userMediaRequest');
                console.error('trying to acquire media  with constraint', constraint);

                vdiCitrix.getUserMedia(constraint, (stream) => {
                    var s = stream.clone();
                    console.error('GETUSERMEDIA STREAM', stream)
                    this.session.emit('userMedia', stream);
                    this.session.emit('addStream')
                    resolve(s);
                }, e => {
                    this.session.emit('userMediaFailed', e);
                    console.error('getusermedia failed');
                    reject(e);
                });
            }.bind(this));
        };

        var descrrs = '';
        var sdpTrackData = '';

        function collectAudioTracks(description) {
            var lines = description.match(/^.*((\r\n|\n|\r)|$)/gm);;
            for (i = (lines.length - 9); i < (lines.length - 5); i++) {
                sdpTrackData = sdpTrackData + lines[i];
            }

            descrrs = sdpTrackData;
            console.error('track data is', sdpTrackData);
            console.error('number of lines', lines.length)
        }

        //-----------------------------------------------------------------------------------------------------------
        //  THIS IS WHERE THE createOffer happens
        //-----------------------------------------------------------------------------------------------------------

        function createOffer(self) {
            return new Promise(function (resolve, reject) {
                self.peerConnection.createOffer((descr) => {
                    console.error('SDP Created for CreateOffer ', descr.sdp);
                    descrrs = descr.sdp
                    collectAudioTracks(descr.sdp);
                    self.peerConnection.setLocalDescription(descr);
                    //at this point the signalstate should be set to have-local-offer
                    console.error('PeerConnection Signal state for createOffer set to (have-local-offer):', self.peerConnection.signalingState)
                    self.session.emit('addStream')
                    console.error('peerConnection after setLoclDescription', self.peerConnection)

                    // modifyAudioVDI();
                    resolve(descr);
                }, VDIhandleError, sdpConstraints);
            });
        }
        //-----------------------------------------------------------------------------------------------------------
        //  THIS IS WHERE THE createAnswer happens
        //-----------------------------------------------------------------------------------------------------------


        function createAnswer(self) {
            return new Promise(function (resolve, reject) {
                self.peerConnection.createAnswer((descr) => {
                    console.error('SDP Created for CreateAnswer');
                    console.error(descr);
                    self.peerConnection.setLocalDescription(descr);
                    console.error('PeerConnection Signal state for createAnswer set to (have-remote-offer):', self.peerConnection.signalingState)
                    self.session.emit('addStream')
                    // modifyAudioVDI();
                    resolve(descr);
                }, VDIhandleError, sdpConstraints);
            });
        }

        //-----------------------------------------------------------------------------------------------------------
        //  THIS IS WHERE THE createOfferOrAnswer happens
        //-----------------------------------------------------------------------------------------------------------

        CitrixSessionDescriptionHandler.prototype.createOfferOrAnswer = function (RTCOfferOptions, modifiers) {
            var self = this;
            var methodName;
            var pc = this.peerConnection;

            // RTCOfferOptions = RTCOfferOptions || {};
            methodName = self.hasOffer('remote') ? 'createAnswer' : 'createOffer';
            console.error('This method will be called from createOfferAnswer:  ' + methodName)

            if (methodName === 'createAnswer') {
                console.error('HANDLED BY CREATE ANSWER')
                return createAnswer(self)
                    .then(function (descr) {
                        console.error('Description from createAnswer : ', descr);
                        return SIP.Utils.reducePromises(modifiers, self.createRTCSessionDescriptionInit(descr));
                    }).
                    then(function (sdp) {
                        self.resetIceGatheringComplete();
                        return SIP.Utils.reducePromises(modifiers, sdp);
                    })
                    .then(function () { return self.waitForIceGatheringComplete() })
                    .then(function onSetLocalDescriptionSuccess() {
                        return new Promise(function (resolve, reject) {
                            console.error('onSetLocalDescriptionSuccess')
                            var descr = self.peerConnection.localDescription;
                            console.error('Local SDP from peerconnection for createAnswer', descr)
                            if (!descr) throw new Error("LOCAL SDP Missing")
                            self.session.emit('getDescription', descr);
                            self.setDirection(descr.sdp);
                            resolve(descr.sdp);
                        });
                    }).catch(function createOfferOrAnswerError(e) {
                        self.logger.error(e);
                        // TODO: Not sure if this is correct
                        throw new SIP.Exceptions.GetDescriptionError(e);
                    });
            }
            else {
                console.error('HANDLED BY CREATE OFFER')
                return createOffer(self)
                    .then(function (descr) {
                        console.error('Desription from createOffer :', descr);
                        return SIP.Utils.reducePromises(modifiers, self.createRTCSessionDescriptionInit(descr));
                    }).
                    then(function (sdp) {
                        console.error('SDP after createRTCSessionDescriptionInit ', sdp);
                        self.resetIceGatheringComplete();
                        return SIP.Utils.reducePromises(modifiers, sdp);
                    })
                    .then(function () { return self.waitForIceGatheringComplete() })
                    .then(function onSetLocalDescriptionSuccess() {
                        return new Promise(function (resolve, reject) {
                            console.error('onSetLocalDescriptionSuccess')
                            var descr = self.peerConnection.localDescription;
                            console.error('Local SDP from peerconnection for createOffer ', descr)
                            if (!descr) throw new Error("LOCAL SDP Missing")
                            self.session.emit('getDescription', descr);
                            self.setDirection(descr.sdp);
                            resolve(descr.sdp);
                        });
                    }).catch(function createOfferOrAnswerError(e) {
                        self.logger.error(e);
                        // TODO: Not sure if this is correct
                        throw new SIP.Exceptions.GetDescriptionError(e);
                    });
            }
        }

        CitrixSessionDescriptionHandler.prototype.hasDescription = function (contentType) {
            return contentType === this.CONTENT_TYPE;
        };

        //-----------------------------------------------------------------------------------------------------------
        //  THIS IS WHERE THE SETREMOTEDESCRIPTION happens
        //-----------------------------------------------------------------------------------------------------------

        CitrixSessionDescriptionHandler.prototype.setDescription = function (sessionDescription, options, modifiers) {
            var self = this;
            console.error('ENTERING SETDESCRIPTION, The sdp is this: ', sessionDescription);

            // // https://stackoverflow.com/questions/9847580/how-to-detect-safari-chrome-ie-firefox-and-opera-browser
            var isFirefox = typeof InstallTrigger !== 'undefined';
            if (!this.session.disableRenegotiation && isFirefox && this.peerConnection && this.isVideoHold(sessionDescription)) {
                this.session.disableRenegotiation = true;
            }

            if (this.session.disableRenegotiation) {
                this.logger.warn("The flag \"disableRenegotiation\" is set to true for this session description handler. We will not try to renegotiate.");
                return SIP.Utils.Promise.reject(new SIP.Exceptions.RenegotiationError("disableRenegotiation flag set to true for this session description handler"));
            }

            options = options || {};
            if (options.peerConnectionOptions) {
                this.initPeerConnection(options.peerConnectionOptions);
            }

            // Merge passed constraints with saved constraints and save
            this.constraints = Object.assign({}, this.constraints, options.constraints);
            this.constraints = this.checkAndDefaultConstraints(this.constraints);

            modifiers = modifiers || [];
            if (!Array.isArray(modifiers)) {
                modifiers = [modifiers];
            }
            modifiers = modifiers.concat(this.modifiers);

            var description = {
                type: this.hasOffer('local') ? 'answer' : 'offer',
                sdp: sessionDescription
            };

            console.error('before setRemote', description)

            //-----------------------------------------------------------------------------------------------------------
            //  video param below is added to existing sdp to tell peerconnection - remoteserver is not sending video
            //-----------------------------------------------------------------------------------------------------------

            return SIP.Utils.reducePromises(modifiers, self.createRTCSessionDescriptionInit(description))
                .catch(function modifierError(e) {
                    self.logger.error("The modifiers did not resolve successfully", e);
                    throw e;
                })
                .then(function (modifiedDescription) {
                    var sdp = modifiedDescription.sdp;

                    //-------------------------------------------------------------------------------------------------
                    //  You can comment these lines as needed
                    //-------------------------------------------------------------------------------------------------
                    var video = "m=video 0 UDP/TLS/RTP/SAVPF 120\n" +
                        "c=IN IP4 0.0.0.0\n" +
                        "a=inactive\n";
                    sdp = sdp + video;


                    var type = modifiedDescription.type;
                    var desc = new RTCSessionDescription({ type: type, sdp: sdp })

                    console.error('New Remote Desc(modifiedSDP) set with Video : ', desc)
                    console.error('SDP before setting remote description', desc.sdp)
                    console.error('PeerConnection before setting remote description :', self.peerConnection)

                    self.peerConnection.setRemoteDescription(desc
                        , () => {
                            console.error('setRemmoteDescription set and successful!!!!!')
                            console.error('pc after setting remote description')
                            console.error(self.peerConnection)

                            console.warn('peerconnection after remoteStream ', self.peerConnection)
                            var remStr = self.peerConnection.receivers_;
                            console.warn('getRecvers', remStr);
                            self.session.emit('setRemoteDescription', self.peerConnection.getRemoteStreams());
                            
                            
                            console.error('setRemoteDescription with getRemotStreams', self.peerConnection.getRemoteStreams())
                            console.error('setRemoteDescription with getRecievers', self.peerConnection.getReceivers())
                            console.error('setRemoteDescription with peerConnection', self.peerConnection)

                            // addRemoteStream(remStr);
                            self.session.emit('setDescription', desc);
                            self.session.emit('confirmed', self);
                            //at this point there should be localstream and remote stream attached to html elements
                            //should trigger pc-onaddstream
                            self.session.emit('addStream');
                        },
                        () => {
                            console.error('failed to setRemmoteDescription')
                        }
                    );
                    console.error('PeerConnection after setting remote description', self.peerConnection);
                })
                .catch(function setRemoteDescriptionError(e) {
                    self.session.disableRenegotiation = true;
                    self.logger.error(e);
                    self.session.emit('peerConnection-setRemoteDescriptionFailed', e);
                    console.error('failed remote description');
                    throw e;
                })
        };

        //-----------------------------------------------------------------------------------------------------------
        //  CLOSE PEERCONNECTION
        //-----------------------------------------------------------------------------------------------------------


        CitrixSessionDescriptionHandler.prototype.close = function () {
            this.logger.log('closing PeerConnection');
            // have to check signalingState since this.close() gets called multiple times
            if (this.peerConnection && this.peerConnection.signalingState !== 'closed') {
                this.logger.warn('Using getLocalStreams which is deprecated');
                this.peerConnection.getLocalStreams().forEach(function (stream) {
                    stream.getTracks().forEach(function (track) {
                        track.stop();
                    });
                });
                if (this.peerConnection.getReceivers) {
                    this.peerConnection.getReceivers().forEach(function (receiver) {
                        if (receiver.track) {
                            receiver.track.stop();
                        }
                    });
                } else {
                    this.logger.warn('Using getRemoteStreams which is deprecated');
                    this.peerConnection.getRemoteStreams().forEach(function (stream) {
                        stream.getTracks().forEach(function (track) {
                            track.stop();
                        });
                    });
                }
                this.resetIceGatheringComplete();
                this.peerConnection.close();
            }
        };

        CitrixSessionDescriptionHandler.prototype.getDirection = function getDirection() {
            return this.direction;
        };

        // Creates an RTCSessionDescriptionInit from an RTCSessionDescription
        CitrixSessionDescriptionHandler.prototype.createRTCSessionDescriptionInit = function (RTCSessionDescription) {
            return {
                type: RTCSessionDescription.type,
                sdp: RTCSessionDescription.sdp
            };
        };


        CitrixSessionDescriptionHandler.prototype.addDefaultIceCheckingTimeout = function (peerConnectionOptions) {
            // if (peerConnectionOptions.iceCheckingTimeout === undefined) {
            peerConnectionOptions.iceCheckingTimeout = 15000;
            // }
            return peerConnectionOptions;
        };


        CitrixSessionDescriptionHandler.prototype.addDefaultIceServers = function (rtcConfiguration) {
            if (!rtcConfiguration.iceServers) {
                rtcConfiguration.iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];
            }
            return rtcConfiguration;
        };


        CitrixSessionDescriptionHandler.prototype.checkAndDefaultConstraints = function (constraints) {
            var defaultConstraints = { audio: true, video: true };
            constraints = constraints || defaultConstraints;
            // Empty object check
            if (Object.keys(constraints).length === 0 && constraints.constructor === Object) {
                return defaultConstraints;
            }
            return constraints;
        };


        CitrixSessionDescriptionHandler.prototype.hasBrowserTrackSupport = function () {
            return Boolean(this.peerConnection.addTrack);
        };


        CitrixSessionDescriptionHandler.prototype.hasBrowserGetSenderSupport = function () {
            return Boolean(this.peerConnection.getSenders);
        };

        CitrixSessionDescriptionHandler.prototype.hasOffer = function (where) {
            var offerState = 'have-' + where + '-offer';
            console.error('hasoffer signnaling state')
            console.error(offerState)
            return this.peerConnection.signalingState === offerState;
        };


        // ICE gathering state handling

        CitrixSessionDescriptionHandler.prototype.isIceGatheringComplete = function () {
            console.error('IS IceGatheringComplete? ', this.peerConnection.iceGatheringState)
            return this.peerConnection.iceGatheringState === 'complete' || this.iceGatheringTimeout;
        };

        CitrixSessionDescriptionHandler.prototype.resetIceGatheringComplete = function () {
            this.iceGatheringTimeout = false;
            console.error('icegathering resetIceGatheringComplete')
            if (this.iceGatheringTimer) {
                SIP.Timers.clearTimeout(this.iceGatheringTimer);
                this.iceGatheringTimer = null;
            }

            if (this.iceGatheringDeferred) {
                this.iceGatheringDeferred.reject();
                this.iceGatheringDeferred = null;
            }
        };


        CitrixSessionDescriptionHandler.prototype.setDirection = function (sdp) {
            var match = sdp.match(/a=(sendrecv|sendonly|recvonly|inactive)/);
            if (match === null) {
                this.direction = this.C.DIRECTION.NULL;
                this.session.emit('directionChanged');
                console.error('direction changed')
                return;
            }
            var direction = match[1];
            switch (direction) {
                case this.C.DIRECTION.SENDRECV:
                case this.C.DIRECTION.SENDONLY:
                case this.C.DIRECTION.RECVONLY:
                case this.C.DIRECTION.INACTIVE:
                    this.direction = direction;
                    break;
                default:
                    this.direction = this.C.DIRECTION.NULL;
                    break;
            }
            console.error('Direction of Session changed to', this.direction)
            this.session.emit('directionChanged');
        };


        CitrixSessionDescriptionHandler.prototype.triggerIceGatheringComplete = function () {
            if (this.isIceGatheringComplete()) {
                this.session.emit('iceGatheringComplete', this);
                console.error('triggerd ice gatheringcomplete')

                if (this.iceGatheringTimer) {
                    SIP.Timers.clearTimeout(this.iceGatheringTimer);
                    this.iceGatheringTimer = null;
                }

                if (this.iceGatheringDeferred) {
                    this.iceGatheringDeferred.resolve();
                    this.iceGatheringDeferred = null;
                }
            }
        };


        CitrixSessionDescriptionHandler.prototype.waitForIceGatheringComplete = function () {
            console.error('waiting for icegathering comeplete')
            if (this.isIceGatheringComplete()) {
                console.error('ice gathering completed')
                return SIP.Utils.Promise.resolve();
            } else if (!this.isIceGatheringDeferred) {
                console.error('ice gathering defered')
                this.iceGatheringDeferred = SIP.Utils.defer();
            }
            return this.iceGatheringDeferred.promise;
        };


        //-----------------------------------------------------------------------------------------------------------
        //  RC CUSTOM IMPLEMENTATION STARTS FROM HERE
        //-----------------------------------------------------------------------------------------------------------
        /**
         * @param options
         * @constructor
         */
        function AudioHelper(options) {

            options = options || {};

            this._enabled = !!options.enabled;
            this.loadAudio(options);
        }

        AudioHelper.prototype._playSound = function (url, val, volume) {

            if (!this._enabled || !url) return this;

            if (!this._audio[url]) {
                if (val) {
                    this._audio[url] = new Audio();
                    this._audio[url].src = url;
                    this._audio[url].loop = true;
                    this._audio[url].volume = volume;
                    this._audio[url].playPromise = this._audio[url].play();
                }
            } else {
                if (val) {
                    this._audio[url].currentTime = 0;
                    this._audio[url].playPromise = this._audio[url].play();
                } else {
                    var audio = this._audio[url];
                    if (audio.playPromise !== undefined) {
                        audio.playPromise.then(function () {
                            audio.pause();
                        });
                    }
                }
            }

            return this;

        };

        AudioHelper.prototype.loadAudio = function (options) {
            this._incoming = options.incoming;
            this._outgoing = options.outgoing;
            this._audio = {};
        };

        AudioHelper.prototype.setVolume = function (volume) {
            if (volume < 0) {
                volume = 0;
            }
            if (volume > 1) {
                volume = 1;
            }
            this.volume = volume;
            for (var url in this._audio) {
                if (this._audio.hasOwnProperty(url)) {
                    this._audio[url].volume = volume;
                }
            }
        };

        AudioHelper.prototype.playIncoming = function (val) {
            return this._playSound(this._incoming, val, (this.volume || 0.5));
        };

        AudioHelper.prototype.playOutgoing = function (val) {
            return this._playSound(this._outgoing, val, (this.volume || 1));
        };

        /*--------------------------------------------------------------------------------------------------------------------*/

        /**
         * @param {object} regData
         * @param {object} [options]
         * @param {string} [options.uuid]
         * @param {string} [options.appKey]
         * @param {string} [options.appName]
         * @param {string} [options.appVersion]
         * @param {string} [options.audioHelper]
         * @param {string} [options.onSession] fired each time UserAgent starts working with session
         * @constructor
         */
        function WebPhone(regData, options) {

            regData = regData || {};
            options = options || {};

            this.sipInfo = regData.sipInfo[0] || regData.sipInfo;
            this.sipFlags = regData.sipFlags;

            this.uuidKey = options.uuidKey || uuidKey;

            var id = options.uuid || localStorage.getItem(this.uuidKey) || uuid(); //TODO Make configurable
            localStorage.setItem(this.uuidKey, id);

            this.appKey = options.appKey;
            this.appName = options.appName;
            this.appVersion = options.appVersion;

            var userAgentString = (
                (options.appName ? (options.appName + (options.appVersion ? '/' + options.appVersion : '')) + ' ' : '') +
                'RCWEBPHONE/' + WebPhone.version
            );

            var modifiers = options.modifiers || [];
            // modifiers.push(SIP.WebRTC.Modifiers.stripTcpCandidates);


            var sessionDescriptionHandlerFactoryOptions = options.sessionDescriptionHandlerFactory || {
                peerConnectionOptions: {
                    iceCheckingTimeout: this.sipInfo.iceCheckingTimeout || this.sipInfo.iceGatheringTimeout || 5000,
                    rtcConfiguration: {
                        rtcpMuxPolicy: 'negotiate'
                    }
                },
                constraints: defaultMediaConstraints,
                modifiers: modifiers
            };

            VDIaudioInput = options.audioInput;
            VDIaudioOutput = options.audioOutput;
            VDIvideo = options.videoInput;

            console.error(VDIaudioInput);
            console.error(VDIaudioOutput);
            console.error(VDIvideo);

            // VDIRemote = options.media.remote; // remoteVideoElement
            // VDIRemote = options.media.local; // localVideoElement

            VDILocal = options.media.remote; // remoteVideoElement
            VDIRemote = options.media.local; // localVideoElement

            var browserUa = navigator.userAgent.toLowerCase();
            var isSafari = false;
            var isFirefox = false;

            if (browserUa.indexOf('safari') > -1 && browserUa.indexOf('chrome') < 0) {
                isSafari = true;
            } else if (browserUa.indexOf('firefox') > -1 && browserUa.indexOf('chrome') < 0) {
                isFirefox = true;
            }

            if (isFirefox) {
                sessionDescriptionHandlerFactoryOptions.alwaysAcquireMediaFirst = true;
            }
            var sessionDescriptionHandlerFactory = null;
            if(options.enableCitrix) {
                sessionDescriptionHandlerFactory = function (session, options) {
                    return new CitrixSessionDescriptionHandler(session, sessionDescriptionHandlerFactoryOptions);
                };
            }
            else{
                sessionDescriptionHandlerFactory = []
            }

            var configuration = {
                uri: 'sip:' + this.sipInfo.username + '@' + this.sipInfo.domain,
                wsServers: this.sipInfo.outboundProxy && this.sipInfo.transport
                    ? this.sipInfo.transport.toLowerCase() + '://' + this.sipInfo.outboundProxy
                    : this.sipInfo.wsServers,
                authorizationUser: this.sipInfo.authorizationId,
                password: this.sipInfo.password,
                traceSip: true,
                stunServers: this.sipInfo.stunServers || ['stun:74.125.194.127:19302'], //FIXME Hardcoded?
                turnServers: [],
                log: {
                    level: options.logLevel || 1 //FIXME LOG LEVEL 3
                },
                domain: this.sipInfo.domain,
                autostart: true,
                register: true,
                userAgentString: userAgentString,

                wsServerMaxReconnection: options.wsServerMaxReconnection || 3,
                connectionRecoveryMaxInterval: options.connectionRecoveryMaxInterval || 60,
                connectionRecoveryMinInterval: options.connectionRecoveryMinInterval || 2,
                sessionDescriptionHandlerFactoryOptions: sessionDescriptionHandlerFactoryOptions,
                sessionDescriptionHandlerFactory: sessionDescriptionHandlerFactory
            };
            this.userAgent = new SIP.UA(configuration);

            this.userAgent.defaultHeaders = [
                'P-rc-endpoint-id: ' + id,
                'Client-id:' + options.appKey
            ];

            this.userAgent.media = {};

            if (options.media !== undefined && options.media.remote && options.media.local) {
                this.userAgent.media.remote = options.media.remote;
                this.userAgent.media.local = options.media.local;
            }
            else
                throw new Error('HTML Media Element not Defined');

            this.userAgent.sipInfo = this.sipInfo;

            this.userAgent.__invite = this.userAgent.invite;
            this.userAgent.invite = invite;

            this.userAgent.__register = this.userAgent.register;
            this.userAgent.register = register;

            this.userAgent.__unregister = this.userAgent.unregister;
            this.userAgent.unregister = unregister;

            this.userAgent.on('invite', function (session) {
                this.userAgent.audioHelper.playIncoming(true);
                patchSession(session);
                patchIncomingSession(session);
                session._sendReceiveConfirmPromise = session.sendReceiveConfirm().then(function () {
                    session.logger.log('sendReceiveConfirm success');
                }).catch(function (error) {
                    session.logger.error('failed to send receive confirmation via SIP MESSAGE due to ' + error);
                    throw error;
                });
            }.bind(this));

            this.userAgent.audioHelper = new AudioHelper(options.audioHelper);

            this.userAgent.onSession = options.onSession || null;
            this.userAgent.createRcMessage = createRcMessage;
            this.userAgent.sendMessage = sendMessage;
            this.userAgent.transport._onMessage = this.userAgent.transport.onMessage;
            this.userAgent.transport.onMessage = onMessage;
            this.userAgent.register();

        }

        /*--------------------------------------------------------------------------------------------------------------------*/

        WebPhone.version = '0.4.6';
        WebPhone.uuid = uuid;
        WebPhone.delay = delay;
        WebPhone.extend = extend;

        /*--------------------------------------------------------------------------------------------------------------------*/

        /**
         * @param {object} options
         * @return {String}
         */
        function createRcMessage(options) {
            options.body = options.body || '';
            var msgBody = '<Msg><Hdr SID="' + options.sid + '" Req="' + options.request + '" From="' + options.from + '" To="' + options.to + '" Cmd="' + options.reqid + '"/> <Bdy Cln="' + this.sipInfo.authorizationId + '" ' + options.body + '/></Msg>';
            return msgBody;
        }

        /*--------------------------------------------------------------------------------------------------------------------*/

        /**
         * @this {SIP.UserAgent}
         * @param {object} options
         * @return {Promise}
         */
        function sendMessage(to, messageData) {
            var userAgent = this;
            var sipOptions = {};
            sipOptions.contentType = 'x-rc/agent';
            sipOptions.extraHeaders = [];
            sipOptions.extraHeaders.push('P-rc-ws: ' + this.contact);

            return new Promise(function (resolve, reject) {
                var message = userAgent.message(to, messageData, sipOptions);

                message.once('accepted', function (response, cause) {
                    resolve();
                });
                message.once('failed', function (response, cause) {
                    reject(new Error(cause));
                });
            });
        }

        /*--------------------------------------------------------------------------------------------------------------------*/

        function onMessage(e) {
            // This is a temporary solution to avoid timeout errors for MESSAGE responses.
            // Timeout is caused by port specification in host field within Via header.
            // sip.js requires received viaHost in a response to be the same as ours via host therefore
            // messages with the same host but with port are ignored.
            // This is the exact case for WSX: it send host:port inn via header in MESSAGE responses.
            // To overcome this, we will preprocess MESSAGE messages and remove port from viaHost field.
            var data = e.data;

            // WebSocket binary message.
            if (typeof data !== 'string') {
                try {
                    data = String.fromCharCode.apply(null, new Uint8Array(data));
                } catch (error) {
                    return this._onMessage.apply(this, [e]);
                }
            }

            if (data.match(/CSeq:\s*\d+\s+MESSAGE/i)) {
                var re = new RegExp(this.ua.configuration.viaHost + ':\\d+', "g");
                var newData = e.data.replace(re, this.ua.configuration.viaHost);
                Object.defineProperty(e, "data", {
                    value: newData,
                    writable: false
                });
            }

            return this._onMessage.apply(this, [e]);
        }

        /*--------------------------------------------------------------------------------------------------------------------*/


        function patchSession(session) {

            if (session.__patched) return session;

            session.__patched = true;

            session.__sendRequest = session.sendRequest;
            session.__receiveRequest = session.receiveRequest;
            session.__accept = session.accept;
            session.__hold = session.hold;
            session.__unhold = session.unhold;
            session.__dtmf = session.dtmf;
            session.__reinvite = session.reinvite;

            session.sendRequest = sendRequest;
            session.receiveRequest = receiveRequest;
            session.accept = accept;
            session.hold = hold;
            session.unhold = unhold;
            session.dtmf = dtmf;
            session.reinvite = reinvite;

            session.warmTransfer = warmTransfer;
            session.blindTransfer = blindTransfer;
            session.transfer = transfer;
            session.park = park;
            session.forward = forward;
            session.startRecord = startRecord;
            session.stopRecord = stopRecord;
            session.flip = flip;

            session.mute = mute;
            session.unmute = unmute;
            session.onLocalHold = onLocalHold;

        session.media = session.ua.media;
        session.addTrack = addTrack;

            session.on('replaced', patchSession);

            // Audio
            session.on('progress', function (incomingResponse) {
                stopPlaying();
                if (incomingResponse.status_code === 200 && incomingResponse.body) {
                    session.createDialog(incomingResponse, 'UAC');
                    session.sessionDescriptionHandler.setDescription(incomingResponse.body).then(function () {
                        session.status = 11; //C.STATUS_EARLY_MEDIA;
                        session.hasAnswer = true;
                    });
                }
            });

            session.on('trackAdded', addTrack);

            session.on('accepted', stopPlaying);
            session.on('rejected', stopPlaying);
            session.on('bye', stopPlaying);
            session.on('terminated', stopPlaying);
            session.on('cancel', stopPlaying);
            session.on('failed', stopPlaying);
            session.on('replaced', stopPlaying);


            function stopPlaying() {
                session.ua.audioHelper.playOutgoing(false);
                session.ua.audioHelper.playIncoming(false);
                session.removeListener('accepted', stopPlaying);
                session.removeListener('rejected', stopPlaying);
                session.removeListener('bye', stopPlaying);
                session.removeListener('terminated', stopPlaying);
                session.removeListener('cancel', stopPlaying);
                session.removeListener('failed', stopPlaying);
                session.removeListener('replaced', stopPlaying);
            }

            if (session.ua.onSession) session.ua.onSession(session);

            return session;

        }

        /*--------------------------------------------------------------------------------------------------------------------*/

        function patchIncomingSession(session) {
            try {
                parseRcHeader(session);
            } catch (e) {
                session.logger.error('Can\'t parse RC headers from invite request due to ' + e);
            }
            session.canUseRCMCallControl = canUseRCMCallControl;
            session.createSessionMessage = createSessionMessage;
            session.sendSessionMessage = sendSessionMessage;
            session.sendReceiveConfirm = sendReceiveConfirm;
            session.toVoicemail = toVoicemail;
            session.replyWithMessage = replyWithMessage;
        }

        /*--------------------------------------------------------------------------------------------------------------------*/

        function parseRcHeader(session) {
            var prc = session.request.headers['P-Rc'];
            if (prc && prc.length) {
                var rawInviteMsg = prc[0].raw;
                var parser = new DOMParser();
                var xmlDoc = parser.parseFromString(rawInviteMsg, 'text/xml');
                var hdrNode = xmlDoc.getElementsByTagName('Hdr')[0];

                if (hdrNode) {
                    session.rcHeaders = {
                        sid: hdrNode.getAttribute('SID'),
                        request: hdrNode.getAttribute('Req'),
                        from: hdrNode.getAttribute('From'),
                        to: hdrNode.getAttribute('To'),
                    };
                }
            }
        }

        /*--------------------------------------------------------------------------------------------------------------------*/

        /**
         * @this {SIP.Session}
         * @return {Bool}
         */
        function canUseRCMCallControl() {
            return !!this.rcHeaders;
        }

        /*--------------------------------------------------------------------------------------------------------------------*/

        /**
         * @this {SIP.Session}
         * @param {object} options
         * @return {String}
         */
        function createSessionMessage(options) {
            if (!this.rcHeaders) {
                return undefined;
            }
            extend(options, {
                sid: this.rcHeaders.sid,
                request: this.rcHeaders.request,
                from: this.rcHeaders.to,
                to: this.rcHeaders.from,
            });
            return this.ua.createRcMessage(options);
        }

        /*--------------------------------------------------------------------------------------------------------------------*/

        /**
         * @this {SIP.Session}
         * @param {object} options
         * @return {Promise}
         */
        function sendSessionMessage(options) {
            if (!this.rcHeaders) {
                return Promise.reject(new Error('Can\'t send SIP MESSAGE related to session: no RC headers available'));
            }

            var to = this.rcHeaders.from;

            return this.ua.sendMessage(to, this.createSessionMessage(options));
        }

        /*--------------------------------------------------------------------------------------------------------------------*/

        /**
         * @this {SIP.Session}
         * @return {Promise}
         */
        function sendReceiveConfirm() {
            return this.sendSessionMessage(messages.receiveConfirm);
        }

        /*--------------------------------------------------------------------------------------------------------------------*/

        /**
         * @this {SIP.Session}
         * @return {Promise}
         */
        function toVoicemail() {
            var session = this;
            return session._sendReceiveConfirmPromise.then(function () {
                return session.sendSessionMessage(messages.toVoicemail);
            });
        }

        /*--------------------------------------------------------------------------------------------------------------------*/

        /**
         * @this {SIP.Session}
         * @param {object} replyOptions
         * @return {Promise}
         */
        function replyWithMessage(replyOptions) {
            var body = 'RepTp="' + replyOptions.replyType + '"';

            if (replyOptions.replyType === 0) {
                body += ' Bdy="' + replyOptions.replyText + '"';
            } else if (replyOptions.replyType === 1) {
                body += ' Vl="' + replyOptions.timeValue + '"';
                body += ' Units="' + replyOptions.timeUnits + '"';
                body += ' Dir="' + replyOptions.callbackDirection + '"';
            }
            var session = this;
            return session._sendReceiveConfirmPromise.then(function () {
                return session.sendSessionMessage({ reqid: messages.replyWithMessage.reqid, body: body });
            });
        }

        /*--------------------------------------------------------------------------------------------------------------------*/

        /**
         * @private
         * @param {SIP.Session} session
         * @param {object} command
         * @param {object} [options]
         * @return {Promise}
         */
        function sendReceive(session, command, options) {
            options = options || {};

            extend(command, options);

            var cseq = null;

            return new Promise(function (resolve, reject) {

                var extraHeaders = (options.extraHeaders || []).concat(session.ua.defaultHeaders).concat([
                    'Content-Type: application/json;charset=utf-8'
                ]);

                session.sendRequest(SIP.C.INFO, {
                    body: JSON.stringify({
                        request: command
                    }),
                    extraHeaders: extraHeaders,
                    receiveResponse: function (response) {
                        var timeout = null;
                        if (response.status_code === 200) {
                            cseq = response.cseq;
                            var onInfo = function (request) {
                                if (response.cseq === cseq) {

                                    var body = request && request.body || '{}';
                                    var obj;

                                    try {
                                        obj = JSON.parse(body);
                                    } catch (e) {
                                        obj = {};
                                    }

                                    if (obj.response && obj.response.command === command.command) {
                                        if (obj.response.result) {
                                            if (obj.response.result.code == 0) {
                                                return resolve(obj.response.result);
                                            } else {
                                                return reject(obj.response.result);
                                            }
                                        }
                                    }
                                    timeout && clearTimeout(timeout);
                                    session.removeListener('RC_SIP_INFO', onInfo);
                                    resolve(null); //FIXME What to resolve
                                }
                            };

                            timeout = setTimeout(function () {
                                reject(new Error('Timeout: no reply'));
                                session.removeListener('RC_SIP_INFO', onInfo);
                            }, responseTimeout);
                            session.on('RC_SIP_INFO', onInfo);
                        } else {
                            reject(new Error('The INFO response status code is: ' + response.status_code + ' (waiting for 200)'));
                        }
                    }
                });

            });

        }

        /*--------------------------------------------------------------------------------------------------------------------*/

        function register(options) {
            options = options || {};
            options.extraHeaders = (options.extraHeaders || []).concat(this.defaultHeaders);
            return this.__register.call(this, options);
        }

        /*--------------------------------------------------------------------------------------------------------------------*/

        function unregister(options) {
            options = options || {};
            options.extraHeaders = (options.extraHeaders || []).concat(this.defaultHeaders);
            return this.__unregister.call(this, options);
        }

        /*--------------------------------------------------------------------------------------------------------------------*/

        function sendRequest(type, config) {
            if (type == SIP.C.PRACK) {
                // type = SIP.C.ACK;
                return this;
            }
            return this.__sendRequest(type, config);
        }

        /*--------------------------------------------------------------------------------------------------------------------*/

        /**
         * @private
         * @param {SIP.Session} session
         * @param {boolean} flag
         * @return {Promise}
         */
        function setRecord(session, flag) {

            var message = !!flag
                ? messages.startRecord
                : messages.stopRecord;

            if ((session.__onRecord && !flag) || (!session.__onRecord && flag)) {
                return sendReceive(session, message)
                    .then(function (data) {
                        session.__onRecord = !!flag;
                        return data;
                    });
            }

        }

        /*--------------------------------------------------------------------------------------------------------------------*/

        /**
         * @private
         * @param {SIP.Session} session
         * @param {boolean} flag
         * @return {Promise}
         */
        function setLocalHold(session, flag) {
            return new Promise(function (resolve, reject) {

                var options = {
                    eventHandlers: {
                        succeeded: resolve,
                        failed: reject
                    }
                };

                if (flag) {
                    resolve(session.__hold(options));
                } else {
                    resolve(session.__unhold(options));
                }

            });
        }

        /*--------------------------------------------------------------------------------------------------------------------*/

        /**
         * @this {SIP.UA}
         * @param number
         * @param options
         * @return {SIP.Session}
         */
        function invite(number, options) {

            var ua = this;

            options = options || {};
            options.extraHeaders = (options.extraHeaders || []).concat(ua.defaultHeaders);

            options.extraHeaders.push('P-Asserted-Identity: sip:' + (options.fromNumber || ua.sipInfo.username) + '@' + ua.sipInfo.domain); //FIXME Phone Number

            //FIXME Backend should know it already
            if (options.homeCountryId) {
                options.extraHeaders.push('P-rc-country-id: ' + options.homeCountryId);
            }

            // options.media = options.media || {};
            // options.media.constraints = options.media.constraints || defaultMediaConstraints;

            options.RTCConstraints = options.RTCConstraints;//|| { optional: [{ DtlsSrtpKeyAgreement: 'true' }] };

            ua.audioHelper.playOutgoing(true);
            return patchSession(ua.__invite(number, options));

        }

        /*--------------------------------------------------------------------------------------------------------------------*/

        /**
         * @this {SIP.Session}
         * @param request
         * @return {*}
         */
        function receiveRequest(request) {
            var session = this;
            switch (request.method) {
                case SIP.C.INFO:
                    session.emit('RC_SIP_INFO', request);
                    //SIP.js does not support application/json content type, so we monkey override its behaviour in this case
                    if (session.status === SIP.Session.C.STATUS_CONFIRMED || session.status === SIP.Session.C.STATUS_WAITING_FOR_ACK) {
                        var contentType = request.getHeader('content-type');
                        if (contentType.match(/^application\/json/i)) {
                            request.reply(200);
                            return session;
                        }
                    }
                    break;
            }
            return session.__receiveRequest.apply(session, arguments);
        }

        /*--------------------------------------------------------------------------------------------------------------------*/

        /**
         * @this {SIP.Session}
         * @param {object} options
         * @return {Promise}
         */
        function accept(options) {

            var session = this;

            options = options || {};
            options.extraHeaders = (options.extraHeaders || []).concat(session.ua.defaultHeaders);
            options.media = options.media || {};
            // options.media.constraints = options.media.constraints || defaultMediaConstraints;

            options.RTCConstraints = options.RTCConstraints;// || { optional: [{ DtlsSrtpKeyAgreement: 'true' }] };

            return new Promise(function (resolve, reject) {

                function onAnswered() {
                    resolve(session);
                    session.removeListener('failed', onFail);
                }

                function onFail(e) {
                    reject(e);
                    session.removeListener('accepted', onAnswered);
                }

                //TODO More events?
                session.once('accepted', onAnswered);
                session.once('failed', onFail);
                session.__accept(options);
            });


        }

        /*--------------------------------------------------------------------------------------------------------------------*/

        /**
         * @this {SIP.Session} session
         * @param {string} dtmf
         * @param {number} duration
         * @return {Promise}
         */
        function dtmf(dtmf, duration) {
            var session = this;
            duration = parseInt(duration) || 1000;
            var pc = session.sessionDescriptionHandler.peerConnection;
            var senders = pc.getSenders();
            var audioSender = senders.find(function (sender) {
                return sender.track && sender.track.kind === 'audio';
            });
            var dtmfSender = audioSender.dtmf;
            if (dtmfSender !== undefined && dtmfSender) {
                return dtmfSender.insertDTMF(dtmf, duration);
            }
            throw new Error('Send DTMF failed: ' + (!dtmfSender ? 'no sender' : (!dtmfSender.canInsertDTMF ? 'can\'t insert DTMF' : 'Unknown')));
        }

        /*--------------------------------------------------------------------------------------------------------------------*/

        /**
         * @this {SIP.Session} session
         * @return {Promise}
         */
        function hold() {
            return setLocalHold(this, true);
        }

        /*--------------------------------------------------------------------------------------------------------------------*/

        /**
         * @this {SIP.Session} session
         * @return {Promise}
         */
        function unhold() {
            return setLocalHold(this, false);
        }

        /*--------------------------------------------------------------------------------------------------------------------*/

        /**
         * @this {SIP.Session} session
         * @param {string} target
         * @param {object} options
         * @return {Promise}
         */
        function blindTransfer(target, options) {

            options = options || {};

            var session = this;
            var extraHeaders = options.extraHeaders || [];
            var originalTarget = target;

            return new Promise(function (resolve, reject) {
                //Blind Transfer is taken from SIP.js source
                return session.refer(target, options);
            });
        }

        /*--------------------------------------------------------------------------------------------------------------------*/

        /**
         * @this {SIP.Session} session
         * @param {SIP.Session} target
         * @param {object} transferOptions
         * @return {Promise}
         */
        function warmTransfer(target, transferOptions) {

            var session = this;

            return (session.local_hold ? Promise.resolve(null) : session.hold())
                .then(function () { return delay(300); })
                .then(function () {

                    var referTo = '<' + target.dialog.remote_target.toString() +
                        '?Replaces=' + target.dialog.id.call_id +
                        '%3Bto-tag%3D' + target.dialog.id.remote_tag +
                        '%3Bfrom-tag%3D' + target.dialog.id.local_tag + '>';

                    transferOptions = transferOptions || {};
                    transferOptions.extraHeaders = (transferOptions.extraHeaders || [])
                        .concat(session.ua.defaultHeaders)
                        .concat(['Referred-By: ' + session.dialog.remote_target.toString()]);

                    //TODO return session.refer(newSession);
                    return session.blindTransfer(referTo, transferOptions);

                });

        }

        /*--------------------------------------------------------------------------------------------------------------------*/

        /**
         * @this {SIP.Session}
         * @param {string} target
         * @param {object} options
         * @return {Promise}
         */
        function transfer(target, options) {

            var session = this;

            return (session.local_hold ? Promise.resolve(null) : session.hold())
                .then(function () { return delay(300); })
                .then(function () {
                    return session.blindTransfer(target, options);
                });

        }

        /*--------------------------------------------------------------------------------------------------------------------*/

        /**
         * @this {SIP.Session}
         * @param {string} target
         * @param {object} acceptOptions
         * @param {object} [transferOptions]
         * @return {Promise}
         */
        function forward(target, acceptOptions, transferOptions) {

            var interval = null,
                session = this;

            return session.accept(acceptOptions)
                .then(function () {

                    return new Promise(function (resolve, reject) {
                        interval = setInterval(function () {
                            if (session.status === 12) {
                                clearInterval(interval);
                                session.mute();
                                setTimeout(function () {
                                    resolve(session.transfer(target, transferOptions));
                                }, 700);
                            }
                        }, 50);
                    });

                });

        }

        /*--------------------------------------------------------------------------------------------------------------------*/

        /**
         * @this {SIP.Session}
         * @return {Promise}
         */
        function startRecord() {
            return setRecord(this, true);
        }

        /*--------------------------------------------------------------------------------------------------------------------*/

        /**
         * @this {SIP.Session}
         * @return {Promise}
         */
        function stopRecord() {
            return setRecord(this, false);
        }

        /*--------------------------------------------------------------------------------------------------------------------*/

        /**
         * @this {SIP.Session}
         * @param target
         * @return {Promise}
         */
        function flip(target) {
            return sendReceive(this, messages.flip, { target: target });
        }

        /*--------------------------------------------------------------------------------------------------------------------*/

        /**
         * @this {SIP.Session}
         * @return {Promise}
         */
        function park() {
            return sendReceive(this, messages.park);
        }

        /*--------------------------------------------------------------------------------------------------------------------*/
        /**
         * @this {SIP.Session}
         * @return {Promise}
         */

        function reinvite(options, modifier) {
            var session = this;
            options = options || {}
            options.sessionDescriptionHandlerOptions = options.sessionDescriptionHandlerOptions || {};
            options.sessionDescriptionHandlerOptions.constraints = options.sessionDescriptionHandlerOptions.constraints || defaultMediaConstraints;
            return session.__reinvite(options, modifier);
        }

        /*--------------------------------------------------------------------------------------------------------------------*/


        function toggleMute(session, mute) {
            session.addTrack()
            var pc = session.sessionDescriptionHandler.peerConnection;
            if (pc.getSenders) {
                pc.getSenders().forEach(function (sender) {
                    if (sender.track) {
                        sender.track.enabled = !mute;
                    }
                });
            }
        };

        /*--------------------------------------------------------------------------------------------------------------------*/
        function mute(silent) {
            if (this.state !== this.STATUS_CONNECTED) {
                this.logger.warn('An acitve call is required to mute audio');
                return;
            }
            this.logger.log('Muting Audio');
            if (!silent) {
                this.emit('muted', this.session);
            }
            return toggleMute(this, true);
        };

        /*--------------------------------------------------------------------------------------------------------------------*/

        function unmute(silent) {
            if (this.state !== this.STATUS_CONNECTED) {
                this.logger.warn('An active call is required to unmute audio');
                return;
            }
            this.logger.log('Unmuting Audio');
            if (!silent) {
                this.emit('unmuted', this.session);
            }
            return toggleMute(this, false);
        };

        /*--------------------------------------------------------------------------------------------------------------------*/

        /**
         * @this {SIP.Session}
         * @return boolean
         */

        function onLocalHold() {
            var session = this;
            return session.local_hold;
        };

        /*--------------------------------------------------------------------------------------------------------------------*/


    function addTrack(){

        var session = this;
        var pc = session.sessionDescriptionHandler.peerConnection;

        // Gets remote tracks
        var remoteAudio = session.media.remote;
        var remoteStream = new MediaStream();

        if(pc.getReceivers){
            pc.getReceivers().forEach(function(receiver) {
                var rtrack = receiver.track;
                if(rtrack){
                    remoteStream.addTrack(rtrack);
                }});
        }
        else{
            remoteStream = pc.getRemoteStreams()[0];
        }
        remoteAudio.srcObject = remoteStream;
        remoteAudio.play().catch(function() {
            session.logger.log('local play was rejected');
        });

        // Gets local tracks
        var localAudio = session.media.local;
        var localStream = new MediaStream();

        if(pc.getSenders){
            pc.getSenders().forEach(function(sender) {
                var strack = sender.track;
                if (strack && strack.kind === 'audio') {
                    localStream.addTrack(strack);
                }
            });
        }
        else{
            localStream = pc.getLocalStreams()[0];
        }
        localAudio.srcObject = localStream;
        localAudio.play().catch(function() {
            session.logger.log('local play was rejected');
        });

    }

    return WebPhone;

    }));