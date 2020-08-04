'use strict';

require('core-js');

var inspect = require('./');
var test = require('tape');

test('Maps', function (t) {
    t.equal(inspect(new Map([[1, 2]])), 'Map (1) {1 => 2}');
    t.end();
});

test('Sets', function (t) {
    t.equal(inspect(new Set([[1, 2]])), 'Set (1) {[ 1, 2 ]}');
    t.end();
});
