'use strict';

var names = require('../utils/names');
var MULTIPLIER_DEFAULT = {
    comma: false,
    min: 1,
    max: 1
};

function skipSpaces(node) {
    while (node !== null && (node.data.type === 'WhiteSpace' || node.data.type === 'Comment')) {
        node = node.next;
    }

    return node;
}

function putResult(buffer, match) {
    var type = match.type || match.syntax.type;

    // ignore groups
    if (type === 'Group') {
        buffer.push.apply(buffer, match.match);
    } else {
        buffer.push(match);
    }
}

function matchToJSON() {
    return {
        type: this.syntax.type,
        name: this.syntax.name,
        match: this.match,
        node: this.node
    };
}

function buildMatchNode(badNode, lastNode, next, match) {
    if (badNode) {
        return {
            badNode: badNode,
            lastNode: null,
            next: null,
            match: null
        };
    }

    return {
        badNode: null,
        lastNode: lastNode,
        next: next,
        match: match
    };
}

function matchGroup(lexer, syntaxNode, node) {
    var result = [];
    var buffer;
    var multiplier = syntaxNode.multiplier || MULTIPLIER_DEFAULT;
    var min = multiplier.min;
    var max = multiplier.max === 0 ? Infinity : multiplier.max;
    var lastCommaTermCount;
    var lastComma;
    var matchCount = 0;
    var lastNode = null;
    var badNode = null;

    mismatch:
    while (matchCount < max) {
        node = skipSpaces(node);
        buffer = [];

        switch (syntaxNode.combinator) {
            case '|':
                for (var i = 0; i < syntaxNode.terms.length; i++) {
                    var term = syntaxNode.terms[i];
                    var res = matchSyntax(lexer, term, node);

                    if (res.match) {
                        putResult(buffer, res.match);
                        node = res.next;
                        break;  // continue matching
                    } else if (res.badNode) {
                        badNode = res.badNode;
                        break mismatch;
                    } else if (res.lastNode) {
                        lastNode = res.lastNode;
                    }
                }

                if (buffer.length === 0) {
                    break mismatch; // nothing found -> stop matching
                }

                break;

            case ' ':
                var beforeMatchNode = node;
                var lastMatchedTerm = null;
                var hasTailMatch = false;
                var commaMissed = false;

                for (var i = 0; i < syntaxNode.terms.length; i++) {
                    var term = syntaxNode.terms[i];
                    var res = matchSyntax(lexer, term, node);

                    if (res.match) {
                        if (term.type === 'Comma' && i !== 0 && !hasTailMatch) {
                            // recover cursor to state before last match and stop matching
                            lastNode = node && node.data;
                            node = beforeMatchNode;
                            break mismatch;
                        }

                        // non-empty match (res.next will refer to another node)
                        if (res.next !== node) {
                            // match should be preceded by a comma
                            if (commaMissed) {
                                lastNode = node && node.data;
                                node = beforeMatchNode;
                                break mismatch;
                            }

                            hasTailMatch = term.type !== 'Comma';
                            lastMatchedTerm = term;
                        }

                        putResult(buffer, res.match);
                        node = skipSpaces(res.next);
                    } else if (res.badNode) {
                        badNode = res.badNode;
                        break mismatch;
                    } else {
                        if (res.lastNode) {
                            lastNode = res.lastNode;
                        }

                        // it's ok when comma doesn't match when no matches yet
                        // but only if comma is not first or last term
                        if (term.type === 'Comma' && i !== 0 && i !== syntaxNode.terms.length - 1) {
                            if (hasTailMatch) {
                                commaMissed = true;
                            }
                            continue;
                        }

                        // recover cursor to state before last match and stop matching
                        lastNode = res.lastNode || (node && node.data);
                        node = beforeMatchNode;
                        break mismatch;
                    }
                }

                // don't allow empty match when [ ]!
                if (!lastMatchedTerm && syntaxNode.disallowEmpty) {
                    // empty match but shouldn't
                    // recover cursor to state before last match and stop matching
                    lastNode = node && node.data;
                    node = beforeMatchNode;
                    break mismatch;
                }

                // don't allow comma at the end but only if last term isn't a comma
                if (lastMatchedTerm && lastMatchedTerm.type === 'Comma' && term.type !== 'Comma') {
                    lastNode = node && node.data;
                    node = beforeMatchNode;
                    break mismatch;
                }

                break;

            case '&&':
                var beforeMatchNode = node;
                var lastMatchedTerm = null;
                var terms = syntaxNode.terms.slice();

                while (terms.length) {
                    var wasMatch = false;
                    var emptyMatched = 0;

                    for (var i = 0; i < terms.length; i++) {
                        var term = terms[i];
                        var res = matchSyntax(lexer, term, node);

                        if (res.match) {
                            // non-empty match (res.next will refer to another node)
                            if (res.next !== node) {
                                lastMatchedTerm = term;
                            } else {
                                emptyMatched++;
                                continue;
                            }

                            wasMatch = true;
                            terms.splice(i--, 1);
                            putResult(buffer, res.match);
                            node = skipSpaces(res.next);
                            break;
                        } else if (res.badNode) {
                            badNode = res.badNode;
                            break mismatch;
                        } else if (res.lastNode) {
                            lastNode = res.lastNode;
                        }
                    }

                    if (!wasMatch) {
                        // terms left, but they all are optional
                        if (emptyMatched === terms.length) {
                            break;
                        }

                        // not ok
                        lastNode = node && node.data;
                        node = beforeMatchNode;
                        break mismatch;
                    }
                }

                if (!lastMatchedTerm && syntaxNode.disallowEmpty) { // don't allow empty match when [ ]!
                    // empty match but shouldn't
                    // recover cursor to state before last match and stop matching
                    lastNode = node && node.data;
                    node = beforeMatchNode;
                    break mismatch;
                }

                break;

            case '||':
                var beforeMatchNode = node;
                var lastMatchedTerm = null;
                var terms = syntaxNode.terms.slice();

                while (terms.length) {
                    var wasMatch = false;
                    var emptyMatched = 0;

                    for (var i = 0; i < terms.length; i++) {
                        var term = terms[i];
                        var res = matchSyntax(lexer, term, node);

                        if (res.match) {
                            // non-empty match (res.next will refer to another node)
                            if (res.next !== node) {
                                lastMatchedTerm = term;
                            } else {
                                emptyMatched++;
                                continue;
                            }

                            wasMatch = true;
                            terms.splice(i--, 1);
                            putResult(buffer, res.match);
                            node = skipSpaces(res.next);
                            break;
                        } else if (res.badNode) {
                            badNode = res.badNode;
                            break mismatch;
                        } else if (res.lastNode) {
                            lastNode = res.lastNode;
                        }
                    }

                    if (!wasMatch) {
                        break;
                    }
                }

                // don't allow empty match
                if (!lastMatchedTerm && (emptyMatched !== terms.length || syntaxNode.disallowEmpty)) {
                    // empty match but shouldn't
                    // recover cursor to state before last match and stop matching
                    lastNode = node && node.data;
                    node = beforeMatchNode;
                    break mismatch;
                }

                break;
        }

        // flush buffer
        result.push.apply(result, buffer);
        matchCount++;

        if (!node) {
            break;
        }

        if (multiplier.comma) {
            if (lastComma && lastCommaTermCount === result.length) {
                // nothing match after comma
                break mismatch;
            }

            node = skipSpaces(node);
            if (node !== null && node.data.type === 'Operator' && node.data.value === ',') {
                result.push({
                    syntax: syntaxNode,
                    match: [{
                        type: 'ASTNode',
                        node: node.data,
                        childrenMatch: null
                    }]
                });
                lastCommaTermCount = result.length;
                lastComma = node;
                node = node.next;
            } else {
                lastNode = node !== null ? node.data : null;
                break mismatch;
            }
        }
    }

    // console.log(syntaxNode.type, badNode, lastNode);

    if (lastComma && lastCommaTermCount === result.length) {
        // nothing match after comma
        node = lastComma;
        result.pop();
    }

    return buildMatchNode(badNode, lastNode, node, matchCount < min ? null : {
        syntax: syntaxNode,
        match: result,
        toJSON: matchToJSON
    });
}

