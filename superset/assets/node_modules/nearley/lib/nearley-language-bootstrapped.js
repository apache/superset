// Generated automatically by nearley, version 2.14.0
// http://github.com/Hardmath123/nearley
(function () {
function id(x) { return x[0]; }

function getValue(d) {
    return d[0].value
}

function literals(list) {
    var rules = {}
    for (let lit of list) {
        rules[lit] = {match: lit, next: 'main'}
    }
    return rules
}

var moo = require('moo')
var rules = Object.assign({
    ws: {match: /\s+/, lineBreaks: true, next: 'main'},
    comment: /\#.*/,
    arrow: {match: /[=-]+\>/, next: 'main'},
    js: {
        match: /\{\%(?:[^%]|\%[^}])*\%\}/,
        value: x => x.slice(2, -2),
    },
    word: {match: /[\w\?\+]+/, next: 'afterWord'},
    string: {
        match: /"(?:[^\\"\n]|\\["\\/bfnrt]|\\u[a-fA-F0-9]{4})*"/,
        value: x => JSON.parse(x),
        next: 'main',
    },
    btstring: {
        match: /`[^`]*`/,
        value: x => x.slice(1, -1),
        next: 'main',
    },
}, literals([
    ",", "|", "$", "%", "(", ")",
    ":?", ":*", ":+",
    "@include", "@builtin", "@",
    "]",
]))

var lexer = moo.states({
    main: Object.assign({}, rules, {
        charclass: {
            match: /\.|\[(?:\\.|[^\\\n])+?\]/,
            value: x => new RegExp(x),
        },
    }),
    // Both macro arguments and charclasses are both enclosed in [ ].
    // We disambiguate based on whether the previous token was a `word`.
    afterWord: Object.assign({}, rules, {
        "[": {match: "[", next: 'main'},
    }),
})

function insensitive(sl) {
    var s = sl.literal;
    var result = [];
    for (var i=0; i<s.length; i++) {
        var c = s.charAt(i);
        if (c.toUpperCase() !== c || c.toLowerCase() !== c) {
            result.push(new RegExp("[" + c.toLowerCase() + c.toUpperCase() + "]"));
            } else {
            result.push({literal: c});
        }
    }
    return {subexpression: [{tokens: result, postprocess: function(d) {return d.join(""); }}]};
}

var grammar = {
    Lexer: lexer,
    ParserRules: [
    {"name": "dqstring$ebnf$1", "symbols": []},
    {"name": "dqstring$ebnf$1", "symbols": ["dqstring$ebnf$1", "dstrchar"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "dqstring", "symbols": [{"literal":"\""}, "dqstring$ebnf$1", {"literal":"\""}], "postprocess": function(d) {return d[1].join(""); }},
    {"name": "sqstring$ebnf$1", "symbols": []},
    {"name": "sqstring$ebnf$1", "symbols": ["sqstring$ebnf$1", "sstrchar"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "sqstring", "symbols": [{"literal":"'"}, "sqstring$ebnf$1", {"literal":"'"}], "postprocess": function(d) {return d[1].join(""); }},
    {"name": "btstring$ebnf$1", "symbols": []},
    {"name": "btstring$ebnf$1", "symbols": ["btstring$ebnf$1", /[^`]/], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "btstring", "symbols": [{"literal":"`"}, "btstring$ebnf$1", {"literal":"`"}], "postprocess": function(d) {return d[1].join(""); }},
    {"name": "dstrchar", "symbols": [/[^\\"\n]/], "postprocess": id},
    {"name": "dstrchar", "symbols": [{"literal":"\\"}, "strescape"], "postprocess": 
        function(d) {
            return JSON.parse("\""+d.join("")+"\"");
        }
        },
    {"name": "sstrchar", "symbols": [/[^\\'\n]/], "postprocess": id},
    {"name": "sstrchar", "symbols": [{"literal":"\\"}, "strescape"], "postprocess": function(d) { return JSON.parse("\""+d.join("")+"\""); }},
    {"name": "sstrchar$string$1", "symbols": [{"literal":"\\"}, {"literal":"'"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "sstrchar", "symbols": ["sstrchar$string$1"], "postprocess": function(d) {return "'"; }},
    {"name": "strescape", "symbols": [/["\\\/bfnrt]/], "postprocess": id},
    {"name": "strescape", "symbols": [{"literal":"u"}, /[a-fA-F0-9]/, /[a-fA-F0-9]/, /[a-fA-F0-9]/, /[a-fA-F0-9]/], "postprocess": 
        function(d) {
            return d.join("");
        }
        },
    {"name": "final$ebnf$1", "symbols": [(lexer.has("ws") ? {type: "ws"} : ws)], "postprocess": id},
    {"name": "final$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "final", "symbols": ["_", "prog", "_", "final$ebnf$1"], "postprocess": function(d) { return d[1]; }},
    {"name": "prog", "symbols": ["prod"], "postprocess": function(d) { return [d[0]]; }},
    {"name": "prog", "symbols": ["prod", "ws", "prog"], "postprocess": function(d) { return [d[0]].concat(d[2]); }},
    {"name": "prod", "symbols": ["word", "_", (lexer.has("arrow") ? {type: "arrow"} : arrow), "_", "expression+"], "postprocess": function(d) { return {name: d[0], rules: d[4]}; }},
    {"name": "prod", "symbols": ["word", {"literal":"["}, "wordlist", {"literal":"]"}, "_", (lexer.has("arrow") ? {type: "arrow"} : arrow), "_", "expression+"], "postprocess": function(d) {return {macro: d[0], args: d[2], exprs: d[7]}}},
    {"name": "prod", "symbols": [{"literal":"@"}, "_", "js"], "postprocess": function(d) { return {body: d[2]}; }},
    {"name": "prod", "symbols": [{"literal":"@"}, "word", "ws", "word"], "postprocess": function(d) { return {config: d[1], value: d[3]}; }},
    {"name": "prod", "symbols": [{"literal":"@include"}, "_", "string"], "postprocess": function(d) {return {include: d[2].literal, builtin: false}}},
    {"name": "prod", "symbols": [{"literal":"@builtin"}, "_", "string"], "postprocess": function(d) {return {include: d[2].literal, builtin: true }}},
    {"name": "expression+", "symbols": ["completeexpression"]},
    {"name": "expression+", "symbols": ["expression+", "_", {"literal":"|"}, "_", "completeexpression"], "postprocess": function(d) { return d[0].concat([d[4]]); }},
    {"name": "expressionlist", "symbols": ["completeexpression"]},
    {"name": "expressionlist", "symbols": ["expressionlist", "_", {"literal":","}, "_", "completeexpression"], "postprocess": function(d) { return d[0].concat([d[4]]); }},
    {"name": "wordlist", "symbols": ["word"]},
    {"name": "wordlist", "symbols": ["wordlist", "_", {"literal":","}, "_", "word"], "postprocess": function(d) { return d[0].concat([d[4]]); }},
    {"name": "completeexpression", "symbols": ["expr"], "postprocess": function(d) { return {tokens: d[0]}; }},
    {"name": "completeexpression", "symbols": ["expr", "_", "js"], "postprocess": function(d) { return {tokens: d[0], postprocess: d[2]}; }},
    {"name": "expr_member", "symbols": ["word"], "postprocess": id},
    {"name": "expr_member", "symbols": [{"literal":"$"}, "word"], "postprocess": function(d) {return {mixin: d[1]}}},
    {"name": "expr_member", "symbols": ["word", {"literal":"["}, "expressionlist", {"literal":"]"}], "postprocess": function(d) {return {macrocall: d[0], args: d[2]}}},
    {"name": "expr_member$ebnf$1", "symbols": [{"literal":"i"}], "postprocess": id},
    {"name": "expr_member$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "expr_member", "symbols": ["string", "expr_member$ebnf$1"], "postprocess": function(d) { if (d[1]) {return insensitive(d[0]); } else {return d[0]; } }},
    {"name": "expr_member", "symbols": [{"literal":"%"}, "word"], "postprocess": function(d) {return {token: d[1]}}},
    {"name": "expr_member", "symbols": ["charclass"], "postprocess": id},
    {"name": "expr_member", "symbols": [{"literal":"("}, "_", "expression+", "_", {"literal":")"}], "postprocess": function(d) {return {'subexpression': d[2]} ;}},
    {"name": "expr_member", "symbols": ["expr_member", "_", "ebnf_modifier"], "postprocess": function(d) {return {'ebnf': d[0], 'modifier': d[2]}; }},
    {"name": "ebnf_modifier", "symbols": [{"literal":":+"}], "postprocess": getValue},
    {"name": "ebnf_modifier", "symbols": [{"literal":":*"}], "postprocess": getValue},
    {"name": "ebnf_modifier", "symbols": [{"literal":":?"}], "postprocess": getValue},
    {"name": "expr", "symbols": ["expr_member"]},
    {"name": "expr", "symbols": ["expr", "ws", "expr_member"], "postprocess": function(d){ return d[0].concat([d[2]]); }},
    {"name": "word", "symbols": [(lexer.has("word") ? {type: "word"} : word)], "postprocess": getValue},
    {"name": "string", "symbols": [(lexer.has("string") ? {type: "string"} : string)], "postprocess": d => ({literal: d[0].value})},
    {"name": "string", "symbols": [(lexer.has("btstring") ? {type: "btstring"} : btstring)], "postprocess": d => ({literal: d[0].value})},
    {"name": "charclass", "symbols": [(lexer.has("charclass") ? {type: "charclass"} : charclass)], "postprocess": getValue},
    {"name": "js", "symbols": [(lexer.has("js") ? {type: "js"} : js)], "postprocess": getValue},
    {"name": "_$ebnf$1", "symbols": ["ws"], "postprocess": id},
    {"name": "_$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "_", "symbols": ["_$ebnf$1"]},
    {"name": "ws", "symbols": [(lexer.has("ws") ? {type: "ws"} : ws)]},
    {"name": "ws$ebnf$1", "symbols": [(lexer.has("ws") ? {type: "ws"} : ws)], "postprocess": id},
    {"name": "ws$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "ws", "symbols": ["ws$ebnf$1", (lexer.has("comment") ? {type: "comment"} : comment), "_"]}
]
  , ParserStart: "final"
}
if (typeof module !== 'undefined'&& typeof module.exports !== 'undefined') {
   module.exports = grammar;
} else {
   window.grammar = grammar;
}
})();
