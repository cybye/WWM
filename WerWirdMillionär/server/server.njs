  var winston = require('winston');

  //
  // Requiring `winston-papertrail` will expose
  // `winston.transports.Papertrail`
  //
  require('winston-papertrail').Papertrail;

  var winstonPapertrail = new winston.transports.Papertrail({
    host: 'logs4.papertrailapp.com',
    port: 17389
  })

  winstonPapertrail.on('error', function(err) {
    // Handle, report, or silently ignore connection errors and failures
  });

  var logger = new winston.Logger({
    transports: [winstonPapertrail]
  });


function log(x) {
	console.log(new Date() + " wwm " + x);
	logger.info(x);
}

var express = require('express');  
var app = express();  
var server = require('http').createServer(app);  
var io = require('socket.io')(server);
var fs = require('fs');
var request = require('request')
var bodyParser = require('body-parser')


// json api
var api_version = '/api/v1';

app.use(bodyParser.json());       // to support JSON-encoded bodies

function security(req, res, andThen) {
	if(!req.query || !req.query.secret || req.query.secret != settings.secret) {
		res.status(403).send("403 forbidden");
	} else andThen(req,res);
}

// create game - should be post, but for simplicity ;)
app.get(api_version + '/create', function(req,res){
	log('create ' + req.query);
	security(req,res,function(req,res) {
		if(!req.query.id) res.send("please provide correct parameters");
		else 	
			createGame(req.query.id, req.query.name, function() {
				res.setHeader('Content-Type', 'application/json');
				res.send("created")
			}, function(err) {
				res.status(500).send("error creating game");
			})
	});
});
//list the games
app.get(api_version + '/list', function(req,res){
	log('list' +  req.query);
	security(req,res,function(req,res) {
		listStates(games.active, function(states){
			res.setHeader('Content-Type', 'application/json');
			res.send(JSON.stringify(states,null,2));
		});
	});
});


// rest is static
app.use(express.static('../WebContent'));  

/*
io.configure(function() {
      io.set('log level',2);
});
*/

var listeners = {};

io.sockets.on('connection', function(socket) {

	log('connected client ' + socket.id);

	// handle disconnects
	socket.on('disconnect', function() {
		log('disconnecting client ' + socket.id);
		delete listeners[socket.id];
		games.disconnect(socket);
	});

	// handle messages
	socket.on('wwm', function(data) {
		// find game and join client, else ask for a id
		if(data.secret === settings.secret) {
			log('ADMIN CONNECTION ' + socket.id);
			listeners[socket.id] = socket;
		}
		informListeners(data, socket,'in');
		findGame(socket,data).apply()
	});	  
});


/*
 * tell the client or the server something
 */
function tell(socket, id, state) {
	var d ={id: id, state: state};
	socket.emit("wwm",d)
	informListeners(d, socket, 'out');
}

function informListeners(data, socket, direction) {
	for(var i in listeners) 
		if(listeners.hasOwnProperty(i)) {
			listeners[i].emit("wwm", {client: socket.id, dir: direction, data:data});
		}
}


// games transient data-structure
var games = (function() {	
	var active = {}	
	return {
		active: active,
		// find a game by the give socket and id
		find: function(id) {
				return active[id]
		},
		// create a game with the given id
		create: function(id) {	
			log('creating game ' + id);
			var clients = {};
			return active[id] = {
				id: id,              
				clients: clients,
				// apply the given command
				apply: function(socket, data) {
					if(!clients[socket.id]) {
						clients[socket.id] = socket
						update(active[id], socket)
					} 
					// actually plays
					play(active[id], socket, data)
				},
				// reply to a command
				reply: function(socket, state) {
					tell(socket, id, state)
				},
				replyAll: function(state) {
					for(var i in clients) 
						if(clients.hasOwnProperty(i))
							tell(clients[i], id, state)
				},
				sync: function() {
					for(var i in clients) 
						if(clients.hasOwnProperty(i))
							tell(clients[i], id, active[id].state.current, 
									active[id].state.current)
				},
				destroy: function() {
					delete active[id];
				}
			}			
		},
		// disconnect a client
		disconnect: function(socket) {
			for(var i in active) 
				if(active.hasOwnProperty(i)) { 
					delete active[i].clients[socket.id]
					// delete empty games? 
				}
		},
		connectAll: function(socket) {
			for(var i in active) {
				if(active.hasOwnProperty(i))
					active[i].clients[socket.id] = socket;
			}
		}
	}
	
})();

