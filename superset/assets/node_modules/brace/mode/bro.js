ace.define("ace/mode/bro_highlight_rules",["require","exports","module","ace/lib/oop","ace/mode/text_highlight_rules"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../lib/oop");
var TextHighlightRules = acequire("./text_highlight_rules").TextHighlightRules;

var BroHighlightRules = function() {

    this.$rules = {
        start: [{
            token: "punctuation.definition.comment.bro",
            regex: /#/,
            push: [{
                token: "comment.line.number-sign.bro",
                regex: /$/,
                next: "pop"
            }, {
                defaultToken: "comment.line.number-sign.bro"
            }]
        }, {
            token: "keyword.control.bro",
            regex: /\b(?:break|case|continue|else|for|if|return|switch|next|when|timeout|schedule)\b/
        }, {
            token: [
                "meta.function.bro",
                "meta.function.bro",
                "storage.type.bro",
                "meta.function.bro",
                "entity.name.function.bro",
                "meta.function.bro"
            ],
            regex: /^(\s*)(?:function|hook|event)(\s*)(.*)(\s*\()(.*)(\).*$)/
        }, {
            token: "storage.type.bro",
            regex: /\b(?:bool|enum|double|int|count|port|addr|subnet|any|file|interval|time|string|table|vector|set|record|pattern|hook)\b/
        }, {
            token: "storage.modifier.bro",
            regex: /\b(?:global|const|redef|local|&(?:optional|rotate_interval|rotate_size|add_func|del_func|expire_func|expire_create|expire_read|expire_write|persistent|synchronized|encrypt|mergeable|priority|group|type_column|log|error_handler))\b/
        }, {
            token: "keyword.operator.bro",
            regex: /\s*(?:\||&&|(?:>|<|!)=?|==)\s*|\b!?in\b/
        }, {
            token: "constant.language.bro",
            regex: /\b(?:T|F)\b/
        }, {
            token: "constant.numeric.bro",
            regex: /\b(?:0(?:x|X)[0-9a-fA-F]*|(?:[0-9]+\.?[0-9]*|\.[0-9]+)(?:(?:e|E)(?:\+|-)?[0-9]+)?)(?:\/(?:tcp|udp|icmp)|\s*(?:u?sec|min|hr|day)s?)?\b/
        }, {
            token: "punctuation.definition.string.begin.bro",
            regex: /"/,
            push: [{
                token: "punctuation.definition.string.end.bro",
                regex: /"/,
                next: "pop"
            }, {
                include: "#string_escaped_char"
            }, {
                include: "#string_placeholder"
            }, {
                defaultToken: "string.quoted.double.bro"
            }]
        }, {
            token: "punctuation.definition.string.begin.bro",
            regex: /\//,
            push: [{
                token: "punctuation.definition.string.end.bro",
                regex: /\//,
                next: "pop"
            }, {
                include: "#string_escaped_char"
            }, {
                include: "#string_placeholder"
            }, {
                defaultToken: "string.quoted.regex.bro"
            }]
        }, {
            token: [
                "meta.preprocessor.bro.load",
                "keyword.other.special-method.bro"
            ],
            regex: /^(\s*)(\@load(?:-sigs)?)\b/,
            push: [{
                token: [],
                regex: /(?=\#)|$/,
                next: "pop"
            }, {
                defaultToken: "meta.preprocessor.bro.load"
            }]
        }, {
            token: [
                "meta.preprocessor.bro.if",
                "keyword.other.special-method.bro",
                "meta.preprocessor.bro.if"
            ],
            regex: /^(\s*)(\@endif|\@if(?:n?def)?)(.*$)/,
            push: [{
                token: [],
                regex: /$/,
                next: "pop"
            }, {
                defaultToken: "meta.preprocessor.bro.if"
            }]
        }],
        "#disabled": [{
            token: "text",
            regex: /^\s*\@if(?:n?def)?\b.*$/,
            push: [{
                token: "text",
                regex: /^\s*\@endif\b.*$/,
                next: "pop"
            }, {
                include: "#disabled"
            }, {
                include: "#pragma-mark"
            }],
            comment: "eat nested preprocessor ifdefs"
        }],
        "#preprocessor-rule-other": [{
            token: [
                "text",
                "meta.preprocessor.bro",
                "meta.preprocessor.bro",
                "text"
            ],
            regex: /^(\s*)(@if)((?:n?def)?)\b(.*?)(?:(?=)|$)/,
            push: [{
                token: ["text", "meta.preprocessor.bro", "text"],
                regex: /^(\s*)(@endif)\b(.*$)/,
                next: "pop"
            }, {
                include: "$base"
            }]
        }],
        "#string_escaped_char": [{
            token: "constant.character.escape.bro",
            regex: /\\(?:\\|[abefnprtv'"?]|[0-3]\d{,2}|[4-7]\d?|x[a-fA-F0-9]{,2})/
        }, {
            token: "invalid.illegal.unknown-escape.bro",
            regex: /\\./
        }],
        "#string_placeholder": [{
            token: "constant.other.placeholder.bro",
            regex: /%(?:\d+\$)?[#0\- +']*[,;:_]?(?:-?\d+|\*(?:-?\d+\$)?)?(?:\.(?:-?\d+|\*(?:-?\d+\$)?)?)?(?:hh|h|ll|l|j|t|z|q|L|vh|vl|v|hv|hl)?[diouxXDOUeEfFgGaACcSspn%]/
        }, {
            token: "invalid.illegal.placeholder.bro",
            regex: /%/
        }]
    };

    this.normalizeRules();
};

BroHighlightRules.metaData = {
    fileTypes: ["bro"],
    foldingStartMarker: "^(\\@if(n?def)?)",
    foldingStopMarker: "^\\@endif",
    keyEquivalent: "@B",
    name: "Bro",
    scopeName: "source.bro"
};


oop.inherits(BroHighlightRules, TextHighlightRules);

exports.BroHighlightRules = BroHighlightRules;
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

ace.define("ace/mode/bro",["require","exports","module","ace/lib/oop","ace/mode/text","ace/mode/bro_highlight_rules","ace/mode/folding/cstyle"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../lib/oop");
var TextMode = acequire("./text").Mode;
var BroHighlightRules = acequire("./bro_highlight_rules").BroHighlightRules;
var FoldMode = acequire("./folding/cstyle").FoldMode;

var Mode = function() {
    this.HighlightRules = BroHighlightRules;
    this.foldingRules = new FoldMode();
};
oop.inherits(Mode, TextMode);

(function() {
    this.$id = "ace/mode/bro";
}).call(Mode.prototype);

exports.Mode = Mode;
});
