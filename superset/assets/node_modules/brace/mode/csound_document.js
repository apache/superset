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

ace.define("ace/mode/css_highlight_rules",["require","exports","module","ace/lib/oop","ace/lib/lang","ace/mode/text_highlight_rules"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../lib/oop");
var lang = acequire("../lib/lang");
var TextHighlightRules = acequire("./text_highlight_rules").TextHighlightRules;
var supportType = exports.supportType = "align-content|align-items|align-self|all|animation|animation-delay|animation-direction|animation-duration|animation-fill-mode|animation-iteration-count|animation-name|animation-play-state|animation-timing-function|backface-visibility|background|background-attachment|background-blend-mode|background-clip|background-color|background-image|background-origin|background-position|background-repeat|background-size|border|border-bottom|border-bottom-color|border-bottom-left-radius|border-bottom-right-radius|border-bottom-style|border-bottom-width|border-collapse|border-color|border-image|border-image-outset|border-image-repeat|border-image-slice|border-image-source|border-image-width|border-left|border-left-color|border-left-style|border-left-width|border-radius|border-right|border-right-color|border-right-style|border-right-width|border-spacing|border-style|border-top|border-top-color|border-top-left-radius|border-top-right-radius|border-top-style|border-top-width|border-width|bottom|box-shadow|box-sizing|caption-side|clear|clip|color|column-count|column-fill|column-gap|column-rule|column-rule-color|column-rule-style|column-rule-width|column-span|column-width|columns|content|counter-increment|counter-reset|cursor|direction|display|empty-cells|filter|flex|flex-basis|flex-direction|flex-flow|flex-grow|flex-shrink|flex-wrap|float|font|font-family|font-size|font-size-adjust|font-stretch|font-style|font-variant|font-weight|hanging-punctuation|height|justify-content|left|letter-spacing|line-height|list-style|list-style-image|list-style-position|list-style-type|margin|margin-bottom|margin-left|margin-right|margin-top|max-height|max-width|min-height|min-width|nav-down|nav-index|nav-left|nav-right|nav-up|opacity|order|outline|outline-color|outline-offset|outline-style|outline-width|overflow|overflow-x|overflow-y|padding|padding-bottom|padding-left|padding-right|padding-top|page-break-after|page-break-before|page-break-inside|perspective|perspective-origin|position|quotes|resize|right|tab-size|table-layout|text-align|text-align-last|text-decoration|text-decoration-color|text-decoration-line|text-decoration-style|text-indent|text-justify|text-overflow|text-shadow|text-transform|top|transform|transform-origin|transform-style|transition|transition-delay|transition-duration|transition-property|transition-timing-function|unicode-bidi|vertical-align|visibility|white-space|width|word-break|word-spacing|word-wrap|z-index";
var supportFunction = exports.supportFunction = "rgb|rgba|url|attr|counter|counters";
var supportConstant = exports.supportConstant = "absolute|after-edge|after|all-scroll|all|alphabetic|always|antialiased|armenian|auto|avoid-column|avoid-page|avoid|balance|baseline|before-edge|before|below|bidi-override|block-line-height|block|bold|bolder|border-box|both|bottom|box|break-all|break-word|capitalize|caps-height|caption|center|central|char|circle|cjk-ideographic|clone|close-quote|col-resize|collapse|column|consider-shifts|contain|content-box|cover|crosshair|cubic-bezier|dashed|decimal-leading-zero|decimal|default|disabled|disc|disregard-shifts|distribute-all-lines|distribute-letter|distribute-space|distribute|dotted|double|e-resize|ease-in|ease-in-out|ease-out|ease|ellipsis|end|exclude-ruby|fill|fixed|georgian|glyphs|grid-height|groove|hand|hanging|hebrew|help|hidden|hiragana-iroha|hiragana|horizontal|icon|ideograph-alpha|ideograph-numeric|ideograph-parenthesis|ideograph-space|ideographic|inactive|include-ruby|inherit|initial|inline-block|inline-box|inline-line-height|inline-table|inline|inset|inside|inter-ideograph|inter-word|invert|italic|justify|katakana-iroha|katakana|keep-all|last|left|lighter|line-edge|line-through|line|linear|list-item|local|loose|lower-alpha|lower-greek|lower-latin|lower-roman|lowercase|lr-tb|ltr|mathematical|max-height|max-size|medium|menu|message-box|middle|move|n-resize|ne-resize|newspaper|no-change|no-close-quote|no-drop|no-open-quote|no-repeat|none|normal|not-allowed|nowrap|nw-resize|oblique|open-quote|outset|outside|overline|padding-box|page|pointer|pre-line|pre-wrap|pre|preserve-3d|progress|relative|repeat-x|repeat-y|repeat|replaced|reset-size|ridge|right|round|row-resize|rtl|s-resize|scroll|se-resize|separate|slice|small-caps|small-caption|solid|space|square|start|static|status-bar|step-end|step-start|steps|stretch|strict|sub|super|sw-resize|table-caption|table-cell|table-column-group|table-column|table-footer-group|table-header-group|table-row-group|table-row|table|tb-rl|text-after-edge|text-before-edge|text-bottom|text-size|text-top|text|thick|thin|transparent|underline|upper-alpha|upper-latin|upper-roman|uppercase|use-script|vertical-ideographic|vertical-text|visible|w-resize|wait|whitespace|z-index|zero";
var supportConstantColor = exports.supportConstantColor = "aliceblue|antiquewhite|aqua|aquamarine|azure|beige|bisque|black|blanchedalmond|blue|blueviolet|brown|burlywood|cadetblue|chartreuse|chocolate|coral|cornflowerblue|cornsilk|crimson|cyan|darkblue|darkcyan|darkgoldenrod|darkgray|darkgreen|darkgrey|darkkhaki|darkmagenta|darkolivegreen|darkorange|darkorchid|darkred|darksalmon|darkseagreen|darkslateblue|darkslategray|darkslategrey|darkturquoise|darkviolet|deeppink|deepskyblue|dimgray|dimgrey|dodgerblue|firebrick|floralwhite|forestgreen|fuchsia|gainsboro|ghostwhite|gold|goldenrod|gray|green|greenyellow|grey|honeydew|hotpink|indianred|indigo|ivory|khaki|lavender|lavenderblush|lawngreen|lemonchiffon|lightblue|lightcoral|lightcyan|lightgoldenrodyellow|lightgray|lightgreen|lightgrey|lightpink|lightsalmon|lightseagreen|lightskyblue|lightslategray|lightslategrey|lightsteelblue|lightyellow|lime|limegreen|linen|magenta|maroon|mediumaquamarine|mediumblue|mediumorchid|mediumpurple|mediumseagreen|mediumslateblue|mediumspringgreen|mediumturquoise|mediumvioletred|midnightblue|mintcream|mistyrose|moccasin|navajowhite|navy|oldlace|olive|olivedrab|orange|orangered|orchid|palegoldenrod|palegreen|paleturquoise|palevioletred|papayawhip|peachpuff|peru|pink|plum|powderblue|purple|rebeccapurple|red|rosybrown|royalblue|saddlebrown|salmon|sandybrown|seagreen|seashell|sienna|silver|skyblue|slateblue|slategray|slategrey|snow|springgreen|steelblue|tan|teal|thistle|tomato|turquoise|violet|wheat|white|whitesmoke|yellow|yellowgreen";
var supportConstantFonts = exports.supportConstantFonts = "arial|century|comic|courier|cursive|fantasy|garamond|georgia|helvetica|impact|lucida|symbol|system|tahoma|times|trebuchet|utopia|verdana|webdings|sans-serif|serif|monospace";

var numRe = exports.numRe = "\\-?(?:(?:[0-9]+(?:\\.[0-9]+)?)|(?:\\.[0-9]+))";
var pseudoElements = exports.pseudoElements = "(\\:+)\\b(after|before|first-letter|first-line|moz-selection|selection)\\b";
var pseudoClasses  = exports.pseudoClasses =  "(:)\\b(active|checked|disabled|empty|enabled|first-child|first-of-type|focus|hover|indeterminate|invalid|last-child|last-of-type|link|not|nth-child|nth-last-child|nth-last-of-type|nth-of-type|only-child|only-of-type|acequired|root|target|valid|visited)\\b";

var CssHighlightRules = function() {

    var keywordMapper = this.createKeywordMapper({
        "support.function": supportFunction,
        "support.constant": supportConstant,
        "support.type": supportType,
        "support.constant.color": supportConstantColor,
        "support.constant.fonts": supportConstantFonts
    }, "text", true);

    this.$rules = {
        "start" : [{
            include : ["strings", "url", "comments"]
        }, {
            token: "paren.lparen",
            regex: "\\{",
            next:  "ruleset"
        }, {
            token: "paren.rparen",
            regex: "\\}"
        }, {
            token: "string",
            regex: "@",
            next:  "media"
        }, {
            token: "keyword",
            regex: "#[a-z0-9-_]+"
        }, {
            token: "keyword",
            regex: "%"
        }, {
            token: "variable",
            regex: "\\.[a-z0-9-_]+"
        }, {
            token: "string",
            regex: ":[a-z0-9-_]+"
        }, {
            token : "constant.numeric",
            regex : numRe
        }, {
            token: "constant",
            regex: "[a-z0-9-_]+"
        }, {
            caseInsensitive: true
        }],

        "media": [{
            include : ["strings", "url", "comments"]
        }, {
            token: "paren.lparen",
            regex: "\\{",
            next:  "start"
        }, {
            token: "paren.rparen",
            regex: "\\}",
            next:  "start"
        }, {
            token: "string",
            regex: ";",
            next:  "start"
        }, {
            token: "keyword",
            regex: "(?:media|supports|document|charset|import|namespace|media|supports|document"
                + "|page|font|keyframes|viewport|counter-style|font-feature-values"
                + "|swash|ornaments|annotation|stylistic|styleset|character-variant)"
        }],

        "comments" : [{
            token: "comment", // multi line comment
            regex: "\\/\\*",
            push: [{
                token : "comment",
                regex : "\\*\\/",
                next : "pop"
            }, {
                defaultToken : "comment"
            }]
        }],

        "ruleset" : [{
            regex : "-(webkit|ms|moz|o)-",
            token : "text"
        }, {
            token : "paren.rparen",
            regex : "\\}",
            next : "start"
        }, {
            include : ["strings", "url", "comments"]
        }, {
            token : ["constant.numeric", "keyword"],
            regex : "(" + numRe + ")(ch|cm|deg|em|ex|fr|gd|grad|Hz|in|kHz|mm|ms|pc|pt|px|rad|rem|s|turn|vh|vm|vw|%)"
        }, {
            token : "constant.numeric",
            regex : numRe
        }, {
            token : "constant.numeric",  // hex6 color
            regex : "#[a-f0-9]{6}"
        }, {
            token : "constant.numeric", // hex3 color
            regex : "#[a-f0-9]{3}"
        }, {
            token : ["punctuation", "entity.other.attribute-name.pseudo-element.css"],
            regex : pseudoElements
        }, {
            token : ["punctuation", "entity.other.attribute-name.pseudo-class.css"],
            regex : pseudoClasses
        }, {
            include: "url"
        }, {
            token : keywordMapper,
            regex : "\\-?[a-zA-Z_][a-zA-Z0-9_\\-]*"
        }, {
            caseInsensitive: true
        }],

        url: [{
            token : "support.function",
            regex : "(?:url(:?-prefix)?|domain|regexp)\\(",
            push: [{
                token : "support.function",
                regex : "\\)",
                next : "pop"
            }, {
                defaultToken: "string"
            }]
        }],

        strings: [{
            token : "string.start",
            regex : "'",
            push : [{
                token : "string.end",
                regex : "'|$",
                next: "pop"
            }, {
                include : "escapes"
            }, {
                token : "constant.language.escape",
                regex : /\\$/,
                consumeLineEnd: true
            }, {
                defaultToken: "string"
            }]
        }, {
            token : "string.start",
            regex : '"',
            push : [{
                token : "string.end",
                regex : '"|$',
                next: "pop"
            }, {
                include : "escapes"
            }, {
                token : "constant.language.escape",
                regex : /\\$/,
                consumeLineEnd: true
            }, {
                defaultToken: "string"
            }]
        }],
        escapes: [{
            token : "constant.language.escape",
            regex : /\\([a-fA-F\d]{1,6}|[^a-fA-F\d])/
        }]

    };

    this.normalizeRules();
};

oop.inherits(CssHighlightRules, TextHighlightRules);

exports.CssHighlightRules = CssHighlightRules;

});

