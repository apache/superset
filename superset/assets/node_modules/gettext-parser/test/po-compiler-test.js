'use strict';

var chai = require('chai');
var gettextParser = require('..');
var fs = require('fs');

var expect = chai.expect;
chai.config.includeStack = true;

describe('PO Compiler', function() {

    describe('UTF-8', function() {
        it('should compile', function() {
            var json = JSON.parse(fs.readFileSync(__dirname + '/fixtures/utf8-po.json', 'utf-8'));
            var po = fs.readFileSync(__dirname + '/fixtures/utf8.po');

            var compiled = gettextParser.po.compile(json);
            expect(compiled).to.deep.equal(po);
        });
    });

    describe('Latin-13', function() {
        it('should compile', function() {
            var json = JSON.parse(fs.readFileSync(__dirname + '/fixtures/latin13-po.json', 'utf-8'));
            var po = fs.readFileSync(__dirname + '/fixtures/latin13.po');
            var compiled = gettextParser.po.compile(json);
            expect(compiled).to.deep.equal(po);
        });
    });
});