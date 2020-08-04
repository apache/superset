ace.define("ace/mode/textile_highlight_rules",["require","exports","module","ace/lib/oop","ace/mode/text_highlight_rules"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../lib/oop");
var TextHighlightRules = acequire("./text_highlight_rules").TextHighlightRules;

var TextileHighlightRules = function() {
    this.$rules = {
        "start" : [
            {
                token : function(value) {
                    if (value.charAt(0) == "h")
                        return "markup.heading." + value.charAt(1);
                    else
                        return "markup.heading";
                },
                regex : "h1|h2|h3|h4|h5|h6|bq|p|bc|pre",
                next  : "blocktag"
            },
            {
                token : "keyword",
                regex : "[\\*]+|[#]+"
            },
            {
                token : "text",
                regex : ".+"
            }
        ],
        "blocktag" : [
            {
                token : "keyword",
                regex : "\\. ",
                next  : "start"
            },
            {
                token : "keyword",
                regex : "\\(",
                next  : "blocktagproperties"
            }
        ],
        "blocktagproperties" : [
            {
                token : "keyword",
                regex : "\\)",
                next  : "blocktag"
            },
            {
                token : "string",
                regex : "[a-zA-Z0-9\\-_]+"
            },
            {
                token : "keyword",
                regex : "#"
            }
        ]
    };
};

oop.inherits(TextileHighlightRules, TextHighlightRules);

exports.TextileHighlightRules = TextileHighlightRules;

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

ace.define("ace/mode/textile",["require","exports","module","ace/lib/oop","ace/mode/text","ace/mode/textile_highlight_rules","ace/mode/matching_brace_outdent"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../lib/oop");
var TextMode = acequire("./text").Mode;
var TextileHighlightRules = acequire("./textile_highlight_rules").TextileHighlightRules;
var MatchingBraceOutdent = acequire("./matching_brace_outdent").MatchingBraceOutdent;

var Mode = function() {
    this.HighlightRules = TextileHighlightRules;
    this.$outdent = new MatchingBraceOutdent();
    this.$behaviour = this.$defaultBehaviour;
};
oop.inherits(Mode, TextMode);

(function() {
    this.type = "text";
    this.getNextLineIndent = function(state, line, tab) {
        if (state == "intag")
            return tab;
        
        return "";
    };

    this.checkOutdent = function(state, line, input) {
        return this.$outdent.checkOutdent(line, input);
    };

    this.autoOutdent = function(state, doc, row) {
        this.$outdent.autoOutdent(doc, row);
    };
    
    this.$id = "ace/mode/textile";
}).call(Mode.prototype);

exports.Mode = Mode;

});