function matchSyntax(lexer, syntaxNode, node) {
    var badNode = null;
    var lastNode = null;
    var match = null;

    switch (syntaxNode.type) {
        case 'Group':
            return matchGroup(lexer, syntaxNode, node);

        case 'Function':
            // expect a function node
            if (!node || node.data.type !== 'Function') {
                break;
            }

            var keyword = names.keyword(node.data.name);
            var name = syntaxNode.name.toLowerCase();

            // check function name with vendor consideration
            if (name !== keyword.name) {
                break;
            }

            var res = matchSyntax(lexer, syntaxNode.children, node.data.children.head);
            if (!res.match || res.next) {
                badNode = res.badNode || res.lastNode || (res.next ? res.next.data : null) || node.data;
                break;
            }

            match = [{
                type: 'ASTNode',
                node: node.data,
                childrenMatch: res.match.match
            }];

            // Use node.next instead of res.next here since syntax is matching
            // for internal list and it should be completelly matched (res.next is null at this point).
            // Therefore function is matched and we are going to next node
            node = node.next;
            break;

        case 'Parentheses':
            if (!node || node.data.type !== 'Parentheses') {
                break;
            }

            var res = matchSyntax(lexer, syntaxNode.children, node.data.children.head);
            if (!res.match || res.next) {
                badNode = res.badNode || res.lastNode || (res.next ? res.next.data : null) || node.data;  // TODO: case when res.next === null
                break;
            }

            match = [{
                type: 'ASTNode',
                node: node.data,
                childrenMatch: res.match.match
            }];

            node = res.next;
            break;

        case 'Type':
            var typeSyntax = lexer.getType(syntaxNode.name);
            if (!typeSyntax) {
                throw new Error('Unknown syntax type `' + syntaxNode.name + '`');
            }

            var res = typeSyntax.match(node);
            if (!res.match) {
                badNode = res && res.badNode; // TODO: case when res.next === null
                lastNode = (res && res.lastNode) || (node && node.data);
                break;
            }

            node = res.next;
            putResult(match = [], res.match);
            if (match.length === 0) {
                match = null;
            }
            break;

        case 'Property':
            var propertySyntax = lexer.getProperty(syntaxNode.name);
            if (!propertySyntax) {
                throw new Error('Unknown property `' + syntaxNode.name + '`');
            }

            var res = propertySyntax.match(node);
            if (!res.match) {
                badNode = res && res.badNode; // TODO: case when res.next === null
                lastNode = (res && res.lastNode) || (node && node.data);
                break;
            }

            node = res.next;
            putResult(match = [], res.match);
            if (match.length === 0) {
                match = null;
            }
            break;

        case 'Keyword':
            if (!node) {
                break;
            }

            if (node.data.type === 'Identifier') {
                var keyword = names.keyword(node.data.name);
                var keywordName = keyword.name;
                var name = syntaxNode.name.toLowerCase();

                // drop \0 and \9 hack from keyword name
                if (keywordName.indexOf('\\') !== -1) {
                    keywordName = keywordName.replace(/\\[09].*$/, '');
                }

                if (name !== keywordName) {
                    break;
                }
            } else {
                // keyword may to be a number (e.g. font-weight: 400 )
                if (node.data.type !== 'Number' || node.data.value !== syntaxNode.name) {
                    break;
                }
            }

            match = [{
                type: 'ASTNode',
                node: node.data,
                childrenMatch: null
            }];
            node = node.next;
            break;

        case 'Slash':
        case 'Comma':
            if (!node || node.data.type !== 'Operator' || node.data.value !== syntaxNode.value) {
                break;
            }

            match = [{
                type: 'ASTNode',
                node: node.data,
                childrenMatch: null
            }];
            node = node.next;
            break;

        case 'String':
            if (!node || node.data.type !== 'String') {
                break;
            }

            match = [{
                type: 'ASTNode',
                node: node.data,
                childrenMatch: null
            }];
            node = node.next;
            break;

        case 'ASTNode':
            if (node && syntaxNode.match(node)) {
                match = {
                    type: 'ASTNode',
                    node: node.data,
                    childrenMatch: null
                };
                node = node.next;
            }
            return buildMatchNode(badNode, lastNode, node, match);

        default:
            throw new Error('Not implemented yet node type: ' + syntaxNode.type);
    }

    return buildMatchNode(badNode, lastNode, node, match === null ? null : {
        syntax: syntaxNode,
        match: match,
        toJSON: matchToJSON
    });

};

module.exports = matchSyntax;
