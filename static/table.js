$(document).ready(function () {
    $("#chatform").submit(function (e) {
        e.preventDefault();
        send($("#chatmessage").attr("value"));

        // shuffle the new command into the history
        historyIndex = -1;
        var oldTemp = $("#chatmessage").attr("value");
        var newTemp;
        for(var i = 0; i < chatHistory.length && i < 10; i++) {
            newTemp = chatHistory[i];
            chatHistory[i] = oldTemp;
            oldTemp = newTemp;
        }
        chatHistory[i] = oldTemp;

        // and clear the field
        $("#chatmessage").attr("value", "");
    });

    $("#chatform").bind("ajaxComplete", function(e) {
        if(needsToCheckIn) {
            needsToCheckIn = false;
            if(waitBeforeCheckIn) {
                waitBeforeCheckIn = false;
                var junk = setTimeout(function() { checkIn(); }, 5000); // wait 5 seconds
            } else {
                checkIn();
            }
        }
    });

    chatMessage = $("#chatmessage");
    chatMessage.keydown(keyHandler);

    // attach the click() event to all the td cells
    $("td.grid").click(clickHandler);

    $("#d2button").click(rollDice(2));
    $("#d3button").click(rollDice(3));
    $("#d4button").click(rollDice(4));
    $("#d6button").click(rollDice(6));
    $("#d8button").click(rollDice(8));
    $("#d10button").click(rollDice(10));
    $("#d12button").click(rollDice(12));
    $("#d20button").click(rollDice(20));
    $("#d100button").click(rollDice(100));

    $("#chatscrolllock").click(scrollLock);

    window.onbeforeunload = function () {
        return "Are you sure you want to leave the page?";
    }

    checkIn();
});

var needsToCheckIn = false;
var waitBeforeCheckIn = false;

var mapTokens = [];

function send(msg) {
    $.ajax({ type: 'POST', url: "/say", data: { message: msg }, success: function(o) {
        if(o.status == "private") {
            display("<span class=\"private\">*** " + o.message + "</span>");
        }
    } });
}


function checkIn () {
    $.ajax({ dataType: "json", url: "/check", data: { }, cache: false,
    success: function(data,textStatus,xml) {
        if(data.type == "chat") {
            var color = getColor(data.sender);
            display("<span style=\"color: " + color + "\">"+data.sender + ":</span> " + data.content);
        } else if(data.type == "board") {
            updateMap(data.tokens);
        } else if(data.type == "whisper") {
            var color = getColor(data.sender);
            display("<span class=\"whisper\">Whisper from <span style=\"color: " + color + "\">" + data.sender + ":</span> " + data.content + "</span>");
        } else if(data.type == "vars") {
            updateVars(data.vars, data.notes);
        } else if(data.type == "junk") {
            // do nothing
        } else if(data.type == "colors") {
            userColors = {};
            for(var i = 0; i < data.colors.length; i++) {
                userColors[data.colors[i][0]] = data.colors[i][1];
            }
        } else if(data.type == "commands") {
            updateCommands(data.commands); 
        }
    }, 
    error: function() {
        waitBeforeCheckIn = true;
    }, 
    complete: function() {
        needsToCheckIn = true;
    }});
}

var userColors = {};
function getColor (sender) {
    if(userColors && userColors[sender]){
        return userColors[sender];
    } else {
        return "#cccccc";
    }
}

var userCommands = {};

function updateCommands(cmds) {
    userCommands = {};
    for(var i = 0; i < cmds.length; i++) {
        userCommands[cmds[i][0]] = cmds[i][1];
    }

    cmdsHtml = "";
    var names = Object.keys(userCommands);
    if(names) {
        for(var i = 0; i < names.length; i++) {
            cmdsHtml += "<input type='button' onclick='sendUserCommand(\"" + names[i] + "\")' value=\"" + names[i] + "\"> ";
        }
    }

    $("#usercommands").html(cmdsHtml);
}

function sendUserCommand(cmd) {
    if(userCommands && userCommands[cmd]){
        send(userCommands[cmd]);
    } else {
        display("::!:: Couldn't find command " + cmd + ". This shouldn't happen. Please report this bug.");
    }
}

var urlRegexWWW = new RegExp("((?!http://)www\.[^ \,\!]*)", "g");
var urlRegexHTTP = new RegExp("(http://[^ \,\!]*|www\.[^ \,\!]*)", "g");

function display (msg) {
    // look for URLs and make them into links
    msg = msg.replace(urlRegexWWW, "http://$1");
    msg = msg.replace(urlRegexHTTP, "<a href=\"$1\">$1</a>");

    var ta = $("#chattextarea");
    ta.html(ta.html() + msg + "<br/>\n");
    if(!scrollLocked) {
        ta.scrollTop(100000000);
    } else {
        ta.addClass('borderhighlight');
        ta.removeClass('bordernormal');
    }
}


function updateMap(newTokens) {
    // first hack: just remove them all and replace them with the new ones
    $("td.grid").html("");

    for (i in newTokens) {
        var t = newTokens[i];
        var squareId = "sq_" + t.x + "x" + t.y;
        var square = $("#"+squareId);
        square.html("<img class=\"grid\" src=\"/static/images/" + t.image + "\" />");
    }

    mapTokens = newTokens;
}



var vartables = {};

Vartable = function(nick, vars, notes) {
    this.nick = nick;
    this.vars = vars;
    this.notes = notes;
    this.visible = true;
    this.touched = true;
}


