/************************************************************************************************************************************
                                            TOURNAMENT INITIALIZATION BUTTONS AJAX REQUESTS
************************************************************************************************************************************/

// Manage the "initialize tournament" button action
var initButtonReenableTimeout = null;
$("#initialize-tournament-button").click(function() {


    // Get initialize from local file flag
    var initLocal = $('#initialize-local').is(':checked');
    var initLocalFile = $('#local-file').val();

    // Get tournament specification info
    let source = $('#spreadsheet-id').val();
    // let arenas = $('#arenas-number').val();
    // let finalPhaseArena = $('#final-phase-arena').val();
    let athletesSpec = $('#athletes-range').val();

    // Get pools specification
    let poolsSpec = [];
    $('#pools-table tbody tr').each(function(index, value) {
        let id = $(this).find('td').eq(0).text();
        let nameCell = $(this).find('td').eq(1).text();
        let rankRange = $(this).find('td').eq(2).text();
        let matchesRange = $(this).find('td').eq(3).text();
        let arena = $(this).find('td').eq(4).text();
        let round = $(this).find('td').eq(5).text();
        poolsSpec.push({"id" : id, "sheetRankRange" : rankRange, "sheetNameCell" : nameCell, "sheetMatchesRange" : matchesRange, "arena" : arena, "round" : round});
    });

    // Get arenas specification
    let arenasSpec = [];
    $('#arena-table tbody tr').each(function(index, value) {
        let name = $(this).find('td').eq(0).text();
        let isStreamed = $(this).find('td').eq(1).text() === "Y" ? true : false;
        // let isPools = $(this).find('td').eq(2).text() === "Y" ? true : false;
        // let isLast32 = $(this).find('td').eq(3).text() === "Y" ? true : false;
        // let isLast16 = $(this).find('td').eq(3).text() === "Y" ? true : false;
        // let isLast8 = $(this).find('td').eq(3).text() === "Y" ? true : false;
        // let isLast4 = $(this).find('td').eq(3).text() === "Y" ? true : false;
        // let isSemi = $(this).find('td').eq(3).text() === "Y" ? true : false;
        // let isFinal = $(this).find('td').eq(3).text() === "Y" ? true : false;
        // let isSecondary = $(this).find('td').eq(3).text() === "Y" ? true : false;
        arenasSpec.push({
            name,
            isStreamed,
            // isPools,
            // isLast32,
            // isLast16,
            // isLast8,
            // isLast4,
            // isSemi,
            // isFinal,
            // isSecondary,
        });
    });

    // Get final phase specifications
    let finalPhaseSpec = JSON.parse($('#rounds-json').val());

    // Perform AJAX request
    $.ajax({
        url: '/initializeTournament',
        type: 'POST',
        contentType: "application/json",
        handleAs: "json",
        data: JSON.stringify({
            "source" : source,
            "arenasSpec" : arenasSpec,
            "athletesSpec" : athletesSpec,
            "poolsSpec" : poolsSpec,
            "finalPhaseSpec" : finalPhaseSpec,
            "initLocal" : initLocal,
            "initLocalFile": initLocalFile
        }),
        success: function(data) {
            clearTimeout(initButtonReenableTimeout);
            updateTournamentInfo(data);
            $("#initialize-tournament-button").prop('disabled', false).removeClass('disabled');
            $("#initialize-tournament-button").html(`<i class="fas fa-stars" style=""></i> Initialize Tournament`);
        }
    });

    // Disable initialize button
    $("#initialize-tournament-button").prop('disabled', true).addClass('disabled');
    $("#initialize-tournament-button").html(`<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Initializing...`);

    // Set timer to re-enable button after ten seconds
    initButtonReenableTimeout = setTimeout(function() {
        if($("#initialize-tournament-button").prop('disabled')) {
            $("#initialize-tournament-button").prop('disabled', false).removeClass('disabled');
            $("#initialize-tournament-button").html(`<i class="fas fa-stars" style=""></i> Initialize Tournament`);
        }
    }, 10*1000);

    // Initialize round tables
    $('#round-reviews').html('');
    for(let i in finalPhaseSpec.rounds) {
        $('#round-reviews').append(
            `<div class="row form-group" style="margin-bottom: 10px;">
                <div class="col-sm-12">
                    <strong>Round ${i}</strong>
                </div>
            </div>
            <div class="table-responsive table-wrapper col-sm-12 text-center">
                <table class="table table-bordered rounds-review-table" data-round="${i}" id="rounds-review-table-${i}">
                    <thead>
                        <tr>
                            <th class="py-2" scope="col">ID</th>
                            <th class="py-2" scope="col">First Contender</th>
                            <th class="py-2" scope="col">Second Contender</th>
                            <th class="py-2" scope="col">Status</th>
                            <th class="py-2" scope="col">${roundReviewActions}</th>
                        </tr>
                    </thead>
                    <tbody>
                    </tbody>
                </table>
            </div>`
        );
    }

});

