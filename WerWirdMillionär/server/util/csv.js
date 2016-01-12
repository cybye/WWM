/**
 * http://usejsdoc.org/
 */

var req = require('request');

function processQuestions(body) {
	var questions = [];
	body.split('\r\n').forEach(function (line) { 
		var t = line.split("\t");
		if(t[0] != "Frage") {
			// {level, questions, answers, valid, author}
			var q = {
					question: t[0],
					answers: [ t[1], t[2], t[3], t[4] ],
					level: t[5],
					valid: t[6]-1,
					author: t[7]
			};
			if(q.question && q.answers && q.answers.length===4)
				questions.push(q);
		}
	});
	return questions;
}

function updateQuestions(url, andThen) {
	if(andThen === undefined) return;
	req({url:url}, 
			function(error, resp, body) {
		//log("ä") console may not be able to log in utf8
		if (!error && resp.statusCode == 200) {
			 andThen(null, processQuestions(body));
		} else if(error) andThen(error, null);
		else andThen("reponse code " + resp.statusCode, null);
	});
}



function processPositions(body) {
	var positions = [];
	body.split('\r\n').forEach(function (line) { 
		// {level, lat, lng, text, cont}
		var t = line.split("\t");
		if(t[0] != "Lat") {
			var q = {
				level: t[0],
				lat : t[1],
				lng : t[2],
				text: t[3],
				cont: t[4]
			};
			if(q.lat && q.lng)
				positions.push(q);
		}
	});
	return positions;
}

function updatePositions(url, andThen) {
	if(andThen === undefined) return;
	req({url:url}, 
			function(error, resp, body) {
		//log("ä") console may not be able to log in utf8
		if (!error && resp.statusCode == 200) {
			 andThen(null, processPositions(body));
		} else if(error) andThen(error, null);
		else andThen("response code " + resp.statisCode, null);
	})
}


exports.updateQuestions = updateQuestions;
exports.updatePositions = updatePositions;
