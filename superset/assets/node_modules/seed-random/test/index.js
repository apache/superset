'use strict';

var assert = require('assert');
var seed = require('../');

var trueRandomA = seed();
var trueRandomB = seed();
assert(trueRandomA() != trueRandomB());

var fakeRandomA = seed('foo');
var fakeRandomB = seed('foo');
assert(fakeRandomA() == fakeRandomB());

var fakeRandomC = seed('foo', {entropy: true});
var fakeRandomD = seed('foo', {entropy: true});
assert(fakeRandomC() != fakeRandomD());


seed('foo', {global: true});//over-ride global Math.random
var numA = Math.random();
seed('foo', {global: true});
var numB = Math.random();
assert(numA == numB);//always true

seed.resetGlobal();//reset to default Math.random

console.log('All Tests Passed');