ace.define("ace/mode/doc_comment_highlight_rules",["require","exports","module","ace/lib/oop","ace/mode/text_highlight_rules"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../lib/oop");
var TextHighlightRules = acequire("./text_highlight_rules").TextHighlightRules;

var DocCommentHighlightRules = function() {
    this.$rules = {
        "start" : [ {
            token : "comment.doc.tag",
            regex : "@[\\w\\d_]+" // TODO: fix email addresses
        },
        DocCommentHighlightRules.getTagRule(),
        {
            defaultToken : "comment.doc",
            caseInsensitive: true
        }]
    };
};

oop.inherits(DocCommentHighlightRules, TextHighlightRules);

DocCommentHighlightRules.getTagRule = function(start) {
    return {
        token : "comment.doc.tag.storage.type",
        regex : "\\b(?:TODO|FIXME|XXX|HACK)\\b"
    };
};

DocCommentHighlightRules.getStartRule = function(start) {
    return {
        token : "comment.doc", // doc comment
        regex : "\\/\\*(?=\\*)",
        next  : start
    };
};

DocCommentHighlightRules.getEndRule = function (start) {
    return {
        token : "comment.doc", // closing comment
        regex : "\\*\\/",
        next  : start
    };
};


exports.DocCommentHighlightRules = DocCommentHighlightRules;

});

