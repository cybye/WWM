
var GEO = function() {

var compassHeading =0.0;
var distance;
var angle;
var callback;
var onError;
var watcher;
var tLat;
var tLon;
var lat;
var lon;

function track(callback, error, lat, lon) {
	this.callback = callback;
	this.onError = error;
	this.tLat = lat;
	this.tLon = lon;
	if(this.lat && this.lon) geo_success(this);
	getLocation(this);
}

function untrack() {
	this.callback = null;
	this.onError = null;
	navigator.geolocation.clearWatch(this.watcher);
	this.watcher = null;
}

function getLocation(that) {
	if (navigator.geolocation) {
		this.watcher = navigator.geolocation.watchPosition(function(x){
			that.lat = x.coords.latitude;
			that.lon = x.coords.longitude;
			geo_success(that);
			that.accuracy = x.coords.accuracy;
		},function(e) { console.log(e); },
		{enableHighAccuracy:true, timeout:5000});
	} else {
		this.onError('No GPS Support');
	}
}

function geo_success(that) {	
	if(that.lat && that.lon) {
		var north = 0;/*distance(81.3, -110.8, that.lat,that.lon)mag north*/;	
		var dist = distance(that.tLat,that.tLon,that.lat,that.lon);
		that.distance = dist[0];
		that.angle = dist[1]-north;
	}
	if(that.callback) 
		that.callback(
				that.lat,
				that.lon,
				that.distance,
				toRad(that.compassHeading),
				that.angle); 
}

function geo_error(that) { 
	that.onError();
}

function compass_error(){ console.log('Error'); }

function compass_success(heading){
	// console.log('Success');
	this.compassHeading = toRad(heading);
    if(this.callback) {
    	this.callback(
    			this.lat,
    			this.lon,
    			this.distance, this.compassHeading, this.angle);
    }
}

if ('ondeviceorientation' in window) {
window.addEventListener('deviceorientation', function(e) {
//	    if(navigator.compass){
//	            navigator.compass.getCurrentHeading(GEO.compass_success, GEO.compass_error);
//	    } else 
	    if (typeof e.webkitCompassHeading !== 'undefined') {
	    	if (typeof window.orientation !== 'undefined') {
	            GEO.compass_success(e.webkitCompassHeading+window.orientation);       
            } else 
	            GEO.compass_success(e.webkitCompassHeading);       
	    } else {
               // http://dev.w3.org/geo/api/spec-source-orientation.html#deviceorientation
                GEO.compass_success(360 - e.alpha);
        }
	}, false);
} else {
	console.log("ERROR: There is no support for deviceorientation");
}

function toRad(x) {
	return x * Math.PI / 180;
}
function toDeg(x) {
	return x * 180 / Math.PI;
}

function distance(aLat, aLng, bLat, bLng) {
  var R = 6371;
  var arc = Math.atan2(aLng-bLng,aLat-bLat);
  var lat1 = toRad(aLat), lon1 = toRad(aLng);
  var lat2 = toRad(bLat), lon2 = toRad(bLng);
  var dLat = lat2 - lat1;
  var dLon = lon2 - lon1;

  var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(lat1) * Math.cos(lat2) * 
          Math.sin(dLon/2) * Math.sin(dLon/2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  var d = R * c;
  return [d,arc];
}


function drawCompass(div, imgsrc) {
	var real = document.createElement('canvas');
	var rctx = real.getContext('2d');
	var canvas = document.createElement('canvas');
	var ctx = canvas.getContext('2d');
	var img = new Image();
	var sx=1,sy=1;
	var fun;
	var active = false;
	var lastcomp=0, lastneedle=0;

	//fck
	canvas.width=div.clientWidth?div.clientWidth:200;
	canvas.height=div.clientHeight?div.clientHeight:200;
	real.width=canvas.width;
	real.height=canvas.height;
	
	fun = function(deg_compass, deg_needle) {
		//var deg_compass = compassHeading;
		if(!active) {
			lastcomp = deg_compass;
			lastneedle = deg_needle;
			return;
		}
		//console.log("compass deg:" + deg_compass + " compass n: "+ deg_needle, ctx, rctx , canvas, real);
		ctx.save();
		ctx.clearRect(0,0,canvas.width, canvas.height);
		ctx.translate((canvas.width) / 2, (canvas.height) / 2);
		ctx.scale(sx,sy);
		if(!isNaN(deg_compass))
			ctx.rotate(-deg_compass);
		ctx.drawImage(img, -(img.width) / 2, -(img.height) / 2);
	
		ctx.scale(1/sx,1/sy);
		//ctx.rotate(deg_compass);
		if(!isNaN(deg_needle))
			ctx.rotate(deg_needle);
		//ctx.lineWidth=2;
		ctx.beginPath();
		ctx.lineTo(-5,0); ctx.lineTo(0,-80); ctx.lineTo(5,0);
		ctx.closePath();
		ctx.fillStyle = 'rgb(120,0,0)';
		ctx.strokeStyle ='red';
		ctx.stroke(); ctx.fill();
		ctx.beginPath();
		ctx.lineTo(-5,0); ctx.lineTo(0,80); ctx.lineTo(5,0);
		ctx.closePath();
		ctx.fillStyle = 'white';
		ctx.strokeStyle ='black';
		ctx.stroke(); ctx.fill();
		
		ctx.restore();
		
		rctx.clearRect(0,0,canvas.width, canvas.height);
		rctx.drawImage(canvas, 0,0,canvas.width, canvas.height);
		
		// console.log('compass done');
	};
	
	img.onload = function() {
		if(canvas.width && canvas.height) {
			sy = canvas.height/img.height;
			sx = canvas.width/img.width;
		}
		active = true;
		div.appendChild(real);
		//console.log('LOADED ', canvas.width, canvas.height);
		fun(lastcomp,lastneedle);
	};
	img.src = imgsrc;// 'img/compass2.jpg';

	
	return fun;
}


// public
return {
	track: track,
	untrack: untrack,
	compass_success: compass_success,
	compass_error: compass_error,
	drawCompass: drawCompass,
	heading: compassHeading
};

}();





