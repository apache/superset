'use strict';

var SyntaxParseError = require('./error').SyntaxParseError;

var TAB = 9;
var N = 10;
var F = 12;
var R = 13;
var SPACE = 32;
var EXCLAMATIONMARK = 33;    // !
var NUMBERSIGN = 35;         // #
var PERCENTSIGN = 37;        // %
var AMPERSAND = 38;          // &
var APOSTROPHE = 39;         // '
var LEFTPARENTHESIS = 40;    // (
var RIGHTPARENTHESIS = 41;   // )
var ASTERISK = 42;           // *
var PLUSSIGN = 43;           // +
var COMMA = 44;              // ,
var SOLIDUS = 47;            // /
var LESSTHANSIGN = 60;       // <
var GREATERTHANSIGN = 62;    // >
var QUESTIONMARK = 63;       // ?
var LEFTSQUAREBRACKET = 91;  // [
var RIGHTSQUAREBRACKET = 93; // ]
var LEFTCURLYBRACKET = 123;  // {
var VERTICALLINE = 124;      // |
var RIGHTCURLYBRACKET = 125; // }
var COMBINATOR_PRECEDENCE = {
    ' ': 1,
    '&&': 2,
    '||': 3,
    '|': 4
};
var MULTIPLIER_DEFAULT = {
    comma: false,
    min: 1,
    max: 1
};
var MULTIPLIER_ZERO_OR_MORE = {
    comma: false,
    min: 0,
    max: 0
};
var MULTIPLIER_ONE_OR_MORE = {
    comma: false,
    min: 1,
    max: 0
};
var MULTIPLIER_ONE_OR_MORE_COMMA_SEPARATED = {
    comma: true,
    min: 1,
    max: 0
};
var MULTIPLIER_ZERO_OR_ONE = {
    comma: false,
    min: 0,
    max: 1
};
var NAME_CHAR = (function() {
    var array = typeof Uint32Array === 'function' ? new Uint32Array(128) : new Array(128);
    for (var i = 0; i < 128; i++) {
        array[i] = /[a-zA-Z0-9\-]/.test(String.fromCharCode(i)) ? 1 : 0;
    }
    return array;
})();

var Tokenizer = function(str) {
    this.str = str;
    this.pos = 0;
};
Tokenizer.prototype = {
    charCode: function() {
        return this.pos < this.str.length ? this.str.charCodeAt(this.pos) : 0;
    },
    nextCharCode: function() {
        return this.pos + 1 < this.str.length ? this.str.charCodeAt(this.pos + 1) : 0;
    },
    substringToPos: function(end) {
        return this.str.substring(this.pos, this.pos = end);
    },
    eat: function(code) {
        if (this.charCode() !== code) {
            error(this, this.pos, 'Expect `' + String.fromCharCode(code) + '`');
        }

        this.pos++;
    }
};

function scanSpaces(tokenizer) {
    var end = tokenizer.pos + 1;

    for (; end < tokenizer.str.length; end++) {
        var code = tokenizer.str.charCodeAt(end);
        if (code !== R && code !== N && code !== F && code !== SPACE && code !== TAB) {
            break;
        }
    }

    return tokenizer.substringToPos(end);
}

function scanWord(tokenizer) {
    var end = tokenizer.pos;

    for (; end < tokenizer.str.length; end++) {
        var code = tokenizer.str.charCodeAt(end);
        if (code >= 128 || NAME_CHAR[code] === 0) {
            break;
        }
    }

    if (tokenizer.pos === end) {
        error(tokenizer, tokenizer.pos, 'Expect a keyword');
    }

    return tokenizer.substringToPos(end);
}

function scanNumber(tokenizer) {
    var end = tokenizer.pos;

    for (; end < tokenizer.str.length; end++) {
        var code = tokenizer.str.charCodeAt(end);
        if (code < 48 || code > 57) {
            break;
        }
    }

    if (tokenizer.pos === end) {
        error(tokenizer, tokenizer.pos, 'Expect a number');
    }

    return tokenizer.substringToPos(end);
}

function scanString(tokenizer) {
    var end = tokenizer.str.indexOf('\'', tokenizer.pos + 1);

    if (end === -1) {
        error(tokenizer, tokenizer.str.length, 'Expect a quote');
    }

    return tokenizer.substringToPos(end + 1);
}

