Object.defineProperty(exports,"__esModule",{value:!0});var webrpcclassinfo_1=require("./webrpcclassinfo"),ws_msg_type_t;(function(a){a[a.req=0]="req";a[a.reply=1]="reply";a[a.event_req=2]="event_req";a[a.event_reply=3]="event_reply"})(ws_msg_type_t=exports.ws_msg_type_t||(exports.ws_msg_type_t={}));
var WsJsonUtil=function(){function a(){}a.createMessageByid=function(a,c,g,e,f,h){for(var d=[],b=6;b<arguments.length;b++)d[b-6]=arguments[b];(b=webrpcclassinfo_1.WebrpcClassLibInfoUtil.getMethodByid(e,f))&&b.isprop||(a=!1);return this.createMessage.apply(this,[g,a,c,e,f,h].concat(d))};a.createMessage=function(a,c,g,e,f,h){for(var d=[],b=6;b<arguments.length;b++)d[b-6]=arguments[b];return{v:"webrtc",hdr:{version:this._version,msg_type:this.getMsgType(a),modifier:c,destroy:g,proc:{iid:e,methodid:f}},
objref:{oid:h},params:d.slice()}};a.getMsgType=function(a){var c="";switch(a){default:c="req";break;case ws_msg_type_t.reply:c="reply";break;case ws_msg_type_t.event_req:c="event-req";break;case ws_msg_type_t.event_reply:c="event-reply"}return c};a._version=1;return a}();exports.WsJsonUtil=WsJsonUtil;
