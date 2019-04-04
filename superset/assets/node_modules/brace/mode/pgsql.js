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

ace.define("ace/mode/perl_highlight_rules",["require","exports","module","ace/lib/oop","ace/mode/text_highlight_rules"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../lib/oop");
var TextHighlightRules = acequire("./text_highlight_rules").TextHighlightRules;

var PerlHighlightRules = function() {

    var keywords = (
        "base|constant|continue|else|elsif|for|foreach|format|goto|if|last|local|my|next|" +
         "no|package|parent|redo|acequire|scalar|sub|unless|until|while|use|vars"
    );

    var buildinConstants = ("ARGV|ENV|INC|SIG");

    var builtinFunctions = (
        "getprotobynumber|getprotobyname|getservbyname|gethostbyaddr|" +
         "gethostbyname|getservbyport|getnetbyaddr|getnetbyname|getsockname|" +
         "getpeername|setpriority|getprotoent|setprotoent|getpriority|" +
         "endprotoent|getservent|setservent|endservent|sethostent|socketpair|" +
         "getsockopt|gethostent|endhostent|setsockopt|setnetent|quotemeta|" +
         "localtime|prototype|getnetent|endnetent|rewinddir|wantarray|getpwuid|" +
         "closedir|getlogin|readlink|endgrent|getgrgid|getgrnam|shmwrite|" +
         "shutdown|readline|endpwent|setgrent|readpipe|formline|truncate|" +
         "dbmclose|syswrite|setpwent|getpwnam|getgrent|getpwent|ucfirst|sysread|" +
         "setpgrp|shmread|sysseek|sysopen|telldir|defined|opendir|connect|" +
         "lcfirst|getppid|binmode|syscall|sprintf|getpgrp|readdir|seekdir|" +
         "waitpid|reverse|unshift|symlink|dbmopen|semget|msgrcv|rename|listen|" +
         "chroot|msgsnd|shmctl|accept|unpack|exists|fileno|shmget|system|" +
         "unlink|printf|gmtime|msgctl|semctl|values|rindex|substr|splice|" +
         "length|msgget|select|socket|return|caller|delete|alarm|ioctl|index|" +
         "undef|lstat|times|srand|chown|fcntl|close|write|umask|rmdir|study|" +
         "sleep|chomp|untie|print|utime|mkdir|atan2|split|crypt|flock|chmod|" +
         "BEGIN|bless|chdir|semop|shift|reset|link|stat|chop|grep|fork|dump|" +
         "join|open|tell|pipe|exit|glob|warn|each|bind|sort|pack|eval|push|" +
         "keys|getc|kill|seek|sqrt|send|wait|rand|tied|read|time|exec|recv|" +
         "eof|chr|int|ord|exp|pos|pop|sin|log|abs|oct|hex|tie|cos|vec|END|ref|" +
         "map|die|uc|lc|do"
    );

    var keywordMapper = this.createKeywordMapper({
        "keyword": keywords,
        "constant.language": buildinConstants,
        "support.function": builtinFunctions
    }, "identifier");

    this.$rules = {
        "start" : [
            {
                token : "comment.doc",
                regex : "^=(?:begin|item)\\b",
                next : "block_comment"
            }, {
                token : "string.regexp",
                regex : "[/](?:(?:\\[(?:\\\\]|[^\\]])+\\])|(?:\\\\/|[^\\]/]))*[/]\\w*\\s*(?=[).,;]|$)"
            }, {
                token : "string", // single line
                regex : '["](?:(?:\\\\.)|(?:[^"\\\\]))*?["]'
            }, {
                token : "string", // multi line string start
                regex : '["].*\\\\$',
                next : "qqstring"
            }, {
                token : "string", // single line
                regex : "['](?:(?:\\\\.)|(?:[^'\\\\]))*?[']"
            }, {
                token : "string", // multi line string start
                regex : "['].*\\\\$",
                next : "qstring"
            }, {
                token : "constant.numeric", // hex
                regex : "0x[0-9a-fA-F]+\\b"
            }, {
                token : "constant.numeric", // float
                regex : "[+-]?\\d+(?:(?:\\.\\d*)?(?:[eE][+-]?\\d+)?)?\\b"
            }, {
                token : keywordMapper,
                regex : "[a-zA-Z_$][a-zA-Z0-9_$]*\\b"
            }, {
                token : "keyword.operator",
                regex : "%#|\\$#|\\.\\.\\.|\\|\\|=|>>=|<<=|<=>|&&=|=>|!~|\\^=|&=|\\|=|\\.=|x=|%=|\\/=|\\*=|\\-=|\\+=|=~|\\*\\*|\\-\\-|\\.\\.|\\|\\||&&|\\+\\+|\\->|!=|==|>=|<=|>>|<<|,|=|\\?\\:|\\^|\\||x|%|\\/|\\*|<|&|\\\\|~|!|>|\\.|\\-|\\+|\\-C|\\-b|\\-S|\\-u|\\-t|\\-p|\\-l|\\-d|\\-f|\\-g|\\-s|\\-z|\\-k|\\-e|\\-O|\\-T|\\-B|\\-M|\\-A|\\-X|\\-W|\\-c|\\-R|\\-o|\\-x|\\-w|\\-r|\\b(?:and|cmp|eq|ge|gt|le|lt|ne|not|or|xor)"
            }, {
                token : "comment",
                regex : "#.*$"
            }, {
                token : "lparen",
                regex : "[[({]"
            }, {
                token : "rparen",
                regex : "[\\])}]"
            }, {
                token : "text",
                regex : "\\s+"
            }
        ],
        "qqstring" : [
            {
                token : "string",
                regex : '(?:(?:\\\\.)|(?:[^"\\\\]))*?"',
                next : "start"
            }, {
                token : "string",
                regex : '.+'
            }
        ],
        "qstring" : [
            {
                token : "string",
                regex : "(?:(?:\\\\.)|(?:[^'\\\\]))*?'",
                next : "start"
            }, {
                token : "string",
                regex : '.+'
            }
        ],
        "block_comment": [
            {
                token: "comment.doc", 
                regex: "^=cut\\b",
                next: "start"
            },
            {
                defaultToken: "comment.doc"
            }
        ]
    };
};

oop.inherits(PerlHighlightRules, TextHighlightRules);

exports.PerlHighlightRules = PerlHighlightRules;
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

ace.define("ace/mode/json_highlight_rules",["require","exports","module","ace/lib/oop","ace/mode/text_highlight_rules"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../lib/oop");
var TextHighlightRules = acequire("./text_highlight_rules").TextHighlightRules;

var JsonHighlightRules = function() {
    this.$rules = {
        "start" : [
            {
                token : "variable", // single line
                regex : '["](?:(?:\\\\.)|(?:[^"\\\\]))*?["]\\s*(?=:)'
            }, {
                token : "string", // single line
                regex : '"',
                next  : "string"
            }, {
                token : "constant.numeric", // hex
                regex : "0[xX][0-9a-fA-F]+\\b"
            }, {
                token : "constant.numeric", // float
                regex : "[+-]?\\d+(?:(?:\\.\\d*)?(?:[eE][+-]?\\d+)?)?\\b"
            }, {
                token : "constant.language.boolean",
                regex : "(?:true|false)\\b"
            }, {
                token : "text", // single quoted strings are not allowed
                regex : "['](?:(?:\\\\.)|(?:[^'\\\\]))*?[']"
            }, {
                token : "comment", // comments are not allowed, but who cares?
                regex : "\\/\\/.*$"
            }, {
                token : "comment.start", // comments are not allowed, but who cares?
                regex : "\\/\\*",
                next  : "comment"
            }, {
                token : "paren.lparen",
                regex : "[[({]"
            }, {
                token : "paren.rparen",
                regex : "[\\])}]"
            }, {
                token : "text",
                regex : "\\s+"
            }
        ],
        "string" : [
            {
                token : "constant.language.escape",
                regex : /\\(?:x[0-9a-fA-F]{2}|u[0-9a-fA-F]{4}|["\\\/bfnrt])/
            }, {
                token : "string",
                regex : '"|$',
                next  : "start"
            }, {
                defaultToken : "string"
            }
        ],
        "comment" : [
            {
                token : "comment.end", // comments are not allowed, but who cares?
                regex : "\\*\\/",
                next  : "start"
            }, {
                defaultToken: "comment"
            }
        ]
    };
    
};

oop.inherits(JsonHighlightRules, TextHighlightRules);

exports.JsonHighlightRules = JsonHighlightRules;
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

ace.define("ace/mode/pgsql_highlight_rules",["require","exports","module","ace/lib/oop","ace/lib/lang","ace/mode/doc_comment_highlight_rules","ace/mode/text_highlight_rules","ace/mode/perl_highlight_rules","ace/mode/python_highlight_rules","ace/mode/json_highlight_rules","ace/mode/javascript_highlight_rules"], function(acequire, exports, module) {

var oop = acequire("../lib/oop");
var lang = acequire("../lib/lang");
var DocCommentHighlightRules = acequire("./doc_comment_highlight_rules").DocCommentHighlightRules;
var TextHighlightRules = acequire("./text_highlight_rules").TextHighlightRules;
var PerlHighlightRules = acequire("./perl_highlight_rules").PerlHighlightRules;
var PythonHighlightRules = acequire("./python_highlight_rules").PythonHighlightRules;
var JsonHighlightRules = acequire("./json_highlight_rules").JsonHighlightRules;
var JavaScriptHighlightRules = acequire("./javascript_highlight_rules").JavaScriptHighlightRules;

var PgsqlHighlightRules = function() {
    var keywords = (
        "abort|absolute|abstime|access|aclitem|action|add|admin|after|aggregate|all|also|alter|always|" +
        "analyse|analyze|and|any|anyarray|anyelement|anyenum|anynonarray|anyrange|array|as|asc|" +
        "assertion|assignment|asymmetric|at|attribute|authorization|backward|before|begin|between|" +
        "bigint|binary|bit|bool|boolean|both|box|bpchar|by|bytea|cache|called|cascade|cascaded|case|cast|" +
        "catalog|chain|char|character|characteristics|check|checkpoint|cid|cidr|circle|class|close|" +
        "cluster|coalesce|collate|collation|column|comment|comments|commit|committed|concurrently|" +
        "configuration|connection|constraint|constraints|content|continue|conversion|copy|cost|" +
        "create|cross|cstring|csv|current|current_catalog|current_date|current_role|" +
        "current_schema|current_time|current_timestamp|current_user|cursor|cycle|data|database|" +
        "date|daterange|day|deallocate|dec|decimal|declare|default|defaults|deferrable|deferred|" +
        "definer|delete|delimiter|delimiters|desc|dictionary|disable|discard|distinct|do|document|" +
        "domain|double|drop|each|else|enable|encoding|encrypted|end|enum|escape|event|event_trigger|" +
        "except|exclude|excluding|exclusive|execute|exists|explain|extension|external|extract|false|" +
        "family|fdw_handler|fetch|first|float|float4|float8|following|for|force|foreign|forward|" +
        "freeze|from|full|function|functions|global|grant|granted|greatest|group|gtsvector|handler|" +
        "having|header|hold|hour|identity|if|ilike|immediate|immutable|implicit|in|including|" +
        "increment|index|indexes|inet|inherit|inherits|initially|inline|inner|inout|input|" +
        "insensitive|insert|instead|int|int2|int2vector|int4|int4range|int8|int8range|integer|" +
        "internal|intersect|interval|into|invoker|is|isnull|isolation|join|json|key|label|language|" +
        "language_handler|large|last|lateral|lc_collate|lc_ctype|leading|leakproof|least|left|level|" +
        "like|limit|line|listen|load|local|localtime|localtimestamp|location|lock|lseg|macaddr|" +
        "mapping|match|materialized|maxvalue|minute|minvalue|mode|money|month|move|name|names|" +
        "national|natural|nchar|next|no|none|not|nothing|notify|notnull|nowait|null|nullif|nulls|" +
        "numeric|numrange|object|of|off|offset|oid|oids|oidvector|on|only|opaque|operator|option|" +
        "options|or|order|out|outer|over|overlaps|overlay|owned|owner|parser|partial|partition|passing|" +
        "password|path|pg_attribute|pg_auth_members|pg_authid|pg_class|pg_database|pg_node_tree|" +
        "pg_proc|pg_type|placing|plans|point|polygon|position|preceding|precision|prepare|prepared|" +
        "preserve|primary|prior|privileges|procedural|procedure|program|quote|range|read|real|" +
        "reassign|recheck|record|recursive|ref|refcursor|references|refresh|regclass|regconfig|" +
        "regdictionary|regoper|regoperator|regproc|regprocedure|regtype|reindex|relative|release|" +
        "reltime|rename|repeatable|replace|replica|reset|restart|restrict|returning|returns|revoke|" +
        "right|role|rollback|row|rows|rule|savepoint|schema|scroll|search|second|security|select|" +
        "sequence|sequences|serializable|server|session|session_user|set|setof|share|show|similar|" +
        "simple|smallint|smgr|snapshot|some|stable|standalone|start|statement|statistics|stdin|" +
        "stdout|storage|strict|strip|substring|symmetric|sysid|system|table|tables|tablespace|temp|" +
        "template|temporary|text|then|tid|time|timestamp|timestamptz|timetz|tinterval|to|trailing|" +
        "transaction|treat|trigger|trim|true|truncate|trusted|tsquery|tsrange|tstzrange|tsvector|" +
        "txid_snapshot|type|types|unbounded|uncommitted|unencrypted|union|unique|unknown|unlisten|" +
        "unlogged|until|update|user|using|uuid|vacuum|valid|validate|validator|value|values|varbit|" +
        "varchar|variadic|varying|verbose|version|view|void|volatile|when|where|whitespace|window|" +
        "with|without|work|wrapper|write|xid|xml|xmlattributes|xmlconcat|xmlelement|xmlexists|" +
        "xmlforest|xmlparse|xmlpi|xmlroot|xmlserialize|year|yes|zone"
    );


    var builtinFunctions = (
        "RI_FKey_cascade_del|RI_FKey_cascade_upd|RI_FKey_check_ins|RI_FKey_check_upd|" +
        "RI_FKey_noaction_del|RI_FKey_noaction_upd|RI_FKey_restrict_del|RI_FKey_restrict_upd|" +
        "RI_FKey_setdefault_del|RI_FKey_setdefault_upd|RI_FKey_setnull_del|" +
        "RI_FKey_setnull_upd|abbrev|abs|abstime|abstimeeq|abstimege|abstimegt|abstimein|abstimele|" +
        "abstimelt|abstimene|abstimeout|abstimerecv|abstimesend|aclcontains|acldefault|" +
        "aclexplode|aclinsert|aclitemeq|aclitemin|aclitemout|aclremove|acos|age|any_in|any_out|" +
        "anyarray_in|anyarray_out|anyarray_recv|anyarray_send|anyelement_in|anyelement_out|" +
        "anyenum_in|anyenum_out|anynonarray_in|anynonarray_out|anyrange_in|anyrange_out|" +
        "anytextcat|area|areajoinsel|areasel|array_agg|array_agg_finalfn|array_agg_transfn|" +
        "array_append|array_cat|array_dims|array_eq|array_fill|array_ge|array_gt|array_in|" +
        "array_larger|array_le|array_length|array_lower|array_lt|array_ndims|array_ne|array_out|" +
        "array_prepend|array_recv|array_remove|array_replace|array_send|array_smaller|" +
        "array_to_json|array_to_string|array_typanalyze|array_upper|arraycontained|" +
        "arraycontains|arraycontjoinsel|arraycontsel|arrayoverlap|ascii|ascii_to_mic|" +
        "ascii_to_utf8|asin|atan|atan2|avg|big5_to_euc_tw|big5_to_mic|big5_to_utf8|bit_and|bit_in|" +
        "bit_length|bit_or|bit_out|bit_recv|bit_send|bitand|bitcat|bitcmp|biteq|bitge|bitgt|bitle|" +
        "bitlt|bitne|bitnot|bitor|bitshiftleft|bitshiftright|bittypmodin|bittypmodout|bitxor|bool|" +
        "bool_and|bool_or|booland_statefunc|booleq|boolge|boolgt|boolin|boolle|boollt|boolne|" +
        "boolor_statefunc|boolout|boolrecv|boolsend|box|box_above|box_above_eq|box_add|box_below|" +
        "box_below_eq|box_center|box_contain|box_contain_pt|box_contained|box_distance|box_div|" +
        "box_eq|box_ge|box_gt|box_in|box_intersect|box_le|box_left|box_lt|box_mul|box_out|" +
        "box_overabove|box_overbelow|box_overlap|box_overleft|box_overright|box_recv|box_right|" +
        "box_same|box_send|box_sub|bpchar_larger|bpchar_pattern_ge|bpchar_pattern_gt|" +
        "bpchar_pattern_le|bpchar_pattern_lt|bpchar_smaller|bpcharcmp|bpchareq|bpcharge|" +
        "bpchargt|bpchariclike|bpcharicnlike|bpcharicregexeq|bpcharicregexne|bpcharin|bpcharle|" +
        "bpcharlike|bpcharlt|bpcharne|bpcharnlike|bpcharout|bpcharrecv|bpcharregexeq|" +
        "bpcharregexne|bpcharsend|bpchartypmodin|bpchartypmodout|broadcast|btabstimecmp|" +
        "btarraycmp|btbeginscan|btboolcmp|btbpchar_pattern_cmp|btbuild|btbuildempty|" +
        "btbulkdelete|btcanreturn|btcharcmp|btcostestimate|btendscan|btfloat48cmp|btfloat4cmp|" +
        "btfloat4sortsupport|btfloat84cmp|btfloat8cmp|btfloat8sortsupport|btgetbitmap|" +
        "btgettuple|btinsert|btint24cmp|btint28cmp|btint2cmp|btint2sortsupport|btint42cmp|" +
        "btint48cmp|btint4cmp|btint4sortsupport|btint82cmp|btint84cmp|btint8cmp|" +
        "btint8sortsupport|btmarkpos|btnamecmp|btnamesortsupport|btoidcmp|btoidsortsupport|" +
        "btoidvectorcmp|btoptions|btrecordcmp|btreltimecmp|btrescan|btrestrpos|btrim|" +
        "bttext_pattern_cmp|bttextcmp|bttidcmp|bttintervalcmp|btvacuumcleanup|" +
        "bytea_string_agg_finalfn|bytea_string_agg_transfn|byteacat|byteacmp|byteaeq|byteage|" +
        "byteagt|byteain|byteale|bytealike|bytealt|byteane|byteanlike|byteaout|bytearecv|byteasend|" +
        "cash_cmp|cash_div_cash|cash_div_flt4|cash_div_flt8|cash_div_int2|cash_div_int4|cash_eq|" +
        "cash_ge|cash_gt|cash_in|cash_le|cash_lt|cash_mi|cash_mul_flt4|cash_mul_flt8|" +
        "cash_mul_int2|cash_mul_int4|cash_ne|cash_out|cash_pl|cash_recv|cash_send|cash_words|" +
        "cashlarger|cashsmaller|cbrt|ceil|ceiling|center|char|char_length|character_length|chareq|" +
        "charge|chargt|charin|charle|charlt|charne|charout|charrecv|charsend|chr|cideq|cidin|cidout|" +
        "cidr|cidr_in|cidr_out|cidr_recv|cidr_send|cidrecv|cidsend|circle|circle_above|" +
        "circle_add_pt|circle_below|circle_center|circle_contain|circle_contain_pt|" +
        "circle_contained|circle_distance|circle_div_pt|circle_eq|circle_ge|circle_gt|circle_in|" +
        "circle_le|circle_left|circle_lt|circle_mul_pt|circle_ne|circle_out|circle_overabove|" +
        "circle_overbelow|circle_overlap|circle_overleft|circle_overright|circle_recv|" +
        "circle_right|circle_same|circle_send|circle_sub_pt|clock_timestamp|close_lb|close_ls|" +
        "close_lseg|close_pb|close_pl|close_ps|close_sb|close_sl|col_description|concat|concat_ws|" +
        "contjoinsel|contsel|convert|convert_from|convert_to|corr|cos|cot|count|covar_pop|" +
        "covar_samp|cstring_in|cstring_out|cstring_recv|cstring_send|cume_dist|current_database|" +
        "current_query|current_schema|current_schemas|current_setting|current_user|currtid|" +
        "currtid2|currval|cursor_to_xml|cursor_to_xmlschema|database_to_xml|" +
        "database_to_xml_and_xmlschema|database_to_xmlschema|date|date_cmp|date_cmp_timestamp|" +
        "date_cmp_timestamptz|date_eq|date_eq_timestamp|date_eq_timestamptz|date_ge|" +
        "date_ge_timestamp|date_ge_timestamptz|date_gt|date_gt_timestamp|date_gt_timestamptz|" +
        "date_in|date_larger|date_le|date_le_timestamp|date_le_timestamptz|date_lt|" +
        "date_lt_timestamp|date_lt_timestamptz|date_mi|date_mi_interval|date_mii|date_ne|" +
        "date_ne_timestamp|date_ne_timestamptz|date_out|date_part|date_pl_interval|date_pli|" +
        "date_recv|date_send|date_smaller|date_sortsupport|date_trunc|daterange|" +
        "daterange_canonical|daterange_subdiff|datetime_pl|datetimetz_pl|dcbrt|decode|degrees|" +
        "dense_rank|dexp|diagonal|diameter|dispell_init|dispell_lexize|dist_cpoly|dist_lb|dist_pb|" +
        "dist_pc|dist_pl|dist_ppath|dist_ps|dist_sb|dist_sl|div|dlog1|dlog10|domain_in|domain_recv|" +
        "dpow|dround|dsimple_init|dsimple_lexize|dsnowball_init|dsnowball_lexize|dsqrt|" +
        "dsynonym_init|dsynonym_lexize|dtrunc|elem_contained_by_range|encode|enum_cmp|enum_eq|" +
        "enum_first|enum_ge|enum_gt|enum_in|enum_larger|enum_last|enum_le|enum_lt|enum_ne|enum_out|" +
        "enum_range|enum_recv|enum_send|enum_smaller|eqjoinsel|eqsel|euc_cn_to_mic|" +
        "euc_cn_to_utf8|euc_jis_2004_to_shift_jis_2004|euc_jis_2004_to_utf8|euc_jp_to_mic|" +
        "euc_jp_to_sjis|euc_jp_to_utf8|euc_kr_to_mic|euc_kr_to_utf8|euc_tw_to_big5|" +
        "euc_tw_to_mic|euc_tw_to_utf8|event_trigger_in|event_trigger_out|every|exp|factorial|" +
        "family|fdw_handler_in|fdw_handler_out|first_value|float4|float48div|float48eq|float48ge|" +
        "float48gt|float48le|float48lt|float48mi|float48mul|float48ne|float48pl|float4_accum|" +
        "float4abs|float4div|float4eq|float4ge|float4gt|float4in|float4larger|float4le|float4lt|" +
        "float4mi|float4mul|float4ne|float4out|float4pl|float4recv|float4send|float4smaller|" +
        "float4um|float4up|float8|float84div|float84eq|float84ge|float84gt|float84le|float84lt|" +
        "float84mi|float84mul|float84ne|float84pl|float8_accum|float8_avg|float8_corr|" +
        "float8_covar_pop|float8_covar_samp|float8_regr_accum|float8_regr_avgx|" +
        "float8_regr_avgy|float8_regr_intercept|float8_regr_r2|float8_regr_slope|" +
        "float8_regr_sxx|float8_regr_sxy|float8_regr_syy|float8_stddev_pop|float8_stddev_samp|" +
        "float8_var_pop|float8_var_samp|float8abs|float8div|float8eq|float8ge|float8gt|float8in|" +
        "float8larger|float8le|float8lt|float8mi|float8mul|float8ne|float8out|float8pl|float8recv|" +
        "float8send|float8smaller|float8um|float8up|floor|flt4_mul_cash|flt8_mul_cash|" +
        "fmgr_c_validator|fmgr_internal_validator|fmgr_sql_validator|format|format_type|" +
        "gb18030_to_utf8|gbk_to_utf8|generate_series|generate_subscripts|get_bit|get_byte|" +
        "get_current_ts_config|getdatabaseencoding|getpgusername|gin_cmp_prefix|" +
        "gin_cmp_tslexeme|gin_extract_tsquery|gin_extract_tsvector|gin_tsquery_consistent|" +
        "ginarrayconsistent|ginarrayextract|ginbeginscan|ginbuild|ginbuildempty|ginbulkdelete|" +
        "gincostestimate|ginendscan|gingetbitmap|gininsert|ginmarkpos|ginoptions|" +
        "ginqueryarrayextract|ginrescan|ginrestrpos|ginvacuumcleanup|gist_box_compress|" +
        "gist_box_consistent|gist_box_decompress|gist_box_penalty|gist_box_picksplit|" +
        "gist_box_same|gist_box_union|gist_circle_compress|gist_circle_consistent|" +
        "gist_point_compress|gist_point_consistent|gist_point_distance|gist_poly_compress|" +
        "gist_poly_consistent|gistbeginscan|gistbuild|gistbuildempty|gistbulkdelete|" +
        "gistcostestimate|gistendscan|gistgetbitmap|gistgettuple|gistinsert|gistmarkpos|" +
        "gistoptions|gistrescan|gistrestrpos|gistvacuumcleanup|gtsquery_compress|" +
        "gtsquery_consistent|gtsquery_decompress|gtsquery_penalty|gtsquery_picksplit|" +
        "gtsquery_same|gtsquery_union|gtsvector_compress|gtsvector_consistent|" +
        "gtsvector_decompress|gtsvector_penalty|gtsvector_picksplit|gtsvector_same|" +
        "gtsvector_union|gtsvectorin|gtsvectorout|has_any_column_privilege|" +
        "has_column_privilege|has_database_privilege|has_foreign_data_wrapper_privilege|" +
        "has_function_privilege|has_language_privilege|has_schema_privilege|" +
        "has_sequence_privilege|has_server_privilege|has_table_privilege|" +
        "has_tablespace_privilege|has_type_privilege|hash_aclitem|hash_array|hash_numeric|" +
        "hash_range|hashbeginscan|hashbpchar|hashbuild|hashbuildempty|hashbulkdelete|hashchar|" +
        "hashcostestimate|hashendscan|hashenum|hashfloat4|hashfloat8|hashgetbitmap|hashgettuple|" +
        "hashinet|hashinsert|hashint2|hashint2vector|hashint4|hashint8|hashmacaddr|hashmarkpos|" +
        "hashname|hashoid|hashoidvector|hashoptions|hashrescan|hashrestrpos|hashtext|" +
        "hashvacuumcleanup|hashvarlena|height|host|hostmask|iclikejoinsel|iclikesel|" +
        "icnlikejoinsel|icnlikesel|icregexeqjoinsel|icregexeqsel|icregexnejoinsel|icregexnesel|" +
        "inet_client_addr|inet_client_port|inet_in|inet_out|inet_recv|inet_send|" +
        "inet_server_addr|inet_server_port|inetand|inetmi|inetmi_int8|inetnot|inetor|inetpl|" +
        "initcap|int2|int24div|int24eq|int24ge|int24gt|int24le|int24lt|int24mi|int24mul|int24ne|" +
        "int24pl|int28div|int28eq|int28ge|int28gt|int28le|int28lt|int28mi|int28mul|int28ne|int28pl|" +
        "int2_accum|int2_avg_accum|int2_mul_cash|int2_sum|int2abs|int2and|int2div|int2eq|int2ge|" +
        "int2gt|int2in|int2larger|int2le|int2lt|int2mi|int2mod|int2mul|int2ne|int2not|int2or|int2out|" +
        "int2pl|int2recv|int2send|int2shl|int2shr|int2smaller|int2um|int2up|int2vectoreq|" +
        "int2vectorin|int2vectorout|int2vectorrecv|int2vectorsend|int2xor|int4|int42div|int42eq|" +
        "int42ge|int42gt|int42le|int42lt|int42mi|int42mul|int42ne|int42pl|int48div|int48eq|int48ge|" +
        "int48gt|int48le|int48lt|int48mi|int48mul|int48ne|int48pl|int4_accum|int4_avg_accum|" +
        "int4_mul_cash|int4_sum|int4abs|int4and|int4div|int4eq|int4ge|int4gt|int4in|int4inc|" +
        "int4larger|int4le|int4lt|int4mi|int4mod|int4mul|int4ne|int4not|int4or|int4out|int4pl|" +
        "int4range|int4range_canonical|int4range_subdiff|int4recv|int4send|int4shl|int4shr|" +
        "int4smaller|int4um|int4up|int4xor|int8|int82div|int82eq|int82ge|int82gt|int82le|int82lt|" +
        "int82mi|int82mul|int82ne|int82pl|int84div|int84eq|int84ge|int84gt|int84le|int84lt|int84mi|" +
        "int84mul|int84ne|int84pl|int8_accum|int8_avg|int8_avg_accum|int8_sum|int8abs|int8and|" +
        "int8div|int8eq|int8ge|int8gt|int8in|int8inc|int8inc_any|int8inc_float8_float8|int8larger|" +
        "int8le|int8lt|int8mi|int8mod|int8mul|int8ne|int8not|int8or|int8out|int8pl|int8pl_inet|" +
        "int8range|int8range_canonical|int8range_subdiff|int8recv|int8send|int8shl|int8shr|" +
        "int8smaller|int8um|int8up|int8xor|integer_pl_date|inter_lb|inter_sb|inter_sl|internal_in|" +
        "internal_out|interval_accum|interval_avg|interval_cmp|interval_div|interval_eq|" +
        "interval_ge|interval_gt|interval_hash|interval_in|interval_larger|interval_le|" +
        "interval_lt|interval_mi|interval_mul|interval_ne|interval_out|interval_pl|" +
        "interval_pl_date|interval_pl_time|interval_pl_timestamp|interval_pl_timestamptz|" +
        "interval_pl_timetz|interval_recv|interval_send|interval_smaller|interval_transform|" +
        "interval_um|intervaltypmodin|intervaltypmodout|intinterval|isclosed|isempty|isfinite|" +
        "ishorizontal|iso8859_1_to_utf8|iso8859_to_utf8|iso_to_koi8r|iso_to_mic|iso_to_win1251|" +
        "iso_to_win866|isopen|isparallel|isperp|isvertical|johab_to_utf8|json_agg|" +
        "json_agg_finalfn|json_agg_transfn|json_array_element|json_array_element_text|" +
        "json_array_elements|json_array_length|json_each|json_each_text|json_extract_path|" +
        "json_extract_path_op|json_extract_path_text|json_extract_path_text_op|json_in|" +
        "json_object_field|json_object_field_text|json_object_keys|json_out|" +
        "json_populate_record|json_populate_recordset|json_recv|json_send|justify_days|" +
        "justify_hours|justify_interval|koi8r_to_iso|koi8r_to_mic|koi8r_to_utf8|" +
        "koi8r_to_win1251|koi8r_to_win866|koi8u_to_utf8|lag|language_handler_in|" +
        "language_handler_out|last_value|lastval|latin1_to_mic|latin2_to_mic|latin2_to_win1250|" +
        "latin3_to_mic|latin4_to_mic|lead|left|length|like|like_escape|likejoinsel|likesel|line|" +
        "line_distance|line_eq|line_horizontal|line_in|line_interpt|line_intersect|line_out|" +
        "line_parallel|line_perp|line_recv|line_send|line_vertical|ln|lo_close|lo_creat|lo_create|" +
        "lo_export|lo_import|lo_lseek|lo_lseek64|lo_open|lo_tell|lo_tell64|lo_truncate|" +
        "lo_truncate64|lo_unlink|log|loread|lower|lower_inc|lower_inf|lowrite|lpad|lseg|lseg_center|" +
        "lseg_distance|lseg_eq|lseg_ge|lseg_gt|lseg_horizontal|lseg_in|lseg_interpt|" +
        "lseg_intersect|lseg_le|lseg_length|lseg_lt|lseg_ne|lseg_out|lseg_parallel|lseg_perp|" +
        "lseg_recv|lseg_send|lseg_vertical|ltrim|macaddr_and|macaddr_cmp|macaddr_eq|macaddr_ge|" +
        "macaddr_gt|macaddr_in|macaddr_le|macaddr_lt|macaddr_ne|macaddr_not|macaddr_or|" +
        "macaddr_out|macaddr_recv|macaddr_send|makeaclitem|masklen|max|md5|mic_to_ascii|" +
        "mic_to_big5|mic_to_euc_cn|mic_to_euc_jp|mic_to_euc_kr|mic_to_euc_tw|mic_to_iso|" +
        "mic_to_koi8r|mic_to_latin1|mic_to_latin2|mic_to_latin3|mic_to_latin4|mic_to_sjis|" +
        "mic_to_win1250|mic_to_win1251|mic_to_win866|min|mktinterval|mod|money|mul_d_interval|" +
        "name|nameeq|namege|namegt|nameiclike|nameicnlike|nameicregexeq|nameicregexne|namein|" +
        "namele|namelike|namelt|namene|namenlike|nameout|namerecv|nameregexeq|nameregexne|namesend|" +
        "neqjoinsel|neqsel|netmask|network|network_cmp|network_eq|network_ge|network_gt|" +
        "network_le|network_lt|network_ne|network_sub|network_subeq|network_sup|network_supeq|" +
        "nextval|nlikejoinsel|nlikesel|notlike|now|npoints|nth_value|ntile|numeric_abs|" +
        "numeric_accum|numeric_add|numeric_avg|numeric_avg_accum|numeric_cmp|numeric_div|" +
        "numeric_div_trunc|numeric_eq|numeric_exp|numeric_fac|numeric_ge|numeric_gt|numeric_in|" +
        "numeric_inc|numeric_larger|numeric_le|numeric_ln|numeric_log|numeric_lt|numeric_mod|" +
        "numeric_mul|numeric_ne|numeric_out|numeric_power|numeric_recv|numeric_send|" +
        "numeric_smaller|numeric_sqrt|numeric_stddev_pop|numeric_stddev_samp|numeric_sub|" +
        "numeric_transform|numeric_uminus|numeric_uplus|numeric_var_pop|numeric_var_samp|" +
        "numerictypmodin|numerictypmodout|numnode|numrange|numrange_subdiff|obj_description|" +
        "octet_length|oid|oideq|oidge|oidgt|oidin|oidlarger|oidle|oidlt|oidne|oidout|oidrecv|oidsend|" +
        "oidsmaller|oidvectoreq|oidvectorge|oidvectorgt|oidvectorin|oidvectorle|oidvectorlt|" +
        "oidvectorne|oidvectorout|oidvectorrecv|oidvectorsend|oidvectortypes|on_pb|on_pl|" +
        "on_ppath|on_ps|on_sb|on_sl|opaque_in|opaque_out|overlaps|overlay|path|path_add|path_add_pt|" +
        "path_center|path_contain_pt|path_distance|path_div_pt|path_in|path_inter|path_length|" +
        "path_mul_pt|path_n_eq|path_n_ge|path_n_gt|path_n_le|path_n_lt|path_npoints|path_out|" +
        "path_recv|path_send|path_sub_pt|pclose|percent_rank|pg_advisory_lock|" +
        "pg_advisory_lock_shared|pg_advisory_unlock|pg_advisory_unlock_all|" +
        "pg_advisory_unlock_shared|pg_advisory_xact_lock|pg_advisory_xact_lock_shared|" +
        "pg_available_extension_versions|pg_available_extensions|pg_backend_pid|" +
        "pg_backup_start_time|pg_cancel_backend|pg_char_to_encoding|pg_client_encoding|" +
        "pg_collation_for|pg_collation_is_visible|pg_column_is_updatable|pg_column_size|" +
        "pg_conf_load_time|pg_conversion_is_visible|pg_create_restore_point|" +
        "pg_current_xlog_insert_location|pg_current_xlog_location|pg_cursor|pg_database_size|" +
        "pg_describe_object|pg_encoding_max_length|pg_encoding_to_char|" +
        "pg_event_trigger_dropped_objects|pg_export_snapshot|pg_extension_config_dump|" +
        "pg_extension_update_paths|pg_function_is_visible|pg_get_constraintdef|pg_get_expr|" +
        "pg_get_function_arguments|pg_get_function_identity_arguments|" +
        "pg_get_function_result|pg_get_functiondef|pg_get_indexdef|pg_get_keywords|" +
        "pg_get_multixact_members|pg_get_ruledef|pg_get_serial_sequence|pg_get_triggerdef|" +
        "pg_get_userbyid|pg_get_viewdef|pg_has_role|pg_identify_object|pg_indexes_size|" +
        "pg_is_in_backup|pg_is_in_recovery|pg_is_other_temp_schema|pg_is_xlog_replay_paused|" +
        "pg_last_xact_replay_timestamp|pg_last_xlog_receive_location|" +
        "pg_last_xlog_replay_location|pg_listening_channels|pg_lock_status|pg_ls_dir|" +
        "pg_my_temp_schema|pg_node_tree_in|pg_node_tree_out|pg_node_tree_recv|" +
        "pg_node_tree_send|pg_notify|pg_opclass_is_visible|pg_operator_is_visible|" +
        "pg_opfamily_is_visible|pg_options_to_table|pg_postmaster_start_time|" +
        "pg_prepared_statement|pg_prepared_xact|pg_read_binary_file|pg_read_file|" +
        "pg_relation_filenode|pg_relation_filepath|pg_relation_is_updatable|pg_relation_size|" +
        "pg_reload_conf|pg_rotate_logfile|pg_sequence_parameters|pg_show_all_settings|" +
        "pg_size_pretty|pg_sleep|pg_start_backup|pg_stat_clear_snapshot|pg_stat_file|" +
        "pg_stat_get_activity|pg_stat_get_analyze_count|pg_stat_get_autoanalyze_count|" +
        "pg_stat_get_autovacuum_count|pg_stat_get_backend_activity|" +
        "pg_stat_get_backend_activity_start|pg_stat_get_backend_client_addr|" +
        "pg_stat_get_backend_client_port|pg_stat_get_backend_dbid|pg_stat_get_backend_idset|" +
        "pg_stat_get_backend_pid|pg_stat_get_backend_start|pg_stat_get_backend_userid|" +
        "pg_stat_get_backend_waiting|pg_stat_get_backend_xact_start|" +
        "pg_stat_get_bgwriter_buf_written_checkpoints|" +
        "pg_stat_get_bgwriter_buf_written_clean|pg_stat_get_bgwriter_maxwritten_clean|" +
        "pg_stat_get_bgwriter_requested_checkpoints|pg_stat_get_bgwriter_stat_reset_time|" +
        "pg_stat_get_bgwriter_timed_checkpoints|pg_stat_get_blocks_fetched|" +
        "pg_stat_get_blocks_hit|pg_stat_get_buf_alloc|pg_stat_get_buf_fsync_backend|" +
        "pg_stat_get_buf_written_backend|pg_stat_get_checkpoint_sync_time|" +
        "pg_stat_get_checkpoint_write_time|pg_stat_get_db_blk_read_time|" +
        "pg_stat_get_db_blk_write_time|pg_stat_get_db_blocks_fetched|" +
        "pg_stat_get_db_blocks_hit|pg_stat_get_db_conflict_all|" +
        "pg_stat_get_db_conflict_bufferpin|pg_stat_get_db_conflict_lock|" +
        "pg_stat_get_db_conflict_snapshot|pg_stat_get_db_conflict_startup_deadlock|" +
        "pg_stat_get_db_conflict_tablespace|pg_stat_get_db_deadlocks|" +
        "pg_stat_get_db_numbackends|pg_stat_get_db_stat_reset_time|" +
        "pg_stat_get_db_temp_bytes|pg_stat_get_db_temp_files|pg_stat_get_db_tuples_deleted|" +
        "pg_stat_get_db_tuples_fetched|pg_stat_get_db_tuples_inserted|" +
        "pg_stat_get_db_tuples_returned|pg_stat_get_db_tuples_updated|" +
        "pg_stat_get_db_xact_commit|pg_stat_get_db_xact_rollback|pg_stat_get_dead_tuples|" +
        "pg_stat_get_function_calls|pg_stat_get_function_self_time|" +
        "pg_stat_get_function_total_time|pg_stat_get_last_analyze_time|" +
        "pg_stat_get_last_autoanalyze_time|pg_stat_get_last_autovacuum_time|" +
        "pg_stat_get_last_vacuum_time|pg_stat_get_live_tuples|pg_stat_get_numscans|" +
        "pg_stat_get_tuples_deleted|pg_stat_get_tuples_fetched|" +
        "pg_stat_get_tuples_hot_updated|pg_stat_get_tuples_inserted|" +
        "pg_stat_get_tuples_returned|pg_stat_get_tuples_updated|pg_stat_get_vacuum_count|" +
        "pg_stat_get_wal_senders|pg_stat_get_xact_blocks_fetched|" +
        "pg_stat_get_xact_blocks_hit|pg_stat_get_xact_function_calls|" +
        "pg_stat_get_xact_function_self_time|pg_stat_get_xact_function_total_time|" +
        "pg_stat_get_xact_numscans|pg_stat_get_xact_tuples_deleted|" +
        "pg_stat_get_xact_tuples_fetched|pg_stat_get_xact_tuples_hot_updated|" +
        "pg_stat_get_xact_tuples_inserted|pg_stat_get_xact_tuples_returned|" +
        "pg_stat_get_xact_tuples_updated|pg_stat_reset|pg_stat_reset_shared|" +
        "pg_stat_reset_single_function_counters|pg_stat_reset_single_table_counters|" +
        "pg_stop_backup|pg_switch_xlog|pg_table_is_visible|pg_table_size|" +
        "pg_tablespace_databases|pg_tablespace_location|pg_tablespace_size|" +
        "pg_terminate_backend|pg_timezone_abbrevs|pg_timezone_names|pg_total_relation_size|" +
        "pg_trigger_depth|pg_try_advisory_lock|pg_try_advisory_lock_shared|" +
        "pg_try_advisory_xact_lock|pg_try_advisory_xact_lock_shared|pg_ts_config_is_visible|" +
        "pg_ts_dict_is_visible|pg_ts_parser_is_visible|pg_ts_template_is_visible|" +
        "pg_type_is_visible|pg_typeof|pg_xlog_location_diff|pg_xlog_replay_pause|" +
        "pg_xlog_replay_resume|pg_xlogfile_name|pg_xlogfile_name_offset|pi|plainto_tsquery|" +
        "plpgsql_call_handler|plpgsql_inline_handler|plpgsql_validator|point|point_above|" +
        "point_add|point_below|point_distance|point_div|point_eq|point_horiz|point_in|point_left|" +
        "point_mul|point_ne|point_out|point_recv|point_right|point_send|point_sub|point_vert|" +
        "poly_above|poly_below|poly_center|poly_contain|poly_contain_pt|poly_contained|" +
        "poly_distance|poly_in|poly_left|poly_npoints|poly_out|poly_overabove|poly_overbelow|" +
        "poly_overlap|poly_overleft|poly_overright|poly_recv|poly_right|poly_same|poly_send|" +
        "polygon|popen|position|positionjoinsel|positionsel|postgresql_fdw_validator|pow|power|" +
        "prsd_end|prsd_headline|prsd_lextype|prsd_nexttoken|prsd_start|pt_contained_circle|" +
        "pt_contained_poly|query_to_xml|query_to_xml_and_xmlschema|query_to_xmlschema|" +
        "querytree|quote_ident|quote_literal|quote_nullable|radians|radius|random|range_adjacent|" +
        "range_after|range_before|range_cmp|range_contained_by|range_contains|" +
        "range_contains_elem|range_eq|range_ge|range_gist_compress|range_gist_consistent|" +
        "range_gist_decompress|range_gist_penalty|range_gist_picksplit|range_gist_same|" +
        "range_gist_union|range_gt|range_in|range_intersect|range_le|range_lt|range_minus|" +
        "range_ne|range_out|range_overlaps|range_overleft|range_overright|range_recv|range_send|" +
        "range_typanalyze|range_union|rangesel|rank|record_eq|record_ge|record_gt|record_in|" +
        "record_le|record_lt|record_ne|record_out|record_recv|record_send|regclass|regclassin|" +
        "regclassout|regclassrecv|regclasssend|regconfigin|regconfigout|regconfigrecv|" +
        "regconfigsend|regdictionaryin|regdictionaryout|regdictionaryrecv|regdictionarysend|" +
        "regexeqjoinsel|regexeqsel|regexnejoinsel|regexnesel|regexp_matches|regexp_replace|" +
        "regexp_split_to_array|regexp_split_to_table|regoperatorin|regoperatorout|" +
        "regoperatorrecv|regoperatorsend|regoperin|regoperout|regoperrecv|regopersend|" +
        "regprocedurein|regprocedureout|regprocedurerecv|regproceduresend|regprocin|regprocout|" +
        "regprocrecv|regprocsend|regr_avgx|regr_avgy|regr_count|regr_intercept|regr_r2|" +
        "regr_slope|regr_sxx|regr_sxy|regr_syy|regtypein|regtypeout|regtyperecv|regtypesend|" +
        "reltime|reltimeeq|reltimege|reltimegt|reltimein|reltimele|reltimelt|reltimene|reltimeout|" +
        "reltimerecv|reltimesend|repeat|replace|reverse|right|round|row_number|row_to_json|rpad|" +
        "rtrim|scalargtjoinsel|scalargtsel|scalarltjoinsel|scalarltsel|schema_to_xml|" +
        "schema_to_xml_and_xmlschema|schema_to_xmlschema|session_user|set_bit|set_byte|" +
        "set_config|set_masklen|setseed|setval|setweight|shell_in|shell_out|" +
        "shift_jis_2004_to_euc_jis_2004|shift_jis_2004_to_utf8|shobj_description|sign|" +
        "similar_escape|sin|sjis_to_euc_jp|sjis_to_mic|sjis_to_utf8|slope|smgreq|smgrin|smgrne|" +
        "smgrout|spg_kd_choose|spg_kd_config|spg_kd_inner_consistent|spg_kd_picksplit|" +
        "spg_quad_choose|spg_quad_config|spg_quad_inner_consistent|spg_quad_leaf_consistent|" +
        "spg_quad_picksplit|spg_range_quad_choose|spg_range_quad_config|" +
        "spg_range_quad_inner_consistent|spg_range_quad_leaf_consistent|" +
        "spg_range_quad_picksplit|spg_text_choose|spg_text_config|spg_text_inner_consistent|" +
        "spg_text_leaf_consistent|spg_text_picksplit|spgbeginscan|spgbuild|spgbuildempty|" +
        "spgbulkdelete|spgcanreturn|spgcostestimate|spgendscan|spggetbitmap|spggettuple|" +
        "spginsert|spgmarkpos|spgoptions|spgrescan|spgrestrpos|spgvacuumcleanup|split_part|sqrt|" +
        "statement_timestamp|stddev|stddev_pop|stddev_samp|string_agg|string_agg_finalfn|" +
        "string_agg_transfn|string_to_array|strip|strpos|substr|substring|sum|" +
        "suppress_redundant_updates_trigger|table_to_xml|table_to_xml_and_xmlschema|" +
        "table_to_xmlschema|tan|text|text_ge|text_gt|text_larger|text_le|text_lt|text_pattern_ge|" +
        "text_pattern_gt|text_pattern_le|text_pattern_lt|text_smaller|textanycat|textcat|texteq|" +
        "texticlike|texticnlike|texticregexeq|texticregexne|textin|textlen|textlike|textne|" +
        "textnlike|textout|textrecv|textregexeq|textregexne|textsend|thesaurus_init|" +
        "thesaurus_lexize|tideq|tidge|tidgt|tidin|tidlarger|tidle|tidlt|tidne|tidout|tidrecv|tidsend|" +
        "tidsmaller|time_cmp|time_eq|time_ge|time_gt|time_hash|time_in|time_larger|time_le|time_lt|" +
        "time_mi_interval|time_mi_time|time_ne|time_out|time_pl_interval|time_recv|time_send|" +
        "time_smaller|time_transform|timedate_pl|timemi|timenow|timeofday|timepl|timestamp_cmp|" +
        "timestamp_cmp_date|timestamp_cmp_timestamptz|timestamp_eq|timestamp_eq_date|" +
        "timestamp_eq_timestamptz|timestamp_ge|timestamp_ge_date|timestamp_ge_timestamptz|" +
        "timestamp_gt|timestamp_gt_date|timestamp_gt_timestamptz|timestamp_hash|timestamp_in|" +
        "timestamp_larger|timestamp_le|timestamp_le_date|timestamp_le_timestamptz|" +
        "timestamp_lt|timestamp_lt_date|timestamp_lt_timestamptz|timestamp_mi|" +
        "timestamp_mi_interval|timestamp_ne|timestamp_ne_date|timestamp_ne_timestamptz|" +
        "timestamp_out|timestamp_pl_interval|timestamp_recv|timestamp_send|timestamp_smaller|" +
        "timestamp_sortsupport|timestamp_transform|timestamptypmodin|timestamptypmodout|" +
        "timestamptz_cmp|timestamptz_cmp_date|timestamptz_cmp_timestamp|timestamptz_eq|" +
        "timestamptz_eq_date|timestamptz_eq_timestamp|timestamptz_ge|timestamptz_ge_date|" +
        "timestamptz_ge_timestamp|timestamptz_gt|timestamptz_gt_date|" +
        "timestamptz_gt_timestamp|timestamptz_in|timestamptz_larger|timestamptz_le|" +
        "timestamptz_le_date|timestamptz_le_timestamp|timestamptz_lt|timestamptz_lt_date|" +
        "timestamptz_lt_timestamp|timestamptz_mi|timestamptz_mi_interval|timestamptz_ne|" +
        "timestamptz_ne_date|timestamptz_ne_timestamp|timestamptz_out|" +
        "timestamptz_pl_interval|timestamptz_recv|timestamptz_send|timestamptz_smaller|" +
        "timestamptztypmodin|timestamptztypmodout|timetypmodin|timetypmodout|timetz_cmp|" +
        "timetz_eq|timetz_ge|timetz_gt|timetz_hash|timetz_in|timetz_larger|timetz_le|timetz_lt|" +
        "timetz_mi_interval|timetz_ne|timetz_out|timetz_pl_interval|timetz_recv|timetz_send|" +
        "timetz_smaller|timetzdate_pl|timetztypmodin|timetztypmodout|timezone|tinterval|" +
        "tintervalct|tintervalend|tintervaleq|tintervalge|tintervalgt|tintervalin|tintervalle|" +
        "tintervalleneq|tintervallenge|tintervallengt|tintervallenle|tintervallenlt|" +
        "tintervallenne|tintervallt|tintervalne|tintervalout|tintervalov|tintervalrecv|" +
        "tintervalrel|tintervalsame|tintervalsend|tintervalstart|to_ascii|to_char|to_date|to_hex|" +
        "to_json|to_number|to_timestamp|to_tsquery|to_tsvector|transaction_timestamp|translate|" +
        "trigger_in|trigger_out|trunc|ts_debug|ts_headline|ts_lexize|ts_match_qv|ts_match_tq|" +
        "ts_match_tt|ts_match_vq|ts_parse|ts_rank|ts_rank_cd|ts_rewrite|ts_stat|ts_token_type|" +
        "ts_typanalyze|tsmatchjoinsel|tsmatchsel|tsq_mcontained|tsq_mcontains|tsquery_and|" +
        "tsquery_cmp|tsquery_eq|tsquery_ge|tsquery_gt|tsquery_le|tsquery_lt|tsquery_ne|" +
        "tsquery_not|tsquery_or|tsqueryin|tsqueryout|tsqueryrecv|tsquerysend|tsrange|" +
        "tsrange_subdiff|tstzrange|tstzrange_subdiff|tsvector_cmp|tsvector_concat|tsvector_eq|" +
        "tsvector_ge|tsvector_gt|tsvector_le|tsvector_lt|tsvector_ne|tsvector_update_trigger|" +
        "tsvector_update_trigger_column|tsvectorin|tsvectorout|tsvectorrecv|tsvectorsend|" +
        "txid_current|txid_current_snapshot|txid_snapshot_in|txid_snapshot_out|" +
        "txid_snapshot_recv|txid_snapshot_send|txid_snapshot_xip|txid_snapshot_xmax|" +
        "txid_snapshot_xmin|txid_visible_in_snapshot|uhc_to_utf8|unique_key_recheck|unknownin|" +
        "unknownout|unknownrecv|unknownsend|unnest|upper|upper_inc|upper_inf|utf8_to_ascii|" +
        "utf8_to_big5|utf8_to_euc_cn|utf8_to_euc_jis_2004|utf8_to_euc_jp|utf8_to_euc_kr|" +
        "utf8_to_euc_tw|utf8_to_gb18030|utf8_to_gbk|utf8_to_iso8859|utf8_to_iso8859_1|" +
        "utf8_to_johab|utf8_to_koi8r|utf8_to_koi8u|utf8_to_shift_jis_2004|utf8_to_sjis|" +
        "utf8_to_uhc|utf8_to_win|uuid_cmp|uuid_eq|uuid_ge|uuid_gt|uuid_hash|uuid_in|uuid_le|" +
        "uuid_lt|uuid_ne|uuid_out|uuid_recv|uuid_send|var_pop|var_samp|varbit_in|varbit_out|" +
        "varbit_recv|varbit_send|varbit_transform|varbitcmp|varbiteq|varbitge|varbitgt|varbitle|" +
        "varbitlt|varbitne|varbittypmodin|varbittypmodout|varchar_transform|varcharin|" +
        "varcharout|varcharrecv|varcharsend|varchartypmodin|varchartypmodout|variance|version|" +
        "void_in|void_out|void_recv|void_send|width|width_bucket|win1250_to_latin2|" +
        "win1250_to_mic|win1251_to_iso|win1251_to_koi8r|win1251_to_mic|win1251_to_win866|" +
        "win866_to_iso|win866_to_koi8r|win866_to_mic|win866_to_win1251|win_to_utf8|xideq|" +
        "xideqint4|xidin|xidout|xidrecv|xidsend|xml|xml_in|xml_is_well_formed|" +
        "xml_is_well_formed_content|xml_is_well_formed_document|xml_out|xml_recv|xml_send|" +
        "xmlagg|xmlcomment|xmlconcat2|xmlexists|xmlvalidate|xpath|xpath_exists"
    );

    var keywordMapper = this.createKeywordMapper({
        "support.function": builtinFunctions,
        "keyword": keywords
    }, "identifier", true);


    var sqlRules = [{
            token : "string", // single line string -- assume dollar strings if multi-line for now
            regex : "['](?:(?:\\\\.)|(?:[^'\\\\]))*?[']"
        }, {
            token : "variable.language", // pg identifier
            regex : '".*?"'
        }, {
            token : "constant.numeric", // float
            regex : "[+-]?\\d+(?:(?:\\.\\d*)?(?:[eE][+-]?\\d+)?)?\\b"
        }, {
            token : keywordMapper,
            regex : "[a-zA-Z_][a-zA-Z0-9_$]*\\b" // TODO - Unicode in identifiers
        }, {
            token : "keyword.operator",
            regex : "!|!!|!~|!~\\*|!~~|!~~\\*|#|##|#<|#<=|#<>|#=|#>|#>=|%|\\&|\\&\\&|\\&<|\\&<\\||\\&>|\\*|\\+|" +
                    "\\-|/|<|<#>|<\\->|<<|<<=|<<\\||<=|<>|<\\?>|<@|<\\^|=|>|>=|>>|>>=|>\\^|\\?#|\\?\\-|\\?\\-\\||" +
                    "\\?\\||\\?\\|\\||@|@\\-@|@>|@@|@@@|\\^|\\||\\|\\&>|\\|/|\\|>>|\\|\\||\\|\\|/|~|~\\*|~<=~|~<~|" +
                    "~=|~>=~|~>~|~~|~~\\*"
        }, {
            token : "paren.lparen",
            regex : "[\\(]"
        }, {
            token : "paren.rparen",
            regex : "[\\)]"
        }, {
            token : "text",
            regex : "\\s+"
        }
    ];


    this.$rules = {
        "start" : [{
                token : "comment",
                regex : "--.*$"
            },
            DocCommentHighlightRules.getStartRule("doc-start"),
            {
                token : "comment", // multi-line comment
                regex : "\\/\\*",
                next : "comment"
            },{
                token : "keyword.statementBegin",
                regex : "[a-zA-Z]+", // Could enumerate starting keywords but this allows things to work when new statements are added.
                next : "statement"
            },{
                token : "support.buildin", // psql directive
                regex : "^\\\\[\\S]+.*$"
            }
        ],

        "statement" : [{
                token : "comment",
                regex : "--.*$"
            }, {
                token : "comment", // multi-line comment
                regex : "\\/\\*",
                next : "commentStatement"
            }, {
                token : "statementEnd",
                regex : ";",
                next : "start"
            }, {
                token : "string",
                regex : "\\$perl\\$",
                next : "perl-start"
            }, {
                token : "string",
                regex : "\\$python\\$",
                next : "python-start"
            }, {
                token : "string",
                regex : "\\$json\\$",
                next : "json-start"
            }, {
                token : "string",
                regex : "\\$(js|javascript)\\$",
                next : "javascript-start"
            }, {
                token : "string",
                regex : "\\$[\\w_0-9]*\\$$", // dollar quote at the end of a line
                next : "dollarSql"
            }, {
                token : "string",
                regex : "\\$[\\w_0-9]*\\$",
                next : "dollarStatementString"
            }
        ].concat(sqlRules),

        "dollarSql" : [{
                token : "comment",
                regex : "--.*$"
            }, {
                token : "comment", // multi-line comment
                regex : "\\/\\*",
                next : "commentDollarSql"
            }, {
                token : "string", // end quoting with dollar at the start of a line
                regex : "^\\$[\\w_0-9]*\\$",
                next : "statement"
            }, {
                token : "string",
                regex : "\\$[\\w_0-9]*\\$",
                next : "dollarSqlString"
            }
        ].concat(sqlRules),

        "comment" : [{
                token : "comment", // closing comment
                regex : "\\*\\/",
                next : "start"
            }, {
                defaultToken : "comment"
            }
        ],

        "commentStatement" : [{
                token : "comment", // closing comment
                regex : "\\*\\/",
                next : "statement"
            }, {
                defaultToken : "comment"
            }
        ],

        "commentDollarSql" : [{
                token : "comment", // closing comment
                regex : "\\*\\/",
                next : "dollarSql"
            }, {
                defaultToken : "comment"
            }
        ],

        "dollarStatementString" : [{
                token : "string", // closing dollarstring
                regex : ".*?\\$[\\w_0-9]*\\$",
                next : "statement"
            }, {
                token : "string", // dollarstring spanning whole line
                regex : ".+"
            }
        ],

        "dollarSqlString" : [{
                token : "string", // closing dollarstring
                regex : ".*?\\$[\\w_0-9]*\\$",
                next : "dollarSql"
            }, {
                token : "string", // dollarstring spanning whole line
                regex : ".+"
            }
        ]
    };

    this.embedRules(DocCommentHighlightRules, "doc-", [ DocCommentHighlightRules.getEndRule("start") ]);
    this.embedRules(PerlHighlightRules, "perl-", [{token : "string", regex : "\\$perl\\$", next : "statement"}]);
    this.embedRules(PythonHighlightRules, "python-", [{token : "string", regex : "\\$python\\$", next : "statement"}]);
    this.embedRules(JsonHighlightRules, "json-", [{token : "string", regex : "\\$json\\$", next : "statement"}]);
    this.embedRules(JavaScriptHighlightRules, "javascript-", [{token : "string", regex : "\\$(js|javascript)\\$", next : "statement"}]);
};

oop.inherits(PgsqlHighlightRules, TextHighlightRules);

exports.PgsqlHighlightRules = PgsqlHighlightRules;
});

ace.define("ace/mode/pgsql",["require","exports","module","ace/lib/oop","ace/mode/text","ace/mode/pgsql_highlight_rules"], function(acequire, exports, module) {

var oop = acequire("../lib/oop");
var TextMode = acequire("../mode/text").Mode;
var PgsqlHighlightRules = acequire("./pgsql_highlight_rules").PgsqlHighlightRules;

var Mode = function() {
    this.HighlightRules = PgsqlHighlightRules;
    this.$behaviour = this.$defaultBehaviour;
};
oop.inherits(Mode, TextMode);

(function() {
    this.lineCommentStart = "--";
    this.blockComment = {start: "/*", end: "*/"};

    this.getNextLineIndent = function(state, line, tab) { 
        if (state == "start" || state == "keyword.statementEnd") {
            return "";
        } else {
            return this.$getIndent(line); // Keep whatever indent the previous line has
        }
    };

    this.$id = "ace/mode/pgsql";
}).call(Mode.prototype);

exports.Mode = Mode;
});
