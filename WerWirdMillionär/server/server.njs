
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



io.configure(function() {
      io.set('log level',2);
});

io.sockets.on('connection', function(socket) {
	  log('connected client ' + socket.id);
	  
	  // handle disconnects
	  socket.on('disconnect', function() {
          log('disconnecting client ' + socket.id);
        //  findGame(socket, undefined).disconnect()
	  });
	  
	  // handle messages
	  socket.on('wwm', function(data) {
		  // find game and join client, else ask for a id
		  findGame(socket,data).apply()
	  });	  
});


/*
 * tell the client or the server something
 */
function tell(socket, id, state) {
	socket.emit("wwm",{id: id, state: state})
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
				}
			}			
		},
		// disconnect a client
		disconnect: function(socket) {
			for(var i in active) 
				if(active.hasOwnProperty(i)) 
					delete active[i].clients[socket.id]
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
				newGame(function(questions, settings) {
					game.state = {
						current: {cmd:'init', jokers:[1,1,1]},
						questions: questions,
						jokers: [1,1,1],
						pos: 0,
					}
					game.sync()
				})
			} else 
				game.reply(socket, game.state.current)
		},
		
		
		// confirms whatever has to be confirmed - 
		showQuestion: function(game, socket, arg) {
			if(game.state) {
				game.state.pos ++;
				game.state.start = Date.now();
				game.state.timer = {};
				game.state.timeout = 60000;
				game.state.current = {
						cmd:'showQuestion', 
						arg: game.state.questions[game.state.pos],
						jokers: game.state.jokers,
				};
				game.sync();
				game.state.timer = setInterval(function(){
					var now = Date.now();
					if(now-game.state.start> game.state.timeout/*ms*/) {
						clearInterval(game.state.timer);
						game.state.current = {
								cmd: 'failed',
								arg: {
									answer:1, // TBD 
									next:game.state.pos+1
									}
						};
						game.sync();
					} else {
						game.replyAll({
							cmd: 'timer',
							arg: (now-game.state.start)/game.state.timeout * 100
						});
					}
				}, 200);
				
			}
		},
		
		
		// give the answer (1..4) to the current question
		setAnswer : function(game, socket, arg) {
			if(game.state) {
				if(game.state.timer)clearInterval(game.state.timer);
				if(arg == 1) { 
					game.state.current = {
							cmd: 'rightAnswer',
							arg: {
								answer:1, // TBD 
								next:game.state.pos+1
								}
					};
					game.sync();
				} else {
					game.state.current = {
							cmd: 'failed',
							arg: {
								answer:arg, 
								right:1
								} // TBD
					}
					game.sync();
				}
			}
		},
		
		// sets the geo-position of the player
		setDistance : function(game, socket, arg) {
			if(arg && arg < 0.01 /*km*/ && game.state) {
				game.state.current = {
						cmd: 'atPosition'
				}
				game.sync();
			}				
		},
		// requests one of the jokers
		useJoker : function(game, socket, arg) {
			if(game.state.jokers[arg]) {
				game.state.jokers[arg] = 0;
				if(arg == 0) {
					// double time
					game.state.timeout = 120000;
					game.sync();
				} else if(arg == 1) {
					// 50:50
					game.state.current.disabled = [0,3]; // TODO
					game.sync();
				} else if(arg == 2) {
					// extra chance
				}
			}
		}
		
		
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

	// console.log("levels", JSON.stringify(levels,null,2));
	return levels;
}


function updateQuestions(url, andThen) {
	if(andThen === undefined) return;
	req({url:url}, 
			function(error, resp, body) {
		log("response status", resp.statusCode)
		//log("ä") console may not be able to log in utf8
		if (!error && resp.statusCode == 200) {
			 andThen(processQuestions(body));
		}
		if(error) log("Error " + error);
		return // geht net bei fehler
	})
}

function newGame(andThen) {
	fs.readFile('etc/settings.json','utf8', function (err,data) {
		var settings = JSON.parse(data); 
		updateQuestions(settings.questionsUrl, function(levels) {
			/*
	for(var i in levels) {
		log('Level ' + i + " questions " + levels[i].length)
	}
			 */
			var game = {}
			for(var i in levels) {
				game[i] = levels[i][Math.floor(Math.random()*levels[i].length)]
			}

			andThen(game, settings)	
		});
	});
}

console.log('about to start')

// newGame(function(game, settings){console.log(game); console.log(settings) })

server.listen(8080);
