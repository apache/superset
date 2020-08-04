ace.define("ace/mode/ocaml_highlight_rules",["require","exports","module","ace/lib/oop","ace/mode/text_highlight_rules"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../lib/oop");
var TextHighlightRules = acequire("./text_highlight_rules").TextHighlightRules;

var OcamlHighlightRules = function() {

    var keywords = (
        "and|as|assert|begin|class|constraint|do|done|downto|else|end|"  +
        "exception|external|for|fun|function|functor|if|in|include|"     +
        "inherit|initializer|lazy|let|match|method|module|mutable|new|"  +
        "object|of|open|or|private|rec|sig|struct|then|to|try|type|val|" +
        "virtual|when|while|with"
    );

    var builtinConstants = ("true|false");

    var builtinFunctions = (
        "abs|abs_big_int|abs_float|abs_num|abstract_tag|accept|access|acos|add|" +
        "add_available_units|add_big_int|add_buffer|add_channel|add_char|" +
        "add_initializer|add_int_big_int|add_interfaces|add_num|add_string|" +
        "add_substitute|add_substring|alarm|allocated_bytes|allow_only|" +
        "allow_unsafe_modules|always|append|appname_get|appname_set|" +
        "approx_num_exp|approx_num_fix|arg|argv|arith_status|array|" +
        "array1_of_genarray|array2_of_genarray|array3_of_genarray|asin|asr|" +
        "assoc|assq|at_exit|atan|atan2|auto_synchronize|background|basename|" +
        "beginning_of_input|big_int_of_int|big_int_of_num|big_int_of_string|bind|" +
        "bind_class|bind_tag|bits|bits_of_float|black|blit|blit_image|blue|bool|" +
        "bool_of_string|bounded_full_split|bounded_split|bounded_split_delim|" +
        "bprintf|break|broadcast|bscanf|button_down|c_layout|capitalize|cardinal|" +
        "cardinal|catch|catch_break|ceil|ceiling_num|channel|char|char_of_int|" +
        "chdir|check|check_suffix|chmod|choose|chop_extension|chop_suffix|chown|" +
        "chown|chr|chroot|classify_float|clear|clear_available_units|" +
        "clear_close_on_exec|clear_graph|clear_nonblock|clear_parser|" +
        "close|close|closeTk|close_box|close_graph|close_in|close_in_noerr|" +
        "close_out|close_out_noerr|close_process|close_process|" +
        "close_process_full|close_process_in|close_process_out|close_subwindow|" +
        "close_tag|close_tbox|closedir|closedir|closure_tag|code|combine|" +
        "combine|combine|command|compact|compare|compare_big_int|compare_num|" +
        "complex32|complex64|concat|conj|connect|contains|contains_from|contents|" +
        "copy|cos|cosh|count|count|counters|create|create_alarm|create_image|" +
        "create_matrix|create_matrix|create_matrix|create_object|" +
        "create_object_and_run_initializers|create_object_opt|create_process|" +
        "create_process|create_process_env|create_process_env|create_table|" +
        "current|current_dir_name|current_point|current_x|current_y|curveto|" +
        "custom_tag|cyan|data_size|decr|decr_num|default_available_units|delay|" +
        "delete_alarm|descr_of_in_channel|descr_of_out_channel|destroy|diff|dim|" +
        "dim1|dim2|dim3|dims|dirname|display_mode|div|div_big_int|div_num|" +
        "double_array_tag|double_tag|draw_arc|draw_char|draw_circle|draw_ellipse|" +
        "draw_image|draw_poly|draw_poly_line|draw_rect|draw_segments|draw_string|" +
        "dummy_pos|dummy_table|dump_image|dup|dup2|elements|empty|end_of_input|" +
        "environment|eprintf|epsilon_float|eq_big_int|eq_num|equal|err_formatter|" +
        "error_message|escaped|establish_server|executable_name|execv|execve|execvp|" +
        "execvpe|exists|exists2|exit|exp|failwith|fast_sort|fchmod|fchown|field|" +
        "file|file_exists|fill|fill_arc|fill_circle|fill_ellipse|fill_poly|fill_rect|" +
        "filter|final_tag|finalise|find|find_all|first_chars|firstkey|flatten|" +
        "float|float32|float64|float_of_big_int|float_of_bits|float_of_int|" +
        "float_of_num|float_of_string|floor|floor_num|flush|flush_all|flush_input|" +
        "flush_str_formatter|fold|fold_left|fold_left2|fold_right|fold_right2|" +
        "for_all|for_all2|force|force_newline|force_val|foreground|fork|" +
        "format_of_string|formatter_of_buffer|formatter_of_out_channel|" +
        "fortran_layout|forward_tag|fprintf|frexp|from|from_channel|from_file|" +
        "from_file_bin|from_function|from_string|fscanf|fst|fstat|ftruncate|" +
        "full_init|full_major|full_split|gcd_big_int|ge_big_int|ge_num|" +
        "genarray_of_array1|genarray_of_array2|genarray_of_array3|get|" +
        "get_all_formatter_output_functions|get_approx_printing|get_copy|" +
        "get_ellipsis_text|get_error_when_null_denominator|get_floating_precision|" +
        "get_formatter_output_functions|get_formatter_tag_functions|get_image|" +
        "get_margin|get_mark_tags|get_max_boxes|get_max_indent|get_method|" +
        "get_method_label|get_normalize_ratio|get_normalize_ratio_when_printing|" +
        "get_print_tags|get_state|get_variable|getcwd|getegid|getegid|getenv|" +
        "getenv|getenv|geteuid|geteuid|getgid|getgid|getgrgid|getgrgid|getgrnam|" +
        "getgrnam|getgroups|gethostbyaddr|gethostbyname|gethostname|getitimer|" +
        "getlogin|getpeername|getpid|getppid|getprotobyname|getprotobynumber|" +
        "getpwnam|getpwuid|getservbyname|getservbyport|getsockname|getsockopt|" +
        "getsockopt_float|getsockopt_int|getsockopt_optint|gettimeofday|getuid|" +
        "global_replace|global_substitute|gmtime|green|grid|group_beginning|" +
        "group_end|gt_big_int|gt_num|guard|handle_unix_error|hash|hash_param|" +
        "hd|header_size|i|id|ignore|in_channel_length|in_channel_of_descr|incr|" +
        "incr_num|index|index_from|inet_addr_any|inet_addr_of_string|infinity|" +
        "infix_tag|init|init_class|input|input_binary_int|input_byte|input_char|" +
        "input_line|input_value|int|int16_signed|int16_unsigned|int32|int64|" +
        "int8_signed|int8_unsigned|int_of_big_int|int_of_char|int_of_float|" +
        "int_of_num|int_of_string|integer_num|inter|interactive|inv|invalid_arg|" +
        "is_block|is_empty|is_implicit|is_int|is_int_big_int|is_integer_num|" +
        "is_relative|iter|iter2|iteri|join|junk|key_pressed|kill|kind|kprintf|" +
        "kscanf|land|last_chars|layout|lazy_from_fun|lazy_from_val|lazy_is_val|" +
        "lazy_tag|ldexp|le_big_int|le_num|length|lexeme|lexeme_char|lexeme_end|" +
        "lexeme_end_p|lexeme_start|lexeme_start_p|lineto|link|list|listen|lnot|" +
        "loadfile|loadfile_private|localtime|lock|lockf|log|log10|logand|lognot|" +
        "logor|logxor|lor|lower_window|lowercase|lseek|lsl|lsr|lstat|lt_big_int|" +
        "lt_num|lxor|magenta|magic|mainLoop|major|major_slice|make|make_formatter|" +
        "make_image|make_lexer|make_matrix|make_self_init|map|map2|map_file|mapi|" +
        "marshal|match_beginning|match_end|matched_group|matched_string|max|" +
        "max_array_length|max_big_int|max_elt|max_float|max_int|max_num|" +
        "max_string_length|mem|mem_assoc|mem_assq|memq|merge|min|min_big_int|" +
        "min_elt|min_float|min_int|min_num|minor|minus_big_int|minus_num|" +
        "minus_one|mkdir|mkfifo|mktime|mod|mod_big_int|mod_float|mod_num|modf|" +
        "mouse_pos|moveto|mul|mult_big_int|mult_int_big_int|mult_num|nan|narrow|" +
        "nat_of_num|nativeint|neg|neg_infinity|new_block|new_channel|new_method|" +
        "new_variable|next|nextkey|nice|nice|no_scan_tag|norm|norm2|not|npeek|" +
        "nth|nth_dim|num_digits_big_int|num_dims|num_of_big_int|num_of_int|" +
        "num_of_nat|num_of_ratio|num_of_string|O|obj|object_tag|ocaml_version|" +
        "of_array|of_channel|of_float|of_int|of_int32|of_list|of_nativeint|" +
        "of_string|one|openTk|open_box|open_connection|open_graph|open_hbox|" +
        "open_hovbox|open_hvbox|open_in|open_in_bin|open_in_gen|open_out|" +
        "open_out_bin|open_out_gen|open_process|open_process_full|open_process_in|" +
        "open_process_out|open_subwindow|open_tag|open_tbox|open_temp_file|" +
        "open_vbox|opendbm|opendir|openfile|or|os_type|out_channel_length|" +
        "out_channel_of_descr|output|output_binary_int|output_buffer|output_byte|" +
        "output_char|output_string|output_value|over_max_boxes|pack|params|" +
        "parent_dir_name|parse|parse_argv|partition|pause|peek|pipe|pixels|" +
        "place|plot|plots|point_color|polar|poll|pop|pos_in|pos_out|pow|" +
        "power_big_int_positive_big_int|power_big_int_positive_int|" +
        "power_int_positive_big_int|power_int_positive_int|power_num|" +
        "pp_close_box|pp_close_tag|pp_close_tbox|pp_force_newline|" +
        "pp_get_all_formatter_output_functions|pp_get_ellipsis_text|" +
        "pp_get_formatter_output_functions|pp_get_formatter_tag_functions|" +
        "pp_get_margin|pp_get_mark_tags|pp_get_max_boxes|pp_get_max_indent|" +
        "pp_get_print_tags|pp_open_box|pp_open_hbox|pp_open_hovbox|pp_open_hvbox|" +
        "pp_open_tag|pp_open_tbox|pp_open_vbox|pp_over_max_boxes|pp_print_as|" +
        "pp_print_bool|pp_print_break|pp_print_char|pp_print_cut|pp_print_float|" +
        "pp_print_flush|pp_print_if_newline|pp_print_int|pp_print_newline|" +
        "pp_print_space|pp_print_string|pp_print_tab|pp_print_tbreak|" +
        "pp_set_all_formatter_output_functions|pp_set_ellipsis_text|" +
        "pp_set_formatter_out_channel|pp_set_formatter_output_functions|" +
        "pp_set_formatter_tag_functions|pp_set_margin|pp_set_mark_tags|" +
        "pp_set_max_boxes|pp_set_max_indent|pp_set_print_tags|pp_set_tab|" +
        "pp_set_tags|pred|pred_big_int|pred_num|prerr_char|prerr_endline|" +
        "prerr_float|prerr_int|prerr_newline|prerr_string|print|print_as|" +
        "print_bool|print_break|print_char|print_cut|print_endline|print_float|" +
        "print_flush|print_if_newline|print_int|print_newline|print_space|" +
        "print_stat|print_string|print_tab|print_tbreak|printf|prohibit|" +
        "public_method_label|push|putenv|quo_num|quomod_big_int|quote|raise|" +
        "raise_window|ratio_of_num|rcontains_from|read|read_float|read_int|" +
        "read_key|read_line|readdir|readdir|readlink|really_input|receive|recv|" +
        "recvfrom|red|ref|regexp|regexp_case_fold|regexp_string|" +
        "regexp_string_case_fold|register|register_exception|rem|remember_mode|" +
        "remove|remove_assoc|remove_assq|rename|replace|replace_first|" +
        "replace_matched|repr|reset|reshape|reshape_1|reshape_2|reshape_3|rev|" +
        "rev_append|rev_map|rev_map2|rewinddir|rgb|rhs_end|rhs_end_pos|rhs_start|" +
        "rhs_start_pos|rindex|rindex_from|rlineto|rmdir|rmoveto|round_num|" +
        "run_initializers|run_initializers_opt|scanf|search_backward|" +
        "search_forward|seek_in|seek_out|select|self|self_init|send|sendto|set|" +
        "set_all_formatter_output_functions|set_approx_printing|" +
        "set_binary_mode_in|set_binary_mode_out|set_close_on_exec|" +
        "set_close_on_exec|set_color|set_ellipsis_text|" +
        "set_error_when_null_denominator|set_field|set_floating_precision|" +
        "set_font|set_formatter_out_channel|set_formatter_output_functions|" +
        "set_formatter_tag_functions|set_line_width|set_margin|set_mark_tags|" +
        "set_max_boxes|set_max_indent|set_method|set_nonblock|set_nonblock|" +
        "set_normalize_ratio|set_normalize_ratio_when_printing|set_print_tags|" +
        "set_signal|set_state|set_tab|set_tag|set_tags|set_text_size|" +
        "set_window_title|setgid|setgid|setitimer|setitimer|setsid|setsid|" +
        "setsockopt|setsockopt|setsockopt_float|setsockopt_float|setsockopt_int|" +
        "setsockopt_int|setsockopt_optint|setsockopt_optint|setuid|setuid|" +
        "shift_left|shift_left|shift_left|shift_right|shift_right|shift_right|" +
        "shift_right_logical|shift_right_logical|shift_right_logical|show_buckets|" +
        "shutdown|shutdown|shutdown_connection|shutdown_connection|sigabrt|" +
        "sigalrm|sigchld|sigcont|sigfpe|sighup|sigill|sigint|sigkill|sign_big_int|" +
        "sign_num|signal|signal|sigpending|sigpending|sigpipe|sigprocmask|" +
        "sigprocmask|sigprof|sigquit|sigsegv|sigstop|sigsuspend|sigsuspend|" +
        "sigterm|sigtstp|sigttin|sigttou|sigusr1|sigusr2|sigvtalrm|sin|singleton|" +
        "sinh|size|size|size_x|size_y|sleep|sleep|sleep|slice_left|slice_left|" +
        "slice_left_1|slice_left_2|slice_right|slice_right|slice_right_1|" +
        "slice_right_2|snd|socket|socket|socket|socketpair|socketpair|sort|sound|" +
        "split|split_delim|sprintf|sprintf|sqrt|sqrt|sqrt_big_int|square_big_int|" +
        "square_num|sscanf|stable_sort|stable_sort|stable_sort|stable_sort|stable_sort|" +
        "stable_sort|stat|stat|stat|stat|stat|stats|stats|std_formatter|stdbuf|" +
        "stderr|stderr|stderr|stdib|stdin|stdin|stdin|stdout|stdout|stdout|" +
        "str_formatter|string|string_after|string_before|string_match|" +
        "string_of_big_int|string_of_bool|string_of_float|string_of_format|" +
        "string_of_inet_addr|string_of_inet_addr|string_of_int|string_of_num|" +
        "string_partial_match|string_tag|sub|sub|sub_big_int|sub_left|sub_num|" +
        "sub_right|subset|subset|substitute_first|substring|succ|succ|" +
        "succ|succ|succ_big_int|succ_num|symbol_end|symbol_end_pos|symbol_start|" +
        "symbol_start_pos|symlink|symlink|sync|synchronize|system|system|system|" +
        "tag|take|tan|tanh|tcdrain|tcdrain|tcflow|tcflow|tcflush|tcflush|" +
        "tcgetattr|tcgetattr|tcsendbreak|tcsendbreak|tcsetattr|tcsetattr|" +
        "temp_file|text_size|time|time|time|timed_read|timed_write|times|times|" +
        "tl|tl|tl|to_buffer|to_channel|to_float|to_hex|to_int|to_int32|to_list|" +
        "to_list|to_list|to_nativeint|to_string|to_string|to_string|to_string|" +
        "to_string|top|top|total_size|transfer|transp|truncate|truncate|truncate|" +
        "truncate|truncate|truncate|try_lock|umask|umask|uncapitalize|uncapitalize|" +
        "uncapitalize|union|union|unit_big_int|unlink|unlink|unlock|unmarshal|" +
        "unsafe_blit|unsafe_fill|unsafe_get|unsafe_get|unsafe_set|unsafe_set|" +
        "update|uppercase|uppercase|uppercase|uppercase|usage|utimes|utimes|wait|" +
        "wait|wait|wait|wait_next_event|wait_pid|wait_read|wait_signal|" +
        "wait_timed_read|wait_timed_write|wait_write|waitpid|white|" +
        "widen|window_id|word_size|wrap|wrap_abort|write|yellow|yield|zero|zero_big_int|" +

        "Arg|Arith_status|Array|Array1|Array2|Array3|ArrayLabels|Big_int|Bigarray|" +
        "Buffer|Callback|CamlinternalOO|Char|Complex|Condition|Dbm|Digest|Dynlink|" +
        "Event|Filename|Format|Gc|Genarray|Genlex|Graphics|GraphicsX11|Hashtbl|" +
        "Int32|Int64|LargeFile|Lazy|Lexing|List|ListLabels|Make|Map|Marshal|" +
        "MoreLabels|Mutex|Nativeint|Num|Obj|Oo|Parsing|Pervasives|Printexc|" +
        "Printf|Queue|Random|Scanf|Scanning|Set|Sort|Stack|State|StdLabels|Str|" +
        "Stream|String|StringLabels|Sys|Thread|ThreadUnix|Tk|Unix|UnixLabels|Weak"
    );

    var keywordMapper = this.createKeywordMapper({
        "variable.language": "this",
        "keyword": keywords,
        "constant.language": builtinConstants,
        "support.function": builtinFunctions
    }, "identifier");

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

    this.$rules = {
        "start" : [
            {
                token : "comment",
                regex : '\\(\\*.*?\\*\\)\\s*?$'
            },
            {
                token : "comment",
                regex : '\\(\\*.*',
                next : "comment"
            },
            {
                token : "string", // single line
                regex : '["](?:(?:\\\\.)|(?:[^"\\\\]))*?["]'
            },
            {
                token : "string", // single char
                regex : "'.'"
            },
            {
                token : "string", // " string
                regex : '"',
                next  : "qstring"
            },
            {
                token : "constant.numeric", // imaginary
                regex : "(?:" + floatNumber + "|\\d+)[jJ]\\b"
            },
            {
                token : "constant.numeric", // float
                regex : floatNumber
            },
            {
                token : "constant.numeric", // integer
                regex : integer + "\\b"
            },
            {
                token : keywordMapper,
                regex : "[a-zA-Z_$][a-zA-Z0-9_$]*\\b"
            },
            {
                token : "keyword.operator",
                regex : "\\+\\.|\\-\\.|\\*\\.|\\/\\.|#|;;|\\+|\\-|\\*|\\*\\*\\/|\\/\\/|%|<<|>>|&|\\||\\^|~|<|>|<=|=>|==|!=|<>|<-|="
            },
            {
                token : "paren.lparen",
                regex : "[[({]"
            },
            {
                token : "paren.rparen",
                regex : "[\\])}]"
            },
            {
                token : "text",
                regex : "\\s+"
            }
        ],
        "comment" : [
            {
                token : "comment", // closing comment
                regex : "\\*\\)",
                next : "start"
            },
            {
                defaultToken : "comment"
            }
        ],

        "qstring" : [
            {
                token : "string",
                regex : '"',
                next : "start"
            }, {
                token : "string",
                regex : '.+'
            }
        ]
    };
};

oop.inherits(OcamlHighlightRules, TextHighlightRules);

exports.OcamlHighlightRules = OcamlHighlightRules;
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

ace.define("ace/mode/ocaml",["require","exports","module","ace/lib/oop","ace/mode/text","ace/mode/ocaml_highlight_rules","ace/mode/matching_brace_outdent","ace/range"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../lib/oop");
var TextMode = acequire("./text").Mode;
var OcamlHighlightRules = acequire("./ocaml_highlight_rules").OcamlHighlightRules;
var MatchingBraceOutdent = acequire("./matching_brace_outdent").MatchingBraceOutdent;
var Range = acequire("../range").Range;

var Mode = function() {
    this.HighlightRules = OcamlHighlightRules;
    this.$behaviour = this.$defaultBehaviour;
    
    this.$outdent   = new MatchingBraceOutdent();
};
oop.inherits(Mode, TextMode);

var indenter = /(?:[({[=:]|[-=]>|\b(?:else|try|with))\s*$/;

(function() {

    this.toggleCommentLines = function(state, doc, startRow, endRow) {
        var i, line;
        var outdent = true;
        var re = /^\s*\(\*(.*)\*\)/;

        for (i=startRow; i<= endRow; i++) {
            if (!re.test(doc.getLine(i))) {
                outdent = false;
                break;
            }
        }

        var range = new Range(0, 0, 0, 0);
        for (i=startRow; i<= endRow; i++) {
            line = doc.getLine(i);
            range.start.row  = i;
            range.end.row    = i;
            range.end.column = line.length;

            doc.replace(range, outdent ? line.match(re)[1] : "(*" + line + "*)");
        }
    };

    this.getNextLineIndent = function(state, line, tab) {
        var indent = this.$getIndent(line);
        var tokens = this.getTokenizer().getLineTokens(line, state).tokens;

        if (!(tokens.length && tokens[tokens.length - 1].type === 'comment') &&
            state === 'start' && indenter.test(line))
            indent += tab;
        return indent;
    };

    this.checkOutdent = function(state, line, input) {
        return this.$outdent.checkOutdent(line, input);
    };

    this.autoOutdent = function(state, doc, row) {
        this.$outdent.autoOutdent(doc, row);
    };

    this.$id = "ace/mode/ocaml";
}).call(Mode.prototype);

exports.Mode = Mode;
});