function readMultiplierRange(tokenizer, comma) {
    var min = null;
    var max = null;

    tokenizer.eat(LEFTCURLYBRACKET);

    min = scanNumber(tokenizer);

    if (tokenizer.charCode() === COMMA) {
        tokenizer.pos++;
        if (tokenizer.charCode() !== RIGHTCURLYBRACKET) {
            max = scanNumber(tokenizer);
        }
    } else {
        max = min;
    }

    tokenizer.eat(RIGHTCURLYBRACKET);

    return {
        comma: comma,
        min: Number(min),
        max: max ? Number(max) : 0
    };
}

function readMultiplier(tokenizer) {
    switch (tokenizer.charCode()) {
        case ASTERISK:
            tokenizer.pos++;
            return MULTIPLIER_ZERO_OR_MORE;

        case PLUSSIGN:
            tokenizer.pos++;
            return MULTIPLIER_ONE_OR_MORE;

        case QUESTIONMARK:
            tokenizer.pos++;
            return MULTIPLIER_ZERO_OR_ONE;

        case NUMBERSIGN:
            tokenizer.pos++;

            if (tokenizer.charCode() !== LEFTCURLYBRACKET) {
                return MULTIPLIER_ONE_OR_MORE_COMMA_SEPARATED;
            }

            return readMultiplierRange(tokenizer, true);

        case LEFTCURLYBRACKET:
            return readMultiplierRange(tokenizer, false);
    }

    return MULTIPLIER_DEFAULT;
}

function maybeMultiplied(tokenizer, node) {
    var multiplier = readMultiplier(tokenizer);

    if (multiplier !== MULTIPLIER_DEFAULT) {
        return {
            type: 'Group',
            terms: [node],
            combinator: '|',  // `|` combinator is simplest in implementation (and therefore faster)
            disallowEmpty: false,
            multiplier: multiplier,
            explicit: false
        };
    }

    return node;
}

function readProperty(tokenizer) {
    var name;

    tokenizer.eat(LESSTHANSIGN);
    tokenizer.eat(APOSTROPHE);

    name = scanWord(tokenizer);

    tokenizer.eat(APOSTROPHE);
    tokenizer.eat(GREATERTHANSIGN);

    return maybeMultiplied(tokenizer, {
        type: 'Property',
        name: name
    });
}

function readType(tokenizer) {
    var name;

    tokenizer.eat(LESSTHANSIGN);
    name = scanWord(tokenizer);

    if (tokenizer.charCode() === LEFTPARENTHESIS &&
        tokenizer.nextCharCode() === RIGHTPARENTHESIS) {
        tokenizer.pos += 2;
        name += '()';
    }

    tokenizer.eat(GREATERTHANSIGN);

    return maybeMultiplied(tokenizer, {
        type: 'Type',
        name: name
    });
}

function readKeywordOrFunction(tokenizer) {
    var children = null;
    var name;

    name = scanWord(tokenizer);

    if (tokenizer.charCode() === LEFTPARENTHESIS) {
        tokenizer.pos++;
        children = readImplicitGroup(tokenizer);
        tokenizer.eat(RIGHTPARENTHESIS);

        return maybeMultiplied(tokenizer, {
            type: 'Function',
            name: name,
            children: children
        });
    }

    return maybeMultiplied(tokenizer, {
        type: 'Keyword',
        name: name
    });
}

function regroupTerms(terms, combinators) {
    function createGroup(terms, combinator) {
        return {
            type: 'Group',
            terms: terms,
            combinator: combinator,
            disallowEmpty: false,
            multiplier: MULTIPLIER_DEFAULT,
            explicit: false
        };
    }

    combinators = Object.keys(combinators).sort(function(a, b) {
        return COMBINATOR_PRECEDENCE[a] - COMBINATOR_PRECEDENCE[b];
    });

    while (combinators.length > 0) {
        var combinator = combinators.shift();
        for (var i = 0, subgroupStart = 0; i < terms.length; i++) {
            var term = terms[i];
            if (term.type === 'Combinator') {
                if (term.value === combinator) {
                    if (subgroupStart === -1) {
                        subgroupStart = i - 1;
                    }
                    terms.splice(i, 1);
                    i--;
                } else {
                    if (subgroupStart !== -1 && i - subgroupStart > 1) {
                        terms.splice(
                            subgroupStart,
                            i - subgroupStart,
                            createGroup(terms.slice(subgroupStart, i), combinator)
                        );
                        i = subgroupStart + 1;
                    }
                    subgroupStart = -1;
                }
            }
        }

        if (subgroupStart !== -1 && combinators.length) {
            terms.splice(
                subgroupStart,
                i - subgroupStart,
                createGroup(terms.slice(subgroupStart, i), combinator)
            );
        }
    }

    return combinator;
}