function updateTournamentInfo(data) {
    if(data.state) updateState(data.state);
    if(data.phase) updatePhase(data.phase);
    if(data.round) updateRound(data.round);
    if(data.numAthletes) $('#num-athletes').text(data.numAthletes);
    if(data.numArenas) $('#num-arenas').text(data.numArenas);
    if(data.streamedArenas) {
        $('#streamed-arenas').html('');
        for(let arena of data.streamedArenas) {
            $('#streamed-arenas').append(`<div class="row"><div class="col-3">Arena ${arena} :</div><span class="col-auto"><i id="overlay-connection-led-${arena}" class="fas fa-circle overlay-connection-led down"></i><i id="overlay-connection-label"> Overlay</i></span><span class="col-auto"><i id="scorekeeper-connection-led-${arena}" class="fas fa-circle scorekeeper-connection-led down"></i><i> Scorekeeper</i></span></div>`)
        }
    }
    if(data.connections) {
        if(data.connections.overlay) {
            $('.overlay-connection-led').removeClass('up').addClass('down');
            for(let arena of data.connections.overlay) {
                console.log(arena);
                $('#overlay-connection-led-' + arena).removeClass('down').addClass('up');
            }
        }
        if(data.connections.scorekeepers) {
            $('.scorekeeper-connection-led').removeClass('up').addClass('down');
            for(let arena of data.connections.scorekeepers) {
                console.log(arena);
                $('#scorekeeper-connection-led-' + arena).removeClass('down').addClass('up');
            }
        }
    }
}

// Start the tournament
$("#start-pools-phase-button").click(function() {

    // Perform AJAX request
    $.ajax({
        url: '/startPoolsPhase',
        type: 'POST',
        success: function() {
        }
    });
});

// Start the tournament
$("#start-final-phase-button").click(function() {

    // Perform AJAX request
    $.ajax({
        url: '/startFinalPhase',
        type: 'POST',
        success: function() {
        }
    });
});

/************************************************************************************************************************************
                                                    CONTROL BUTTONS AJAX REQUESTS
************************************************************************************************************************************/

// Shows the current fight frame overlay
$("#show-button").click(function() {
    $.ajax({
        url: '/show',
        type: 'POST',
        success: function() {
        }
    });
});

// Hides the current fight frame overlay
$("#hide-button").click(function() {
    $.ajax({
        url: '/hide',
        type: 'POST',
        success: function() {
        }
    });
});

// Request to clear up the current fight status
$("#clear-button").click(function() {
    $.ajax({
        url: '/clear',
        type: 'POST',
        success: function() {

        }
    });
});


/************************************************************************************************************************************
                                                    WAIT & INTERMISSION CONTROL BUTTONS AJAX REQUESTS
************************************************************************************************************************************/

$("#show-intermission-msg-button").click(function() {
    var msg = $('#intermission-msg').val();
    $.ajax({
        url: '/toggleIntermissionMsg',
        type: 'POST',
        contentType: "application/json",
        handleAs: "json",
        data: JSON.stringify({
            "msg" : msg
        }),
        success: function() {
        }
    });
});

$("#show-countdown-button").click(function() {
    var startDate = moment($('#startDate').datetimepicker('date')).format('MM/DD/YYYY');
    var startTime = moment($('#startTime').datetimepicker('date')).format('HH:mm:ss');
    $.ajax({
        url: '/toggleCountdown',
        type: 'POST',
        contentType: "application/json",
        handleAs: "json",
        data: JSON.stringify({
            "startDate" : startDate,
            "startTime" : startTime
        }),
        success: function() {
        }
    });
});

