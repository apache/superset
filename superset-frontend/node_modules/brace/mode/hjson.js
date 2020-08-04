ace.define("ace/mode/hjson_highlight_rules",["require","exports","module","ace/lib/oop","ace/mode/text_highlight_rules"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../lib/oop");
var TextHighlightRules = acequire("./text_highlight_rules").TextHighlightRules;

var HjsonHighlightRules = function() {

    this.$rules = {
        start: [{
            include: "#comments"
        }, {
            include: "#rootObject"
        }, {
            include: "#value"
        }],
        "#array": [{
            token: "paren.lparen",
            regex: /\[/,
            push: [{
                token: "paren.rparen",
                regex: /\]/,
                next: "pop"
            }, {
                include: "#value"
            }, {
                include: "#comments"
            }, {
                token: "text",
                regex: /,|$/
            }, {
                token: "invalid.illegal",
                regex: /[^\s\]]/
            }, {
                defaultToken: "array"
            }]
        }],
        "#comments": [{
            token: [
                "comment.punctuation",
                "comment.line"
            ],
            regex: /(#)(.*$)/
        }, {
            token: "comment.punctuation",
            regex: /\/\*/,
            push: [{
                token: "comment.punctuation",
                regex: /\*\//,
                next: "pop"
            }, {
                defaultToken: "comment.block"
            }]
        }, {
            token: [
                "comment.punctuation",
                "comment.line"
            ],
            regex: /(\/\/)(.*$)/
        }],
        "#constant": [{
            token: "constant",
            regex: /\b(?:true|false|null)\b/
        }],
        "#keyname": [{
            token: "keyword",
            regex: /(?:[^,\{\[\}\]\s]+|"(?:[^"\\]|\\.)*")\s*(?=:)/
        }],
        "#mstring": [{
            token: "string",
            regex: /'''/,
            push: [{
                token: "string",
                regex: /'''/,
                next: "pop"
            }, {
                defaultToken: "string"
            }]
        }],
        "#number": [{
            token: "constant.numeric",
            regex: /-?(?:0|[1-9]\d*)(?:(?:\.\d+)?(?:[eE][+-]?\d+)?)?/,
            comment: "handles integer and decimal numbers"
        }],
        "#object": [{
            token: "paren.lparen",
            regex: /\{/,
            push: [{
                token: "paren.rparen",
                regex: /\}/,
                next: "pop"
            }, {
                include: "#keyname"
            }, {
                include: "#value"
            }, {
                token: "text",
                regex: /:/
            }, {
                token: "text",
                regex: /,/
            }, {
                defaultToken: "paren"
            }]
        }],
        "#rootObject": [{
            token: "paren",
            regex: /(?=\s*(?:[^,\{\[\}\]\s]+|"(?:[^"\\]|\\.)*")\s*:)/,
            push: [{
                token: "paren.rparen",
                regex: /---none---/,
                next: "pop"
            }, {
                include: "#keyname"
            }, {
                include: "#value"
            }, {
                token: "text",
                regex: /:/
            }, {
                token: "text",
                regex: /,/
            }, {
                defaultToken: "paren"
            }]
        }],
        "#string": [{
            token: "string",
            regex: /"/,
            push: [{
                token: "string",
                regex: /"/,
                next: "pop"
            }, {
                token: "constant.language.escape",
                regex: /\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/
            }, {
                token: "invalid.illegal",
                regex: /\\./
            }, {
                defaultToken: "string"
            }]
        }],
        "#ustring": [{
            token: "string",
            regex: /\b[^:,0-9\-\{\[\}\]\s].*$/
        }],
        "#value": [{
            include: "#constant"
        }, {
            include: "#number"
        }, {
            include: "#string"
        }, {
            include: "#array"
        }, {
            include: "#object"
        }, {
            include: "#comments"
        }, {
            include: "#mstring"
        }, {
            include: "#ustring"
        }]
    };

    this.normalizeRules();
};

HjsonHighlightRules.metaData = {
    fileTypes: ["hjson"],
    foldingStartMarker: "(?x:     # turn on extended mode\n              ^    # a line beginning with\n              \\s*    # some optional space\n              [{\\[]  # the start of an object or array\n              (?!    # but not followed by\n              .*   # whatever\n              [}\\]]  # and the close of an object or array\n              ,?   # an optional comma\n              \\s*  # some optional space\n              $    # at the end of the line\n              )\n              |    # ...or...\n              [{\\[]  # the start of an object or array\n              \\s*    # some optional space\n              $    # at the end of the line\n            )",
    foldingStopMarker: "(?x:   # turn on extended mode\n             ^    # a line beginning with\n             \\s*  # some optional space\n             [}\\]]  # and the close of an object or array\n             )",
    keyEquivalent: "^~J",
    name: "Hjson",
    scopeName: "source.hjson"
};


oop.inherits(HjsonHighlightRules, TextHighlightRules);

exports.HjsonHighlightRules = HjsonHighlightRules;
});

