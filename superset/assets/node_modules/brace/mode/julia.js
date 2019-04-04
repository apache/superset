ace.define("ace/mode/julia_highlight_rules",["require","exports","module","ace/lib/oop","ace/mode/text_highlight_rules"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../lib/oop");
var TextHighlightRules = acequire("./text_highlight_rules").TextHighlightRules;

var JuliaHighlightRules = function() {

    this.$rules = { start: 
       [ { include: '#function_decl' },
         { include: '#function_call' },
         { include: '#type_decl' },
         { include: '#keyword' },
         { include: '#operator' },
         { include: '#number' },
         { include: '#string' },
         { include: '#comment' } ],
      '#bracket': 
       [ { token: 'keyword.bracket.julia',
           regex: '\\(|\\)|\\[|\\]|\\{|\\}|,' } ],
      '#comment': 
       [ { token: 
            [ 'punctuation.definition.comment.julia',
              'comment.line.number-sign.julia' ],
           regex: '(#)(?!\\{)(.*$)'} ],
      '#function_call': 
       [ { token: [ 'support.function.julia', 'text' ],
           regex: '([a-zA-Z0-9_]+!?)([\\w\\xff-\\u218e\\u2455-\\uffff]*\\()'} ],
      '#function_decl': 
       [ { token: [ 'keyword.other.julia', 'meta.function.julia',
               'entity.name.function.julia', 'meta.function.julia','text' ],
           regex: '(function|macro)(\\s*)([a-zA-Z0-9_\\{]+!?)([\\w\\xff-\\u218e\\u2455-\\uffff]*)([(\\\\{])'} ],
      '#keyword':
       [ { token: 'keyword.other.julia',
           regex: '\\b(?:function|type|immutable|macro|quote|abstract|bitstype|typealias|module|baremodule|new)\\b' },
         { token: 'keyword.control.julia',
           regex: '\\b(?:if|else|elseif|while|for|in|begin|let|end|do|try|catch|finally|return|break|continue)\\b' },
         { token: 'storage.modifier.variable.julia',
           regex: '\\b(?:global|local|const|export|import|importall|using)\\b' },
         { token: 'variable.macro.julia', regex: '@[\\w\\xff-\\u218e\\u2455-\\uffff]+\\b' } ],
      '#number': 
       [ { token: 'constant.numeric.julia',
           regex: '\\b0(?:x|X)[0-9a-fA-F]*|(?:\\b[0-9]+\\.?[0-9]*|\\.[0-9]+)(?:(?:e|E)(?:\\+|-)?[0-9]*)?(?:im)?|\\bInf(?:32)?\\b|\\bNaN(?:32)?\\b|\\btrue\\b|\\bfalse\\b' } ],
      '#operator': 
       [ { token: 'keyword.operator.update.julia',
           regex: '=|:=|\\+=|-=|\\*=|/=|//=|\\.//=|\\.\\*=|\\\\=|\\.\\\\=|^=|\\.^=|%=|\\|=|&=|\\$=|<<=|>>=' },
         { token: 'keyword.operator.ternary.julia', regex: '\\?|:' },
         { token: 'keyword.operator.boolean.julia',
           regex: '\\|\\||&&|!' },
         { token: 'keyword.operator.arrow.julia', regex: '->|<-|-->' },
         { token: 'keyword.operator.relation.julia',
           regex: '>|<|>=|<=|==|!=|\\.>|\\.<|\\.>=|\\.>=|\\.==|\\.!=|\\.=|\\.!|<:|:>' },
         { token: 'keyword.operator.range.julia', regex: ':' },
         { token: 'keyword.operator.shift.julia', regex: '<<|>>' },
         { token: 'keyword.operator.bitwise.julia', regex: '\\||\\&|~' },
         { token: 'keyword.operator.arithmetic.julia',
           regex: '\\+|-|\\*|\\.\\*|/|\\./|//|\\.//|%|\\.%|\\\\|\\.\\\\|\\^|\\.\\^' },
         { token: 'keyword.operator.isa.julia', regex: '::' },
         { token: 'keyword.operator.dots.julia',
           regex: '\\.(?=[a-zA-Z])|\\.\\.+' },
         { token: 'keyword.operator.interpolation.julia',
           regex: '\\$#?(?=.)' },
         { token: [ 'variable', 'keyword.operator.transposed-variable.julia' ],
           regex: '([\\w\\xff-\\u218e\\u2455-\\uffff]+)((?:\'|\\.\')*\\.?\')' },
         { token: 'text',
           regex: '\\[|\\('},
         { token: [ 'text', 'keyword.operator.transposed-matrix.julia' ],
            regex: "([\\]\\)])((?:'|\\.')*\\.?')"} ],
      '#string': 
       [ { token: 'punctuation.definition.string.begin.julia',
           regex: '\'',
           push: 
            [ { token: 'punctuation.definition.string.end.julia',
                regex: '\'',
                next: 'pop' },
              { include: '#string_escaped_char' },
              { defaultToken: 'string.quoted.single.julia' } ] },
         { token: 'punctuation.definition.string.begin.julia',
           regex: '"',
           push: 
            [ { token: 'punctuation.definition.string.end.julia',
                regex: '"',
                next: 'pop' },
              { include: '#string_escaped_char' },
              { defaultToken: 'string.quoted.double.julia' } ] },
         { token: 'punctuation.definition.string.begin.julia',
           regex: '\\b[\\w\\xff-\\u218e\\u2455-\\uffff]+"',
           push: 
            [ { token: 'punctuation.definition.string.end.julia',
                regex: '"[\\w\\xff-\\u218e\\u2455-\\uffff]*',
                next: 'pop' },
              { include: '#string_custom_escaped_char' },
              { defaultToken: 'string.quoted.custom-double.julia' } ] },
         { token: 'punctuation.definition.string.begin.julia',
           regex: '`',
           push: 
            [ { token: 'punctuation.definition.string.end.julia',
                regex: '`',
                next: 'pop' },
              { include: '#string_escaped_char' },
              { defaultToken: 'string.quoted.backtick.julia' } ] } ],
      '#string_custom_escaped_char': [ { token: 'constant.character.escape.julia', regex: '\\\\"' } ],
      '#string_escaped_char': 
       [ { token: 'constant.character.escape.julia',
           regex: '\\\\(?:\\\\|[0-3]\\d{,2}|[4-7]\\d?|x[a-fA-F0-9]{,2}|u[a-fA-F0-9]{,4}|U[a-fA-F0-9]{,8}|.)' } ],
      '#type_decl': 
       [ { token: 
            [ 'keyword.control.type.julia',
              'meta.type.julia',
              'entity.name.type.julia',
              'entity.other.inherited-class.julia',
              'punctuation.separator.inheritance.julia',
              'entity.other.inherited-class.julia' ],
           regex: '(type|immutable)(\\s+)([a-zA-Z0-9_]+)(?:(\\s*)(<:)(\\s*[.a-zA-Z0-9_:]+))?' },
         { token: [ 'other.typed-variable.julia', 'support.type.julia' ],
           regex: '([a-zA-Z0-9_]+)(::[a-zA-Z0-9_{}]+)' } ] };
    
    this.normalizeRules();
};

JuliaHighlightRules.metaData = { fileTypes: [ 'jl' ],
      firstLineMatch: '^#!.*\\bjulia\\s*$',
      foldingStartMarker: '^\\s*(?:if|while|for|begin|function|macro|module|baremodule|type|immutable|let)\\b(?!.*\\bend\\b).*$',
      foldingStopMarker: '^\\s*(?:end)\\b.*$',
      name: 'Julia',
      scopeName: 'source.julia' };


oop.inherits(JuliaHighlightRules, TextHighlightRules);

exports.JuliaHighlightRules = JuliaHighlightRules;
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

ace.define("ace/mode/julia",["require","exports","module","ace/lib/oop","ace/mode/text","ace/mode/julia_highlight_rules","ace/mode/folding/cstyle"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../lib/oop");
var TextMode = acequire("./text").Mode;
var JuliaHighlightRules = acequire("./julia_highlight_rules").JuliaHighlightRules;
var FoldMode = acequire("./folding/cstyle").FoldMode;

var Mode = function() {
    this.HighlightRules = JuliaHighlightRules;
    this.foldingRules = new FoldMode();
    this.$behaviour = this.$defaultBehaviour;
};
oop.inherits(Mode, TextMode);

(function() {
    this.lineCommentStart = "#";
    this.blockComment = "";
    this.$id = "ace/mode/julia";
}).call(Mode.prototype);

exports.Mode = Mode;
});
