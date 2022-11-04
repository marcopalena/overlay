const express = require('express')
const fs = require('fs');
const path = require('path');
const moment = require('moment');
const bodyparser = require('body-parser');
const urlencodedparser = bodyparser.urlencoded({extended:false});
const jsonparser = bodyparser.json();
const app = express();
const expressWs = require('express-ws')(app);
const port = 3000;
 
// Add static files folder
app.use(express.static(__dirname + '/public'));

/************************************************************************************************************************************
                                                            GOOGLE SHEETS
************************************************************************************************************************************/

const { google } = require('googleapis');
const sheets = google.sheets('v4');

// Create JWT for authenticating with Google
const auth = require('./auth.json');
const scopes = 'https://www.googleapis.com/auth/spreadsheets.readonly';
const jwt = new google.auth.JWT(auth.client_email, null, auth.private_key, scopes); 

/************************************************************************************************************************************
                                                        IMPORT MODELS
************************************************************************************************************************************/

const Athlete = require('./models/athlete.js');
const Pool = require('./models/pool.js');
const Match = require('./models/match.js');
const MatchResult = require('./models/matchResult.js');
const Arena = require('./models/arena.js');

/************************************************************************************************************************************
                                                            LOGGING
************************************************************************************************************************************/

console.logCopy = console.log.bind(console);
console.log = function(data) {
    var currentDate = '[' + moment().format('DD/MM/YYYY HH:mm:ssZ') + '] ';
    this.logCopy(currentDate, data);
};

/************************************************************************************************************************************
                                                        WEB SOCKETS CONNECTIONS
************************************************************************************************************************************/

var controllerConnection = null;
var overlayConnection = null;
var waitIntermissionOverlayConnection = null;
var poolsOverlayConnection = null;
var bracketOverlayConnection = null;
var scorekeepConnections = {};
var fightOverlayConnections = {};

/************************************************************************************************************************************
                                                        TOURNAMENT STATE
************************************************************************************************************************************/

// Tournament sources and specifications
var source = "";
var numRounds = 6;
var withdrawnContender = "WITHDRAWN";
var undefinedContender = "TBA";
var tiedContender = "EX AEQUO";
var poolsSpecs = [];
var athletesSpec = "";
var finalPhaseSpec = {};

// Tournament structure
var assaultsSpec = {
    pools : {
        assaults: 3,                // 3 assaults
        strategy: "FIXED",          // All assaults will take place
        doppioVoid: false           // Do not void double OHs
    },
    finalPhase: {
        assaults: 5,                // 5 assaults
        strategy: "BEST",           // Best out of number of assaults
        doppioVoid: true            // Void double OHs
    },
    finals: {
        assaults: 7,                // 7 assaults
        strategy: "BEST",           // Best out of number of assaults
        doppioVoid: true            // Void double OHs
    },
}
var timesSecSpec = {
    pools : 90,                     // 90 seconds for the pools phase matches
    finalPhase: 180,                // 180 seconds for the eliminatory rounds
    finals: -1,                     // No time limit for the final
}

// Tournament state
const emptyTournament = {
    state : "UNINITIALIZED",
    phase : "NONE",
    round : 0,
    arenas : {},
    athletes : {},
    pools : {},
    finalPhase : {
        arenas : [],
        rounds : []
    }
}

var finalPhasesNames = [
    "Trentaduesimi",
    "Sedicesimi",
    "Ottavi",
    "Quarti",
    "Semifinali",
    "Finali"
];

var tournament = emptyTournament;
//var isStarted = false;
//var isInitialized = false;
var completedPools = 0;
var completedMatches = 0;
var completedRounds = 0;
var streamedPools = 0;
var isPoolsPhaseStarted = false;
var isFinalPhaseStarted = false;
var canStartFromFinalPhase = true;
var currentRound = 0;

var scores = {
  "left" : 0,
  "right" : 0
};


/************************************************************************************************************************************
                                                        TOURNAMENT STATE MANAGEMENT
************************************************************************************************************************************/

function updateTournamentState(state) {
    tournament.state = state;
    if(controllerConnection) {
        controllerConnection.send(JSON.stringify({
          "message" : "stateUpdate",
          "data" : {
              "state" : tournament.state
          }
        }));
    }
}

function updateTournamentPhase(phase) {
    tournament.phase = phase;
    if(controllerConnection) {
        controllerConnection.send(JSON.stringify({
          "message" : "phaseUpdate",
          "data" : {
              "phase" : tournament.phase
          }
        }));
    }
}

function updateTournamentRound(round) {
    if(!isInitialized()) {
        if(controllerConnection) {
            controllerConnection.send(JSON.stringify({
                "message" : "roundUpdate",
                "data" : {
                    "round" : "NONE"
                }
            }));
        }
    }
    tournament.round = round;
    let label = "";
    if(isPoolsPhase()) {
        label = "Turno " + (round+1);
    } else if(isFinalPhase()) {
        let numRounds = getNumRounds();
        label = finalPhasesNames[getFinalPhaseRoundIndex(round, numRounds)];
    } else {
        label = "NONE";
    }
    if(controllerConnection) {
        controllerConnection.send(JSON.stringify({
          "message" : "roundUpdate",
          "data" : {
              "round" : label
          }
        }));
    }
}

function getNumRounds() {
    if(!finalPhaseSpec.rounds) return 0;
    return finalPhaseSpec.rounds.length;
}

function getNumPools() {
    return Object.keys(tournament.pools).length;
}

function getNumArenas() {
    return Object.keys(tournament.arenas).length;
}

function getNumPoolsTurns() {
    return getNumPools() / getNumArenas();
}

function getFinalPhaseRoundIndex(round, numRounds) {
    return 6-numRounds + round;
}

function isInitialized() {
    return tournament.state === "INITIALIZED" || isStarted();
}

function isStarted() {
    return tournament.state === "STARTED";
}

function isPoolsPhase() {
    return isStarted() && tournament.phase === "POOLS";
}

function isFinalPhase() {
    return isStarted() && tournament.phase === "FINAL";
}

function getStreamedArenas() {
    let streamedArenas = [];
    for(let arenaId in tournament.arenas) {
        if(tournament.arenas[arenaId].isStreamed)
            streamedArenas.push(arenaId);
    }
    return streamedArenas;
}

function getFinalPhaseArenaMatchesNum(arenaId) {
    let n = 0;
    tournament.finalPhase.rounds[tournament.round].forEach((match, index) => {
        if(arenaId === match.arena) {
            n++;
        }
    });
    return n;
}

function getFinalPhaseMatchesPerRound(round) {
    var numRounds = tournament.finalPhase.rounds.length;
    return Math.pow(2, numRounds - tournament.round -1);
}

/************************************************************************************************************************************
                                                        SERVE PAGES
************************************************************************************************************************************/

// Serve controller page
app.get('/controller', urlencodedparser, (request, response) => {
    response.sendFile(path.join(__dirname + '/public/controller.html'));
});

// Serve controller page
app.get('/scorekeeper', urlencodedparser, (request, response) => {

    // Get require arena to monitor
    var arena = request.query.arena;

    // If current tournament has the specified arena serve scorekeeper page
    if(arena && tournament.arenas && arena in tournament.arenas) {
        response.sendFile(path.join(__dirname + '/public/scorekeeper.html'));
    } else {
        response.sendStatus(404);
    }
});

// Serve overlay page
app.get('/fightOverlay', urlencodedparser, (request, response) => {

    // Get require arena to monitor
    var arena = request.query.arena;
    console.log(arena);
    console.log(tournament);

    // If current tournament has the specified arena serve fight overlay page
    if(arena && tournament.arenas && arena in tournament.arenas) {
        response.sendFile(path.join(__dirname + '/public/overlay.html'));
    } else {
        response.sendStatus(404);
    }
});

// Serve standings page
app.get('/waitIntermission', (request, response) => {
  response.sendFile(path.join(__dirname + '/public/waitIntermission.html'));
});

// Serve pools page
app.get('/pools', (request, response) => {
  response.sendFile(path.join(__dirname + '/public/pools.html'));
});

// Serve bracket page
app.get('/bracket', (request, response) => {
  response.sendFile(path.join(__dirname + '/public/bracket.html'));
});

// Serve bracket page
app.get('/test', (request, response) => {
  response.sendFile(path.join(__dirname + '/public/prova.html'));
});

/*
  // If overlay page is not connected log an error and return a negative response to the controller
  if(overlayConnection == null) {
    console.error("No connection currently established to overlay.")
    response.sendStatus(404);
    return;
  }
*/

/************************************************************************************************************************************
                                                TOURNAMENT INITIALIZATION AJAX REQUESTS
************************************************************************************************************************************/

// Initialize a new tournament given the provided specifications
app.post('/initializeTournament', jsonparser, async (request, response) => {

    // Update tournament specifications
    source = request.body["source"];
    arenasSpec = request.body["arenasSpec"];
    athletesSpec = request.body["athletesSpec"];
    poolsSpecs = request.body["poolsSpec"];
    finalPhaseSpec = request.body["finalPhaseSpec"];

    // If initialize from local file flag is set load tournament from local file
    var initLocal = request.body["initLocal"];
    if(initLocal) {
        let initLocalFile = request.body["initLocalFile"] || "dump/tournament.json";
        await deserializeTournamentState(initLocalFile);
        response.status(200).send({
            state : tournament.state,
            numAthletes : Object.keys(tournament.athletes).length,
            numArenas : Object.keys(tournament.arenas).length,
            streamedArenas : getStreamedArenas()
        });
        return;
    } 

    // Initialize tournament
    console.log("Initializing new tournament...");
    tournament = emptyTournament;

    // Initialize number of rounds
    let numRounds = finalPhaseSpec.rounds.length;

    // Initialize arenas
    let streamedArenas = 0;
    arenasSpec.forEach((arenaSpec) => {
        let {name, isStreamed} = arenaSpec;
        if(isStreamed) streamedArenas++;
        tournament.arenas[name] = new Arena(name, isStreamed);
    });

    // Set list of pools for each arena
    streamedPools = 0;
    poolsSpecs.forEach((poolSpec) => {
        var arena = poolSpec.arena;
        var pool = poolSpec.id;
        var round = poolSpec.round;
        if(arena in tournament.arenas) {
            tournament.arenas[arena].isUsedInPools = true;
            tournament.arenas[arena].pools[round] = pool;
            if(arena.isStreamed) streamedPools++;
        }
    });

    // Set arenas usage during final phase rounds
    finalPhaseSpec.rounds.forEach((roundSpec, index) => {
        var arenas = roundSpec.arenas;
        arenas.forEach((arena) => {
            if(arena in tournament.arenas) {
                tournament.arenas[arena].isUsedInFinalPhase = true;
                tournament.arenas[arena].rounds.push(index);
                if(tournament.arenas[arena].usedUpToRound < index) {
                    tournament.arenas[arena].usedUpToRound = index;
                }
            }
        });
    });

    // Get athletes
    try {
        tournament.athletes = await getAthletes(athletesSpec);
    } catch(err) {
        console.log(err);
        console.log("Fetching of athletes information failed");
        response.sendStatus(400);
        return;
    }

    // Get pools
    try {
        tournament.pools = await getPools(poolsSpecs);
    } catch(err) {
        console.log("Fetching of pools information failed");
        response.sendStatus(400);
        return;
    }

    // Get final phase rounds
    try {
        tournament.finalPhase = await getFinalPhaseRounds(finalPhaseSpec, numRounds, tournament.arenas);
    } catch(err) {
        console.log("Fetching of final phase information failed");
        response.sendStatus(400);
        return;
    }

    // Set tournament as initialized
    tournament.state = "INITIALIZED";

    // isInitialized = true;
    // isPoolsPhaseStarted = true;
    await serializeTournamentState("dump/tournament.json");
    //await deserializeTournamentState("dump/tournament.json");
    //await serializeTournamentState("dump/tournament2.json");
    console.log("Tournament initialized!");

    // Respond to controller page
    response.status(200).send({
        state : tournament.state,
        phase : "NONE",
        round : "NONE",
        numAthletes : Object.keys(tournament.athletes).length,
        numArenas : Object.keys(tournament.arenas).length,
        streamedArenas : getStreamedArenas()
    });
});

// Start the current tournament pools phase
app.post('/startPoolsPhase', jsonparser, async (request, response) => {

    // Check tournament has been initialized
    if(!isInitialized()) {
        console.log("Tournament should be initialized before starting pools phase!");
        response.sendStatus(400);
        return;
    }

    // Set the tournament as started
    updateTournamentState("STARTED");

    // Update current phase
    updateTournamentPhase("POOLS");

    // Update current round
    updateTournamentRound(0);

    // Clear arena rounds
    for(let arenaId in tournament.arenas) {
        tournament.arenas[arenaId].round = 0;
    }

    // Start the pools phase
    completedPools = 0;
    console.log("Pools phase started!");
    console.log(`Pools turn ${tournament.round} started!`);
    return response.sendStatus(200);
});

