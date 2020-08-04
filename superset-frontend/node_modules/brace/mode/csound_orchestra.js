ace.define("ace/mode/csound_preprocessor_highlight_rules",["require","exports","module","ace/lib/oop","ace/mode/text_highlight_rules"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../lib/oop");

var TextHighlightRules = acequire("./text_highlight_rules").TextHighlightRules;

var CsoundPreprocessorHighlightRules = function() {

    this.semicolonComments = {
        token : "comment.line.semicolon.csound",
        regex : ";.*$"
    };

    this.comments = [
        {
            token : "punctuation.definition.comment.begin.csound",
            regex : "/\\*",
            push  : [
                {
                    token : "punctuation.definition.comment.end.csound",
                    regex : "\\*/",
                    next  : "pop"
                }, {
                    defaultToken: "comment.block.csound"
                }
            ]
        }, {
            token : "comment.line.double-slash.csound",
            regex : "//.*$"
        },
        this.semicolonComments
    ];

    this.macroUses = [
        {
            token : ["entity.name.function.preprocessor.csound", "punctuation.definition.macro-parameter-value-list.begin.csound"],
            regex : /(\$[A-Z_a-z]\w*\.?)(\()/,
            next  : "macro parameter value list"
        }, {
            token : "entity.name.function.preprocessor.csound",
            regex : /\$[A-Z_a-z]\w*(?:\.|\b)/
        }
    ];

    this.numbers = [
        {
            token : "constant.numeric.float.csound",
            regex : /(?:\d+[Ee][+-]?\d+)|(?:\d+\.\d*|\d*\.\d+)(?:[Ee][+-]?\d+)?/
        }, {
            token : ["storage.type.number.csound", "constant.numeric.integer.hexadecimal.csound"],
            regex : /(0[Xx])([0-9A-Fa-f]+)/
        }, {
            token : "constant.numeric.integer.decimal.csound",
            regex : /\d+/
        }
    ];

    this.bracedStringContents = [
        {
            token : "constant.character.escape.csound",
            regex : /\\(?:[\\abnrt"]|[0-7]{1,3})/
        },
        {
            token : "constant.character.placeholder.csound",
            regex : /%[#0\- +]*\d*(?:\.\d+)?[diuoxXfFeEgGaAcs]/
        }, {
            token : "constant.character.escape.csound",
            regex : /%%/
        }
    ];

    this.quotedStringContents = [
        this.macroUses,
        this.bracedStringContents
    ];

    var start = [
        this.comments,

        {
            token : "keyword.preprocessor.csound",
            regex : /#(?:e(?:nd(?:if)?|lse)\b|##)|@@?[ \t]*\d+/
        }, {
            token : "keyword.preprocessor.csound",
            regex : /#include/,
            push  : [
                this.comments,
                {
                    token : "string.csound",
                    regex : /([^ \t])(?:.*?\1)/,
                    next  : "pop"
                }
            ]
        }, {
            token : "keyword.preprocessor.csound",
            regex : /#[ \t]*define/,
            next  : "define directive"
        }, {
            token : "keyword.preprocessor.csound",
            regex : /#(?:ifn?def|undef)\b/,
            next  : "macro directive"
        },

        this.macroUses
    ];

    this.$rules = {
        "start": start,

        "define directive": [
            this.comments,
            {
                token : "entity.name.function.preprocessor.csound",
                regex : /[A-Z_a-z]\w*/
            }, {
                token : "punctuation.definition.macro-parameter-name-list.begin.csound",
                regex : /\(/,
                next  : "macro parameter name list"
            }, {
                token : "punctuation.definition.macro.begin.csound",
                regex : /#/,
                next  : "macro body"
            }
        ],
        "macro parameter name list": [
            {
                token : "variable.parameter.preprocessor.csound",
                regex : /[A-Z_a-z]\w*/
            }, {
                token : "punctuation.definition.macro-parameter-name-list.end.csound",
                regex : /\)/,
                next  : "define directive"
            }
        ],
        "macro body": [
            {
                token : "constant.character.escape.csound",
                regex : /\\#/
            }, {
                token : "punctuation.definition.macro.end.csound",
                regex : /#/,
                next  : "start"
            },
            start
        ],

        "macro directive": [
            this.comments,
            {
                token : "entity.name.function.preprocessor.csound",
                regex : /[A-Z_a-z]\w*/,
                next  : "start"
            }
        ],

        "macro parameter value list": [
            {
                token : "punctuation.definition.macro-parameter-value-list.end.csound",
                regex : /\)/,
                next  : "start"
            }, {
                token : "punctuation.definition.string.begin.csound",
                regex : /"/,
                next  : "macro parameter value quoted string"
            }, this.pushRule({
                token : "punctuation.macro-parameter-value-parenthetical.begin.csound",
                regex : /\(/,
                next  : "macro parameter value parenthetical"
            }), {
                token : "punctuation.macro-parameter-value-separator.csound",
                regex : "[#']"
            }
        ],
        "macro parameter value quoted string": [
            {
                token : "constant.character.escape.csound",
                regex : /\\[#'()]/
            }, {
                token : "invalid.illegal.csound",
                regex : /[#'()]/
            }, {
                token : "punctuation.definition.string.end.csound",
                regex : /"/,
                next  : "macro parameter value list"
            },
            this.quotedStringContents,
            {
                defaultToken: "string.quoted.csound"
            }
        ],
        "macro parameter value parenthetical": [
            {
                token : "constant.character.escape.csound",
                regex : /\\\)/
            }, this.popRule({
                token : "punctuation.macro-parameter-value-parenthetical.end.csound",
                regex : /\)/
            }), this.pushRule({
                token : "punctuation.macro-parameter-value-parenthetical.begin.csound",
                regex : /\(/,
                next  : "macro parameter value parenthetical"
            }),
            start
        ]
    };
};

oop.inherits(CsoundPreprocessorHighlightRules, TextHighlightRules);

(function() {

    this.pushRule = function(params) {
        return {
            regex : params.regex, onMatch: function(value, currentState, stack, line) {
                if (stack.length === 0)
                    stack.push(currentState);
                if (Array.isArray(params.next)) {
                    for (var i = 0; i < params.next.length; i++) {
                        stack.push(params.next[i]);
                    }
                } else {
                    stack.push(params.next);
                }
                this.next = stack[stack.length - 1];
                return params.token;
            },
            get next() { return Array.isArray(params.next) ? params.next[params.next.length - 1] : params.next; },
            set next(next) {
                if (Array.isArray(params.next)) {
                    var oldNext = params.next[params.next.length - 1];
                    var oldNextIndex = oldNext.length - 1;
                    var newNextIndex = next.length - 1;
                    if (newNextIndex > oldNextIndex) {
                        while (oldNextIndex >= 0 && newNextIndex >= 0) {
                            if (oldNext.charAt(oldNextIndex) !== next.charAt(newNextIndex)) {
                                var prefix = next.substr(0, newNextIndex);
                                for (var i = 0; i < params.next.length; i++) {
                                    params.next[i] = prefix + params.next[i];
                                }
                                break;
                            }
                            oldNextIndex--;
                            newNextIndex--;
                        }
                    }
                } else {
                    params.next = next;
                }
            },
            get token() { return params.token; }
        };
    };

    this.popRule = function(params) {
        return {
            regex : params.regex, onMatch: function(value, currentState, stack, line) {
                stack.pop();
                if (params.next) {
                    stack.push(params.next);
                    this.next = stack[stack.length - 1];
                } else {
                    this.next = stack.length > 1 ? stack[stack.length - 1] : stack.pop();
                }
                return params.token;
            }
        };
    };

}).call(CsoundPreprocessorHighlightRules.prototype);

exports.CsoundPreprocessorHighlightRules = CsoundPreprocessorHighlightRules;
});

ace.define("ace/mode/csound_score_highlight_rules",["require","exports","module","ace/lib/oop","ace/mode/csound_preprocessor_highlight_rules"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../lib/oop");

var CsoundPreprocessorHighlightRules = acequire("./csound_preprocessor_highlight_rules").CsoundPreprocessorHighlightRules;

var CsoundScoreHighlightRules = function() {

    CsoundPreprocessorHighlightRules.call(this);

    this.quotedStringContents.push({
        token : "invalid.illegal.csound-score",
        regex : /[^"]*$/
    });

    var start = this.$rules.start;
    start.push(
        {
            token : "keyword.control.csound-score",
            regex : /[abCdefiqstvxy]/
        }, {
            token : "invalid.illegal.csound-score",
            regex : /w/
        }, {
            token : "constant.numeric.language.csound-score",
            regex : /z/
        }, {
            token : ["keyword.control.csound-score", "constant.numeric.integer.decimal.csound-score"],
            regex : /([nNpP][pP])(\d+)/
        }, {
            token : "keyword.other.csound-score",
            regex : /[mn]/,
            push  : [
                {
                    token : "empty",
                    regex : /$/,
                    next  : "pop"
                },
                this.comments,
                {
                    token : "entity.name.label.csound-score",
                    regex : /[A-Z_a-z]\w*/
                }
            ]
        }, {
            token : "keyword.preprocessor.csound-score",
            regex : /r\b/,
            next  : "repeat section"
        },

        this.numbers,

        {
            token : "keyword.operator.csound-score",
            regex : "[!+\\-*/^%&|<>#~.]"
        },

        this.pushRule({
            token : "punctuation.definition.string.begin.csound-score",
            regex : /"/,
            next  : "quoted string"
        }),

        this.pushRule({
            token : "punctuation.braced-loop.begin.csound-score",
            regex : /{/,
            next  : "loop after left brace"
        })
    );

    this.addRules({
        "repeat section": [
            {
                token : "empty",
                regex : /$/,
                next  : "start"
            },
            this.comments,
            {
                token : "constant.numeric.integer.decimal.csound-score",
                regex : /\d+/,
                next  : "repeat section before label"
            }
        ],
        "repeat section before label": [
            {
                token : "empty",
                regex : /$/,
                next  : "start"
            },
            this.comments,
            {
                token : "entity.name.label.csound-score",
                regex : /[A-Z_a-z]\w*/,
                next  : "start"
            }
        ],

        "quoted string": [
            this.popRule({
                token : "punctuation.definition.string.end.csound-score",
                regex : /"/
            }),
            this.quotedStringContents,
            {
                defaultToken: "string.quoted.csound-score"
            }
        ],

        "loop after left brace": [
            this.popRule({
                token : "constant.numeric.integer.decimal.csound-score",
                regex : /\d+/,
                next  : "loop after repeat count"
            }),
            this.comments,
            {
                token : "invalid.illegal.csound",
                regex : /\S.*/
            }
        ],
        "loop after repeat count": [
            this.popRule({
                token : "entity.name.function.preprocessor.csound-score",
                regex : /[A-Z_a-z]\w*\b/,
                next  : "loop after macro name"
            }),
            this.comments,
            {
                token : "invalid.illegal.csound",
                regex : /\S.*/
            }
        ],
        "loop after macro name": [
            start,
            this.popRule({
                token : "punctuation.braced-loop.end.csound-score",
                regex : /}/
            })
        ]
    });

    this.normalizeRules();
};

oop.inherits(CsoundScoreHighlightRules, CsoundPreprocessorHighlightRules);

exports.CsoundScoreHighlightRules = CsoundScoreHighlightRules;
});

ace.define("ace/mode/lua_highlight_rules",["require","exports","module","ace/lib/oop","ace/mode/text_highlight_rules"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../lib/oop");
var TextHighlightRules = acequire("./text_highlight_rules").TextHighlightRules;

var LuaHighlightRules = function() {

    var keywords = (
        "break|do|else|elseif|end|for|function|if|in|local|repeat|"+
         "return|then|until|while|or|and|not"
    );

    var builtinConstants = ("true|false|nil|_G|_VERSION");

    var functions = (
        "string|xpcall|package|tostring|print|os|unpack|acequire|"+
        "getfenv|setmetatable|next|assert|tonumber|io|rawequal|"+
        "collectgarbage|getmetatable|module|rawset|math|debug|"+
        "pcall|table|newproxy|type|coroutine|_G|select|gcinfo|"+
        "pairs|rawget|loadstring|ipairs|_VERSION|dofile|setfenv|"+
        "load|error|loadfile|"+

        "sub|upper|len|gfind|rep|find|match|char|dump|gmatch|"+
        "reverse|byte|format|gsub|lower|preload|loadlib|loaded|"+
        "loaders|cpath|config|path|seeall|exit|setlocale|date|"+
        "getenv|difftime|remove|time|clock|tmpname|rename|execute|"+
        "lines|write|close|flush|open|output|type|read|stderr|"+
        "stdin|input|stdout|popen|tmpfile|log|max|acos|huge|"+
        "ldexp|pi|cos|tanh|pow|deg|tan|cosh|sinh|random|randomseed|"+
        "frexp|ceil|floor|rad|abs|sqrt|modf|asin|min|mod|fmod|log10|"+
        "atan2|exp|sin|atan|getupvalue|debug|sethook|getmetatable|"+
        "gethook|setmetatable|setlocal|traceback|setfenv|getinfo|"+
        "setupvalue|getlocal|getregistry|getfenv|setn|insert|getn|"+
        "foreachi|maxn|foreach|concat|sort|remove|resume|yield|"+
        "status|wrap|create|running|"+
        "__add|__sub|__mod|__unm|__concat|__lt|__index|__call|__gc|__metatable|"+
         "__mul|__div|__pow|__len|__eq|__le|__newindex|__tostring|__mode|__tonumber"
    );

    var stdLibaries = ("string|package|os|io|math|debug|table|coroutine");

    var deprecatedIn5152 = ("setn|foreach|foreachi|gcinfo|log10|maxn");

    var keywordMapper = this.createKeywordMapper({
        "keyword": keywords,
        "support.function": functions,
        "keyword.deprecated": deprecatedIn5152,
        "constant.library": stdLibaries,
        "constant.language": builtinConstants,
        "variable.language": "self"
    }, "identifier");

    var decimalInteger = "(?:(?:[1-9]\\d*)|(?:0))";
    var hexInteger = "(?:0[xX][\\dA-Fa-f]+)";
    var integer = "(?:" + decimalInteger + "|" + hexInteger + ")";

    var fraction = "(?:\\.\\d+)";
    var intPart = "(?:\\d+)";
    var pointFloat = "(?:(?:" + intPart + "?" + fraction + ")|(?:" + intPart + "\\.))";
    var floatNumber = "(?:" + pointFloat + ")";

    this.$rules = {
        "start" : [{
            stateName: "bracketedComment",
            onMatch : function(value, currentState, stack){
                stack.unshift(this.next, value.length - 2, currentState);
                return "comment";
            },
            regex : /\-\-\[=*\[/,
            next  : [
                {
                    onMatch : function(value, currentState, stack) {
                        if (value.length == stack[1]) {
                            stack.shift();
                            stack.shift();
                            this.next = stack.shift();
                        } else {
                            this.next = "";
                        }
                        return "comment";
                    },
                    regex : /\]=*\]/,
                    next  : "start"
                }, {
                    defaultToken : "comment"
                }
            ]
        },

        {
            token : "comment",
            regex : "\\-\\-.*$"
        },
        {
            stateName: "bracketedString",
            onMatch : function(value, currentState, stack){
                stack.unshift(this.next, value.length, currentState);
                return "string.start";
            },
            regex : /\[=*\[/,
            next  : [
                {
                    onMatch : function(value, currentState, stack) {
                        if (value.length == stack[1]) {
                            stack.shift();
                            stack.shift();
                            this.next = stack.shift();
                        } else {
                            this.next = "";
                        }
                        return "string.end";
                    },

                    regex : /\]=*\]/,
                    next  : "start"
                }, {
                    defaultToken : "string"
                }
            ]
        },
        {
            token : "string",           // " string
            regex : '"(?:[^\\\\]|\\\\.)*?"'
        }, {
            token : "string",           // ' string
            regex : "'(?:[^\\\\]|\\\\.)*?'"
        }, {
            token : "constant.numeric", // float
            regex : floatNumber
        }, {
            token : "constant.numeric", // integer
            regex : integer + "\\b"
        }, {
            token : keywordMapper,
            regex : "[a-zA-Z_$][a-zA-Z0-9_$]*\\b"
        }, {
            token : "keyword.operator",
            regex : "\\+|\\-|\\*|\\/|%|\\#|\\^|~|<|>|<=|=>|==|~=|=|\\:|\\.\\.\\.|\\.\\."
        }, {
            token : "paren.lparen",
            regex : "[\\[\\(\\{]"
        }, {
            token : "paren.rparen",
            regex : "[\\]\\)\\}]"
        }, {
            token : "text",
            regex : "\\s+|\\w+"
        } ]
    };

    this.normalizeRules();
};

oop.inherits(LuaHighlightRules, TextHighlightRules);

exports.LuaHighlightRules = LuaHighlightRules;
});

ace.define("ace/mode/python_highlight_rules",["require","exports","module","ace/lib/oop","ace/mode/text_highlight_rules"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../lib/oop");
var TextHighlightRules = acequire("./text_highlight_rules").TextHighlightRules;

var PythonHighlightRules = function() {

    var keywords = (
        "and|as|assert|break|class|continue|def|del|elif|else|except|exec|" +
        "finally|for|from|global|if|import|in|is|lambda|not|or|pass|print|" +
        "raise|return|try|while|with|yield|async|await"
    );

    var builtinConstants = (
        "True|False|None|NotImplemented|Ellipsis|__debug__"
    );

    var builtinFunctions = (
        "abs|divmod|input|open|staticmethod|all|enumerate|int|ord|str|any|" +
        "eval|isinstance|pow|sum|basestring|execfile|issubclass|print|super|" +
        "binfile|iter|property|tuple|bool|filter|len|range|type|bytearray|" +
        "float|list|raw_input|unichr|callable|format|locals|reduce|unicode|" +
        "chr|frozenset|long|reload|vars|classmethod|getattr|map|repr|xrange|" +
        "cmp|globals|max|reversed|zip|compile|hasattr|memoryview|round|" +
        "__import__|complex|hash|min|set|apply|delattr|help|next|setattr|" +
        "buffer|dict|hex|object|slice|coerce|dir|id|oct|sorted|intern"
    );
    var keywordMapper = this.createKeywordMapper({
        "invalid.deprecated": "debugger",
        "support.function": builtinFunctions,
        "constant.language": builtinConstants,
        "keyword": keywords
    }, "identifier");

    var strPre = "(?:r|u|ur|R|U|UR|Ur|uR)?";

    var decimalInteger = "(?:(?:[1-9]\\d*)|(?:0))";
    var octInteger = "(?:0[oO]?[0-7]+)";
    var hexInteger = "(?:0[xX][\\dA-Fa-f]+)";
    var binInteger = "(?:0[bB][01]+)";
    var integer = "(?:" + decimalInteger + "|" + octInteger + "|" + hexInteger + "|" + binInteger + ")";

    var exponent = "(?:[eE][+-]?\\d+)";
    var fraction = "(?:\\.\\d+)";
    var intPart = "(?:\\d+)";
    var pointFloat = "(?:(?:" + intPart + "?" + fraction + ")|(?:" + intPart + "\\.))";
    var exponentFloat = "(?:(?:" + pointFloat + "|" +  intPart + ")" + exponent + ")";
    var floatNumber = "(?:" + exponentFloat + "|" + pointFloat + ")";

    var stringEscape =  "\\\\(x[0-9A-Fa-f]{2}|[0-7]{3}|[\\\\abfnrtv'\"]|U[0-9A-Fa-f]{8}|u[0-9A-Fa-f]{4})";

    this.$rules = {
        "start" : [ {
            token : "comment",
            regex : "#.*$"
        }, {
            token : "string",           // multi line """ string start
            regex : strPre + '"{3}',
            next : "qqstring3"
        }, {
            token : "string",           // " string
            regex : strPre + '"(?=.)',
            next : "qqstring"
        }, {
            token : "string",           // multi line ''' string start
            regex : strPre + "'{3}",
            next : "qstring3"
        }, {
            token : "string",           // ' string
            regex : strPre + "'(?=.)",
            next : "qstring"
        }, {
            token : "constant.numeric", // imaginary
            regex : "(?:" + floatNumber + "|\\d+)[jJ]\\b"
        }, {
            token : "constant.numeric", // float
            regex : floatNumber
        }, {
            token : "constant.numeric", // long integer
            regex : integer + "[lL]\\b"
        }, {
            token : "constant.numeric", // integer
            regex : integer + "\\b"
        }, {
            token : keywordMapper,
            regex : "[a-zA-Z_$][a-zA-Z0-9_$]*\\b"
        }, {
            token : "keyword.operator",
            regex : "\\+|\\-|\\*|\\*\\*|\\/|\\/\\/|%|<<|>>|&|\\||\\^|~|<|>|<=|=>|==|!=|<>|="
        }, {
            token : "paren.lparen",
            regex : "[\\[\\(\\{]"
        }, {
            token : "paren.rparen",
            regex : "[\\]\\)\\}]"
        }, {
            token : "text",
            regex : "\\s+"
        } ],
        "qqstring3" : [ {
            token : "constant.language.escape",
            regex : stringEscape
        }, {
            token : "string", // multi line """ string end
            regex : '"{3}',
            next : "start"
        }, {
            defaultToken : "string"
        } ],
        "qstring3" : [ {
            token : "constant.language.escape",
            regex : stringEscape
        }, {
            token : "string",  // multi line ''' string end
            regex : "'{3}",
            next : "start"
        }, {
            defaultToken : "string"
        } ],
        "qqstring" : [{
            token : "constant.language.escape",
            regex : stringEscape
        }, {
            token : "string",
            regex : "\\\\$",
            next  : "qqstring"
        }, {
            token : "string",
            regex : '"|$',
            next  : "start"
        }, {
            defaultToken: "string"
        }],
        "qstring" : [{
            token : "constant.language.escape",
            regex : stringEscape
        }, {
            token : "string",
            regex : "\\\\$",
            next  : "qstring"
        }, {
            token : "string",
            regex : "'|$",
            next  : "start"
        }, {
            defaultToken: "string"
        }]
    };
};

oop.inherits(PythonHighlightRules, TextHighlightRules);

exports.PythonHighlightRules = PythonHighlightRules;
});

ace.define("ace/mode/csound_orchestra_highlight_rules",["require","exports","module","ace/lib/lang","ace/lib/oop","ace/mode/csound_preprocessor_highlight_rules","ace/mode/csound_score_highlight_rules","ace/mode/lua_highlight_rules","ace/mode/python_highlight_rules"], function(acequire, exports, module) {
"use strict";

var lang = acequire("../lib/lang");
var oop = acequire("../lib/oop");

var CsoundPreprocessorHighlightRules = acequire("./csound_preprocessor_highlight_rules").CsoundPreprocessorHighlightRules;
var CsoundScoreHighlightRules = acequire("./csound_score_highlight_rules").CsoundScoreHighlightRules;
var LuaHighlightRules = acequire("./lua_highlight_rules").LuaHighlightRules;
var PythonHighlightRules = acequire("./python_highlight_rules").PythonHighlightRules;

var CsoundOrchestraHighlightRules = function() {

    CsoundPreprocessorHighlightRules.call(this);
    var opcodes = [
        "ATSadd",
        "ATSaddnz",
        "ATSbufread",
        "ATScross",
        "ATSinfo",
        "ATSinterpread",
        "ATSpartialtap",
        "ATSread",
        "ATSreadnz",
        "ATSsinnoi",
        "FLbox",
        "FLbutBank",
        "FLbutton",
        "FLcloseButton",
        "FLcolor",
        "FLcolor2",
        "FLcount",
        "FLexecButton",
        "FLgetsnap",
        "FLgroup",
        "FLgroupEnd",
        "FLgroup_end",
        "FLhide",
        "FLhvsBox",
        "FLhvsBoxSetValue",
        "FLjoy",
        "FLkeyIn",
        "FLknob",
        "FLlabel",
        "FLloadsnap",
        "FLmouse",
        "FLpack",
        "FLpackEnd",
        "FLpack_end",
        "FLpanel",
        "FLpanelEnd",
        "FLpanel_end",
        "FLprintk",
        "FLprintk2",
        "FLroller",
        "FLrun",
        "FLsavesnap",
        "FLscroll",
        "FLscrollEnd",
        "FLscroll_end",
        "FLsetAlign",
        "FLsetBox",
        "FLsetColor",
        "FLsetColor2",
        "FLsetFont",
        "FLsetPosition",
        "FLsetSize",
        "FLsetSnapGroup",
        "FLsetText",
        "FLsetTextColor",
        "FLsetTextSize",
        "FLsetTextType",
        "FLsetVal",
        "FLsetVal_i",
        "FLsetVali",
        "FLsetsnap",
        "FLshow",
        "FLslidBnk",
        "FLslidBnk2",
        "FLslidBnk2Set",
        "FLslidBnk2Setk",
        "FLslidBnkGetHandle",
        "FLslidBnkSet",
        "FLslidBnkSetk",
        "FLslider",
        "FLtabs",
        "FLtabsEnd",
        "FLtabs_end",
        "FLtext",
        "FLupdate",
        "FLvalue",
        "FLvkeybd",
        "FLvslidBnk",
        "FLvslidBnk2",
        "FLxyin",
        "JackoAudioIn",
        "JackoAudioInConnect",
        "JackoAudioOut",
        "JackoAudioOutConnect",
        "JackoFreewheel",
        "JackoInfo",
        "JackoInit",
        "JackoMidiInConnect",
        "JackoMidiOut",
        "JackoMidiOutConnect",
        "JackoNoteOut",
        "JackoOn",
        "JackoTransport",
        "K35_hpf",
        "K35_lpf",
        "MixerClear",
        "MixerGetLevel",
        "MixerReceive",
        "MixerSend",
        "MixerSetLevel",
        "MixerSetLevel_i",
        "OSCinit",
        "OSCinitM",
        "OSClisten",
        "OSCraw",
        "OSCsend",
        "OSCsendA",
        "OSCsend_lo",
        "S",
        "STKBandedWG",
        "STKBeeThree",
        "STKBlowBotl",
        "STKBlowHole",
        "STKBowed",
        "STKBrass",
        "STKClarinet",
        "STKDrummer",
        "STKFMVoices",
        "STKFlute",
        "STKHevyMetl",
        "STKMandolin",
        "STKModalBar",
        "STKMoog",
        "STKPercFlut",
        "STKPlucked",
        "STKResonate",
        "STKRhodey",
        "STKSaxofony",
        "STKShakers",
        "STKSimple",
        "STKSitar",
        "STKStifKarp",
        "STKTubeBell",
        "STKVoicForm",
        "STKWhistle",
        "STKWurley",
        "a",
        "abs",
        "active",
        "adsr",
        "adsyn",
        "adsynt",
        "adsynt2",
        "aftouch",
        "alpass",
        "alwayson",
        "ampdb",
        "ampdbfs",
        "ampmidi",
        "ampmidid",
        "areson",
        "aresonk",
        "atone",
        "atonek",
        "atonex",
        "babo",
        "balance",
        "bamboo",
        "barmodel",
        "bbcutm",
        "bbcuts",
        "betarand",
        "bexprnd",
        "bformdec1",
        "bformenc1",
        "binit",
        "biquad",
        "biquada",
        "birnd",
        "bpf",
        "bqrez",
        "buchla",
        "butbp",
        "butbr",
        "buthp",
        "butlp",
        "butterbp",
        "butterbr",
        "butterhp",
        "butterlp",
        "button",
        "buzz",
        "c2r",
        "cabasa",
        "cauchy",
        "cauchyi",
        "cbrt",
        "ceil",
        "cell",
        "cent",
        "centroid",
        "ceps",
        "cepsinv",
        "chanctrl",
        "changed",
        "changed2",
        "chani",
        "chano",
        "chebyshevpoly",
        "checkbox",
        "chn_S",
        "chn_a",
        "chn_k",
        "chnclear",
        "chnexport",
        "chnget",
        "chnmix",
        "chnparams",
        "chnset",
        "chuap",
        "clear",
        "clfilt",
        "clip",
        "clockoff",
        "clockon",
        "cmp",
        "cmplxprod",
        "comb",
        "combinv",
        "compilecsd",
        "compileorc",
        "compilestr",
        "compress",
        "compress2",
        "connect",
        "control",
        "convle",
        "convolve",
        "copya2ftab",
        "copyf2array",
        "cos",
        "cosh",
        "cosinv",
        "cosseg",
        "cossegb",
        "cossegr",
        "cps2pch",
        "cpsmidi",
        "cpsmidib",
        "cpsmidinn",
        "cpsoct",
        "cpspch",
        "cpstmid",
        "cpstun",
        "cpstuni",
        "cpsxpch",
        "cpumeter",
        "cpuprc",
        "cross2",
        "crossfm",
        "crossfmi",
        "crossfmpm",
        "crossfmpmi",
        "crosspm",
        "crosspmi",
        "crunch",
        "ctlchn",
        "ctrl14",
        "ctrl21",
        "ctrl7",
        "ctrlinit",
        "cuserrnd",
        "dam",
        "date",
        "dates",
        "db",
        "dbamp",
        "dbfsamp",
        "dcblock",
        "dcblock2",
        "dconv",
        "dct",
        "dctinv",
        "delay",
        "delay1",
        "delayk",
        "delayr",
        "delayw",
        "deltap",
        "deltap3",
        "deltapi",
        "deltapn",
        "deltapx",
        "deltapxw",
        "denorm",
        "diff",
        "diode_ladder",
        "directory",
        "diskgrain",
        "diskin",
        "diskin2",
        "dispfft",
        "display",
        "distort",
        "distort1",
        "divz",
        "doppler",
        "dot",
        "downsamp",
        "dripwater",
        "dssiactivate",
        "dssiaudio",
        "dssictls",
        "dssiinit",
        "dssilist",
        "dumpk",
        "dumpk2",
        "dumpk3",
        "dumpk4",
        "duserrnd",
        "dust",
        "dust2",
        "envlpx",
        "envlpxr",
        "ephasor",
        "eqfil",
        "evalstr",
        "event",
        "event_i",
        "exciter",
        "exitnow",
        "exp",
        "expcurve",
        "expon",
        "exprand",
        "exprandi",
        "expseg",
        "expsega",
        "expsegb",
        "expsegba",
        "expsegr",
        "fareylen",
        "fareyleni",
        "faustaudio",
        "faustcompile",
        "faustctl",
        "faustgen",
        "fft",
        "fftinv",
        "ficlose",
        "filebit",
        "filelen",
        "filenchnls",
        "filepeak",
        "filescal",
        "filesr",
        "filevalid",
        "fillarray",
        "filter2",
        "fin",
        "fini",
        "fink",
        "fiopen",
        "flanger",
        "flashtxt",
        "flooper",
        "flooper2",
        "floor",
        "fluidAllOut",
        "fluidCCi",
        "fluidCCk",
        "fluidControl",
        "fluidEngine",
        "fluidLoad",
        "fluidNote",
        "fluidOut",
        "fluidProgramSelect",
        "fluidSetInterpMethod",
        "fmanal",
        "fmax",
        "fmb3",
        "fmbell",
        "fmin",
        "fmmetal",
        "fmod",
        "fmpercfl",
        "fmrhode",
        "fmvoice",
        "fmwurlie",
        "fof",
        "fof2",
        "fofilter",
        "fog",
        "fold",
        "follow",
        "follow2",
        "foscil",
        "foscili",
        "fout",
        "fouti",
        "foutir",
        "foutk",
        "fprintks",
        "fprints",
        "frac",
        "fractalnoise",
        "framebuffer",
        "freeverb",
        "ftchnls",
        "ftconv",
        "ftcps",
        "ftfree",
        "ftgen",
        "ftgenonce",
        "ftgentmp",
        "ftlen",
        "ftload",
        "ftloadk",
        "ftlptim",
        "ftmorf",
        "ftom",
        "ftresize",
        "ftresizei",
        "ftsamplebank",
        "ftsave",
        "ftsavek",
        "ftsr",
        "gain",
        "gainslider",
        "gauss",
        "gaussi",
        "gausstrig",
        "gbuzz",
        "genarray",
        "genarray_i",
        "gendy",
        "gendyc",
        "gendyx",
        "getcfg",
        "getcol",
        "getftargs",
        "getrow",
        "getseed",
        "gogobel",
        "grain",
        "grain2",
        "grain3",
        "granule",
        "guiro",
        "harmon",
        "harmon2",
        "harmon3",
        "harmon4",
        "hdf5read",
        "hdf5write",
        "hilbert",
        "hilbert2",
        "hrtfearly",
        "hrtfmove",
        "hrtfmove2",
        "hrtfreverb",
        "hrtfstat",
        "hsboscil",
        "hvs1",
        "hvs2",
        "hvs3",
        "hypot",
        "i",
        "ihold",
        "imagecreate",
        "imagefree",
        "imagegetpixel",
        "imageload",
        "imagesave",
        "imagesetpixel",
        "imagesize",
        "in",
        "in32",
        "inch",
        "inh",
        "init",
        "initc14",
        "initc21",
        "initc7",
        "inleta",
        "inletf",
        "inletk",
        "inletkid",
        "inletv",
        "ino",
        "inq",
        "inrg",
        "ins",
        "insglobal",
        "insremot",
        "int",
        "integ",
        "interp",
        "invalue",
        "inx",
        "inz",
        "jacktransport",
        "jitter",
        "jitter2",
        "joystick",
        "jspline",
        "k",
        "la_i_add_mc",
        "la_i_add_mr",
        "la_i_add_vc",
        "la_i_add_vr",
        "la_i_assign_mc",
        "la_i_assign_mr",
        "la_i_assign_t",
        "la_i_assign_vc",
        "la_i_assign_vr",
        "la_i_conjugate_mc",
        "la_i_conjugate_mr",
        "la_i_conjugate_vc",
        "la_i_conjugate_vr",
        "la_i_distance_vc",
        "la_i_distance_vr",
        "la_i_divide_mc",
        "la_i_divide_mr",
        "la_i_divide_vc",
        "la_i_divide_vr",
        "la_i_dot_mc",
        "la_i_dot_mc_vc",
        "la_i_dot_mr",
        "la_i_dot_mr_vr",
        "la_i_dot_vc",
        "la_i_dot_vr",
        "la_i_get_mc",
        "la_i_get_mr",
        "la_i_get_vc",
        "la_i_get_vr",
        "la_i_invert_mc",
        "la_i_invert_mr",
        "la_i_lower_solve_mc",
        "la_i_lower_solve_mr",
        "la_i_lu_det_mc",
        "la_i_lu_det_mr",
        "la_i_lu_factor_mc",
        "la_i_lu_factor_mr",
        "la_i_lu_solve_mc",
        "la_i_lu_solve_mr",
        "la_i_mc_create",
        "la_i_mc_set",
        "la_i_mr_create",
        "la_i_mr_set",
        "la_i_multiply_mc",
        "la_i_multiply_mr",
        "la_i_multiply_vc",
        "la_i_multiply_vr",
        "la_i_norm1_mc",
        "la_i_norm1_mr",
        "la_i_norm1_vc",
        "la_i_norm1_vr",
        "la_i_norm_euclid_mc",
        "la_i_norm_euclid_mr",
        "la_i_norm_euclid_vc",
        "la_i_norm_euclid_vr",
        "la_i_norm_inf_mc",
        "la_i_norm_inf_mr",
        "la_i_norm_inf_vc",
        "la_i_norm_inf_vr",
        "la_i_norm_max_mc",
        "la_i_norm_max_mr",
        "la_i_print_mc",
        "la_i_print_mr",
        "la_i_print_vc",
        "la_i_print_vr",
        "la_i_qr_eigen_mc",
        "la_i_qr_eigen_mr",
        "la_i_qr_factor_mc",
        "la_i_qr_factor_mr",
        "la_i_qr_sym_eigen_mc",
        "la_i_qr_sym_eigen_mr",
        "la_i_random_mc",
        "la_i_random_mr",
        "la_i_random_vc",
        "la_i_random_vr",
        "la_i_size_mc",
        "la_i_size_mr",
        "la_i_size_vc",
        "la_i_size_vr",
        "la_i_subtract_mc",
        "la_i_subtract_mr",
        "la_i_subtract_vc",
        "la_i_subtract_vr",
        "la_i_t_assign",
        "la_i_trace_mc",
        "la_i_trace_mr",
        "la_i_transpose_mc",
        "la_i_transpose_mr",
        "la_i_upper_solve_mc",
        "la_i_upper_solve_mr",
        "la_i_vc_create",
        "la_i_vc_set",
        "la_i_vr_create",
        "la_i_vr_set",
        "la_k_a_assign",
        "la_k_add_mc",
        "la_k_add_mr",
        "la_k_add_vc",
        "la_k_add_vr",
        "la_k_assign_a",
        "la_k_assign_f",
        "la_k_assign_mc",
        "la_k_assign_mr",
        "la_k_assign_t",
        "la_k_assign_vc",
        "la_k_assign_vr",
        "la_k_conjugate_mc",
        "la_k_conjugate_mr",
        "la_k_conjugate_vc",
        "la_k_conjugate_vr",
        "la_k_current_f",
        "la_k_current_vr",
        "la_k_distance_vc",
        "la_k_distance_vr",
        "la_k_divide_mc",
        "la_k_divide_mr",
        "la_k_divide_vc",
        "la_k_divide_vr",
        "la_k_dot_mc",
        "la_k_dot_mc_vc",
        "la_k_dot_mr",
        "la_k_dot_mr_vr",
        "la_k_dot_vc",
        "la_k_dot_vr",
        "la_k_f_assign",
        "la_k_get_mc",
        "la_k_get_mr",
        "la_k_get_vc",
        "la_k_get_vr",
        "la_k_invert_mc",
        "la_k_invert_mr",
        "la_k_lower_solve_mc",
        "la_k_lower_solve_mr",
        "la_k_lu_det_mc",
        "la_k_lu_det_mr",
        "la_k_lu_factor_mc",
        "la_k_lu_factor_mr",
        "la_k_lu_solve_mc",
        "la_k_lu_solve_mr",
        "la_k_mc_set",
        "la_k_mr_set",
        "la_k_multiply_mc",
        "la_k_multiply_mr",
        "la_k_multiply_vc",
        "la_k_multiply_vr",
        "la_k_norm1_mc",
        "la_k_norm1_mr",
        "la_k_norm1_vc",
        "la_k_norm1_vr",
        "la_k_norm_euclid_mc",
        "la_k_norm_euclid_mr",
        "la_k_norm_euclid_vc",
        "la_k_norm_euclid_vr",
        "la_k_norm_inf_mc",
        "la_k_norm_inf_mr",
        "la_k_norm_inf_vc",
        "la_k_norm_inf_vr",
        "la_k_norm_max_mc",
        "la_k_norm_max_mr",
        "la_k_qr_eigen_mc",
        "la_k_qr_eigen_mr",
        "la_k_qr_factor_mc",
        "la_k_qr_factor_mr",
        "la_k_qr_sym_eigen_mc",
        "la_k_qr_sym_eigen_mr",
        "la_k_random_mc",
        "la_k_random_mr",
        "la_k_random_vc",
        "la_k_random_vr",
        "la_k_subtract_mc",
        "la_k_subtract_mr",
        "la_k_subtract_vc",
        "la_k_subtract_vr",
        "la_k_t_assign",
        "la_k_trace_mc",
        "la_k_trace_mr",
        "la_k_upper_solve_mc",
        "la_k_upper_solve_mr",
        "la_k_vc_set",
        "la_k_vr_set",
        "lenarray",
        "lfo",
        "limit",
        "limit1",
        "line",
        "linen",
        "linenr",
        "lineto",
        "link_beat_force",
        "link_beat_get",
        "link_beat_request",
        "link_create",
        "link_enable",
        "link_is_enabled",
        "link_metro",
        "link_peers",
        "link_tempo_get",
        "link_tempo_set",
        "linlin",
        "linrand",
        "linseg",
        "linsegb",
        "linsegr",
        "liveconv",
        "locsend",
        "locsig",
        "log",
        "log10",
        "log2",
        "logbtwo",
        "logcurve",
        "loopseg",
        "loopsegp",
        "looptseg",
        "loopxseg",
        "lorenz",
        "loscil",
        "loscil3",
        "loscilx",
        "lowpass2",
        "lowres",
        "lowresx",
        "lpf18",
        "lpform",
        "lpfreson",
        "lphasor",
        "lpinterp",
        "lposcil",
        "lposcil3",
        "lposcila",
        "lposcilsa",
        "lposcilsa2",
        "lpread",
        "lpreson",
        "lpshold",
        "lpsholdp",
        "lpslot",
        "lua_exec",
        "lua_iaopcall",
        "lua_iaopcall_off",
        "lua_ikopcall",
        "lua_ikopcall_off",
        "lua_iopcall",
        "lua_iopcall_off",
        "lua_opdef",
        "mac",
        "maca",
        "madsr",
        "mags",
        "mandel",
        "mandol",
        "maparray",
        "maparray_i",
        "marimba",
        "massign",
        "max",
        "max_k",
        "maxabs",
        "maxabsaccum",
        "maxaccum",
        "maxalloc",
        "maxarray",
        "mclock",
        "mdelay",
        "median",
        "mediank",
        "metro",
        "mfb",
        "midglobal",
        "midiarp",
        "midic14",
        "midic21",
        "midic7",
        "midichannelaftertouch",
        "midichn",
        "midicontrolchange",
        "midictrl",
        "mididefault",
        "midifilestatus",
        "midiin",
        "midinoteoff",
        "midinoteoncps",
        "midinoteonkey",
        "midinoteonoct",
        "midinoteonpch",
        "midion",
        "midion2",
        "midiout",
        "midipgm",
        "midipitchbend",
        "midipolyaftertouch",
        "midiprogramchange",
        "miditempo",
        "midremot",
        "min",
        "minabs",
        "minabsaccum",
        "minaccum",
        "minarray",
        "mincer",
        "mirror",
        "mode",
        "modmatrix",
        "monitor",
        "moog",
        "moogladder",
        "moogladder2",
        "moogvcf",
        "moogvcf2",
        "moscil",
        "mp3bitrate",
        "mp3in",
        "mp3len",
        "mp3nchnls",
        "mp3scal",
        "mp3scal_check",
        "mp3scal_load",
        "mp3scal_load2",
        "mp3scal_play",
        "mp3scal_play2",
        "mp3sr",
        "mpulse",
        "mrtmsg",
        "mtof",
        "mton",
        "multitap",
        "mute",
        "mvchpf",
        "mvclpf1",
        "mvclpf2",
        "mvclpf3",
        "mvclpf4",
        "mxadsr",
        "nchnls_hw",
        "nestedap",
        "nlalp",
        "nlfilt",
        "nlfilt2",
        "noise",
        "noteoff",
        "noteon",
        "noteondur",
        "noteondur2",
        "notnum",
        "nreverb",
        "nrpn",
        "nsamp",
        "nstance",
        "nstrnum",
        "ntom",
        "ntrpol",
        "nxtpow2",
        "octave",
        "octcps",
        "octmidi",
        "octmidib",
        "octmidinn",
        "octpch",
        "olabuffer",
        "oscbnk",
        "oscil",
        "oscil1",
        "oscil1i",
        "oscil3",
        "oscili",
        "oscilikt",
        "osciliktp",
        "oscilikts",
        "osciln",
        "oscils",
        "oscilx",
        "out",
        "out32",
        "outc",
        "outch",
        "outh",
        "outiat",
        "outic",
        "outic14",
        "outipat",
        "outipb",
        "outipc",
        "outkat",
        "outkc",
        "outkc14",
        "outkpat",
        "outkpb",
        "outkpc",
        "outleta",
        "outletf",
        "outletk",
        "outletkid",
        "outletv",
        "outo",
        "outq",
        "outq1",
        "outq2",
        "outq3",
        "outq4",
        "outrg",
        "outs",
        "outs1",
        "outs2",
        "outvalue",
        "outx",
        "outz",
        "p",
        "p5gconnect",
        "p5gdata",
        "pan",
        "pan2",
        "pareq",
        "part2txt",
        "partials",
        "partikkel",
        "partikkelget",
        "partikkelset",
        "partikkelsync",
        "passign",
        "paulstretch",
        "pcauchy",
        "pchbend",
        "pchmidi",
        "pchmidib",
        "pchmidinn",
        "pchoct",
        "pchtom",
        "pconvolve",
        "pcount",
        "pdclip",
        "pdhalf",
        "pdhalfy",
        "peak",
        "pgmassign",
        "pgmchn",
        "phaser1",
        "phaser2",
        "phasor",
        "phasorbnk",
        "phs",
        "pindex",
        "pinker",
        "pinkish",
        "pitch",
        "pitchac",
        "pitchamdf",
        "planet",
        "platerev",
        "plltrack",
        "pluck",
        "poisson",
        "pol2rect",
        "polyaft",
        "polynomial",
        "port",
        "portk",
        "poscil",
        "poscil3",
        "pow",
        "powershape",
        "powoftwo",
        "pows",
        "prealloc",
        "prepiano",
        "print",
        "print_type",
        "printf",
        "printf_i",
        "printk",
        "printk2",
        "printks",
        "printks2",
        "prints",
        "product",
        "pset",
        "ptable",
        "ptable3",
        "ptablei",
        "ptableiw",
        "ptablew",
        "ptrack",
        "puts",
        "pvadd",
        "pvbufread",
        "pvcross",
        "pvinterp",
        "pvoc",
        "pvread",
        "pvs2array",
        "pvs2tab",
        "pvsadsyn",
        "pvsanal",
        "pvsarp",
        "pvsbandp",
        "pvsbandr",
        "pvsbin",
        "pvsblur",
        "pvsbuffer",
        "pvsbufread",
        "pvsbufread2",
        "pvscale",
        "pvscent",
        "pvsceps",
        "pvscross",
        "pvsdemix",
        "pvsdiskin",
        "pvsdisp",
        "pvsenvftw",
        "pvsfilter",
        "pvsfread",
        "pvsfreeze",
        "pvsfromarray",
        "pvsftr",
        "pvsftw",
        "pvsfwrite",
        "pvsgain",
        "pvsgendy",
        "pvshift",
        "pvsifd",
        "pvsin",
        "pvsinfo",
        "pvsinit",
        "pvslock",
        "pvsmaska",
        "pvsmix",
        "pvsmooth",
        "pvsmorph",
        "pvsosc",
        "pvsout",
        "pvspitch",
        "pvstanal",
        "pvstencil",
        "pvstrace",
        "pvsvoc",
        "pvswarp",
        "pvsynth",
        "pwd",
        "pyassign",
        "pyassigni",
        "pyassignt",
        "pycall",
        "pycall1",
        "pycall1i",
        "pycall1t",
        "pycall2",
        "pycall2i",
        "pycall2t",
        "pycall3",
        "pycall3i",
        "pycall3t",
        "pycall4",
        "pycall4i",
        "pycall4t",
        "pycall5",
        "pycall5i",
        "pycall5t",
        "pycall6",
        "pycall6i",
        "pycall6t",
        "pycall7",
        "pycall7i",
        "pycall7t",
        "pycall8",
        "pycall8i",
        "pycall8t",
        "pycalli",
        "pycalln",
        "pycallni",
        "pycallt",
        "pyeval",
        "pyevali",
        "pyevalt",
        "pyexec",
        "pyexeci",
        "pyexect",
        "pyinit",
        "pylassign",
        "pylassigni",
        "pylassignt",
        "pylcall",
        "pylcall1",
        "pylcall1i",
        "pylcall1t",
        "pylcall2",
        "pylcall2i",
        "pylcall2t",
        "pylcall3",
        "pylcall3i",
        "pylcall3t",
        "pylcall4",
        "pylcall4i",
        "pylcall4t",
        "pylcall5",
        "pylcall5i",
        "pylcall5t",
        "pylcall6",
        "pylcall6i",
        "pylcall6t",
        "pylcall7",
        "pylcall7i",
        "pylcall7t",
        "pylcall8",
        "pylcall8i",
        "pylcall8t",
        "pylcalli",
        "pylcalln",
        "pylcallni",
        "pylcallt",
        "pyleval",
        "pylevali",
        "pylevalt",
        "pylexec",
        "pylexeci",
        "pylexect",
        "pylrun",
        "pylruni",
        "pylrunt",
        "pyrun",
        "pyruni",
        "pyrunt",
        "qinf",
        "qnan",
        "r2c",
        "rand",
        "randh",
        "randi",
        "random",
        "randomh",
        "randomi",
        "rbjeq",
        "readclock",
        "readf",
        "readfi",
        "readk",
        "readk2",
        "readk3",
        "readk4",
        "readks",
        "readscore",
        "readscratch",
        "rect2pol",
        "release",
        "remoteport",
        "remove",
        "repluck",
        "reson",
        "resonk",
        "resonr",
        "resonx",
        "resonxk",
        "resony",
        "resonz",
        "resyn",
        "reverb",
        "reverb2",
        "reverbsc",
        "rewindscore",
        "rezzy",
        "rfft",
        "rifft",
        "rms",
        "rnd",
        "rnd31",
        "round",
        "rspline",
        "rtclock",
        "s16b14",
        "s32b14",
        "samphold",
        "sandpaper",
        "sc_lag",
        "sc_lagud",
        "sc_phasor",
        "sc_trig",
        "scale",
        "scalearray",
        "scanhammer",
        "scans",
        "scantable",
        "scanu",
        "schedkwhen",
        "schedkwhennamed",
        "schedule",
        "schedwhen",
        "scoreline",
        "scoreline_i",
        "seed",
        "sekere",
        "select",
        "semitone",
        "sense",
        "sensekey",
        "seqtime",
        "seqtime2",
        "serialBegin",
        "serialEnd",
        "serialFlush",
        "serialPrint",
        "serialRead",
        "serialWrite",
        "serialWrite_i",
        "setcol",
        "setctrl",
        "setksmps",
        "setrow",
        "setscorepos",
        "sfilist",
        "sfinstr",
        "sfinstr3",
        "sfinstr3m",
        "sfinstrm",
        "sfload",
        "sflooper",
        "sfpassign",
        "sfplay",
        "sfplay3",
        "sfplay3m",
        "sfplaym",
        "sfplist",
        "sfpreset",
        "shaker",
        "shiftin",
        "shiftout",
        "signalflowgraph",
        "signum",
        "sin",
        "sinh",
        "sininv",
        "sinsyn",
        "sleighbells",
        "slicearray",
        "slider16",
        "slider16f",
        "slider16table",
        "slider16tablef",
        "slider32",
        "slider32f",
        "slider32table",
        "slider32tablef",
        "slider64",
        "slider64f",
        "slider64table",
        "slider64tablef",
        "slider8",
        "slider8f",
        "slider8table",
        "slider8tablef",
        "sliderKawai",
        "sndloop",
        "sndwarp",
        "sndwarpst",
        "sockrecv",
        "sockrecvs",
        "socksend",
        "socksend_k",
        "socksends",
        "sorta",
        "sortd",
        "soundin",
        "space",
        "spat3d",
        "spat3di",
        "spat3dt",
        "spdist",
        "splitrig",
        "sprintf",
        "sprintfk",
        "spsend",
        "sqrt",
        "statevar",
        "stix",
        "strcat",
        "strcatk",
        "strchar",
        "strchark",
        "strcmp",
        "strcmpk",
        "strcpy",
        "strcpyk",
        "strecv",
        "streson",
        "strfromurl",
        "strget",
        "strindex",
        "strindexk",
        "strlen",
        "strlenk",
        "strlower",
        "strlowerk",
        "strrindex",
        "strrindexk",
        "strset",
        "strsub",
        "strsubk",
        "strtod",
        "strtodk",
        "strtol",
        "strtolk",
        "strupper",
        "strupperk",
        "stsend",
        "subinstr",
        "subinstrinit",
        "sum",
        "sumarray",
        "svfilter",
        "syncgrain",
        "syncloop",
        "syncphasor",
        "system",
        "system_i",
        "tab",
        "tab2pvs",
        "tab_i",
        "tabifd",
        "table",
        "table3",
        "table3kt",
        "tablecopy",
        "tablefilter",
        "tablefilteri",
        "tablegpw",
        "tablei",
        "tableicopy",
        "tableigpw",
        "tableikt",
        "tableimix",
        "tableiw",
        "tablekt",
        "tablemix",
        "tableng",
        "tablera",
        "tableseg",
        "tableshuffle",
        "tableshufflei",
        "tablew",
        "tablewa",
        "tablewkt",
        "tablexkt",
        "tablexseg",
        "tabmorph",
        "tabmorpha",
        "tabmorphak",
        "tabmorphi",
        "tabplay",
        "tabrec",
        "tabsum",
        "tabw",
        "tabw_i",
        "tambourine",
        "tan",
        "tanh",
        "taninv",
        "taninv2",
        "tb0",
        "tb0_init",
        "tb1",
        "tb10",
        "tb10_init",
        "tb11",
        "tb11_init",
        "tb12",
        "tb12_init",
        "tb13",
        "tb13_init",
        "tb14",
        "tb14_init",
        "tb15",
        "tb15_init",
        "tb1_init",
        "tb2",
        "tb2_init",
        "tb3",
        "tb3_init",
        "tb4",
        "tb4_init",
        "tb5",
        "tb5_init",
        "tb6",
        "tb6_init",
        "tb7",
        "tb7_init",
        "tb8",
        "tb8_init",
        "tb9",
        "tb9_init",
        "tbvcf",
        "tempest",
        "tempo",
        "temposcal",
        "tempoval",
        "timedseq",
        "timeinstk",
        "timeinsts",
        "timek",
        "times",
        "tival",
        "tlineto",
        "tone",
        "tonek",
        "tonex",
        "tradsyn",
        "trandom",
        "transeg",
        "transegb",
        "transegr",
        "trcross",
        "trfilter",
        "trhighest",
        "trigger",
        "trigseq",
        "trirand",
        "trlowest",
        "trmix",
        "trscale",
        "trshift",
        "trsplit",
        "turnoff",
        "turnoff2",
        "turnon",
        "tvconv",
        "unirand",
        "unwrap",
        "upsamp",
        "urandom",
        "urd",
        "vactrol",
        "vadd",
        "vadd_i",
        "vaddv",
        "vaddv_i",
        "vaget",
        "valpass",
        "vaset",
        "vbap",
        "vbapg",
        "vbapgmove",
        "vbaplsinit",
        "vbapmove",
        "vbapz",
        "vbapzmove",
        "vcella",
        "vco",
        "vco2",
        "vco2ft",
        "vco2ift",
        "vco2init",
        "vcomb",
        "vcopy",
        "vcopy_i",
        "vdel_k",
        "vdelay",
        "vdelay3",
        "vdelayk",
        "vdelayx",
        "vdelayxq",
        "vdelayxs",
        "vdelayxw",
        "vdelayxwq",
        "vdelayxws",
        "vdivv",
        "vdivv_i",
        "vecdelay",
        "veloc",
        "vexp",
        "vexp_i",
        "vexpseg",
        "vexpv",
        "vexpv_i",
        "vibes",
        "vibr",
        "vibrato",
        "vincr",
        "vlimit",
        "vlinseg",
        "vlowres",
        "vmap",
        "vmirror",
        "vmult",
        "vmult_i",
        "vmultv",
        "vmultv_i",
        "voice",
        "vosim",
        "vphaseseg",
        "vport",
        "vpow",
        "vpow_i",
        "vpowv",
        "vpowv_i",
        "vpvoc",
        "vrandh",
        "vrandi",
        "vsubv",
        "vsubv_i",
        "vtaba",
        "vtabi",
        "vtabk",
        "vtable1k",
        "vtablea",
        "vtablei",
        "vtablek",
        "vtablewa",
        "vtablewi",
        "vtablewk",
        "vtabwa",
        "vtabwi",
        "vtabwk",
        "vwrap",
        "waveset",
        "websocket",
        "weibull",
        "wgbow",
        "wgbowedbar",
        "wgbrass",
        "wgclar",
        "wgflute",
        "wgpluck",
        "wgpluck2",
        "wguide1",
        "wguide2",
        "wiiconnect",
        "wiidata",
        "wiirange",
        "wiisend",
        "window",
        "wrap",
        "writescratch",
        "wterrain",
        "xadsr",
        "xin",
        "xout",
        "xscanmap",
        "xscans",
        "xscansmap",
        "xscanu",
        "xtratim",
        "xyscale",
        "zacl",
        "zakinit",
        "zamod",
        "zar",
        "zarg",
        "zaw",
        "zawm",
        "zdf_1pole",
        "zdf_1pole_mode",
        "zdf_2pole",
        "zdf_2pole_mode",
        "zdf_ladder",
        "zfilter2",
        "zir",
        "ziw",
        "ziwm",
        "zkcl",
        "zkmod",
        "zkr",
        "zkw",
        "zkwm"
    ];
    var deprecatedOpcodes = [
        "array",
        "bformdec",
        "bformenc",
        "copy2ftab",
        "copy2ttab",
        "hrtfer",
        "ktableseg",
        "lentab",
        "maxtab",
        "mintab",
        "pop",
        "pop_f",
        "push",
        "push_f",
        "scalet",
        "sndload",
        "soundout",
        "soundouts",
        "specaddm",
        "specdiff",
        "specdisp",
        "specfilt",
        "spechist",
        "specptrk",
        "specscal",
        "specsum",
        "spectrum",
        "stack",
        "sumtab",
        "tabgen",
        "tabmap",
        "tabmap_i",
        "tabslice",
        "vbap16",
        "vbap4",
        "vbap4move",
        "vbap8",
        "vbap8move",
        "xyin"
    ];

    opcodes = lang.arrayToMap(opcodes);
    deprecatedOpcodes = lang.arrayToMap(deprecatedOpcodes);

    this.lineContinuations = [
        {
            token : "constant.character.escape.line-continuation.csound",
            regex : /\\$/
        }, this.pushRule({
            token : "constant.character.escape.line-continuation.csound",
            regex : /\\/,
            next  : "line continuation"
        })
    ];

    this.comments.push(this.lineContinuations);

    this.quotedStringContents.push(
        this.lineContinuations,
        {
            token : "invalid.illegal",
            regex : /[^"\\]*$/
        }
    );

    var start = this.$rules.start;
    start.splice(1, 0, {
        token : ["text.csound", "entity.name.label.csound", "entity.punctuation.label.csound", "text.csound"],
        regex : /^([ \t]*)(\w+)(:)([ \t]+|$)/
    });
    start.push(
        this.pushRule({
            token : "keyword.function.csound",
            regex : /\binstr\b/,
            next  : "instrument numbers and identifiers"
        }), this.pushRule({
            token : "keyword.function.csound",
            regex : /\bopcode\b/,
            next  : "after opcode keyword"
        }), {
            token : "keyword.other.csound",
            regex : /\bend(?:in|op)\b/
        },

        {
            token : "variable.language.csound",
            regex : /\b(?:0dbfs|A4|k(?:r|smps)|nchnls(?:_i)?|sr)\b/
        },

        this.numbers,

        {
            token : "keyword.operator.csound",
            regex : "\\+=|-=|\\*=|/=|<<|>>|<=|>=|==|!=|&&|\\|\\||[~¬]|[=!+\\-*/^%&|<>#?:]"
        },

        this.pushRule({
            token : "punctuation.definition.string.begin.csound",
            regex : /"/,
            next  : "quoted string"
        }), this.pushRule({
            token : "punctuation.definition.string.begin.csound",
            regex : /{{/,
            next  : "braced string"
        }),

        {
            token : "keyword.control.csound",
            regex : /\b(?:do|else(?:if)?|end(?:if|until)|fi|i(?:f|then)|kthen|od|r(?:ir)?eturn|then|until|while)\b/
        },

        this.pushRule({
            token : "keyword.control.csound",
            regex : /\b[ik]?goto\b/,
            next  : "goto before label"
        }), this.pushRule({
            token : "keyword.control.csound",
            regex : /\b(?:r(?:einit|igoto)|tigoto)\b/,
            next  : "goto before label"
        }), this.pushRule({
            token : "keyword.control.csound",
            regex : /\bc(?:g|in?|k|nk?)goto\b/,
            next  : ["goto before label", "goto before argument"]
        }), this.pushRule({
            token : "keyword.control.csound",
            regex : /\btimout\b/,
            next  : ["goto before label", "goto before argument", "goto before argument"]
        }), this.pushRule({
            token : "keyword.control.csound",
            regex : /\bloop_[gl][et]\b/,
            next  : ["goto before label", "goto before argument", "goto before argument", "goto before argument"]
        }),

        this.pushRule({
            token : "support.function.csound",
            regex : /\b(?:readscore|scoreline(?:_i)?)\b/,
            next  : "Csound score opcode"
        }), this.pushRule({
            token : "support.function.csound",
            regex : /\bpyl?run[it]?\b(?!$)/,
            next  : "Python opcode"
        }), this.pushRule({
            token : "support.function.csound",
            regex : /\blua_(?:exec|opdef)\b(?!$)/,
            next  : "Lua opcode"
        }),

        {
            token : "support.variable.csound",
            regex : /\bp\d+\b/
        }, {
            regex : /\b([A-Z_a-z]\w*)(?:(:)([A-Za-z]))?\b/, onMatch: function(value, currentState, stack, line) {
                var tokens = value.split(this.splitRegex);
                var name = tokens[1];
                var type;
                if (opcodes.hasOwnProperty(name))
                    type = "support.function.csound";
                else if (deprecatedOpcodes.hasOwnProperty(name))
                    type = "invalid.deprecated.csound";
                if (type) {
                    if (tokens[2]) {
                        return [
                            {type: type, value: name},
                            {type: "punctuation.type-annotation.csound", value: tokens[2]},
                            {type: "type-annotation.storage.type.csound", value: tokens[3]}
                        ];
                    }
                    return type;
                }
                return "text.csound";
            }
        }
    );

    this.$rules["macro parameter value list"].splice(2, 0, {
        token : "punctuation.definition.string.begin.csound",
        regex : /{{/,
        next  : "macro parameter value braced string"
    });

    this.addRules({
        "macro parameter value braced string": [
            {
                token : "constant.character.escape.csound",
                regex : /\\[#'()]/
            }, {
                token : "invalid.illegal.csound.csound",
                regex : /[#'()]/
            }, {
                token : "punctuation.definition.string.end.csound",
                regex : /}}/,
                next  : "macro parameter value list"
            }, {
                defaultToken: "string.braced.csound"
            }
        ],

        "instrument numbers and identifiers": [
            this.comments,
            {
                token : "entity.name.function.csound",
                regex : /\d+|[A-Z_a-z]\w*/
            }, this.popRule({
                token : "empty",
                regex : /$/
            })
        ],

        "after opcode keyword": [
            this.comments,
            this.popRule({
                token : "empty",
                regex : /$/
            }), this.popRule({
                token : "entity.name.function.opcode.csound",
                regex : /[A-Z_a-z]\w*/,
                next  : "opcode type signatures"
            })
        ],
        "opcode type signatures": [
            this.comments,
            this.popRule({
                token : "empty",
                regex : /$/
            }), {
                token : "storage.type.csound",
                regex : /\b(?:0|[afijkKoOpPStV\[\]]+)/
            }
        ],

        "quoted string": [
            this.popRule({
                token : "punctuation.definition.string.end.csound",
                regex : /"/
            }),
            this.quotedStringContents,
            {
                defaultToken: "string.quoted.csound"
            }
        ],
        "braced string": [
            this.popRule({
                token : "punctuation.definition.string.end.csound",
                regex : /}}/
            }),
            this.bracedStringContents,
            {
                defaultToken: "string.braced.csound"
            }
        ],

        "goto before argument": [
            this.popRule({
                token : "text.csound",
                regex : /,/
            }),
            start
        ],
        "goto before label": [
            {
                token : "text.csound",
                regex : /\s+/
            },
            this.comments,
            this.popRule({
                token : "entity.name.label.csound",
                regex : /\w+/
            }), this.popRule({
                token : "empty",
                regex : /(?!\w)/
            })
        ],

        "Csound score opcode": [
            this.comments,
            {
                token : "punctuation.definition.string.begin.csound",
                regex : /{{/,
                next  : "csound-score-start"
            }, this.popRule({
                token : "empty",
                regex : /$/
            })
        ],

        "Python opcode": [
            this.comments,
            {
                token : "punctuation.definition.string.begin.csound",
                regex : /{{/,
                next  : "python-start"
            }, this.popRule({
                token : "empty",
                regex : /$/
            })
        ],

        "Lua opcode": [
            this.comments,
            {
                token : "punctuation.definition.string.begin.csound",
                regex : /{{/,
                next  : "lua-start"
            }, this.popRule({
                token : "empty",
                regex : /$/
            })
        ],

        "line continuation": [
            this.popRule({
                token : "empty",
                regex : /$/
            }),
            this.semicolonComments,
            {
                token : "invalid.illegal.csound",
                regex : /\S.*/
            }
        ]
    });

    var rules = [
        this.popRule({
            token : "punctuation.definition.string.end.csound",
            regex : /}}/
        })
    ];
    this.embedRules(CsoundScoreHighlightRules, "csound-score-", rules);
    this.embedRules(PythonHighlightRules, "python-", rules);
    this.embedRules(LuaHighlightRules, "lua-", rules);

    this.normalizeRules();
};

oop.inherits(CsoundOrchestraHighlightRules, CsoundPreprocessorHighlightRules);

exports.CsoundOrchestraHighlightRules = CsoundOrchestraHighlightRules;
});

ace.define("ace/mode/csound_orchestra",["require","exports","module","ace/lib/oop","ace/mode/text","ace/mode/csound_orchestra_highlight_rules"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../lib/oop");
var TextMode = acequire("./text").Mode;
var CsoundOrchestraHighlightRules = acequire("./csound_orchestra_highlight_rules").CsoundOrchestraHighlightRules;

var Mode = function() {
    this.HighlightRules = CsoundOrchestraHighlightRules;
};
oop.inherits(Mode, TextMode);

(function() {

    this.lineCommentStart = ";";
    this.blockComment = {start: "/*", end: "*/"};

}).call(Mode.prototype);

exports.Mode = Mode;
});
