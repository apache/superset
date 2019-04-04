# nearley grammar
@builtin "string.ne"

@{%
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

%}
@lexer lexer

final -> _ prog _ %ws:?  {% function(d) { return d[1]; } %}

prog -> prod  {% function(d) { return [d[0]]; } %}
      | prod ws prog  {% function(d) { return [d[0]].concat(d[2]); } %}

prod -> word _ %arrow _ expression+  {% function(d) { return {name: d[0], rules: d[4]}; } %}
      | word "[" wordlist "]" _ %arrow _ expression+ {% function(d) {return {macro: d[0], args: d[2], exprs: d[7]}} %}
      | "@" _ js  {% function(d) { return {body: d[2]}; } %}
      | "@" word ws word  {% function(d) { return {config: d[1], value: d[3]}; } %}
      | "@include"  _ string {% function(d) {return {include: d[2].literal, builtin: false}} %}
      | "@builtin"  _ string {% function(d) {return {include: d[2].literal, builtin: true }} %}

expression+ -> completeexpression
             | expression+ _ "|" _ completeexpression  {% function(d) { return d[0].concat([d[4]]); } %}

expressionlist -> completeexpression
             | expressionlist _ "," _ completeexpression {% function(d) { return d[0].concat([d[4]]); } %}

wordlist -> word
            | wordlist _ "," _ word {% function(d) { return d[0].concat([d[4]]); } %}

completeexpression -> expr  {% function(d) { return {tokens: d[0]}; } %}
                    | expr _ js  {% function(d) { return {tokens: d[0], postprocess: d[2]}; } %}

expr_member ->
      word {% id %}
    | "$" word {% function(d) {return {mixin: d[1]}} %}
    | word "[" expressionlist "]" {% function(d) {return {macrocall: d[0], args: d[2]}} %} 
    | string "i":? {% function(d) { if (d[1]) {return insensitive(d[0]); } else {return d[0]; } } %}
    | "%" word {% function(d) {return {token: d[1]}} %}
    | charclass {% id %}
    | "(" _ expression+ _ ")" {% function(d) {return {'subexpression': d[2]} ;} %}
    | expr_member _ ebnf_modifier {% function(d) {return {'ebnf': d[0], 'modifier': d[2]}; } %}

ebnf_modifier -> ":+" {% getValue %} | ":*" {% getValue %} | ":?" {% getValue %}

expr -> expr_member
      | expr ws expr_member  {% function(d){ return d[0].concat([d[2]]); } %}

word -> %word {% getValue %}

string -> %string {% d => ({literal: d[0].value}) %}
        | %btstring {% d => ({literal: d[0].value}) %}

charclass -> %charclass  {% getValue %}

js -> %js  {% getValue %}

_ -> ws:?
ws -> %ws
      | %ws:? %comment _