ace.define("ace/mode/folding/cstyle",["require","exports","module","ace/lib/oop","ace/range","ace/mode/folding/fold_mode"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../../lib/oop");
var Range = acequire("../../range").Range;
var BaseFoldMode = acequire("./fold_mode").FoldMode;

var FoldMode = exports.FoldMode = function(commentRegex) {
    if (commentRegex) {
        this.foldingStartMarker = new RegExp(
            this.foldingStartMarker.source.replace(/\|[^|]*?$/, "|" + commentRegex.start)
        );
        this.foldingStopMarker = new RegExp(
            this.foldingStopMarker.source.replace(/\|[^|]*?$/, "|" + commentRegex.end)
        );
    }
};
oop.inherits(FoldMode, BaseFoldMode);

(function() {

    this.foldingStartMarker = /([\{\[\(])[^\}\]\)]*$|^\s*(\/\*)/;
    this.foldingStopMarker = /^[^\[\{\(]*([\}\]\)])|^[\s\*]*(\*\/)/;
    this.singleLineBlockCommentRe= /^\s*(\/\*).*\*\/\s*$/;
    this.tripleStarBlockCommentRe = /^\s*(\/\*\*\*).*\*\/\s*$/;
    this.startRegionRe = /^\s*(\/\*|\/\/)#?region\b/;
    this._getFoldWidgetBase = this.getFoldWidget;
    this.getFoldWidget = function(session, foldStyle, row) {
        var line = session.getLine(row);

        if (this.singleLineBlockCommentRe.test(line)) {
            if (!this.startRegionRe.test(line) && !this.tripleStarBlockCommentRe.test(line))
                return "";
        }

        var fw = this._getFoldWidgetBase(session, foldStyle, row);

        if (!fw && this.startRegionRe.test(line))
            return "start"; // lineCommentRegionStart

        return fw;
    };

    this.getFoldWidgetRange = function(session, foldStyle, row, forceMultiline) {
        var line = session.getLine(row);

        if (this.startRegionRe.test(line))
            return this.getCommentRegionBlock(session, line, row);

        var match = line.match(this.foldingStartMarker);
        if (match) {
            var i = match.index;

            if (match[1])
                return this.openingBracketBlock(session, match[1], row, i);

            var range = session.getCommentFoldRange(row, i + match[0].length, 1);

            if (range && !range.isMultiLine()) {
                if (forceMultiline) {
                    range = this.getSectionRange(session, row);
                } else if (foldStyle != "all")
                    range = null;
            }

            return range;
        }

        if (foldStyle === "markbegin")
            return;

        var match = line.match(this.foldingStopMarker);
        if (match) {
            var i = match.index + match[0].length;

            if (match[1])
                return this.closingBracketBlock(session, match[1], row, i);

            return session.getCommentFoldRange(row, i, -1);
        }
    };

    this.getSectionRange = function(session, row) {
        var line = session.getLine(row);
        var startIndent = line.search(/\S/);
        var startRow = row;
        var startColumn = line.length;
        row = row + 1;
        var endRow = row;
        var maxRow = session.getLength();
        while (++row < maxRow) {
            line = session.getLine(row);
            var indent = line.search(/\S/);
            if (indent === -1)
                continue;
            if  (startIndent > indent)
                break;
            var subRange = this.getFoldWidgetRange(session, "all", row);

            if (subRange) {
                if (subRange.start.row <= startRow) {
                    break;
                } else if (subRange.isMultiLine()) {
                    row = subRange.end.row;
                } else if (startIndent == indent) {
                    break;
                }
            }
            endRow = row;
        }

        return new Range(startRow, startColumn, endRow, session.getLine(endRow).length);
    };
    this.getCommentRegionBlock = function(session, line, row) {
        var startColumn = line.search(/\s*$/);
        var maxRow = session.getLength();
        var startRow = row;

        var re = /^\s*(?:\/\*|\/\/|--)#?(end)?region\b/;
        var depth = 1;
        while (++row < maxRow) {
            line = session.getLine(row);
            var m = re.exec(line);
            if (!m) continue;
            if (m[1]) depth--;
            else depth++;

            if (!depth) break;
        }

        var endRow = row;
        if (endRow > startRow) {
            return new Range(startRow, startColumn, endRow, line.length);
        }
    };

}).call(FoldMode.prototype);

});

ace.define("ace/mode/hjson",["require","exports","module","ace/lib/oop","ace/mode/text","ace/mode/hjson_highlight_rules","ace/mode/folding/cstyle"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../lib/oop");
var TextMode = acequire("./text").Mode;
var HjsonHighlightRules = acequire("./hjson_highlight_rules").HjsonHighlightRules;
var FoldMode = acequire("./folding/cstyle").FoldMode;

var Mode = function() {
    this.HighlightRules = HjsonHighlightRules;
    this.foldingRules = new FoldMode();
};
oop.inherits(Mode, TextMode);

(function() {
    this.lineCommentStart = "//";
    this.blockComment = { start: "/*", end: "*/" };
    this.$id = "ace/mode/hjson";
}).call(Mode.prototype);

exports.Mode = Mode;
});