function readImplicitGroup(tokenizer) {
    var terms = [];
    var combinators = {};
    var token;
    var prevToken = null;
    var prevTokenPos = tokenizer.pos;

    while (token = peek(tokenizer)) {
        if (token.type !== 'Spaces') {
            if (token.type === 'Combinator') {
                // check for combinator in group beginning and double combinator sequence
                if (prevToken === null || prevToken.type === 'Combinator') {
                    error(tokenizer, prevTokenPos, 'Unexpected combinator');
                }

                combinators[token.value] = true;
            } else if (prevToken !== null && prevToken.type !== 'Combinator') {
                combinators[' '] = true;  // a b
                terms.push({
                    type: 'Combinator',
                    value: ' '
                });
            }

            terms.push(token);
            prevToken = token;
            prevTokenPos = tokenizer.pos;
        }
    }

    // check for combinator in group ending
    if (prevToken !== null && prevToken.type === 'Combinator') {
        error(tokenizer, tokenizer.pos - prevTokenPos, 'Unexpected combinator');
    }

    return {
        type: 'Group',
        terms: terms,
        combinator: regroupTerms(terms, combinators) || ' ',
        disallowEmpty: false,
        multiplier: MULTIPLIER_DEFAULT,
        explicit: false
    };
}

function readGroup(tokenizer) {
    var result;

    tokenizer.eat(LEFTSQUAREBRACKET);
    result = readImplicitGroup(tokenizer);
    tokenizer.eat(RIGHTSQUAREBRACKET);

    result.explicit = true;
    result.multiplier = readMultiplier(tokenizer);

    if (tokenizer.charCode() === EXCLAMATIONMARK) {
        tokenizer.pos++;
        result.disallowEmpty = true;
    }

    return result;
}

function peek(tokenizer) {
    var code = tokenizer.charCode();

    if (code < 128 && NAME_CHAR[code] === 1) {
        return readKeywordOrFunction(tokenizer);
    }

    switch (code) {
        case LEFTSQUAREBRACKET:
            return readGroup(tokenizer);

        case LESSTHANSIGN:
            if (tokenizer.nextCharCode() === APOSTROPHE) {
                return readProperty(tokenizer);
            } else {
                return readType(tokenizer);
            }

        case VERTICALLINE:
            return {
                type: 'Combinator',
                value: tokenizer.substringToPos(tokenizer.nextCharCode() === VERTICALLINE ? tokenizer.pos + 2 : tokenizer.pos + 1)
            };

        case AMPERSAND:
            tokenizer.pos++;
            tokenizer.eat(AMPERSAND);
            return {
                type: 'Combinator',
                value: '&&'
            };

        case COMMA:
            tokenizer.pos++;
            return {
                type: 'Comma',
                value: ','
            };

        case SOLIDUS:
            tokenizer.pos++;
            return {
                type: 'Slash',
                value: '/'
            };

        case PERCENTSIGN:  // looks like exception, needs for attr()'s <type-or-unit>
            tokenizer.pos++;
            return {
                type: 'Percent',
                value: '%'
            };

        case LEFTPARENTHESIS:
            tokenizer.pos++;
            var children = readImplicitGroup(tokenizer);
            tokenizer.eat(RIGHTPARENTHESIS);

            return {
                type: 'Parentheses',
                children: children
            };

        case APOSTROPHE:
            return {
                type: 'String',
                value: scanString(tokenizer)
            };

        case SPACE:
        case TAB:
        case N:
        case R:
        case F:
            return {
                type: 'Spaces',
                value: scanSpaces(tokenizer)
            };
    }
}

function error(tokenizer, pos, msg) {
    throw new SyntaxParseError(msg || 'Unexpected input', tokenizer.str, pos);
}

function parse(str) {
    var tokenizer = new Tokenizer(str);
    var result = readImplicitGroup(tokenizer);

    if (tokenizer.pos !== str.length) {
        error(tokenizer, tokenizer.pos);
    }

    // reduce redundant groups with single group term
    if (result.terms.length === 1 && result.terms[0].type === 'Group') {
        result = result.terms[0];
    }

    return result;
}

// warm up parse to elimitate code branches that never execute
// fix soft deoptimizations (insufficient type feedback)
parse('[a&&<b>#|<\'c\'>*||e(){2,} f{2} /,(% g#{1,2})]!');

module.exports = parse;
