ace.define("ace/mode/vala_highlight_rules",["require","exports","module","ace/lib/oop","ace/mode/text_highlight_rules"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../lib/oop");
var TextHighlightRules = acequire("./text_highlight_rules").TextHighlightRules;

var ValaHighlightRules = function() {

    this.$rules = { start: 
       [ { token: 
            [ 'meta.using.vala',
              'keyword.other.using.vala',
              'meta.using.vala',
              'storage.modifier.using.vala',
              'meta.using.vala',
              'punctuation.terminator.vala' ],
           regex: '^(\\s*)(using)\\b(?:(\\s*)([^ ;$]+)(\\s*)((?:;)?))?' },
         { include: '#code' } ],
      '#all-types': 
       [ { include: '#primitive-arrays' },
         { include: '#primitive-types' },
         { include: '#object-types' } ],
      '#annotations': 
       [ { token: 
            [ 'storage.type.annotation.vala',
              'punctuation.definition.annotation-arguments.begin.vala' ],
           regex: '(@[^ (]+)(\\()',
           push: 
            [ { token: 'punctuation.definition.annotation-arguments.end.vala',
                regex: '\\)',
                next: 'pop' },
              { token: 
                 [ 'constant.other.key.vala',
                   'text',
                   'keyword.operator.assignment.vala' ],
                regex: '(\\w*)(\\s*)(=)' },
              { include: '#code' },
              { token: 'punctuation.seperator.property.vala', regex: ',' },
              { defaultToken: 'meta.declaration.annotation.vala' } ] },
         { token: 'storage.type.annotation.vala', regex: '@\\w*' } ],
      '#anonymous-classes-and-new': 
       [ { token: 'keyword.control.new.vala',
           regex: '\\bnew\\b',
           push_disabled: 
            [ { token: 'text',
                regex: '(?<=\\)|\\])(?!\\s*{)|(?<=})|(?=;)',
                TODO: 'FIXME: regexp doesn\'t have js equivalent',
                originalRegex: '(?<=\\)|\\])(?!\\s*{)|(?<=})|(?=;)',
                next: 'pop' },
              { token: [ 'storage.type.vala', 'text' ],
                regex: '(\\w+)(\\s*)(?=\\[)',
                push: 
                 [ { token: 'text', regex: '}|(?=;|\\))', next: 'pop' },
                   { token: 'text',
                     regex: '\\[',
                     push: 
                      [ { token: 'text', regex: '\\]', next: 'pop' },
                        { include: '#code' } ] },
                   { token: 'text',
                     regex: '{',
                     push: 
                      [ { token: 'text', regex: '(?=})', next: 'pop' },
                        { include: '#code' } ] } ] },
              { token: 'text',
                regex: '(?=\\w.*\\()',
                push: 
                 [ { token: 'text',
                     regex: '(?<=\\))',
                     TODO: 'FIXME: regexp doesn\'t have js equivalent',
                     originalRegex: '(?<=\\))',
                     next: 'pop' },
                   { include: '#object-types' },
                   { token: 'text',
                     regex: '\\(',
                     push: 
                      [ { token: 'text', regex: '\\)', next: 'pop' },
                        { include: '#code' } ] } ] },
              { token: 'meta.inner-class.vala',
                regex: '{',
                push: 
                 [ { token: 'meta.inner-class.vala', regex: '}', next: 'pop' },
                   { include: '#class-body' },
                   { defaultToken: 'meta.inner-class.vala' } ] } ] } ],
      '#assertions': 
       [ { token: 
            [ 'keyword.control.assert.vala',
              'meta.declaration.assertion.vala' ],
           regex: '\\b(assert|acequires|ensures)(\\s)',
           push: 
            [ { token: 'meta.declaration.assertion.vala',
                regex: '$',
                next: 'pop' },
              { token: 'keyword.operator.assert.expression-seperator.vala',
                regex: ':' },
              { include: '#code' },
              { defaultToken: 'meta.declaration.assertion.vala' } ] } ],
      '#class': 
       [ { token: 'meta.class.vala',
           regex: '(?=\\w?[\\w\\s]*(?:class|(?:@)?interface|enum|struct|namespace)\\s+\\w+)',
           push: 
            [ { token: 'paren.vala',
                regex: '}',
                next: 'pop' },
              { include: '#storage-modifiers' },
              { include: '#comments' },
              { token: 
                 [ 'storage.modifier.vala',
                   'meta.class.identifier.vala',
                   'entity.name.type.class.vala' ],
                regex: '(class|(?:@)?interface|enum|struct|namespace)(\\s+)([\\w\\.]+)' },
              { token: 'storage.modifier.extends.vala',
                regex: ':',
                push: 
                 [ { token: 'meta.definition.class.inherited.classes.vala',
                     regex: '(?={|,)',
                     next: 'pop' },
                   { include: '#object-types-inherited' },
                   { include: '#comments' },
                   { defaultToken: 'meta.definition.class.inherited.classes.vala' } ] },
              { token: 
                 [ 'storage.modifier.implements.vala',
                   'meta.definition.class.implemented.interfaces.vala' ],
                regex: '(,)(\\s)',
                push: 
                 [ { token: 'meta.definition.class.implemented.interfaces.vala',
                     regex: '(?=\\{)',
                     next: 'pop' },
                   { include: '#object-types-inherited' },
                   { include: '#comments' },
                   { defaultToken: 'meta.definition.class.implemented.interfaces.vala' } ] },
              { token: 'paren.vala',
                regex: '{',
                push: 
                 [ { token: 'paren.vala', regex: '(?=})', next: 'pop' },
                   { include: '#class-body' },
                   { defaultToken: 'meta.class.body.vala' } ] },
              { defaultToken: 'meta.class.vala' } ],
           comment: 'attempting to put namespace in here.' } ],
      '#class-body': 
       [ { include: '#comments' },
         { include: '#class' },
         { include: '#enums' },
         { include: '#methods' },
         { include: '#annotations' },
         { include: '#storage-modifiers' },
         { include: '#code' } ],
      '#code': 
       [ { include: '#comments' },
         { include: '#class' },
         { token: 'text',
           regex: '{',
           push: 
            [ { token: 'text', regex: '}', next: 'pop' },
              { include: '#code' } ] },
         { include: '#assertions' },
         { include: '#parens' },
         { include: '#constants-and-special-vars' },
         { include: '#anonymous-classes-and-new' },
         { include: '#keywords' },
         { include: '#storage-modifiers' },
         { include: '#strings' },
         { include: '#all-types' } ],
      '#comments': 
       [ { token: 'punctuation.definition.comment.vala',
           regex: '/\\*\\*/' },
         { include: 'text.html.javadoc' },
         { include: '#comments-inline' } ],
      '#comments-inline': 
       [ { token: 'punctuation.definition.comment.vala',
           regex: '/\\*',
           push: 
            [ { token: 'punctuation.definition.comment.vala',
                regex: '\\*/',
                next: 'pop' },
              { defaultToken: 'comment.block.vala' } ] },
         { token: 
            [ 'text',
              'punctuation.definition.comment.vala',
              'comment.line.double-slash.vala' ],
           regex: '(\\s*)(//)(.*$)' } ],
      '#constants-and-special-vars': 
       [ { token: 'constant.language.vala',
           regex: '\\b(?:true|false|null)\\b' },
         { token: 'variable.language.vala',
           regex: '\\b(?:this|base)\\b' },
         { token: 'constant.numeric.vala',
           regex: '\\b(?:0(?:x|X)[0-9a-fA-F]*|(?:[0-9]+\\.?[0-9]*|\\.[0-9]+)(?:(?:e|E)(?:\\+|-)?[0-9]+)?)(?:[LlFfUuDd]|UL|ul)?\\b' },
         { token: [ 'keyword.operator.dereference.vala', 'constant.other.vala' ],
           regex: '((?:\\.)?)\\b([A-Z][A-Z0-9_]+)(?!<|\\.class|\\s*\\w+\\s*=)\\b' } ],
      '#enums': 
       [ { token: 'text',
           regex: '^(?=\\s*[A-Z0-9_]+\\s*(?:{|\\(|,))',
           push: 
            [ { token: 'text', regex: '(?=;|})', next: 'pop' },
              { token: 'constant.other.enum.vala',
                regex: '\\w+',
                push: 
                 [ { token: 'meta.enum.vala', regex: '(?=,|;|})', next: 'pop' },
                   { include: '#parens' },
                   { token: 'text',
                     regex: '{',
                     push: 
                      [ { token: 'text', regex: '}', next: 'pop' },
                        { include: '#class-body' } ] },
                   { defaultToken: 'meta.enum.vala' } ] } ] } ],
      '#keywords': 
       [ { token: 'keyword.control.catch-exception.vala',
           regex: '\\b(?:try|catch|finally|throw)\\b' },
         { token: 'keyword.control.vala', regex: '\\?|:|\\?\\?' },
         { token: 'keyword.control.vala',
           regex: '\\b(?:return|break|case|continue|default|do|while|for|foreach|switch|if|else|in|yield|get|set|value)\\b' },
         { token: 'keyword.operator.vala',
           regex: '\\b(?:typeof|is|as)\\b' },
         { token: 'keyword.operator.comparison.vala',
           regex: '==|!=|<=|>=|<>|<|>' },
         { token: 'keyword.operator.assignment.vala', regex: '=' },
         { token: 'keyword.operator.increment-decrement.vala',
           regex: '\\-\\-|\\+\\+' },
         { token: 'keyword.operator.arithmetic.vala',
           regex: '\\-|\\+|\\*|\\/|%' },
         { token: 'keyword.operator.logical.vala', regex: '!|&&|\\|\\|' },
         { token: 'keyword.operator.dereference.vala',
           regex: '\\.(?=\\S)',
           originalRegex: '(?<=\\S)\\.(?=\\S)' },
         { token: 'punctuation.terminator.vala', regex: ';' },
         { token: 'keyword.operator.ownership', regex: 'owned|unowned' } ],
      '#methods': 
       [ { token: 'meta.method.vala',
           regex: '(?!new)(?=\\w.*\\s+)(?=[^=]+\\()',
           push: 
            [ { token: 'paren.vala', regex: '}|(?=;)', next: 'pop' },
              { include: '#storage-modifiers' },
              { token: [ 'entity.name.function.vala', 'meta.method.identifier.vala' ],
                regex: '([\\~\\w\\.]+)(\\s*\\()',
                push: 
                 [ { token: 'meta.method.identifier.vala',
                     regex: '\\)',
                     next: 'pop' },
                   { include: '#parameters' },
                   { defaultToken: 'meta.method.identifier.vala' } ] },
              { token: 'meta.method.return-type.vala',
                regex: '(?=\\w.*\\s+\\w+\\s*\\()',
                push: 
                 [ { token: 'meta.method.return-type.vala',
                     regex: '(?=\\w+\\s*\\()',
                     next: 'pop' },
                   { include: '#all-types' },
                   { defaultToken: 'meta.method.return-type.vala' } ] },
              { include: '#throws' },
              { token: 'paren.vala',
                regex: '{',
                push: 
                 [ { token: 'paren.vala', regex: '(?=})', next: 'pop' },
                   { include: '#code' },
                   { defaultToken: 'meta.method.body.vala' } ] },
              { defaultToken: 'meta.method.vala' } ] } ],
      '#namespace': 
       [ { token: 'text',
           regex: '^(?=\\s*[A-Z0-9_]+\\s*(?:{|\\(|,))',
           push: 
            [ { token: 'text', regex: '(?=;|})', next: 'pop' },
              { token: 'constant.other.namespace.vala',
                regex: '\\w+',
                push: 
                 [ { token: 'meta.namespace.vala', regex: '(?=,|;|})', next: 'pop' },
                   { include: '#parens' },
                   { token: 'text',
                     regex: '{',
                     push: 
                      [ { token: 'text', regex: '}', next: 'pop' },
                        { include: '#code' } ] },
                   { defaultToken: 'meta.namespace.vala' } ] } ],
           comment: 'This is not quite right. See the class grammar right now' } ],
      '#object-types': 
       [ { token: 'storage.type.generic.vala',
           regex: '\\b(?:[a-z]\\w*\\.)*[A-Z]+\\w*<',
           push: 
            [ { token: 'storage.type.generic.vala',
                regex: '>|[^\\w\\s,\\?<\\[()\\]]',
                TODO: 'FIXME: regexp doesn\'t have js equivalent',
                originalRegex: '>|[^\\w\\s,\\?<\\[(?:[,]+)\\]]',
                next: 'pop' },
              { include: '#object-types' },
              { token: 'storage.type.generic.vala',
                regex: '<',
                push: 
                 [ { token: 'storage.type.generic.vala',
                     regex: '>|[^\\w\\s,\\[\\]<]',
                     next: 'pop' },
                   { defaultToken: 'storage.type.generic.vala' } ],
                comment: 'This is just to support <>\'s with no actual type prefix' },
              { defaultToken: 'storage.type.generic.vala' } ] },
         { token: 'storage.type.object.array.vala',
           regex: '\\b(?:[a-z]\\w*\\.)*[A-Z]+\\w*(?=\\[)',
           push: 
            [ { token: 'storage.type.object.array.vala',
                regex: '(?=[^\\]\\s])',
                next: 'pop' },
              { token: 'text',
                regex: '\\[',
                push: 
                 [ { token: 'text', regex: '\\]', next: 'pop' },
                   { include: '#code' } ] },
              { defaultToken: 'storage.type.object.array.vala' } ] },
         { token: 
            [ 'storage.type.vala',
              'keyword.operator.dereference.vala',
              'storage.type.vala' ],
           regex: '\\b(?:([a-z]\\w*)(\\.))*([A-Z]+\\w*\\b)' } ],
      '#object-types-inherited': 
       [ { token: 'entity.other.inherited-class.vala',
           regex: '\\b(?:[a-z]\\w*\\.)*[A-Z]+\\w*<',
           push: 
            [ { token: 'entity.other.inherited-class.vala',
                regex: '>|[^\\w\\s,<]',
                next: 'pop' },
              { include: '#object-types' },
              { token: 'storage.type.generic.vala',
                regex: '<',
                push: 
                 [ { token: 'storage.type.generic.vala',
                     regex: '>|[^\\w\\s,<]',
                     next: 'pop' },
                   { defaultToken: 'storage.type.generic.vala' } ],
                comment: 'This is just to support <>\'s with no actual type prefix' },
              { defaultToken: 'entity.other.inherited-class.vala' } ] },
         { token: 
            [ 'entity.other.inherited-class.vala',
              'keyword.operator.dereference.vala',
              'entity.other.inherited-class.vala' ],
           regex: '\\b(?:([a-z]\\w*)(\\.))*([A-Z]+\\w*)' } ],
      '#parameters': 
       [ { token: 'storage.modifier.vala', regex: 'final' },
         { include: '#primitive-arrays' },
         { include: '#primitive-types' },
         { include: '#object-types' },
         { token: 'variable.parameter.vala', regex: '\\w+' } ],
      '#parens': 
       [ { token: 'text',
           regex: '\\(',
           push: 
            [ { token: 'text', regex: '\\)', next: 'pop' },
              { include: '#code' } ] } ],
      '#primitive-arrays': 
       [ { token: 'storage.type.primitive.array.vala',
           regex: '\\b(?:bool|byte|sbyte|char|decimal|double|float|int|uint|long|ulong|object|short|ushort|string|void|int8|int16|int32|int64|uint8|uint16|uint32|uint64)(?:\\[\\])*\\b' } ],
      '#primitive-types': 
       [ { token: 'storage.type.primitive.vala',
           regex: '\\b(?:var|bool|byte|sbyte|char|decimal|double|float|int|uint|long|ulong|object|short|ushort|string|void|signal|int8|int16|int32|int64|uint8|uint16|uint32|uint64)\\b',
           comment: 'var is not really a primitive, but acts like one in most cases' } ],
      '#storage-modifiers': 
       [ { token: 'storage.modifier.vala',
           regex: '\\b(?:public|private|protected|internal|static|final|sealed|virtual|override|abstract|readonly|volatile|dynamic|async|unsafe|out|ref|weak|owned|unowned|const)\\b',
           comment: 'Not sure about unsafe and readonly' } ],
      '#strings': 
       [ { token: 'punctuation.definition.string.begin.vala',
           regex: '@"',
           push: 
            [ { token: 'punctuation.definition.string.end.vala',
                regex: '"',
                next: 'pop' },
              { token: 'constant.character.escape.vala',
                regex: '\\\\.|%[\\w\\.\\-]+|\\$(?:\\w+|\\([\\w\\s\\+\\-\\*\\/]+\\))' },
              { defaultToken: 'string.quoted.interpolated.vala' } ] },
         { token: 'punctuation.definition.string.begin.vala',
           regex: '"',
           push: 
            [ { token: 'punctuation.definition.string.end.vala',
                regex: '"',
                next: 'pop' },
              { token: 'constant.character.escape.vala', regex: '\\\\.' },
              { token: 'constant.character.escape.vala',
                regex: '%[\\w\\.\\-]+' },
              { defaultToken: 'string.quoted.double.vala' } ] },
         { token: 'punctuation.definition.string.begin.vala',
           regex: '\'',
           push: 
            [ { token: 'punctuation.definition.string.end.vala',
                regex: '\'',
                next: 'pop' },
              { token: 'constant.character.escape.vala', regex: '\\\\.' },
              { defaultToken: 'string.quoted.single.vala' } ] },
         { token: 'punctuation.definition.string.begin.vala',
           regex: '"""',
           push: 
            [ { token: 'punctuation.definition.string.end.vala',
                regex: '"""',
                next: 'pop' },
              { token: 'constant.character.escape.vala',
                regex: '%[\\w\\.\\-]+' },
              { defaultToken: 'string.quoted.triple.vala' } ] } ],
      '#throws': 
       [ { token: 'storage.modifier.vala',
           regex: 'throws',
           push: 
            [ { token: 'meta.throwables.vala', regex: '(?={|;)', next: 'pop' },
              { include: '#object-types' },
              { defaultToken: 'meta.throwables.vala' } ] } ],
      '#values': 
       [ { include: '#strings' },
         { include: '#object-types' },
         { include: '#constants-and-special-vars' } ] };
    
    this.normalizeRules();
};

ValaHighlightRules.metaData = { 
    comment: 'Based heavily on the Java bundle\'s language syntax. TODO:\n* Closures\n* Delegates\n* Properties: Better support for properties.\n* Annotations\n* Error domains\n* Named arguments\n* Array slicing, negative indexes, multidimensional\n* construct blocks\n* lock blocks?\n* regex literals\n* DocBlock syntax highlighting. (Currently importing javadoc)\n* Folding rule for comments.\n',
      fileTypes: [ 'vala' ],
      foldingStartMarker: '(\\{\\s*(//.*)?$|^\\s*// \\{\\{\\{)',
      foldingStopMarker: '^\\s*(\\}|// \\}\\}\\}$)',
      name: 'Vala',
      scopeName: 'source.vala' };


oop.inherits(ValaHighlightRules, TextHighlightRules);

exports.ValaHighlightRules = ValaHighlightRules;
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

ace.define("ace/mode/vala",["require","exports","module","ace/lib/oop","ace/mode/text","ace/tokenizer","ace/mode/vala_highlight_rules","ace/mode/folding/cstyle","ace/mode/behaviour/cstyle","ace/mode/folding/cstyle","ace/mode/matching_brace_outdent"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../lib/oop");
var TextMode = acequire("./text").Mode;
var Tokenizer = acequire("../tokenizer").Tokenizer;
var ValaHighlightRules = acequire("./vala_highlight_rules").ValaHighlightRules;
var FoldMode = acequire("./folding/cstyle").FoldMode;
var CstyleBehaviour = acequire("./behaviour/cstyle").CstyleBehaviour;
var CStyleFoldMode = acequire("./folding/cstyle").FoldMode;
var MatchingBraceOutdent = acequire("./matching_brace_outdent").MatchingBraceOutdent;

var Mode = function() {
    this.HighlightRules = ValaHighlightRules;
    
    this.$outdent = new MatchingBraceOutdent();
    this.$behaviour = new CstyleBehaviour();
    this.foldingRules = new CStyleFoldMode();
};
oop.inherits(Mode, TextMode);

(function() {
    this.lineCommentStart = "//";
    this.blockComment = {start: "/*", end: "*/"};

    this.getNextLineIndent = function(state, line, tab) {
        var indent = this.$getIndent(line);

        var tokenizedLine = this.getTokenizer().getLineTokens(line, state);
        var tokens = tokenizedLine.tokens;
        var endState = tokenizedLine.state;

        if (tokens.length && tokens[tokens.length-1].type == "comment") {
            return indent;
        }

        if (state == "start" || state == "no_regex") {
            var match = line.match(/^.*(?:\bcase\b.*:|[\{\(\[])\s*$/);
            if (match) {
                indent += tab;
            }
        } else if (state == "doc-start") {
            if (endState == "start" || endState == "no_regex") {
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
    this.$id = "ace/mode/vala";
}).call(Mode.prototype);

exports.Mode = Mode;
});
