'use strict';

var chai = require('chai');
var gettextParser = require('..');
var fs = require('fs');

var expect = chai.expect;
chai.config.includeStack = true;

describe('MO Parser', function() {

    describe('UTF-8', function() {
        it('should parse', function() {
            var mo = fs.readFileSync(__dirname + '/fixtures/utf8.mo');
            var json = JSON.parse(fs.readFileSync(__dirname + '/fixtures/utf8-mo.json', 'utf-8'));
            var parsed = gettextParser.mo.parse(mo);
            expect(parsed).to.deep.equal(json);
        });
    });

    describe('Latin-13', function() {
        it('should parse', function() {
            var mo = fs.readFileSync(__dirname + '/fixtures/latin13.mo');
            var json = JSON.parse(fs.readFileSync(__dirname + '/fixtures/latin13-mo.json', 'utf-8'));
            var parsed = gettextParser.mo.parse(mo);
            expect(parsed).to.deep.equal(json);
        });
    });
});