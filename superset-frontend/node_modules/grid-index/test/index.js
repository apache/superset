'use strict';

var GridIndex = require('../grid-index');

var test = require('tap').test;

test('GridIndex', function(t) {

    t.test('indexes features', function(t) {
        var grid = new GridIndex(100, 4, 1);
        grid.insert(0, 4, 10, 6, 30);
        grid.insert(1, 4, 10, 30, 12);
        grid.insert(2, -10, 30, -5, 35);

        t.deepEqual(grid.query(4, 10, 5, 11).sort(), [0, 1]);
        t.deepEqual(grid.query(24, 10, 25, 11).sort(), [1]);
        t.deepEqual(grid.query(40, 40, 100, 100), []);
        t.deepEqual(grid.query(-6, 0, -7, 100), [2]);
        t.deepEqual(grid.query(-Infinity, -Infinity, Infinity, Infinity).sort(), [0, 1, 2]);
        t.end();
    });

    t.test('returns multiple copies of a key if multiple boxes were inserted with the same key', function(t) {
        var grid = new GridIndex(100, 4, 0);
        var key = 123;
        grid.insert(key, 3, 3, 4, 4);
        grid.insert(key, 13, 13, 14, 14);
        grid.insert(key, 23, 23, 24, 24);
        t.deepEqual(grid.query(0, 0, 30, 30), [key, key, key]);
        t.end();
    });

    t.test('serializing to an arraybuffer', function(t) {
        var originalGrid  = new GridIndex(100, 4, 1);
        originalGrid.insert(0, 4, 10, 6, 30);
        originalGrid.insert(1, 4, 10, 30, 12);
        originalGrid.insert(2, -10, 30, -5, 35);

        var arrayBuffer = originalGrid.toArrayBuffer();
        var grid = new GridIndex(arrayBuffer);

        t.deepEqual(grid.query(4, 10, 5, 11).sort(), [0, 1]);
        t.deepEqual(grid.query(24, 10, 25, 11).sort(), [1]);
        t.deepEqual(grid.query(40, 40, 100, 100), []);
        t.deepEqual(grid.query(-6, 0, -7, 100), [2]);
        t.deepEqual(grid.query(-Infinity, -Infinity, Infinity, Infinity).sort(), [0, 1, 2]);

        var exception = null;
        try {
            t.insert(3, 0, 0, 0, 0);
        } catch(e) {
            exception = e;
        }

        t.notEqual(exception, null);
        t.end();
    });

    t.end();
});
