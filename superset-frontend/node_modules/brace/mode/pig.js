ace.define("ace/mode/pig_highlight_rules",["require","exports","module","ace/lib/oop","ace/mode/text_highlight_rules"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../lib/oop");
var TextHighlightRules = acequire("./text_highlight_rules").TextHighlightRules;

var PigHighlightRules = function() {

    this.$rules = {
        start: [{
            token: "comment.block.pig",
            regex: /\/\*/,
            push: [{
                token: "comment.block.pig",
                regex: /\*\//,
                next: "pop"
            }, {
                defaultToken: "comment.block.pig"
            }]
        }, {
            token: "comment.line.double-dash.asciidoc",
            regex: /--.*$/
        }, {
            token: "keyword.control.pig",
            regex: /\b(?:ASSERT|LOAD|STORE|DUMP|FILTER|DISTINCT|FOREACH|GENERATE|STREAM|JOIN|COGROUP|GROUP|CROSS|ORDER|LIMIT|UNION|SPLIT|DESCRIBE|EXPLAIN|ILLUSTRATE|AS|BY|INTO|USING|LIMIT|PARALLEL|OUTER|INNER|DEFAULT|LEFT|SAMPLE|RANK|CUBE|ALL|KILL|QUIT|MAPREDUCE|ASC|DESC|THROUGH|SHIP|CACHE|DECLARE|CASE|WHEN|THEN|END|IN|PARTITION|FULL|IMPORT|IF|ONSCHEMA|INPUT|OUTPUT)\b/,
            caseInsensitive: true
        }, {
            token: "storage.datatypes.pig",
            regex: /\b(?:int|long|float|double|chararray|bytearray|boolean|datetime|biginteger|bigdecimal|tuple|bag|map)\b/,
            caseInsensitive: true
        }, {
            token: "support.function.storage.pig",
            regex: /\b(?:PigStorage|BinStorage|BinaryStorage|PigDump|HBaseStorage|JsonLoader|JsonStorage|AvroStorage|TextLoader|PigStreaming|TrevniStorage|AccumuloStorage)\b/
        }, {
            token: "support.function.udf.pig",
            regex: /\b(?:DIFF|TOBAG|TOMAP|TOP|TOTUPLE|RANDOM|FLATTEN|flatten|CUBE|ROLLUP|IsEmpty|ARITY|PluckTuple|SUBTRACT|BagToString)\b/
        }, {
            token: "support.function.udf.math.pig",
            regex: /\b(?:ABS|ACOS|ASIN|ATAN|CBRT|CEIL|COS|COSH|EXP|FLOOR|LOG|LOG10|ROUND|ROUND_TO|SIN|SINH|SQRT|TAN|TANH|AVG|COUNT|COUNT_STAR|MAX|MIN|SUM|COR|COV)\b/
        }, {
            token: "support.function.udf.string.pig",
            regex: /\b(?:CONCAT|INDEXOF|LAST_INDEX_OF|LCFIRST|LOWER|REGEX_EXTRACT|REGEX_EXTRACT_ALL|REPLACE|SIZE|STRSPLIT|SUBSTRING|TOKENIZE|TRIM|UCFIRST|UPPER|LTRIM|RTRIM|ENDSWITH|STARTSWITH|TRIM)\b/
        }, {
            token: "support.function.udf.datetime.pig",
            regex: /\b(?:AddDuration|CurrentTime|DaysBetween|GetDay|GetHour|GetMilliSecond|GetMinute|GetMonth|GetSecond|GetWeek|GetWeekYear|GetYear|HoursBetween|MilliSecondsBetween|MinutesBetween|MonthsBetween|SecondsBetween|SubtractDuration|ToDate|WeeksBetween|YearsBetween|ToMilliSeconds|ToString|ToUnixTime)\b/
        }, {
            token: "support.function.command.pig",
            regex: /\b(?:cat|cd|copyFromLocal|copyToLocal|cp|ls|mkdir|mv|pwd|rm)\b/
        }, {
            token: "variable.pig",
            regex: /\$[a_zA-Z0-9_]+/
        }, {
            token: "constant.language.pig",
            regex: /\b(?:NULL|true|false|stdin|stdout|stderr)\b/,
            caseInsensitive: true
        }, {
            token: "constant.numeric.pig",
            regex: /\b\d+(?:\.\d+)?\b/
        }, {
            token: "keyword.operator.comparison.pig",
            regex: /!=|==|<|>|<=|>=|\b(?:MATCHES|IS|OR|AND|NOT)\b/,
            caseInsensitive: true
        }, {
            token: "keyword.operator.arithmetic.pig",
            regex: /\+|\-|\*|\/|\%|\?|:|::|\.\.|#/
        }, {
            token: "string.quoted.double.pig",
            regex: /"/,
            push: [{
                token: "string.quoted.double.pig",
                regex: /"/,
                next: "pop"
            }, {
                token: "constant.character.escape.pig",
                regex: /\\./
            }, {
                defaultToken: "string.quoted.double.pig"
            }]
        }, {
            token: "string.quoted.single.pig",
            regex: /'/,
            push: [{
                token: "string.quoted.single.pig",
                regex: /'/,
                next: "pop"
            }, {
                token: "constant.character.escape.pig",
                regex: /\\./
            }, {
                defaultToken: "string.quoted.single.pig"
            }]
        }, {
            todo: {
                token: [
                    "text",
                    "keyword.parameter.pig",
                    "text",
                    "storage.type.parameter.pig"
                ],
                regex: /^(\s*)(set)(\s+)(\S+)/,
                caseInsensitive: true,
                push: [{
                    token: "text",
                    regex: /$/,
                    next: "pop"
                }, {
                    include: "$self"
                }]
            }
        }, {
            token: [
                "text",
                "keyword.alias.pig",
                "text",
                "storage.type.alias.pig"
            ],
            regex: /(\s*)(DEFINE|DECLARE|REGISTER)(\s+)(\S+)/,
            caseInsensitive: true,
            push: [{
                token: "text",
                regex: /;?$/,
                next: "pop"
            }]
        }]
    };

    this.normalizeRules();
};

PigHighlightRules.metaData = {
    fileTypes: ["pig"],
    name: "Pig",
    scopeName: "source.pig"
};


oop.inherits(PigHighlightRules, TextHighlightRules);

exports.PigHighlightRules = PigHighlightRules;
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

ace.define("ace/mode/pig",["require","exports","module","ace/lib/oop","ace/mode/text","ace/mode/pig_highlight_rules","ace/mode/folding/cstyle"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../lib/oop");
var TextMode = acequire("./text").Mode;
var PigHighlightRules = acequire("./pig_highlight_rules").PigHighlightRules;
var FoldMode = acequire("./folding/cstyle").FoldMode;

var Mode = function() {
    this.HighlightRules = PigHighlightRules;
    this.foldingRules = new FoldMode();
};
oop.inherits(Mode, TextMode);

(function() {
    this.lineCommentStart = "--";
    this.blockComment = {start: "/*", end: "*/"};
    this.$id = "ace/mode/pig";
}).call(Mode.prototype);

exports.Mode = Mode;
});