$("#start-countdown-button").click(function() {
    $.ajax({
        url: '/startCountdown',
        type: 'POST',
        success: function() {
        }
    });
});

$("#stop-countdown-button").click(function() {
    $.ajax({
        url: '/stopCountdown',
        type: 'POST',
        success: function() {
        }
    });
});

/************************************************************************************************************************************
                                                    POOLS CONTROL BUTTONS AJAX REQUESTS
************************************************************************************************************************************/

$("#toggle-pools-sliding-button").click(function() {

    // Get frequency
    let freq = $('#autoslide-freq').val();

    // Toggle icon
    let icon = $(this).find('i');
    if(icon.hasClass('fa-play')) {
        icon.removeClass('fa-play').addClass('fa-pause');
    } else {
        icon.removeClass('fa-pause').addClass('fa-play');
    }

    // Toggle autosliding
    $.ajax({
        url: '/toggleSliding',
        type: 'POST',
        contentType: "application/json",
        handleAs: "json",
        data: JSON.stringify({
            "freq" : freq
        }),
        success: function() {
        }
    });
});

$(document).on("click", "#pools-review-table .view", function(){
    var poolId = $(this).parents("tr").find("td").eq(0).text();
    $.ajax({
        url: '/showPool',
        type: 'POST',
        contentType: "application/json",
        handleAs: "json",
        data: JSON.stringify({
            "poolId" : poolId
        }),
        success: function() {
        }
    });
});

$(document).on("click", "#round-reviews td .view", function(){
    var match = parseInt($(this).parents("tr").find("td").eq(0).text());
    var round = $(this).parents("table").eq(0).data("round");
    let source = $('#spreadsheet-id').val();
    $.ajax({
        url: '/focusOnMatch',
        type: 'POST',
        contentType: "application/json",
        handleAs: "json",
        data: JSON.stringify({
            "source" : source,
            "round" : round,
            "match" : match
        }),
        success: function() {
        }
    });
});

$(document).on("click", "#round-reviews th .view", function(){
    var round = $(this).parents("table").eq(0).data("round");
    $.ajax({
        url: '/focusOnRound',
        type: 'POST',
        contentType: "application/json",
        handleAs: "json",
        data: JSON.stringify({
            "round" : round
        }),
        success: function() {
        }
    });
});

$(document).on("click", "#round-reviews th .update", function(){
    var round = $(this).parents("table").eq(0).data("round");
    let source = $('#spreadsheet-id').val();
    $.ajax({
        url: '/updateRound',
        type: 'POST',
        contentType: "application/json",
        handleAs: "json",
        data: JSON.stringify({
            "source": source,
            "round" : round
        }),
        success: function() {
        }
    });
});

$("#update-pools-rankings-button").click(function() {

    // Compose pools JSON
    let pools = [];
    $('#pools-table tbody tr').each(function(index, value) {
        let id = $(this).find('td').eq(0).text();
        let nameCell = $(this).find('td').eq(1).text();
        let rankRange = $(this).find('td').eq(2).text();
        pools.push({"id" : id, "sheetRankRange" : rankRange, "sheetNameCell" : nameCell});
    });

    // Get source google sheet id
    let source = $('#spreadsheet-id').val();

    // Send update pools request
    $.ajax({
        url: '/updatePools',
        type: 'POST',
        contentType: "application/json",
        handleAs: "json",
        data: JSON.stringify({
            "pools" : pools,
            "source" : source
        }),
        success: function() {
        }
    });
});

$('#show-fight-overlay-button').click(function() {

    // Get currently selected arena
    let arena = $('#select-arena').val();

    // Get use animation
    var useAnimation = $('#use-start-animation').is(':checked');

    // Send update match message
    $.ajax({
        url: '/showFightOverlay',
        type: 'POST',
        contentType: "application/json",
        handleAs: "json",
        data: JSON.stringify({
            "arena" : arena,
            "useAnimation" : useAnimation
        }),
        success: function() {
        }
    });
});

