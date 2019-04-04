'use strict';
var test = require('tape').test;

var Point = require('./');

test('Point', function(t) {
    t.test('.convert', function(t) {
        t.equal(Point.convert(new Point(20, 30)).equals(new Point(20, 30)), true);
        t.equal(Point.convert([20, 30]).equals(new Point(20, 30)), true);
        t.equal(Point.convert('somestring'), 'somestring');
        t.end();
    });
    t.test('vector operations', function(t) {
        t.test('#mag', function(t) {
            t.test('gets the magnitude of a vector', function() {
                t.equal(new Point(0, 2).mag(), 2);
                t.equal(new Point(0, 0).mag(), 0);
                t.equal(new Point(10, 0).mag(), 10);
                t.end();
            });
        });
        t.test('#unit', function(t) {
            t.test('calculates the unit vector', function() {
                t.deepEqual(new Point(0, 1000).unit(), new Point(0, 1));
                t.end();
            });
        });
        t.test('#equals', function(t) {
            t.equals((new Point(0, 0).equals(new Point(0, 0))), true, 'equal');
            t.equals((new Point(0, 0).equals(new Point(0, 10))), false, 'not equal');
            t.end();
        });
        t.test('#dist', function(t) {
            t.equals((new Point(0, 10).dist(new Point(0, 0))), 10);
            t.equals((new Point(Math.sqrt(2), Math.sqrt(2)).dist(new Point(0, 0))), 2);
            t.equals((new Point(0, 0).dist(new Point(0, 0))), 0);
            t.end();
        });
        t.test('#mult', function(t) {
            t.equals((new Point(0, 0).mult(5)).equals(new Point(0, 0)), true);
            t.equals((new Point(0, 1).mult(5)).equals(new Point(0, 5)), true);
            t.equals((new Point(1, 1).mult(5)).equals(new Point(5, 5)), true);
            t.end();
        });
        t.test('#div', function(t) {
            t.equals((new Point(0, 0).div(5)).equals(new Point(0, 0)), true);
            t.equals((new Point(0, 1).div(5)).equals(new Point(0, 1/5)), true);
            t.equals((new Point(1, 1).div(5)).equals(new Point(1/5, 1/5)), true);
            t.end();
        });
        t.test('#multByPoint', function(t) {
            t.equals((new Point(0, 0).multByPoint(new Point(5,5))).equals(new Point(0, 0)), true);
            t.equals((new Point(0, 1).multByPoint(new Point(5,5))).equals(new Point(0, 5)), true);
            t.equals((new Point(1, 1).multByPoint(new Point(4,5))).equals(new Point(4, 5)), true);
            t.end();
        });
        t.test('#divByPoint', function(t) {
            t.equals((new Point(0, 0).divByPoint(new Point(5,5))).equals(new Point(0, 0)), true);
            t.equals((new Point(0, 1).divByPoint(new Point(5,5))).equals(new Point(0, 1/5)), true);
            t.equals((new Point(1, 1).divByPoint(new Point(4,5))).equals(new Point(1/4, 1/5)), true);
            t.end();
        });
        t.test('#rotate', function(t) {
            t.equals((new Point(0, 0).rotate(0)).equals(new Point(0, 0)), true);
            t.deepEquals((new Point(0, 1).rotate(Math.PI/2)).round(), new Point(-1, 0));
            t.deepEquals((new Point(0, 1).rotate(Math.PI)).round(), new Point(0, -1));
            t.end();
        });
        t.test('#rotateAround', function(t) {
            t.deepEquals((new Point(2, 3).rotateAround(Math.PI/2, new Point(2,2))).round(), new Point(1, 2));
            t.deepEquals((new Point(2, 3).rotateAround(Math.PI, new Point(2,2))).round(), new Point(2, 1));
            t.end();
        });
        t.test('#round', function(t) {
            t.equals((new Point(0, 0).round()).equals(new Point(0, 0)), true);
            t.equals((new Point(0, 0.5).round()).equals(new Point(0, 1)), true);
            t.equals((new Point(0.2, 0.2).round()).equals(new Point(0, 0)), true);
            t.end();
        });
        t.test('#angle', function(t) {
            t.equals((new Point(0, 0).angle()), 0);
            t.equals((new Point(10, 10).angle()), Math.PI / 4);
            t.equals((new Point(0, 10).angle()), Math.PI / 2);
            t.equals((new Point(10, 0).angle()), 0);
            t.end();
        });
        t.test('#angleTo', function(t) {
            var b = new Point(0, 0);
            t.equals((new Point(0, 0).angleTo(b)), 0);
            t.equals((new Point(10, 10).angleTo(b)), Math.PI / 4);
            t.equals((new Point(0, 10).angleTo(b)), Math.PI / 2);
            t.equals((new Point(10, 0).angleTo(b)), 0);
            t.end();
        });
        t.test('#angleWith', function(t) {
            var b = new Point(0, 0);
            t.equals((new Point(0, 0).angleWith(b)), 0);
            t.equals((new Point(10, 10).angleWith(b)), 0);
            t.equals((new Point(0, 10).angleWith(b)), 0);
            t.equals((new Point(10, 0).angleWith(b)), 0);
            t.end();
        });
        t.test('#angleWithSep', function(t) {
            t.equals((new Point(0, 0).angleWithSep(0, 0)), 0);
            t.equals((new Point(10, 10).angleWithSep(0, 0)), 0);
            t.equals((new Point(0, 10).angleWithSep(0, 0)), 0);
            t.equals((new Point(10, 0).angleWithSep(0, 0)), 0);
            t.end();
        });
        t.test('#matMult', function(t) {
            t.equals((new Point(0, 0).matMult([0, 0, 0, 0])).equals(new Point(0, 0)), true);
            t.deepEquals((new Point(1, 1).matMult([0, 0, 0, 0])), new Point(0, 0));
            t.deepEquals((new Point(1, 1).matMult([1, 0, 1, 0])), new Point(1, 1));
            t.deepEquals((new Point(1, 1).matMult([1, 0, 0, 0])), new Point(1, 0));
            t.deepEquals((new Point(1, 1).matMult([0, 0, 1, 0])), new Point(0, 1));
            t.deepEquals((new Point(1, 1).matMult([0, 0, 1, 2])), new Point(0, 3));
            t.deepEquals((new Point(1, 1).matMult([1, 1, 1, 1])), new Point(2, 2));
            t.end();
        });
        t.test('#perp', function(t) {
            t.test('calculates a vector perpendicular to the given vector', function() {
                t.deepEqual(new Point(0, 1000).perp(), new Point(-1000, 0));
                t.end();
            });
        });
        t.test('#add', function(t) {
            t.test('adds two vectors', function() {
                t.deepEqual(new Point(0, 0).add(new Point(10, 10)), new Point(10, 10));
                t.end();
            });
        });
        t.test('#sub', function(t) {
            t.test('adds subtracts a vector from another', function() {
                t.deepEqual(new Point(0, 0).sub(new Point(10, 10)), new Point(-10, -10));
                t.end();
            });
        });
    });
});
