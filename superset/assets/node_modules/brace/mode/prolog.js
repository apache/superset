ace.define("ace/mode/prolog_highlight_rules",["require","exports","module","ace/lib/oop","ace/mode/text_highlight_rules"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../lib/oop");
var TextHighlightRules = acequire("./text_highlight_rules").TextHighlightRules;

var PrologHighlightRules = function() {

    this.$rules = { start: 
       [ { include: '#comment' },
         { include: '#basic_fact' },
         { include: '#rule' },
         { include: '#directive' },
         { include: '#fact' } ],
      '#atom': 
       [ { token: 'constant.other.atom.prolog',
           regex: '\\b[a-z][a-zA-Z0-9_]*\\b' },
         { token: 'constant.numeric.prolog',
           regex: '-?\\d+(?:\\.\\d+)?' },
         { include: '#string' } ],
      '#basic_elem': 
       [ { include: '#comment' },
         { include: '#statement' },
         { include: '#constants' },
         { include: '#operators' },
         { include: '#builtins' },
         { include: '#list' },
         { include: '#atom' },
         { include: '#variable' } ],
      '#basic_fact': 
       [ { token: 
            [ 'entity.name.function.fact.basic.prolog',
              'punctuation.end.fact.basic.prolog' ],
           regex: '([a-z]\\w*)(\\.)' } ],
      '#builtins': 
       [ { token: 'support.function.builtin.prolog',
           regex: '\\b(?:abolish|abort|ancestors|arg|ascii|assert[az]|atom(?:ic)?|body|char|close|conc|concat|consult|define|definition|dynamic|dump|fail|file|free|free_proc|functor|getc|goal|halt|head|head|integer|length|listing|match_args|member|next_clause|nl|nonvar|nth|number|cvars|nvars|offset|op|print?|prompt|putc|quoted|ratom|read|redefine|rename|retract(?:all)?|see|seeing|seen|skip|spy|statistics|system|tab|tell|telling|term|time|told|univ|unlink_clause|unspy_predicate|var|write)\\b' } ],
      '#comment': 
       [ { token: 
            [ 'punctuation.definition.comment.prolog',
              'comment.line.percentage.prolog' ],
           regex: '(%)(.*$)' },
         { token: 'punctuation.definition.comment.prolog',
           regex: '/\\*',
           push: 
            [ { token: 'punctuation.definition.comment.prolog',
                regex: '\\*/',
                next: 'pop' },
              { defaultToken: 'comment.block.prolog' } ] } ],
      '#constants': 
       [ { token: 'constant.language.prolog',
           regex: '\\b(?:true|false|yes|no)\\b' } ],
      '#directive': 
       [ { token: 'keyword.operator.directive.prolog',
           regex: ':-',
           push: 
            [ { token: 'meta.directive.prolog', regex: '\\.', next: 'pop' },
              { include: '#comment' },
              { include: '#statement' },
              { defaultToken: 'meta.directive.prolog' } ] } ],
      '#expr': 
       [ { include: '#comments' },
         { token: 'meta.expression.prolog',
           regex: '\\(',
           push: 
            [ { token: 'meta.expression.prolog', regex: '\\)', next: 'pop' },
              { include: '#expr' },
              { defaultToken: 'meta.expression.prolog' } ] },
         { token: 'keyword.control.cutoff.prolog', regex: '!' },
         { token: 'punctuation.control.and.prolog', regex: ',' },
         { token: 'punctuation.control.or.prolog', regex: ';' },
         { include: '#basic_elem' } ],
      '#fact': 
       [ { token: 
            [ 'entity.name.function.fact.prolog',
              'punctuation.begin.fact.parameters.prolog' ],
           regex: '([a-z]\\w*)(\\()(?!.*:-)',
           push: 
            [ { token: 
                 [ 'punctuation.end.fact.parameters.prolog',
                   'punctuation.end.fact.prolog' ],
                regex: '(\\))(\\.?)',
                next: 'pop' },
              { include: '#parameter' },
              { defaultToken: 'meta.fact.prolog' } ] } ],
      '#list': 
       [ { token: 'punctuation.begin.list.prolog',
           regex: '\\[(?=.*\\])',
           push: 
            [ { token: 'punctuation.end.list.prolog',
                regex: '\\]',
                next: 'pop' },
              { include: '#comment' },
              { token: 'punctuation.separator.list.prolog', regex: ',' },
              { token: 'punctuation.concat.list.prolog',
                regex: '\\|',
                push: 
                 [ { token: 'meta.list.concat.prolog',
                     regex: '(?=\\s*\\])',
                     next: 'pop' },
                   { include: '#basic_elem' },
                   { defaultToken: 'meta.list.concat.prolog' } ] },
              { include: '#basic_elem' },
              { defaultToken: 'meta.list.prolog' } ] } ],
      '#operators': 
       [ { token: 'keyword.operator.prolog',
           regex: '\\\\\\+|\\bnot\\b|\\bis\\b|->|[><]|[><\\\\:=]?=|(?:=\\\\|\\\\=)=' } ],
      '#parameter': 
       [ { token: 'variable.language.anonymous.prolog',
           regex: '\\b_\\b' },
         { token: 'variable.parameter.prolog',
           regex: '\\b[A-Z_]\\w*\\b' },
         { token: 'punctuation.separator.parameters.prolog', regex: ',' },
         { include: '#basic_elem' },
         { token: 'text', regex: '[^\\s]' } ],
      '#rule': 
       [ { token: 'meta.rule.prolog',
           regex: '(?=[a-z]\\w*.*:-)',
           push: 
            [ { token: 'punctuation.rule.end.prolog',
                regex: '\\.',
                next: 'pop' },
              { token: 'meta.rule.signature.prolog',
                regex: '(?=[a-z]\\w*.*:-)',
                push: 
                 [ { token: 'meta.rule.signature.prolog',
                     regex: '(?=:-)',
                     next: 'pop' },
                   { token: 'entity.name.function.rule.prolog',
                     regex: '[a-z]\\w*(?=\\(|\\s*:-)' },
                   { token: 'punctuation.rule.parameters.begin.prolog',
                     regex: '\\(',
                     push: 
                      [ { token: 'punctuation.rule.parameters.end.prolog',
                          regex: '\\)',
                          next: 'pop' },
                        { include: '#parameter' },
                        { defaultToken: 'meta.rule.parameters.prolog' } ] },
                   { defaultToken: 'meta.rule.signature.prolog' } ] },
              { token: 'keyword.operator.definition.prolog',
                regex: ':-',
                push: 
                 [ { token: 'meta.rule.definition.prolog',
                     regex: '(?=\\.)',
                     next: 'pop' },
                   { include: '#comment' },
                   { include: '#expr' },
                   { defaultToken: 'meta.rule.definition.prolog' } ] },
              { defaultToken: 'meta.rule.prolog' } ] } ],
      '#statement': 
       [ { token: 'meta.statement.prolog',
           regex: '(?=[a-z]\\w*\\()',
           push: 
            [ { token: 'punctuation.end.statement.parameters.prolog',
                regex: '\\)',
                next: 'pop' },
              { include: '#builtins' },
              { include: '#atom' },
              { token: 'punctuation.begin.statement.parameters.prolog',
                regex: '\\(',
                push: 
                 [ { token: 'meta.statement.parameters.prolog',
                     regex: '(?=\\))',
                     next: 'pop' },
                   { token: 'punctuation.separator.statement.prolog', regex: ',' },
                   { include: '#basic_elem' },
                   { defaultToken: 'meta.statement.parameters.prolog' } ] },
              { defaultToken: 'meta.statement.prolog' } ] } ],
      '#string': 
       [ { token: 'punctuation.definition.string.begin.prolog',
           regex: '\'',
           push: 
            [ { token: 'punctuation.definition.string.end.prolog',
                regex: '\'',
                next: 'pop' },
              { token: 'constant.character.escape.prolog', regex: '\\\\.' },
              { token: 'constant.character.escape.quote.prolog',
                regex: '\'\'' },
              { defaultToken: 'string.quoted.single.prolog' } ] } ],
      '#variable': 
       [ { token: 'variable.language.anonymous.prolog',
           regex: '\\b_\\b' },
         { token: 'variable.other.prolog',
           regex: '\\b[A-Z_][a-zA-Z0-9_]*\\b' } ] };
    
    this.normalizeRules();
};

PrologHighlightRules.metaData = { fileTypes: [ 'plg', 'prolog' ],
      foldingStartMarker: '(%\\s*region \\w*)|([a-z]\\w*.*:- ?)',
      foldingStopMarker: '(%\\s*end(\\s*region)?)|(?=\\.)',
      keyEquivalent: '^~P',
      name: 'Prolog',
      scopeName: 'source.prolog' };


oop.inherits(PrologHighlightRules, TextHighlightRules);

exports.PrologHighlightRules = PrologHighlightRules;
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

ace.define("ace/mode/prolog",["require","exports","module","ace/lib/oop","ace/mode/text","ace/mode/prolog_highlight_rules","ace/mode/folding/cstyle"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../lib/oop");
var TextMode = acequire("./text").Mode;
var PrologHighlightRules = acequire("./prolog_highlight_rules").PrologHighlightRules;
var FoldMode = acequire("./folding/cstyle").FoldMode;

var Mode = function() {
    this.HighlightRules = PrologHighlightRules;
    this.foldingRules = new FoldMode();
    this.$behaviour = this.$defaultBehaviour;
};
oop.inherits(Mode, TextMode);

(function() {
    this.lineCommentStart = "%";
    this.blockComment = {start: "/*", end: "*/"};
    this.$id = "ace/mode/prolog";
}).call(Mode.prototype);

exports.Mode = Mode;
});
