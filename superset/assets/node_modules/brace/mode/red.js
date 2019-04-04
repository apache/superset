ace.define("ace/mode/red_highlight_rules",["require","exports","module","ace/lib/oop","ace/mode/text_highlight_rules"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../lib/oop");
var TextHighlightRules = acequire("./text_highlight_rules").TextHighlightRules;

var RedHighlightRules = function() {

    var compoundKeywords = "";

    this.$rules = {
        "start" : [
            {token : "keyword.operator",
                regex: /\s([\-+%/=<>*]|(?:\*\*\|\/\/|==|>>>?|<>|<<|=>|<=|=\?))(\s|(?=:))/},
            {token : "string.email", regex : /\w[-\w._]*\@\w[-\w._]*/},
            {token : "value.time", regex : /\b\d+:\d+(:\d+)?/},
            {token : "string.url", regex : /\w[-\w_]*\:(\/\/)?\w[-\w._]*(:\d+)?/},
            {token : "value.date", regex : /(\b\d{1,4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{1,4})\b/},
            {token : "value.tuple", regex : /\b\d{1,3}\.\d{1,3}\.\d{1,3}(\.\d{1,3}){0,9}/},
            {token : "value.pair", regex: /[+-]?\d+x[-+]?\d+/},
            {token : "value.binary", regex : /\b2#{([01]{8})+}/},
            {token : "value.binary", regex : /\b64#{([\w/=+])+}/},
            {token : "value.binary", regex : /(16)?#{([\dabcdefABCDEF][\dabcdefABCDEF])*}/},
            {token : "value.issue", regex : /#\w[-\w'*.]*/},
            {token : "value.numeric", regex: /[+-]?\d['\d]*(?:\.\d+)?e[-+]?\d{1,3}\%?(?!\w)/},
            {token : "invalid.illegal", regex: /[+-]?\d['\d]*(?:\.\d+)?\%?[a-zA-Z]/},
            {token : "value.numeric", regex: /[+-]?\d['\d]*(?:\.\d+)?\%?(?![a-zA-Z])/},
            {token : "value.character", regex : /#"(\^[-@/_~^"HKLM\[]|.)"/},
            {token : "string.file", regex : /%[-\w\.\/]+/},
            {token : "string.tag", regex : /</, next : "tag"},
            {token : "string", regex : /"/, next  : "string"},
            {token : "string.other", regex : "{", next  : "string.other"},
            {token : "comment", regex : "comment [[{]", next : "comment"},
            {token : "comment",  regex : /;.+$/},
            {token : "paren.map-start", regex : "#\\("},
            {token : "paren.block-start", regex : "[\\[]"},
            {token : "paren.block-end", regex : "[\\]]"},
            {token : "paren.parens-start", regex : "[(]"},
            {token : "paren.parens-end", regex : "\\)"},
            {token : "keyword", regex : "/local|/external"},
            {token : "keyword.preprocessor", regex : "#(if|either|" +
                "switch|case|include|do|macrolocal|reset|process|trace)"},
            {token : "constant.datatype!", regex :
                "(?:datatype|unset|none|logic|block|paren|string|" +
                "file|url|char|integer|float|word|set-word|lit-word|" +
                "get-word|refinement|issue|native|action|op|function|" +
                "path|lit-path|set-path|get-path|routine|bitset|point|" +
                "object|typeset|error|vector|hash|pair|percent|tuple|" +
                "map|binary|time|tag|email|handle|date|image|event|" +
                "series|any-type|number|any-object|scalar|" +
                "any-string|any-word|any-function|any-block|any-list|" +
                "any-path|immediate|all-word|internal|external|default)!(?![-!?\\w~])"},
            {token : "keyword.function", regex :
                "\\b(?:collect|quote|on-parse-event|math|last|source|expand|" +
                "show|context|object|input|quit|dir|make-dir|cause-error|" +
                "error\\?|none\\?|block\\?|any-list\\?|word\\?|char\\?|" +
                "any-string\\?|series\\?|binary\\?|attempt|url\\?|" +
                "string\\?|suffix\\?|file\\?|object\\?|body-of|first|" +
                "second|third|mod|clean-path|dir\\?|to-red-file|" +
                "normalize-dir|list-dir|pad|empty\\?|dirize|offset\\?|" +
                "what-dir|expand-directives|load|split-path|change-dir|" +
                "to-file|path-thru|save|load-thru|View|float\\?|to-float|" +
                "charset|\\?|probe|set-word\\?|q|words-of|replace|repend|" +
                "react|function\\?|spec-of|unset\\?|halt|op\\?|" +
                "any-function\\?|to-paren|tag\\?|routine|class-of|" +
                "size-text|draw|handle\\?|link-tabs-to-parent|" +
                "link-sub-to-parent|on-face-deep-change*|" +
                "update-font-faces|do-actor|do-safe|do-events|pair\\?|" +
                "foreach-face|hex-to-rgb|issue\\?|alter|path\\?|" +
                "typeset\\?|datatype\\?|set-flag|layout|extract|image\\?|" +
                "get-word\\?|to-logic|to-set-word|to-block|center-face|" +
                "dump-face|request-font|request-file|request-dir|rejoin|" +
                "ellipsize-at|any-block\\?|any-object\\?|map\\?|keys-of|" +
                "a-an|also|parse-func-spec|help-string|what|routine\\?|" +
                "action\\?|native\\?|refinement\\?|common-substr|" +
                "red-complete-file|red-complete-path|unview|comment|\\?\\?|" +
                "fourth|fifth|values-of|bitset\\?|email\\?|get-path\\?|" +
                "hash\\?|integer\\?|lit-path\\?|lit-word\\?|logic\\?|" +
                "paren\\?|percent\\?|set-path\\?|time\\?|tuple\\?|date\\?|" +
                "vector\\?|any-path\\?|any-word\\?|number\\?|immediate\\?|" +
                "scalar\\?|all-word\\?|to-bitset|to-binary|to-char|to-email|" +
                "to-get-path|to-get-word|to-hash|to-integer|to-issue|" +
                "to-lit-path|to-lit-word|to-map|to-none|to-pair|to-path|" +
                "to-percent|to-refinement|to-set-path|to-string|to-tag|" +
                "to-time|to-typeset|to-tuple|to-unset|to-url|to-word|" +
                "to-image|to-date|parse-trace|modulo|eval-set-path|" +
                "extract-boot-args|flip-exe-flag|split|do-file|" +
                "exists-thru\\?|read-thru|do-thru|cos|sin|tan|acos|asin|" +
                "atan|atan2|sqrt|clear-reactions|dump-reactions|react\\?|" +
                "within\\?|overlap\\?|distance\\?|face\\?|metrics\\?|" +
                "get-scroller|insert-event-func|remove-event-func|" +
                "set-focus|help|fetch-help|about|ls|ll|pwd|cd|" +
                "red-complete-input|matrix)(?![-!?\\w~])"},
            {token : "keyword.action", regex :
                "\\b(?:to|remove|copy|insert|change|clear|move|poke|put|" +
                "random|reverse|sort|swap|take|trim|add|subtract|" +
                "divide|multiply|make|reflect|form|mold|modify|" +
                "absolute|negate|power|remainder|round|even\\?|odd\\?|" +
                "and~|complement|or~|xor~|append|at|back|find|skip|" +
                "tail|head|head\\?|index\\?|length\\?|next|pick|" +
                "select|tail\\?|delete|read|write)(?![-_!?\\w~])"
            },
            {token : "keyword.native", regex :
                "\\b(?:not|any|set|uppercase|lowercase|checksum|" +
                "try|catch|browse|throw|all|as|" +
                "remove-each|func|function|does|has|do|reduce|" +
                "compose|get|print|prin|equal\\?|not-equal\\?|" +
                "strict-equal\\?|lesser\\?|greater\\?|lesser-or-equal\\?|" +
                "greater-or-equal\\?|same\\?|type\\?|stats|bind|in|parse|" +
                "union|unique|intersect|difference|exclude|" +
                "complement\\?|dehex|negative\\?|positive\\?|max|min|" +
                "shift|to-hex|sine|cosine|tangent|arcsine|arccosine|" +
                "arctangent|arctangent2|NaN\\?|zero\\?|log-2|log-10|log-e|" +
                "exp|square-root|construct|value\\?|as-pair|" +
                "extend|debase|enbase|to-local-file|" +
                "wait|unset|new-line|new-line\\?|context\\?|set-env|" +
                "get-env|list-env|now|sign\\?|call|size\\?)(?![-!?\\w~])"
            },
            {token : "keyword", regex :
                "\\b(?:Red(?=\\s+\\[)|object|context|make|self|keep)(?![-!?\\w~])"
            },
            {token: "variable.language", regex : "this"},
            {token: "keyword.control", regex :
                "(?:while|if|return|case|unless|either|until|loop|repeat|" +
                "forever|foreach|forall|switch|break|continue|exit)(?![-!?\\w~])"},
            {token: "constant.language", regex :
                "\\b(?:true|false|on|off|yes|none|no)(?![-!?\\w~])"},
            {token: "constant.numeric", regex : /\bpi(?![^-_])/},
            {token: "constant.character", regex : "\\b(space|tab|newline|cr|lf)(?![-!?\\w~])"},
            {token: "keyword.operator", regex : "\s(or|and|xor|is)\s"},
            {token : "variable.get-path", regex : /:\w[-\w'*.?!]*(\/\w[-\w'*.?!]*)(\/\w[-\w'*.?!]*)*/},
            {token : "variable.set-path", regex : /\w[-\w'*.?!]*(\/\w[-\w'*.?!]*)(\/\w[-\w'*.?!]*)*:/},
            {token : "variable.lit-path", regex : /'\w[-\w'*.?!]*(\/\w[-\w'*.?!]*)(\/\w[-\w'*.?!]*)*/},
            {token : "variable.path", regex : /\w[-\w'*.?!]*(\/\w[-\w'*.?!]*)(\/\w[-\w'*.?!]*)*/},
            {token : "variable.refinement", regex : /\/\w[-\w'*.?!]*/},
            {token : "keyword.view.style", regex :
                "\\b(?:window|base|button|text|field|area|check|" +
                "radio|progress|slider|camera|text-list|" +
                "drop-list|drop-down|panel|group-box|" +
                "tab-panel|h1|h2|h3|h4|h5|box|image|init)(?![-!?\\w~])"},
            {token : "keyword.view.event", regex :
                "\\b(?:detect|on-detect|time|on-time|drawing|on-drawing|" +
                "scroll|on-scroll|down|on-down|up|on-up|mid-down|" +
                "on-mid-down|mid-up|on-mid-up|alt-down|on-alt-down|" +
                "alt-up|on-alt-up|aux-down|on-aux-down|aux-up|" +
                "on-aux-up|wheel|on-wheel|drag-start|on-drag-start|" +
                "drag|on-drag|drop|on-drop|click|on-click|dbl-click|" +
                "on-dbl-click|over|on-over|key|on-key|key-down|" +
                "on-key-down|key-up|on-key-up|ime|on-ime|focus|" +
                "on-focus|unfocus|on-unfocus|select|on-select|" +
                "change|on-change|enter|on-enter|menu|on-menu|close|" +
                "on-close|move|on-move|resize|on-resize|moving|" +
                "on-moving|resizing|on-resizing|zoom|on-zoom|pan|" +
                "on-pan|rotate|on-rotate|two-tap|on-two-tap|" +
                "press-tap|on-press-tap|create|on-create|created|on-created)(?![-!?\\w~])"},
            {token : "keyword.view.option", regex :
                "\\b(?:all-over|center|color|default|disabled|down|" +
                "flags|focus|font|font-color|font-name|" +
                "font-size|hidden|hint|left|loose|name|" +
                "no-border|now|rate|react|select|size|space)(?![-!?\\w~])"},
            {token : "constant.other.colour", regex : "\\b(?:Red|white|transparent|" +
                "black|gray|aqua|beige|blue|brick|brown|coal|coffee|" +
                "crimson|cyan|forest|gold|green|ivory|khaki|leaf|linen|" +
                "magenta|maroon|mint|navy|oldrab|olive|orange|papaya|" +
                "pewter|pink|purple|reblue|rebolor|sienna|silver|sky|" +
                "snow|tanned|teal|violet|water|wheat|yello|yellow|glass)(?![-!?\\w~])"},
            {token : "variable.get-word", regex : /\:\w[-\w'*.?!]*/},
            {token : "variable.set-word", regex : /\w[-\w'*.?!]*\:/},
            {token : "variable.lit-word", regex : /'\w[-\w'*.?!]*/},
            {token : "variable.word", regex : /\b\w+[-\w'*.!?]*/},
            {caseInsensitive: true}
        ],
        "string" : [
            {token : "string", regex : /"/, next : "start"},
            {defaultToken : "string"}
        ],
        "string.other" : [
            {token : "string.other", regex : /}/, next : "start"},
            {defaultToken : "string.other"}
        ],
        "tag" : [
            {token : "string.tag", regex : />/, next : "start"},
            {defaultToken : "string.tag"}
        ],
        "comment" : [
            {token : "comment", regex : /}/, next : "start"},
            {defaultToken : "comment"}
        ]
    };
};
oop.inherits(RedHighlightRules, TextHighlightRules);

exports.RedHighlightRules = RedHighlightRules;
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

ace.define("ace/mode/red",["require","exports","module","ace/lib/oop","ace/mode/text","ace/mode/red_highlight_rules","ace/mode/folding/cstyle","ace/mode/matching_brace_outdent","ace/range"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../lib/oop");
var TextMode = acequire("./text").Mode;
var RedHighlightRules = acequire("./red_highlight_rules").RedHighlightRules;
var RedFoldMode = acequire("./folding/cstyle").FoldMode;
var MatchingBraceOutdent = acequire("./matching_brace_outdent").MatchingBraceOutdent;
var Range = acequire("../range").Range;

var Mode = function() {
    this.HighlightRules = RedHighlightRules;
    this.foldingRules = new RedFoldMode();
    this.$outdent = new MatchingBraceOutdent();
    this.$behaviour = this.$defaultBehaviour;
};
oop.inherits(Mode, TextMode);

(function() {

    this.lineCommentStart = ";";
	this.blockCommentStart = "comment {";

    this.getNextLineIndent = function(state, line, tab) {
        var indent = this.$getIndent(line);

        var tokenizedLine = this.getTokenizer().getLineTokens(line, state);
        var tokens = tokenizedLine.tokens;
        var endState = tokenizedLine.state;

        if (tokens.length && tokens[tokens.length-1].type == "comment") {
            return indent;
        }

        if (state == "start") {
            var match = line.match(/^.*[\{\[\(]\s*$/);
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
                indent += "* ";
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

    this.$id = "ace/mode/red";
}).call(Mode.prototype);

exports.Mode = Mode;
});