/*
 * find a game for the given socket and data
 */
function findGame(socket,data) {
	
	// search the games for the nearest to this position?
	var game = games.find(data.id)
	
	return {
		disconnect: function(){
			if(game)
				game.disconnect(socket)
		},
		apply: function(){
			if(!game && data.id) // no game but a id
				game = games.create(data.id)
			if(game)	
				game.apply(socket, data)
		}
	}
}


/*
 * bring client to current state (has joined) 
 */
function update(game, socket, data) {
	if(game && socket) {		
		serverside.update(game, socket)
	}
}

/*
 * process client input to the game
 */
function play(game, socket, data) {
	if(game && socket && data.cmd && serverside[data.cmd]) {	
		serverside[data.cmd](game, socket, data.arg)
	}
}

/*
 * messages and actions:
 */

function createGame(id, name, andThen, orElse) {
	newGame(function(questions, positions, settings) {
		try {
		saveState(id, initDefault(id, name, questions, positions));
		log("initialized game " + id + " with name " + name + " and " + positions.length + " positions");
		if(andThen) andThen();
		} catch (err) {
			log("unable to create game " + id + " " + JSON.stringify(err))
			if(orElse) orElse(err);
		}
	})
}

function initDefault(id,name, questions, positions) {
	return {
			current: {
				cmd:'init', 
				jokers:[1,1,1]
			},
			id: id,
			name: name,
			positions: positions,
			questions: questions,
			jokers: [1,1,1],
			pos: -1,
			geo: positions[0],
			walk: true,
			created: Date.now()			
	}
}

// destructively writes the given state
function saveState(id, state) {
	log("writing game to file " + settings.gamedir +'/'+id)
	fs.writeFileSync(settings.gamedir + '/' + id,JSON.stringify(state));
}

// load state 
function loadState(id, questions, positions) {
	try {
		return JSON.parse(fs.readFileSync(settings.gamedir + '/' + id));
	} catch(err){
		log("unable to load game " + id + " " + JSON.stringify(err));
		return null;
	}
}

function getSmallState(id,s) {
	return {
		id: id,
		name: s.name,
		pos: s.pos,
		jokers: s.jokers,
		created: s.created,
		started: s.started,
		accessed: s.accessed
	};
} 

function listStates(actives, andThen) {
	fs.readdir(settings.gamedir,function(err,files){
		var states = {};
		for(var i in files) {
			var s = JSON.parse(fs.readFileSync(settings.gamedir + '/' + files[i]));			
			states[files[i]] = getSmallState(files[i],s);
		}
		for(var i in actives) {
			if(actives.hasOwnProperty(i))
				states[i] = getSmallState(i,actives[i].state)
		}
		andThen(states)
	});
}


