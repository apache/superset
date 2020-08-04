ace.define("ace/mode/doc_comment_highlight_rules",["require","exports","module","ace/lib/oop","ace/mode/text_highlight_rules"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../lib/oop");
var TextHighlightRules = acequire("./text_highlight_rules").TextHighlightRules;

var DocCommentHighlightRules = function() {
    this.$rules = {
        "start" : [ {
            token : "comment.doc.tag",
            regex : "@[\\w\\d_]+" // TODO: fix email addresses
        }, 
        DocCommentHighlightRules.getTagRule(),
        {
            defaultToken : "comment.doc",
            caseInsensitive: true
        }]
    };
};

oop.inherits(DocCommentHighlightRules, TextHighlightRules);

DocCommentHighlightRules.getTagRule = function(start) {
    return {
        token : "comment.doc.tag.storage.type",
        regex : "\\b(?:TODO|FIXME|XXX|HACK)\\b"
    };
}

DocCommentHighlightRules.getStartRule = function(start) {
    return {
        token : "comment.doc", // doc comment
        regex : "\\/\\*(?=\\*)",
        next  : start
    };
};

DocCommentHighlightRules.getEndRule = function (start) {
    return {
        token : "comment.doc", // closing comment
        regex : "\\*\\/",
        next  : start
    };
};


exports.DocCommentHighlightRules = DocCommentHighlightRules;

});

ace.define("ace/mode/lean_highlight_rules",["require","exports","module","ace/lib/oop","ace/mode/doc_comment_highlight_rules","ace/mode/text_highlight_rules"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../lib/oop");
var DocCommentHighlightRules = acequire("./doc_comment_highlight_rules").DocCommentHighlightRules;
var TextHighlightRules = acequire("./text_highlight_rules").TextHighlightRules;

var leanHighlightRules = function() {

    var keywordControls = (
        [ "add_rewrite", "alias", "as", "assume", "attribute",
          "begin", "by", "calc", "calc_refl", "calc_subst", "calc_trans", "check",
          "classes", "coercions", "conjecture", "constants", "context",
          "corollary", "else", "end", "environment", "eval", "example",
          "exists", "exit", "export", "exposing", "extends", "fields", "find_decl",
          "forall", "from", "fun", "have", "help", "hiding", "if",
          "import", "in", "infix", "infixl", "infixr", "instances",
          "let", "local", "match", "namespace", "notation", "obtain", "obtains",
          "omit", "opaque", "open", "options", "parameter", "parameters", "postfix",
          "precedence", "prefix", "premise", "premises", "print", "private", "proof",
          "protected", "qed", "raw", "renaming", "section", "set_option",
          "show", "tactic_hint", "take", "then", "universe",
          "universes", "using", "variable", "variables", "with"].join("|")
    );

    var nameProviders = (
        ["inductive", "structure", "record", "theorem", "axiom",
         "axioms", "lemma", "hypothesis", "definition", "constant"].join("|")
    );

    var storageType = (
        ["Prop", "Type", "Type'", "Type₊", "Type₁", "Type₂", "Type₃"].join("|")
    );

    var storageModifiers = (
        "\\[(" +
            ["abbreviations", "all-transparent", "begin-end-hints", "class", "classes", "coercion",
             "coercions", "declarations", "decls", "instance", "irreducible",
             "multiple-instances", "notation", "notations", "parsing-only", "persistent",
             "reduce-hints", "reducible", "tactic-hints", "visible", "wf", "whnf"
            ].join("|") +
            ")\\]"
    );

    var keywordOperators = (
        [].join("|")
    );

    var keywordMapper = this.$keywords = this.createKeywordMapper({
        "keyword.control" : keywordControls,
        "storage.type" : storageType,
        "keyword.operator" : keywordOperators,
        "variable.language": "sorry"
    }, "identifier");

    var identifierRe = "[A-Za-z_\u03b1-\u03ba\u03bc-\u03fb\u1f00-\u1ffe\u2100-\u214f][A-Za-z0-9_'\u03b1-\u03ba\u03bc-\u03fb\u1f00-\u1ffe\u2070-\u2079\u207f-\u2089\u2090-\u209c\u2100-\u214f]*";
    var operatorRe = new RegExp(["#", "@", "->", "∼", "↔", "/", "==", "=", ":=", "<->",
                                 "/\\", "\\/", "∧", "∨", "≠", "<", ">", "≤", "≥", "¬",
                                 "<=", ">=", "⁻¹", "⬝", "▸", "\\+", "\\*", "-", "/",
                                 "λ", "→", "∃", "∀", ":="].join("|"));

    this.$rules = {
        "start" : [
            {
                token : "comment", // single line comment "--"
                regex : "--.*$"
            },
            DocCommentHighlightRules.getStartRule("doc-start"),
            {
                token : "comment", // multi line comment "/-"
                regex : "\\/-",
                next : "comment"
            }, {
                stateName: "qqstring",
                token : "string.start", regex : '"', next : [
                    {token : "string.end", regex : '"', next : "start"},
                    {token : "constant.language.escape", regex : /\\[n"\\]/},
                    {defaultToken: "string"}
                ]
            }, {
                token : "keyword.control", regex : nameProviders, next : [
                    {token : "variable.language", regex : identifierRe, next : "start"} ]
            }, {
                token : "constant.numeric", // hex
                regex : "0[xX][0-9a-fA-F]+(L|l|UL|ul|u|U|F|f|ll|LL|ull|ULL)?\\b"
            }, {
                token : "constant.numeric", // float
                regex : "[+-]?\\d+(?:(?:\\.\\d*)?(?:[eE][+-]?\\d+)?)?(L|l|UL|ul|u|U|F|f|ll|LL|ull|ULL)?\\b"
            }, {
                token : "storage.modifier",
                regex : storageModifiers
            }, {
                token : keywordMapper,
                regex : identifierRe
            }, {
                token : "operator",
                regex : operatorRe
            }, {
              token : "punctuation.operator",
              regex : "\\?|\\:|\\,|\\;|\\."
            }, {
                token : "paren.lparen",
                regex : "[[({]"
            }, {
                token : "paren.rparen",
                regex : "[\\])}]"
            }, {
                token : "text",
                regex : "\\s+"
            }
        ],
        "comment" : [ {token: "comment", regex: "-/", next: "start"},
                      {defaultToken: "comment"} ]
    };

    this.embedRules(DocCommentHighlightRules, "doc-",
        [ DocCommentHighlightRules.getEndRule("start") ]);
    this.normalizeRules();
};

oop.inherits(leanHighlightRules, TextHighlightRules);

exports.leanHighlightRules = leanHighlightRules;
});

ace.define("ace/mode/matching_brace_outdent",["require","exports","module","ace/range"], function(acequire, exports, module) {
"use strict";

var Range = acequire("../range").Range;

var MatchingBraceOutdent = function() {};

(function() {

    this.checkOutdent = function(line, input) {
        if (! /^\s+$/.test(line))
            return false;

        return /^\s*\}/.test(input);
    };

    this.autoOutdent = function(doc, row) {
        var line = doc.getLine(row);
        var match = line.match(/^(\s*\})/);

        if (!match) return 0;

        var column = match[1].length;
        var openBracePos = doc.findMatchingBracket({row: row, column: column});

        if (!openBracePos || openBracePos.row == row) return 0;

        var indent = this.$getIndent(doc.getLine(openBracePos.row));
        doc.replace(new Range(row, 0, row, column-1), indent);
    };

    this.$getIndent = function(line) {
        return line.match(/^\s*/)[0];
    };

}).call(MatchingBraceOutdent.prototype);

exports.MatchingBraceOutdent = MatchingBraceOutdent;
});

