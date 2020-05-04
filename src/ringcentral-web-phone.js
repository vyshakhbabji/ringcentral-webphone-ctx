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
            park: {reqid: 1, command: 'callpark'},
            startRecord: {reqid: 2, command: 'startcallrecord'},
            stopRecord: {reqid: 3, command: 'stopcallrecord'},
            flip: {reqid: 3, command: 'callflip', target: ''},
            monitor: {reqid: 4, command: 'monitor'},
            barge: {reqid: 5, command: 'barge'},
            whisper: {reqid: 6, command: 'whisper'},
            takeover: {reqid: 7, command: 'takeover'},
            toVoicemail: {reqid: 11, command: 'toVoicemail'},
            receiveConfirm: {reqid: 17, command: 'receiveConfirm'},
            replyWithMessage: {reqid: 14, command: 'replyWithMessage'},
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
                OfferToReceiveAudio: true,
                OfferToReceiveVideo: false
            }
        };

        var localStream = undefined;
        var remoteStream = undefined;

        /*Initialization of audio/video elements used to enumerate devices*/
        var VDIaudioInput = undefined;
        var VDIaudioOutput = undefined;
        var VDIvideo = undefined;

        /*Initialization of video elements used in this application*/
        var VDILocal = undefined;
        var VDIRemote = undefined;

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

            // this.logger.log('SessionDescriptionHandlerOptions: ' + JSON.stringify(this.options));

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

            this.constraints = this.checkAndDefaultConstraints(this.options.constraints);
        };

        CitrixSessionDescriptionHandler.prototype.defaultFactory = function defaultFactory(session, options) {
            return new CitrixSessionDescriptionHandler(session, options);
        };

        CitrixSessionDescriptionHandler.prototype.initPeerConnection = function (options) {
            var self = this;
            options = options || {};
            options = this.addDefaultIceCheckingTimeout(options);
            options.rtcConfiguration = options.rtcConfiguration || {};
            options.rtcConfiguration = this.addDefaultIceServers(options.rtcConfiguration);

            console.error('options.rtcConfiguration');
            console.error(options.rtcConfiguration);
            console.error('initPeerConnection');

            if (this.peerConnection) {
                console.error('Already have a peer connection for this session. Tearing down.');
                this.resetIceGatheringComplete();
                this.peerConnection.close();
            }

            this.peerConnection = new vdiCitrix.CitrixPeerConnection(options.rtcConfiguration);
            // this.peerConnection = new RTCPeerConnection(options.rtcConfiguration);

            this.peerConnection.onaddstream = VDIhandleAddStreamEvent;

            this.logger.log('New peer connection created');
            this.session.emit('peerConnection-created', this.peerConnection);

            if ('ontrack' in this.peerConnection) {
                this.peerConnection.addEventListener('track', function (e) {
                    self.logger.log('track added');
                    self.session.emit('trackAdded');
                    self.session.emit('addTrack', e);
                });
            } else {
                this.logger.warn('Using onaddstream which is deprecated');
                this.peerConnection.onaddstream = function (e) {
                    self.logger.log('stream added');
                    self.session.emit('addStream', e);
                };
            }


            this.peerConnection.onaddstream = (event) => {
                console.error('onaddstream() callback');
                vdiCitrix.mapVideoElement(VDIRemote);
                VDIRemote.srcObject = event.stream;
            };

            this.peerConnection.onicecandidate = addIceEventVDI;
            this.peerConnection.onicegatheringstatechange = () => {
            };

            this.peerConnection.onicecandidate = function (e) {
                console.error('onIceCandidate() callback' + e);
                self.session.emit('iceCandidate', e);
                if (e.candidate) {
                    self.logger.log('ICE candidate received: ' + (e.candidate.candidate === null ? null : e.candidate.candidate.trim()));
                }
            };
            //
            this.peerConnection.onicegatheringstatechange = function () {
                console.error('RTCIceGatheringState changed: ' + this.iceGatheringState);
                switch (this.iceGatheringState) {
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

            this.peerConnection.oniceconnectionstatechange = function () {  //need e for commented out case
                console.error('oniceconnectionstatechange: ');

                var stateEvent;

                switch (this.iceConnectionState) {
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
                        self.logger.warn('Unknown iceConnection state:', this.iceConnectionState);
                        return;
                }
                self.session.emit(stateEvent, this);
            };
        };

        CitrixSessionDescriptionHandler.prototype.getDescription = function (options, modifiers) {
            var self = this;
            var shouldAcquireMedia = true;

            console.error('entering getDescription');

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
            console.error('new Constraints');
            console.error(newConstraints);


            if (JSON.stringify(newConstraints) !== JSON.stringify(this.constraints)) {
                this.constraints = newConstraints;
            } else {
                shouldAcquireMedia = false;
            }
            console.error('this.constraints');
            console.error(this.constraints);


            modifiers = modifiers || [];
            if (!Array.isArray(modifiers)) {
                modifiers = [modifiers];
            }
            modifiers = modifiers.concat(this.modifiers);

            console.error('rtcofferoptions');
            console.error(options.RTCOfferOptions);


            //TODO:get thsi fixed and then next steps
            // Check to see if the peerConnection already has a local description
            if (!shouldAcquireMedia && this.peerConnection.localDescription && this.peerConnection.localDescription.sdp && this.peerConnection.localDescription.sdp !== '') {
                console.error('peer connection contains sdp already?');
                return this.createOfferOrAnswer(options.RTCOfferOptions, modifiers).then(function (sdp) {
                    console.error('sdp from createOffer or answer');
                    console.error(sdp);
                    return {
                        body: sdp,
                        contentType: self.CONTENT_TYPE
                    };
                });
            }

            // GUM and set myself up
            self.logger.log('acquiring local media');
            // TODO: Constraints should be named MediaStreamConstraints

            console.error('sdp not available, so aquiring the media stream now and then getting sdp with constraints ');
            console.error(self.constraints);

            var s = undefined;

            return this.acquire(self.constraints)
                .then(function acquireSucceeded(streams) {
                    self.logger.log('acquired succeeded local media streams');
                    console.error(streams);
                    return streams;
                }, function acquireFailed(err) {
                    self.logger.error('unable to acquire streams');
                    self.logger.error(err);
                    throw err;
                })
                .then(function addStreams(streams) {
                    try {
                        streams = [].concat(streams);
                        streams.forEach(function (stream) {
                            console.error(stream)
                            self.peerConnection.addStream(stream);
                            console.error('added stream');
                            console.error(self.peerConnection);
                            s = stream;
                        }, this);
                    } catch (e) {
                        self.logger.error('error adding stream');
                        self.logger.error(e);
                        return SIP.Utils.Promise.reject(e);
                    }
                    return SIP.Utils.Promise.resolve();
                })
                .then(function streamAdditionSucceeded() {
                    console.error('stream add succeeded')
                    console.error(s);
                    return self.createOfferOrAnswer(options.RTCOfferOptions, modifiers)
                })
                .then(function (sdp) {
                    console.error('sdp created on getDescription')
                    console.error(sdp)
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
            console.error(error);
        }

        CitrixSessionDescriptionHandler.prototype.acquire = function (constraints) {
            // Default audio & video to true
            constraints = this.checkAndDefaultConstraints(constraints);

            return new SIP.Utils.Promise(function (resolve, reject) {
                /*
                 * Make the call asynchronous, so that ICCs have a chance
                 * to define callbacks to `userMediaRequest`
                 */
                this.session.emit('userMediaRequest');
                var audioSource = VDIaudioInput.value;
                var videoSource = VDIvideo.value;
                console.error('audioSource is');
                console.error(audioSource);
                console.error('videoSource is');
                console.error(videoSource);

                const constraint = {
                    audio: {deviceId: audioSource ? {exact: audioSource} : undefined},
                    video: {
                        mandatory: {
                            sourceId: videoSource,
                            minWidth: 1,
                            maxWidth: 1,
                            minHeight: 1,
                            maxHeight: 1,
                            maxFrameRate: 30
                        }
                    }
                };

                console.error('trying to acquire media');
                console.error(constraint);

                vdiCitrix.getUserMedia(constraint, stream => {
                    this.session.emit('trackAdded');
                    this.session.emit('userMedia', stream);
                    console.error('stream from citrix getusermedia')
                    console.error(stream);
                    resolve(stream);
                }, e => {
                    this.session.emit('userMediaFailed', e);
                    console.error('getusermedia failed');
                    reject(e);
                });
            }.bind(this));
        };


        function createOffer(self){
            return new Promise(function (resolve, reject) {
                self.peerConnection.createOffer((descr) => {
                    console.error('SDP Created for CreateOffer');
                    console.error(descr);
                    resolve(descr);
                }, VDIhandleError, sdpConstraints);
            });
        }

        function createAnswer(self){
            return new Promise(function (resolve, reject) {
                self.peerConnection.createAnswer((descr) => {
                    console.error('SDP Created for CreateAnswer');
                    console.error(descr);
                    resolve(descr);
                }, VDIhandleError, sdpConstraints);
            });
        }

        CitrixSessionDescriptionHandler.prototype.createOfferOrAnswer = function (RTCOfferOptions, modifiers) {
            var self = this;
            var methodName;
            var pc = this.peerConnection;

            // RTCOfferOptions = RTCOfferOptions || {};
            // methodName = self.hasOffer('remote') ? 'createAnswer' : 'createOffer';

            var desc = null;
            return createOffer(self)
                .then(function (sdp) {
                    desc = sdp;
                    console.error(desc);
                    return SIP.Utils.reducePromises(modifiers, self.createRTCSessionDescriptionInit(sdp));
                }).
                then(function (sdp) {
                    self.resetIceGatheringComplete();
                    console.error('desc');
                    console.error(desc);
                    console.error('sdp is ')
                    console.error(sdp);
                    pc.setLocalDescription(desc);
                    // return Promise.resolve(sdp);
                    return SIP.Utils.reducePromises(modifiers, sdp);
                })
                .then(function onSetLocalDescriptionSuccess(sdp) {
                    return new Promise(function (resolve, reject) {
                        console.error('onSetLocalDescriptionSuccesson')
                        console.error(sdp);
                        // return self.waitForIceGatheringComplete();
                        self.session.emit('getDescription', sdp.sdp);
                        self.setDirection(sdp.sdp);
                        resolve(sdp.sdp);
                    });
                })
                // .then(function readySuccess() {
                //     console.error('readySuccess')
                //     var localDescription = self.createRTCSessionDescriptionInit(self.peerConnection.localDescription);
                //     console.error('localdescription');
                //     console.error(localDescription);
                //     return SIP.Utils.reducePromises(modifiers, localDescription);
                // })
                // .then(function (localDescription) {
                //     self.session.emit('getDescription', localDescription);
                //     self.setDirection(localDescription.sdp);
                //     return localDescription.sdp;
                // })
                .catch(function createOfferOrAnswerError(e) {
                    self.logger.error(e);
                    // TODO: Not sure if this is correct
                    throw new SIP.Exceptions.GetDescriptionError(e);
                });
        }




        CitrixSessionDescriptionHandler.prototype.hasDescription = function (contentType) {
            return contentType === this.CONTENT_TYPE;
        };


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

        CitrixSessionDescriptionHandler.prototype.setDescription = function (sessionDescription, options, modifiers) {
            var self = this;

            // https://stackoverflow.com/questions/9847580/how-to-detect-safari-chrome-ie-firefox-and-opera-browser
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

            return SIP.Utils.reducePromises(modifiers, description)
                .catch(function modifierError(e) {
                    self.logger.error("The modifiers did not resolve successfully");
                    self.logger.error(e);
                    throw e;
                })
                .then(function (modifiedDescription) {
                    self.session.emit('setDescription', modifiedDescription);
                    return self.peerConnection.setRemoteDescription(new self.WebRTC.RTCSessionDescription(modifiedDescription));
                })
                .catch(function setRemoteDescriptionError(e) {
                    self.session.disableRenegotiation = true;
                    self.logger.error(e);
                    self.session.emit('peerConnection-setRemoteDescriptionFailed', e);
                    throw e;
                })
                .then(function setRemoteDescriptionSuccess() {
                    if (self.peerConnection.getReceivers) {
                        self.session.emit('setRemoteDescription', self.peerConnection.getReceivers());
                    } else {
                        self.session.emit('setRemoteDescription', self.peerConnection.getRemoteStreams());
                    }
                    self.session.emit('confirmed', self);
                });
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
            if (peerConnectionOptions.iceCheckingTimeout === undefined) {
                peerConnectionOptions.iceCheckingTimeout = 5000;
            }
            return peerConnectionOptions;
        };


        CitrixSessionDescriptionHandler.prototype.addDefaultIceServers = function (rtcConfiguration) {
            if (!rtcConfiguration.iceServers) {
                rtcConfiguration.iceServers = [{urls: 'stun:stun.l.google.com:19302'}];
            }
            return rtcConfiguration;
        };


        CitrixSessionDescriptionHandler.prototype.checkAndDefaultConstraints = function (constraints) {
            var defaultConstraints = {audio: true, video: true};
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


        function VDIhandleAddStreamEvent(event) {
            console.error("In VDIhandleAddStreamEvent");
            console.error(event.stream);
            vdiCitrix.mapVideoElement(VDIRemote)
            VDIRemote.srcObject = event.stream;
        }

        function addIceEventVDI(event) {
            console.log(event.candidate);
        }


        CitrixSessionDescriptionHandler.prototype.hasOffer = function (where) {
            var offerState = 'have-' + where + '-offer';
            return this.peerConnection.signalingState === offerState;
        };


// ICE gathering state handling

        CitrixSessionDescriptionHandler.prototype.isIceGatheringComplete = function () {
            return this.peerConnection.iceGatheringState === 'complete' || this.iceGatheringTimeout;
        };

        CitrixSessionDescriptionHandler.prototype.resetIceGatheringComplete = function () {
            this.iceGatheringTimeout = false;

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
            this.session.emit('directionChanged');
        };


        CitrixSessionDescriptionHandler.prototype.triggerIceGatheringComplete = function () {
            if (this.isIceGatheringComplete()) {
                this.session.emit('iceGatheringComplete', this);

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
            if (this.isIceGatheringComplete()) {
                return SIP.Utils.Promise.resolve();
            } else if (!this.isIceGatheringDeferred) {
                this.iceGatheringDeferred = SIP.Utils.defer();
            }
            return this.iceGatheringDeferred.promise;
        };

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
            modifiers.push(SIP.WebRTC.Modifiers.stripTcpCandidates);


            var sessionDescriptionHandlerFactoryOptions = options.sessionDescriptionHandlerFactory || {
                peerConnectionOptions: {
                    iceCheckingTimeout: this.sipInfo.iceCheckingTimeout || this.sipInfo.iceGatheringTimeout || 500,
                    rtcConfiguration: {
                        rtcpMuxPolicy: 'negotiate'
                    },
                    enableDtlsSrtp: true
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

            //TODO: CHECK THIS VAL
            VDILocal = options.media.remote;
            VDIRemote = options.media.local;

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

            var sessionDescriptionHandlerFactory = function (session, options) {
                return new CitrixSessionDescriptionHandler(session, sessionDescriptionHandlerFactoryOptions);
            };

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
                sessionDescriptionHandlerFactory : sessionDescriptionHandlerFactory
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
                if (incomingResponse.status_code === 183 && incomingResponse.body) {
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
                return session.sendSessionMessage({reqid: messages.replyWithMessage.reqid, body: body});
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

            options.RTCConstraints = options.RTCConstraints || {optional: [{DtlsSrtpKeyAgreement: 'true'}]};

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

            options.RTCConstraints = options.RTCConstraints || {optional: [{DtlsSrtpKeyAgreement: 'true'}]};

            return new Promise(function(resolve, reject) {

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
                .then(function() { return delay(300); })
                .then(function() {

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
                .then(function() { return delay(300); })
                .then(function() {
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
            return sendReceive(this, messages.flip, {target: target});
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


        function addTrack() {

            console.error('entering add track');
            var session = this;
            var pc = session.sessionDescriptionHandler.peerConnection;

            // Gets remote tracks
            var remoteAudio = VDIRemote;
            var remoteStream = new MediaStream();

            console.error('Adding Recievers/ remote track');
            if (pc.getReceivers) {
                pc.getReceivers().forEach(function (receiver) {
                    var rtrack = receiver.track;
                    if (rtrack) {
                        remoteStream.addTrack(rtrack);
                    }
                });
            } else {
                remoteStream = pc.getRemoteStreams()[0];
            }
            remoteAudio.srcObject = remoteStream;
            remoteAudio.play().catch(function () {
                session.logger.log('local play was rejected');
            });

            console.error('Adding Senders/local track')
            // Gets local tracks
            var localAudio = VDILocal;
            var localStream = new MediaStream();

            localStream = pc.getLocalStreams()[0];
            localAudio.srcObject = localStream;
            localAudio.play().catch(function() {
                session.logger.log('local play was rejected');
            });

        }

        return WebPhone;

    }));