// server side implementation react to messages sent from client
var	serverside = {
		
		
		// bring the client up to date, when it joins late
		// can also be used for initialization
		update: function(game, socket) {
			if(!game.state) {
				game.state = {}; // initializing
				game.playerPositions = {}; // track pos
				game.state = loadState(game.id);
				if(!game.state) {
					game.state = { current: { cmd: 'illegalId' }} 
					game.sync();
					game.destroy(); // does only destroy the ref not the object
				} else {
					game.state.accessed = Date.now(); //track
					game.sync()
				}
			} else 
				game.state.accessed = Date.now(); //track
				game.reply(socket, game.state.current)
		},
		
		
		// confirms whatever has to be confirmed - 
		showQuestion: function(game, socket, arg) {
			if(game.state) {
				var st = game.state;
				if(st.nextQuestion) { 
					st.nextQuestion = false; // only once
					st.pos ++; 
					st.start = Date.now();
					st.timeout = st.pos > 10? 30000 : st.pos > 5 ? 45000 : 60000;

					shuffle(st.questions[st.pos]);
					var q = st.questions[st.pos].shift(); 

					st.right = q.right;
					st.current = {
							cmd:'showQuestion', 
							arg: {question: q.question, answers: q.answers },
							jokers: st.jokers,
					};
					st.timer = setInterval(function(){
						var now = Date.now();
						if(now-st.start> st.timeout/*ms*/) {
							/*
							 * check if the timejoker is still active, 
							 * if so use it automatically
							 * This is joker0
							 */
							if(st.jokers[0]) {
								st.timeout = st.timeout + (st.pos > 10? 30000 : st.pos > 5 ? 45000 : 60000);
								st.jokers[0] = 0;
								
							} else {
								clearInterval(st.timer);
								st.current = {
										cmd: 'failed',
										arg: {
											right: st.right
										}
								};
								game.sync();
								game.destroy();
							}
						} else {
							game.replyAll({
								cmd: 'timer',
								arg: (now-st.start)/st.timeout * 100,
								jokers: st.jokers
							});
						}
					}, 200);
				}
				game.sync();				
			}
		},
		
		
		// give the answer (1..4) to the current question
		setAnswer : function(game, socket, arg) {
			if(game.state) {
				var st = game.state;
				if(st.timer)clearInterval(st.timer);
				// hier am log() bitte nichts dran "andern, Log-Format wird f"ur die Highscoreliste geparsed!
				log(game.id + " setAnswer " + JSON.stringify(arg) + " right is " + st.right + " for question " + st.pos);
				if(arg == st.right) {
					st.current = {
							cmd: 'rightAnswer',
							arg: {
								answer: st.right,
								next: st.pos+1
								} 
					};
					st.geo = st.positions[st.pos+1];
					game.sync();
					st.walk = true;
					
					// save the state for the given positions
					if(st.pos == 4 || st.pos == 9) {
						saveState(game.id,game.state)
					}
					
				} else {
					st.current = {
							cmd: 'failed',
							arg: {
								answer:arg, 
								right: st.right
								} 
					}
					game.sync();
					game.destroy();
				}
			}
		},
		
		atPosition : function(game,socket,arg) {
			log(game.id + " received position " +JSON.stringify(arg));
			game.playerPositions[socket.id] = [Date.now(),arg]; // track positions
			if(game.state.walk) {
				var st = game.state;
				var d = distance(st.geo[1],st.geo[2], arg[0], arg[1]);
				// console.log(st.geo[0], st.geo[1], arg[0], arg[1]);
				if(d[0] < 0.02 /* 20 meters */) {
					st.current = {cmd: 'atPosition', arg: st.geo[3], cont: st.geo[4]}
					st.walk = false;
					st.nextQuestion = true;
					
					if(!st.started) {// the game starts when they are at the first question/position
						st.started = Date.now();
						saveState(game.id,st)
					}
					game.sync();
				} else {
					game.reply(socket, {
						cmd: 'compass',
						arg: {angle: d[1], distance:d[0] }// or not?
					})
				}
			}
		},
		
		// sets the geo-position of the player, a bit of help
		help : function(game, socket, arg) {
			log(game.id + " help requested ");
			var st = game.state;
			if(st.walk) {
				st.current = {cmd: 'atPosition', arg: st.geo[3], cont: st.geo[4]}
				st.walk = false;
				st.nextQuestion = true; // dd dangerous
				game.sync();
			}
		},
		
		// requests one of the jokers
		useJoker : function(game, socket, arg) {
			log(game.id + " joker used " + arg);
			var st = game.state;
			if(st.jokers[arg]) {
				st.jokers[arg] = 0;
				if(arg == 0) {
					// double time
					st.timeout = st.pos > 10? 60000 : st.pos > 5 ? 90000 : 120000;
					
				} else if(arg == 1) {
					var a=[];
					for(var i=0;i<4;i++) if(i!=st.right) a.push(i);
					shuffle(a);
					st.current.disabled = [a.pop(),a.pop()];
					log(game.id + " disabled questions " + JSON.stringify(st.current.disabled));
					
				} else if(arg == 2) {
					st.start = Date.now();
					var q = st.questions[st.pos].shift(); // next
					st.right = q.right;
					st.current.arg = {question: q.question, answers: q.answers }
					st.current.disabled = false;
				}
				game.sync();
			}
		},
		
		chat : function(game,socket,arg) {
			log(game.id + " chat message " + arg);
			game.replyAll(socket, {
				cmd: 'chat',
				arg: arg
			});
		}
		
		
	}


