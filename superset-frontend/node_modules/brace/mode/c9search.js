ace.define("ace/mode/c9search_highlight_rules",["require","exports","module","ace/lib/oop","ace/lib/lang","ace/mode/text_highlight_rules"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../lib/oop");
var lang = acequire("../lib/lang");
var TextHighlightRules = acequire("./text_highlight_rules").TextHighlightRules;

function safeCreateRegexp(source, flag) {
    try {
        return new RegExp(source, flag);
    } catch(e) {}
}

var C9SearchHighlightRules = function() {
    this.$rules = {
        "start" : [
            {
                tokenNames : ["c9searchresults.constant.numeric", "c9searchresults.text", "c9searchresults.text", "c9searchresults.keyword"],
                regex : /(^\s+[0-9]+)(:)(\d*\s?)([^\r\n]+)/,
                onMatch : function(val, state, stack) {
                    var values = this.splitRegex.exec(val);
                    var types = this.tokenNames;
                    var tokens = [{
                        type: types[0],
                        value: values[1]
                    }, {
                        type: types[1],
                        value: values[2]
                    }];
                    
                    if (values[3]) {
                        if (values[3] == " ")
                            tokens[1] = { type: types[1], value: values[2] + " " };
                        else
                            tokens.push({ type: types[1], value: values[3] });
                    }
                    var regex = stack[1];
                    var str = values[4];
                    
                    var m;
                    var last = 0;
                    if (regex && regex.exec) {
                        regex.lastIndex = 0;
                        while (m = regex.exec(str)) {
                            var skipped = str.substring(last, m.index);
                            last = regex.lastIndex;
                            if (skipped)
                                tokens.push({type: types[2], value: skipped});
                            if (m[0])
                                tokens.push({type: types[3], value: m[0]});
                            else if (!skipped)
                                break;
                        }
                    }
                    if (last < str.length)
                        tokens.push({type: types[2], value: str.substr(last)});
                    return tokens;
                }
            },
            {
                regex : "^Searching for [^\\r\\n]*$",
                onMatch: function(val, state, stack) {
                    var parts = val.split("\x01");
                    if (parts.length < 3)
                        return "text";

                    var options, search, replace;
                    
                    var i = 0;
                    var tokens = [{
                        value: parts[i++] + "'",
                        type: "text"
                    }, {
                        value: search = parts[i++],
                        type: "text" // "c9searchresults.keyword"
                    }, {
                        value: "'" + parts[i++],
                        type: "text"
                    }];
                    if (parts[2] !== " in") {
                        replace = parts[i];
                        tokens.push({
                            value: "'" + parts[i++] + "'",
                            type: "text"
                        }, {
                            value: parts[i++],
                            type: "text"
                        });
                    }
                    tokens.push({
                        value: " " + parts[i++] + " ",
                        type: "text"
                    });
                    if (parts[i+1]) {
                        options = parts[i+1];
                        tokens.push({
                            value: "(" + parts[i+1] + ")",
                            type: "text"
                        });
                        i += 1;
                    } else {
                        i -= 1;
                    }
                    while (i++ < parts.length) {
                        parts[i] && tokens.push({
                            value: parts[i],
                            type: "text"
                        });
                    }
                    
                    if (search) {
                        if (!/regex/.test(options))
                            search = lang.escapeRegExp(search);
                        if (/whole/.test(options))
                            search = "\\b" + search + "\\b";
                    }
                    
                    var regex = search && safeCreateRegexp(
                        "(" + search + ")",
                        / sensitive/.test(options) ? "g" : "ig"
                    );
                    if (regex) {
                        stack[0] = state;
                        stack[1] = regex;
                    }
                    
                    return tokens;
                }
            },
            {
                regex : "^(?=Found \\d+ matches)",
                token : "text",
                next : "numbers"
            },
            {
                token : "string", // single line
                regex : "^\\S:?[^:]+",
                next : "numbers"
            }
        ],
        numbers:[{
            regex : "\\d+",
            token : "constant.numeric"
        }, {
            regex : "$",
            token : "text",
            next : "start"
        }]
    };
    this.normalizeRules();
};

oop.inherits(C9SearchHighlightRules, TextHighlightRules);

exports.C9SearchHighlightRules = C9SearchHighlightRules;

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

ace.define("ace/mode/folding/c9search",["require","exports","module","ace/lib/oop","ace/range","ace/mode/folding/fold_mode"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../../lib/oop");
var Range = acequire("../../range").Range;
var BaseFoldMode = acequire("./fold_mode").FoldMode;

var FoldMode = exports.FoldMode = function() {};
oop.inherits(FoldMode, BaseFoldMode);

(function() {

    this.foldingStartMarker = /^(\S.*:|Searching for.*)$/;
    this.foldingStopMarker = /^(\s+|Found.*)$/;
    
    this.getFoldWidgetRange = function(session, foldStyle, row) {
        var lines = session.doc.getAllLines(row);
        var line = lines[row];
        var level1 = /^(Found.*|Searching for.*)$/;
        var level2 = /^(\S.*:|\s*)$/;
        var re = level1.test(line) ? level1 : level2;
        
        var startRow = row;
        var endRow = row;

        if (this.foldingStartMarker.test(line)) {
            for (var i = row + 1, l = session.getLength(); i < l; i++) {
                if (re.test(lines[i]))
                    break;
            }
            endRow = i;
        }
        else if (this.foldingStopMarker.test(line)) {
            for (var i = row - 1; i >= 0; i--) {
                line = lines[i];
                if (re.test(line))
                    break;
            }
            startRow = i;
        }
        if (startRow != endRow) {
            var col = line.length;
            if (re === level1)
                col = line.search(/\(Found[^)]+\)$|$/);
            return new Range(startRow, col, endRow, 0);
        }
    };
    
}).call(FoldMode.prototype);

});

ace.define("ace/mode/c9search",["require","exports","module","ace/lib/oop","ace/mode/text","ace/mode/c9search_highlight_rules","ace/mode/matching_brace_outdent","ace/mode/folding/c9search"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../lib/oop");
var TextMode = acequire("./text").Mode;
var C9SearchHighlightRules = acequire("./c9search_highlight_rules").C9SearchHighlightRules;
var MatchingBraceOutdent = acequire("./matching_brace_outdent").MatchingBraceOutdent;
var C9StyleFoldMode = acequire("./folding/c9search").FoldMode;

var Mode = function() {
    this.HighlightRules = C9SearchHighlightRules;
    this.$outdent = new MatchingBraceOutdent();
    this.foldingRules = new C9StyleFoldMode();
};
oop.inherits(Mode, TextMode);

(function() {
    
    this.getNextLineIndent = function(state, line, tab) {
        var indent = this.$getIndent(line);
        return indent;
    };

    this.checkOutdent = function(state, line, input) {
        return this.$outdent.checkOutdent(line, input);
    };

    this.autoOutdent = function(state, doc, row) {
        this.$outdent.autoOutdent(doc, row);
    };

    this.$id = "ace/mode/c9search";
}).call(Mode.prototype);

exports.Mode = Mode;

});
