
var connect = require('connect');
var serveStatic = require('serve-static');
var finalhandler = require('finalhandler');
var req = require('request')
var fs = require('fs');

var serve = serveStatic('../WebContent', {'index': ['index.html', 'index.htm']})

var app = connect()
, http = require('http')
, server = http.createServer(function(req,res) {
	var done = finalhandler(req, res)
	serve(req, res, done)
}, app)
, io = require('socket.io').listen(server);


function log(x) {
	console.log(new Date() + " wwm " + x);
}


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


// games data-structure
var games = (function() {	
	var active = {}	
	return {
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
				created: Date.now(),
				accessed: Date.now(),
				// apply the given command
				apply: function(socket, data) {
					active[id].accessed = Date.now(); //track
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

// server side implementation react to messages sent from client
var	serverside = {
		
		
		// bring the client up to date, when it joins late
		// can also be used for initialization
		update: function(game, socket) {
			if(!game.state) {
				game.state = {}; // initializing
				game.playerPositions = {}; // track pos
				newGame(function(questions, positions, settings) {
					game.state = {
						current: {
							cmd:'init', 
							jokers:[1,1,1]
						},
						positions: positions,
						questions: questions,
						jokers: [1,1,1],
						pos: 0,
						geo: positions[0],
						walk: true
					}
					log("initialized game with " + positions.length + " positions");
					log(JSON.stringify(questions));
					
					game.sync()
				})
			} else 
				game.reply(socket, game.state.current)
		},
		
		
		// confirms whatever has to be confirmed - 
		showQuestion: function(game, socket, arg) {
			if(game.state) {
				var st = game.state;
				st.pos ++;
				st.start = Date.now();
				st.timer = {};
				st.timeout = 60000;
				var q = st.questions[st.pos].shift(); 
				st.right = q.right;
				st.current = {
						cmd:'showQuestion', 
						arg: {question: q.question, answers: q.answers },
						jokers: st.jokers,
				};
				game.sync();
				st.timer = setInterval(function(){
					var now = Date.now();
					if(now-st.start> st.timeout/*ms*/) {
						clearInterval(st.timer);
						st.current = {
								cmd: 'failed',
								arg: {
									right: st.right
									}
						};
						game.sync();
					} else {
						game.replyAll({
							cmd: 'timer',
							arg: (now-st.start)/st.timeout * 100
						});
					}
				}, 200);
				
			}
		},
		
		
		// give the answer (1..4) to the current question
		setAnswer : function(game, socket, arg) {
			if(game.state) {
				var st = game.state;
				if(st.timer)clearInterval(st.timer);
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
				} else {
					st.current = {
							cmd: 'failed',
							arg: {
								answer:arg, 
								right: st.right
								} 
					}
					game.sync();
				}
			}
		},
		
		atPosition : function(game,socket,arg) {
			log(game.id + " received position " +JSON.stringify(arg));
			game.playerPositions[socket.id] = [Date.now(),arg]; // track positions
			if(game.state.walk) {
				var st = game.state;
				var d = distance(st.geo[0],st.geo[1], arg[0], arg[1]);
				if(d[0] < 0.01) {
					st.current = {cmd: 'atPosition', arg: st.geo[2], cont: st.geo[3]}
					st.walk = false;
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
			log(game.id + " help requested");
			var st = game.state;
			if(st.walk) {
				st.current = {cmd: 'atPosition', arg: st.geo[2], cont: st.geo[3]}
				st.walk = false;
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
					st.timeout = 120000;
				} else if(arg == 1) {
					var a=[];
					for(var i=0;i<4;i++) if(i!=st.right) a.push(i);
					shuffle(a);
					st.current.disabled = [a.pop(),a.pop()];
					
				} else if(arg == 2) {
					st.start = Date.now();
					var q = st.questions[st.pos].shift(); // next
					st.right = q.right;
					st.current.arg = {question: q.question, answers: q.answers }
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


/*
 * base initialization of the available game's, questions, props aso.
 */
function processQuestions(body) {
	var questions = [];
	body.split('\r\n').forEach(function (line) { 
		var t = line.split("\t");
		if(t[0] != "Frage") {
			var q = {
					question: t[0],
					answers: [ t[1], t[2], t[3], t[4] ],
					rating: t[5],
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
	req({url:url}, 
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
	req({url:url}, 
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