// GEO
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


var rating_map = {
"50":0,
"100":1,
"200":2,
"300":3,
"500":4,
"1000":5,
"2000":6,
"4000":7,
"8000":8,
"16000":9,
"32000":10,
"64000":11,
"125000":12,
"500000":13,
"1000000":14
};

/*
 * base initialization of the available game's, questions, props aso.
 * Format: Frage, Antw1, A2, A3, A4, Rating, Right 1-4.
 */
function processQuestions(body) {
	var questions = [];
	body.split('\r\n').forEach(function (line) { 
		var t = line.split("\t");
		if(t[0] != "Frage") {
			var q = {
					question: t[0],
					answers: [ t[1], t[2], t[3], t[4] ],
					rating: rating_map[t[5]], // || t[5], // map or take the val if not in map
					right: t[6]-1
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

	// console.log("levels", JSON.stringify(levels,null,2));
	return levels;
}

function processPositions(body) {
	var positions = [];
	body.split('\r\n').forEach(function (line) { 
		var t = line.split("\t");
		if(t[0] != "Lat") {
			var q = t;
			positions.push(q);
		}
	});
	return positions;
}

function updateQuestions(url, andThen) {
	if(andThen === undefined) return;
	request({url:url}, 
			function(error, resp, body) {
		log("questions response status " + resp.statusCode)
		//log("ä") console may not be able to log in utf8
		if (!error && resp.statusCode == 200) {
			 andThen(processQuestions(body));
		}
		if(error) log("Error " + error);
		return // geht net bei fehler
	})
}

function updatePositions(url, andThen) {
	if(andThen === undefined) return;
	request({url:url}, 
			function(error, resp, body) {
		log("positions response status " + resp.statusCode)
		//log("ä") console may not be able to log in utf8
		if (!error && resp.statusCode == 200) {
			 andThen(processPositions(body));
		}
		if(error) log("Error " + error);
		return // geht net bei fehler
	})
}

// http://stackoverflow.com/questions/6274339/how-can-i-shuffle-an-array-in-javascript
function shuffle(o){
    for(var j, x, i = o.length; i; j = Math.floor(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x);
    return o;
}

function newGame(andThen) {
	
		updateQuestions(settings.questionsUrl, function(levels) {
			/*
	for(var i in levels) {
		log('Level ' + i + " questions " + levels[i].length)
	}
			 */
			/*
			var game = {}
			for(var i in levels) {
				game[i] = levels[i][Math.floor(Math.random()*levels[i].length)]
			}
			*/
			for(var i in levels) {
				shuffle(levels[i]);
			}
			updatePositions(settings.positionsUrl, function(positions) {
				andThen(levels, positions, settings)	
			})
		});		
}

console.log('reading settings')

var settings = JSON.parse(fs.readFileSync('etc/settings.json','utf8'));

console.log('listening at ' + settings.port)
server.listen(settings.port);
