'use strict';

var SyntaxReferenceError = require('./error').SyntaxReferenceError;
var MatchError = require('./error').MatchError;
var names = require('../utils/names');
var generic = require('./generic');
var parse = require('./grammar/parse');
var generate = require('./grammar/generate');
var walk = require('./grammar/walk');
var match = require('./match');
var trace = require('./trace');
var search = require('./search');
var getStructureFromConfig = require('./structure').getStructureFromConfig;
var cssWideKeywords = parse('inherit | initial | unset');
var cssWideKeywordsWithExpression = parse('inherit | initial | unset | <expression>');

function dumpMapSyntax(map, syntaxAsAst) {
    var result = {};

    for (var name in map) {
        if (map[name].syntax) {
            result[name] = syntaxAsAst ? map[name].syntax : generate(map[name].syntax);
        }
    }

    return result;
}

function unwrapNode(item) {
    return item && item.data;
}

function valueHasVar(value) {
    var hasVar = false;

    this.syntax.walk(value, function(node) {
        if (node.type === 'Function' && node.name.toLowerCase() === 'var') {
            hasVar = true;
        }
    });

    return hasVar;
}

// check node is \0 or \9 hack
function isHack(node) {
    return node.type === 'Identifier' && /^\\[09]/.test(node.name);
}

// white spaces, comments and some hacks can to be ignored at the end of value
function isNextMayToBeIgnored(cursor) {
    while (cursor !== null) {
        if (cursor.data.type !== 'WhiteSpace' &&
            cursor.data.type !== 'Comment' &&
            !isHack(cursor.data)) {
            return false;
        }

        cursor = cursor.next;
    }

    return true;
}

function buildMatchResult(match, error) {
    return {
        matched: match,
        error: error,
        getTrace: trace.getTrace,
        isType: trace.isType,
        isProperty: trace.isProperty,
        isKeyword: trace.isKeyword
    };
}

function matchSyntax(lexer, syntax, node, useCommon) {
    var result;

    if (!node || !node.children) {
        return buildMatchResult(null, new Error('Node has no children'));
    }

    if (valueHasVar.call(lexer, node)) {
        return buildMatchResult(null, new Error('Matching for a tree with var() is not supported'));
    }

    if (useCommon) {
        result = match(lexer, lexer.valueCommonSyntax, node.children.head);
    }

    if (!useCommon || !result.match) {
        result = syntax.match(node.children.head);
        if (!result.match) {
            return buildMatchResult(null, new MatchError('Mismatch', lexer, syntax.syntax, node, result.badNode || unwrapNode(result.next) || node));
        }
    }

    // enhance top-level match wrapper
    if (result.match.type === 'ASTNode') {
        result.match = {
            syntax: {
                type: syntax.type,
                name: syntax.name
            },
            match: [result.match]
        };
    } else if (result.match.syntax.type === 'Group') {
        result.match.syntax = {
            type: syntax.type,
            name: syntax.name
        };
    }

    if (result.next && !isNextMayToBeIgnored(result.next)) {
        return buildMatchResult(null, new MatchError('Uncomplete match', lexer, syntax.syntax, node, result.badNode || unwrapNode(result.next) || node));
    }

    return buildMatchResult(result.match, null);
}

var Lexer = function(config, syntax, structure) {
    this.valueCommonSyntax = cssWideKeywords;
    this.syntax = syntax;
    this.generic = false;
    this.properties = {};
    this.types = {};
    this.structure = structure || getStructureFromConfig(config);

    if (config) {
        if (config.generic) {
            this.generic = true;
            for (var name in generic) {
                this.addType_(name, generic[name]);
            }
        }

        if (config.types) {
            for (var name in config.types) {
                this.addType_(name, config.types[name]);
            }
        }

        if (config.properties) {
            for (var name in config.properties) {
                this.addProperty_(name, config.properties[name]);
            }
        }
    }
};

