'use strict';

var chai = require('chai');
var sharedFuncs = require('../lib/shared');

var expect = chai.expect;
chai.config.includeStack = true;

describe('Folding tests', function() {

    it('Short line, no folding', function() {
        var line = 'abc def ghi';
        var folded = sharedFuncs.foldLine(line);

        expect(line).to.equal(folded.join(''));
        expect(folded.length).to.equal(1);
    });

    it('Short line, force fold with newline', function() {
        var line = 'abc \\ndef \\nghi';
        var folded = sharedFuncs.foldLine(line);

        expect(line).to.equal(folded.join(''));
        expect(folded).to.deep.equal(['abc \\n', 'def \\n', 'ghi']);
    });

    it('Long line', function() {
        var expected = ['Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum pretium ',
            'a nunc ac fringilla. Nulla laoreet tincidunt tincidunt. Proin tristique ',
            'vestibulum mauris non aliquam. Vivamus volutpat odio nisl, sed placerat ',
            'turpis sodales a. Vestibulum quis lectus ac elit sagittis sodales ac a ',
            'felis. Nulla iaculis, nisl ut mattis fringilla, tortor quam tincidunt ',
            'lorem, quis feugiat purus felis ut velit. Donec euismod eros ut leo ',
            'lobortis tristique.'
        ];
        var folded = sharedFuncs.foldLine(expected.join(''));
        expect(folded).to.deep.equal(expected);
    });

});