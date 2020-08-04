ace.define("ace/mode/sh_highlight_rules",["require","exports","module","ace/lib/oop","ace/mode/text_highlight_rules"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../lib/oop");
var TextHighlightRules = acequire("./text_highlight_rules").TextHighlightRules;

var reservedKeywords = exports.reservedKeywords = (
        '!|{|}|case|do|done|elif|else|'+
        'esac|fi|for|if|in|then|until|while|'+
        '&|;|export|local|read|typeset|unset|'+
        'elif|select|set|function|declare|readonly'
    );

var languageConstructs = exports.languageConstructs = (
    '[|]|alias|bg|bind|break|builtin|'+
     'cd|command|compgen|complete|continue|'+
     'dirs|disown|echo|enable|eval|exec|'+
     'exit|fc|fg|getopts|hash|help|history|'+
     'jobs|kill|let|logout|popd|printf|pushd|'+
     'pwd|return|set|shift|shopt|source|'+
     'suspend|test|times|trap|type|ulimit|'+
     'umask|unalias|wait'
);

var ShHighlightRules = function() {
    var keywordMapper = this.createKeywordMapper({
        "keyword": reservedKeywords,
        "support.function.builtin": languageConstructs,
        "invalid.deprecated": "debugger"
    }, "identifier");

    var integer = "(?:(?:[1-9]\\d*)|(?:0))";

    var fraction = "(?:\\.\\d+)";
    var intPart = "(?:\\d+)";
    var pointFloat = "(?:(?:" + intPart + "?" + fraction + ")|(?:" + intPart + "\\.))";
    var exponentFloat = "(?:(?:" + pointFloat + "|" +  intPart + ")" + ")";
    var floatNumber = "(?:" + exponentFloat + "|" + pointFloat + ")";
    var fileDescriptor = "(?:&" + intPart + ")";

    var variableName = "[a-zA-Z_][a-zA-Z0-9_]*";
    var variable = "(?:" + variableName + "(?==))";

    var builtinVariable = "(?:\\$(?:SHLVL|\\$|\\!|\\?))";

    var func = "(?:" + variableName + "\\s*\\(\\))";

    this.$rules = {
        "start" : [{
            token : "constant",
            regex : /\\./
        }, {
            token : ["text", "comment"],
            regex : /(^|\s)(#.*)$/
        }, {
            token : "string.start",
            regex : '"',
            push : [{
                token : "constant.language.escape",
                regex : /\\(?:[$`"\\]|$)/
            }, {
                include : "variables"
            }, {
                token : "keyword.operator",
                regex : /`/ // TODO highlight `
            }, {
                token : "string.end",
                regex : '"',
                next: "pop"
            }, {
                defaultToken: "string"
            }]
        }, {
            token : "string",
            regex : "\\$'",
            push : [{
                token : "constant.language.escape",
                regex : /\\(?:[abeEfnrtv\\'"]|x[a-fA-F\d]{1,2}|u[a-fA-F\d]{4}([a-fA-F\d]{4})?|c.|\d{1,3})/
            }, {
                token : "string",
                regex : "'",
                next: "pop"
            }, {
                defaultToken: "string"
            }]
        }, {
            regex : "<<<",
            token : "keyword.operator"
        }, {
            stateName: "heredoc",
            regex : "(<<-?)(\\s*)(['\"`]?)([\\w\\-]+)(['\"`]?)",
            onMatch : function(value, currentState, stack) {
                var next = value[2] == '-' ? "indentedHeredoc" : "heredoc";
                var tokens = value.split(this.splitRegex);
                stack.push(next, tokens[4]);
                return [
                    {type:"constant", value: tokens[1]},
                    {type:"text", value: tokens[2]},
                    {type:"string", value: tokens[3]},
                    {type:"support.class", value: tokens[4]},
                    {type:"string", value: tokens[5]}
                ];
            },
            rules: {
                heredoc: [{
                    onMatch:  function(value, currentState, stack) {
                        if (value === stack[1]) {
                            stack.shift();
                            stack.shift();
                            this.next = stack[0] || "start";
                            return "support.class";
                        }
                        this.next = "";
                        return "string";
                    },
                    regex: ".*$",
                    next: "start"
                }],
                indentedHeredoc: [{
                    token: "string",
                    regex: "^\t+"
                }, {
                    onMatch:  function(value, currentState, stack) {
                        if (value === stack[1]) {
                            stack.shift();
                            stack.shift();
                            this.next = stack[0] || "start";
                            return "support.class";
                        }
                        this.next = "";
                        return "string";
                    },
                    regex: ".*$",
                    next: "start"
                }]
            }
        }, {
            regex : "$",
            token : "empty",
            next : function(currentState, stack) {
                if (stack[0] === "heredoc" || stack[0] === "indentedHeredoc")
                    return stack[0];
                return currentState;
            }
        }, {
            token : ["keyword", "text", "text", "text", "variable"],
            regex : /(declare|local|readonly)(\s+)(?:(-[fixar]+)(\s+))?([a-zA-Z_][a-zA-Z0-9_]*\b)/
        }, {
            token : "variable.language",
            regex : builtinVariable
        }, {
            token : "variable",
            regex : variable
        }, {
            include : "variables"
        }, {
            token : "support.function",
            regex : func
        }, {
            token : "support.function",
            regex : fileDescriptor
        }, {
            token : "string",           // ' string
            start : "'", end : "'"
        }, {
            token : "constant.numeric", // float
            regex : floatNumber
        }, {
            token : "constant.numeric", // integer
            regex : integer + "\\b"
        }, {
            token : keywordMapper,
            regex : "[a-zA-Z_][a-zA-Z0-9_]*\\b"
        }, {
            token : "keyword.operator",
            regex : "\\+|\\-|\\*|\\*\\*|\\/|\\/\\/|~|<|>|<=|=>|=|!=|[%&|`]"
        }, {
            token : "punctuation.operator",
            regex : ";"
        }, {
            token : "paren.lparen",
            regex : "[\\[\\(\\{]"
        }, {
            token : "paren.rparen",
            regex : "[\\]]"
        }, {
            token : "paren.rparen",
            regex : "[\\)\\}]",
            next : "pop"
        }],
        variables: [{
            token : "variable",
            regex : /(\$)(\w+)/
        }, {
            token : ["variable", "paren.lparen"],
            regex : /(\$)(\()/,
            push : "start"
        }, {
            token : ["variable", "paren.lparen", "keyword.operator", "variable", "keyword.operator"],
            regex : /(\$)(\{)([#!]?)(\w+|[*@#?\-$!0_])(:[?+\-=]?|##?|%%?|,,?\/|\^\^?)?/,
            push : "start"
        }, {
            token : "variable",
            regex : /\$[*@#?\-$!0_]/
        }, {
            token : ["variable", "paren.lparen"],
            regex : /(\$)(\{)/,
            push : "start"
        }]
    };
    
    this.normalizeRules();
};

oop.inherits(ShHighlightRules, TextHighlightRules);

exports.ShHighlightRules = ShHighlightRules;
});

ace.define("ace/mode/makefile_highlight_rules",["require","exports","module","ace/lib/oop","ace/mode/text_highlight_rules","ace/mode/sh_highlight_rules"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../lib/oop");
var TextHighlightRules = acequire("./text_highlight_rules").TextHighlightRules;

var ShHighlightFile = acequire("./sh_highlight_rules");

var MakefileHighlightRules = function() {

    var keywordMapper = this.createKeywordMapper({
        "keyword": ShHighlightFile.reservedKeywords,
        "support.function.builtin": ShHighlightFile.languageConstructs,
        "invalid.deprecated": "debugger"
    }, "string");

    this.$rules = 
        {
    "start": [
        {
            token: "string.interpolated.backtick.makefile",
            regex: "`",
            next: "shell-start"
        },
        {
            token: "punctuation.definition.comment.makefile",
            regex: /#(?=.)/,
            next: "comment"
        },
        {
            token: [ "keyword.control.makefile"],
            regex: "^(?:\\s*\\b)(\\-??include|ifeq|ifneq|ifdef|ifndef|else|endif|vpath|export|unexport|define|endef|override)(?:\\b)"
        },
        {// ^([^\t ]+(\s[^\t ]+)*:(?!\=))\s*.*
            token: ["entity.name.function.makefile", "text"],
            regex: "^([^\\t ]+(?:\\s[^\\t ]+)*:)(\\s*.*)"
        }
    ],
    "comment": [
        {
            token : "punctuation.definition.comment.makefile",
            regex : /.+\\/
        },
        {
            token : "punctuation.definition.comment.makefile",
            regex : ".+",
            next  : "start"
        }
    ],
    "shell-start": [
        {
            token: keywordMapper,
            regex : "[a-zA-Z_$][a-zA-Z0-9_$]*\\b"
        }, 
        {
            token: "string",
            regex : "\\w+"
        }, 
        {
            token : "string.interpolated.backtick.makefile",
            regex : "`",
            next  : "start"
        }
    ]
};

};

oop.inherits(MakefileHighlightRules, TextHighlightRules);

exports.MakefileHighlightRules = MakefileHighlightRules;
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

ace.define("ace/mode/makefile",["require","exports","module","ace/lib/oop","ace/mode/text","ace/mode/makefile_highlight_rules","ace/mode/folding/coffee"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../lib/oop");
var TextMode = acequire("./text").Mode;
var MakefileHighlightRules = acequire("./makefile_highlight_rules").MakefileHighlightRules;
var FoldMode = acequire("./folding/coffee").FoldMode;

var Mode = function() {
    this.HighlightRules = MakefileHighlightRules;
    this.foldingRules = new FoldMode();
    this.$behaviour = this.$defaultBehaviour;
};
oop.inherits(Mode, TextMode);

(function() {
       
    this.lineCommentStart = "#";    
    this.$indentWithTabs = true;
    
    this.$id = "ace/mode/makefile";
}).call(Mode.prototype);

exports.Mode = Mode;
});
