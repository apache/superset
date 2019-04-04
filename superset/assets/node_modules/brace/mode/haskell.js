ace.define("ace/mode/haskell_highlight_rules",["require","exports","module","ace/lib/oop","ace/mode/text_highlight_rules"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../lib/oop");
var TextHighlightRules = acequire("./text_highlight_rules").TextHighlightRules;

var HaskellHighlightRules = function() {

    this.$rules = { start:
       [ { token:
            [ 'punctuation.definition.entity.haskell',
              'keyword.operator.function.infix.haskell',
              'punctuation.definition.entity.haskell' ],
           regex: '(`)([a-zA-Z_\']*?)(`)',
           comment: 'In case this regex seems unusual for an infix operator, note that Haskell allows any ordinary function application (elem 4 [1..10]) to be rewritten as an infix expression (4 `elem` [1..10]).' },
         { token: 'constant.language.unit.haskell', regex: '\\(\\)' },
         { token: 'constant.language.empty-list.haskell',
           regex: '\\[\\]' },
         { token: 'keyword.other.haskell',
           regex: '\\b(module|signature)\\b',
           push:
            [ { token: 'keyword.other.haskell', regex: '\\bwhere\\b', next: 'pop' },
              { include: '#module_name' },
              { include: '#module_exports' },
              { token: 'invalid', regex: '[a-z]+' },
              { defaultToken: 'meta.declaration.module.haskell' } ] },
         { token: 'keyword.other.haskell',
           regex: '\\bclass\\b',
           push:
            [ { token: 'keyword.other.haskell',
                regex: '\\bwhere\\b',
                next: 'pop' },
              { token: 'support.class.prelude.haskell',
                regex: '\\b(?:Monad|Functor|Eq|Ord|Read|Show|Num|(?:Frac|Ra)tional|Enum|Bounded|Real(?:Frac|Float)?|Integral|Floating)\\b' },
              { token: 'entity.other.inherited-class.haskell',
                regex: '[A-Z][A-Za-z_\']*' },
              { token: 'variable.other.generic-type.haskell',
                regex: '\\b[a-z][a-zA-Z0-9_\']*\\b' },
              { defaultToken: 'meta.declaration.class.haskell' } ] },
         { token: 'keyword.other.haskell',
           regex: '\\binstance\\b',
           push:
            [ { token: 'keyword.other.haskell',
                regex: '\\bwhere\\b|$',
                next: 'pop' },
              { include: '#type_signature' },
              { defaultToken: 'meta.declaration.instance.haskell' } ] },
         { token: 'keyword.other.haskell',
           regex: 'import',
           push:
            [ { token: 'meta.import.haskell', regex: '$|;|^', next: 'pop' },
              { token: 'keyword.other.haskell', regex: 'qualified|as|hiding' },
              { include: '#module_name' },
              { include: '#module_exports' },
              { defaultToken: 'meta.import.haskell' } ] },
         { token: [ 'keyword.other.haskell', 'meta.deriving.haskell' ],
           regex: '(deriving)(\\s*\\()',
           push:
            [ { token: 'meta.deriving.haskell', regex: '\\)', next: 'pop' },
              { token: 'entity.other.inherited-class.haskell',
                regex: '\\b[A-Z][a-zA-Z_\']*' },
              { defaultToken: 'meta.deriving.haskell' } ] },
         { token: 'keyword.other.haskell',
           regex: '\\b(?:deriving|where|data|type|case|of|let|in|newtype|default)\\b' },
         { token: 'keyword.operator.haskell', regex: '\\binfix[lr]?\\b' },
         { token: 'keyword.control.haskell',
           regex: '\\b(?:do|if|then|else)\\b' },
         { token: 'constant.numeric.float.haskell',
           regex: '\\b(?:[0-9]+\\.[0-9]+(?:[eE][+-]?[0-9]+)?|[0-9]+[eE][+-]?[0-9]+)\\b',
           comment: 'Floats are always decimal' },
         { token: 'constant.numeric.haskell',
           regex: '\\b(?:[0-9]+|0(?:[xX][0-9a-fA-F]+|[oO][0-7]+))\\b' },
         { token:
            [ 'meta.preprocessor.c',
              'punctuation.definition.preprocessor.c',
              'meta.preprocessor.c' ],
           regex: '^(\\s*)(#)(\\s*\\w+)',
           comment: 'In addition to Haskell\'s "native" syntax, GHC permits the C preprocessor to be run on a source file.' },
         { include: '#pragma' },
         { token: 'punctuation.definition.string.begin.haskell',
           regex: '"',
           push:
            [ { token: 'punctuation.definition.string.end.haskell',
                regex: '"',
                next: 'pop' },
              { token: 'constant.character.escape.haskell',
                regex: '\\\\(?:NUL|SOH|STX|ETX|EOT|ENQ|ACK|BEL|BS|HT|LF|VT|FF|CR|SO|SI|DLE|DC1|DC2|DC3|DC4|NAK|SYN|ETB|CAN|EM|SUB|ESC|FS|GS|RS|US|SP|DEL|[abfnrtv\\\\\\"\'\\&])' },
              { token: 'constant.character.escape.octal.haskell',
                regex: '\\\\o[0-7]+|\\\\x[0-9A-Fa-f]+|\\\\[0-9]+' },
              { token: 'constant.character.escape.control.haskell',
                regex: '\\^[A-Z@\\[\\]\\\\\\^_]' },
              { defaultToken: 'string.quoted.double.haskell' } ] },
         { token:
            [ 'punctuation.definition.string.begin.haskell',
              'string.quoted.single.haskell',
              'constant.character.escape.haskell',
              'constant.character.escape.octal.haskell',
              'constant.character.escape.hexadecimal.haskell',
              'constant.character.escape.control.haskell',
              'punctuation.definition.string.end.haskell' ],
           regex: '(\')(?:([\\ -\\[\\]-~])|(\\\\(?:NUL|SOH|STX|ETX|EOT|ENQ|ACK|BEL|BS|HT|LF|VT|FF|CR|SO|SI|DLE|DC1|DC2|DC3|DC4|NAK|SYN|ETB|CAN|EM|SUB|ESC|FS|GS|RS|US|SP|DEL|[abfnrtv\\\\\\"\'\\&]))|(\\\\o[0-7]+)|(\\\\x[0-9A-Fa-f]+)|(\\^[A-Z@\\[\\]\\\\\\^_]))(\')' },
         { token:
            [ 'meta.function.type-declaration.haskell',
              'entity.name.function.haskell',
              'meta.function.type-declaration.haskell',
              'keyword.other.double-colon.haskell' ],
           regex: '^(\\s*)([a-z_][a-zA-Z0-9_\']*|\\([|!%$+\\-.,=</>]+\\))(\\s*)(::)',
           push:
            [ { token: 'meta.function.type-declaration.haskell',
                regex: '$',
                next: 'pop' },
              { include: '#type_signature' },
              { defaultToken: 'meta.function.type-declaration.haskell' } ] },
         { token: 'support.constant.haskell',
           regex: '\\b(?:Just|Nothing|Left|Right|True|False|LT|EQ|GT|\\(\\)|\\[\\])\\b' },
         { token: 'constant.other.haskell', regex: '\\b[A-Z]\\w*\\b' },
         { include: '#comments' },
         { token: 'support.function.prelude.haskell',
           regex: '\\b(?:abs|acos|acosh|all|and|any|appendFile|applyM|asTypeOf|asin|asinh|atan|atan2|atanh|break|catch|ceiling|compare|concat|concatMap|const|cos|cosh|curry|cycle|decodeFloat|div|divMod|drop|dropWhile|elem|encodeFloat|enumFrom|enumFromThen|enumFromThenTo|enumFromTo|error|even|exp|exponent|fail|filter|flip|floatDigits|floatRadix|floatRange|floor|fmap|foldl|foldl1|foldr|foldr1|fromEnum|fromInteger|fromIntegral|fromRational|fst|gcd|getChar|getContents|getLine|head|id|init|interact|ioError|isDenormalized|isIEEE|isInfinite|isNaN|isNegativeZero|iterate|last|lcm|length|lex|lines|log|logBase|lookup|map|mapM|mapM_|max|maxBound|maximum|maybe|min|minBound|minimum|mod|negate|not|notElem|null|odd|or|otherwise|pi|pred|print|product|properFraction|putChar|putStr|putStrLn|quot|quotRem|read|readFile|readIO|readList|readLn|readParen|reads|readsPrec|realToFrac|recip|rem|repeat|replicate|return|reverse|round|scaleFloat|scanl|scanl1|scanr|scanr1|seq|sequence|sequence_|show|showChar|showList|showParen|showString|shows|showsPrec|significand|signum|sin|sinh|snd|span|splitAt|sqrt|subtract|succ|sum|tail|take|takeWhile|tan|tanh|toEnum|toInteger|toRational|truncate|uncurry|undefined|unlines|until|unwords|unzip|unzip3|userError|words|writeFile|zip|zip3|zipWith|zipWith3)\\b' },
         { include: '#infix_op' },
         { token: 'keyword.operator.haskell',
           regex: '[|!%$?~+:\\-.=</>\\\\]+',
           comment: 'In case this regex seems overly general, note that Haskell permits the definition of new operators which can be nearly any string of punctuation characters, such as $%^&*.' },
         { token: 'punctuation.separator.comma.haskell', regex: ',' } ],
      '#block_comment':
       [ { token: 'punctuation.definition.comment.haskell',
           regex: '\\{-(?!#)',
           push:
            [ { include: '#block_comment' },
              { token: 'punctuation.definition.comment.haskell',
                regex: '-\\}',
                next: 'pop' },
              { defaultToken: 'comment.block.haskell' } ] } ],
      '#comments':
       [ { token: 'punctuation.definition.comment.haskell',
           regex: '--.*',
           push_:
            [ { token: 'comment.line.double-dash.haskell',
                regex: '$',
                next: 'pop' },
              { defaultToken: 'comment.line.double-dash.haskell' } ] },
         { include: '#block_comment' } ],
      '#infix_op':
       [ { token: 'entity.name.function.infix.haskell',
           regex: '\\([|!%$+:\\-.=</>]+\\)|\\(,+\\)' } ],
      '#module_exports':
       [ { token: 'meta.declaration.exports.haskell',
           regex: '\\(',
           push:
            [ { token: 'meta.declaration.exports.haskell.end',
                regex: '\\)',
                next: 'pop' },
              { token: 'entity.name.function.haskell',
                regex: '\\b[a-z][a-zA-Z_\']*' },
              { token: 'storage.type.haskell', regex: '\\b[A-Z][A-Za-z_\']*' },
              { token: 'punctuation.separator.comma.haskell', regex: ',' },
              { include: '#infix_op' },
              { token: 'meta.other.unknown.haskell',
                regex: '\\(.*?\\)',
                comment: 'So named because I don\'t know what to call this.' },
              { defaultToken: 'meta.declaration.exports.haskell.end' } ] } ],
      '#module_name':
       [ { token: 'support.other.module.haskell',
           regex: '[A-Z][A-Za-z._\']*' } ],
      '#pragma':
       [ { token: 'meta.preprocessor.haskell',
           regex: '\\{-#',
           push:
            [ { token: 'meta.preprocessor.haskell',
                regex: '#-\\}',
                next: 'pop' },
              { token: 'keyword.other.preprocessor.haskell',
                regex: '\\b(?:LANGUAGE|UNPACK|INLINE)\\b' },
              { defaultToken: 'meta.preprocessor.haskell' } ] } ],
      '#type_signature':
       [ { token:
            [ 'meta.class-constraint.haskell',
              'entity.other.inherited-class.haskell',
              'meta.class-constraint.haskell',
              'variable.other.generic-type.haskell',
              'meta.class-constraint.haskell',
              'keyword.other.big-arrow.haskell' ],
           regex: '(\\(\\s*)([A-Z][A-Za-z]*)(\\s+)([a-z][A-Za-z_\']*)(\\)\\s*)(=>)' },
         { include: '#pragma' },
         { token: 'keyword.other.arrow.haskell', regex: '->' },
         { token: 'keyword.other.big-arrow.haskell', regex: '=>' },
         { token: 'support.type.prelude.haskell',
           regex: '\\b(?:Int(?:eger)?|Maybe|Either|Bool|Float|Double|Char|String|Ordering|ShowS|ReadS|FilePath|IO(?:Error)?)\\b' },
         { token: 'variable.other.generic-type.haskell',
           regex: '\\b[a-z][a-zA-Z0-9_\']*\\b' },
         { token: 'storage.type.haskell',
           regex: '\\b[A-Z][a-zA-Z0-9_\']*\\b' },
         { token: 'support.constant.unit.haskell', regex: '\\(\\)' },
         { include: '#comments' } ] };

    this.normalizeRules();
};

HaskellHighlightRules.metaData = { fileTypes: [ 'hs' ],
      keyEquivalent: '^~H',
      name: 'Haskell',
      scopeName: 'source.haskell' };


oop.inherits(HaskellHighlightRules, TextHighlightRules);

exports.HaskellHighlightRules = HaskellHighlightRules;
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

ace.define("ace/mode/haskell",["require","exports","module","ace/lib/oop","ace/mode/text","ace/mode/haskell_highlight_rules","ace/mode/folding/cstyle"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../lib/oop");
var TextMode = acequire("./text").Mode;
var HaskellHighlightRules = acequire("./haskell_highlight_rules").HaskellHighlightRules;
var FoldMode = acequire("./folding/cstyle").FoldMode;

var Mode = function() {
    this.HighlightRules = HaskellHighlightRules;
    this.foldingRules = new FoldMode();
    this.$behaviour = this.$defaultBehaviour;
};
oop.inherits(Mode, TextMode);

(function() {
    this.lineCommentStart = "--";
    this.blockComment = null;
    this.$id = "ace/mode/haskell";
}).call(Mode.prototype);

exports.Mode = Mode;
});
