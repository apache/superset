ace.define("ace/mode/rust_highlight_rules",["require","exports","module","ace/lib/oop","ace/mode/text_highlight_rules"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../lib/oop");
var TextHighlightRules = acequire("./text_highlight_rules").TextHighlightRules;

var stringEscape = /\\(?:[nrt0'"\\]|x[\da-fA-F]{2}|u\{[\da-fA-F]{6}\})/.source;
var RustHighlightRules = function() {

    this.$rules = { start:
       [ { token: 'variable.other.source.rust',
           regex: '\'[a-zA-Z_][a-zA-Z0-9_]*(?![\\\'])' },
         { token: 'string.quoted.single.source.rust',
           regex: "'(?:[^'\\\\]|" + stringEscape + ")'" },
         {
            stateName: "bracketedComment",
            onMatch : function(value, currentState, stack){
                stack.unshift(this.next, value.length - 1, currentState);
                return "string.quoted.raw.source.rust";
            },
            regex : /r#*"/,
            next  : [
                {
                    onMatch : function(value, currentState, stack) {
                        var token = "string.quoted.raw.source.rust";
                        if (value.length >= stack[1]) {
                            if (value.length > stack[1])
                                token = "invalid";
                            stack.shift();
                            stack.shift();
                            this.next = stack.shift();
                        } else {
                            this.next = "";
                        }
                        return token;
                    },
                    regex : /"#*/,
                    next  : "start"
                }, {
                    defaultToken : "string.quoted.raw.source.rust"
                }
            ]
         },
         { token: 'string.quoted.double.source.rust',
           regex: '"',
           push: 
            [ { token: 'string.quoted.double.source.rust',
                regex: '"',
                next: 'pop' },
              { token: 'constant.character.escape.source.rust',
                regex: stringEscape },
              { defaultToken: 'string.quoted.double.source.rust' } ] },
         { token: [ 'keyword.source.rust', 'text', 'entity.name.function.source.rust' ],
           regex: '\\b(fn)(\\s+)([a-zA-Z_][a-zA-Z0-9_]*)' },
         { token: 'support.constant', regex: '\\b[a-zA-Z_][\\w\\d]*::' },
         { token: 'keyword.source.rust',
           regex: '\\b(?:abstract|alignof|as|box|break|continue|const|crate|do|else|enum|extern|for|final|if|impl|in|let|loop|macro|match|mod|move|mut|offsetof|override|priv|proc|pub|pure|ref|return|self|sizeof|static|struct|super|trait|type|typeof|unsafe|unsized|use|virtual|where|while|yield)\\b' },
         { token: 'storage.type.source.rust',
           regex: '\\b(?:Self|isize|usize|char|bool|u8|u16|u32|u64|u128|f16|f32|f64|i8|i16|i32|i64|i128|str|option|either|c_float|c_double|c_void|FILE|fpos_t|DIR|dirent|c_char|c_schar|c_uchar|c_short|c_ushort|c_int|c_uint|c_long|c_ulong|size_t|ptrdiff_t|clock_t|time_t|c_longlong|c_ulonglong|intptr_t|uintptr_t|off_t|dev_t|ino_t|pid_t|mode_t|ssize_t)\\b' },
         { token: 'variable.language.source.rust', regex: '\\bself\\b' },
         
         { token: 'comment.line.doc.source.rust',
           regex: '//!.*$' },
         { token: 'comment.line.double-dash.source.rust',
           regex: '//.*$' },
         { token: 'comment.start.block.source.rust',
           regex: '/\\*',
           stateName: 'comment',
           push: 
            [ { token: 'comment.start.block.source.rust',
                regex: '/\\*',
                push: 'comment' },
              { token: 'comment.end.block.source.rust',
                regex: '\\*/',
                next: 'pop' },
              { defaultToken: 'comment.block.source.rust' } ] },
         
         { token: 'keyword.operator',
           regex: /\$|[-=]>|[-+%^=!&|<>]=?|[*/](?![*/])=?/ },
         { token : "punctuation.operator", regex : /[?:,;.]/ },
         { token : "paren.lparen", regex : /[\[({]/ },
         { token : "paren.rparen", regex : /[\])}]/ },
         { token: 'constant.language.source.rust',
           regex: '\\b(?:true|false|Some|None|Ok|Err)\\b' },
         { token: 'support.constant.source.rust',
           regex: '\\b(?:EXIT_FAILURE|EXIT_SUCCESS|RAND_MAX|EOF|SEEK_SET|SEEK_CUR|SEEK_END|_IOFBF|_IONBF|_IOLBF|BUFSIZ|FOPEN_MAX|FILENAME_MAX|L_tmpnam|TMP_MAX|O_RDONLY|O_WRONLY|O_RDWR|O_APPEND|O_CREAT|O_EXCL|O_TRUNC|S_IFIFO|S_IFCHR|S_IFBLK|S_IFDIR|S_IFREG|S_IFMT|S_IEXEC|S_IWRITE|S_IREAD|S_IRWXU|S_IXUSR|S_IWUSR|S_IRUSR|F_OK|R_OK|W_OK|X_OK|STDIN_FILENO|STDOUT_FILENO|STDERR_FILENO)\\b' },
         { token: 'meta.preprocessor.source.rust',
           regex: '\\b\\w\\(\\w\\)*!|#\\[[\\w=\\(\\)_]+\\]\\b' },
         { token: 'constant.numeric.source.rust',
           regex: /\b(?:0x[a-fA-F0-9_]+|0o[0-7_]+|0b[01_]+|[0-9][0-9_]*(?!\.))(?:[iu](?:size|8|16|32|64|128))?\b/ },
         { token: 'constant.numeric.source.rust',
           regex: /\b(?:[0-9][0-9_]*)(?:\.[0-9][0-9_]*)?(?:[Ee][+-][0-9][0-9_]*)?(?:f32|f64)?\b/ } ] };
    
    this.normalizeRules();
};

RustHighlightRules.metaData = { fileTypes: [ 'rs', 'rc' ],
      foldingStartMarker: '^.*\\bfn\\s*(\\w+\\s*)?\\([^\\)]*\\)(\\s*\\{[^\\}]*)?\\s*$',
      foldingStopMarker: '^\\s*\\}',
      name: 'Rust',
      scopeName: 'source.rust' };


oop.inherits(RustHighlightRules, TextHighlightRules);

exports.RustHighlightRules = RustHighlightRules;
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

ace.define("ace/mode/rust",["require","exports","module","ace/lib/oop","ace/mode/text","ace/mode/rust_highlight_rules","ace/mode/folding/cstyle"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../lib/oop");
var TextMode = acequire("./text").Mode;
var RustHighlightRules = acequire("./rust_highlight_rules").RustHighlightRules;
var FoldMode = acequire("./folding/cstyle").FoldMode;

var Mode = function() {
    this.HighlightRules = RustHighlightRules;
    this.foldingRules = new FoldMode();
    this.$behaviour = this.$defaultBehaviour;
};
oop.inherits(Mode, TextMode);

(function() {
    this.lineCommentStart = "//";
    this.blockComment = {start: "/*", end: "*/", nestable: true};
    this.$quotes = { '"': '"' };
    this.$id = "ace/mode/rust";
}).call(Mode.prototype);

exports.Mode = Mode;
});
