var assert = require('assert');

var DRange = require('../index.js');

describe('add sets', function() {
    it('should allow adding numbers', function () {
        var drange = DRange(5);
        assert.equal('[ 5 ]', drange.toString());
        drange.add(6);
        assert.equal('[ 5-6 ]', drange.toString());
        drange.add(8);
        assert.equal('[ 5-6, 8 ]', drange.toString());
        drange.add(7);
        assert.equal('[ 5-8 ]', drange.toString());
        assert.equal(drange.length, 4);
    });
    it('should allow adding ranges of numbers', function () {
        var drange = DRange(1,5);
        assert.equal('[ 1-5 ]', drange.toString());
        drange.add(6,10);
        assert.equal('[ 1-10 ]', drange.toString());
        drange.add(15,20);
        assert.equal('[ 1-10, 15-20 ]', drange.toString());
        drange.add(0,14);
        assert.equal('[ 0-20 ]', drange.toString());
        assert.equal(drange.length, 21);
    });
    it('should allow adding another DiscontinuousRange', function () {
        var drange = DRange(1,5);
        drange.add(15,20);
        var erange = DRange(6);
        erange.add(17, 30);
        drange.add(erange);
        assert.equal('[ 1-6, 15-30 ]', drange.toString());
        assert.equal(drange.length, 22);
    });
});

describe('subtract sets', function() {
    it('should allow subtracting numbers', function () {
        var drange = DRange(1, 10);
        drange.subtract(5);
        assert.equal('[ 1-4, 6-10 ]', drange.toString());
        drange.subtract(7);
        assert.equal('[ 1-4, 6, 8-10 ]', drange.toString());
        drange.subtract(6);
        assert.equal('[ 1-4, 8-10 ]', drange.toString());
        assert.equal(drange.length, 7);
    });
    it('should allow subtracting ranges of numbers', function () {
        var drange = DRange(1, 100);
        drange.subtract(5, 15);
        assert.equal('[ 1-4, 16-100 ]', drange.toString());
        drange.subtract(90, 200);
        assert.equal('[ 1-4, 16-89 ]', drange.toString());
        assert.equal(drange.length, 78);
    });
    it('should allow subtracting another DiscontinuousRange', function () {
        var drange = DRange(0,100);
        var erange = DRange(6);
        erange.add(17, 30);
        drange.subtract(erange);
        assert.equal('[ 0-5, 7-16, 31-100 ]', drange.toString());
        assert.equal(drange.length, 86);
    });
});


describe('index sets', function() {
    it('should appropriately retrieve numbers in range by index', function () {
        var drange = DRange(0, 9);
        drange.add(20, 29);
        drange.add(40, 49);
        assert.equal(drange.index(5), 5);
        assert.equal(drange.index(15), 25);
        assert.equal(drange.index(25), 45);
        assert.equal(drange.length, 30);
    });
});

describe('clone sets', function() {
    it('should be able to clone a DiscontinuousRange that doesn\'t affect the original', function () {
        var drange = DRange(0, 9);
        var erange = drange.clone();
        erange.subtract(5);
        assert.equal('[ 0-9 ]', drange.toString());
        assert.equal('[ 0-4, 6-9 ]', erange.toString());
    });
});

var all_numbers = new DRange(1, 100);
var bad_numbers = DRange(13).add(8).add(60,80);
var good_numbers = all_numbers.clone().subtract(bad_numbers);
console.log(good_numbers.toString());
var random_good_number = good_numbers.index(Math.floor(Math.random() * good_numbers.length));
console.log(random_good_number);
