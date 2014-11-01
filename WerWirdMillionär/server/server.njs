/*
var connect = require('connect');
var socketio = require('socket.io');

var mainServer = connect.createServer(
    connect.static(__dirname)
).listen(8080);
 */


var req = require('request')
var fs = require('fs');
//load questions
//fs.readFileSync('data/ww.tab')

function log(x) {
	console.log(x);
}

/* the game holds 
 * a client id (locally stored) 
 * the current level, 
 * the used jokers,
 * the current question with shuffle and timeout
 * 	a special question is to reach one of the fail-positions in lat lng
 * a general game-timeout (say, a day)
 * 
 * the communication between the client and the game is
 * 
 * client <- server 
 * 
 * init(id) : question (or get-position)
 * set-position(id) : question
 * set-answer(id, answer) : question 
 * set-joker(id) :  joker-reply (set timeout, disable-answer, next question ...) 
 * 
 * 3 special 'questions':  get-position, fail, game-win 
 * 
 */




function processQuestions(body) {
	var questions = [];
	body.split('\n').forEach(function (line) { 
		var t = line.split("\t");
		if(t[0] != "Frage") {
			var q = {
					question: t[0],
					answers: [ t[1], t[2], t[3], t[4] ],
					rating: t[5]
			};
			questions.push(q);
		}
	});

//	transform to levels
	var levels = {};

	for(var i in questions) {
		var q = questions[i];
		if(!levels.hasOwnProperty(q.rating)) {
			levels[q.rating] = [];
		} 
		levels[q.rating].push(q);
	}

//	console.log(JSON.stringify(levels,null,2));
	return levels;
}


function updateQuestions(andThen) {
	if(andThen === undefined) return;

	req("", 
			function(error, resp, body) {
		if (!error && resp.statusCode == 200) {
			return andThen(processQuestions(body));
		}
		if(error) log("Error " + error);
		return
	})
}


function getGame(andThen) {
  updateQuestions(function(levels) {
	/*
	for(var i in levels) {
		log('Level ' + i + " questions " + levels[i].length)
	}
	*/
	var game = {}
	for(var i in levels) {
		game[i] = levels[i][Math.floor(Math.random()*levels[i].length)]
	}
	
	andThen(game)	
});
}


getGame(function(x){console.log(x)})