$('#hide-fight-overlay-button').click(function() {

    // Get currently selected arena
    let arena = $('#select-arena').val();

    // Get use animation
    var useAnimation = $('#use-end-animation').is(':checked');

    // Send update match message
    $.ajax({
        url: '/hideFightOverlay',
        type: 'POST',
        contentType: "application/json",
        handleAs: "json",
        data: JSON.stringify({
            "arena" : arena,
            "useAnimation" : useAnimation
        }),
        success: function() {
        }
    });
});

$('#next-step').click(function() {

    // Send update match message
    $.ajax({
        url: '/nextStep',
        type: 'POST',
        contentType: "application/json",
        handleAs: "json",
        data: JSON.stringify({
        }),
        success: function(data) {
            updateTournamentInfo(data);
        }
    });
});

$('#previous-step').click(function() {

    // Send update match message
    $.ajax({
        url: '/previousStep',
        type: 'POST',
        contentType: "application/json",
        handleAs: "json",
        data: JSON.stringify({
        }),
        success: function(data) {
            updateTournamentInfo(data);
        }
    });
});

$('#initialize-bracket').click(function() {

    // Get source spreadsheet
    let source = $('#spreadsheet-id').val();

    // Send update match message
    $.ajax({
        url: '/initializeBracket',
        type: 'POST',
        contentType: "application/json",
        handleAs: "json",
        data: JSON.stringify({
            "source" : source
        }),
        success: function(data) {
            updateTournamentInfo(data);
        }
    });
});

$('#update-bracket').click(function() {

    // Get source spreadsheet
    let source = $('#spreadsheet-id').val();

    // Send update match message
    $.ajax({
        url: '/updateBracket',
        type: 'POST',
        contentType: "application/json",
        handleAs: "json",
        data: JSON.stringify({
            "source" : source
        }),
        success: function(data) {
            updateTournamentInfo(data);
        }
    });
});

/************************************************************************************************************************************
                                                    CONTROLLER PAGE INITIALIZATION
************************************************************************************************************************************/

function updateState(state) {
    $('#tournament-state').text(state);
    if(state === "UNINITIALIZED") {
        $('#tournament-state').css('color', 'red');
    } else if (state === "INITIALIZED") {
        $('#tournament-state').css('color', 'blue');
    } else if (state === "STARTED") {
        $('#tournament-state').css('color', 'green');
    } else if (state === "FINISHED") {
        $('#tournament-state').css('color', 'green');
    }
}

function updatePhase(phase) {
    $('#tournament-phase').text(phase);
    if(phase === "NONE") {
        $('#tournament-phase').css('color', 'red');
    } else {
        $('#tournament-phase').css('color', 'green');
    }
}

function updateRound(round) {
    $('#tournament-round').text(round);
    if(round === "NONE") {
        $('#tournament-round').css('color', 'red');
    } else {
        $('#tournament-round').css('color', 'black');
    }
}

// Initiaize rounds review table
var matchReviewActions = '<a class="btn view-match view" title="View" data-toggle="tooltip"><i class="fas fa-eye"></i></a>';
var roundReviewActions = '<a class="btn view-match view" title="View" data-toggle="tooltip"><i class="fas fa-eye"></i></a><a class="btn update-round update" title="Update" data-toggle="tooltip"><i class="fas fa-sync-alt"></i></a>';

