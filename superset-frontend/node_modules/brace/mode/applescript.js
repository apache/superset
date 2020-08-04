ace.define("ace/mode/applescript_highlight_rules",["require","exports","module","ace/lib/oop","ace/mode/text_highlight_rules"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../lib/oop");
var TextHighlightRules = acequire("./text_highlight_rules").TextHighlightRules;

var AppleScriptHighlightRules = function() {
    var keywords = (
        "about|above|after|against|and|around|as|at|back|before|beginning|" +
        "behind|below|beneath|beside|between|but|by|considering|" +
        "contain|contains|continue|copy|div|does|eighth|else|end|equal|" +
        "equals|error|every|exit|fifth|first|for|fourth|from|front|" +
        "get|given|global|if|ignoring|in|into|is|it|its|last|local|me|" +
        "middle|mod|my|ninth|not|of|on|onto|or|over|prop|property|put|ref|" +
        "reference|repeat|returning|script|second|set|seventh|since|" +
        "sixth|some|tell|tenth|that|the|then|third|through|thru|" +
        "timeout|times|to|transaction|try|until|where|while|whose|with|without"
    );

    var builtinConstants = (
        "AppleScript|false|linefeed|return|pi|quote|result|space|tab|true"
    );

    var builtinFunctions = (
        "activate|beep|count|delay|launch|log|offset|read|round|run|say|" +
        "summarize|write"
    );

    var builtinTypes = (
        "alias|application|boolean|class|constant|date|file|integer|list|" +
        "number|real|record|string|text|character|characters|contents|day|" +
        "frontmost|id|item|length|month|name|paragraph|paragraphs|rest|" +
        "reverse|running|time|version|weekday|word|words|year"
    );

    var keywordMapper = this.createKeywordMapper({
        "support.function": builtinFunctions,
        "constant.language": builtinConstants,
        "support.type": builtinTypes,
        "keyword": keywords
    }, "identifier");

    this.$rules = {
        "start": [
            {
                token: "comment",
                regex: "--.*$"
            },
            {
                token : "comment", // multi line comment
                regex : "\\(\\*",
                next : "comment"
            },
            {
                token: "string",           // " string
                regex: '".*?"'
            },
            {
                token: "support.type",
                regex: '\\b(POSIX file|POSIX path|(date|time) string|quoted form)\\b'
            },
            {
                token: "support.function",
                regex: '\\b(clipboard info|the clipboard|info for|list (disks|folder)|' +
          'mount volume|path to|(close|open for) access|(get|set) eof|' +
          'current date|do shell script|get volume settings|random number|' +
          'set volume|system attribute|system info|time to GMT|' +
          '(load|run|store) script|scripting components|' +
          'ASCII (character|number)|localized string|' +
          'choose (application|color|file|file name|' +
          'folder|from list|remote application|URL)|' +
          'display (alert|dialog))\\b|^\\s*return\\b'
            },
            {
                token: "constant.language",
                regex: '\\b(text item delimiters|current application|missing value)\\b'
            },
            {
                token: "keyword",
                regex: '\\b(apart from|aside from|instead of|out of|greater than|' +
          "isn't|(doesn't|does not) (equal|come before|come after|contain)|" +
          '(greater|less) than( or equal)?|(starts?|ends|begins?) with|' +
          'contained by|comes (before|after)|a (ref|reference))\\b'
            },
            {
                token: keywordMapper,
                regex: "[a-zA-Z][a-zA-Z0-9_]*\\b"
            }
        ],
        "comment": [
            {
                token: "comment", // closing comment
                regex: "\\*\\)",
                next: "start"
            }, {
                defaultToken: "comment"
            }
        ]
    };

    this.normalizeRules();
};

oop.inherits(AppleScriptHighlightRules, TextHighlightRules);

exports.AppleScriptHighlightRules = AppleScriptHighlightRules;
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

ace.define("ace/mode/applescript",["require","exports","module","ace/lib/oop","ace/mode/text","ace/mode/applescript_highlight_rules","ace/mode/folding/cstyle"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../lib/oop");
var TextMode = acequire("./text").Mode;
var AppleScriptHighlightRules = acequire("./applescript_highlight_rules").AppleScriptHighlightRules;
var FoldMode = acequire("./folding/cstyle").FoldMode;

var Mode = function() {
    this.HighlightRules = AppleScriptHighlightRules;
    this.foldingRules = new FoldMode();
    this.$behaviour = this.$defaultBehaviour;
};
oop.inherits(Mode, TextMode);

(function() {
    this.lineCommentStart = "--";
    this.blockComment = {start: "(*", end: "*)"};
    this.$id = "ace/mode/applescript";
}).call(Mode.prototype);

exports.Mode = Mode;
});
