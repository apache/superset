'use strict';

var createCustomError = require('../utils/createCustomError');
var generateGrammar = require('./grammar/generate');

function getLocation(node, point) {
    var loc = node && node.loc && node.loc[point];

    return loc
        ? { offset: loc.offset,
            line: loc.line,
            column: loc.column }
        : null;
}

var SyntaxReferenceError = function(type, referenceName) {
    var error = createCustomError(
        'SyntaxReferenceError',
        type + (referenceName ? ' `' + referenceName + '`' : '')
    );

    error.reference = referenceName;

    return error;
};

var MatchError = function(message, lexer, syntax, value, badNode) {
    var error = createCustomError('SyntaxMatchError', message);
    var errorOffset = -1;
    var start = getLocation(badNode, 'start');
    var end = getLocation(badNode, 'end');
    var css = lexer.syntax.generate(value, {
        decorator: function(handlers) {
            var bufferOffset = 0;

            var handlersChunk = handlers.chunk;
            handlers.chunk = function(chunk) {
                bufferOffset += chunk.length;
                handlersChunk(chunk);
            };

            var handlersNode = handlers.node;
            handlers.node = function(node) {
                if (node === badNode) {
                    errorOffset = bufferOffset;
                }

                handlersNode.call(this, node);
            };

            return handlers;
        }
    });

    if (errorOffset === -1) {
        errorOffset = css.length;
    }

    error.rawMessage = message;
    error.syntax = syntax ? generateGrammar(syntax) : '<generic>';
    error.css = css;
    error.mismatchOffset = errorOffset;
    error.loc = {
        source: badNode && badNode.loc && badNode.loc.source || '<unknown>',
        start: start,
        end: end
    };
    error.line = start ? start.line : undefined;
    error.column = start ? start.column : undefined;
    error.offset = start ? start.offset : undefined;
    error.message = message + '\n' +
        '  syntax: ' + error.syntax + '\n' +
        '   value: ' + (error.css || '<empty string>') + '\n' +
        '  --------' + new Array(error.mismatchOffset + 1).join('-') + '^';

    return error;
};

module.exports = {
    SyntaxReferenceError: SyntaxReferenceError,
    MatchError: MatchError
};