app.post('/getMatches', jsonparser, async (request, response) => {

    // Get requesting arena
    var arenaId = request.body["arena"];
    let arena = tournament.arenas[arenaId];

    // Check if tournament is initialized
    if(!isInitialized()) {
        console.log(`Arena ${arenaId} has requested matches but tournament is not initialized yet!`);
        response.status(400).send({
            error : "Tournament not initialized!"
        });
        return;
    }

    // Check if tournament is started
    if(!isStarted()) {
        console.log(`Arena ${arenaId} has requested matches but tournament is not started yet!`);
        response.status(400).send({
            error : "Tournament not started!"
        });
        return;
    }

    // Fetch next matches for arena when in pools phase
    if(isPoolsPhase()) {

        // Check if arena is ahead current round
        if(arena.round > tournament.round) {
            console.log(`Arena ${arenaId} has requested matches but turn ${arena.round+1} has not started yet!`);
            return response.status(400).send({
                error : `Turn ${arena.round+1} of the pools phase has not been started yet!`
            });
        }

        // Update pools info
        try {
            tournament.pools = await getPools(poolsSpecs);
        } catch(err) {
            console.log("Fetching of pools information failed");
            response.sendStatus(400);
            return;
        }

        // Check if incomplete pools turn
        if(checkIncompletePoolsTurn(tournament.round)) {
            console.log(`Arena ${arenaId} has requested matches but matches of turn ${arena.round+1} are not complete yet!`);
            return response.status(400).send({
                error : `Matches of turn ${arena.round+1} of the pools phase are not complete yet! Try again later.`
            });
        }

        // Compose list of matches for the current round
        var matches = [];
        var poolId = arena.pools[tournament.round];
        tournament.pools[poolId].matches.forEach((match, index) => {
            var name = match.firstContender.contender + " vs " + match.secondContender.contender;
            matches.push({
                match,
                name
            })
        });

        // TODO: debug
        //matches = matches.slice(0, 1);

        // Compose dictionary of athletes info
        var athletes = {};
        tournament.pools[poolId].athletes.forEach((athlete) => {
            athletes[athlete] = tournament.athletes[athlete.trim()];
        });

        // Send update matches to current arena
        return response.status(200).send({
          matches : matches,
          athletes : athletes,
          phase : "Girone " + poolId
        });
    }


    // Fetch next matches for arena when in final phase
    if(isFinalPhase()) {

        // Check if arena is ahead current round
        if(arena.round > tournament.round) {
            console.log(`Arena ${arenaId} has requested matches but round has not started yet!`);
            response.status(400).send({
                error : `Round "${finalPhasesNames[arena.round]}" of the final phase has not been started yet!`
            });
        }

        // Update final phase rounds
        var numRounds = finalPhaseSpec.rounds.length;
        try {
            tournament.finalPhase = await getFinalPhaseRounds(finalPhaseSpec, numRounds, tournament.arenas);
        } catch(err) {
            console.log("Fetching of final phase information failed");
            response.sendStatus(400);
            return;
        }

        // Check if incomplete final phase round
        if(checkIncompleteRound(tournament.round)) {
            console.log(`Arena ${arenaId} has requested matches but matches of round "${finalPhasesNames[arena.round]}" are not complete yet!`);
            return response.status(400).send({
                error : `Matches of round "${finalPhasesNames[arena.round]}" of the final phase are not complete yet! Try again later.`
            });
        }

        // Compose lists of matches for the current round and the given arena
        var matches = [];
        var athletesSet = new Set();
        tournament.finalPhase.rounds[tournament.round].forEach((match, index) => {
            if(arenaId === match.arena) {
                var name = match.firstContender.contender + " vs " + match.secondContender.contender;
                matches.push({
                    match,
                    name
                });
                athletesSet.add(match.firstContender.contender.trim());
                athletesSet.add(match.secondContender.contender.trim());
            }
        });

        // Compose dictionary of athletes info
        var athletes = {};
        for(let athlete of athletesSet){
            athletes[athlete] = tournament.athletes[athlete];
        }

        // Send matches to controller
        if(controllerConnection) {
            controllerConnection.send(JSON.stringify({
                "message" : "updateRoundMatches",
                "data" : {
                    "round" : tournament.round,
                    "matches" : matches
                }
            }));
        }

        // Send update matches to current arena
        return response.status(200).send({
           matches : matches,
           athletes : athletes,
           phase : finalPhasesNames[tournament.round]
        });
    }
});



// Serves a fight finish request from the  controller
app.post('/finishPhase', jsonparser, async (request, response) => {

    // Get arena
    var arenaId = request.body["arena"];
    var arena = tournament.arenas[arenaId];

    // Manage finish during pool phase
    if(isPoolsPhase()) {

        // Update number of completed pools
        completedPools++;
        console.log("Completed pool " + arena.pools[tournament.round] + "!" );

        // Update arena round
        arena.round++;
        console.log("Arena " + arenaId + " " + arena.round);

        // Hide fight overlay for the arena
        if(fightOverlayConnections[arenaId]) {
            fightOverlayConnections[arenaId].send(JSON.stringify({
                "message" : "hideOverlay",
                "data" : {
                    "useAnimation" : true
                }
            }));
        }

        // If pools turn is finished update round
        // let poolsPerTurn = getNumPools()/getNumPoolsTurns();
        // console.log(getNumPools());
        // console.log(getNumPoolsTurns());
        // if(completedPools === getStr) {
        //     updateTournamentRound(tournament.round+1);
        //     console.log(tournament.round);
        // } else if(completedPools === getNumPools()) {
        //     console.log("Pools phase ended!");
        // }
        response.sendStatus(200);
        return;
    }

    // Manage finish during final phase
    if(isFinalPhase()) {

        // Update number of completed matches
        completedMatches += getFinalPhaseArenaMatchesNum();
        var matchesPerRound = getFinalPhaseMatchesPerRound();
        if(completedMatches !== matchesPerRound) {
            response.sendStatus(200);
            return;
        }

        // Update arena round
        arena.round++;

        // Update number of completed rounds
        completedRounds++;
        console.log("Completed round " + finalPhasesNames[getFinalPhaseRoundIndex(tournament.round, getNumRounds())] + "!" );

        // Hide fight overlay for the arena
        if(fightOverlayConnections[arenaId]) {
            fightOverlayConnections[arenaId].send(JSON.stringify({
                "message" : "hideOverlay",
                "data" : {
                    "useAnimation" : true
                }
            }));
        }

        // Update round
        // if(tournament.round < getNumRounds() - 1){
        //     updateTournamentRound(tournament.round + 1);
        // } else {
        //     console.log("Final phase ended!");
        // }
        response.sendStatus(200);
        return;
    }
});

app.post('/nextStep', jsonparser, async (request, response) => {
    let label = "";
    if(isPoolsPhase()) {
        if(tournament.round < getNumPoolsTurns()-1) {
            console.log(`Pools turn ${tournament.round} ended!`);
            updateTournamentRound(tournament.round+1);
            console.log(`Pools turn ${tournament.round} started!`);
            label = `Turno ${tournament.round+1}`;
        } else {

            // Update phase and round
            updateTournamentPhase("FINAL");
            updateTournamentRound(0);

            // Clear arena rounds
            for(let arenaId in tournament.arenas) {
                tournament.arenas[arenaId].round = 0;
            }

            // Start the pools phase
            completedMatches = 0;
            completedRounds = 0;
            console.log("Final phase started!");
            console.log(`Round ${finalPhasesNames[tournament.round]} started!`);
            label = `${finalPhasesNames[tournament.round]}`;
        }
    } else if(isFinalPhase()) {
        console.log(getNumRounds());
        if(tournament.round < getNumRounds()-1) {
            console.log(`Round ${finalPhasesNames[tournament.round]} ended!`);
            updateTournamentRound(tournament.round+1);
            console.log(`Round ${finalPhasesNames[tournament.round]} started!`);
            label = `${finalPhasesNames[tournament.round]}`;
        } else {
            updateTournamentState("FINISHED");
            label = `None`;
        }
    }

    // Send state to controller
    controllerConnection.send(JSON.stringify({
        "message" : "updateTournamentInfo",
        "data" : {
            "state" : tournament.state,
            "phase" : tournament.phase,
            "round" : label,
            "numAthletes" : JSON.stringify(Object.keys(tournament.athletes).length),
            "numArenas" : JSON.stringify(Object.keys(tournament.arenas).length),
            "streamedArenas" : getStreamedArenas(),
            "connections" : {
                "overlay" : Object.keys(fightOverlayConnections),
                "scorekeepers" : Object.keys(scorekeepConnections)
            }
        }
    }));

    return response.sendStatus(200);
});

app.post('/previousStep', jsonparser, async (request, response) => {
    let label = "";
    if(isPoolsPhase()) {
        if(tournament.round > 0) {
            console.log(`Pools turn ${tournament.round} ended!`);
            updateTournamentRound(tournament.round-1);
            console.log(`Pools turn ${tournament.round} started!`);
        }
        label = `Turno ${tournament.round+1}`;
    } else if(isFinalPhase()) {
        if(tournament.round > 0) {
            console.log(`Round ${finalPhasesNames[tournament.round]} ended!`);
            updateTournamentRound(tournament.round-1);
            console.log(`Round ${finalPhasesNames[tournament.round]} started!`);
            label = `${finalPhasesNames[tournament.round]}`;
        } else {
            updateTournamentState("FINISHED");

            // Update phase and round
            updateTournamentPhase("POOLS");
            updateTournamentRound(getNumPoolsTurns()-1);

            // Clear arena rounds
            for(let arenaId in tournament.arenas) {
                tournament.arenas[arenaId].round = 0;
            }
            completedPools = 0;
            label = `Turno ${tournament.round+1}`;
        }
    }

    // Send state to controller
    controllerConnection.send(JSON.stringify({
        "message" : "updateTournamentInfo",
        "data" : {
            "state" : tournament.state,
            "phase" : tournament.phase,
            "round" : label,
            "numAthletes" : JSON.stringify(Object.keys(tournament.athletes).length),
            "numArenas" : JSON.stringify(Object.keys(tournament.arenas).length),
            "streamedArenas" : getStreamedArenas(),
            "connections" : {
                "overlay" : Object.keys(fightOverlayConnections),
                "scorekeepers" : Object.keys(scorekeepConnections)
            }
        }
    }));
});

// Start the current tournament final phase
app.post('/startFinalPhase', jsonparser, async (request, response) => {

    // Check tournament has been initialized
    if(!isInitialized()) {
        console.log("Tournament should be initialized before starting final phase!");
        response.sendStatus(400);
        return;
    }

    // Set the tournament as started
    updateTournamentState("STARTED");

    // Update current phase
    updateTournamentPhase("FINAL");

    // Update current round
    updateTournamentRound(0);

    // Update pools
    try {
        tournament.pools = getPools(poolsSpecs);
    } catch(err) {
        console.log("Fetching of pools information failed");
        response.sendStatus(400);
        return;
    }

    // Clear arena rounds
    for(let arenaId in tournament.arenas) {
        tournament.arenas[arenaId].round = 0;
    }

    // Start the pools phase
    completedMatches = 0;
    completedRounds = 0;
    console.log("Final phase started!");
    console.log(`Round ${finalPhasesNames[tournament.round]} started!`);
    return response.sendStatus(200);
});


// Update current match of the given arena
function updateCurrentArenaMatch(arenaId, match) {

    // Sanity check
    if(!tournament || !(arenaId in tournament.arenas)) {
        return null;
    }

    // Get arena
    var arena = tournament.arenas[arenaId];

    // If pools phase is active update current arena pool match
    if(!isFinalPhase()) {
        var poolId = arena.pools[arena.round];
        var pool = tournament.pools[poolId];
        pool.matches[arena.match] = match;
    }

    // If final phase is active get current arena final phase round match
    if(isFinalPhase() && arenaId in tournament.finalPhase.arenas) {
        tournament.finalPhase.rounds[tournament.round][arena.match] = match;
    }
    return null;
}

