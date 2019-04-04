ace.define("ace/mode/pascal_highlight_rules",["require","exports","module","ace/lib/oop","ace/mode/text_highlight_rules"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../lib/oop");
var TextHighlightRules = acequire("./text_highlight_rules").TextHighlightRules;

var PascalHighlightRules = function() {

    this.$rules = { start: 
       [ { caseInsensitive: true,
           token: 'keyword.control.pascal',
           regex: '\\b(?:(absolute|abstract|all|and|and_then|array|as|asm|attribute|begin|bindable|case|class|const|constructor|destructor|div|do|do|else|end|except|export|exports|external|far|file|finalization|finally|for|forward|goto|if|implementation|import|in|inherited|initialization|interface|interrupt|is|label|library|mod|module|name|near|nil|not|object|of|only|operator|or|or_else|otherwise|packed|pow|private|program|property|protected|public|published|qualified|record|repeat|resident|restricted|segment|set|shl|shr|then|to|try|type|unit|until|uses|value|var|view|virtual|while|with|xor))\\b' },
         { caseInsensitive: true,           
           token: 
            [ 'variable.pascal', "text",
              'storage.type.prototype.pascal',
              'entity.name.function.prototype.pascal' ],
           regex: '\\b(function|procedure)(\\s+)(\\w+)(\\.\\w+)?(?=(?:\\(.*?\\))?;\\s*(?:attribute|forward|external))' },
         { caseInsensitive: true,
           token: 
            [ 'variable.pascal', "text",
              'storage.type.function.pascal',
              'entity.name.function.pascal' ],
           regex: '\\b(function|procedure)(\\s+)(\\w+)(\\.\\w+)?' },
         { token: 'constant.numeric.pascal',
           regex: '\\b((0(x|X)[0-9a-fA-F]*)|(([0-9]+\\.?[0-9]*)|(\\.[0-9]+))((e|E)(\\+|-)?[0-9]+)?)(L|l|UL|ul|u|U|F|f|ll|LL|ull|ULL)?\\b' },
         { token: 'punctuation.definition.comment.pascal',
           regex: '--.*$',
           push_: 
            [ { token: 'comment.line.double-dash.pascal.one',
                regex: '$',
                next: 'pop' },
              { defaultToken: 'comment.line.double-dash.pascal.one' } ] },
         { token: 'punctuation.definition.comment.pascal',
           regex: '//.*$',
           push_: 
            [ { token: 'comment.line.double-slash.pascal.two',
                regex: '$',
                next: 'pop' },
              { defaultToken: 'comment.line.double-slash.pascal.two' } ] },
         { token: 'punctuation.definition.comment.pascal',
           regex: '\\(\\*',
           push: 
            [ { token: 'punctuation.definition.comment.pascal',
                regex: '\\*\\)',
                next: 'pop' },
              { defaultToken: 'comment.block.pascal.one' } ] },
         { token: 'punctuation.definition.comment.pascal',
           regex: '\\{',
           push: 
            [ { token: 'punctuation.definition.comment.pascal',
                regex: '\\}',
                next: 'pop' },
              { defaultToken: 'comment.block.pascal.two' } ] },
         { token: 'punctuation.definition.string.begin.pascal',
           regex: '"',
           push: 
            [ { token: 'constant.character.escape.pascal', regex: '\\\\.' },
              { token: 'punctuation.definition.string.end.pascal',
                regex: '"',
                next: 'pop' },
              { defaultToken: 'string.quoted.double.pascal' } ]
            },
         { token: 'punctuation.definition.string.begin.pascal',
           regex: '\'',
           push: 
            [ { token: 'constant.character.escape.apostrophe.pascal',
                regex: '\'\'' },
              { token: 'punctuation.definition.string.end.pascal',
                regex: '\'',
                next: 'pop' },
              { defaultToken: 'string.quoted.single.pascal' } ] },
          { token: 'keyword.operator',
           regex: '[+\\-;,/*%]|:=|=' } ] };
    
    this.normalizeRules();
};

oop.inherits(PascalHighlightRules, TextHighlightRules);

exports.PascalHighlightRules = PascalHighlightRules;
});

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

ace.define("ace/mode/pascal",["require","exports","module","ace/lib/oop","ace/mode/text","ace/mode/pascal_highlight_rules","ace/mode/folding/coffee"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../lib/oop");
var TextMode = acequire("./text").Mode;
var PascalHighlightRules = acequire("./pascal_highlight_rules").PascalHighlightRules;
var FoldMode = acequire("./folding/coffee").FoldMode;

var Mode = function() {
    this.HighlightRules = PascalHighlightRules;
    this.foldingRules = new FoldMode();
    this.$behaviour = this.$defaultBehaviour;
};
oop.inherits(Mode, TextMode);

(function() {
       
    this.lineCommentStart = ["--", "//"];
    this.blockComment = [
        {start: "(*", end: "*)"},
        {start: "{", end: "}"}
    ];
    
    this.$id = "ace/mode/pascal";
}).call(Mode.prototype);

exports.Mode = Mode;
});
