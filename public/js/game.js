var config = {
    type: Phaser.AUTO,
    parent: 'parent',
    width: 840,
    height: 840,
    physics: {
        default: 'arcade',
        arcade: {
            debug: false,
            gravity: { y: 0 },
            inertia:{x:0,y:0}
        }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

var game = new Phaser.Game(config);

function preload() {
    this.load.image('me', 'assets/ball-default.png');
    this.load.image('other', 'assets/ball-yellow.png');
    this.load.image('arrowUp', 'assets/arrow-up.png');
    this.load.image('arrowRight', 'assets/arrow-right.png');
    this.load.image('arrowDown', 'assets/arrow-down.png');
    this.load.image('arrowLeft', 'assets/arrow-left.png');
    this.load.image('buyButtonUp', 'assets/buy.png');
    this.load.image('buyButtonDown', 'assets/buy.png');
    this.load.image('buyButtonRight', 'assets/buy.png');
    this.load.image('buyButtonLeft', 'assets/buy.png');
    this.load.image('skipButton', 'assets/skip.png');
}

function create() {
    this.btn = document.getElementById('rollDice');
    var self = this;
    this.socket = io();
    self.cell_width =game.canvas.width/7;
    self.cell_height = game.canvas.height/7;

    this.socket.on('currentPlayer', function (data){
        self.squareInfo = data[0];

        let players = data[1];

        //Initialize the Game Area
        initializeGameArea(self, data[0]);

        //Display current players on Game Area
        Object.keys(players).forEach(function (id) {
            if (players[id].socketId === self.socket.id) {
                addPlayer(self, players[id]);
                displayMessage('normal',self.me.userdata.playerId + ': Joined the game');
            } else {
                addOtherPlayer(self, players[id]);
                displayMessage('normal',self.otherPlayer.userdata.playerId + ': Joined the game');
            }
            if (players[id].playerId === 'Player1') {
                displayInfo('player-1-name','Player1');displayInfo('Player1', '1000$');
            }
            else {displayInfo('player-2-name','Player2');displayInfo('Player2', '1000$');}
        });
    });

    this.socket.on('newPlayer', function (data) {
        let players = data[1];
        self.me.destroy();
        Object.keys(players).forEach(function (id) {
            if (players[id].socketId !== self.socket.id) {
                addOtherPlayer(self, players[id]);
                displayMessage('normal', self.otherPlayer.userdata.playerId + ': Joined the game');
                displayInfo('Player2','Player2');displayInfo('Player2', '1000$');
            }else {
                addPlayer(self, players[id]);
                self.me.setAngularVelocity(-200);
            }
        });
    });

    this.socket.on('disconnect', function (data) {
        let players = data[1];
        /**Destroy the first images and redraw the player image*/
        self.me.destroy();
        self.otherPlayer.destroy();
        Object.keys(players).forEach(function (id) {
            addPlayer(self, players[id]);
        })
    });

    this.socket.on('playerMoved', function (playerInfo) {
        self.otherPlayer.setPosition(playerInfo.x, playerInfo.y);
        updateOthersIndex(self);
    });

    this.socket.on('shiftTurn', function (players) {
        Object.keys(players).forEach(function (id) {
            if (players[id][self.socket.id]&&players[id][self.socket.id].turn) {
                self.me.setAngularVelocity(-200);
                self.otherPlayer.setAngularVelocity(0);
                self.btn.removeAttribute('disabled');
                displayInfo('turn', self.me.userdata.playerId);
            } else {
                self.otherPlayer.setAngularVelocity(-200);
                self.me.setAngularVelocity(0);
                self.btn.setAttribute('disabled','disabled');
                displayInfo('turn', self.otherPlayer.userdata.playerId);
            }
        })
    });

    this.socket.on('playerStopped', function () {
        resetPositionInCell(self);
    });

    this.socket.on('bonus', function (playerId) {
        if (self.me.userdata.playerId === playerId){
            self.me.userdata.balance += 100;
            displayInfo(playerId, self.me.userdata.balance + '$');
        } else {
            self.otherPlayer.userdata.balance += 100;
            displayInfo(playerId, self.otherPlayer.userdata.balance + '$');
        }
        displayMessage('income',playerId + ': Just have got bonus 100$.');
    });

    this.socket.on('prison', function(playerId){
        if (self.me.userdata.playerId === playerId){
            self.me.userdata.balance -= 100;
            displayInfo(playerId, self.me.userdata.balance + '$');
        } else {
            self.otherPlayer.userdata.balance -= 100;
            displayInfo(playerId, self.otherPlayer.userdata.balance + '$');
        }
        displayMessage('pay', playerId + ': Just have lost 100$.');
    });

    this.socket.on('playerMovementCompleted', function (socketId) {
        if (self.me.userdata.socketId === socketId) {
            process(self);
        }
    });

    this.socket.on('buy', function (data) {
        destroyBuyButton(self);
        mapUpdate(self, data);
        updateBalance(self, data);
    });

    this.socket.on('payToOther', function (playerId) {
         payToOther(self, playerId);
    });

    this.socket.on('stayOwnPlace', function (playerId) {
        displayMessage('normal',playerId + ': Stays on owned parcel.');
    });

    this.socket.on('rolledDice', function (data) {
        displayMessage('normal', data[0] + ' : The dice shows ' + data[1]);
    });

    this.btn.addEventListener('click',function () {
        self.rollNumber = Math.floor(Math.random() * (7 - 1) + 1);
        self.socket.emit('rolledDice', [self.me.userdata.playerId, self.rollNumber]);
        addArrows(self);
        this.setAttribute('disabled', 'disabled');
    });

    this.input.on('gameobjectdown', function (pointer, gameObject) {
        let object = objectHandler(gameObject.texture.key);
        if (object !== 'UB' && object !== 'DB' && object !== 'RB' && object !== 'LB') {
            getAndSetTarget(self, object);
            goToTarget(self, object);
            self.direction = object;
        }else {
            buyParcel(self, object);
        }
    });
}

function update(){
    if (this.me) {
        updateMyIndex(this);
        stopMove(this);
        // emit player movement
        var x = this.me.x;
        var y = this.me.y;
        if (this.me.oldPosition && (x !== this.me.oldPosition.x || y !== this.me.oldPosition.y)) {
            this.socket.emit('playerMovement', { x: this.me.x, y: this.me.y});
        }
        // save old position data
        this.me.oldPosition = {
            x: this.me.x,
            y: this.me.y
        };

    }

    gameOver(this);
}


/**=================================
 * function initializeGameArea => This function initialize the
 * game area from received game board data.
 * @param self : self reference the game object.
 * @param squareInfo: squareInfo has a game area data.
 */
function initializeGameArea(self, squareInfo) {

    this.squareInfo = squareInfo;
    /**===========================
     * function getCoordinate => This function calculate the cell's center coordinate and
     * return it to the initializeGameArea function.
     * @param index : index is cell number.
     */
    this.getCoordinates = function (index) {
        this.gridY = Math.ceil(index/7);
        this.gridX = index-(this.gridY-1)*7;
        this.cellCenterPixelY = (this.gridY - 1) * self.cell_height + self.cell_height/2;
        this.cellCenterPixelX = (this.gridX - 1) * self.cell_width + self.cell_width/2;
    };
    /**==================================
     * function cellDraw => This function draws cells and texts on cells.
     */
    this.cellDraw = function () {
        for (var i = 0; i < 49; i++) {
            this.getCoordinates(i+1);
            switch (this.squareInfo[i].squareType) {
                case 'normal': this.drawColor = 0xE8E8E8;
                    break;
                case 'parcel': this.drawColor = 0xc2c2c2;
                    break;
                case 'bonus': this.drawColor = 0xffdd55;
                    break;
                case 'path': this.drawColor = 0xaaaaaa;
                    break;
                case 'impots': this.drawColor = 0xe66666;
                    break;
            }
            var cellTopRightX = this.cellCenterPixelX-self.cell_width/2 +1; // +1: For the cell border width
            var cellTopRightY = this.cellCenterPixelY-self.cell_height/2 +1;  // +1 : For the cell border width
            var cellInner_width = self.cell_width-2; // Real draw cell width - cell border width considered.
            var cellInner_height = self.cell_height-2;//Real draw cell height - cell border width considered.
            self.graphics = self.add.graphics({ fillStyle: { color: this.drawColor } });// Draw color setting.
            self.rect = new Phaser.Geom.Rectangle(cellTopRightX, cellTopRightY, cellInner_width, cellInner_height);
            self.graphics.fillRectShape(self.rect);//Draw cell.
            self.cellId = self.add.text(cellTopRightX+10, cellTopRightY+10, '', { fontSize: '14px', fill: '#000000' });
            self.cellId.setText(i+1);//Draw text on cell
            self.cellName = self.add.text(cellTopRightX+30, cellTopRightY+30, '', { fontSize: '14px', fill: '#ffffff' });
            self.cellName.setText(this.squareInfo[i].squareName);
            self.cellIsCross = self.add.text(cellTopRightX+30, cellTopRightY+70, '', { fontSize: '14px', fill: '#ffffff' });
            self.cellIsCross.setText(this.squareInfo[i].crossPoint);
            if (this.squareInfo[i].squareType === 'parcel') {
                self.cellOwner = self.add.text(cellTopRightX+25, cellTopRightY+50, '', { fontSize: '14px', fill: '#000000' });
                self.cellOwner.setText(this.squareInfo[i].owner);
                self.cellPrice = self.add.text(cellTopRightX+20, cellTopRightY+70, '', { fontSize: '14px', fill: '#000000' });
                self.cellPrice.setText('Price:' + this.squareInfo[i].price + '$');
                self.cellRent = self.add.text(cellTopRightX+25, cellTopRightY+90, '', { fontSize: '14px', fill: '#000000' });
                self.cellRent.setText('Rent:' + this.squareInfo[i].rent + '$');
            }
            else if (this.squareInfo[i].squareType === 'bonus') {
                self.cellBonus = self.add.text(cellTopRightX+25, cellTopRightY+60, '', { fontSize: '14px', fill: '#000000' });
                self.cellBonus.setText('Gain:' + this.squareInfo[i].price + '$');
            }
        }
    };
    this.cellDraw();
}

/**==================================
 * THIS FUNCTION ADDS MY PLAYER SPRITE TO GAME
 * @param self => GAME OBJECT
 * @param player => PLAYER INFO FROM SERVER TO INITIALIZE
 */
function addPlayer(self, player) {
    self.me = self.physics.add.sprite(player.x, player.y, 'me').setOrigin(0.5, 0.5).setDisplaySize(50, 50);
    self.me.userdata = player;
    if (player.turn) {
        self.me.setAngularVelocity(-200);
        self.btn.removeAttribute('disabled');
    }
}

/**==================================
 * THIS FUNCTION ADDS OTHER PLAYER SPRITE TO GAME
 * @param self => GAME OBJECT
 * @param player => PLAYER INFO FROM SERVER TO INITIALIZE
 */
function addOtherPlayer(self, player) {
    self.otherPlayer = self.physics.add.sprite(player.x, player.y, 'other').setOrigin(0.5, 0.5).setDisplaySize(50, 50);
    self.otherPlayer.userdata = player;
    if (player.turn) {
        self.otherPlayer.setAngularVelocity(-200);
        self.btn.setAttribute('disabled','disabled');
    }
}

/**==================================
 * WHEN CLICK ON ARROWS , FIND OUT THE COORDINATE OF CURSOR
 * AND INDEX IN GRID AND POSITION ABOUT GAME SPRITE.
 * @param cursor => CURSOR OBJECT
 * @param self => GAME OBJECT
 * @returns {*}
 */
function cursorHandler(cursor, self) {
    var direction;
        var cursorIndex = getIndexFromCoordinate(cursor.downX, cursor.downY);
        switch (cursorIndex) {
            case self.me.userdata['index'] +1:
                direction = 'R';
                break;
            case self.me.userdata['index'] - 1:
                direction = 'L';
                break;
            case self.me.userdata['index'] + 7:
                direction = 'D';
                break;
            case self.me.userdata['index'] - 7:
                direction = 'U';
                break;
        }
        return direction;
}

/**===================================
 * ADD ARROWS FOR CLICK AROUND THE SPRITE
 * @param self => GAME OBJECT
 */
function addArrows(self) {
    if (self.squareInfo[self.me.userdata['index']].squareType === 'path'){
        self.arrowRight = self.physics.add.sprite(self.me.x + self.cell_width,self.me.y, 'arrowRight').setOrigin(0.5, 0.5).setDisplaySize(80, 80);
        self.arrowRight.setInteractive();
    }
    if (self.squareInfo[self.me.userdata['index'] - 2].squareType === 'path'){
        self.arrowLeft = self.physics.add.sprite(self.me.x - self.cell_width,self.me.y, 'arrowLeft').setOrigin(0.5, 0.5).setDisplaySize(80, 80);
        self.arrowLeft.setInteractive();
    }
    if (self.squareInfo[self.me.userdata['index'] - 8].squareType === 'path'){
        self.arrowUp = self.physics.add.sprite(self.me.x,self.me.y - self.cell_height, 'arrowUp').setOrigin(0.5, 0.5).setDisplaySize(80, 80);
        self.arrowUp.setInteractive();
    }
    if (self.squareInfo[self.me.userdata['index'] + 6].squareType === 'path'){
        self.arrowDown = self.physics.add.sprite(self.me.x,self.me.y + self.cell_height, 'arrowDown').setOrigin(0.5, 0.5).setDisplaySize(80, 80);
        self.arrowDown.setInteractive();
    }
}

/**===================================
 * REMOVE THE ARROWS WHEN PLAYER CLICK ANY ARROW
 * @param self => GAME OBJECT
 */
function destroyArrows(self) {
    if (self.arrowDown) {
        self.arrowDown.destroy();
    }
    if (self.arrowUp) {
        self.arrowUp.destroy();
    }
    if (self.arrowRight) {
        self.arrowRight.destroy();
    }
    if (self.arrowDown) {
        self.arrowLeft.destroy();
    }
}

/**===================================
 * UPDATE MY SPRITE'S INDEX WHEN MY SPRITE MOVES
 * @param self => GAME OBJECT
 */
function updateMyIndex(self) {
    self.me.userdata['index'] = getIndexFromCoordinate(self.me.x, self.me.y);
}

/**====================================
 * UPDATE OTHER'S SPRITE'S INDEX WHEN OTHER'S SPRITE MOVES
 * @param self =>GAME OBJECT
 */
function updateOthersIndex(self) {
    self.otherPlayer.userdata['index'] = getIndexFromCoordinate(self.otherPlayer.x, self.otherPlayer.y);
}

/**=====================================
 * FIND OUT GRID INDEX FROM COORDINATE
 * @param x =>X-COORDINATE
 * @param y =>Y-COORDINATE
 * @returns {number}
 */
function getIndexFromCoordinate(x, y){
    var height = game.canvas.height/7;
    var width = game.canvas.width/7;
    var xIndex = Math.ceil(x/width);
    var yIndex = Math.ceil(y/height);
    return (yIndex -1) *7 +xIndex;
}

/**======================================
 * WHEN USER CLICK ANY ARROW, CALCULATE THE AVAILABLE POSITION
 * AND SAVE IT IN GAME OBJECT
 * @param self => GAME OBJECT
 * @param direction => DIRECTION TO MOVE(DETERMINED WHEN PLAYER CLICK
 * THE ARROW.
 */
function getAndSetTarget(self, direction) {
    var step;
    switch (direction) {
        case 'R':
            if (self.rollNumber >= 2 && self.squareInfo[self.me.userdata['index'] + 1].squareType === 'path' && self.squareInfo[self.me.userdata['index'] - 1].crossPoint){
                self.targetX = self.me.x + self.cell_width * 2;self.targetY = self.me.y;step = 2;
            } else {self.targetX = self.me.x + self.cell_width ;self.targetY = self.me.y;step = 1;}
            break;
        case 'L':
            if (self.rollNumber >= 2 && self.squareInfo[self.me.userdata['index'] - 3].squareType === 'path' && self.squareInfo[self.me.userdata['index'] - 1].crossPoint){
                self.targetX = self.me.x - self.cell_width * 2;self.targetY = self.me.y;step = 2;
            } else {self.targetX = self.me.x - self.cell_width;self.targetY = self.me.y;step =1;}
            break;
        case 'U':
            if (self.rollNumber >= 2 && self.squareInfo[self.me.userdata['index'] - 15].squareType === 'path' && self.squareInfo[self.me.userdata['index'] - 1].crossPoint){
                self.targetX = self.me.x;self.targetY = self.me.y - self.cell_height * 2;step = 2;
            } else {self.targetX = self.me.x;self.targetY = self.me.y - self.cell_height;step = 1;}
            break;
        case 'D':
            if (self.rollNumber >= 2 && self.squareInfo[self.me.userdata['index'] + 13].squareType === 'path' && self.squareInfo[self.me.userdata['index'] - 1].crossPoint){
                self.targetX = self.me.x;self.targetY = self.me.y + self.cell_height * 2;step = 2;
            } else {self.targetX = self.me.x;self.targetY = self.me.y + self.cell_height;step = 1;}
            break;
    }
    self.rollNumber -= step;
    self.step = step;
}

/**======================================
 * MOVE TOWARD TARGET POSITION WITH CONST SPEED
 * @param self => GAME OBJECT
 * @param direction =>DIRECTION TO MOVE
 */
function goToTarget(self, direction) {
    switch (direction) {
        case 'R':
            self.me.setVelocity(100,0);
            break;
        case 'L':
            self.me.setVelocity(-100,0);
            break;
        case 'U':
            self.me.setVelocity(0,-100);
            break;
        case 'D':
            self.me.setVelocity(0,100);
    }
    destroyArrows(self);
}

/**======================================
 * STOP MOVING WHEN SPRITE ARRIVES TO TARGET.
 * @param self => GAME OBJECT
 */
function stopMove(self) {
    switch (self.direction) {
        case 'R':
            if (self.me.x >= self.targetX) {
                self.me.setVelocity(0,0);
                self.direction = null;
                resetPositionInCell(self);
                if (self.rollNumber > 0) {
                    self.socket.emit('playerStopped');
                    addArrows(self);
                }else {
                    self.socket.emit('playerMovementCompleted', self.me.userdata.socketId);
                }
            }
            break;
        case 'L':
            if (self.me.x <= self.targetX) {
                self.me.setVelocity(0,0);
                self.direction = null;
                resetPositionInCell(self);
                if (self.rollNumber > 0) {
                    self.socket.emit('playerStopped');
                    addArrows(self);
                }else {
                    self.socket.emit('playerMovementCompleted', self.me.userdata.socketId);
                }
            }
            break;
        case 'U':
            if (self.me.y <= self.targetY) {
                self.me.setVelocity(0,0);
                self.direction = null;
                resetPositionInCell(self);
                if (self.rollNumber > 0) {
                    self.socket.emit('playerStopped');
                    addArrows(self);
                }else {
                    self.socket.emit('playerMovementCompleted', self.me.userdata.socketId);
                }
            }
            break;
        case 'D':
            if (self.me.y >= self.targetY) {
                self.me.setVelocity(0,0);
                self.direction = null;
                resetPositionInCell(self);
                if (self.rollNumber > 0) {
                    self.socket.emit('playerStopped');
                    addArrows(self);
                }else {
                    self.socket.emit('playerMovementCompleted', self.me.userdata.socketId);
                }
            }
            break;
    }
}

/**=======================================
 * CALCULATE COORDINATE FROM GRID INDEX.
 * @param self => GAME OBJECT
 * @param index =>GRID INDEX
 * @returns {Array}
 */
function getCoordinateFromIndex(self, index) {
    var position = [];
    let gridY = Math.ceil(index/7);
    let gridX = index-(gridY-1)*7;
    let cellCenterPixelY = (gridY - 1) * self.cell_height + self.cell_height/2;
    let cellCenterPixelX = (gridX - 1) * self.cell_width + self.cell_width/2;
    position.push(cellCenterPixelX);
    position.push(cellCenterPixelY);
    return position;
}

/**================================
 * RESET THE SPRITES' POSITION WHEN THERE ARE
 * 2 SPRITE IN ONE CELL AND SEPARATING
 * @param self => GAME OBJECT
 */
function resetPositionInCell(self) {
    if (self.me.userdata['index'] === self.otherPlayer.userdata['index']){
        let position = getCoordinateFromIndex(self, self.me.userdata['index']);
        if (self.me.userdata.playerNumber === 1) {
            self.me.setPosition(position[0] - 20, position[1] - 20);
            self.otherPlayer.setPosition(position[0] + 20, position[1] + 20)
        }
        else{
            self.me.setPosition(position[0] + 20, position[1] + 20);
            self.otherPlayer.setPosition(position[0] - 20, position[1] - 20)
        }
    }else {
        let myPosition = getCoordinateFromIndex(self, self.me.userdata['index']);
        let othersPosition = getCoordinateFromIndex(self, self.otherPlayer.userdata['index']);
        self.me.setPosition(myPosition[0], myPosition[1]);
        self.otherPlayer.setPosition(othersPosition[0], othersPosition[1]);
    }
}

/**================================
 * WHEN THE SPRITE'S MOVEMENT COMPLETED , THIS FUNCTION
 * START WORKING. SHOW BUY BUTTON / GET BONUS / LOST /
 * AND SO ON.
 * @param self => GAME OBJECT
 */
function process(self) {
    if (self.me.userdata['index'] === 11 || self.me.userdata['index'] === 39) {
        self.socket.emit('bonus', self.me.userdata.playerId);
    }else if (self.me.userdata['index'] === 23 || self.me.userdata['index'] === 27) {
        self.socket.emit('prison', self.me.userdata.playerId);
    }else if (self.me.userdata['index'] === 25) {
        self.socket.emit('startPoint');
    }
    else {
        if (checkAround(self, 'emptyParcel')) {
            displayBuyButton(self);
        }else if (checkAround(self, 'myParcel')){
            self.socket.emit('stayOwnPlace', self.me.userdata.playerId);
        } else{
            self.socket.emit('payToOther', self.me.userdata.playerId);
        }
    }
}

/**==================================
 * CHECK AROUND IF AROUND IS 'EMPTY' OR 'OWNED'
 * OR 'PATH' / 'PARCEL' .
 * @param self =>GAME OBJECT
 * @param checkItem =>CHECKING INDICATOR
 * @returns {*}
 */
function checkAround(self, checkItem){
    var result;
    switch (checkItem) {
        case 'emptyParcel':
            result = checkEmptyParcel(self);
            break;
        case 'myParcel':
            result = checkMyParcel(self);
    }
    return result;
}

/**====================================
 * CHECK AROUND IF ALL CELLS AROUND IS EMPTY OR NOT.
 * @param self => GAME OBJECT
 * @returns {boolean}
 */
function checkEmptyParcel(self) {
    var result;
    ((self.squareInfo[self.me.userdata['index']].squareType === 'parcel' && self.squareInfo[self.me.userdata['index']].owner === 'For Sale') || (self.squareInfo[self.me.userdata['index'] - 2].squareType === 'parcel' && self.squareInfo[self.me.userdata['index'] - 2].owner === 'For Sale') || (self.squareInfo[self.me.userdata['index'] - 8].squareType === 'parcel' && self.squareInfo[self.me.userdata['index'] - 8].owner === 'For Sale') || (self.squareInfo[self.me.userdata['index'] + 6].squareType === 'parcel' && self.squareInfo[self.me.userdata['index'] + 6].owner === 'For Sale'))?result = true:result = false;
    return result;
}

/**====================================
 * CHECK AROUND IF ANY CELLS BELONG ME EXIST.
 * @param self => GAME OBJECT
 * @returns {boolean}
 */
function checkMyParcel(self) {
    var result;
    (self.squareInfo[self.me.userdata['index']].owner === self.me.userdata.playerId || self.squareInfo[self.me.userdata['index'] - 2].owner === self.me.userdata.playerId || self.squareInfo[self.me.userdata['index'] - 8].owner === self.me.userdata.playerId || self.squareInfo[self.me.userdata['index'] + 6].owner === self.me.userdata.playerId)?result = true:result = false;
    return result;
}

/**====================================
 * DISPLAY BUY BUTTON ON AROUND EMPTY CELL
 * @param self => GAME OBJECT
 */
function displayBuyButton(self) {
    if (self.squareInfo[self.me.userdata['index']].squareType === 'parcel' && self.squareInfo[self.me.userdata['index']].owner === 'For Sale') {
        let position = getCoordinateFromIndex(self, self.me.userdata['index'] + 1);
        self.rightBuyButton = self.physics.add.sprite(position[0],position[1], 'buyButtonRight').setOrigin(0.5, 0.5).setDisplaySize(80, 40);
        self.rightBuyButton.setInteractive();
    }
    if (self.squareInfo[self.me.userdata['index'] - 2].squareType === 'parcel' && self.squareInfo[self.me.userdata['index'] - 2].owner === 'For Sale') {
        let position = getCoordinateFromIndex(self, self.me.userdata['index'] - 1);
        self.leftBuyButton = self.physics.add.sprite(position[0],position[1], 'buyButtonLeft').setOrigin(0.5, 0.5).setDisplaySize(80, 40);
        self.leftBuyButton.setInteractive();
    }
    if (self.squareInfo[self.me.userdata['index'] - 8].squareType === 'parcel' && self.squareInfo[self.me.userdata['index'] - 8].owner === 'For Sale') {
        let position = getCoordinateFromIndex(self, self.me.userdata['index'] - 7);
        self.upBuyButton = self.physics.add.sprite(position[0],position[1], 'buyButtonUp').setOrigin(0.5, 0.5).setDisplaySize(80, 40);
        self.upBuyButton.setInteractive();
    }
    if (self.squareInfo[self.me.userdata['index'] + 6].squareType === 'parcel' && self.squareInfo[self.me.userdata['index'] + 6].owner === 'For Sale') {
        let position = getCoordinateFromIndex(self, self.me.userdata['index'] + 7);
        self.downBuyButton = self.physics.add.sprite(position[0],position[1], 'buyButtonDown').setOrigin(0.5, 0.5).setDisplaySize(80, 40);
        self.downBuyButton.setInteractive();
    }
}

/**====================================
 * HANDLE THE OBJECT CLICK EVENT WHEN PLAYER CLICK
 * THE ARROWS
 * @param key =>ARROW THAT CLICKED
 * @returns {*}
 */
function objectHandler(key) {
    var result;
    switch (key) {
        case 'arrowUp':
            result = 'U';
            break;
        case 'arrowDown':
            result = 'D';
            break;
        case 'arrowRight':
            result = 'R';
            break;
        case 'arrowLeft':
            result = 'L';
            break;
        case 'buyButtonUp':
            result = 'UB';
            break;
        case 'buyButtonDown':
            result = 'DB';
            break;
        case 'buyButtonRight':
            result = 'RB';
            break;
        case 'buyButtonLeft':
            result = 'LB';
            break;
    }
    return result;
}

/**=====================================
 * EMIT BUY EVENT WHEN USER CLICK THE BUY BUTTON
 * @param self => GAME OBJECT
 * @param button => BUTTON THAT CLICKED
 */
function buyParcel(self, button) {
    switch (button) {
        case 'UB':
            self.socket.emit('buy', self.me.userdata['index']-8);
            break;
        case 'DB':
            self.socket.emit('buy', self.me.userdata['index'] + 6);
            break;
        case 'RB':
            self.socket.emit('buy', self.me.userdata['index']);
            break;
        case 'LB':
            self.socket.emit('buy', self.me.userdata['index'] - 2);
            break;
    }
}

/**=====================================
 * UPDATE CELL INFO WHEN OWNERSHIP CHANGED
 * @param self => GAME OBJECT
 * @param data =>DATA INCLUDES INDEX OF CELL THAT OWNERSHIP
 * CHANGED AND SOCKET ID THAT OWNED THIS CELL.
 */
function mapUpdate(self, data) {
    if(self.me.userdata.socketId === data[1]){
        self.squareInfo[data[0]].owner = self.me.userdata.playerId;
    }else {self.squareInfo[data[0]].owner = self.otherPlayer.userdata.playerId;}
    cellRedraw(self, data[0]);
}

/**=====================================
 * REDRAW CELL THAT OWNERSHIP CHANGED
 * @param self => GAME OBJECT
 * @param index =>INDEX OF CELL THAT CHANGED.
 */
function cellRedraw(self, index) {
    var drawColor;
    if (self.squareInfo[index].owner === 'Player1') {
        drawColor = 0x3D6594;
    }else if (self.squareInfo[index].owner === 'Player2') {
        drawColor = 0xC462AF;
    }
    let position = getCoordinateFromIndex(self, index + 1);
    let cellTopRightX = position[0]-self.cell_width/2 +1; // +1: For the cell border width
    let cellTopRightY = position[1] - self.cell_height/2 +1;  // +1 : For the cell border width
    let cellInner_width = self.cell_width-2; // Real draw cell width - cell border width considered.
    let cellInner_height = self.cell_height-2;//Real draw cell height - cell border width considered.
    self.graphics = self.add.graphics({ fillStyle: { color: drawColor } });// Draw color setting.
    self.rect = new Phaser.Geom.Rectangle(cellTopRightX, cellTopRightY, cellInner_width, cellInner_height);
    self.graphics.fillRectShape(self.rect);//Draw cell.
    self.cellId = self.add.text(cellTopRightX+10, cellTopRightY+10, '', { fontSize: '14px', fill: '#000000' });
    self.cellId.setText(index + 1);//Draw text on cell
    self.cellName = self.add.text(cellTopRightX+30, cellTopRightY+30, '', { fontSize: '14px', fill: '#ffffff' });
    self.cellName.setText(this.squareInfo[index].squareName);
    self.cellOwner = self.add.text(cellTopRightX+25, cellTopRightY+50, '', { fontSize: '14px', fill: '#000000' });
    self.cellOwner.setText(this.squareInfo[index].owner);
    self.cellPrice = self.add.text(cellTopRightX+20, cellTopRightY+70, '', { fontSize: '14px', fill: '#000000' });
    self.cellPrice.setText('Price:' + this.squareInfo[index].price + '$');
    self.cellRent = self.add.text(cellTopRightX+25, cellTopRightY+90, '', { fontSize: '14px', fill: '#000000' });
    self.cellRent.setText('Rent:' + this.squareInfo[index].rent + '$');
}

/**=====================================
 * WHEN PLAYER CLICK ANY BUY BUTTON, REMOVE ALL BUY BUTTONS
 * @param self => GAME OBJECT
 */
function destroyBuyButton(self){
    if (self.rightBuyButton) {
        self.rightBuyButton.destroy();
    }
    if (self.leftBuyButton) {
        self.leftBuyButton.destroy();
    }
    if (self.upBuyButton) {
        self.upBuyButton.destroy();
    }
    if (self.downBuyButton) {
        self.downBuyButton.destroy();
    }
}

/**===================================
 * UPDATE EACH SPRITES' BALANCE PROPERTY WHEN IT CHANGED
 * @param self => GAME OBJECT
 * @param data => INCLUDE SOCKET ID AND INDEX FOR MESSAGE
 * DISPLAY
 */
function updateBalance(self, data) {
    if (self.me.userdata.socketId === data[1]) {
        self.me.userdata.balance -= 100;
        displayInfo(self.me.userdata.playerId, self.me.userdata.balance + '$');
        displayMessage('normal', self.me.userdata.playerId + ': Bought ' + self.squareInfo[data[0]].squareName + ' for ' + self.squareInfo[data[0]].price + '$');
    }else if (self.otherPlayer.userdata.socketId === data[1]) {
        self.otherPlayer.userdata.balance -= 100;
        displayInfo(self.otherPlayer.userdata.playerId, self.otherPlayer.userdata.balance + '$');
        displayMessage('normal', self.otherPlayer.userdata.playerId + ': Bought ' + self.squareInfo[data[0]].squareName + ' for ' + self.squareInfo[data[0]].price + '$');
    }
}

/**====================================
 * WHEN PLAYER LAND OTHER'S PARCEL, PAY OTHERS
 * @param self => GAME OBJECT
 * @param playerId => PLAYER'S ID(NOT SOCKET IT, DISPLAYING ID)
 */
function payToOther(self, playerId) {
    if (self.me.userdata.playerId === playerId) {
        self.me.userdata.balance -= 50;
        self.otherPlayer.userdata.balance += 50;
        displayMessage('pay', self.me.userdata.playerId + ': Paid ' + self.otherPlayer.userdata.playerId + ' 50$ for rent' );
    }
    else {
        self.me.userdata.balance += 50;
        self.otherPlayer.userdata.balance -= 50;
        displayMessage('pay', self.otherPlayer.userdata.playerId + ': paid ' + self.me.userdata.playerId + ' 50$ for rent' );
    }
    displayInfo(playerId, self.me.userdata.balance + '$');
    displayInfo(self.otherPlayer.userdata.playerId, self.otherPlayer.userdata.balance + '$');
}

/**=====================================
 * DISPLAY MESSAGE IN THE MESSAGE BOX
 * @param type => MESSAGE TYPE(EX:INCOME, PLAY, NORMAL)
 * @param message => MESSAGE CONTENT.
 */
function displayMessage(type, message) {
    var child;
    let message_box = document.getElementById('message-box');
    switch (type) {
        case 'normal':
            child = document.createElement('div');
            child.setAttribute('class','normal');
            child.innerHTML = message;
            message_box.appendChild(child);
            break;
        case 'income':
            child = document.createElement('div');
            child.setAttribute('class','income');
            child.innerHTML = message;
            message_box.appendChild(child);
            break;
        case 'pay':
            child = document.createElement('div');
            child.setAttribute('class','pay');
            child.innerHTML = message;
            message_box.appendChild(child);
            break;
    }
   message_box.scrollTop = message_box.scrollHeight;
}

/**======================================
 * WHEN ANY EVENT TRIGGERED, DISPLAY THAT INFO ON
 * PANEL.BALANCE, CURRENT TURN, PLAYER NAME, COLOR E.G
 * @param targetId => TARGET HTML ELEMENT'S ID
 * @param info => INFORMATION TO BE DISPLAYED
 */
function displayInfo(targetId, info) {
    var target = document.getElementById(targetId);
    target.innerHTML = info;
}

/**======================================
 * WHEN GAME OVER CONDITION SATISFIED, FINISH THE GAME
 * @param self
 */
function gameOver(self) {
    if (self.me && self.me.userdata.balance<=0){
        alert('Game Over! You are loser!');
    }else if (self.otherPlayer && self.otherPlayer.userdata.balance <= 0) {
        alert('Game Over! You are winner!');
    }
}