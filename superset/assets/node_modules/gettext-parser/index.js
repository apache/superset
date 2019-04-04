'use strict';

var poParser = require('./lib/poparser');

module.exports = {
    po: {
        parse: poParser.parse,
        createParseStream: poParser.stream,
        compile: require('./lib/pocompiler')
    },

    mo: {
        parse: require('./lib/moparser'),
        compile: require('./lib/mocompiler')
    }
};