/**
 * http://usejsdoc.org/
 */

var mongoose = require('mongoose');
mongoose.connect('mongodb://localhost/test');

/*
 * Positions
 */

var positionSchema = new mongoose.Schema({

	level: Number,
	lat: Number,
	lng: Number,
	text: String,
	cont: Number

});

/*
 * performs full update
 * @arg positions array of {level, lat, lng, text}
 */
positionSchema.statics.updatePositions = function(positions, cb) {
	Audit.log('positions update requested');
	this.remove({}, function(err){
		if(err) {
			cb(err,null);
		} else {
			for(var i=0;i<positions.length;i++) {
				var p = new Position(positions[i])
				p.save();
			}
			Audit.log('positions update performed', positions);
			cb(null, positions);
		}
	});
}

var Position = mongoose.model('position', positionSchema);


/*
 * Questions
 */

var questionSchema = new mongoose.Schema({

	level: Number,
	questions: String, 
	answers: [String],
	valid: Number,
	author: String
	
});

/*
 * performs full update
 * @arg questions array of {level, questions, answers, valid, author}
 */
questionSchema.statics.updateQuestions = function(questions, cb) {
	Audit.log('questions update requested');
	this.remove({}, function(err){
		if(err) {
			cb(err,null);
		} else {
			for(var i=0;i<questions.length;i++) {
				var p = new Question(questions[i])
				p.save();
			}
			Audit.log('questions update performed', questions);
			cb(null, questions);
		}
	});	
}

var Question = mongoose.model('question', questionSchema);


/*
 * Game
 */

var gameSchema = new mongoose.Schema({
	
	id: {type: String, index: true},               // id of the game
	user: String,                                  // assigned user
	created: {type: Number, 'default': Date.now},  // creation date
	modified: Number,                              // last modification
	level: {type:Number, 'default' :0 },           // position in the question-array
	jokers: {type:[Number], 'default': [1,1,1]},   // the jokers available/used
	atPos: {type: Boolean, 'default':false }, 
	question: {
		started: Number, 
		timeout: Number,
		rating: Number, 
		text: String,
		answers: [String],
		right: Number,
		author: String
	}
});


gameSchema.statics.createGame = function(id, user, cb) {
	var game = new Game({
		id: id,
		user: encodeURIComponent(user),
	});
	game.save();
	if(cb instanceof Function) cb(game);
} 

gameSchema.statics.findGame = function(id, cb){
	return this.findOne({id : id}, cb);
}

// game methods

// 
gameSchema.methods.nextLevel = function(cb) {
	this.level = this.level + 1;
	this.atPos = false;
	this.question = {};
}

gameSchema.methods.getPosition = function(cb){
	Position.findOne({level:this.level}, cb);
}

gameSchema.methods.getQuestion = function(cb) {
	var that = this;
	if(that.question) cb(null, that.question);
	else {
		Question.find({level:that.level}, function(err, qs){
			if(err) cb(err, null);
			else if (qs.length == 0) {
				cb("no question found to choose from", null);
			} else {
				var i = Math.random() * qs.length;
				that.question = qs[i];
				cb(null, that.question);
			}
		});
	};
}


gameSchema.methods.getAlternativeQuestion = function(cb) {
	var that = this;
	// works only once!
	Question.find({level:that.level, question: {$ne: that.question}}, function(err, qs){
		if(err) cb(err, null);
		else if(qs.length==0) {
			cb(null, that.question);
		} else {
			var i = Math.random() * qs.length;
			that.question = qs[i];
			cb(null, that.question);
		}
	});
}

var Game = mongoose.model('game', gameSchema);


/*
 * Audit 
 */

var auditSchema = new mongoose.Schema( {
	time: Date,
	id: String,
	op: String,
	state: mongoose.Schema.Types.Mixed,
})

// simple audit-logexi
auditSchema.statics.log = function(op, state) {
	new Audit({
		time: new Date(),
		id: state && state.id || 'sys',
		op: op,
		state: state
	}).save();
}
var Audit = mongoose.model('audit', auditSchema);




exports.Game = Game;
exports.Question = Question;
exports.Position = Position;


