'use strict';

var runStats = require('tile-stats-runner');
var Tile = require('./vector_tile').Tile;
var Pbf = require('../');

var ids = 'mapbox.mapbox-streets-v7';
var token = 'pk.eyJ1IjoicmVkdWNlciIsImEiOiJrS3k2czVJIn0.CjwU0V9fO4FAf3ukyV4eqQ';
var url = 'https://b.tiles.mapbox.com/v4/' + ids + '/{z}/{x}/{y}.vector.pbf?access_token=' + token;

var readTime = 0;
var writeTime = 0;
var size = 0;
var numTiles = 0;

runStats(url, processTile, showStats, {
    width: 2880,
    height: 1800,
    minZoom: 0,
    maxZoom: 16,
    center: [-77.032751, 38.912792]
});

function processTile(body) {
    size += body.length;
    numTiles++;

    var now = clock();
    var tile = Tile.read(new Pbf(body));
    readTime += clock(now);

    now = clock();
    var pbf = new Pbf();
    Tile.write(tile, pbf);
    var buf = pbf.finish();
    writeTime += clock(now);

    console.assert(buf);
}

function showStats() {
    console.log('%d tiles, %d KB total', numTiles, Math.round(size / 1024));
    console.log('read time: %dms, or %d MB/s', Math.round(readTime), speed(readTime, size));
    console.log('write time: %dms, or %d MB/s', Math.round(writeTime), speed(writeTime, size));
}

function speed(time, size) {
    return Math.round((size / (1 << 20)) / (time / 1000));
}

function clock(start) {
    if (!start) return process.hrtime();
    var t = process.hrtime(start);
    return t[0] * 1e3 + t[1] * 1e-6;
}

