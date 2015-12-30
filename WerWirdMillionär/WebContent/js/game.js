

var buttons = ["#contA","#contB","#contC","#contD"];

var id = "cybye";


function setAnswer(i) {
	console.log("answer",i);	
	socket.emit('wwm',{id:id,cmd:'setAnswer', arg:i});
}

function goWrong(i, ok) {
	$(buttons[i]).addClass('wrong');
	blink(buttons[i]);
	$(buttons[ok]).addClass('right');	
	blink(buttons[ok]);
	
	setTimeout(function(){$.mobile.changePage('#gameover');},2000);
}

function goRight(cur,next) {

	$(buttons[cur]).addClass('right');	
	blink(buttons[cur]);

	setTimeout(function(){
		$.mobile.changePage('#levels');
		
		for(var i=1;i<=15;i++) {
			if(i!=next-1) {
				$("#t"+i).removeClass('active');
				$("#p"+i).html('&nbsp;');
			}
		}
		for(var i=1;i<next;i++) {
			$("#p"+i).html('♦');
		}
		setTimeout(function() {
			$("#t"+(next-1)).removeClass('active');	
			$("#t"+next).addClass('active');	
		},1000);
	},2000);
}


function showQuestion(state) {
	console.log("showQuestion",state);
	
	jokers(state); 
	
	var q = state.arg;
	
	for(var i=0;i<buttons.length;i++) {
		$(buttons[i]).removeClass('right wrong ui-disabled');
	}
	$("#question").html(q.question);
	$("#answerA").html(q.answers[0]);
	$("#answerB").html(q.answers[1]);
	$("#answerC").html(q.answers[2]);
	$("#answerD").html(q.answers[3]);

	if(state.disabled) {
		for(var i=0;i<state.disabled.length;i++) {
			$(buttons[state.disabled[i]]).addClass('ui-disabled');
		}
	}

	// do init here
	$.mobile.changePage('#stage');
}

function jokers(state) {
	for(var i=0;i<state.jokers.length;i++) {
		if(state.jokers[i]) {
			$("#j"+i).removeClass('ui-disabled');
			$("#sj"+i).removeClass('ui-disabled');
		} else {
			$("#j"+i).addClass('ui-disabled');
			$("#sj"+i).addClass('ui-disabled');
		}
	}
}

var compass;

function init() {
	compass = GEO.drawCompass(document.getElementById('compass-div'),'img/compass.png');
	
	for(var i=0;i<buttons.length;i++) {
		$(buttons[i]).click((function(x){return function(){setAnswer(x);};})(i));
	}
	
	// the one
	$("#help").click(function(e) {
		socket.emit('wwm',{id:id,cmd:'help'});
	});

	$("#goQuestion").click(function(){
		// change
		activateLatLng(); 
	});
	
	$("#btn-ready").click(function(){
		socket.emit('wwm',{id:id,cmd:'showQuestion'});
	});
	
	
	$("#j0").click(function(){
		socket.emit('wwm',{id:id,cmd:'useJoker',arg: 0});
		$("#jokers").panel('close');
	}); 
	
	$("#j1").click(function(){
		socket.emit('wwm',{id:id,cmd:'useJoker',arg: 1});
		$("#jokers").panel('close');
	}); 
	
	$("#j2").click(function(){
		socket.emit('wwm',{id:id,cmd:'useJoker',arg: 2});
		$("#jokers").panel('close');		
	}); 
}


function blink(id){
	for(var i=0;i<3;i++)
		$(id).delay(50).fadeTo(50,0.5).delay(50).fadeTo(50,1);
}

//compass 

var last = 0;

function activateLatLng() {
	$.mobile.changePage('#compass');


	
	
	GEO.track(function(lat, lng, dist, heading, angle) {
		if(lat && lng) {
			// compass(heading, angle);
			$('#compass-dist').html('' + Math.floor(dist * 1000) + 'm');
			var now = Date.now();
			if(now > last + 1000) {
				last = now;
				socket.emit('wwm',{id:id,cmd:'atPosition', arg:[lat,lng]});
			}
		}
	}, function(e) {
		console.log("GPSERROR");
	});
}


// client side implementation react to messages sent from server
var  client = {
		init: function(x) {
			// game is initializing
			console.log("init",x);
			$.mobile.changePage('#levels');
		},
		showQuestion: function(x) {
			showQuestion(x);
		},
		compass: function(x) {
			compass(GEO.heading,x.arg.angle);
			$('#compass-dist').html('' + Math.floor(x.arg.distance * 1000) + 'm');
		},
		atPosition: function(x) {
			console.log("atPosition",x);
			$("#msg-ready").html(x.arg);
			if(x.cont == "0")
				$("#btn-ready").hide(); //addClass("ui-disabled");
			$.mobile.changePage('#ready');
		},
		rightAnswer: function(x) {
			console.log("rightAnswer",x);
			goRight(x.arg.answer, x.arg.next);
		},
		failed: function(x) {
			console.log("failed",x);
			goWrong(x.arg.answer, x.arg.right);
		},
		timer: function(x) {
			$("#time").attr('value',x.arg);
		}
};


function connect() {
	var s = io.connect('');
	s.on('disconnect', function() { 
		$.mobile.changePage('#error');
	});
	s.on('error', function() { 
		$.mobile.changePage('#error');
	});
	s.on('wwm', function(data){
		client[data.state.cmd](data.state);
	});
	s.emit('wwm',{'id':id});
	return s;
}

var socket;

$(document).ready(function() {
	console.log("ready");
	init();
	socket = connect();
});