// function nextArenaMatch(arenaId) {
//
//     // Sanity check
//     if(!tournament || !(arenaId in tournament.arenas)) {
//         return null;
//     }
//
//     // Get arena
//     var arena = tournament.arenas[arenaId];
//
//     // Set next arena match if current phase is pools phase
//     if(!isFinalPhase()) {
//         var poolId = arena.pools[arena.round];
//         var pool = tournament.pools[poolId];
//         if(arena.match + 1 >= pool.matches.length && arena.round + 1 >= arena.pools.length) {
//             console.log("Completed pool " + poolId + "!" );
//             console.log("Arena " + arenaId + " has no pools left!" );
//             completedPools++;
//             if(completedPools >= Object.keys(tournament.pools).length) {
//                 console.log("Pools phase ended!");
//                 isFinalPhaseStarted = true;
//                 currentRound = 0;
//                 arena.match = 0;
//                 arena.round = 0;
//             }
//             return false;
//         } else if(arena.match + 1 >= pool.matches.length && arena.round + 1 < arena.pools.length) {
//             completedPools++;
//             console.log("Completed pool " + poolId + "!" );
//             arena.round++;
//             arena.match = 0;
//         } else {
//             //arena.match+=27;
//             // TODO: modificare
//             arena.match++;
//
//             // Update pool
//             /*updatePool(poolId, poolsSpec.filter(poolSpec => {
//                 return poolSpec["id"] === poolId;
//             })[0]);*/
//         }
//         console.log("Next match in arena " + arenaId + ": Pool " + arena.pools[arena.round] + ", match " + arena.match);
//         return true;
//     }
//
//     // Set next arena match if current phase is final phase
//     if(isFinalPhase() && arenaId in tournament.finalPhase.arenas[currentRound]) {
//         var numRounds = tournament.finalPhase.rounds.length;
//         var numArenasPerRound = tournament.finalPhase.arenas[currentRound].length;
//         var matchesPerRound = Math.pow(2, numRounds-currentRound-1);
//         var matchesPerRoundPerArena = Math.pow(2, numRounds-currentRound-1)/numArenasPerRound;
//         if(arena.match + 1 < matchesPerRoundPerArena) {
//
//             // Update current match
//             arena.match++;
//
//             // Update next round info
//             if(currentRound < numRounds - 2) {
//                 updateRound(finalPhaseSpec.rounds[currentRound], finalPhaseSpec.sheet, currentRound, tournament.finalPhase.arenas[currentRound]).then((value) => {
//                     console.log("Updated info about round " + finalPhasesNames[currentRound]);
//                     //console.log(tournament.finalPhase.rounds[currentRound]);
//                 });
//                 updateRound(finalPhaseSpec.rounds[currentRound+1], finalPhaseSpec.sheet, currentRound+1, tournament.finalPhase.arenas[currentRound+1]).then((value) => {
//                     console.log("Updated info about round " + finalPhasesNames[currentRound+1]);
//                     //console.log(tournament.finalPhase.rounds[currentRound+1]);
//                 });
//             } else if (currentRound == numRounds - 2) {
//                 updateRound(finalPhaseSpec.rounds[currentRound], finalPhaseSpec.sheet, currentRound, tournament.finalPhase.arenas[currentRound]).then((value) => {
//                     console.log("Updated info about round " + finalPhasesNames[currentRound]);
//                     //console.log(tournament.finalPhase.rounds[currentRound]);
//                 });
//                 updateFinals(finalPhaseSpec.finals, finalPhaseSpec.sheet, tournament.finalPhase.arenas[numRounds-1]).then((value) => {
//                     console.log("Updated info about finals");
//                     //console.log(tournament.finalPhase.rounds[numRounds-1][0]);
//                 });
//                 updateSecondaryFinals(finalPhaseSpec.secondaryFinals, finalPhaseSpec.sheet, tournament.finalPhase.arenas[numRounds-1]).then((value) => {
//                     console.log("Updated info about secondary finals");
//                     //console.log(tournament.finalPhase.rounds[numRounds-1][1]);
//                 });
//             }
//         } else if(currentRound + 1 < numRounds) {
//             currentRound++;
//             arena.match = 0;
//         } else if(currentRound === numRounds-1 && arena.match === matchesPerRound-1) {
//             arena.match++;
//         } else {
//             return false;
//         }
//         console.log("Next match in arena " + arenaId + ": " + finalPhasesNames[currentRound] + ", match " + arena.match);
//         return true;
//     }
//     return false;
// }

function checkIncompleteRound(round) {
    tournament.finalPhase.rounds.forEach((round) => {
        round.forEach((match) => {
            if(!match.isComplete) return true;
        });
    });
    return false;
}

function checkIncompletePoolsTurn(turn) {
    Object.keys(tournament.pools).forEach((poolId) => {
        let pool = tournament.pools[poolId];
        if(pool.round === turn) {
            pool.matches.forEach((match) => {
                if(!match.isComplete) return true;
            });
        }
    });
    return false;
}


// Gets athletes information from the Google sheet and returns an array of Athlete objects
async function getAthletes(athletesSpec) {
    return new Promise(async (resolve, reject) => {
        try {

            // Fetch athletes data
            await jwt.authorize();
            const res = await getSpreadsheetInfo(source, athletesSpec);

            // Parse athletes data
            var athletes = {};
            res.data.valueRanges[0].values.forEach((athlete) => {
                var athleteName = athlete[0].trim();
                var athleteAcademy = athlete[1].trim();
                var athleteSchool = athlete[2].trim();
                var athleteForms = athlete[3].trim().split('');
                var athleteBattlename = athlete[4].trim();
                var athletePool = athlete[5].trim();
                athletes[athleteName] = new Athlete(athleteName, athleteAcademy, athleteSchool, athleteForms, athleteBattlename, athletePool);
            });

            // Return athletes
            resolve(athletes);
        } catch(err) {
            reject(err);
        }
    });
}

async function getPools(poolsSpec) {
    return new Promise(async (resolve, reject) => {
        try {

            // Compose pools ranges
            var ranges = [];
            poolsSpec.forEach((poolSpec) => {
                ranges.push(poolSpec["sheetRankRange"]);
                ranges.push(poolSpec["sheetNameCell"]);
            });

            // Fetch pools data
            await jwt.authorize();
            const result = await getSpreadsheetInfo(source, ranges);

            // Partition pools data by ids
            var poolsData = {};
            result.data.valueRanges.forEach((res) => {

                // Get pool id for the current result
                var poolSpec = poolsSpec.filter(poolSpec => {
                    return poolSpec["sheetRankRange"] === res.range || poolSpec["sheetNameCell"] === res.range;
                })[0];
                let poolId = poolSpec["id"];

                // Check if pool data has already been set, if not create it
                if(!(poolId in poolsData)) {
                    poolsData[poolId] = {
                        name : "",
                        spec : poolSpec,
                        data : []
                    };
                }

                // Set fetched data into pool
                if(res.range === poolSpec["sheetNameCell"]) {
                    poolsData[poolId].name = res.values[0][0];
                } else {
                    poolsData[poolId].data.push(res.values);
                }
            });

            // Process pools data
            var pools = {};
            for(let poolId in poolsData) {

                // Get static info about pool
                var id = poolId;
                var name = poolsData[poolId].name;
                var arena = poolsData[poolId].spec["arena"];
                var round = poolsData[poolId].spec["round"];

                // Get list of athletes
                var athletes = [];
                poolsData[poolId].data[0].forEach((athleteData) => {
                    let athleteName = athleteData[0].replace(/ \([^)]*\)/,'').trim();
                    if(athleteName !== withdrawnContender && !(athleteName in tournament.athletes)) {
                        console.log("Unknown athlete " + athleteName);
                    } else if(athleteName != withdrawnContender) {
                        athletes.push(athleteName);
                    }
                });

                // Get matches
                var matches = await getMatches(poolsData[poolId].spec["sheetMatchesRange"], new Set(athletes), arena);

                // Create pool
                var pool = new Pool(id, name, arena, round, athletes, matches);
                pools[id] = pool;
            }

            // Return pools
            resolve(pools);
        } catch(err) {
            reject(err);
        }
    });
}

async function updatePool(poolId, poolSpec) {
    return new Promise(async (resolve, reject) => {
        try {

            // Sanity check pool exists in tournament
            if(!(poolId in tournament.pools)) {
                reject();
                return;
            }
            var pool = tournament.pools[poolId];

            // Compose pools ranges
            var ranges = [];
            ranges.push(poolSpec["sheetRankRange"]);

            // Fetch pools data
            await jwt.authorize();
            const result = await getSpreadsheetInfo(source, ranges);

            // Get pool data
            if(!("valueRanges" in result.data)) {
                reject();
                return;
            }
            var poolData = result.data.valueRanges[0].values;

            // Update pool athletes info
            var athletes = pool.athletes;
            poolData.forEach((athleteData) => {
                var athleteName = athleteData[0].replace(/ \([^)]*\)/,'').trim();
                if(athleteName !== withdrawnContender && !athletes.includes(athleteName)) {
                    console.log("Unknown athlete " + athleteName);
                } else if(athleteName != withdrawnContender) {
                    var athlete = tournament.athletes[athleteName];
                    athlete.score = athleteData[1];
                    athlete.rank = athleteData[2];
                    athlete.style = athleteData[3];
                }
            });

            // Update pool matches
            var matches = await getMatches(poolSpec["sheetMatchesRange"], new Set(athletes), pool.arena);
            tournament.pools[poolId].matches = matches;

            // Resolve
            resolve();
        } catch(err) {
            reject(err);
        }
    });
}

async function getMatches(matchesSpec, athletes, arena) {
    return new Promise(async (resolve, reject) => {
        try {

            // Fetch matches data
            await jwt.authorize();
            const result = await getSpreadsheetInfo(source, matchesSpec);

            // Parse matches data
            var i = 0, j=0;
            var matches = [];
            var matchesData = result.data.valueRanges[0].values;
            while(i < matchesData.length) {

                // Get contenders info
                var firstContenderData, secondContenderData;
                while(i < matchesData.length) {
                    if(matchesData[i].length == 0) {
                        i++;
                        continue;
                    }
                    let athleteName = matchesData[i][0].replace(/ \([^)]*\)/,'').trim();
                    if(!(athletes.has(athleteName)) && athleteName !== withdrawnContender) {
                        i++;
                    } else {
                        firstContenderData = matchesData[i];
                        break;
                    }
                }
                i++;
                while(i < matchesData.length) {
                    if(matchesData[i].length == 0) {
                        i++;
                        continue;
                    }
                    let athleteName = matchesData[i][0].replace(/ \([^)]*\)/,'').trim();
                    if(!(athletes.has(athleteName)) && athleteName !== withdrawnContender) {
                        i++;
                    } else {
                        secondContenderData = matchesData[i];
                        break;
                    }
                }
                i++;

                // Determine if match is a bye
                var isBye = false;
                var firstContenderName = firstContenderData[0].replace(/ \([^)]*\)/,'').trim();
                var secondContenderName = secondContenderData[0].replace(/ \([^)]*\)/,'').trim();
                if(firstContenderName === withdrawnContender || secondContenderName === withdrawnContender) {
                    isBye = true;
                }

                // Determine if match is not complete yet
                var isComplete = true;
                if(firstContenderName === undefinedContender || secondContenderName === undefinedContender) {
                    isComplete = false;
                }

                // Create match
                var match = new Match(j++, isBye, isComplete, new MatchResult(
                        firstContenderName,
                        parseInt(firstContenderData[1]) || 0,
                        parseFloat(firstContenderData[2]) || 0.0,
                        [parseFloat(firstContenderData[2]) || 0.0],
                    ), new MatchResult(
                        secondContenderName,
                        parseInt(secondContenderData[1]) || 0,
                        parseFloat(secondContenderData[2]) || 0.0,
                        [parseFloat(secondContenderData[2]) || 0.0]
                    ),
                    timesSecSpec.pools,
                    assaultsSpec.pools.assaults,
                    assaultsSpec.pools.strategy,
                    assaultsSpec.pools.doppioVoid,
                    0,
                    arena
                );

                // Add match to collection
                matches.push(match);
            }

            // Return matches
            resolve(matches);
        } catch(err) {
            reject(err);
        }
    });
}

async function getFinalPhaseRounds(finalPhaseSpec, numRounds, arenas) {
    return new Promise(async (resolve, reject) => {
        try {

            // Get final phase arenas
            let finalPhaseArenas = [];
            Object.keys(arenas).forEach((arenaId) => {
                var arena = arenas[arenaId];
                if(arena.isUsedInFinalPhase) {
                    arena.rounds.forEach((round) => {
                        if(!(round in finalPhaseArenas)) {
                            finalPhaseArenas[round] = [];
                        }
                        finalPhaseArenas[round].push(arena.id)
                    });
                }
            });

            // Get final phase rounds
            var finalPhase = [];
            for(let i=0; i<numRounds-1; i++) {
                var round = await getRound(finalPhaseSpec["rounds"][i], finalPhaseSpec["sheet"], i, finalPhaseArenas[i]);
                finalPhase.push(round);
            }

            // Get finals and secondary finals
            var finals = await getFinals(finalPhaseSpec["finals"], finalPhaseSpec["sheet"], finalPhaseArenas[numRounds-1][0]);
            var secondaryFinals = await getSecondaryFinals(finalPhaseSpec["secondaryFinals"], finalPhaseSpec["sheet"], finalPhaseArenas[numRounds-1][0]);
            finalPhase.push([secondaryFinals, finals]);

            // Return final phase data
            resolve({
                arenas : finalPhaseArenas,
                rounds : finalPhase
            });

        } catch(err) {
            reject(err);
        }
    });
}

