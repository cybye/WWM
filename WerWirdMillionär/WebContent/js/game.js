

var buttons = ["#contA","#contB","#contC","#contD"];


var question = {
		no: 1,
		time: 60000,
		q: "Was soll denn das hier sein?",
		answers: ["Antwort1", "Antwort2", "Antwort3", "Antwort4"] 
};



function setAnswer(i) {
	console.log("answer",i);
	
	if(i != 1) {
		goWrong(i,1);
	}  else 
		goRight(1);
}

function goWrong(i, ok) {
	clearInterval(timer);

	$(buttons[i]).addClass('wrong');
	blink(buttons[i]);
	$(buttons[ok]).addClass('right');	
	blink(buttons[ok]);
	
	setTimeout(function(){$.mobile.changePage('#gameover');},2000);
}

function goRight(i) {
	clearInterval(timer);

	$(buttons[i]).addClass('right');	
	blink(buttons[i]);

	setTimeout(function(){
		$.mobile.changePage('#levels');
		// simulation!
		setTimeout(function() {
			question.no ++;
			showQuestion(question);
		},1000);// sim
		},2000);
}


function showQuestion(q) {
	for(var i=0;i<buttons.length;i++) {
		$(buttons[i]).removeClass('right wrong');
	}
	
	
	$("#question").html(q.q);
	$("#answerA").html(q.answers[0]);
	$("#answerB").html(q.answers[1]);
	$("#answerC").html(q.answers[2]);
	$("#answerD").html(q.answers[3]);
	
	for(var i=1;i<=15;i++) {
		$("#t"+i).removeClass('active');
		$("#p"+i).html('&nbsp;');
	}
	for(var i=1;i<q.no;i++) {
		$("#p"+i).html('♦');
	}
	$("#t"+q.no).addClass('active');	
}

var timer;

function startTimer() {
	var start = new Date().getTime();
	timer = setInterval(function(){
		var now = new Date().getTime();
		$("#time").attr('value', (now-start)/question.time * 100 );
		if(now-start>question.time) {
			clearInterval(timer);
			goWrong(0,1); //sim 
		}
	}, 100);
}

function init() {
	for(var i=0;i<buttons.length;i++) {
		$(buttons[i]).click((function(x){return function(){setAnswer(x);};})(i));
	}
	
	$("#j0").click(function(){
		$("#j0").addClass('ui-disabled');
		$("#jokers").panel('close');
		question.time += question.time;
	}); // double time
	
	$("#j1").click(function(){
		$("#j1").addClass('ui-disabled');
		$("#jokers").panel('close');
		
	}); // 50:50
	$("#j2").click(function(){
		$("#j2").addClass('ui-disabled');
		$("#jokers").panel('close');
		
	}); // 2nd try
	
	
	$(document).on("pageshow","#stage",function(){ // When entering pagetwo
		  startTimer();
		});
}


function blink(id){
	for(var i=0;i<3;i++)
		$(id).delay(50).fadeTo(50,0.5).delay(50).fadeTo(50,1);
}


$(document).ready(function() {
	console.log("ready");
	init();
	
	showQuestion(question);
});


// compass function from zodiak
function activateLatLng(stage, id) {
	var f = GEO.drawCompass(document.getElementById('ang-' + id),
			stages[game.player].compass);

	$("#help").click(function(e) {
		$('#help').unbind('click');
		GEO.untrack();
		stageDone(stage, id, '');
		nextStage(Cr.next(game.k[game.k.length-1]));
	});

	GEO.track(stage.latlng[0], stage.latlng[1], function(dist, heading, angle) {
		f(heading, angle);
		$('#dist-' + id).html('' + Math.floor(dist * 1000) + 'm');
		if (dist * 1000 < stage.latlng[2]) {
			GEO.untrack();
			stageDone(stage, id, '');
			nextStage(Cr.next(game.k[game.k.length-1]));
		}
	}, function(e) {
		console.log("GPSERROR");
	});
}