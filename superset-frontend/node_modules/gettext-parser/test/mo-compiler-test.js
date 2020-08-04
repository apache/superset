'use strict';

var chai = require('chai');
var gettextParser = require('..');
var fs = require('fs');

var expect = chai.expect;
chai.config.includeStack = true;

describe('MO Compiler', function() {

    describe('UTF-8', function() {
        it('should compile', function() {
            var json = JSON.parse(fs.readFileSync(__dirname + '/fixtures/utf8-mo.json', 'utf-8'));
            var mo = fs.readFileSync(__dirname + '/fixtures/utf8.mo');

            var compiled = gettextParser.mo.compile(json);
            expect(compiled).to.deep.equal(mo);
        });
    });

    describe('Latin-13', function() {
        it('should compile', function() {
            var json = JSON.parse(fs.readFileSync(__dirname + '/fixtures/latin13-mo.json', 'utf-8'));
            var mo = fs.readFileSync(__dirname + '/fixtures/latin13.mo');
            var compiled = gettextParser.mo.compile(json);
            expect(compiled).to.deep.equal(mo);
        });
    });
});