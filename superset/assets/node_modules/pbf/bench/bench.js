'use strict';

var Benchmark = require('benchmark'),
    fs = require('fs'),
    protobuf = require('protocol-buffers'),
    vt = require('./vector_tile'),
    Pbf = require('../'),
    readTile = vt.Tile.read,
    writeTile = vt.Tile.write;

var Tile = protobuf(fs.readFileSync(__dirname + '/vector_tile.proto')).Tile,
    data = fs.readFileSync(__dirname + '/../test/fixtures/12665.vector.pbf'),
    suite = new Benchmark.Suite();

var tile = readTile(new Pbf(data)),
    tileJSON = JSON.stringify(tile),
    tile2 = Tile.decode(data);

writeTile(tile, new Pbf());

suite
.add('decode vector tile with pbf', function() {
    readTile(new Pbf(data));
})
.add('encode vector tile with pbf', function() {
    var pbf = new Pbf();
    writeTile(tile, pbf);
    pbf.finish();
})
.add('decode vector tile with protocol-buffers', function() {
    Tile.decode(data);
})
.add('encode vector tile with protocol-buffers', function() {
    Tile.encode(tile2);
})
.add('JSON.parse vector tile', function() {
    JSON.parse(tileJSON);
})
.add('JSON.stringify vector tile', function() {
    JSON.stringify(tile);
})
.on('cycle', function(event) {
    console.log(String(event.target));
})
.run();
