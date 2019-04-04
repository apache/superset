ace.define("ace/mode/mips_assembler_highlight_rules",["require","exports","module","ace/lib/oop","ace/mode/text_highlight_rules"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../lib/oop");
var TextHighlightRules = acequire("./text_highlight_rules").TextHighlightRules;

var MIPSAssemblerHighlightRules = function() {

    this.$rules = { start: 
       [ { token: 'support.function.pseudo.mips',
           regex: '\\b(?:mul|abs|div|divu|mulo|mulou|neg|negu|not|rem|remu|rol|ror|li|seq|sge|sgeu|sgt|sgtu|sle|sleu|sne|b|beqz|bge|bgeu|bgt|bgtu|ble|bleu|blt|bltu|bnez|la|ld|ulh|ulhu|ulw|sd|ush|usw|move|mfc1\\.d|l\\.d|l\\.s|s\\.d|s\\.s)\\b',
           comment: 'ok actually this are instructions, but one also could call them funtions…' },
         { token: 'support.function.mips',
           regex: '\\b(?:abs\\.d|abs\\.s|add|add\\.d|add\\.s|addi|addiu|addu|and|andi|bc1f|bc1t|beq|bgez|bgezal|bgtz|blez|bltz|bltzal|bne|break|c\\.eq\\.d|c\\.eq\\.s|c\\.le\\.d|c\\.le\\.s|c\\.lt\\.d|c\\.lt\\.s|ceil\\.w\\.d|ceil\\.w\\.s|clo|clz|cvt\\.d\\.s|cvt\\.d\\.w|cvt\\.s\\.d|cvt\\.s\\.w|cvt\\.w\\.d|cvt\\.w\\.s|div|div\\.d|div\\.s|divu|eret|floor\\.w\\.d|floor\\.w\\.s|j|jal|jalr|jr|lb|lbu|lh|lhu|ll|lui|lw|lwc1|lwl|lwr|madd|maddu|mfc0|mfc1|mfhi|mflo|mov\\.d|mov\\.s|movf|movf\\.d|movf\\.s|movn|movn\\.d|movn\\.s|movt|movt\\.d|movt\\.s|movz|movz\\.d|movz\\.s|msub|mtc0|mtc1|mthi|mtlo|mul|mul\\.d|mul\\.s|mult|multu|neg\\.d|neg\\.s|nop|nor|or|ori|round\\.w\\.d|round\\.w\\.s|sb|sc|sdc1|sh|sll|sllv|slt|slti|sltiu|sltu|sqrt\\.d|sqrt\\.s|sra|srav|srl|srlv|sub|sub\\.d|sub\\.s|subu|sw|swc1|swl|swr|syscall|teq|teqi|tge|tgei|tgeiu|tgeu|tlt|tlti|tltiu|tltu|trunc\\.w\\.d|trunc\\.w\\.s|xor|xori)\\b' },
         { token: 'storage.type.mips',
           regex: '\\.(?:ascii|asciiz|byte|data|double|float|half|kdata|ktext|space|text|word|set\\s*(?:noat|at))\\b' },
         { token: 'storage.modifier.mips',
           regex: '\\.(?:align|extern||globl)\\b' },
         { token: 
            [ 'entity.name.function.label.mips',
              'meta.function.label.mips' ],
           regex: '\\b([A-Za-z0-9_]+)(:)' },
         { token: 
            [ 'punctuation.definition.variable.mips',
              'variable.other.register.usable.by-number.mips' ],
           regex: '(\\$)(0|[2-9]|1[0-9]|2[0-5]|2[89]|3[0-1])\\b' },
         { token: 
            [ 'punctuation.definition.variable.mips',
              'variable.other.register.usable.by-name.mips' ],
           regex: '(\\$)(zero|v[01]|a[0-3]|t[0-9]|s[0-7]|gp|sp|fp|ra)\\b' },
         { token: 
            [ 'punctuation.definition.variable.mips',
              'variable.other.register.reserved.mips' ],
           regex: '(\\$)(at|k[01]|1|2[67])\\b' },
         { token: 
            [ 'punctuation.definition.variable.mips',
              'variable.other.register.usable.floating-point.mips',
              'variable.other.register.usable.floating-point.mips' ],
           regex: '(\\$)(f)([0-9]|1[0-9]|2[0-9]|3[0-1])\\b' },
         { token: 'constant.numeric.float.mips',
           regex: '\\b\\d+\\.\\d+\\b' },
         { token: 'constant.numeric.integer.mips',
           regex: '\\b(?:\\d+|0(?:x|X)[a-fA-F0-9]+)\\b' },
         { token: 'punctuation.definition.string.begin.mips',
           regex: '"',
           push: 
            [ { token: 'punctuation.definition.string.end.mips',
                regex: '"',
                next: 'pop' },
              { token: 'constant.character.escape.mips',
                regex: '\\\\[rnt\\\\"]' },
              { defaultToken: 'string.quoted.double.mips' } ] },
         { token: 'punctuation.definition.comment.mips',
           regex: '#',
           push: 
            [ { token: 'comment.line.number-sign.mips',
                regex: '$',
                next: 'pop' },
              { defaultToken: 'comment.line.number-sign.mips' } ] } ] }
    
    this.normalizeRules();
};

MIPSAssemblerHighlightRules.metaData = { fileTypes: [ 's', 'mips', 'spim', 'asm' ],
      keyEquivalent: '^~M',
      name: 'MIPS Assembler',
      scopeName: 'source.mips' }


oop.inherits(MIPSAssemblerHighlightRules, TextHighlightRules);

exports.MIPSAssemblerHighlightRules = MIPSAssemblerHighlightRules;
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
    
    this.foldingStartMarker = /(\{|\[)[^\}\]]*$|^\s*(\/\*)/;
    this.foldingStopMarker = /^[^\[\{]*(\}|\])|^[\s\*]*(\*\/)/;
    this.singleLineBlockCommentRe= /^\s*(\/\*).*\*\/\s*$/;
    this.tripleStarBlockCommentRe = /^\s*(\/\*\*\*).*\*\/\s*$/;
    this.startRegionRe = /^\s*(\/\*|\/\/)#region\b/;
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
        
        var re = /^\s*(?:\/\*|\/\/)#(end)?region\b/;
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

ace.define("ace/mode/mips_assembler",["require","exports","module","ace/lib/oop","ace/mode/text","ace/mode/mips_assembler_highlight_rules","ace/mode/folding/cstyle"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../lib/oop");
var TextMode = acequire("./text").Mode;
var MIPSAssemblerHighlightRules = acequire("./mips_assembler_highlight_rules").MIPSAssemblerHighlightRules;
var FoldMode = acequire("./folding/cstyle").FoldMode;

var Mode = function() {
    this.HighlightRules = MIPSAssemblerHighlightRules;
    this.foldingRules = new FoldMode();
};
oop.inherits(Mode, TextMode);

(function() {
    this.$id = "ace/mode/mips_assembler"
}).call(Mode.prototype);

exports.Mode = Mode;
});