async function getFinals(finalsSpec, sheet, arena) {
    return new Promise(async (resolve, reject) => {

        // Sanity check on finals specs
        if(!finalsSpec.contenders || finalsSpec.contenders.length < 2) {
            reject(err);
            return;
        }

        // Compose finals ranges
        var finalsRanges = [];
        var firstFinalistSpec= finalsSpec.contenders[0];
        var secondFinalistSpec = finalsSpec.contenders[1];
        finalsRanges.push(sheet + "!" + firstFinalistSpec["name"]);
        finalsRanges.push(sheet + "!" + firstFinalistSpec["score"]);
        finalsRanges.push(sheet + "!" + firstFinalistSpec["style"]);
        finalsRanges.push(sheet + "!" + secondFinalistSpec["name"]);
        finalsRanges.push(sheet + "!" + secondFinalistSpec["score"]);
        finalsRanges.push(sheet + "!" + secondFinalistSpec["style"]);

        // Fetch finals info
        try {

            // Ask and wait for data from google sheet API
            await jwt.authorize();
            const res = await getSpreadsheetInfo(source, finalsRanges);

            // Parse first finalist data
            var name = '', forms = [], score = 0, style = 0, regexRes = null;
            name = res.data.valueRanges[0].values[0][0];
            regexRes = name.match(/([^(]*) \((.*)\)/);
            if(regexRes && regexRes.length > 2) {
                name = regexRes[1].trim();
                forms = regexRes[2].split('');
            }
            if(res.data.valueRanges[1].values) score = res.data.valueRanges[1].values[0][0];
            if(res.data.valueRanges[2].values) style = res.data.valueRanges[2].values[0][0];
            var firstFinalistResults = new MatchResult(name, parseInt(score), parseFloat(style), []);

            // Parse second finalist data
            name = '', forms = [], score = 0, style = 0, regexRes = null;
            name = res.data.valueRanges[3].values[0][0];
            regexRes = name.match(/([^(]*) \((.*)\)/);
            if(regexRes && regexRes.length > 2) {
                name = regexRes[1].trim();
                forms = regexRes[2].split('');
            }
            if(res.data.valueRanges[4].values) score = res.data.valueRanges[4].values[0][0];
            if(res.data.valueRanges[5].values) style = res.data.valueRanges[5].values[0][0];
            var secondFinalistResults = new MatchResult(name, parseInt(score), parseFloat(style), []);

            // Determine if match is a bye
            var isBye = false;
            if(firstFinalistResults.contender === withdrawnContender || secondFinalistResults.contender === withdrawnContender) {
                isBye = true;
            }

            // Determine if match is not complete yet
            var isComplete = true;
            if(firstFinalistResults.contender === undefinedContender || secondFinalistResults.contender === undefinedContender) {
                isComplete = false;
            }

            // Create finals match
            var final = new Match(
                1,
                isBye,
                isComplete,
                firstFinalistResults,
                secondFinalistResults,
                timesSecSpec.finals,
                assaultsSpec.finals.assaults,
                assaultsSpec.finals.strategy,
                assaultsSpec.finals.doppioVoid,
                0,
                arena
            );

            // Return finals match
            resolve(final);

        } catch(err) {
            reject(err);
        }
    });
}

async function updateFinals(finalsSpec, sheet, arena) {
    return new Promise(async (resolve, reject) => {

        // Sanity check on finals specs
        var index = tournament.finalPhase.rounds.length-1;
        if(!finalsSpec.contenders || finalsSpec.contenders.length < 2) {
            reject(err);
            return;
        }

        // Compose finals ranges
        var finalsRanges = [];
        var firstFinalistSpec= finalsSpec.contenders[0];
        var secondFinalistSpec = finalsSpec.contenders[1];
        finalsRanges.push(sheet + "!" + firstFinalistSpec["name"]);
        finalsRanges.push(sheet + "!" + firstFinalistSpec["score"]);
        finalsRanges.push(sheet + "!" + firstFinalistSpec["style"]);
        finalsRanges.push(sheet + "!" + secondFinalistSpec["name"]);
        finalsRanges.push(sheet + "!" + secondFinalistSpec["score"]);
        finalsRanges.push(sheet + "!" + secondFinalistSpec["style"]);

        // Fetch finals info
        try {

            // Ask and wait for data from google sheet API
            await jwt.authorize();
            const res = await getSpreadsheetInfo(source, finalsRanges);

            // Parse first finalist data
            var name = '', forms = [], score = 0, style = 0, regexRes = null;
            name = res.data.valueRanges[0].values[0][0];
            regexRes = name.match(/([^(]*) \((.*)\)/);
            if(regexRes && regexRes.length > 2) {
                name = regexRes[1];
                forms = regexRes[2].split('');
            }
            if(res.data.valueRanges[1].values) score = res.data.valueRanges[1].values[0][0];
            if(res.data.valueRanges[2].values) style = res.data.valueRanges[2].values[0][0];
            var firstFinalistResults = new MatchResult(name, parseInt(score), parseFloat(style), []);

            // Parse second finalist data
            name = '', forms = [], score = 0, style = 0, regexRes = null;
            name = res.data.valueRanges[3].values[0][0];
            regexRes = name.match(/([^(]*) \((.*)\)/);
            if(regexRes && regexRes.length > 2) {
                name = regexRes[1];
                forms = regexRes[2].split('');
            }
            if(res.data.valueRanges[4].values) score = res.data.valueRanges[4].values[0][0];
            if(res.data.valueRanges[5].values) style = res.data.valueRanges[5].values[0][0];
            var secondFinalistResults = new MatchResult(name, parseInt(score), parseFloat(style), []);

            // Determine if match is a bye
            var isBye = false;
            if(firstFinalistResults.contender === withdrawnContender || secondFinalistResults.contender === withdrawnContender) {
                isBye = true;
            }

            // Determine if match is not complete yet
            var isComplete = true;
            if(firstFinalistResults.contender === undefinedContender || secondFinalistResults.contender === undefinedContender) {
                isComplete = false;
            }

            // Create finals match
            var final = new Match(
                1,
                isBye,
                isComplete,
                firstFinalistResults,
                secondFinalistResults,
                timesSecSpec.finals,
                assaultsSpec.finals.assaults,
                assaultsSpec.finals.strategy,
                assaultsSpec.finals.doppioVoid,
                0,
                arena
            );

            // Update finals match
            var round = tournament.finalPhase.rounds[index];
            round[0] = final;
            resolve();

        } catch(err) {
            reject(err);
        }
    });
}

async function getSecondaryFinals(secondaryFinalsSpec, sheet, arena) {
    return new Promise(async (resolve, reject) => {

        // Sanity check on secondary finals specs
        if(!secondaryFinalsSpec.contenders || secondaryFinalsSpec.contenders.length < 2) {
            reject(err);
            return;
        }

        // Compose secondary finals ranges
        var secondaryFinalsRanges = [];
        var firstSecondaryFinalistSpec= secondaryFinalsSpec.contenders[0];
        var secondSecondaryFinalistSpec = secondaryFinalsSpec.contenders[1];
        secondaryFinalsRanges.push(sheet + "!" + firstSecondaryFinalistSpec["name"]);
        secondaryFinalsRanges.push(sheet + "!" + firstSecondaryFinalistSpec["score"]);
        secondaryFinalsRanges.push(sheet + "!" + firstSecondaryFinalistSpec["style"]);
        secondaryFinalsRanges.push(sheet + "!" + secondSecondaryFinalistSpec["name"]);
        secondaryFinalsRanges.push(sheet + "!" + secondSecondaryFinalistSpec["score"]);
        secondaryFinalsRanges.push(sheet + "!" + secondSecondaryFinalistSpec["style"]);

        // Fetch secondary finals info
        try {

            // Ask and wait for data from google sheet API
            await jwt.authorize();
            const res = await getSpreadsheetInfo(source, secondaryFinalsRanges);

            // Parse first secondary finalist data
            var name = '', forms = [], score = '', style = '', regexRes = null;
            name = res.data.valueRanges[0].values[0][0];
            regexRes = name.match(/([^(]*) \((.*)\)/);
            if(regexRes && regexRes.length > 2) {
                name = regexRes[1].trim();
                forms = regexRes[2].split('');
            }
            if(res.data.valueRanges[1].values) score = res.data.valueRanges[1].values[0][0];
            if(res.data.valueRanges[2].values) style = res.data.valueRanges[2].values[0][0];
            var firstSecondaryFinalistResults = new MatchResult(name, parseInt(score), parseFloat(style), []);

            // Parse second secondary finalist data
            name = '', forms = [], score = 0, style = 0, regexRes = null;
            name = res.data.valueRanges[3].values[0][0];
            regexRes = name.match(/([^(]*) \((.*)\)/);
            if(regexRes && regexRes.length > 2) {
                name = regexRes[1].trim();
                forms = regexRes[2].split('');
            }
            if(res.data.valueRanges[4].values) score = res.data.valueRanges[4].values[0][0];
            if(res.data.valueRanges[5].values) style = res.data.valueRanges[5].values[0][0];
            var secondSecondaryFinalistResults = new MatchResult(name, parseInt(score), parseFloat(style), []);

            // Determine if match is a bye
            var isBye = false;
            if(firstSecondaryFinalistResults.contender === withdrawnContender || secondSecondaryFinalistResults.contender === withdrawnContender) {
                isBye = true;
            }

            // Determine if match is not complete yet
            var isComplete = true;
            if(firstSecondaryFinalistResults.contender === undefinedContender || secondSecondaryFinalistResults.contender === undefinedContender) {
                isComplete = false;
            }

            // Create secondary finals match
            var secondaryFinal = new Match(
                0,
                isBye,
                isComplete,
                firstSecondaryFinalistResults,
                secondSecondaryFinalistResults,
                timesSecSpec.finalPhase,
                assaultsSpec.finalPhase.assaults,
                assaultsSpec.finalPhase.strategy,
                assaultsSpec.finalPhase.doppioVoid,
                0,
                arena
            );

            // Return secondary finals match
            resolve(secondaryFinal);

        } catch(err) {
            reject(err);
        }
    });
}

async function updateSecondaryFinals(secondaryFinalsSpec, sheet, arena) {
    return new Promise(async (resolve, reject) => {

        // Sanity check on secondary finals specs
        var index = tournament.finalPhase.rounds.length-1;
        if(!secondaryFinalsSpec.contenders || secondaryFinalsSpec.contenders.length < 2) {
            reject(err);
            return;
        }

        // Compose secondary finals ranges
        var secondaryFinalsRanges = [];
        var firstSecondaryFinalistSpec= secondaryFinalsSpec.contenders[0];
        var secondSecondaryFinalistSpec = secondaryFinalsSpec.contenders[1];
        secondaryFinalsRanges.push(sheet + "!" + firstSecondaryFinalistSpec["name"]);
        secondaryFinalsRanges.push(sheet + "!" + firstSecondaryFinalistSpec["score"]);
        secondaryFinalsRanges.push(sheet + "!" + firstSecondaryFinalistSpec["style"]);
        secondaryFinalsRanges.push(sheet + "!" + secondSecondaryFinalistSpec["name"]);
        secondaryFinalsRanges.push(sheet + "!" + secondSecondaryFinalistSpec["score"]);
        secondaryFinalsRanges.push(sheet + "!" + secondSecondaryFinalistSpec["style"]);

        // Fetch secondary finals info
        try {

            // Ask and wait for data from google sheet API
            await jwt.authorize();
            const res = await getSpreadsheetInfo(source, secondaryFinalsRanges);

            // Parse first secondary finalist data
            var name = '', forms = [], score = '', style = '', regexRes = null;
            name = res.data.valueRanges[0].values[0][0];
            regexRes = name.match(/([^(]*) \((.*)\)/);
            if(regexRes && regexRes.length > 2) {
                name = regexRes[1];
                forms = regexRes[2].split('');
            }
            if(res.data.valueRanges[1].values) score = res.data.valueRanges[1].values[0][0];
            if(res.data.valueRanges[2].values) style = res.data.valueRanges[2].values[0][0];
            var firstSecondaryFinalistResults = new MatchResult(name, parseInt(score), parseFloat(style), []);

            // Parse second secondary finalist data
            name = '', forms = [], score = 0, style = 0, regexRes = null;
            name = res.data.valueRanges[3].values[0][0];
            regexRes = name.match(/([^(]*) \((.*)\)/);
            if(regexRes && regexRes.length > 2) {
                name = regexRes[1];
                forms = regexRes[2].split('');
            }
            if(res.data.valueRanges[4].values) score = res.data.valueRanges[4].values[0][0];
            if(res.data.valueRanges[5].values) style = res.data.valueRanges[5].values[0][0];
            var secondSecondaryFinalistResults = new MatchResult(name, parseInt(score), parseFloat(style), []);

            // Determine if match is a bye
            var isBye = false;
            if(firstSecondaryFinalistResults.contender === withdrawnContender || secondSecondaryFinalistResults.contender === withdrawnContender) {
                isBye = true;
            }

            // Determine if match is not complete yet
            var isComplete = true;
            if(firstSecondaryFinalistResults.contender === undefinedContender || secondSecondaryFinalistResults.contender === undefinedContender) {
                isComplete = false;
            }

            // Create secondary finals match
            var secondaryFinal = new Match(
                0,
                isBye,
                isComplete,
                firstSecondaryFinalistResults,
                secondSecondaryFinalistResults,
                timesSecSpec.finalPhase,
                assaultsSpec.finalPhase.assaults,
                assaultsSpec.finalPhase.strategy,
                assaultsSpec.finalPhase.doppioVoid,
                0,
                arena
            );

            // Update secondary finals match
            var round = tournament.finalPhase.rounds[index];
            round[1] = secondaryFinal;
            resolve();

        } catch(err) {
            reject(err);
        }
    });
}

async function getRound(roundSpec, sheet, index, arenas) {
    return new Promise(async (resolve, reject) => {

        // Get round specification data
        var roundMatches = [];
        var start = roundSpec["startRow"];
        var blocks = roundSpec["layout"];
        var unit = roundSpec["athleteSize"];
        var nameCol = roundSpec["nameCol"] || false;
        var seedCol = roundSpec["seedCol"] || false;
        var scoreCol = roundSpec["scoreCol"] || false;
        var styleCol = roundSpec["styleCol"] || false;

        // Make sure at least seed and names specs are available for the first round
        if(index == 0) {
            if(!nameCol || !seedCol) {
                console.log("Both seed and name cells should be given for the first round!");
                reject();
                return;
            }
        }

        // Enumerate round rows
        var roundRows = [];
        function enumerateRoundRows(level, row, blocks, unit) {
            var block = blocks[level];
            var n = blocks.length-1;
            var offset = 0;
            if(level == blocks.length-1) {
                for(let i=0; i<block["blocks"]; i++) {
                    roundRows.push(row + (block["spacing"]+unit)*i);
                }
                return unit*block["blocks"] + block["spacing"] * (block["blocks"]-1);
            }
            for(let j=0; j<block["blocks"]; j++) {
                let size = enumerateRoundRows(level+1, row + offset, blocks, unit);
                offset += size + block["spacing"];
            }
            return offset - block["spacing"];
        }
        enumerateRoundRows(0, start, blocks, unit);

        // Setup ranges map (used to map which kind of info we were requesting for each range included in the query)
        var rangesMap = {};
        var i = 0, n=0;
        if(nameCol) rangesMap[nameCol] = i++;
        if(seedCol) rangesMap[seedCol] = i++;
        if(scoreCol) rangesMap[scoreCol] = i++;
        if(styleCol) rangesMap[styleCol] = i++;
        n = i;

        // Compose ranges for the whole round
        var ranges = [];
        roundRows.forEach((row) => {

            // Compose ranges for the current athlete
            if(nameCol) ranges.push(sheet + "!" + nameCol + row);
            if(seedCol) ranges.push(sheet + "!" + seedCol + row);
            if(scoreCol) ranges.push(sheet + "!" + scoreCol + row);
            if(styleCol) ranges.push(sheet + "!" + styleCol + row);
        });

        // Fetch data for the whole round
        try {

            // Ask and wait for data from google sheet API
            await jwt.authorize();
            const res = await getSpreadsheetInfo(source, ranges);

            // Parse results
            var last = null;
            var isOdd = true;
            var arenaIndex = 0;
            var nMatches = 0;
            for(let j=0; j<roundRows.length; j++) {

                // Update arena
                if(isOdd && arenaIndex < arenas.length - 1 && nMatches >= Math.pow(2, numRounds-index-1)/arenas.length) {
                    arenaIndex++;
                }

                // Parse a single athlete information
                var name = '', forms = [], seed = '', score = 0, style = 0, regexRes = null;
                if(nameCol) {
                    let nameFormsRanges = res.data.valueRanges[j*n + rangesMap[nameCol]].values;
                    if(nameFormsRanges === undefined) {
                        if(isOdd) name = withdrawnContender;
                        else if(last.name === withdrawnContender) {
                            name = undefinedContender;
                            last.name = undefinedContender;
                        } else {
                            name = withdrawnContender;
                        }
                    } else if(nameFormsRanges.length > 0 && nameFormsRanges[0].length > 0) {
                        name = nameFormsRanges[0][0];
                        regexRes = name.match(/([^(]*) \((.*)\)/);
                        if(regexRes && regexRes.length > 2) {
                            name = regexRes[1].trim();
                            forms = regexRes[2].trim().split('');
                        }
                    }
                }
                if(seedCol) {
                    let seedRanges = res.data.valueRanges[j*n + rangesMap[seedCol]].values;
                    if(seedRanges && seedRanges.length > 0 && seedRanges[0].length > 0) {
                        seed = seedRanges[0][0];
                    }
                }
                if(scoreCol) {
                    let scoreRanges = res.data.valueRanges[j*n + rangesMap[scoreCol]].values;
                    if(scoreRanges && scoreRanges.length > 0 && scoreRanges[0].length > 0) {
                        score = scoreRanges[0][0];
                        score = score;
                    }
                }
                if(styleCol) {
                    let styleRanges = res.data.valueRanges[j*n + rangesMap[styleCol]].values;
                    if(styleRanges && styleRanges.length > 0 && styleRanges[0].length > 0) {
                        style = styleRanges[0][0];
                        style = style.replace(',', '.');
                    }
                }

                // Compose athlete
                var athlete = {name, forms, seed, score, style}

                // Update athletes seeds
                if(index == 0) {
                    if(name !=='' && name !== undefinedContender && name !== withdrawnContender && name !== tiedContender && seed !== '') {
                        tournament.athletes[name].seed = seed;
                    }
                }

                // Add match
                if(!isOdd) {

                    // Determine if match is bye
                    var isBye = false;
                    if(last.name === withdrawnContender || athlete.name === withdrawnContender) {
                        isBye = true;
                    }

                    // Determine if match is not complete yet
                    var isComplete = true;
                    if(last.name === undefinedContender || athlete.name === undefinedContender) {
                        isComplete = false;
                    }

                    // Create match
                    var firstContender = new MatchResult(last.name, parseInt(last.score), parseFloat(last.style), []);
                    var secondContender = new MatchResult(athlete.name, parseInt(athlete.score), parseFloat(athlete.style), []);
                    roundMatches.push(new Match(
                        nMatches++,
                        isBye,
                        isComplete,
                        firstContender,
                        secondContender,
                        timesSecSpec.finalPhase,
                        assaultsSpec.finalPhase.assaults,
                        assaultsSpec.finalPhase.strategy,
                        assaultsSpec.finalPhase.doppioVoid,
                        0,
                        arenas[arenaIndex]
                    ));
                }

                // Update variables to process alternating rows
                isOdd = !isOdd;
                last = athlete;
            }
        } catch(err) {
            reject(err);
        }

        // Resolve promise
        resolve(roundMatches);
    });
}

async function updateRound(roundSpec, sheet, index, arenas) {
    return new Promise(async (resolve, reject) => {

        // Sanity check round index exists in tournament
        if(!(index in tournament.finalPhase.rounds)) {
            reject();
            return;
        }

        // Get round specification data
        var roundMatches = [];
        var start = roundSpec["startRow"];
        var blocks = roundSpec["layout"];
        var unit = roundSpec["athleteSize"];
        var nameCol = roundSpec["nameCol"] || false;
        var seedCol = roundSpec["seedCol"] || false;
        var scoreCol = roundSpec["scoreCol"] || false;
        var styleCol = roundSpec["styleCol"] || false;

        // Make sure at least seed and names specs are available for the first round
        if(index == 0) {
            if(!nameCol || !seedCol) {
                console.log("Both seed and name cells should be given for the first round!");
                reject();
                return;
            }
        }

        // Enumerate round rows
        var roundRows = [];
        function enumerateRoundRows(level, row, blocks, unit) {
            var block = blocks[level];
            var n = blocks.length-1;
            var offset = 0;
            if(level == blocks.length-1) {
                for(let i=0; i<block["blocks"]; i++) {
                    roundRows.push(row + (block["spacing"]+unit)*i);
                }
                return unit*block["blocks"] + block["spacing"] * (block["blocks"]-1);
            }
            for(let j=0; j<block["blocks"]; j++) {
                let size = enumerateRoundRows(level+1, row + offset, blocks, unit);
                offset += size + block["spacing"];
            }
            return offset - block["spacing"];
        }
        enumerateRoundRows(0, start, blocks, unit);

        // Setup ranges map (used to map which kind of info we were requesting for each range included in the query)
        var rangesMap = {};
        var i = 0, n=0;
        if(nameCol) rangesMap[nameCol] = i++;
        if(seedCol) rangesMap[seedCol] = i++;
        if(scoreCol) rangesMap[scoreCol] = i++;
        if(styleCol) rangesMap[styleCol] = i++;
        n = i;

        // Compose ranges for the whole round
        var ranges = [];
        roundRows.forEach((row) => {

            // Compose ranges for the current athlete
            if(nameCol) ranges.push(sheet + "!" + nameCol + row);
            if(seedCol) ranges.push(sheet + "!" + seedCol + row);
            if(scoreCol) ranges.push(sheet + "!" + scoreCol + row);
            if(styleCol) ranges.push(sheet + "!" + styleCol + row);
        });

        // Fetch data for the whole round
        try {

            // Ask and wait for data from google sheet API
            await jwt.authorize();
            const res = await getSpreadsheetInfo(source, ranges);

            // Parse results
            var last = null;
            var isOdd = true;
            var arenaIndex = 0;
            var nMatches = 0;
            for(let j=0; j<roundRows.length; j++) {

                // Update arena
                if(isOdd && arenaIndex < arenas.length - 1 && nMatches >= Math.pow(2, numRounds-index-1)/arenas.length) {
                    arenaIndex++;
                }

                // Parse a single athlete information
                var name = '', forms = [], seed = '', score = 0, style = 0, regexRes = null;
                if(nameCol) {
                    let nameFormsRanges = res.data.valueRanges[j*n + rangesMap[nameCol]].values;
                    if(nameFormsRanges === undefined) {
                        if(isOdd) name = withdrawnContender;
                        else if(last.name === withdrawnContender) {
                            name = undefinedContender;
                            last.name = undefinedContender;
                        } else {
                            name = withdrawnContender;
                        }
                    } else if(nameFormsRanges.length > 0 && nameFormsRanges[0].length > 0) {
                        name = nameFormsRanges[0][0];
                        regexRes = name.match(/([^(]*) \((.*)\)/);
                        if(regexRes && regexRes.length > 2) {
                            name = regexRes[1];
                            forms = regexRes[2].split('');
                        }
                    }
                }
                if(seedCol) {
                    let seedRanges = res.data.valueRanges[j*n + rangesMap[seedCol]].values;
                    if(seedRanges && seedRanges.length > 0 && seedRanges[0].length > 0) {
                        seed = seedRanges[0][0];
                    }
                }
                if(scoreCol) {
                    let scoreRanges = res.data.valueRanges[j*n + rangesMap[scoreCol]].values;
                    if(scoreRanges && scoreRanges.length > 0 && scoreRanges[0].length > 0) {
                        score = scoreRanges[0][0];
                        score = score;
                    }
                }
                if(styleCol) {
                    let styleRanges = res.data.valueRanges[j*n + rangesMap[styleCol]].values;
                    if(styleRanges && styleRanges.length > 0 && styleRanges[0].length > 0) {
                        style = styleRanges[0][0];
                        style = style.replace(',', '.');
                    }
                }

                // Compose athlete
                var athlete = {name, forms, seed, score, style}

                // Update athletes seeds
                if(index == 0) {
                    if(name !=='' && name !== undefinedContender && name !== withdrawnContender && name !== tiedContender && seed !== '') {
                        tournament.athletes[name].seed = seed;
                    }
                }

                // Add match
                if(!isOdd) {

                    // Determine if match is bye
                    var isBye = false;
                    if(last.name === withdrawnContender || athlete.name === withdrawnContender) {
                        isBye = true;
                    }

                    // Determine if match is not complete yet
                    var isComplete = true;
                    if(last.name === undefinedContender || athlete.name === undefinedContender) {
                        isComplete = false;
                    }

                    // Create match
                    var firstContender = new MatchResult(last.name, parseInt(last.score), parseFloat(last.style), []);
                    var secondContender = new MatchResult(athlete.name, parseInt(athlete.score), parseFloat(athlete.style), []);
                    roundMatches.push(new Match(
                        nMatches++,
                        isBye,
                        isComplete,
                        firstContender,
                        secondContender,
                        timesSecSpec.finalPhase,
                        assaultsSpec.finalPhase.assaults,
                        assaultsSpec.finalPhase.strategy,
                        assaultsSpec.finalPhase.doppioVoid,
                        0,
                        arenas[arenaIndex]
                    ));
                }

                // Update variables to process alternating rows
                isOdd = !isOdd;
                last = athlete;
            }
        } catch(err) {
            reject(err);
        }

        // Update round matches
        tournament.finalPhase.rounds[index] = roundMatches;
        resolve();
    });
}

async function serializeTournamentState(filename) {
    return new Promise(async (resolve, reject) => {
        var tournamentString = JSON.stringify(tournament, undefined, 4);
        fs.writeFile(filename, tournamentString, function(err) {
            if(err) {
                console.log(err);
                reject(err);
                return;
            }
            console.log("Tournament state persisted to " + filename);
            resolve();
        });
    });
}

async function deserializeTournamentState(filename) {
    return new Promise(async (resolve, reject) => {
        fs.readFile(filename, (err, data) => {
            if (err) {
                console.log(err);
                reject(err);
                return;
            }

            // Parse serialized data
            var deserializedTournament = JSON.parse(data);

            // Deserialize state and phase
            var state = deserializedTournament["state"];
            var phase = deserializedTournament["phase"];
            var round = deserializedTournament["round"];

            // Deserialize athletes
            var athletesMap = {};
            for(athlete in deserializedTournament["athletes"]) {
                var {name, academy, school, battlename, pool, war, score, style, rank, forms, seed} = deserializedTournament["athletes"][athlete];
                athletesMap[athlete] = new Athlete(name, academy, school, forms, battlename, pool, war, score, style, rank, seed);
            }

            // Deserialize pools
            var poolsMap = {};
            for(pool in deserializedTournament["pools"]) {

                // Deserialize pool matches
                var matches = [];
                var deserializedPool = deserializedTournament["pools"][pool];
                for(match in deserializedPool["matches"]) {

                    // Deserialize pool match results
                    var deserializedPoolMatch = deserializedPool["matches"][match];
                    var {contender, score, style, stylePartials} = deserializedPoolMatch["firstContender"];
                    var firstContender = new MatchResult(contender, score, style, stylePartials);
                    var {contender, score, style, stylePartials} = deserializedPoolMatch["secondContender"];
                    var secondContender = new MatchResult(contender, score, style, stylePartials);

                    // Deserialize pool match
                    var {id, isBye, isComplete, time, assaults, strategy, doppioVoid, consumed, arena} = deserializedPoolMatch;
                    matches.push(new Match(id, isBye, isComplete, firstContender, secondContender, time, assaults, strategy, doppioVoid, consumed, arena));
                }

                // Deserialize pool
                var {id, name, arena, round, athletes} = deserializedPool;
                poolsMap[pool] = new Pool(id, name, arena, round, athletes, matches);
            }

            // Deserialize final phase
            var finalPhaseRounds = [];
            for(round in deserializedTournament["finalPhase"]["rounds"]){

                // Deserialize final phase round
                var roundMatches = [];
                var deserializedFinalPhaseRound = deserializedTournament["finalPhase"]["rounds"][round];
                for(match in deserializedFinalPhaseRound) {

                    // Deserialize final phase round match results
                    var deserializedFinalPhaseRoundMatch = deserializedFinalPhaseRound[match];
                    var {contender, score, style, stylePartials} = deserializedFinalPhaseRoundMatch["firstContender"];
                    var firstContender = new MatchResult(contender, score, style, stylePartials);
                    var {contender, score, style, stylePartials} = deserializedFinalPhaseRoundMatch["secondContender"];
                    var secondContender = new MatchResult(contender, score, style, stylePartials);

                    // Deserialize final phase round match
                    var {id, isBye, isComplete, time, assaults, strategy, doppioVoid, consumed, arena} = deserializedFinalPhaseRoundMatch;
                    roundMatches.push(new Match(id, isBye, isComplete, firstContender, secondContender, time, assaults, strategy, doppioVoid, consumed, arena));
                }
                finalPhaseRounds.push(roundMatches);
            }
            var finalPhase = {
                arenas : deserializedTournament["finalPhase"]["arenas"],
                rounds : finalPhaseRounds
            };

            // Deserialize arenas
            var arenas = {};
            for(arena in deserializedTournament["arenas"]){
                var deserializedArena = deserializedTournament["arenas"][arena];
                var {id, isStreamed, isUsedInPools, isUsedInFinalPhase, usedUpToRound, pools, rounds, round, match} = deserializedArena;
                arenas[id] = new Arena(id, isStreamed, isUsedInPools, isUsedInFinalPhase, usedUpToRound, pools, rounds, round, match);
            }

            // Deserialize tournament
            var arenas = deserializedTournament["arenas"];
            tournament = {
                arenas : arenas,
                athletes : athletesMap,
                pools : poolsMap,
                finalPhase : finalPhase
            };

            updateTournamentState(state);
            updateTournamentPhase(phase);
            updateTournamentRound(round);

            console.log("Tournament state restored from " + filename);
            resolve();
        });
    });
}

/************************************************************************************************************************************
                                                        SERVE AJAX REQUESTS
************************************************************************************************************************************/

// Updates the current fight results on the overlay page
function updateOverlayFightStatus() {
  if(overlayConnection) {
    overlayConnection.send(JSON.stringify({
      "message" : "update",
      "data" : {
        "scores" : scores,
        "assaults" : assaults,
        "time" : time
      }
    }));
  }
}

// Stops the current fight timer on the overlay page
function stopOverlayFightTimer() {
  if(overlayConnection) {
    overlayConnection.send(JSON.stringify({
      "message" : "pause"
    }));
  }
}

// Serve a fight frame overlay show request
app.post('/showFightOverlay', jsonparser, (request, response) => {
    // Get reference arena
    var arena = request.body["arena"];

    // Get use animation flag
    var useAnimation = request.body["useAnimation"];

    // If no overlay page is connected for the arena do nothing
    if(!(arena in fightOverlayConnections)) {
        console.log("No connection currently established to overlay.")
        response.sendStatus(404);
    }

    // Send show overlay message
    fightOverlayConnections[arena].send(JSON.stringify({
        "message" : "showOverlay",
        "data" : {
            "useAnimation" : useAnimation
        }
    }));
    response.sendStatus(200);
});

// Serve a fight frame overlay hide request
app.post('/hideFightOverlay', jsonparser, (request, response) => {

    // Get reference arena
    var arena = request.body["arena"];

    // Get use animation flag
    var useAnimation = request.body["useAnimation"];

    // If no overlay page is connected for the arena do nothing
    if(!(arena in fightOverlayConnections)) {
        console.log("No connection currently established to overlay.")
        response.sendStatus(404);
    }

    // Send show overlay message
    fightOverlayConnections[arena].send(JSON.stringify({
        "message" : "hideOverlay",
        "data" : {
            "useAnimation" : useAnimation
        }
    }));
    response.sendStatus(200);
});

// Serves a results clear request from the controller: clear the current fight result status and update the overlay
app.post('/clear', urlencodedparser, (request, response) => {

  // Clear current fight status
  scores["left"] = 0;
  scores["right"] = 0;
  assaults = 0;
  time = 0;

  // Stop overlay fight timer
  stopOverlayFightTimer();

  // Update overlay fight status
  updateOverlayFightStatus();

  // Return a positive response to the controller
  response.sendStatus(200);
});

// Update fight overlay timer
app.post('/updateFightTimer', jsonparser, (request, response) => {

    // Get reference arena 
    var arena = request.body["arena"];
    var timer = request.body["timer"];
    console.log(timer);

    // Check arena fight overlay connection
    if(!(arena in fightOverlayConnections)) {
        console.log("Fight overlay page for arena " + arena + " is offline!");
        response.sendStatus(400);
        return;
    }

    // Send update fight timer message to the fight overlay page
    fightOverlayConnections[arena].send(JSON.stringify({
        "message" : "updateFightTimer",
        "data" : {
            "timer" : timer
        }
    }));
    response.sendStatus(200);
});

// Start fight overlay timer
app.post('/startFightTimer', jsonparser, (request, response) => {

    // Get reference arena
    var arena = request.body["arena"];

    // Check arena fight overlay connection
    if(!(arena in fightOverlayConnections)) {
        console.log("Fight overlay page for arena " + arena + " is offline!");
        response.sendStatus(400);
        return;
    }

    // Send start fight timer message to the fight overlay page
    fightOverlayConnections[arena].send(JSON.stringify({
        "message" : "startFightTimer"
    }));
    response.sendStatus(200);
});

// Pause fight overlay timer
app.post('/pauseFightTimer', jsonparser, (request, response) => {

    // Get reference arena
    var arena = request.body["arena"];

    // Check arena fight overlay connection
    if(!(arena in fightOverlayConnections)) {
        console.log("Fight overlay page for arena " + arena + " is offline!");
        response.sendStatus(400);
        return;
    }

    // Send start fight timer message to the fight overlay page
    fightOverlayConnections[arena].send(JSON.stringify({
        "message" : "pauseFightTimer"
    }));
    response.sendStatus(200);
});

// Clear fight overlay timer
app.post('/clearFightTimer', jsonparser, (request, response) => {

    // Get reference arena
    var arena = request.body["arena"];

    // Check arena fight overlay connection
    if(!(arena in fightOverlayConnections)) {
        console.log("Fight overlay page for arena " + arena + " is offline!");
        response.sendStatus(400);
        return;
    }

    // Send start fight timer message to the fight overlay page
    fightOverlayConnections[arena].send(JSON.stringify({
        "message" : "clearFightTimer"
    }));
    response.sendStatus(200);
});

// Serves a new fight prepare request from the  controller
app.post('/prepareFight', jsonparser, (request, response) => {

    // Get contenders info
    var leftContender = request.body["contenders"]["left"];
    var rightContender = request.body["contenders"]["right"];

    // Get use animation flag
    var useAnimation = request.body["useAnimation"];

    // Get fight info
    var time = request.body["time"];
    var assaults = request.body["assaults"];
    var phase = request.body["phase"];
    var arena = request.body["arena"];

    // Get match info
    var match = request.body["match"];

    // Check arena fight overlay connection
    if(!(arena in fightOverlayConnections)) {
        console.log("Fight overlay page for arena " + arena + " is offline!");
        response.sendStatus(400);
        return;
    }

    // Compose message data for the overlay page
    console.log("Final phase" + isFinalPhase());
    var data = {
        "useAnimation" : useAnimation,
        "contenders" : {
            "left" : leftContender,
            "right" : rightContender
        },
        "phase" : phase,
        "assaults" : assaults,
        "time" : time,
        "showAssaults" : (isFinalPhase() ? false : true),
        "match" : match
    };

    // Send prepare message to the fight overlay page
    fightOverlayConnections[arena].send(JSON.stringify({
        "message" : "prepareFight",
        "data" : data
    }));
    response.sendStatus(200);
});

// Serves a fight finish request from the  controller
app.post('/finishFight', jsonparser, (request, response) => {

    // Get finish fight info
    var arena = request.body["arena"];
    var match = request.body["match"];
    var useAnimation = request.body["useAnimation"];

    // Send finish message to controller
    if(isFinalPhase()) {
        if(controllerConnection) {
            controllerConnection.send(JSON.stringify({
                "message" : "finishedMatch",
                "data" : {
                    "round" : tournament.round,
                    "match" : match
                }
            }));
        }
    }

    // Check arena fight overlay connection
    if(!(arena in fightOverlayConnections)) {
        console.log("Fight overlay page for arena " + arena + " is offline!");
        response.sendStatus(400);
        return;
    }

    // Compose message data for the overlay page
    var data = {
        "useAnimation" : useAnimation
    };

    // Send finish fight message to the fight overlay page
    fightOverlayConnections[arena].send(JSON.stringify({
        "message" : "finishFight",
        "data" : data
    }));

    // Return OK
    response.sendStatus(200);
});

// Get updated information about current match at a given arena
app.post('/getMatch', jsonparser, (request, response) => {

    // Get arena
    var arenaId = request.body["arena"];
    var matchId = request.body["id"];

    // Check arena fight overlay connection
    if(!(arenaId in fightOverlayConnections)) {
        console.log("Fight overlay page for arena " + arena + " is offline!");
        response.sendStatus(400);
        return;
    }

    // Update current match and send back updated info
    var arena = tournament.arenas[arenaId];
    if(!isFinalPhase()) {
        var pool = arena.pools[arena.round];
        updatePool(pool, poolsSpecs.filter(poolSpec => {
            return poolSpec["id"] === pool;
        })[0]).then((value) => {
            var match = tournament.pools[pool].matches[matchId];
            var firstContender = tournament.athletes[match.firstContender.contender];
            var secondContender = tournament.athletes[match.secondContender.contender];
            console.log("Updated info about pool " + pool);
            scorekeepConnections[arenaId].send(JSON.stringify({
              "message" : "updateMatch",
              "data" : {
                  "match" : match,
                  "firstContender" : firstContender,
                  "secondContender" : secondContender
              }
            }));
        });
        response.sendStatus(200);
        return;
    } else if(arenaId in tournament.finalPhase.arenas) {
        updateRound(finalPhaseSpec.rounds[tournament.round], finalPhaseSpec.sheet, tournament.round, tournament.finalPhase.arenas[tournament.round]).then((value) => {
            var match = tournament.finalPhase.rounds[tournament.round][matchId]
            var firstContender = tournament.athletes[match.firstContender.contender];
            var secondContender = tournament.athletes[match.secondContender.contender];
            var arena = tournament.arenas[arenaId];
            console.log("Updated info about round " + finalPhasesNames[tournament.round]);
            scorekeepConnections[arenaId].send(JSON.stringify({
              "message" : "updateMatch",
              "data" : {
                  "match" : match,
                  "firstContender" : firstContender,
                  "secondContender" : secondContender,
              }
            }));
        });
        response.sendStatus(200);
        return;
    }
    response.sendStatus(400);
});

// Update fight
app.post('/updateFightInfo', jsonparser, (request, response) => {

    // Get match info
    var contenders = request.body["contenders"];
    var phase = request.body["phase"];
    var assaults = request.body["assaults"];
    var time = request.body["time"];
    var arena = request.body["arena"];

    // Check arena fight overlay connection
    if(!(arena in fightOverlayConnections)) {
        console.log("Fight overlay page for arena " + arena + " is offline!");
        response.sendStatus(400);
        return;
    }

    // Send update scores message to the fight overlay page
    fightOverlayConnections[arena].send(JSON.stringify({
        "message" : "updateFightInfo",
        "data" : {
          "contenders" : contenders,
          "phase" : phase,
          "assaults" : assaults,
          "time" : time
        }
    }));
    response.sendStatus(200);
});

// Update current match of the specified arena
app.post('/updateMatch', jsonparser, (request, response) => {

    // Get match info
    var matchCont = request.body["match"];
    var match = matchCont.match;
    var arena = request.body["arena"];

    // Check arena fight overlay connection
    if(!(arena in fightOverlayConnections)) {
        console.log("Fight overlay page for arena " + arena + " is offline!");
        response.sendStatus(400);
        return;
    }

    // Convert match info to object
    var {contender, score, style, stylePartials} = match["firstContender"];
    var firstContender = new MatchResult(contender, score, style, stylePartials);
    var {contender, score, style, stylePartials} = match["secondContender"];
    var secondContender = new MatchResult(contender, score, style, stylePartials);
    var {id, isBye, isComplete, time, assaults, strategy, doppioVoid, consumed} = match;
    var newMatch = new Match(id, isBye, isComplete, firstContender, secondContender, time, assaults, strategy, doppioVoid, consumed, arena);

    // Update current arena match
    updateCurrentArenaMatch(arena, newMatch);

    // Set match parameters to pass to the overlay
    var elapsedSec = 0;
    var elapsedMin = 0;
    var leftScore = newMatch.firstContender.score;
    var rightScore = newMatch.secondContender.score;
    var assaults = newMatch.consumed;
    if(matchCont.isPaused) {
        elapsedSec = matchCont.elapsedSec;
        elapsedMin = matchCont.elapsedMin;
        leftScore = matchCont.leftScore;
        rightScore = matchCont.rightScore;
        assaults = matchCont.assaults;
    }

    // Send update scores message to the fight overlay page
    fightOverlayConnections[arena].send(JSON.stringify({
        "message" : "updateFight",
        "data" : {
          "scores" : {
              "left" : leftScore,
              "right" : rightScore
          },
          "assaults": newMatch.consumed,
          "elapsedSec" : elapsedSec,
          "elapsedMin" : elapsedMin
        }
    }));
    response.sendStatus(200);
});

app.post('/showBrackets', jsonparser, (request, response) => {
  if(slidesOverlayConnection != null) {
    slidesOverlayConnection.send(JSON.stringify({
      "message" : "showBrackets"
    }));
    response.sendStatus(200);
  } else {
    console.log("No connection currently established to slides overlay.")
    response.sendStatus(400);
  }
});


/************************************************************************************************************************************
                                                    WAIT & INTERMISSION BINDINGS
************************************************************************************************************************************/

app.post('/toggleCountdown', jsonparser, (request, response) => {

    // Get request arguments
    var startDate = request.body["startDate"] || false;
    var startTime = request.body["startTime"] || false;

    // Send message to overlay page
    if(waitIntermissionOverlayConnection != null) {
        waitIntermissionOverlayConnection.send(JSON.stringify({
            "message" : "toggleTimer",
            "data" : {
                "startDate" : startDate,
                "startTime" : startTime
            }
      }));
      response.sendStatus(200);
    } else {
        console.log("No connection currently established to wait & intermission overlay.")
        response.sendStatus(400);
    }
});

app.post('/startCountdown', jsonparser, (request, response) => {

    // Send message to overlay page
    if(waitIntermissionOverlayConnection != null) {
        waitIntermissionOverlayConnection.send(JSON.stringify({
            "message" : "startTimer"
        }));
        response.sendStatus(200);
    } else {
        console.log("No connection currently established to wait & intermission overlay.")
        response.sendStatus(400);
    }
});

app.post('/stopCountdown', jsonparser, (request, response) => {

    // Send message to overlay page
    if(waitIntermissionOverlayConnection != null) {
        waitIntermissionOverlayConnection.send(JSON.stringify({
            "message" : "stopTimer"
        }));
        response.sendStatus(200);
    } else {
        console.log("No connection currently established to wait & intermission overlay.")
        response.sendStatus(400);
    }
});

app.post('/toggleIntermissionMsg', jsonparser, (request, response) => {

    // Get request arguments
    var msg = request.body["msg"] || false;

    // Abort if arguments invalid
    if(!msg) {
        console.log("No message provided for wait & intermission overlay.")
        response.sendStatus(400);
        return;
    }

    // Send message to overlay page
    if(waitIntermissionOverlayConnection != null) {
        waitIntermissionOverlayConnection.send(JSON.stringify({
            "message" : "toggleMsg",
            "data" : {
                "msg" : msg
            }
        }));
        response.sendStatus(200);
    } else {
        console.log("No connection currently established to wait & intermission overlay.")
        response.sendStatus(400);
    }
});

/************************************************************************************************************************************
                                                            POOLS BINDINGS
************************************************************************************************************************************/

app.post('/showPool', jsonparser, (request, response) => {

  // Get pool id to show
  var poolId = request.body["poolId"] || false;
  console.log(poolId);
  if(!poolId) {
      response.sendStatus(400);
  } else {
      if(poolsOverlayConnection != null) {
          poolsOverlayConnection.send(JSON.stringify({
              "message" : "showPool",
              "data" : {
                  "poolId" : poolId
              }
          }));
          response.sendStatus(200);
      } else {
          console.log("No connection currently established to pools overlay.")
          response.sendStatus(400);
      }
  }
});

app.post('/toggleSliding', jsonparser, (request, response) => {

  var freq = request.body["freq"] || false;
  if(!freq) {
    response.sendStatus(400);
    return;
  }

  if(poolsOverlayConnection != null) {
      poolsOverlayConnection.send(JSON.stringify({
          "message" : "toggleSliding",
          "data" : {
              "freq" : freq
          }
      }));
      response.sendStatus(200);
  } else {
      console.log("No connection currently established to pools overlay.")
      response.sendStatus(400);
  }
});


// Connects to the google sheet and fetches pools data then returns a json containing the data
app.post('/updatePools', jsonparser, (request, response) => {

  // Get source google sheet
  var source = request.body["source"] || false;
  if(!source) {
      response.sendStatus(400);
      return;
  }

  // Get pools to fetch
  var pools = request.body["pools"] || false;
  if(!pools) {
      response.sendStatus(400);
      return;
  }

  // Compose Google Sheets ranges to fecth
  var ranges = [];
  pools.forEach((pool) => {
      ranges.push(pool["sheetRankRange"]);
      ranges.push(pool["sheetNameCell"]);
  });

  // Fetch updated pools info
  if(poolsOverlayConnection != null) {
      jwt.authorize((err, resp) => {
          sheets.spreadsheets.values.batchGet({
              spreadsheetId: source,
              ranges: ranges,
              majorDimension: 'ROWS',
              auth: jwt
          }, (err, resp) => {
              if (err) {
                  console.error(err);
                  response.sendStatus(400);
              }

              // Compose pools map
              var poolsMap = {};
              var results = resp.data.valueRanges;
              results.forEach((res) => {

                  // Get pool specification
                  var poolSpec = pools.filter(pool => {
                      return pool["sheetRankRange"] === res.range || pool["sheetNameCell"] === res.range;
                  })[0];
                  var poolId = poolSpec["id"];

                  // Check if pool data has already been set, if not create it
                  if(!(poolId in poolsMap)) {
                      poolItem = {
                         "id" : poolId,
                         "name" : "",
                         "athletes" : []
                      };
                      poolsMap[poolId] = poolItem;
                  }

                  // Set fetched data into pool
                  if(res.range === poolSpec["sheetNameCell"]) {
                      poolsMap[poolId]["name"] = res.values[0][0].replace(/POOL /, '').trim();
                  } else {
                      res.values.forEach((vals) => {
                          var name = vals[0].replace(/ \([^)]*\)/,'').trim();
                          var athlete = {
                              "name" : name,
                              "score" : parseFloat(vals[1].replace(',', '.')).toFixed(2),
                              "academy" : tournament.athletes[name].academy,
                              "rank" : vals[2],
                              "style" : parseFloat(vals[3].replace(',', '.')).toFixed(2)
                          };
                          poolsMap[poolId]["athletes"].push(athlete);
                      });
                  }
              });

              // Send pools to overlay page
              console.log("Updating pools...");
              poolsOverlayConnection.send(JSON.stringify({
                  "message" : "updatePools",
                  "data" : {
                      "pools" : JSON.stringify(poolsMap)
                  }
              }));
              response.sendStatus(200);
          });
      });
  } else {
    console.log("No connection currently established to pools overlay.")
    response.sendStatus(400);
  }
});


/************************************************************************************************************************************
                                                            BRACKET BINDINGS
************************************************************************************************************************************/

function getSpreadsheetInfo(source, ranges) {
    return new Promise((resolve, reject) => {
        const request = {
            spreadsheetId: source,
            ranges: ranges,
            majorDimension: 'ROWS',
            auth: jwt
        };
        sheets.spreadsheets.values.batchGet(request, (err, response) => {
            if (err) {
                reject(err);
            } else {
                resolve(response);
            }
        });
    });
}


app.post('/initializeBracket', jsonparser, async (request, response) => {

    // Check overlay connection
    if(bracketOverlayConnection == null) {
        console.log("No connection currently established to bracket overlay.")
        response.sendStatus(400);
        return;
    }

    // Get source google sheet
    var source = request.body["source"] || false;
    if(!source) {
        response.sendStatus(400);
        return;
    }

    // Get pairings
    var rounds = finalPhaseSpec["rounds"];
    let {pairings, roundResults} = await getRoundData(source, rounds[0], 0);

    // Initialize bracket overlay
    bracketOverlayConnection.send(JSON.stringify({
        "message" : "initializeBracket",
        "data" : {
            "pairings" : pairings
        }
    }));
    response.sendStatus(200);
});

app.post('/focusOnRound', jsonparser, (request, response) => {

    // Get source google sheet
    var round = request.body["round"];

    // Check overlay connection
    if(bracketOverlayConnection == null) {
        console.log("No connection currently established to bracket overlay.")
        response.sendStatus(400);
        return;
    }

    // Focus on match
    bracketOverlayConnection.send(JSON.stringify({
        "message" : "focusOnRound",
        "data" : {
            "round" : round
        }
    }));
    response.sendStatus(200);
});
//
// app.post('/focusOnMatch', jsonparser, (request, response) => {
//
//     // Get source google sheet
//     var match = request.body["match"];
//     var round = request.body["round"];
//
//     // Check overlay connection
//     if(bracketOverlayConnection == null) {
//         console.log("No connection currently established to bracket overlay.")
//         response.sendStatus(400);
//         return;
//     }
//
//     // Focus on match
//     bracketOverlayConnection.send(JSON.stringify({
//         "message" : "focusOnMatch",
//         "data" : {
//             "match" : match,
//             "round" : round
//         }
//     }));
//     response.sendStatus(200);
// });

// Define function to fetch rounds data
async function getRoundData(source, round, index) {
    return new Promise(async (resolve, reject) => {

        // Get bracket data
        var athletesMap = {};
        var pairings = [];
        var sheet = finalPhaseSpec["sheet"];
        var rounds = finalPhaseSpec["rounds"];

        // Get round data
        var roundResults = [];
        var start = round["startRow"];
        var blocks = round["layout"];
        var unit = round["athleteSize"];
        var nameCol = round["nameCol"] || false;
        var seedCol = round["seedCol"] || false;
        var scoreCol = round["scoreCol"] || false;
        var styleCol = round["styleCol"] || false;
        var regexRes;

        // Handle finals and secondary finals
        if(index == rounds.length-1) {
            if(finalPhaseSpec["finals"] && finalPhaseSpec["finals"].contenders && finalPhaseSpec["finals"].contenders.length == 2) {

                // Compose finals ranges
                var finalsRanges = [];
                var finalsResults = []
                var firstFinalistAddress = finalPhaseSpec["finals"].contenders[0];
                var secondFinalistAddress = finalPhaseSpec["finals"].contenders[1];
                finalsRanges.push(sheet + "!" + firstFinalistAddress["name"]);
                finalsRanges.push(sheet + "!" + firstFinalistAddress["score"]);
                finalsRanges.push(sheet + "!" + firstFinalistAddress["style"]);
                finalsRanges.push(sheet + "!" + secondFinalistAddress["name"]);
                finalsRanges.push(sheet + "!" + secondFinalistAddress["score"]);
                finalsRanges.push(sheet + "!" + secondFinalistAddress["style"]);

                // Compose secondary finals range
                var secondaryFinalsRanges = [];
                var secondaryFinalResults = [];
                var firstSecondaryFinalistAddress = finalPhaseSpec["secondaryFinals"].contenders[0];
                var secondSecondaryFinalistAddress = finalPhaseSpec["secondaryFinals"].contenders[1];
                secondaryFinalsRanges.push(sheet + "!" + firstSecondaryFinalistAddress["name"]);
                secondaryFinalsRanges.push(sheet + "!" + firstSecondaryFinalistAddress["score"]);
                secondaryFinalsRanges.push(sheet + "!" + firstSecondaryFinalistAddress["style"]);
                secondaryFinalsRanges.push(sheet + "!" + secondSecondaryFinalistAddress["name"]);
                secondaryFinalsRanges.push(sheet + "!" + secondSecondaryFinalistAddress["score"]);
                secondaryFinalsRanges.push(sheet + "!" + secondSecondaryFinalistAddress["style"]);
                var ranges = finalsRanges.concat(secondaryFinalsRanges);

                // Fetch data for the whole round
                try {

                    // Ask and wait for data from google sheet API
                    await jwt.authorize();
                    const res = await getSpreadsheetInfo(source, ranges);

                    // Parse first finalist data
                    var name = '', forms = [], score = '', style = '';
                    name = res.data.valueRanges[0].values[0][0];
                    let regexRes1 = name.match(/([^(]*) \((.*)\)/);
                    if(regexRes1 && regexRes1.length > 2) {
                        name = regexRes1[1];
                        forms = regexRes1[2].split('');;
                    }

                    if(res.data.valueRanges[1].values) {
                        score = res.data.valueRanges[1].values[0][0];
                    }
                    if(res.data.valueRanges[2].values) {
                        style = res.data.valueRanges[2].values[0][0];
                        style = style.replace(',', '.');
                    }
                    let result = null;
                    if(score !== "" || style !== "") {
                        result = {"score" : score, "style" : style};
                    }
                    finalsResults.push(result);

                    // Parse second finalist data
                    name = res.data.valueRanges[3].values[0][0];
                    let regexRes2 = name.match(/([^(]*) \((.*)\)/);
                    if(regexRes2 && regexRes2.length > 2) {
                        name = regexRes2[1];
                        forms = regexRes2[2].split('');;
                    }
                    if(res.data.valueRanges[4].values) {
                        score = res.data.valueRanges[4].values[0][0];
                    }
                    if(res.data.valueRanges[5].values) {
                        style = res.data.valueRanges[5].values[0][0];
                        style = style.replace(',', '.');
                    }
                    result = null;
                    if(score !== "" || style !== "") {
                        result = {"score" : score, "style" : style};
                    }
                    finalsResults.push(result);

                    // Parse first secondary finalist data
                    name = res.data.valueRanges[6].values[0][0];
                    let regexRes3 = name.match(/([^(]*) \((.*)\)/);
                    if(regexRes3 && regexRes3.length > 2) {
                        name = regexRes3[1];
                        forms = regexRes3[2].split('');;
                    }
                    if(res.data.valueRanges[7].values) {
                        score = res.data.valueRanges[7].values[0][0];
                    }
                    if(res.data.valueRanges[8].values) {
                        style = res.data.valueRanges[8].values[0][0];
                        style = style.replace(',', '.');
                    }
                    result = null;
                    if(score !== "" || style !== "") {
                        result = {"score" : score, "style" : style};
                    }
                    secondaryFinalResults.push(result);

                    // Parse second secondary finalist data
                    name = res.data.valueRanges[9].values[0][0];
                    let regexRes4 = name.match(/([^(]*) \((.*)\)/);
                    if(regexRes4 && regexRes4.length > 2) {
                        name = regexRes4[1];
                        forms = regexRes4[2].split('');;
                    }
                    if(res.data.valueRanges[10].values) {
                        score = res.data.valueRanges[10].values[0][0];
                    }
                    if(res.data.valueRanges[11].values) {
                        style = res.data.valueRanges[11].values[0][0];
                        style = style.replace(',', '.');
                    }
                    result = null;
                    if(score !== "" || style !== "") {
                        result = {"score" : score, "style" : style};
                    }
                    secondaryFinalResults.push(result);

                    // Add last round results
                    roundResults.push(finalsResults);
                    roundResults.push(secondaryFinalResults);
                    resolve({
                        pairings,
                        roundResults
                    });

                } catch(err) {
                    reject(err);
                }
            } else {
                reject(err);
            }
        } else {

            // Compute round rows
            var roundRows = [];
            function enumerateRoundRows(level, row, blocks, unit) {
                var block = blocks[level];
                var n = blocks.length-1;
                var offset = 0;
                if(level == blocks.length-1) {
                    for(let i=0; i<block["blocks"]; i++) {
                        roundRows.push(row + (block["spacing"]+unit)*i);
                    }
                    return unit*block["blocks"] + block["spacing"] * (block["blocks"]-1);
                }
                for(let j=0; j<block["blocks"]; j++) {
                    let size = enumerateRoundRows(level+1, row + offset, blocks, unit);
                    offset += size + block["spacing"];
                }
                return offset - block["spacing"];
            }
            enumerateRoundRows(0, start, blocks, unit);

            // Make sure at least seed and names are available for the first round
            if(index == 0) {
                if(!nameCol || !seedCol) {
                    console.log("Both seed and name cells should be given for the first round!");
                    reject();
                }
            }

            // Setup ranges map (tells us which kind of info we were requesting for each range included in the query)
            var rangesMap = {};
            var i = 0, n=0;
            if(nameCol) rangesMap[nameCol] = i++;
            if(seedCol) rangesMap[seedCol] = i++;
            if(scoreCol) rangesMap[scoreCol] = i++;
            if(styleCol) rangesMap[styleCol] = i++;
            n = i;

            // Compose ranges for the whole round
            var ranges = [];
            roundRows.forEach((row) => {

                // Compose ranges for the current athlete
                if(nameCol) ranges.push(sheet + "!" + nameCol + row);
                if(seedCol) ranges.push(sheet + "!" + seedCol + row);
                if(scoreCol) ranges.push(sheet + "!" + scoreCol + row);
                if(styleCol) ranges.push(sheet + "!" + styleCol + row);
            });

            // Fetch data for the whole round
            try {

                // Ask and wait for data from google sheet API
                await jwt.authorize();
                const res = await getSpreadsheetInfo(source, ranges);

                // Parse results
                var last = null;
                var isOdd = true;
                for(let j=0; j<roundRows.length; j++) {

                    // Parse a single athlete information
                    var name = '', forms = [], seed = '', score = '', style = '';
                    if(nameCol) {
                        let nameFormsRanges = res.data.valueRanges[j*n + rangesMap[nameCol]].values;
                        if(nameFormsRanges && nameFormsRanges.length > 0 && nameFormsRanges[0].length > 0) {
                            name = nameFormsRanges[0][0];
                            regexRes = name.match(/([^(]*) \((.*)\)/);
                            if(regexRes && regexRes.length > 2) {
                                name = regexRes[1];
                                forms = regexRes[2].split('');;
                            }
                        }
                    }
                    if(seedCol) {
                        let seedRanges = res.data.valueRanges[j*n + rangesMap[seedCol]].values;
                        if(seedRanges && seedRanges.length > 0 && seedRanges[0].length > 0) {
                            seed = seedRanges[0][0];
                        }
                    }
                    if(scoreCol) {
                        let scoreRanges = res.data.valueRanges[j*n + rangesMap[scoreCol]].values;
                        if(scoreRanges && scoreRanges.length > 0 && scoreRanges[0].length > 0) {
                            score = scoreRanges[0][0];
                        }
                    }
                    if(styleCol) {
                        let styleRanges = res.data.valueRanges[j*n + rangesMap[styleCol]].values;
                        if(styleRanges && styleRanges.length > 0 && styleRanges[0].length > 0) {
                            style = styleRanges[0][0];
                            style = style.replace(',', '.');
                        }
                    }

                    // Compose athlete
                    var athlete = {name, forms, seed, score, style}

                    // Add to athletes map and compose pairings
                    if(index == 0) {
                        if(seed !== '') {
                            athletesMap[seed] = {name, forms};
                        }
                        if(!isOdd) {
                            pairings.push([
                                {"name" : last.name, "seed" : last.seed, "forms" : last.forms},
                                {"name" : athlete.name, "seed" : athlete.seed, "forms" : athlete.forms}
                            ]);
                        }
                    }

                    // Add match result
                    if(!isOdd) {
                        let firstResult = null;
                        let secondResult = null;
                        if(last.score !== "" || last.style !== "") {
                            firstResult = {"score" : last.score, "style" : last.style};
                        }
                        if(athlete.score !== "" || athlete.style !== "") {
                            secondResult = {"score" : athlete.score, "style" : athlete.style};
                        }
                        roundResults.push([
                            firstResult,
                            secondResult
                        ]);
                    }

                    // Update variables to process alternating rows
                    isOdd = !isOdd;
                    last = athlete;
                }
            } catch(err) {
                reject(err);
            }

            // Resolve promise
            resolve({
                pairings,
                roundResults
            });
        }
    });
}

app.post('/updateBracket', jsonparser, async (request, response) => {

    // Check overlay connection
    if(bracketOverlayConnection == null) {
        console.log("No connection currently established to bracket overlay.")
        response.sendStatus(400);
        return;
    }

    // Get source google sheet
    var source = request.body["source"];
    if(!source) {
        response.sendStatus(400);
        return;
    }

    //Fetch data for each round
    var bracketResults = [];
    var rounds = finalPhaseSpec["rounds"];
    for(let i=0; i<rounds.length; i++) {
        try {
            let {pairings, roundResults} = await getRoundData(source, rounds[i], i);
            bracketResults.push(roundResults);
        }
        catch(err) {
            console.log(err)
            response.sendStatus(400);
            return;
        }
    }

    // Send bracket info to overlay page
    console.log("Updating bracket...");

    bracketOverlayConnection.send(JSON.stringify({
        "message" : "updateBracket",
        "data" : {
            "pairings" : pairings,
            "bracketResults" : bracketResults
        }
    }));
    response.sendStatus(200);
});

app.post('/updateRound', jsonparser, async (request, response) => {

    // Check overlay connection
    if(bracketOverlayConnection == null) {
        console.log("No connection currently established to bracket overlay.")
        response.sendStatus(400);
        return;
    }

    // Get source google sheet
    var source = request.body["source"];
    if(!source) {
        response.sendStatus(400);
        return;
    }

    //Fetch data for each round
    var round = request.body["round"];
    var rounds = finalPhaseSpec["rounds"];
    let {pairings, roundResults} = await getRoundData(source, rounds[round], round);


    // Send bracket info to overlay page
    console.log("Updating round...");

    bracketOverlayConnection.send(JSON.stringify({
        "message" : "updateRound",
        "data" : {
            "round" : round,
            "roundResults" : roundResults
        }
    }));
    response.sendStatus(200);
});

app.post('/focusOnMatch', jsonparser, async (request, response) => {

    // Check overlay connection
    if(bracketOverlayConnection == null) {
        console.log("No connection currently established to bracket overlay.")
        response.sendStatus(400);
        return;
    }

    // Get source google sheet
    var source = request.body["source"];
    if(!source) {
        response.sendStatus(400);
        return;
    }

    // Get source google sheet
    var match = request.body["match"];
    var round = request.body["round"];

    //Fetch data for each round
    var bracketResults = [];
    var rounds = finalPhaseSpec["rounds"];
    for(let i=0; i<rounds.length; i++) {
        try {
            let {pairings, roundResults} = await getRoundData(source, rounds[i], i);
            bracketResults.push(roundResults);
        }
        catch(err) {
            console.log(err)
            response.sendStatus(400);
            return;
        }
    }

    // Send bracket info to overlay page
    console.log("Updating bracket...");

    bracketOverlayConnection.send(JSON.stringify({
        "message" : "focusOnMatch",
        "data" : {
            "bracketResults" : bracketResults,
            "match" : match,
            "round" : round
        }
    }));
    response.sendStatus(200);
});


/************************************************************************************************************************************
                                                            WEB SOCKETS REGISTRATION
************************************************************************************************************************************/

app.ws('/registerFightOverlay', function(ws, req) {
    var arena = req.query.arena;
    if(tournament.arenas && arena in tournament.arenas) {
        fightOverlayConnections[arena] = ws;
        console.log("Fight overlay page for arena " + arena + " connected!");

        // Send overlay connected acknowledge to scorekeepers
        if(arena in scorekeepConnections) {
            scorekeepConnections[arena].send(JSON.stringify({
                "message" : "overlayConnected"
            }));
            if(!fightOverlayConnections[arena].hasNotifyScorekeeperCb) {
                fightOverlayConnections[arena].hasNotifyScorekeeperCb = true;
                fightOverlayConnections[arena].on('close', () => {
                    if(arena in scorekeepConnections) {
                        scorekeepConnections[arena].send(JSON.stringify({
                            "message" : "overlayDisconnected"
                        }));
                    }
                });
            }
        }

        // Send overlay connected acknowledge to controller
        if(controllerConnection) {
            controllerConnection.send(JSON.stringify({
                "message" : "updateTournamentInfo",
                "data" : {
                    "connections" : {
                        "overlay" : Object.keys(fightOverlayConnections)
                    }
                }
            }));
        }

        // Erase connection from map on close
        fightOverlayConnections[arena].on('close', () => {
            delete fightOverlayConnections[arena];
            if(controllerConnection) {
                controllerConnection.send(JSON.stringify({
                    "message" : "updateTournamentInfo",
                    "data" : {
                        "connections" : {
                            "overlay" : Object.keys(fightOverlayConnections)
                        }
                    }
                }));
            }
        });
    }
});

app.ws('/registerController', function(ws, req) {
  controllerConnection = ws;
  console.log("Controller page connected!");
  if(isInitialized()) {
      controllerConnection.send(JSON.stringify({
          "message" : "updateTournamentInfo",
          "data" : {
              "state" : tournament.state,
              "phase" : tournament.phase,
              "round" : tournament.round,
              "numAthletes" : JSON.stringify(Object.keys(tournament.athletes).length),
              "numArenas" : JSON.stringify(Object.keys(tournament.arenas).length),
              "streamedArenas" : getStreamedArenas(),
              "connections" : {
                  "overlay" : Object.keys(fightOverlayConnections),
                  "scorekeepers" : Object.keys(scorekeepConnections)
              }
          }
      }));
  } else {
      updateTournamentState(tournament.state);
      updateTournamentPhase(tournament.phase);
      updateTournamentRound(tournament.phase);
  }
});

app.ws('/registerScorekeeper', function(ws, req) {
  var arena = req.query.arena;
  if(tournament.arenas && arena in tournament.arenas) {
      scorekeepConnections[arena] = ws;
      console.log("Scorekeeper page for arena " + arena + " connected!");

      // Send overlay connected acknowledge to scorekeepers
      if(arena in fightOverlayConnections) {
          scorekeepConnections[arena].send(JSON.stringify({
              "message" : "overlayConnected"
          }));
          if(!fightOverlayConnections[arena].hasNotifyScorekeeperCb) {
              fightOverlayConnections[arena].hasNotifyScorekeeperCb = true;
              fightOverlayConnections[arena].on('close', () => {
                  scorekeepConnections[arena].send(JSON.stringify({
                      "message" : "overlayDisconnected"
                  }));
              });
          }
      }

      // Send scorekeepers connected acknowledge to controller
      if(controllerConnection) {
          console.log("Notify controller");
          controllerConnection.send(JSON.stringify({
              "message" : "updateTournamentInfo",
              "data" : {
                  "connections" : {
                      "scorekeepers" : Object.keys(scorekeepConnections)
                  }
              }
          }));
      }

      // Erase connection from map on close
      scorekeepConnections[arena].on('close', () => {
          delete scorekeepConnections[arena];
          if(controllerConnection) {
              controllerConnection.send(JSON.stringify({
                  "message" : "updateTournamentInfo",
                  "data" : {
                      "connections" : {
                          "scorekeepers" : Object.keys(scorekeepConnections)
                      }
                  }
              }));
          }
      });
  }
});

app.ws('/registerWaitIntermission', function(ws, req) {
  waitIntermissionOverlayConnection = ws;
  console.log("Wait & Intermission overlay connected!");
  waitIntermissionOverlayConnection('message', function(msg) {
    console.log(msg);
  });
});

app.ws('/registerPools', function(ws, req) {
  poolsOverlayConnection = ws;
  console.log("Pools overlay connected!");
  poolsOverlayConnection('message', function(msg) {
    console.log(msg);
  });
});

app.ws('/registerBracket', function(ws, req) {
  bracketOverlayConnection = ws;
  console.log("Bracket overlay connected!");
  bracketOverlayConnection('message', function(msg) {
    console.log(msg);
  });
});

/************************************************************************************************************************************
                                                            SERVER
************************************************************************************************************************************/

app.listen(port, (err) => {
  if (err) {
    return console.log('something bad happened', err)
  }

  console.log(`server is listening on ${port}`)
});
