ace.define("ace/mode/toml_highlight_rules",["require","exports","module","ace/lib/oop","ace/mode/text_highlight_rules"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../lib/oop");
var TextHighlightRules = acequire("./text_highlight_rules").TextHighlightRules;

var TomlHighlightRules = function() {
    var keywordMapper = this.createKeywordMapper({
        "constant.language.boolean": "true|false"
    }, "identifier");

    var identifierRe = "[a-zA-Z\\$_\u00a1-\uffff][a-zA-Z\\d\\$_\u00a1-\uffff]*\\b";

    this.$rules = {
    "start": [
        {
            token: "comment.toml",
            regex: /#.*$/
        },
        {
            token : "string",
            regex : '"(?=.)',
            next  : "qqstring"
        },
        {
            token: ["variable.keygroup.toml"],
            regex: "(?:^\\s*)(\\[\\[([^\\]]+)\\]\\])"
        },
        {
            token: ["variable.keygroup.toml"],
            regex: "(?:^\\s*)(\\[([^\\]]+)\\])"
        },
        {
            token : keywordMapper,
            regex : identifierRe
        },
        {
           token : "support.date.toml",
           regex: "\\d{4}-\\d{2}-\\d{2}(T)\\d{2}:\\d{2}:\\d{2}(Z)"
        },
        {
           token: "constant.numeric.toml",
           regex: "-?\\d+(\\.?\\d+)?"
        }
    ],
    "qqstring" : [
        {
            token : "string",
            regex : "\\\\$",
            next  : "qqstring"
        },
        {
            token : "constant.language.escape",
            regex : '\\\\[0tnr"\\\\]'
        },
        {
            token : "string",
            regex : '"|$',
            next  : "start"
        },
        {
            defaultToken: "string"
        }
    ]
    };

};

oop.inherits(TomlHighlightRules, TextHighlightRules);

exports.TomlHighlightRules = TomlHighlightRules;
});

ace.define("ace/mode/folding/ini",["require","exports","module","ace/lib/oop","ace/range","ace/mode/folding/fold_mode"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../../lib/oop");
var Range = acequire("../../range").Range;
var BaseFoldMode = acequire("./fold_mode").FoldMode;

var FoldMode = exports.FoldMode = function() {
};
oop.inherits(FoldMode, BaseFoldMode);

(function() {

    this.foldingStartMarker = /^\s*\[([^\])]*)]\s*(?:$|[;#])/;

    this.getFoldWidgetRange = function(session, foldStyle, row) {
        var re = this.foldingStartMarker;
        var line = session.getLine(row);
        
        var m = line.match(re);
        
        if (!m) return;
        
        var startName = m[1] + ".";
        
        var startColumn = line.length;
        var maxRow = session.getLength();
        var startRow = row;
        var endRow = row;

        while (++row < maxRow) {
            line = session.getLine(row);
            if (/^\s*$/.test(line))
                continue;
            m = line.match(re);
            if (m && m[1].lastIndexOf(startName, 0) !== 0)
                break;

            endRow = row;
        }

        if (endRow > startRow) {
            var endColumn = session.getLine(endRow).length;
            return new Range(startRow, startColumn, endRow, endColumn);
        }
    };

}).call(FoldMode.prototype);

});

ace.define("ace/mode/toml",["require","exports","module","ace/lib/oop","ace/mode/text","ace/mode/toml_highlight_rules","ace/mode/folding/ini"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../lib/oop");
var TextMode = acequire("./text").Mode;
var TomlHighlightRules = acequire("./toml_highlight_rules").TomlHighlightRules;
var FoldMode = acequire("./folding/ini").FoldMode;

var Mode = function() {
    this.HighlightRules = TomlHighlightRules;
    this.foldingRules = new FoldMode();
    this.$behaviour = this.$defaultBehaviour;
};
oop.inherits(Mode, TextMode);

(function() {
    this.lineCommentStart = "#";
    this.$id = "ace/mode/toml";
}).call(Mode.prototype);

exports.Mode = Mode;
});
