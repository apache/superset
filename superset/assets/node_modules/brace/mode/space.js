ace.define("ace/mode/folding/coffee",["require","exports","module","ace/lib/oop","ace/mode/folding/fold_mode","ace/range"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../../lib/oop");
var BaseFoldMode = acequire("./fold_mode").FoldMode;
var Range = acequire("../../range").Range;

var FoldMode = exports.FoldMode = function() {};
oop.inherits(FoldMode, BaseFoldMode);

(function() {

    this.getFoldWidgetRange = function(session, foldStyle, row) {
        var range = this.indentationBlock(session, row);
        if (range)
            return range;

        var re = /\S/;
        var line = session.getLine(row);
        var startLevel = line.search(re);
        if (startLevel == -1 || line[startLevel] != "#")
            return;

        var startColumn = line.length;
        var maxRow = session.getLength();
        var startRow = row;
        var endRow = row;

        while (++row < maxRow) {
            line = session.getLine(row);
            var level = line.search(re);

            if (level == -1)
                continue;

            if (line[level] != "#")
                break;

            endRow = row;
        }

        if (endRow > startRow) {
            var endColumn = session.getLine(endRow).length;
            return new Range(startRow, startColumn, endRow, endColumn);
        }
    };
    this.getFoldWidget = function(session, foldStyle, row) {
        var line = session.getLine(row);
        var indent = line.search(/\S/);
        var next = session.getLine(row + 1);
        var prev = session.getLine(row - 1);
        var prevIndent = prev.search(/\S/);
        var nextIndent = next.search(/\S/);

        if (indent == -1) {
            session.foldWidgets[row - 1] = prevIndent!= -1 && prevIndent < nextIndent ? "start" : "";
            return "";
        }
        if (prevIndent == -1) {
            if (indent == nextIndent && line[indent] == "#" && next[indent] == "#") {
                session.foldWidgets[row - 1] = "";
                session.foldWidgets[row + 1] = "";
                return "start";
            }
        } else if (prevIndent == indent && line[indent] == "#" && prev[indent] == "#") {
            if (session.getLine(row - 2).search(/\S/) == -1) {
                session.foldWidgets[row - 1] = "start";
                session.foldWidgets[row + 1] = "";
                return "";
            }
        }

        if (prevIndent!= -1 && prevIndent < indent)
            session.foldWidgets[row - 1] = "start";
        else
            session.foldWidgets[row - 1] = "";

        if (indent < nextIndent)
            return "start";
        else
            return "";
    };

}).call(FoldMode.prototype);

});

ace.define("ace/mode/space_highlight_rules",["require","exports","module","ace/lib/oop","ace/mode/text_highlight_rules"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../lib/oop");
var TextHighlightRules = acequire("./text_highlight_rules").TextHighlightRules;

var SpaceHighlightRules = function() {
    this.$rules = {
        "start" : [
            {
                token : "empty_line",
                regex : / */,
                next : "key"
            },
            {
                token : "empty_line",
                regex : /$/,
                next : "key"
            }
        ],
        "key" : [
            {
                token : "variable",
                regex : /\S+/
            },
            {
                token : "empty_line",
                regex : /$/,
                next : "start"
            },{
                token : "keyword.operator",
                regex : / /,
                next  : "value"
            }
        ],
        "value" : [
            {
                token : "keyword.operator",
                regex : /$/,
                next  : "start"
            },
            {
                token : "string",
                regex : /[^$]/
            }
        ]
    };
    
};

oop.inherits(SpaceHighlightRules, TextHighlightRules);

exports.SpaceHighlightRules = SpaceHighlightRules;
});

ace.define("ace/mode/space",["require","exports","module","ace/lib/oop","ace/mode/text","ace/mode/folding/coffee","ace/mode/space_highlight_rules"], function(acequire, exports, module) {
"use strict";
var oop = acequire("../lib/oop");
var TextMode = acequire("./text").Mode;
var FoldMode = acequire("./folding/coffee").FoldMode;
var SpaceHighlightRules = acequire("./space_highlight_rules").SpaceHighlightRules;
var Mode = function() {
    this.HighlightRules = SpaceHighlightRules;
    this.foldingRules = new FoldMode();
    this.$behaviour = this.$defaultBehaviour;
};
oop.inherits(Mode, TextMode);
(function() {
    
    this.$id = "ace/mode/space";
}).call(Mode.prototype);
exports.Mode = Mode;
});
