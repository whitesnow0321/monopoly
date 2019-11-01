'use strict';
var PhaserGame = function () {
};
PhaserGame.prototype = {
    selectedTile: null, tilesByName: null,
    preload: function () {
        this.load.tilemap('tile_guide', 'sprites/tiles.json', null, Phaser.Tilemap.TILED_JSON);
        this.load.image('tiles', 'sprites/tiles.png');
    },
    create: function () {
        var width = 30;
        var height = 30;
        this.stage.backgroundColor = '#787878';
        this.initTileMap(width, height, this.tileSize);
    },
    update: function () {
        var bgLayer = this.bgLayer;
        var marker = {
            x: bgLayer.getTileX(this.input.activePointer.worldX) * this.tileMap.tileWidth,
            y: bgLayer.getTileY(this.input.activePointer.worldY) * this.tileMap.tileHeight,
        };
        if (this.input.mousePointer.isDown) {
            var tile = this.tileMap.getTile(bgLayer.getTileX(marker.x), bgLayer.getTileY(marker.y));
            if (this.selectedTile !== tile) {
                this.selectedTile = tile;
                this.tileMap.putTile(this.tilesByName.wall, tile.x, tile.y);
            }
        }
    },
    initTileMap: function (width, height, tileSize) {
        var tileMap = this.add.tilemap('tile_guide');        // get the only layer 'tiles_meta'
        var tilesMeta = tileMap.createLayer('tiles_meta');
        var tilesByName = this.getTilesByName(tileMap, tilesMeta);        // remove the tilesMeta layer
        tilesMeta.destroy();
        var bgLayer = tileMap.createBlankLayer('bg', width, height, tileSize, tileSize);
        var tileset = tileMap.addTilesetImage('tiles');        // fill with floor tiles
        tileMap.fill(tilesByName.floor.index, 0, 0, bgLayer.width, bgLayer.height, bgLayer);
        bgLayer.resizeWorld();
        this.tilesByName = tilesByName;
        this.tileMap = tileMap;
        this.bgLayer = bgLayer;
    },
    getTilesByName: function (tileMap, layer) {
        var tilesByName = {};
        tileMap.forEach(function (coords) {
            var tile = tileMap.getTile(coords.x, coords.y, layer);
            var name = tile.properties.name;
            tilesByName[name] = tile;
        }, this, 0, 0, layer.width, layer.height, layer);
        return tilesByName;
    },
};
var game;
(function () {
    var width = 800;
    var height = 600;
    game = new Phaser.Game(width, height, Phaser.AUTO, 'phaser-example', null, false, false);
    game.state.add('Game', PhaserGame, true);
})()﻿