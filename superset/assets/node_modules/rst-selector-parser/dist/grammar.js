'use strict';

// Generated automatically by nearley
// http://github.com/Hardmath123/nearley
(function () {
  function id(x) {
    return x[0];
  }

  var flattenDeep = require('lodash.flattendeep');
  var appendItem = function appendItem(a, b) {
    return function (d) {
      return d[a].concat([d[b]]);
    };
  };
  var appendItemChar = function appendItemChar(a, b) {
    return function (d) {
      return d[a].concat(d[b]);
    };
  };

  var flatten = function flatten(d) {
    d = d.filter(function (r) {
      return r !== null;
    });
    return flattenDeep(d);
  };

  var combinatorMap = {
    ' ': 'descendantCombinator',
    '+': 'adjacentSiblingCombinator',
    '>': 'childCombinator',
    '~': 'generalSiblingCombinator'
  };

  var concatUsingCombinator = function concatUsingCombinator(d) {
    return (Array.isArray(d[0]) ? d[0] : [d[0]]).concat({
      type: combinatorMap[d[2]]
    }).concat(d[4]);
  };

  var parseAsNumber = function parseAsNumber(d, i, reject) {
    var joined = flattenDeep(d).join('');
    var parsed = parseFloat(joined);
    if (isNaN(parsed)) {
      return reject;
    }
    return parsed;
  };

  var parseAsBoolean = function parseAsBoolean(d, i, reject) {
    if (d[0] === 'true') return true;
    if (d[0] === 'false') return false;
    return reject;
  };

  var parseFalsyPrimitive = function parseFalsyPrimitive(d, i, reject) {
    if (d[0] === 'NaN') return NaN;
    if (d[0] === 'undefined') return undefined;
    if (d[0] === 'null') return null;
    return reject;
  };
  var grammar = {
    Lexer: undefined,
    ParserRules: [{ "name": "combinator", "symbols": ["selector"] }, { "name": "combinator", "symbols": ["combinator", "_", /[>+~ ]/, "_", "selector"], "postprocess": concatUsingCombinator }, { "name": "selector", "symbols": ["selectorBody"], "postprocess": function postprocess(d) {
        return { type: 'selector', body: d[0] };
      } }, { "name": "selectorBody$ebnf$1", "symbols": ["typeSelector"], "postprocess": id }, { "name": "selectorBody$ebnf$1", "symbols": [], "postprocess": function postprocess(d) {
        return null;
      } }, { "name": "selectorBody$ebnf$2", "symbols": [] }, { "name": "selectorBody$ebnf$2", "symbols": ["selectorBody$ebnf$2", "simpleSelector"], "postprocess": function arrpush(d) {
        return d[0].concat([d[1]]);
      } }, { "name": "selectorBody", "symbols": ["selectorBody$ebnf$1", "selectorBody$ebnf$2"], "postprocess": function postprocess(d, i, reject) {
        var selectors = flatten(d);if (!selectors.length) return reject;return selectors;
      } }, { "name": "selectorBody$ebnf$3", "symbols": [] }, { "name": "selectorBody$ebnf$3", "symbols": ["selectorBody$ebnf$3", "simpleSelector"], "postprocess": function arrpush(d) {
        return d[0].concat([d[1]]);
      } }, { "name": "selectorBody", "symbols": ["universalSelector", "selectorBody$ebnf$3"], "postprocess": flatten }, { "name": "simpleSelector", "symbols": ["idSelector"] }, { "name": "simpleSelector", "symbols": ["classSelector"] }, { "name": "simpleSelector", "symbols": ["attributeValueSelector"] }, { "name": "simpleSelector", "symbols": ["attributePresenceSelector"] }, { "name": "simpleSelector", "symbols": ["pseudoClassSelector"] }, { "name": "simpleSelector", "symbols": ["pseudoElementSelector"] }, { "name": "typeSelector", "symbols": ["attributeName"], "postprocess": function postprocess(d) {
        return { type: 'typeSelector', name: d[0] };
      } }, { "name": "className$ebnf$1", "symbols": [{ "literal": "-" }], "postprocess": id }, { "name": "className$ebnf$1", "symbols": [], "postprocess": function postprocess(d) {
        return null;
      } }, { "name": "className$ebnf$2", "symbols": [] }, { "name": "className$ebnf$2", "symbols": ["className$ebnf$2", /[_a-zA-Z0-9-]/], "postprocess": function arrpush(d) {
        return d[0].concat([d[1]]);
      } }, { "name": "className", "symbols": ["className$ebnf$1", /[_a-zA-Z]/, "className$ebnf$2"], "postprocess": function postprocess(d) {
        return (d[0] || '') + d[1] + d[2].join('');
      } }, { "name": "attributeName$ebnf$1", "symbols": [] }, { "name": "attributeName$ebnf$1", "symbols": ["attributeName$ebnf$1", /[_a-zA-Z()0-9-]/], "postprocess": function arrpush(d) {
        return d[0].concat([d[1]]);
      } }, { "name": "attributeName", "symbols": [/[_a-z()A-Z]/, "attributeName$ebnf$1"], "postprocess": function postprocess(d) {
        return d[0] + d[1].join('');
      } }, { "name": "classSelector", "symbols": [{ "literal": "." }, "className"], "postprocess": function postprocess(d) {
        return { type: 'classSelector', name: d[1] };
      } }, { "name": "idSelector", "symbols": [{ "literal": "#" }, "attributeName"], "postprocess": function postprocess(d) {
        return { type: 'idSelector', name: d[1] };
      } }, { "name": "universalSelector", "symbols": [{ "literal": "*" }], "postprocess": function postprocess(d) {
        return { type: 'universalSelector' };
      } }, { "name": "attributePresenceSelector", "symbols": [{ "literal": "[" }, "attributeName", { "literal": "]" }], "postprocess": function postprocess(d) {
        return { type: 'attributePresenceSelector', name: d[1] };
      } }, { "name": "attributeOperator", "symbols": [{ "literal": "=" }] }, { "name": "attributeOperator$string$1", "symbols": [{ "literal": "~" }, { "literal": "=" }], "postprocess": function joiner(d) {
        return d.join('');
      } }, { "name": "attributeOperator", "symbols": ["attributeOperator$string$1"] }, { "name": "attributeOperator$string$2", "symbols": [{ "literal": "|" }, { "literal": "=" }], "postprocess": function joiner(d) {
        return d.join('');
      } }, { "name": "attributeOperator", "symbols": ["attributeOperator$string$2"] }, { "name": "attributeOperator$string$3", "symbols": [{ "literal": "^" }, { "literal": "=" }], "postprocess": function joiner(d) {
        return d.join('');
      } }, { "name": "attributeOperator", "symbols": ["attributeOperator$string$3"] }, { "name": "attributeOperator$string$4", "symbols": [{ "literal": "$" }, { "literal": "=" }], "postprocess": function joiner(d) {
        return d.join('');
      } }, { "name": "attributeOperator", "symbols": ["attributeOperator$string$4"] }, { "name": "attributeOperator$string$5", "symbols": [{ "literal": "*" }, { "literal": "=" }], "postprocess": function joiner(d) {
        return d.join('');
      } }, { "name": "attributeOperator", "symbols": ["attributeOperator$string$5"] }, { "name": "attributeValueSelector", "symbols": [{ "literal": "[" }, "attributeName", "attributeOperator", "attributeValue", { "literal": "]" }], "postprocess": function postprocess(d) {
        return {
          type: 'attributeValueSelector',
          name: d[1],
          value: d[3],
          operator: d[2][0]
        };
      }
    }, { "name": "attributeValue", "symbols": ["falsyPrimitiveStrings"], "postprocess": id }, { "name": "attributeValue", "symbols": ["numericValue"], "postprocess": id }, { "name": "attributeValue", "symbols": ["sqstring"], "postprocess": id }, { "name": "attributeValue", "symbols": ["dqstring"], "postprocess": id }, { "name": "falsyPrimitiveStrings$string$1", "symbols": [{ "literal": "f" }, { "literal": "a" }, { "literal": "l" }, { "literal": "s" }, { "literal": "e" }], "postprocess": function joiner(d) {
        return d.join('');
      } }, { "name": "falsyPrimitiveStrings", "symbols": ["falsyPrimitiveStrings$string$1"], "postprocess": parseAsBoolean }, { "name": "falsyPrimitiveStrings$string$2", "symbols": [{ "literal": "t" }, { "literal": "r" }, { "literal": "u" }, { "literal": "e" }], "postprocess": function joiner(d) {
        return d.join('');
      } }, { "name": "falsyPrimitiveStrings", "symbols": ["falsyPrimitiveStrings$string$2"], "postprocess": parseAsBoolean }, { "name": "falsyPrimitiveStrings$string$3", "symbols": [{ "literal": "N" }, { "literal": "a" }, { "literal": "N" }], "postprocess": function joiner(d) {
        return d.join('');
      } }, { "name": "falsyPrimitiveStrings", "symbols": ["falsyPrimitiveStrings$string$3"], "postprocess": parseFalsyPrimitive }, { "name": "falsyPrimitiveStrings$string$4", "symbols": [{ "literal": "n" }, { "literal": "u" }, { "literal": "l" }, { "literal": "l" }], "postprocess": function joiner(d) {
        return d.join('');
      } }, { "name": "falsyPrimitiveStrings", "symbols": ["falsyPrimitiveStrings$string$4"], "postprocess": parseFalsyPrimitive }, { "name": "falsyPrimitiveStrings$string$5", "symbols": [{ "literal": "u" }, { "literal": "n" }, { "literal": "d" }, { "literal": "e" }, { "literal": "f" }, { "literal": "i" }, { "literal": "n" }, { "literal": "e" }, { "literal": "d" }], "postprocess": function joiner(d) {
        return d.join('');
      } }, { "name": "falsyPrimitiveStrings", "symbols": ["falsyPrimitiveStrings$string$5"], "postprocess": parseFalsyPrimitive }, { "name": "numericValue", "symbols": ["int", { "literal": "." }, "int"], "postprocess": parseAsNumber }, { "name": "numericValue", "symbols": [{ "literal": "+" }, "int", { "literal": "." }, "int"], "postprocess": parseAsNumber }, { "name": "numericValue", "symbols": [{ "literal": "-" }, "int", { "literal": "." }, "int"], "postprocess": parseAsNumber }, { "name": "numericValue", "symbols": [{ "literal": "-" }, "int"], "postprocess": parseAsNumber }, { "name": "numericValue", "symbols": ["int"], "postprocess": parseAsNumber }, { "name": "numericValue", "symbols": [{ "literal": "+" }, "int"], "postprocess": parseAsNumber }, { "name": "numericValue$string$1", "symbols": [{ "literal": "I" }, { "literal": "n" }, { "literal": "f" }, { "literal": "i" }, { "literal": "n" }, { "literal": "i" }, { "literal": "t" }, { "literal": "y" }], "postprocess": function joiner(d) {
        return d.join('');
      } }, { "name": "numericValue", "symbols": ["numericValue$string$1"], "postprocess": parseAsNumber }, { "name": "numericValue$string$2", "symbols": [{ "literal": "+" }, { "literal": "I" }, { "literal": "n" }, { "literal": "f" }, { "literal": "i" }, { "literal": "n" }, { "literal": "i" }, { "literal": "t" }, { "literal": "y" }], "postprocess": function joiner(d) {
        return d.join('');
      } }, { "name": "numericValue", "symbols": ["numericValue$string$2"], "postprocess": parseAsNumber }, { "name": "numericValue$string$3", "symbols": [{ "literal": "-" }, { "literal": "I" }, { "literal": "n" }, { "literal": "f" }, { "literal": "i" }, { "literal": "n" }, { "literal": "i" }, { "literal": "t" }, { "literal": "y" }], "postprocess": function joiner(d) {
        return d.join('');
      } }, { "name": "numericValue", "symbols": ["numericValue$string$3"], "postprocess": parseAsNumber }, { "name": "int$ebnf$1", "symbols": [/[0-9]/] }, { "name": "int$ebnf$1", "symbols": ["int$ebnf$1", /[0-9]/], "postprocess": function arrpush(d) {
        return d[0].concat([d[1]]);
      } }, { "name": "int", "symbols": ["int$ebnf$1"] }, { "name": "classParameters", "symbols": [] }, { "name": "classParameters", "symbols": ["classParameter"] }, { "name": "classParameters", "symbols": ["classParameters", { "literal": "," }, "_", "classParameter"], "postprocess": appendItem(0, 3) }, { "name": "classParameter$ebnf$1", "symbols": [/[^()"', ]/] }, { "name": "classParameter$ebnf$1", "symbols": ["classParameter$ebnf$1", /[^()"', ]/], "postprocess": function arrpush(d) {
        return d[0].concat([d[1]]);
      } }, { "name": "classParameter", "symbols": ["classParameter$ebnf$1"], "postprocess": function postprocess(d) {
        return d[0].join('');
      } }, { "name": "classParameter", "symbols": ["sqstring"], "postprocess": id }, { "name": "classParameter", "symbols": ["dqstring"], "postprocess": id }, { "name": "pseudoElementSelector$string$1", "symbols": [{ "literal": ":" }, { "literal": ":" }], "postprocess": function joiner(d) {
        return d.join('');
      } }, { "name": "pseudoElementSelector", "symbols": ["pseudoElementSelector$string$1", "pseudoClassSelectorName"], "postprocess": function postprocess(d) {
        return { type: 'pseudoElementSelector', name: d[1] };
      } }, { "name": "pseudoClassSelector", "symbols": [{ "literal": ":" }, "pseudoClassSelectorName"], "postprocess": function postprocess(d) {
        return { type: 'pseudoClassSelector', name: d[1] };
      } }, { "name": "pseudoClassSelector", "symbols": [{ "literal": ":" }, "pseudoClassSelectorName", { "literal": "(" }, "classParameters", { "literal": ")" }], "postprocess": function postprocess(d) {
        return { type: 'pseudoClassSelector', name: d[1], parameters: d[3] };
      } }, { "name": "pseudoClassSelectorName$ebnf$1", "symbols": [/[a-zA-Z0-9-_]/] }, { "name": "pseudoClassSelectorName$ebnf$1", "symbols": ["pseudoClassSelectorName$ebnf$1", /[a-zA-Z0-9-_]/], "postprocess": function arrpush(d) {
        return d[0].concat([d[1]]);
      } }, { "name": "pseudoClassSelectorName", "symbols": [/[a-zA-Z]/, "pseudoClassSelectorName$ebnf$1"], "postprocess": function postprocess(d) {
        return d[0] + d[1].join('');
      } }, { "name": "dqstring$ebnf$1", "symbols": [] }, { "name": "dqstring$ebnf$1", "symbols": ["dqstring$ebnf$1", "dstrchar"], "postprocess": function arrpush(d) {
        return d[0].concat([d[1]]);
      } }, { "name": "dqstring", "symbols": [{ "literal": "\"" }, "dqstring$ebnf$1", { "literal": "\"" }], "postprocess": function postprocess(d) {
        return d[1].join('');
      } }, { "name": "dstrchar", "symbols": [/[^"]/], "postprocess": id }, { "name": "dstrchar$string$1", "symbols": [{ "literal": "\\" }, { "literal": "\"" }], "postprocess": function joiner(d) {
        return d.join('');
      } }, { "name": "dstrchar", "symbols": ["dstrchar$string$1"], "postprocess": function postprocess(d) {
        return '"';
      } }, { "name": "sqstring$ebnf$1", "symbols": [] }, { "name": "sqstring$ebnf$1", "symbols": ["sqstring$ebnf$1", "sstrchar"], "postprocess": function arrpush(d) {
        return d[0].concat([d[1]]);
      } }, { "name": "sqstring", "symbols": [{ "literal": "'" }, "sqstring$ebnf$1", { "literal": "'" }], "postprocess": function postprocess(d) {
        return d[1].join('');
      } }, { "name": "sstrchar", "symbols": [/[^']/], "postprocess": id }, { "name": "sstrchar$string$1", "symbols": [{ "literal": "\\" }, { "literal": "'" }], "postprocess": function joiner(d) {
        return d.join('');
      } }, { "name": "sstrchar", "symbols": ["sstrchar$string$1"], "postprocess": function postprocess(d) {
        return '\'';
      } }, { "name": "_$ebnf$1", "symbols": [] }, { "name": "_$ebnf$1", "symbols": ["_$ebnf$1", /[ ]/], "postprocess": function arrpush(d) {
        return d[0].concat([d[1]]);
      } }, { "name": "_", "symbols": ["_$ebnf$1"], "postprocess": function postprocess(d) {
        return null;
      } }],
    ParserStart: "combinator"
  };
  if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = grammar;
  } else {
    window.grammar = grammar;
  }
})();
//# sourceMappingURL=grammar.js.map