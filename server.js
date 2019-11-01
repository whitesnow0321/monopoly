var squareInfo = require('./public/js/component');
var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io').listen(server);

var data = [];
var players = {};
var turn= true;
var squares = generateSquares(squareInfo);
data.push(squares);



app.use(express.static(__dirname + '/public'));

app.get('/', function (req, res) {
    res.sendFile(__dirname + '/index.html');
});



io.on('connection', function (socket) {
    console.log('a user connected');

    /**=========================
     * This block creates player in players Array using PLAYER constructor
     * if the player number is not full.
     * // create a new player and add it to our players object
     * ==========================
     */
if (Object.keys(players).length < 2) {
    if (Object.keys(players).length === 0) {
        players[socket.id] = new PLAYER(25, 1, socket.id, 'Player1',true);
    }else if (Object.keys(players).length === 1){
        Object.keys(players).forEach(function (id) {
            players[id].x = players[id].x - 20;
            players[id].y = players[id].y - 20;
        });
        players[socket.id] = new PLAYER(25, 2, socket.id, 'Player2',false);
    }


    /**=======================
     * This line add players Array to the Array data that will be sent to client side
     * ========================
     */

    data.push(players);

    /**send the players object to the new player*/
    socket.emit('currentPlayer', data);

    /**==update all other players of the new player ==*/
    socket.broadcast.emit('newPlayer', data);
}
    socket.on('disconnect', function () {
        console.log('user disconnected');

        /**===remove this player from our players object==*/
        delete players[socket.id];
        /**==============================
         * If current player is first-joined player, then rearrange the
         * current player's position if not, then rearrange the position
         * and set the player number to first-player.
         * And update the players Array in data.
         */
        if (Object.keys(players).length < 2) {
            Object.keys(players).forEach(function (id) {
                if (players[id].playerNumber === 1) {
                    players[id].x = players[id].x + 20;
                    players[id].y = players[id].y + 20;
                }else {
                    players[id].x = players[id].x - 20;
                    players[id].y = players[id].y - 20;
                }
                players[id].playerNumber = 1;
                players[id].turn = true;
            });
            data[1] = players;
            /**==  emit a message to all players to remove this player ==*/
            io.emit('disconnect', data);
        }
    });
// when a player moves, update the player data
    socket.on('playerMovement', function (movementData) {
        players[socket.id].x = movementData.x;
        players[socket.id].y = movementData.y;
        players[socket.id].rotation = movementData.rotation;
        // emit a message to all players about the player that moved
        socket.broadcast.emit('playerMoved', players[socket.id]);
    });

    socket.on('playerStopped', function () {
        io.emit('playerStopped');
    });

    socket.on('playerMovementCompleted', function (socketId) {
        Object.keys(players).forEach(function (id) {
            players[id].turn?players[id].turn=false:players[id].turn=true;
        });
        io.emit('playerStopped');
        io.emit('playerMovementCompleted', socketId)
    });

    socket.on('bonus', function (playerId) {
        io.emit('bonus',playerId);
        io.emit('shiftTurn', data);
    });

    socket.on('prison', function (playerId) {
        io.emit('prison',playerId);
        io.emit('shiftTurn', data);
    });

    socket.on('buy', function (index) {
        io.emit('buy', [index, socket.id]);
        io.emit('shiftTurn', data);
    });

    socket.on('payToOther', function (playerId) {
        io.emit('payToOther', playerId);
        io.emit('shiftTurn', data);
    });

    socket.on('stayOwnPlace', function (playerId) {
        io.emit('stayOwnPlace', playerId);
        io.emit('shiftTurn', data);
    });

    socket.on('startPoint', function () {
        io.emit('shiftTurn', data);
    });

    socket.on('rolledDice', function (data) {
        io.emit('rolledDice', data);
    });
});


server.listen(8081, function () {
    console.log(`Listening on ${server.address().port}`);
});

/** ============================================
 * function square() => This function is a constructor of game board cell.
 * @param index : index is cell index.
 * @param squareName :squareName has a cell display name.
 * @param squareType : squareType has a cell type (normal, path or parcel, bonus).
 * @param owner : owner has a owner id.  ex: 'player1'
 * @param price : price for sale.
 * @param rent : rent.
 * @param crossPoint : crossPoint state. if current cell is crossPoint,     return true,otherwise   return false
 * @param playerNumber: current player number for this cell.
 * @constructor
 * ==============================================
 */
function SQUARE(index, squareName, squareType, owner, price, rent, crossPoint, playerNumber) {
    this.index = index;
    this.squareName = squareName;
    this.squareType = squareType;
    this.owner = owner;
    this.price = price;
    this.rent = rent;
    this.crossPoint = crossPoint;
    this.playerNumber = playerNumber
}

/**==============================================
 * function generateSquares() => This function generates the 7 *7 game board from
 * cell constructor function squares().
 * @param squareInfo
 * @returns {Array}
 */
function generateSquares(squareInfo) {
    var result = [];
    for (var i = 0; i < 49; i++) {
        result[i] = new SQUARE(i + 1, squareInfo.squareNames[i], squareInfo.squareTypes[i], 'For Sale', 100, 50, squareInfo.crossPoint[i], 0);
    }
    return result;
}

/**============================
 * function PLAYER() => This function is player constructor.
 * @param index : index has a player indicator's grid index.(from 1 to 49)
 * @param playerNumber : playerNumber has a current player number.
 * @param socketId : socketId has socket.id for unique recognize.
 * @param playerId : playerId has player's Id, it can set player1 or player 2 by default but can be set to customize.
 * @param turn: turn save the turn info.
 * @param balance:player's balance.
 * @constructor
 */
function PLAYER(index = 25, playerNumber = 1,socketId, playerId,turn=true,balance=1000) {
    this.index = index;
    this.playerNumber = playerNumber;
    this.x = this.playerNumber===1?420:420+20;
    this.y = this.playerNumber===1?420:420+20;
    this.socketId = socketId;
    this.playerId = playerId;
    this.turn=turn;
    this.balance = balance;
}