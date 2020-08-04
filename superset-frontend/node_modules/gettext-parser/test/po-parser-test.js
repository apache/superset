'use strict';

var chai = require('chai');
var gettextParser = require('..');
var fs = require('fs');

var expect = chai.expect;
chai.config.includeStack = true;

describe('PO Parser', function() {

    describe('UTF-8', function() {
        it('should parse', function() {
            var po = fs.readFileSync(__dirname + '/fixtures/utf8.po');
            var json = JSON.parse(fs.readFileSync(__dirname + '/fixtures/utf8-po.json', 'utf-8'));
            var parsed = gettextParser.po.parse(po);
            expect(parsed).to.deep.equal(json);
        });
    });

    describe('UTF-8 as a string', function() {
        it('should parse', function() {
            var po = fs.readFileSync(__dirname + '/fixtures/utf8.po', 'utf-8');
            var json = JSON.parse(fs.readFileSync(__dirname + '/fixtures/utf8-po.json', 'utf-8'));
            var parsed = gettextParser.po.parse(po);
            expect(parsed).to.deep.equal(json);
        });
    });

    describe('Stream input', function() {
        it('should parse', function(done) {
            var po = fs.createReadStream(__dirname + '/fixtures/utf8.po', {
                highWaterMark: 1 // ensure that any utf-8 sequences will be broken when streaming
            });
            var json = JSON.parse(fs.readFileSync(__dirname + '/fixtures/utf8-po.json', 'utf-8'));

            var parsed;
            var stream = po.pipe(gettextParser.po.createParseStream({
                initialTreshold: 800 // home many bytes to cache for parsing the header
            }));
            stream.on('data', function(data) {
                parsed = data;
            });
            stream.on('end', function() {
                expect(parsed).to.deep.equal(json);
                done();
            });

        });
    });

    describe('Latin-13', function() {
        it('should parse', function() {
            var po = fs.readFileSync(__dirname + '/fixtures/latin13.po');
            var json = JSON.parse(fs.readFileSync(__dirname + '/fixtures/latin13-po.json', 'utf-8'));
            var parsed = gettextParser.po.parse(po);
            expect(parsed).to.deep.equal(json);
        });
    });

});