ace.define("ace/mode/lean",["require","exports","module","ace/lib/oop","ace/mode/text","ace/mode/lean_highlight_rules","ace/mode/matching_brace_outdent","ace/range"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../lib/oop");
var TextMode = acequire("./text").Mode;
var leanHighlightRules = acequire("./lean_highlight_rules").leanHighlightRules;
var MatchingBraceOutdent = acequire("./matching_brace_outdent").MatchingBraceOutdent;
var Range = acequire("../range").Range;

var Mode = function() {
    this.HighlightRules = leanHighlightRules;

    this.$outdent = new MatchingBraceOutdent();
};
oop.inherits(Mode, TextMode);

(function() {

    this.lineCommentStart = "--";
    this.blockComment = {start: "/-", end: "-/"};

    this.getNextLineIndent = function(state, line, tab) {
        var indent = this.$getIndent(line);

        var tokenizedLine = this.getTokenizer().getLineTokens(line, state);
        var tokens = tokenizedLine.tokens;
        var endState = tokenizedLine.state;

        if (tokens.length && tokens[tokens.length-1].type == "comment") {
            return indent;
        }

        if (state == "start") {
            var match = line.match(/^.*[\{\(\[]\s*$/);
            if (match) {
                indent += tab;
            }
        } else if (state == "doc-start") {
            if (endState == "start") {
                return "";
            }
            var match = line.match(/^\s*(\/?)\*/);
            if (match) {
                if (match[1]) {
                    indent += " ";
                }
                indent += "- ";
            }
        }

        return indent;
    };

    this.checkOutdent = function(state, line, input) {
        return this.$outdent.checkOutdent(line, input);
    };

    this.autoOutdent = function(state, doc, row) {
        this.$outdent.autoOutdent(doc, row);
    };

    this.$id = "ace/mode/lean";
}).call(Mode.prototype);

exports.Mode = Mode;
});
