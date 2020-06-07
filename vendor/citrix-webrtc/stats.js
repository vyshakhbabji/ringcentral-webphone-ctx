Object.defineProperty(exports,"__esModule",{value:!0});var StatsReport=function(){function a(){this.items=[]}a.fromJSON=function(c){for(var b=new a,d=0;d<c.length;d++){var e=Stats.fromJSON(c[d]);b.items.push(e)}return b};a.prototype.toJSON=function(){return JSON.stringify(this.items)};a.prototype.result=function(){return this.items};return a}();exports.StatsReport=StatsReport;
var Stats=function(){function a(){this.names_=[];this.stat_=new Map;this.id="";this.timestamp=0;this.type=""}a.fromJSON=function(c){var b=new a;b.id=c.id||"";b.timestamp=c.timestamp||"";b.type=c.type||"";Object.keys(c).forEach(function(a){"id"!==a&&"timestamp"!==a&&"type"!==a&&(b.names_.push(a),b.stat_.set(a,c[a]))});return b};a.prototype.toJSON=function(){return JSON.stringify({id:this.id,timestamp:this.timestamp,type:this.type,stat:this.stat_})};a.prototype.names=function(){return this.names_};
a.prototype.stat=function(a){return this.stat_.get(a)};return a}();exports.Stats=Stats;