Lexer.prototype = {
    structure: {},
    checkStructure: function(ast) {
        function collectWarning(node, message) {
            warns.push({
                node: node,
                message: message
            });
        }

        var structure = this.structure;
        var warns = [];

        this.syntax.walk(ast, function(node) {
            if (structure.hasOwnProperty(node.type)) {
                structure[node.type].check(node, collectWarning);
            } else {
                collectWarning(node, 'Unknown node type `' + node.type + '`');
            }
        });

        return warns.length ? warns : false;
    },

    createDescriptor: function(syntax, type, name) {
        var self = this;
        var descriptor = {
            type: type,
            name: name,
            syntax: null,
            match: null
        };

        if (typeof syntax === 'function') {
            // convert syntax to pseudo syntax node
            // NOTE: that's not a part of match result tree
            syntax = {
                type: 'ASTNode',
                match: syntax
            };

            descriptor.match = function(item) {
                return match(self, syntax, item);
            };
        } else {
            if (typeof syntax === 'string') {
                // lazy parsing on first access
                Object.defineProperty(descriptor, 'syntax', {
                    get: function() {
                        Object.defineProperty(descriptor, 'syntax', {
                            value: parse(syntax)
                        });

                        return descriptor.syntax;
                    }
                });
            } else {
                descriptor.syntax = syntax;
            }

            descriptor.match = function(item) {
                return match(self, descriptor.syntax, item);
            };
        }

        return descriptor;
    },
    addProperty_: function(name, syntax) {
        this.properties[name] = this.createDescriptor(syntax, 'Property', name);
    },
    addType_: function(name, syntax) {
        this.types[name] = this.createDescriptor(syntax, 'Type', name);

        if (syntax === generic.expression) {
            this.valueCommonSyntax = cssWideKeywordsWithExpression;
        }
    },

    matchDeclaration: function(node) {
        if (node.type !== 'Declaration') {
            return buildMatchResult(null, new Error('Not a Declaration node'));
        }

        return this.matchProperty(node.property, node.value);
    },
    matchProperty: function(propertyName, value) {
        var property = names.property(propertyName);

        // don't match syntax for a custom property
        if (property.custom) {
            return buildMatchResult(null, new Error('Lexer matching doesn\'t applicable for custom properties'));
        }

        var propertySyntax = property.vendor
            ? this.getProperty(property.name) || this.getProperty(property.basename)
            : this.getProperty(property.name);

        if (!propertySyntax) {
            return buildMatchResult(null, new SyntaxReferenceError('Unknown property', propertyName));
        }

        return matchSyntax(this, propertySyntax, value, true);
    },
    matchType: function(typeName, value) {
        var typeSyntax = this.getType(typeName);

        if (!typeSyntax) {
            return buildMatchResult(null, new SyntaxReferenceError('Unknown type', typeName));
        }

        return matchSyntax(this, typeSyntax, value, false);
    },
    match: function(syntax, value) {
        if (!syntax || !syntax.type) {
            return buildMatchResult(null, new SyntaxReferenceError('Bad syntax'));
        }

        if (!syntax.match) {
            syntax = this.createDescriptor(syntax);
        }

        return matchSyntax(this, syntax, value, false);
    },

    findValueFragments: function(propertyName, value, type, name) {
        return search.matchFragments(this, value, this.matchProperty(propertyName, value), type, name);
    },
    findDeclarationValueFragments: function(declaration, type, name) {
        return search.matchFragments(this, declaration.value, this.matchDeclaration(declaration), type, name);
    },
    findAllFragments: function(ast, type, name) {
        var result = [];

        this.syntax.walk(ast, {
            visit: 'Declaration',
            enter: function(declaration) {
                result.push.apply(result, this.findDeclarationValueFragments(declaration, type, name));
            }.bind(this)
        });

        return result;
    },

    getProperty: function(name) {
        return this.properties.hasOwnProperty(name) ? this.properties[name] : null;
    },
    getType: function(name) {
        return this.types.hasOwnProperty(name) ? this.types[name] : null;
    },

    validate: function() {
        function validate(syntax, name, broken, descriptor) {
            if (broken.hasOwnProperty(name)) {
                return broken[name];
            }

            broken[name] = false;
            if (descriptor.syntax !== null) {
                walk(descriptor.syntax, function(node) {
                    if (node.type !== 'Type' && node.type !== 'Property') {
                        return;
                    }

                    var map = node.type === 'Type' ? syntax.types : syntax.properties;
                    var brokenMap = node.type === 'Type' ? brokenTypes : brokenProperties;

                    if (!map.hasOwnProperty(node.name) || validate(syntax, node.name, brokenMap, map[node.name])) {
                        broken[name] = true;
                    }
                }, this);
            }
        }

        var brokenTypes = {};
        var brokenProperties = {};

        for (var key in this.types) {
            validate(this, key, brokenTypes, this.types[key]);
        }

        for (var key in this.properties) {
            validate(this, key, brokenProperties, this.properties[key]);
        }

        brokenTypes = Object.keys(brokenTypes).filter(function(name) {
            return brokenTypes[name];
        });
        brokenProperties = Object.keys(brokenProperties).filter(function(name) {
            return brokenProperties[name];
        });

        if (brokenTypes.length || brokenProperties.length) {
            return {
                types: brokenTypes,
                properties: brokenProperties
            };
        }

        return null;
    },
    dump: function(syntaxAsAst) {
        return {
            generic: this.generic,
            types: dumpMapSyntax(this.types, syntaxAsAst),
            properties: dumpMapSyntax(this.properties, syntaxAsAst)
        };
    },
    toString: function() {
        return JSON.stringify(this.dump());
    }
};

module.exports = Lexer;