function updateVars(newVars, newNotes) {
    var keys = Object.keys(vartables);
    for(var i = 0; i < keys.length; i++) {
        vartables[keys[i]].touched = false;
    }

    for(var i = 0; i < newVars.length; i++) {
        if(vartables[newVars[i].nick]) {
            vartables[newVars[i].nick].vars = newVars[i].vars;
            vartables[newVars[i].nick].touched = true;
        } else {
            vartables[newVars[i].nick] = new Vartable(newVars[i].nick, newVars[i].vars, []); // notes will get filled in
        }
    }

    for(var i = 0; i < newNotes.length; i++) {
        if(vartables[newNotes[i].nick]) {
            vartables[newNotes[i].nick].notes = newNotes[i].notes;
            vartables[newNotes[i].nick].touched = true;
        } else {
            vartables[newNotes[i].nick] = new Vartable(newNotes[i].nick, [], newNotes[i].notes);
        }
    }

    var nicks = Object.keys(vartables);
    if(nicks) {
        nicks.sort();

        var varsHtml = "";
        for(var i = 0; i < nicks.length; i++) {
            var v = vartables[nicks[i]];
            if(!v.touched) {
                delete vartables[nicks[i]];
            } else {
                varsHtml += "<div class='vars'>";
                varsHtml += "<h4 class='vars'><a href=\"javascript:toggleVarsTable('"+ v.nick +"')\">" + v.nick + "</a></h4>";
                varsHtml += "<div class=\"varstable";
                varsHtml += v.visible ? "" : " hidden";
                varsHtml += "\" id=\"" + v.nick + "table\">";
                varsHtml += "<ul>";
                for(var j = 0; j < v.notes.length; j++) {
                    varsHtml += "<li><a target=\"_blank\" href=\"/note/" + v.notes[j][0] + "\">" + v.notes[j][1] + "</a></li>";
                }
                varsHtml += "</ul>";
                varsHtml += "<table class=\"vars\">";
                for(var j = 0; j < v.vars.length; j++) {
                    varsHtml += "<tr class=\"vars\">";
                    varsHtml += "<td class=\"vars\">" + v.vars[j][0] + "</td>";
                    varsHtml += "<td class=\"vars\">" + v.vars[j][1] + "</td>";
                    varsHtml += "</tr>";
                }
                varsHtml += "</table></div></div>";
            }
        }

        $("#varstable").html(varsHtml);
    }
}


function toggleVarsTable(nick) {
    if(!vartables[nick]) return;

    if(vartables[nick].visible){
        $("#"+nick+"table").addClass("hidden");
        vartables[nick].visible = false;
    } else {
        $("#"+nick+"table").removeClass("hidden");
        vartables[nick].visible = true;
    }
}

function collapseAllVars() {
    expandCollapseAllVars(false, function(v){ v.addClass('hidden'); });
}

function expandAllVars() {
    expandCollapseAllVars(true, function(v){ v.removeClass('hidden'); });
}

function expandCollapseAllVars(visible, f) {
    nicks = Object.keys(vartables);
    if(nicks) {
        for(var i = 0; i < nicks.length; i++) {
            vartables[nicks[i]].visible = visible;
        }
    }

    f($("div.varstable"));
}



var chatHistory = [];
var historyIndex = -1;
var currentCommand = null;
var chatMessage;

function keyHandler(e) {
    if(e.keyCode == 38) { // up
        e.preventDefault();

        if(historyIndex < chatHistory.length-1) {
            if(historyIndex < 0) {
                currentCommand = chatMessage.attr("value"); // store the current command
            }
            historyIndex++;
            chatMessage.attr("value", chatHistory[historyIndex]);
            chatMessage[0].setSelectionRange(10000,10000); // put cursor at the right edge
        }
    } else if(e.keyCode == 40) { //down
        e.preventDefault();

        var value;
        if(historyIndex == 0) { 
            historyIndex = -1;
            value = currentCommand;
        } else if(historyIndex > 0) {
            historyIndex--;
            value = chatHistory[historyIndex];
        }
        chatMessage.attr("value", value);
        chatMessage[0].setSelectionRange(10000,10000); // put cursor at the right edge.
    }
}

var selected = null;

function clickHandler(e) {
    var id = e.currentTarget.id;
    var x = id.slice(id.indexOf("_")+1, id.indexOf("x"));
    var y = id.slice(id.indexOf("x")+1);

    if(selected){
        if(selected.x == x && selected.y == y){
            // de-select and de-highlight
            selected = null;
            $("td.gridhighlight").removeClass("gridhighlight");
        } else {
            // move the selected element to the given location with a /place command
            var cmd = "/place " + x + " " + y + " " + selected.image + " " + selected.name;
            $("td.gridhighlight").removeClass("gridhighlight");
            selected = null;
            send(cmd);
        }
    } else {
        // check if there's an image under the spot where we clicked
        for(i in mapTokens) {
            if(mapTokens[i].x == x && mapTokens[i].y == y) {
                selected = mapTokens[i];
            }
        }

        if(selected){
            $("#sq_" + x + "x" + y).addClass("gridhighlight");
        }

    }

}


var gridVisible = false;

function toggleGridVisibility() {
    if(gridVisible) {
        gridVisible = false;
        $("#gridpane").addClass("hidden");
        $("#gridhideshow").html("Show grid");
    } else {
        gridVisible = true;
        $("#gridpane").removeClass("hidden");
        $("#gridhideshow").html("Hide grid");
    }
}



function rollDice(n) {
    return function (e) {
        send("/roll d"+n);
    };
}


var scrollLocked = false;

function scrollLock() {
    if(scrollLocked) {
        scrollLocked = false;
        var ta = $("#chattextarea");
        ta.scrollTop(100000000);
        ta.addClass('bordernormal');
        ta.removeClass('borderhighlight');
        $("#chatscrolllock").attr('src', "/static/images/blue.png");
    } else {
        scrollLocked = true;
        $("#chatscrolllock").attr('src', "/static/images/red.png");
    }
}