// Add a new pool specification
function addOrUpdateReviewMatch(round, id, firstContender, secondContender, isFinished) {

    // Get final phase specifications
    let finalPhaseSpec = JSON.parse($('#rounds-json').val());

    // Initialize round tables
    for(let i in finalPhaseSpec.rounds) {
        if($(`#round-reviews #rounds-review-table-${i}`).length) continue;
        $('#round-reviews').append(
            `<div class="row form-group" style="margin-bottom: 10px;">
                <div class="col-sm-12">
                    <strong>Round ${i}</strong>
                </div>
            </div>
            <div class="table-responsive table-wrapper col-sm-12 text-center">
                <table class="table table-bordered rounds-review-table" data-round="${i}" id="rounds-review-table-${i}">
                    <thead>
                        <tr>
                            <th class="py-2" scope="col">ID</th>
                            <th class="py-2" scope="col">First Contender</th>
                            <th class="py-2" scope="col">Second Contender</th>
                            <th class="py-2" scope="col">Status</th>
                            <th class="py-2" scope="col">${roundReviewActions}</th>
                        </tr>
                    </thead>
                    <tbody>
                    </tbody>
                </table>
            </div>`
        );
    }

    // Check if match already present
    var row = $("#rounds-review-table-" + round + " tbody #r" + round + 'm' + id);
    if(row.length) {
        row.html(
            '<td class="py-2">' + id + '</td>' +
            '<td class="py-2">' + firstContender + '</td>' +
            '<td class="py-2">' + secondContender + '</td>' +
            '<td class="py-2">' + (isFinished ? 'Finished' : 'Pending') + '</td>' +
            '<td class="py-2">' + matchReviewActions + '</td>'
        );
        if(isFinished) {
            row.addClass('finished-match');
            row.find("td:last-child a").removeClass('disabled');
        } else {
            row.removeClass('finished-match');
            row.find("td:last-child a").addClass('disabled');
        }
    } else {

        // Add new match rows
        var index = $("#rounds-review-table-" + round + " tbody tr:last-child").index();
        row = '<tr id="r' + round + 'm' + id + '">' +
        '<td class="py-2">' + id + '</td>' +
        '<td class="py-2">' + firstContender + '</td>' +
        '<td class="py-2">' + secondContender + '</td>' +
        '<td class="py-2">' + (isFinished ? 'Finished' : 'Pending') + '</td>' +
        '<td class="py-2">' + matchReviewActions + '</td>' +
        '</tr>';
        $("#rounds-review-table-" + round).append(row);
        $("#rounds-review-table-" + round + ' [data-toggle="tooltip"]').tooltip();
        if(isFinished) {
            $(`#r${round}m${id}`).addClass('finished-match');
            $(`#r${round}m${id}`).find("td:last-child a").removeClass('disabled');
        } else {
            $(`#r${round}m${id}`).removeClass('finished-match');
            $(`#r${round}m${id}`).find("td:last-child a").addClass('disabled');
        }
    }
}

$(document).ready(function() {

    // Connect to server through a web socket
    var socket = new WebSocket('ws://localhost:3000/registerController');

    // Set web socket message callback
    socket.onmessage = function(e) {

        // Get message data
        var json = JSON.parse(e.data);
        var message = json['message'];
        var data = json['data'];

        // Handle update messages
        switch(message) {

            case "stateUpdate":

                // Update state label
                var state = data["state"];
                updateState(state);
                break;

            case "phaseUpdate":
                var phase = data["phase"];
                updatePhase(phase);
                break;

            case "roundUpdate":
                var round = data["round"];
                updateRound(round);
                break;

            case "finishedMatch":
                var round = data["round"];
                var match = data["match"].match;
                addOrUpdateReviewMatch(round, match.id, match.firstContender.contender, match.secondContender.contender, true);
                break;

            case "updateRoundMatches":
                var round = data["round"];
                var matches = data["matches"];
                for(let matchCont of matches) {
                    var match = matchCont.match;
                    addOrUpdateReviewMatch(round, match.id, match.firstContender.contender, match.secondContender.contender, false);
                }
                break;

            case "updateTournamentInfo":
                updateTournamentInfo(data);
                break;
        }
    }

    // Setup forms toggle buttons
    $('.form[data-form]').each(function(index, value) {

        // Set checkbox buttons form icons background images
        $(this).css("background-image", "url(imgs/f" + $(this).data('form') + ".svg)");
        $(this).css("background-size", "30px 30px");

        // On click set the underlying checkbox as checked and invert form icon color
        $(this).click(function(e) {

            // Toggle underlying checkbox checked property
            var $checkBox = $(this).find('[type=checkbox]');
            $checkBox.prop('checked',!$checkBox.prop('checked'));

            // Invert form icon color
            var isChecked = $checkBox.is(':checked');
            if(isChecked) {
                $(this).css("background-image", "url(imgs/f" + $(this).data('form') + "b.svg)");
            } else {
                $(this).css("background-image", "url(imgs/f" + $(this).data('form') + ".svg)");
            }

            // Propagate click event
            return true;
        });
    });
});