ace.define("ace/mode/javascript_highlight_rules",["require","exports","module","ace/lib/oop","ace/mode/doc_comment_highlight_rules","ace/mode/text_highlight_rules"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../lib/oop");
var DocCommentHighlightRules = acequire("./doc_comment_highlight_rules").DocCommentHighlightRules;
var TextHighlightRules = acequire("./text_highlight_rules").TextHighlightRules;
var identifierRe = "[a-zA-Z\\$_\u00a1-\uffff][a-zA-Z\\d\\$_\u00a1-\uffff]*";

var JavaScriptHighlightRules = function(options) {
    var keywordMapper = this.createKeywordMapper({
        "variable.language":
            "Array|Boolean|Date|Function|Iterator|Number|Object|RegExp|String|Proxy|"  + // Constructors
            "Namespace|QName|XML|XMLList|"                                             + // E4X
            "ArrayBuffer|Float32Array|Float64Array|Int16Array|Int32Array|Int8Array|"   +
            "Uint16Array|Uint32Array|Uint8Array|Uint8ClampedArray|"                    +
            "Error|EvalError|InternalError|RangeError|ReferenceError|StopIteration|"   + // Errors
            "SyntaxError|TypeError|URIError|"                                          +
            "decodeURI|decodeURIComponent|encodeURI|encodeURIComponent|eval|isFinite|" + // Non-constructor functions
            "isNaN|parseFloat|parseInt|"                                               +
            "JSON|Math|"                                                               + // Other
            "this|arguments|prototype|window|document"                                 , // Pseudo
        "keyword":
            "const|yield|import|get|set|async|await|" +
            "break|case|catch|continue|default|delete|do|else|finally|for|function|" +
            "if|in|of|instanceof|new|return|switch|throw|try|typeof|let|var|while|with|debugger|" +
            "__parent__|__count__|escape|unescape|with|__proto__|" +
            "class|enum|extends|super|export|implements|private|public|interface|package|protected|static",
        "storage.type":
            "const|let|var|function",
        "constant.language":
            "null|Infinity|NaN|undefined",
        "support.function":
            "alert",
        "constant.language.boolean": "true|false"
    }, "identifier");
    var kwBeforeRe = "case|do|else|finally|in|instanceof|return|throw|try|typeof|yield|void";

    var escapedRe = "\\\\(?:x[0-9a-fA-F]{2}|" + // hex
        "u[0-9a-fA-F]{4}|" + // unicode
        "u{[0-9a-fA-F]{1,6}}|" + // es6 unicode
        "[0-2][0-7]{0,2}|" + // oct
        "3[0-7][0-7]?|" + // oct
        "[4-7][0-7]?|" + //oct
        ".)";

    this.$rules = {
        "no_regex" : [
            DocCommentHighlightRules.getStartRule("doc-start"),
            comments("no_regex"),
            {
                token : "string",
                regex : "'(?=.)",
                next  : "qstring"
            }, {
                token : "string",
                regex : '"(?=.)',
                next  : "qqstring"
            }, {
                token : "constant.numeric", // hexadecimal, octal and binary
                regex : /0(?:[xX][0-9a-fA-F]+|[oO][0-7]+|[bB][01]+)\b/
            }, {
                token : "constant.numeric", // decimal integers and floats
                regex : /(?:\d\d*(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+\b)?/
            }, {
                token : [
                    "storage.type", "punctuation.operator", "support.function",
                    "punctuation.operator", "entity.name.function", "text","keyword.operator"
                ],
                regex : "(" + identifierRe + ")(\\.)(prototype)(\\.)(" + identifierRe +")(\\s*)(=)",
                next: "function_arguments"
            }, {
                token : [
                    "storage.type", "punctuation.operator", "entity.name.function", "text",
                    "keyword.operator", "text", "storage.type", "text", "paren.lparen"
                ],
                regex : "(" + identifierRe + ")(\\.)(" + identifierRe +")(\\s*)(=)(\\s*)(function)(\\s*)(\\()",
                next: "function_arguments"
            }, {
                token : [
                    "entity.name.function", "text", "keyword.operator", "text", "storage.type",
                    "text", "paren.lparen"
                ],
                regex : "(" + identifierRe +")(\\s*)(=)(\\s*)(function)(\\s*)(\\()",
                next: "function_arguments"
            }, {
                token : [
                    "storage.type", "punctuation.operator", "entity.name.function", "text",
                    "keyword.operator", "text",
                    "storage.type", "text", "entity.name.function", "text", "paren.lparen"
                ],
                regex : "(" + identifierRe + ")(\\.)(" + identifierRe +")(\\s*)(=)(\\s*)(function)(\\s+)(\\w+)(\\s*)(\\()",
                next: "function_arguments"
            }, {
                token : [
                    "storage.type", "text", "entity.name.function", "text", "paren.lparen"
                ],
                regex : "(function)(\\s+)(" + identifierRe + ")(\\s*)(\\()",
                next: "function_arguments"
            }, {
                token : [
                    "entity.name.function", "text", "punctuation.operator",
                    "text", "storage.type", "text", "paren.lparen"
                ],
                regex : "(" + identifierRe + ")(\\s*)(:)(\\s*)(function)(\\s*)(\\()",
                next: "function_arguments"
            }, {
                token : [
                    "text", "text", "storage.type", "text", "paren.lparen"
                ],
                regex : "(:)(\\s*)(function)(\\s*)(\\()",
                next: "function_arguments"
            }, {
                token : "keyword",
                regex : "from(?=\\s*('|\"))"
            }, {
                token : "keyword",
                regex : "(?:" + kwBeforeRe + ")\\b",
                next : "start"
            }, {
                token : ["support.constant"],
                regex : /that\b/
            }, {
                token : ["storage.type", "punctuation.operator", "support.function.firebug"],
                regex : /(console)(\.)(warn|info|log|error|time|trace|timeEnd|assert)\b/
            }, {
                token : keywordMapper,
                regex : identifierRe
            }, {
                token : "punctuation.operator",
                regex : /[.](?![.])/,
                next  : "property"
            }, {
                token : "storage.type",
                regex : /=>/
            }, {
                token : "keyword.operator",
                regex : /--|\+\+|\.{3}|===|==|=|!=|!==|<+=?|>+=?|!|&&|\|\||\?:|[!$%&*+\-~\/^]=?/,
                next  : "start"
            }, {
                token : "punctuation.operator",
                regex : /[?:,;.]/,
                next  : "start"
            }, {
                token : "paren.lparen",
                regex : /[\[({]/,
                next  : "start"
            }, {
                token : "paren.rparen",
                regex : /[\])}]/
            }, {
                token: "comment",
                regex: /^#!.*$/
            }
        ],
        property: [{
                token : "text",
                regex : "\\s+"
            }, {
                token : [
                    "storage.type", "punctuation.operator", "entity.name.function", "text",
                    "keyword.operator", "text",
                    "storage.type", "text", "entity.name.function", "text", "paren.lparen"
                ],
                regex : "(" + identifierRe + ")(\\.)(" + identifierRe +")(\\s*)(=)(\\s*)(function)(?:(\\s+)(\\w+))?(\\s*)(\\()",
                next: "function_arguments"
            }, {
                token : "punctuation.operator",
                regex : /[.](?![.])/
            }, {
                token : "support.function",
                regex : /(s(?:h(?:ift|ow(?:Mod(?:elessDialog|alDialog)|Help))|croll(?:X|By(?:Pages|Lines)?|Y|To)?|t(?:op|rike)|i(?:n|zeToContent|debar|gnText)|ort|u(?:p|b(?:str(?:ing)?)?)|pli(?:ce|t)|e(?:nd|t(?:Re(?:sizable|questHeader)|M(?:i(?:nutes|lliseconds)|onth)|Seconds|Ho(?:tKeys|urs)|Year|Cursor|Time(?:out)?|Interval|ZOptions|Date|UTC(?:M(?:i(?:nutes|lliseconds)|onth)|Seconds|Hours|Date|FullYear)|FullYear|Active)|arch)|qrt|lice|avePreferences|mall)|h(?:ome|andleEvent)|navigate|c(?:har(?:CodeAt|At)|o(?:s|n(?:cat|textual|firm)|mpile)|eil|lear(?:Timeout|Interval)?|a(?:ptureEvents|ll)|reate(?:StyleSheet|Popup|EventObject))|t(?:o(?:GMTString|S(?:tring|ource)|U(?:TCString|pperCase)|Lo(?:caleString|werCase))|est|a(?:n|int(?:Enabled)?))|i(?:s(?:NaN|Finite)|ndexOf|talics)|d(?:isableExternalCapture|ump|etachEvent)|u(?:n(?:shift|taint|escape|watch)|pdateCommands)|j(?:oin|avaEnabled)|p(?:o(?:p|w)|ush|lugins.refresh|a(?:ddings|rse(?:Int|Float)?)|r(?:int|ompt|eference))|e(?:scape|nableExternalCapture|val|lementFromPoint|x(?:p|ec(?:Script|Command)?))|valueOf|UTC|queryCommand(?:State|Indeterm|Enabled|Value)|f(?:i(?:nd|le(?:ModifiedDate|Size|CreatedDate|UpdatedDate)|xed)|o(?:nt(?:size|color)|rward)|loor|romCharCode)|watch|l(?:ink|o(?:ad|g)|astIndexOf)|a(?:sin|nchor|cos|t(?:tachEvent|ob|an(?:2)?)|pply|lert|b(?:s|ort))|r(?:ou(?:nd|teEvents)|e(?:size(?:By|To)|calc|turnValue|place|verse|l(?:oad|ease(?:Capture|Events)))|andom)|g(?:o|et(?:ResponseHeader|M(?:i(?:nutes|lliseconds)|onth)|Se(?:conds|lection)|Hours|Year|Time(?:zoneOffset)?|Da(?:y|te)|UTC(?:M(?:i(?:nutes|lliseconds)|onth)|Seconds|Hours|Da(?:y|te)|FullYear)|FullYear|A(?:ttention|llResponseHeaders)))|m(?:in|ove(?:B(?:y|elow)|To(?:Absolute)?|Above)|ergeAttributes|a(?:tch|rgins|x))|b(?:toa|ig|o(?:ld|rderWidths)|link|ack))\b(?=\()/
            }, {
                token : "support.function.dom",
                regex : /(s(?:ub(?:stringData|mit)|plitText|e(?:t(?:NamedItem|Attribute(?:Node)?)|lect))|has(?:ChildNodes|Feature)|namedItem|c(?:l(?:ick|o(?:se|neNode))|reate(?:C(?:omment|DATASection|aption)|T(?:Head|extNode|Foot)|DocumentFragment|ProcessingInstruction|E(?:ntityReference|lement)|Attribute))|tabIndex|i(?:nsert(?:Row|Before|Cell|Data)|tem)|open|delete(?:Row|C(?:ell|aption)|T(?:Head|Foot)|Data)|focus|write(?:ln)?|a(?:dd|ppend(?:Child|Data))|re(?:set|place(?:Child|Data)|move(?:NamedItem|Child|Attribute(?:Node)?)?)|get(?:NamedItem|Element(?:sBy(?:Name|TagName|ClassName)|ById)|Attribute(?:Node)?)|blur)\b(?=\()/
            }, {
                token :  "support.constant",
                regex : /(s(?:ystemLanguage|cr(?:ipts|ollbars|een(?:X|Y|Top|Left))|t(?:yle(?:Sheets)?|atus(?:Text|bar)?)|ibling(?:Below|Above)|ource|uffixes|e(?:curity(?:Policy)?|l(?:ection|f)))|h(?:istory|ost(?:name)?|as(?:h|Focus))|y|X(?:MLDocument|SLDocument)|n(?:ext|ame(?:space(?:s|URI)|Prop))|M(?:IN_VALUE|AX_VALUE)|c(?:haracterSet|o(?:n(?:structor|trollers)|okieEnabled|lorDepth|mp(?:onents|lete))|urrent|puClass|l(?:i(?:p(?:boardData)?|entInformation)|osed|asses)|alle(?:e|r)|rypto)|t(?:o(?:olbar|p)|ext(?:Transform|Indent|Decoration|Align)|ags)|SQRT(?:1_2|2)|i(?:n(?:ner(?:Height|Width)|put)|ds|gnoreCase)|zIndex|o(?:scpu|n(?:readystatechange|Line)|uter(?:Height|Width)|p(?:sProfile|ener)|ffscreenBuffering)|NEGATIVE_INFINITY|d(?:i(?:splay|alog(?:Height|Top|Width|Left|Arguments)|rectories)|e(?:scription|fault(?:Status|Ch(?:ecked|arset)|View)))|u(?:ser(?:Profile|Language|Agent)|n(?:iqueID|defined)|pdateInterval)|_content|p(?:ixelDepth|ort|ersonalbar|kcs11|l(?:ugins|atform)|a(?:thname|dding(?:Right|Bottom|Top|Left)|rent(?:Window|Layer)?|ge(?:X(?:Offset)?|Y(?:Offset)?))|r(?:o(?:to(?:col|type)|duct(?:Sub)?|mpter)|e(?:vious|fix)))|e(?:n(?:coding|abledPlugin)|x(?:ternal|pando)|mbeds)|v(?:isibility|endor(?:Sub)?|Linkcolor)|URLUnencoded|P(?:I|OSITIVE_INFINITY)|f(?:ilename|o(?:nt(?:Size|Family|Weight)|rmName)|rame(?:s|Element)|gColor)|E|whiteSpace|l(?:i(?:stStyleType|n(?:eHeight|kColor))|o(?:ca(?:tion(?:bar)?|lName)|wsrc)|e(?:ngth|ft(?:Context)?)|a(?:st(?:M(?:odified|atch)|Index|Paren)|yer(?:s|X)|nguage))|a(?:pp(?:MinorVersion|Name|Co(?:deName|re)|Version)|vail(?:Height|Top|Width|Left)|ll|r(?:ity|guments)|Linkcolor|bove)|r(?:ight(?:Context)?|e(?:sponse(?:XML|Text)|adyState))|global|x|m(?:imeTypes|ultiline|enubar|argin(?:Right|Bottom|Top|Left))|L(?:N(?:10|2)|OG(?:10E|2E))|b(?:o(?:ttom|rder(?:Width|RightWidth|BottomWidth|Style|Color|TopWidth|LeftWidth))|ufferDepth|elow|ackground(?:Color|Image)))\b/
            }, {
                token : "identifier",
                regex : identifierRe
            }, {
                regex: "",
                token: "empty",
                next: "no_regex"
            }
        ],
        "start": [
            DocCommentHighlightRules.getStartRule("doc-start"),
            comments("start"),
            {
                token: "string.regexp",
                regex: "\\/",
                next: "regex"
            }, {
                token : "text",
                regex : "\\s+|^$",
                next : "start"
            }, {
                token: "empty",
                regex: "",
                next: "no_regex"
            }
        ],
        "regex": [
            {
                token: "regexp.keyword.operator",
                regex: "\\\\(?:u[\\da-fA-F]{4}|x[\\da-fA-F]{2}|.)"
            }, {
                token: "string.regexp",
                regex: "/[sxngimy]*",
                next: "no_regex"
            }, {
                token : "invalid",
                regex: /\{\d+\b,?\d*\}[+*]|[+*$^?][+*]|[$^][?]|\?{3,}/
            }, {
                token : "constant.language.escape",
                regex: /\(\?[:=!]|\)|\{\d+\b,?\d*\}|[+*]\?|[()$^+*?.]/
            }, {
                token : "constant.language.delimiter",
                regex: /\|/
            }, {
                token: "constant.language.escape",
                regex: /\[\^?/,
                next: "regex_character_class"
            }, {
                token: "empty",
                regex: "$",
                next: "no_regex"
            }, {
                defaultToken: "string.regexp"
            }
        ],
        "regex_character_class": [
            {
                token: "regexp.charclass.keyword.operator",
                regex: "\\\\(?:u[\\da-fA-F]{4}|x[\\da-fA-F]{2}|.)"
            }, {
                token: "constant.language.escape",
                regex: "]",
                next: "regex"
            }, {
                token: "constant.language.escape",
                regex: "-"
            }, {
                token: "empty",
                regex: "$",
                next: "no_regex"
            }, {
                defaultToken: "string.regexp.charachterclass"
            }
        ],
        "function_arguments": [
            {
                token: "variable.parameter",
                regex: identifierRe
            }, {
                token: "punctuation.operator",
                regex: "[, ]+"
            }, {
                token: "punctuation.operator",
                regex: "$"
            }, {
                token: "empty",
                regex: "",
                next: "no_regex"
            }
        ],
        "qqstring" : [
            {
                token : "constant.language.escape",
                regex : escapedRe
            }, {
                token : "string",
                regex : "\\\\$",
                consumeLineEnd  : true
            }, {
                token : "string",
                regex : '"|$',
                next  : "no_regex"
            }, {
                defaultToken: "string"
            }
        ],
        "qstring" : [
            {
                token : "constant.language.escape",
                regex : escapedRe
            }, {
                token : "string",
                regex : "\\\\$",
                consumeLineEnd  : true
            }, {
                token : "string",
                regex : "'|$",
                next  : "no_regex"
            }, {
                defaultToken: "string"
            }
        ]
    };


    if (!options || !options.noES6) {
        this.$rules.no_regex.unshift({
            regex: "[{}]", onMatch: function(val, state, stack) {
                this.next = val == "{" ? this.nextState : "";
                if (val == "{" && stack.length) {
                    stack.unshift("start", state);
                }
                else if (val == "}" && stack.length) {
                    stack.shift();
                    this.next = stack.shift();
                    if (this.next.indexOf("string") != -1 || this.next.indexOf("jsx") != -1)
                        return "paren.quasi.end";
                }
                return val == "{" ? "paren.lparen" : "paren.rparen";
            },
            nextState: "start"
        }, {
            token : "string.quasi.start",
            regex : /`/,
            push  : [{
                token : "constant.language.escape",
                regex : escapedRe
            }, {
                token : "paren.quasi.start",
                regex : /\${/,
                push  : "start"
            }, {
                token : "string.quasi.end",
                regex : /`/,
                next  : "pop"
            }, {
                defaultToken: "string.quasi"
            }]
        });

        if (!options || options.jsx != false)
            JSX.call(this);
    }

    this.embedRules(DocCommentHighlightRules, "doc-",
        [ DocCommentHighlightRules.getEndRule("no_regex") ]);

    this.normalizeRules();
};

oop.inherits(JavaScriptHighlightRules, TextHighlightRules);

function JSX() {
    var tagRegex = identifierRe.replace("\\d", "\\d\\-");
    var jsxTag = {
        onMatch : function(val, state, stack) {
            var offset = val.charAt(1) == "/" ? 2 : 1;
            if (offset == 1) {
                if (state != this.nextState)
                    stack.unshift(this.next, this.nextState, 0);
                else
                    stack.unshift(this.next);
                stack[2]++;
            } else if (offset == 2) {
                if (state == this.nextState) {
                    stack[1]--;
                    if (!stack[1] || stack[1] < 0) {
                        stack.shift();
                        stack.shift();
                    }
                }
            }
            return [{
                type: "meta.tag.punctuation." + (offset == 1 ? "" : "end-") + "tag-open.xml",
                value: val.slice(0, offset)
            }, {
                type: "meta.tag.tag-name.xml",
                value: val.substr(offset)
            }];
        },
        regex : "</?" + tagRegex + "",
        next: "jsxAttributes",
        nextState: "jsx"
    };
    this.$rules.start.unshift(jsxTag);
    var jsxJsRule = {
        regex: "{",
        token: "paren.quasi.start",
        push: "start"
    };
    this.$rules.jsx = [
        jsxJsRule,
        jsxTag,
        {include : "reference"},
        {defaultToken: "string"}
    ];
    this.$rules.jsxAttributes = [{
        token : "meta.tag.punctuation.tag-close.xml",
        regex : "/?>",
        onMatch : function(value, currentState, stack) {
            if (currentState == stack[0])
                stack.shift();
            if (value.length == 2) {
                if (stack[0] == this.nextState)
                    stack[1]--;
                if (!stack[1] || stack[1] < 0) {
                    stack.splice(0, 2);
                }
            }
            this.next = stack[0] || "start";
            return [{type: this.token, value: value}];
        },
        nextState: "jsx"
    },
    jsxJsRule,
    comments("jsxAttributes"),
    {
        token : "entity.other.attribute-name.xml",
        regex : tagRegex
    }, {
        token : "keyword.operator.attribute-equals.xml",
        regex : "="
    }, {
        token : "text.tag-whitespace.xml",
        regex : "\\s+"
    }, {
        token : "string.attribute-value.xml",
        regex : "'",
        stateName : "jsx_attr_q",
        push : [
            {token : "string.attribute-value.xml", regex: "'", next: "pop"},
            {include : "reference"},
            {defaultToken : "string.attribute-value.xml"}
        ]
    }, {
        token : "string.attribute-value.xml",
        regex : '"',
        stateName : "jsx_attr_qq",
        push : [
            {token : "string.attribute-value.xml", regex: '"', next: "pop"},
            {include : "reference"},
            {defaultToken : "string.attribute-value.xml"}
        ]
    },
    jsxTag
    ];
    this.$rules.reference = [{
        token : "constant.language.escape.reference.xml",
        regex : "(?:&#[0-9]+;)|(?:&#x[0-9a-fA-F]+;)|(?:&[a-zA-Z0-9_:\\.-]+;)"
    }];
}

function comments(next) {
    return [
        {
            token : "comment", // multi line comment
            regex : /\/\*/,
            next: [
                DocCommentHighlightRules.getTagRule(),
                {token : "comment", regex : "\\*\\/", next : next || "pop"},
                {defaultToken : "comment", caseInsensitive: true}
            ]
        }, {
            token : "comment",
            regex : "\\/\\/",
            next: [
                DocCommentHighlightRules.getTagRule(),
                {token : "comment", regex : "$|^", next : next || "pop"},
                {defaultToken : "comment", caseInsensitive: true}
            ]
        }
    ];
}
exports.JavaScriptHighlightRules = JavaScriptHighlightRules;
});

ace.define("ace/mode/xml_highlight_rules",["require","exports","module","ace/lib/oop","ace/mode/text_highlight_rules"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../lib/oop");
var TextHighlightRules = acequire("./text_highlight_rules").TextHighlightRules;

var XmlHighlightRules = function(normalize) {
    var tagRegex = "[_:a-zA-Z\xc0-\uffff][-_:.a-zA-Z0-9\xc0-\uffff]*";

    this.$rules = {
        start : [
            {token : "string.cdata.xml", regex : "<\\!\\[CDATA\\[", next : "cdata"},
            {
                token : ["punctuation.instruction.xml", "keyword.instruction.xml"],
                regex : "(<\\?)(" + tagRegex + ")", next : "processing_instruction"
            },
            {token : "comment.start.xml", regex : "<\\!--", next : "comment"},
            {
                token : ["xml-pe.doctype.xml", "xml-pe.doctype.xml"],
                regex : "(<\\!)(DOCTYPE)(?=[\\s])", next : "doctype", caseInsensitive: true
            },
            {include : "tag"},
            {token : "text.end-tag-open.xml", regex: "</"},
            {token : "text.tag-open.xml", regex: "<"},
            {include : "reference"},
            {defaultToken : "text.xml"}
        ],

        processing_instruction : [{
            token : "entity.other.attribute-name.decl-attribute-name.xml",
            regex : tagRegex
        }, {
            token : "keyword.operator.decl-attribute-equals.xml",
            regex : "="
        }, {
            include: "whitespace"
        }, {
            include: "string"
        }, {
            token : "punctuation.xml-decl.xml",
            regex : "\\?>",
            next : "start"
        }],

        doctype : [
            {include : "whitespace"},
            {include : "string"},
            {token : "xml-pe.doctype.xml", regex : ">", next : "start"},
            {token : "xml-pe.xml", regex : "[-_a-zA-Z0-9:]+"},
            {token : "punctuation.int-subset", regex : "\\[", push : "int_subset"}
        ],

        int_subset : [{
            token : "text.xml",
            regex : "\\s+"
        }, {
            token: "punctuation.int-subset.xml",
            regex: "]",
            next: "pop"
        }, {
            token : ["punctuation.markup-decl.xml", "keyword.markup-decl.xml"],
            regex : "(<\\!)(" + tagRegex + ")",
            push : [{
                token : "text",
                regex : "\\s+"
            },
            {
                token : "punctuation.markup-decl.xml",
                regex : ">",
                next : "pop"
            },
            {include : "string"}]
        }],

        cdata : [
            {token : "string.cdata.xml", regex : "\\]\\]>", next : "start"},
            {token : "text.xml", regex : "\\s+"},
            {token : "text.xml", regex : "(?:[^\\]]|\\](?!\\]>))+"}
        ],

        comment : [
            {token : "comment.end.xml", regex : "-->", next : "start"},
            {defaultToken : "comment.xml"}
        ],

        reference : [{
            token : "constant.language.escape.reference.xml",
            regex : "(?:&#[0-9]+;)|(?:&#x[0-9a-fA-F]+;)|(?:&[a-zA-Z0-9_:\\.-]+;)"
        }],

        attr_reference : [{
            token : "constant.language.escape.reference.attribute-value.xml",
            regex : "(?:&#[0-9]+;)|(?:&#x[0-9a-fA-F]+;)|(?:&[a-zA-Z0-9_:\\.-]+;)"
        }],

        tag : [{
            token : ["meta.tag.punctuation.tag-open.xml", "meta.tag.punctuation.end-tag-open.xml", "meta.tag.tag-name.xml"],
            regex : "(?:(<)|(</))((?:" + tagRegex + ":)?" + tagRegex + ")",
            next: [
                {include : "attributes"},
                {token : "meta.tag.punctuation.tag-close.xml", regex : "/?>", next : "start"}
            ]
        }],

        tag_whitespace : [
            {token : "text.tag-whitespace.xml", regex : "\\s+"}
        ],
        whitespace : [
            {token : "text.whitespace.xml", regex : "\\s+"}
        ],
        string: [{
            token : "string.xml",
            regex : "'",
            push : [
                {token : "string.xml", regex: "'", next: "pop"},
                {defaultToken : "string.xml"}
            ]
        }, {
            token : "string.xml",
            regex : '"',
            push : [
                {token : "string.xml", regex: '"', next: "pop"},
                {defaultToken : "string.xml"}
            ]
        }],

        attributes: [{
            token : "entity.other.attribute-name.xml",
            regex : tagRegex
        }, {
            token : "keyword.operator.attribute-equals.xml",
            regex : "="
        }, {
            include: "tag_whitespace"
        }, {
            include: "attribute_value"
        }],

        attribute_value: [{
            token : "string.attribute-value.xml",
            regex : "'",
            push : [
                {token : "string.attribute-value.xml", regex: "'", next: "pop"},
                {include : "attr_reference"},
                {defaultToken : "string.attribute-value.xml"}
            ]
        }, {
            token : "string.attribute-value.xml",
            regex : '"',
            push : [
                {token : "string.attribute-value.xml", regex: '"', next: "pop"},
                {include : "attr_reference"},
                {defaultToken : "string.attribute-value.xml"}
            ]
        }]
    };

    if (this.constructor === XmlHighlightRules)
        this.normalizeRules();
};


(function() {

    this.embedTagRules = function(HighlightRules, prefix, tag){
        this.$rules.tag.unshift({
            token : ["meta.tag.punctuation.tag-open.xml", "meta.tag." + tag + ".tag-name.xml"],
            regex : "(<)(" + tag + "(?=\\s|>|$))",
            next: [
                {include : "attributes"},
                {token : "meta.tag.punctuation.tag-close.xml", regex : "/?>", next : prefix + "start"}
            ]
        });

        this.$rules[tag + "-end"] = [
            {include : "attributes"},
            {token : "meta.tag.punctuation.tag-close.xml", regex : "/?>",  next: "start",
                onMatch : function(value, currentState, stack) {
                    stack.splice(0);
                    return this.token;
            }}
        ];

        this.embedRules(HighlightRules, prefix, [{
            token: ["meta.tag.punctuation.end-tag-open.xml", "meta.tag." + tag + ".tag-name.xml"],
            regex : "(</)(" + tag + "(?=\\s|>|$))",
            next: tag + "-end"
        }, {
            token: "string.cdata.xml",
            regex : "<\\!\\[CDATA\\["
        }, {
            token: "string.cdata.xml",
            regex : "\\]\\]>"
        }]);
    };

}).call(TextHighlightRules.prototype);

oop.inherits(XmlHighlightRules, TextHighlightRules);

exports.XmlHighlightRules = XmlHighlightRules;
});

ace.define("ace/mode/html_highlight_rules",["require","exports","module","ace/lib/oop","ace/lib/lang","ace/mode/css_highlight_rules","ace/mode/javascript_highlight_rules","ace/mode/xml_highlight_rules"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../lib/oop");
var lang = acequire("../lib/lang");
var CssHighlightRules = acequire("./css_highlight_rules").CssHighlightRules;
var JavaScriptHighlightRules = acequire("./javascript_highlight_rules").JavaScriptHighlightRules;
var XmlHighlightRules = acequire("./xml_highlight_rules").XmlHighlightRules;

var tagMap = lang.createMap({
    a           : 'anchor',
    button 	    : 'form',
    form        : 'form',
    img         : 'image',
    input       : 'form',
    label       : 'form',
    option      : 'form',
    script      : 'script',
    select      : 'form',
    textarea    : 'form',
    style       : 'style',
    table       : 'table',
    tbody       : 'table',
    td          : 'table',
    tfoot       : 'table',
    th          : 'table',
    tr          : 'table'
});

var HtmlHighlightRules = function() {
    XmlHighlightRules.call(this);

    this.addRules({
        attributes: [{
            include : "tag_whitespace"
        }, {
            token : "entity.other.attribute-name.xml",
            regex : "[-_a-zA-Z0-9:.]+"
        }, {
            token : "keyword.operator.attribute-equals.xml",
            regex : "=",
            push : [{
                include: "tag_whitespace"
            }, {
                token : "string.unquoted.attribute-value.html",
                regex : "[^<>='\"`\\s]+",
                next : "pop"
            }, {
                token : "empty",
                regex : "",
                next : "pop"
            }]
        }, {
            include : "attribute_value"
        }],
        tag: [{
            token : function(start, tag) {
                var group = tagMap[tag];
                return ["meta.tag.punctuation." + (start == "<" ? "" : "end-") + "tag-open.xml",
                    "meta.tag" + (group ? "." + group : "") + ".tag-name.xml"];
            },
            regex : "(</?)([-_a-zA-Z0-9:.]+)",
            next: "tag_stuff"
        }],
        tag_stuff: [
            {include : "attributes"},
            {token : "meta.tag.punctuation.tag-close.xml", regex : "/?>", next : "start"}
        ]
    });

    this.embedTagRules(CssHighlightRules, "css-", "style");
    this.embedTagRules(new JavaScriptHighlightRules({jsx: false}).getRules(), "js-", "script");

    if (this.constructor === HtmlHighlightRules)
        this.normalizeRules();
};

oop.inherits(HtmlHighlightRules, XmlHighlightRules);

exports.HtmlHighlightRules = HtmlHighlightRules;
});

ace.define("ace/mode/csound_document_highlight_rules",["require","exports","module","ace/lib/oop","ace/mode/csound_orchestra_highlight_rules","ace/mode/csound_score_highlight_rules","ace/mode/html_highlight_rules","ace/mode/text_highlight_rules"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../lib/oop");

var CsoundOrchestraHighlightRules = acequire("./csound_orchestra_highlight_rules").CsoundOrchestraHighlightRules;
var CsoundScoreHighlightRules = acequire("./csound_score_highlight_rules").CsoundScoreHighlightRules;
var HtmlHighlightRules = acequire("./html_highlight_rules").HtmlHighlightRules;
var TextHighlightRules = acequire("./text_highlight_rules").TextHighlightRules;

var CsoundDocumentHighlightRules = function() {

    this.$rules = {
        "start": [
            {
                token : ["meta.tag.punctuation.tag-open.csound-document", "entity.name.tag.begin.csound-document", "meta.tag.punctuation.tag-close.csound-document"],
                regex : /(<)(CsoundSynthesi[sz]er)(>)/,
                next  : "synthesizer"
            },
            {defaultToken : "text.csound-document"}
        ],

        "synthesizer": [
            {
                token : ["meta.tag.punctuation.end-tag-open.csound-document", "entity.name.tag.begin.csound-document", "meta.tag.punctuation.tag-close.csound-document"],
                regex : "(</)(CsoundSynthesi[sz]er)(>)",
                next  : "start"
            }, {
                token : ["meta.tag.punctuation.tag-open.csound-document", "entity.name.tag.begin.csound-document", "meta.tag.punctuation.tag-close.csound-document"],
                regex : "(<)(CsInstruments)(>)",
                next  : "csound-start"
            }, {
                token : ["meta.tag.punctuation.tag-open.csound-document", "entity.name.tag.begin.csound-document", "meta.tag.punctuation.tag-close.csound-document"],
                regex : "(<)(CsScore)(>)",
                next  : "csound-score-start"
            }, {
                token : ["meta.tag.punctuation.tag-open.csound-document", "entity.name.tag.begin.csound-document", "meta.tag.punctuation.tag-close.csound-document"],
                regex : "(<)([Hh][Tt][Mm][Ll])(>)",
                next  : "html-start"
            }
        ]
    };

    this.embedRules(CsoundOrchestraHighlightRules, "csound-", [{
        token : ["meta.tag.punctuation.end-tag-open.csound-document", "entity.name.tag.begin.csound-document", "meta.tag.punctuation.tag-close.csound-document"],
        regex : "(</)(CsInstruments)(>)",
        next  : "synthesizer"
    }]);
    this.embedRules(CsoundScoreHighlightRules, "csound-score-", [{
        token : ["meta.tag.punctuation.end-tag-open.csound-document", "entity.name.tag.begin.csound-document", "meta.tag.punctuation.tag-close.csound-document"],
        regex : "(</)(CsScore)(>)",
        next  : "synthesizer"
    }]);
    this.embedRules(HtmlHighlightRules, "html-", [{
        token : ["meta.tag.punctuation.end-tag-open.csound-document", "entity.name.tag.begin.csound-document", "meta.tag.punctuation.tag-close.csound-document"],
        regex : "(</)([Hh][Tt][Mm][Ll])(>)",
        next  : "synthesizer"
    }]);

    this.normalizeRules();
};

oop.inherits(CsoundDocumentHighlightRules, TextHighlightRules);

exports.CsoundDocumentHighlightRules = CsoundDocumentHighlightRules;
});

ace.define("ace/mode/csound_document",["require","exports","module","ace/lib/oop","ace/mode/text","ace/mode/csound_document_highlight_rules"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../lib/oop");
var TextMode = acequire("./text").Mode;
var CsoundDocumentHighlightRules = acequire("./csound_document_highlight_rules").CsoundDocumentHighlightRules;

var Mode = function() {
    this.HighlightRules = CsoundDocumentHighlightRules;
};
oop.inherits(Mode, TextMode);

exports.Mode = Mode;
});
