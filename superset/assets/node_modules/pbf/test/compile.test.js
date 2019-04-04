'use strict';

var fs = require('fs');
var path = require('path');
var test = require('tap').test;
var resolve = require('resolve-protobuf-schema').sync;

var Pbf = require('../');
var compile = require('../compile');

test('compiles vector tile proto', function(t) {
    var proto = resolve(path.join(__dirname, '../bench/vector_tile.proto'));
    var tileBuf = fs.readFileSync(path.join(__dirname, 'fixtures/12665.vector.pbf'));
    var Tile = compile(proto).Tile;

    var tile = Tile.read(new Pbf(tileBuf));
    t.equal(tile.layers.length, 11);

    var pbf = new Pbf();
    Tile.write(tile, pbf);
    var buf = pbf.finish();
    t.equal(buf.length, 124946);

    t.end();
});

test('compiles proto with embedded type reference', function(t) {
    var proto = resolve(path.join(__dirname, './fixtures/embedded_type.proto'));
    compile(proto);

    t.end();
});

test('compiles packed proto', function(t) {
    var proto = resolve(path.join(__dirname, './fixtures/packed.proto'));
    var NotPacked = compile(proto).NotPacked;
    var FalsePacked = compile(proto).FalsePacked;

    var original = {
        types: [0, 1, 0, 1],
        value: [300, 400, 500]
    };
    var pbf = new Pbf();
    NotPacked.write(original, pbf);
    var buf = pbf.finish();

    var decompressed = FalsePacked.read(new Pbf(buf));
    t.equals(buf.length, 17);
    t.deepEqual(original, decompressed);

    t.end();
});

test('compiles packed proto3', function(t) {
    var proto = resolve(path.join(__dirname, './fixtures/packed_proto3.proto'));
    var NotPacked = compile(proto).NotPacked;
    var FalsePacked = compile(proto).FalsePacked;

    var original = {
        types: [0, 1, 0, 1],
        value: [300, 400, 500]
    };
    var pbf = new Pbf();
    NotPacked.write(original, pbf);
    var buf = pbf.finish();

    var decompressed = FalsePacked.read(new Pbf(buf));
    t.equals(buf.length, 14);
    t.deepEqual(original, decompressed);

    t.end();
});

test('compiles packed with multi-byte tags', function(t) {
    var proto = resolve(path.join(__dirname, './fixtures/packed_proto3.proto'));
    var Packed = compile(proto).Packed;

    var original = {
        value: [300, 400, 500]
    };
    var pbf = new Pbf();
    Packed.write(original, pbf);
    var buf = pbf.finish();

    var decompressed = Packed.read(new Pbf(buf));
    t.equals(buf.length, 9);
    t.deepEqual(original, decompressed);

    t.end();
});

test('compiles defaults', function(t) {
    var proto = resolve(path.join(__dirname, './fixtures/defaults.proto'));
    var Envelope = compile(proto).Envelope;
    var pbf = new Pbf();

    Envelope.write({}, pbf);

    var buf = pbf.finish();
    var data = Envelope.read(new Pbf(buf));

    t.equals(buf.length, 0);
    t.deepEqual(data, {
        type: 1,
        name: 'test',
        flag: true,
        weight: 1.5,
        id: 1
    });

    t.end();
});

test('compiles proto3 ignoring defaults', function(t) {
    var proto = resolve(path.join(__dirname, './fixtures/defaults_proto3.proto'));
    var Envelope = compile(proto).Envelope;
    var pbf = new Pbf();

    Envelope.write({}, pbf);

    var buf = pbf.finish();
    var data = Envelope.read(new Pbf(buf));

    t.equals(buf.length, 0);

    t.equals(data.type, 0);
    t.equals(data.name, '');
    t.equals(data.flag, false);
    t.equals(data.weight, 0);
    t.equals(data.id, 0);

    t.end();
});

test('compiles maps', function(t) {
    var proto = resolve(path.join(__dirname, './fixtures/map.proto'));
    var Envelope = compile(proto).Envelope;

    var original = {
        kv : {
            a: 'value a',
            b: 'value b'
        },
        kn : {
            a : 1,
            b : 2
        }
    };

    var pbf = new Pbf();
    Envelope.write(original, pbf);
    var buf = pbf.finish();

    var decompressed = Envelope.read(new Pbf(buf));

    t.deepEqual(original, decompressed);

    t.end();
});

test('does not write undefined or null values', function(t) {
    var proto = resolve(path.join(__dirname, './fixtures/embedded_type.proto'));
    var EmbeddedType = compile(proto).EmbeddedType;
    var pbf = new Pbf();

    EmbeddedType.write({}, pbf);

    EmbeddedType.write({
        'sub_field': null
    }, pbf);

    EmbeddedType.write({
        value: null
    });

    t.end();
});

test('handles all implicit default values', function(t) {
    var proto = resolve(path.join(__dirname, './fixtures/defaults_implicit.proto'));
    var Envelope = compile(proto).Envelope;
    var pbf = new Pbf();

    Envelope.write({}, pbf);
    var buf = pbf.finish();
    var data = Envelope.read(new Pbf(buf));

    t.equals(buf.length, 0);

    t.equals(data.type, 0);
    t.equals(data.name, '');
    t.equals(data.flag, false);
    t.equals(data.weight, 0);
    t.equals(data.id, 0);
    t.deepEqual(data.tags, []);
    t.deepEqual(data.numbers, []);
    t.equals(data.bytes, null);
    t.equals(data.custom, null);
    t.deepEqual(data.types, []);

    t.end();
});

test('sets oneof field name', function(t) {
    var proto = resolve(path.join(__dirname, './fixtures/oneof.proto'));
    var Envelope = compile(proto).Envelope;
    var pbf = new Pbf();

    Envelope.write({}, pbf);
    var data = Envelope.read(new Pbf(pbf.finish()));

    t.equals(data.value, null);
    t.equals(data.id, 0);

    pbf = new Pbf();
    Envelope.write({
        float: 1.5
    }, pbf);
    data = Envelope.read(new Pbf(pbf.finish()));

    t.equals(data.value, 'float');
    t.equals(data[data.value], 1.5);

    t.end();
});

test('handles negative varint', function(t) {
    var proto = resolve(path.join(__dirname, './fixtures/varint.proto'));
    var Envelope = compile(proto).Envelope;
    var pbf = new Pbf();

    Envelope.write({
        int: -5,
        long: -10
    }, pbf);

    var buf = pbf.finish();
    var data = Envelope.read(new Pbf(buf));

    t.equals(data.int, -5);
    t.equals(data.long, -10);

    t.end();
});

test('handles unsigned varint', function(t) {
    var proto = resolve(path.join(__dirname, './fixtures/varint.proto'));
    var Envelope = compile(proto).Envelope;
    var pbf = new Pbf();

    Envelope.write({
        uint: Math.pow(2, 31),
        ulong: Math.pow(2, 63)
    }, pbf);

    var buf = pbf.finish();
    var data = Envelope.read(new Pbf(buf));

    t.equals(data.uint, Math.pow(2, 31));
    t.equals(data.ulong, Math.pow(2, 63));

    t.end();
});
