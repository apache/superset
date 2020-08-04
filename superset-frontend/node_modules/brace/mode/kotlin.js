ace.define("ace/mode/kotlin_highlight_rules",["require","exports","module","ace/lib/oop","ace/mode/text_highlight_rules"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../lib/oop");
var TextHighlightRules = acequire("./text_highlight_rules").TextHighlightRules;

var KotlinHighlightRules = function() {

    this.$rules = {
        start: [{
            include: "#comments"
        }, {
            token: [
                "text",
                "keyword.other.kotlin",
                "text",
                "entity.name.package.kotlin",
                "text"
            ],
            regex: /^(\s*)(package)\b(?:(\s*)([^ ;$]+)(\s*))?/
        }, {
            include: "#imports"
        }, {
            include: "#statements"
        }],
        "#classes": [{
            token: "text",
            regex: /(?=\s*(?:companion|class|object|interface))/,
            push: [{
                token: "text",
                regex: /}|(?=$)/,
                next: "pop"
            }, {
                token: ["keyword.other.kotlin", "text"],
                regex: /\b((?:companion\s*)?)(class|object|interface)\b/,
                push: [{
                    token: "text",
                    regex: /(?=<|{|\(|:)/,
                    next: "pop"
                }, {
                    token: "keyword.other.kotlin",
                    regex: /\bobject\b/
                }, {
                    token: "entity.name.type.class.kotlin",
                    regex: /\w+/
                }]
            }, {
                token: "text",
                regex: /</,
                push: [{
                    token: "text",
                    regex: />/,
                    next: "pop"
                }, {
                    include: "#generics"
                }]
            }, {
                token: "text",
                regex: /\(/,
                push: [{
                    token: "text",
                    regex: /\)/,
                    next: "pop"
                }, {
                    include: "#parameters"
                }]
            }, {
                token: "keyword.operator.declaration.kotlin",
                regex: /:/,
                push: [{
                    token: "text",
                    regex: /(?={|$)/,
                    next: "pop"
                }, {
                    token: "entity.other.inherited-class.kotlin",
                    regex: /\w+/
                }, {
                    token: "text",
                    regex: /\(/,
                    push: [{
                        token: "text",
                        regex: /\)/,
                        next: "pop"
                    }, {
                        include: "#expressions"
                    }]
                }]
            }, {
                token: "text",
                regex: /\{/,
                push: [{
                    token: "text",
                    regex: /\}/,
                    next: "pop"
                }, {
                    include: "#statements"
                }]
            }]
        }],
        "#comments": [{
            token: "punctuation.definition.comment.kotlin",
            regex: /\/\*/,
            push: [{
                token: "punctuation.definition.comment.kotlin",
                regex: /\*\//,
                next: "pop"
            }, {
                defaultToken: "comment.block.kotlin"
            }]
        }, {
            token: [
                "text",
                "punctuation.definition.comment.kotlin",
                "comment.line.double-slash.kotlin"
            ],
            regex: /(\s*)(\/\/)(.*$)/
        }],
        "#constants": [{
            token: "constant.language.kotlin",
            regex: /\b(?:true|false|null|this|super)\b/
        }, {
            token: "constant.numeric.kotlin",
            regex: /\b(?:0(?:x|X)[0-9a-fA-F]*|(?:[0-9]+\.?[0-9]*|\.[0-9]+)(?:(?:e|E)(?:\+|-)?[0-9]+)?)(?:[LlFfUuDd]|UL|ul)?\b/
        }, {
            token: "constant.other.kotlin",
            regex: /\b[A-Z][A-Z0-9_]+\b/
        }],
        "#expressions": [{
            token: "text",
            regex: /\(/,
            push: [{
                token: "text",
                regex: /\)/,
                next: "pop"
            }, {
                include: "#expressions"
            }]
        }, {
            include: "#types"
        }, {
            include: "#strings"
        }, {
            include: "#constants"
        }, {
            include: "#comments"
        }, {
            include: "#keywords"
        }],
        "#functions": [{
            token: "text",
            regex: /(?=\s*fun)/,
            push: [{
                token: "text",
                regex: /}|(?=$)/,
                next: "pop"
            }, {
                token: "keyword.other.kotlin",
                regex: /\bfun\b/,
                push: [{
                    token: "text",
                    regex: /(?=\()/,
                    next: "pop"
                }, {
                    token: "text",
                    regex: /</,
                    push: [{
                        token: "text",
                        regex: />/,
                        next: "pop"
                    }, {
                        include: "#generics"
                    }]
                }, {
                    token: ["text", "entity.name.function.kotlin"],
                    regex: /((?:[\.<\?>\w]+\.)?)(\w+)/
                }]
            }, {
                token: "text",
                regex: /\(/,
                push: [{
                    token: "text",
                    regex: /\)/,
                    next: "pop"
                }, {
                    include: "#parameters"
                }]
            }, {
                token: "keyword.operator.declaration.kotlin",
                regex: /:/,
                push: [{
                    token: "text",
                    regex: /(?={|=|$)/,
                    next: "pop"
                }, {
                    include: "#types"
                }]
            }, {
                token: "text",
                regex: /\{/,
                push: [{
                    token: "text",
                    regex: /(?=\})/,
                    next: "pop"
                }, {
                    include: "#statements"
                }]
            }, {
                token: "keyword.operator.assignment.kotlin",
                regex: /=/,
                push: [{
                    token: "text",
                    regex: /(?=$)/,
                    next: "pop"
                }, {
                    include: "#expressions"
                }]
            }]
        }],
        "#generics": [{
            token: "keyword.operator.declaration.kotlin",
            regex: /:/,
            push: [{
                token: "text",
                regex: /(?=,|>)/,
                next: "pop"
            }, {
                include: "#types"
            }]
        }, {
            include: "#keywords"
        }, {
            token: "storage.type.generic.kotlin",
            regex: /\w+/
        }],
        "#getters-and-setters": [{
            token: ["entity.name.function.kotlin", "text"],
            regex: /\b(get)\b(\s*\(\s*\))/,
            push: [{
                token: "text",
                regex: /\}|(?=\bset\b)|$/,
                next: "pop"
            }, {
                token: "keyword.operator.assignment.kotlin",
                regex: /=/,
                push: [{
                    token: "text",
                    regex: /(?=$|\bset\b)/,
                    next: "pop"
                }, {
                    include: "#expressions"
                }]
            }, {
                token: "text",
                regex: /\{/,
                push: [{
                    token: "text",
                    regex: /\}/,
                    next: "pop"
                }, {
                    include: "#expressions"
                }]
            }]
        }, {
            token: ["entity.name.function.kotlin", "text"],
            regex: /\b(set)\b(\s*)(?=\()/,
            push: [{
                token: "text",
                regex: /\}|(?=\bget\b)|$/,
                next: "pop"
            }, {
                token: "text",
                regex: /\(/,
                push: [{
                    token: "text",
                    regex: /\)/,
                    next: "pop"
                }, {
                    include: "#parameters"
                }]
            }, {
                token: "keyword.operator.assignment.kotlin",
                regex: /=/,
                push: [{
                    token: "text",
                    regex: /(?=$|\bset\b)/,
                    next: "pop"
                }, {
                    include: "#expressions"
                }]
            }, {
                token: "text",
                regex: /\{/,
                push: [{
                    token: "text",
                    regex: /\}/,
                    next: "pop"
                }, {
                    include: "#expressions"
                }]
            }]
        }],
        "#imports": [{
            token: [
                "text",
                "keyword.other.kotlin",
                "text",
                "keyword.other.kotlin"
            ],
            regex: /^(\s*)(import)(\s+[^ $]+\s+)((?:as)?)/
        }],
        "#keywords": [{
            token: "storage.modifier.kotlin",
            regex: /\b(?:var|val|public|private|protected|abstract|final|enum|open|attribute|annotation|override|inline|var|val|vararg|lazy|in|out|internal|data|tailrec|operator|infix|const|yield|typealias|typeof)\b/
        }, {
            token: "keyword.control.catch-exception.kotlin",
            regex: /\b(?:try|catch|finally|throw)\b/
        }, {
            token: "keyword.control.kotlin",
            regex: /\b(?:if|else|while|for|do|return|when|where|break|continue)\b/
        }, {
            token: "keyword.operator.kotlin",
            regex: /\b(?:in|is|as|assert)\b/
        }, {
            token: "keyword.operator.comparison.kotlin",
            regex: /==|!=|===|!==|<=|>=|<|>/
        }, {
            token: "keyword.operator.assignment.kotlin",
            regex: /=/
        }, {
            token: "keyword.operator.declaration.kotlin",
            regex: /:/
        }, {
            token: "keyword.operator.dot.kotlin",
            regex: /\./
        }, {
            token: "keyword.operator.increment-decrement.kotlin",
            regex: /\-\-|\+\+/
        }, {
            token: "keyword.operator.arithmetic.kotlin",
            regex: /\-|\+|\*|\/|%/
        }, {
            token: "keyword.operator.arithmetic.assign.kotlin",
            regex: /\+=|\-=|\*=|\/=/
        }, {
            token: "keyword.operator.logical.kotlin",
            regex: /!|&&|\|\|/
        }, {
            token: "keyword.operator.range.kotlin",
            regex: /\.\./
        }, {
            token: "punctuation.terminator.kotlin",
            regex: /;/
        }],
        "#namespaces": [{
            token: "keyword.other.kotlin",
            regex: /\bnamespace\b/
        }, {
            token: "text",
            regex: /\{/,
            push: [{
                token: "text",
                regex: /\}/,
                next: "pop"
            }, {
                include: "#statements"
            }]
        }],
        "#parameters": [{
            token: "keyword.operator.declaration.kotlin",
            regex: /:/,
            push: [{
                token: "text",
                regex: /(?=,|\)|=)/,
                next: "pop"
            }, {
                include: "#types"
            }]
        }, {
            token: "keyword.operator.declaration.kotlin",
            regex: /=/,
            push: [{
                token: "text",
                regex: /(?=,|\))/,
                next: "pop"
            }, {
                include: "#expressions"
            }]
        }, {
            include: "#keywords"
        }, {
            token: "variable.parameter.function.kotlin",
            regex: /\w+/
        }],
        "#statements": [{
            include: "#namespaces"
        }, {
            include: "#typedefs"
        }, {
            include: "#classes"
        }, {
            include: "#functions"
        }, {
            include: "#variables"
        }, {
            include: "#getters-and-setters"
        }, {
            include: "#expressions"
        }],
        "#strings": [{
            token: "punctuation.definition.string.begin.kotlin",
            regex: /"""/,
            push: [{
                token: "punctuation.definition.string.end.kotlin",
                regex: /"""/,
                next: "pop"
            }, {
                token: "variable.parameter.template.kotlin",
                regex: /\$\w+|\$\{[^\}]+\}/
            }, {
                token: "constant.character.escape.kotlin",
                regex: /\\./
            }, {
                defaultToken: "string.quoted.third.kotlin"
            }]
        }, {
            token: "punctuation.definition.string.begin.kotlin",
            regex: /"/,
            push: [{
                token: "punctuation.definition.string.end.kotlin",
                regex: /"/,
                next: "pop"
            }, {
                token: "variable.parameter.template.kotlin",
                regex: /\$\w+|\$\{[^\}]+\}/
            }, {
                token: "constant.character.escape.kotlin",
                regex: /\\./
            }, {
                defaultToken: "string.quoted.double.kotlin"
            }]
        }, {
            token: "punctuation.definition.string.begin.kotlin",
            regex: /'/,
            push: [{
                token: "punctuation.definition.string.end.kotlin",
                regex: /'/,
                next: "pop"
            }, {
                token: "constant.character.escape.kotlin",
                regex: /\\./
            }, {
                defaultToken: "string.quoted.single.kotlin"
            }]
        }, {
            token: "punctuation.definition.string.begin.kotlin",
            regex: /`/,
            push: [{
                token: "punctuation.definition.string.end.kotlin",
                regex: /`/,
                next: "pop"
            }, {
                defaultToken: "string.quoted.single.kotlin"
            }]
        }],
        "#typedefs": [{
            token: "text",
            regex: /(?=\s*type)/,
            push: [{
                token: "text",
                regex: /(?=$)/,
                next: "pop"
            }, {
                token: "keyword.other.kotlin",
                regex: /\btype\b/
            }, {
                token: "text",
                regex: /</,
                push: [{
                    token: "text",
                    regex: />/,
                    next: "pop"
                }, {
                    include: "#generics"
                }]
            }, {
                include: "#expressions"
            }]
        }],
        "#types": [{
            token: "storage.type.buildin.kotlin",
            regex: /\b(?:Any|Unit|String|Int|Boolean|Char|Long|Double|Float|Short|Byte|dynamic)\b/
        }, {
            token: "storage.type.buildin.array.kotlin",
            regex: /\b(?:IntArray|BooleanArray|CharArray|LongArray|DoubleArray|FloatArray|ShortArray|ByteArray)\b/
        }, {
            token: [
                "storage.type.buildin.collection.kotlin",
                "text"
            ],
            regex: /\b(Array|List|Map)(<\b)/,
            push: [{
                token: "text",
                regex: />/,
                next: "pop"
            }, {
                include: "#types"
            }, {
                include: "#keywords"
            }]
        }, {
            token: "text",
            regex: /\w+</,
            push: [{
                token: "text",
                regex: />/,
                next: "pop"
            }, {
                include: "#types"
            }, {
                include: "#keywords"
            }]
        }, {
            token: ["keyword.operator.tuple.kotlin", "text"],
            regex: /(#)(\()/,
            push: [{
                token: "text",
                regex: /\)/,
                next: "pop"
            }, {
                include: "#expressions"
            }]
        }, {
            token: "text",
            regex: /\{/,
            push: [{
                token: "text",
                regex: /\}/,
                next: "pop"
            }, {
                include: "#statements"
            }]
        }, {
            token: "text",
            regex: /\(/,
            push: [{
                token: "text",
                regex: /\)/,
                next: "pop"
            }, {
                include: "#types"
            }]
        }, {
            token: "keyword.operator.declaration.kotlin",
            regex: /->/
        }],
        "#variables": [{
            token: "text",
            regex: /(?=\s*(?:var|val))/,
            push: [{
                token: "text",
                regex: /(?=:|=|$)/,
                next: "pop"
            }, {
                token: "keyword.other.kotlin",
                regex: /\b(?:var|val)\b/,
                push: [{
                    token: "text",
                    regex: /(?=:|=|$)/,
                    next: "pop"
                }, {
                    token: "text",
                    regex: /</,
                    push: [{
                        token: "text",
                        regex: />/,
                        next: "pop"
                    }, {
                        include: "#generics"
                    }]
                }, {
                    token: ["text", "entity.name.variable.kotlin"],
                    regex: /((?:[\.<\?>\w]+\.)?)(\w+)/
                }]
            }, {
                token: "keyword.operator.declaration.kotlin",
                regex: /:/,
                push: [{
                    token: "text",
                    regex: /(?==|$)/,
                    next: "pop"
                }, {
                    include: "#types"
                }, {
                    include: "#getters-and-setters"
                }]
            }, {
                token: "keyword.operator.assignment.kotlin",
                regex: /=/,
                push: [{
                    token: "text",
                    regex: /(?=$)/,
                    next: "pop"
                }, {
                    include: "#expressions"
                }, {
                    include: "#getters-and-setters"
                }]
            }]
        }]
    };

    this.normalizeRules();
};

KotlinHighlightRules.metaData = {
    fileTypes: ["kt", "kts"],
    name: "Kotlin",
    scopeName: "source.Kotlin"
};


oop.inherits(KotlinHighlightRules, TextHighlightRules);

exports.KotlinHighlightRules = KotlinHighlightRules;
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

ace.define("ace/mode/kotlin",["require","exports","module","ace/lib/oop","ace/mode/text","ace/mode/kotlin_highlight_rules","ace/mode/folding/cstyle"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../lib/oop");
var TextMode = acequire("./text").Mode;
var KotlinHighlightRules = acequire("./kotlin_highlight_rules").KotlinHighlightRules;
var FoldMode = acequire("./folding/cstyle").FoldMode;

var Mode = function() {
    this.HighlightRules = KotlinHighlightRules;
    this.foldingRules = new FoldMode();
};
oop.inherits(Mode, TextMode);

(function() {
    this.$id = "ace/mode/kotlin";
}).call(Mode.prototype);

exports.Mode = Mode;
});
