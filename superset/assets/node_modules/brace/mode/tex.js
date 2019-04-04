ace.define("ace/mode/tex_highlight_rules",["require","exports","module","ace/lib/oop","ace/lib/lang","ace/mode/text_highlight_rules"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../lib/oop");
var lang = acequire("../lib/lang");
var TextHighlightRules = acequire("./text_highlight_rules").TextHighlightRules;

var TexHighlightRules = function(textClass) {

    if (!textClass)
        textClass = "text";

    this.$rules = {
        "start" : [
            {
                token : "comment",
                regex : "%.*$"
            }, {
                token : textClass, // non-command
                regex : "\\\\[$&%#\\{\\}]"
            }, {
                token : "keyword", // command
                regex : "\\\\(?:documentclass|usepackage|newcounter|setcounter|addtocounter|value|arabic|stepcounter|newenvironment|renewenvironment|ref|vref|eqref|pageref|label|cite[a-zA-Z]*|tag|begin|end|bibitem)\\b",
               next : "nospell"
            }, {
                token : "keyword", // command
                regex : "\\\\(?:[a-zA-Z0-9]+|[^a-zA-Z0-9])"
            }, {
               token : "paren.keyword.operator",
                regex : "[[({]"
            }, {
               token : "paren.keyword.operator",
                regex : "[\\])}]"
            }, {
                token : textClass,
                regex : "\\s+"
            }
        ],
        "nospell" : [
           {
               token : "comment",
               regex : "%.*$",
               next : "start"
           }, {
               token : "nospell." + textClass, // non-command
               regex : "\\\\[$&%#\\{\\}]"
           }, {
               token : "keyword", // command
               regex : "\\\\(?:documentclass|usepackage|newcounter|setcounter|addtocounter|value|arabic|stepcounter|newenvironment|renewenvironment|ref|vref|eqref|pageref|label|cite[a-zA-Z]*|tag|begin|end|bibitem)\\b"
           }, {
               token : "keyword", // command
               regex : "\\\\(?:[a-zA-Z0-9]+|[^a-zA-Z0-9])",
               next : "start"
           }, {
               token : "paren.keyword.operator",
               regex : "[[({]"
           }, {
               token : "paren.keyword.operator",
               regex : "[\\])]"
           }, {
               token : "paren.keyword.operator",
               regex : "}",
               next : "start"
           }, {
               token : "nospell." + textClass,
               regex : "\\s+"
           }, {
               token : "nospell." + textClass,
               regex : "\\w+"
           }
        ]
    };
};

oop.inherits(TexHighlightRules, TextHighlightRules);

exports.TexHighlightRules = TexHighlightRules;
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

ace.define("ace/mode/tex",["require","exports","module","ace/lib/oop","ace/mode/text","ace/mode/text_highlight_rules","ace/mode/tex_highlight_rules","ace/mode/matching_brace_outdent"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../lib/oop");
var TextMode = acequire("./text").Mode;
var TextHighlightRules = acequire("./text_highlight_rules").TextHighlightRules;
var TexHighlightRules = acequire("./tex_highlight_rules").TexHighlightRules;
var MatchingBraceOutdent = acequire("./matching_brace_outdent").MatchingBraceOutdent;

var Mode = function(suppressHighlighting) {
    if (suppressHighlighting)
        this.HighlightRules = TextHighlightRules;
    else
        this.HighlightRules = TexHighlightRules;
    this.$outdent = new MatchingBraceOutdent();
    this.$behaviour = this.$defaultBehaviour;
};
oop.inherits(Mode, TextMode);

(function() {
   this.lineCommentStart = "%";
   this.getNextLineIndent = function(state, line, tab) {
      return this.$getIndent(line);
   };

   this.allowAutoInsert = function() {
      return false;
   };
    this.$id = "ace/mode/tex";
}).call(Mode.prototype);

exports.Mode = Mode;
});
