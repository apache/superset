ace.define("ace/mode/turtle_highlight_rules",["require","exports","module","ace/lib/oop","ace/mode/text_highlight_rules"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../lib/oop");
var TextHighlightRules = acequire("./text_highlight_rules").TextHighlightRules;

var TurtleHighlightRules = function() {

    this.$rules = {
        start: [{
            include: "#comments"
        }, {
            include: "#strings"
        }, {
            include: "#base-prefix-declarations"
        }, {
            include: "#string-language-suffixes"
        }, {
            include: "#string-datatype-suffixes"
        }, {
            include: "#relative-urls"
        }, {
            include: "#xml-schema-types"
        }, {
            include: "#rdf-schema-types"
        }, {
            include: "#owl-types"
        }, {
            include: "#qnames"
        }, {
            include: "#punctuation-operators"
        }],
        "#base-prefix-declarations": [{
            token: "keyword.other.prefix.turtle",
            regex: /@(?:base|prefix)/
        }],
        "#comments": [{
            token: [
                "punctuation.definition.comment.turtle",
                "comment.line.hash.turtle"
            ],
            regex: /(#)(.*$)/
        }],
        "#owl-types": [{
            token: "support.type.datatype.owl.turtle",
            regex: /owl:[a-zA-Z]+/
        }],
        "#punctuation-operators": [{
            token: "keyword.operator.punctuation.turtle",
            regex: /;|,|\.|\(|\)|\[|\]/
        }],
        "#qnames": [{
            token: "entity.name.other.qname.turtle",
            regex: /(?:[a-zA-Z][-_a-zA-Z0-9]*)?:(?:[_a-zA-Z][-_a-zA-Z0-9]*)?/
        }],
        "#rdf-schema-types": [{
            token: "support.type.datatype.rdf.schema.turtle",
            regex: /rdfs?:[a-zA-Z]+|(?:^|\s)a(?:\s|$)/
        }],
        "#relative-urls": [{
            token: "string.quoted.other.relative.url.turtle",
            regex: /</,
            push: [{
                token: "string.quoted.other.relative.url.turtle",
                regex: />/,
                next: "pop"
            }, {
                defaultToken: "string.quoted.other.relative.url.turtle"
            }]
        }],
        "#string-datatype-suffixes": [{
            token: "keyword.operator.datatype.suffix.turtle",
            regex: /\^\^/
        }],
        "#string-language-suffixes": [{
            token: [
                "keyword.operator.language.suffix.turtle",
                "constant.language.suffix.turtle"
            ],
            regex: /(?!")(@)([a-z]+(?:\-[a-z0-9]+)*)/
        }],
        "#strings": [{
            token: "string.quoted.triple.turtle",
            regex: /"""/,
            push: [{
                token: "string.quoted.triple.turtle",
                regex: /"""/,
                next: "pop"
            }, {
                defaultToken: "string.quoted.triple.turtle"
            }]
        }, {
            token: "string.quoted.double.turtle",
            regex: /"/,
            push: [{
                token: "string.quoted.double.turtle",
                regex: /"/,
                next: "pop"
            }, {
                token: "invalid.string.newline",
                regex: /$/
            }, {
                token: "constant.character.escape.turtle",
                regex: /\\./
            }, {
                defaultToken: "string.quoted.double.turtle"
            }]
        }],
        "#xml-schema-types": [{
            token: "support.type.datatype.xml.schema.turtle",
            regex: /xsd?:[a-z][a-zA-Z]+/
        }]
    };

    this.normalizeRules();
};

TurtleHighlightRules.metaData = {
    fileTypes: ["ttl", "nt"],
    name: "Turtle",
    scopeName: "source.turtle"
};


oop.inherits(TurtleHighlightRules, TextHighlightRules);

exports.TurtleHighlightRules = TurtleHighlightRules;
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

ace.define("ace/mode/turtle",["require","exports","module","ace/lib/oop","ace/mode/text","ace/mode/turtle_highlight_rules","ace/mode/folding/cstyle"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../lib/oop");
var TextMode = acequire("./text").Mode;
var TurtleHighlightRules = acequire("./turtle_highlight_rules").TurtleHighlightRules;
var FoldMode = acequire("./folding/cstyle").FoldMode;

var Mode = function() {
    this.HighlightRules = TurtleHighlightRules;
    this.foldingRules = new FoldMode();
};
oop.inherits(Mode, TextMode);

(function() {
    this.$id = "ace/mode/turtle";
}).call(Mode.prototype);

exports.Mode = Mode;
});
