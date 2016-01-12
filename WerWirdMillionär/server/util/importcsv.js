/**
 * http://usejsdoc.org/
 */
var csv = require('./csv.js');
var entities = require('../game.js');


csv.updatePositions('http://localhost:9999/pos.txt', function(err, positions) {
	if(err) console.log('Error0', err);
	else {
		entities.Position.updatePositions(positions,function(err){
			if(err) console.log('Error1', err);
			else console.log('done');
		})
	}
});



csv.updateQuestions('http://localhost:9999/dummy.txt', function(err, positions) {
	if(err) console.log('Error10', err);
	else {
		entities.Question.updateQuestions(positions,function(err){
			if(err) console.log('Error11', err);
			else console.log('done1');
		})
	}
});