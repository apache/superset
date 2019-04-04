ace.define("ace/mode/ruby_highlight_rules",["require","exports","module","ace/lib/oop","ace/mode/text_highlight_rules"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../lib/oop");
var TextHighlightRules = acequire("./text_highlight_rules").TextHighlightRules;
var constantOtherSymbol = exports.constantOtherSymbol = {
    token : "constant.other.symbol.ruby", // symbol
    regex : "[:](?:[A-Za-z_]|[@$](?=[a-zA-Z0-9_]))[a-zA-Z0-9_]*[!=?]?"
};

var qString = exports.qString = {
    token : "string", // single line
    regex : "['](?:(?:\\\\.)|(?:[^'\\\\]))*?[']"
};

var qqString = exports.qqString = {
    token : "string", // single line
    regex : '["](?:(?:\\\\.)|(?:[^"\\\\]))*?["]'
};

var tString = exports.tString = {
    token : "string", // backtick string
    regex : "[`](?:(?:\\\\.)|(?:[^'\\\\]))*?[`]"
};

var constantNumericHex = exports.constantNumericHex = {
    token : "constant.numeric", // hex
    regex : "0[xX][0-9a-fA-F](?:[0-9a-fA-F]|_(?=[0-9a-fA-F]))*\\b"
};

var constantNumericFloat = exports.constantNumericFloat = {
    token : "constant.numeric", // float
    regex : "[+-]?\\d(?:\\d|_(?=\\d))*(?:(?:\\.\\d(?:\\d|_(?=\\d))*)?(?:[eE][+-]?\\d+)?)?\\b"
};

var instanceVariable = exports.instanceVariable = {
    token : "variable.instance", // instance variable
    regex : "@{1,2}[a-zA-Z_\\d]+"
};

var RubyHighlightRules = function() {

    var builtinFunctions = (
        "abort|Array|assert|assert_equal|assert_not_equal|assert_same|assert_not_same|" +
        "assert_nil|assert_not_nil|assert_match|assert_no_match|assert_in_delta|assert_throws|" +
        "assert_raise|assert_nothing_raised|assert_instance_of|assert_kind_of|assert_respond_to|" +
        "assert_operator|assert_send|assert_difference|assert_no_difference|assert_recognizes|" +
        "assert_generates|assert_response|assert_redirected_to|assert_template|assert_select|" +
        "assert_select_email|assert_select_rjs|assert_select_encoded|css_select|at_exit|" +
        "attr|attr_writer|attr_reader|attr_accessor|attr_accessible|autoload|binding|block_given?|callcc|" +
        "caller|catch|chomp|chomp!|chop|chop!|defined?|delete_via_redirect|eval|exec|exit|" +
        "exit!|fail|Float|flunk|follow_redirect!|fork|form_for|form_tag|format|gets|global_variables|gsub|" +
        "gsub!|get_via_redirect|host!|https?|https!|include|Integer|lambda|link_to|" +
        "link_to_unless_current|link_to_function|link_to_remote|load|local_variables|loop|open|open_session|" +
        "p|print|printf|proc|putc|puts|post_via_redirect|put_via_redirect|raise|rand|" +
        "raw|readline|readlines|redirect?|request_via_redirect|acequire|scan|select|" +
        "set_trace_func|sleep|split|sprintf|srand|String|stylesheet_link_tag|syscall|system|sub|sub!|test|" +
        "throw|trace_var|trap|untrace_var|atan2|cos|exp|frexp|ldexp|log|log10|sin|sqrt|tan|" +
        "render|javascript_include_tag|csrf_meta_tag|label_tag|text_field_tag|submit_tag|check_box_tag|" +
        "content_tag|radio_button_tag|text_area_tag|password_field_tag|hidden_field_tag|" +
        "fields_for|select_tag|options_for_select|options_from_collection_for_select|collection_select|" +
        "time_zone_select|select_date|select_time|select_datetime|date_select|time_select|datetime_select|" +
        "select_year|select_month|select_day|select_hour|select_minute|select_second|file_field_tag|" +
        "file_field|respond_to|skip_before_filter|around_filter|after_filter|verify|" +
        "protect_from_forgery|rescue_from|helper_method|redirect_to|before_filter|" +
        "send_data|send_file|validates_presence_of|validates_uniqueness_of|validates_length_of|" +
        "validates_format_of|validates_acceptance_of|validates_associated|validates_exclusion_of|" +
        "validates_inclusion_of|validates_numericality_of|validates_with|validates_each|" +
        "authenticate_or_request_with_http_basic|authenticate_or_request_with_http_digest|" +
        "filter_parameter_logging|match|get|post|resources|redirect|scope|assert_routing|" +
        "translate|localize|extract_locale_from_tld|caches_page|expire_page|caches_action|expire_action|" +
        "cache|expire_fragment|expire_cache_for|observe|cache_sweeper|" +
        "has_many|has_one|belongs_to|has_and_belongs_to_many"
    );

    var keywords = (
        "alias|and|BEGIN|begin|break|case|class|def|defined|do|else|elsif|END|end|ensure|" +
        "__FILE__|finally|for|gem|if|in|__LINE__|module|next|not|or|private|protected|public|" +
        "redo|rescue|retry|return|super|then|undef|unless|until|when|while|yield"
    );

    var buildinConstants = (
        "true|TRUE|false|FALSE|nil|NIL|ARGF|ARGV|DATA|ENV|RUBY_PLATFORM|RUBY_RELEASE_DATE|" +
        "RUBY_VERSION|STDERR|STDIN|STDOUT|TOPLEVEL_BINDING"
    );

    var builtinVariables = (
        "$DEBUG|$defout|$FILENAME|$LOAD_PATH|$SAFE|$stdin|$stdout|$stderr|$VERBOSE|" +
        "$!|root_url|flash|session|cookies|params|request|response|logger|self"
    );

    var keywordMapper = this.$keywords = this.createKeywordMapper({
        "keyword": keywords,
        "constant.language": buildinConstants,
        "variable.language": builtinVariables,
        "support.function": builtinFunctions,
        "invalid.deprecated": "debugger" // TODO is this a remnant from js mode?
    }, "identifier");

    this.$rules = {
        "start" : [
            {
                token : "comment",
                regex : "#.*$"
            }, {
                token : "comment", // multi line comment
                regex : "^=begin(?:$|\\s.*$)",
                next : "comment"
            }, {
                token : "string.regexp",
                regex : "[/](?:(?:\\[(?:\\\\]|[^\\]])+\\])|(?:\\\\/|[^\\]/]))*[/]\\w*\\s*(?=[).,;]|$)"
            },

            [{
                regex: "[{}]", onMatch: function(val, state, stack) {
                    this.next = val == "{" ? this.nextState : "";
                    if (val == "{" && stack.length) {
                        stack.unshift("start", state);
                        return "paren.lparen";
                    }
                    if (val == "}" && stack.length) {
                        stack.shift();
                        this.next = stack.shift();
                        if (this.next.indexOf("string") != -1)
                            return "paren.end";
                    }
                    return val == "{" ? "paren.lparen" : "paren.rparen";
                },
                nextState: "start"
            }, {
                token : "string.start",
                regex : /"/,
                push  : [{
                    token : "constant.language.escape",
                    regex : /\\(?:[nsrtvfbae'"\\]|c.|C-.|M-.(?:\\C-.)?|[0-7]{3}|x[\da-fA-F]{2}|u[\da-fA-F]{4})/
                }, {
                    token : "paren.start",
                    regex : /#{/,
                    push  : "start"
                }, {
                    token : "string.end",
                    regex : /"/,
                    next  : "pop"
                }, {
                    defaultToken: "string"
                }]
            }, {
                token : "string.start",
                regex : /`/,
                push  : [{
                    token : "constant.language.escape",
                    regex : /\\(?:[nsrtvfbae'"\\]|c.|C-.|M-.(?:\\C-.)?|[0-7]{3}|x[\da-fA-F]{2}|u[\da-fA-F]{4})/
                }, {
                    token : "paren.start",
                    regex : /#{/,
                    push  : "start"
                }, {
                    token : "string.end",
                    regex : /`/,
                    next  : "pop"
                }, {
                    defaultToken: "string"
                }]
            }, {
                token : "string.start",
                regex : /'/,
                push  : [{
                    token : "constant.language.escape",
                    regex : /\\['\\]/
                },  {
                    token : "string.end",
                    regex : /'/,
                    next  : "pop"
                }, {
                    defaultToken: "string"
                }]
            }],

            {
                token : "text", // namespaces aren't symbols
                regex : "::"
            }, {
                token : "variable.instance", // instance variable
                regex : "@{1,2}[a-zA-Z_\\d]+"
            }, {
                token : "support.class", // class name
                regex : "[A-Z][a-zA-Z_\\d]+"
            },

            constantOtherSymbol,
            constantNumericHex,
            constantNumericFloat,

            {
                token : "constant.language.boolean",
                regex : "(?:true|false)\\b"
            }, {
                token : keywordMapper,
                regex : "[a-zA-Z_$][a-zA-Z0-9_$]*\\b"
            }, {
                token : "punctuation.separator.key-value",
                regex : "=>"
            }, {
                stateName: "heredoc",
                onMatch : function(value, currentState, stack) {
                    var next = value[2] == '-' ? "indentedHeredoc" : "heredoc";
                    var tokens = value.split(this.splitRegex);
                    stack.push(next, tokens[3]);
                    return [
                        {type:"constant", value: tokens[1]},
                        {type:"string", value: tokens[2]},
                        {type:"support.class", value: tokens[3]},
                        {type:"string", value: tokens[4]}
                    ];
                },
                regex : "(<<-?)(['\"`]?)([\\w]+)(['\"`]?)",
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
                        regex: "^ +"
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
               token : "string.character",
               regex : "\\B\\?."
            }, {
                token : "keyword.operator",
                regex : "!|\\$|%|&|\\*|\\-\\-|\\-|\\+\\+|\\+|~|===|==|=|!=|!==|<=|>=|<<=|>>=|>>>=|<>|<|>|!|&&|\\|\\||\\?\\:|\\*=|%=|\\+=|\\-=|&=|\\^=|\\b(?:in|instanceof|new|delete|typeof|void)"
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
        "comment" : [
            {
                token : "comment", // closing comment
                regex : "^=end(?:$|\\s.*$)",
                next : "start"
            }, {
                token : "comment", // comment spanning whole line
                regex : ".+"
            }
        ]
    };

    this.normalizeRules();
};

oop.inherits(RubyHighlightRules, TextHighlightRules);

exports.RubyHighlightRules = RubyHighlightRules;
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

ace.define("ace/mode/ruby",["require","exports","module","ace/lib/oop","ace/mode/text","ace/mode/ruby_highlight_rules","ace/mode/matching_brace_outdent","ace/range","ace/mode/behaviour/cstyle","ace/mode/folding/coffee"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../lib/oop");
var TextMode = acequire("./text").Mode;
var RubyHighlightRules = acequire("./ruby_highlight_rules").RubyHighlightRules;
var MatchingBraceOutdent = acequire("./matching_brace_outdent").MatchingBraceOutdent;
var Range = acequire("../range").Range;
var CstyleBehaviour = acequire("./behaviour/cstyle").CstyleBehaviour;
var FoldMode = acequire("./folding/coffee").FoldMode;

var Mode = function() {
    this.HighlightRules = RubyHighlightRules;
    this.$outdent = new MatchingBraceOutdent();
    this.$behaviour = new CstyleBehaviour();
    this.foldingRules = new FoldMode();
};
oop.inherits(Mode, TextMode);

(function() {


    this.lineCommentStart = "#";

    this.getNextLineIndent = function(state, line, tab) {
        var indent = this.$getIndent(line);

        var tokenizedLine = this.getTokenizer().getLineTokens(line, state);
        var tokens = tokenizedLine.tokens;

        if (tokens.length && tokens[tokens.length-1].type == "comment") {
            return indent;
        }

        if (state == "start") {
            var match = line.match(/^.*[\{\(\[]\s*$/);
            var startingClassOrMethod = line.match(/^\s*(class|def|module)\s.*$/);
            var startingDoBlock = line.match(/.*do(\s*|\s+\|.*\|\s*)$/);
            var startingConditional = line.match(/^\s*(if|else|when)\s*/);
            if (match || startingClassOrMethod || startingDoBlock || startingConditional) {
                indent += tab;
            }
        }

        return indent;
    };

    this.checkOutdent = function(state, line, input) {
        return /^\s+(end|else)$/.test(line + input) || this.$outdent.checkOutdent(line, input);
    };

    this.autoOutdent = function(state, session, row) {
        var line = session.getLine(row);
        if (/}/.test(line))
            return this.$outdent.autoOutdent(session, row);
        var indent = this.$getIndent(line);
        var prevLine = session.getLine(row - 1);
        var prevIndent = this.$getIndent(prevLine);
        var tab = session.getTabString();
        if (prevIndent.length <= indent.length) {
            if (indent.slice(-tab.length) == tab)
                session.remove(new Range(row, indent.length-tab.length, row, indent.length));
        }
    };

    this.$id = "ace/mode/ruby";
}).call(Mode.prototype);

exports.Mode = Mode;
});
