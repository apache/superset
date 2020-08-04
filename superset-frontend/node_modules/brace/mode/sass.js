ace.define("ace/mode/scss_highlight_rules",["require","exports","module","ace/lib/oop","ace/lib/lang","ace/mode/text_highlight_rules"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../lib/oop");
var lang = acequire("../lib/lang");
var TextHighlightRules = acequire("./text_highlight_rules").TextHighlightRules;

var ScssHighlightRules = function() {
    
    var properties = lang.arrayToMap( (function () {

        var browserPrefix = ("-webkit-|-moz-|-o-|-ms-|-svg-|-pie-|-khtml-").split("|");
        
        var prefixProperties = ("appearance|background-clip|background-inline-policy|background-origin|" + 
             "background-size|binding|border-bottom-colors|border-left-colors|" + 
             "border-right-colors|border-top-colors|border-end|border-end-color|" + 
             "border-end-style|border-end-width|border-image|border-start|" + 
             "border-start-color|border-start-style|border-start-width|box-align|" + 
             "box-direction|box-flex|box-flexgroup|box-ordinal-group|box-orient|" + 
             "box-pack|box-sizing|column-count|column-gap|column-width|column-rule|" + 
             "column-rule-width|column-rule-style|column-rule-color|float-edge|" + 
             "font-feature-settings|font-language-override|force-broken-image-icon|" + 
             "image-region|margin-end|margin-start|opacity|outline|outline-color|" + 
             "outline-offset|outline-radius|outline-radius-bottomleft|" + 
             "outline-radius-bottomright|outline-radius-topleft|outline-radius-topright|" + 
             "outline-style|outline-width|padding-end|padding-start|stack-sizing|" + 
             "tab-size|text-blink|text-decoration-color|text-decoration-line|" + 
             "text-decoration-style|transform|transform-origin|transition|" + 
             "transition-delay|transition-duration|transition-property|" + 
             "transition-timing-function|user-focus|user-input|user-modify|user-select|" +
             "window-shadow|border-radius").split("|");
        
        var properties = ("azimuth|background-attachment|background-color|background-image|" +
            "background-position|background-repeat|background|border-bottom-color|" +
            "border-bottom-style|border-bottom-width|border-bottom|border-collapse|" +
            "border-color|border-left-color|border-left-style|border-left-width|" +
            "border-left|border-right-color|border-right-style|border-right-width|" +
            "border-right|border-spacing|border-style|border-top-color|" +
            "border-top-style|border-top-width|border-top|border-width|border|bottom|" +
            "box-shadow|box-sizing|caption-side|clear|clip|color|content|counter-increment|" +
            "counter-reset|cue-after|cue-before|cue|cursor|direction|display|" +
            "elevation|empty-cells|float|font-family|font-size-adjust|font-size|" +
            "font-stretch|font-style|font-variant|font-weight|font|height|left|" +
            "letter-spacing|line-height|list-style-image|list-style-position|" +
            "list-style-type|list-style|margin-bottom|margin-left|margin-right|" +
            "margin-top|marker-offset|margin|marks|max-height|max-width|min-height|" +
            "min-width|opacity|orphans|outline-color|" +
            "outline-style|outline-width|outline|overflow|overflow-x|overflow-y|padding-bottom|" +
            "padding-left|padding-right|padding-top|padding|page-break-after|" +
            "page-break-before|page-break-inside|page|pause-after|pause-before|" +
            "pause|pitch-range|pitch|play-during|position|quotes|richness|right|" +
            "size|speak-header|speak-numeral|speak-punctuation|speech-rate|speak|" +
            "stress|table-layout|text-align|text-decoration|text-indent|" +
            "text-shadow|text-transform|top|unicode-bidi|vertical-align|" +
            "visibility|voice-family|volume|white-space|widows|width|word-spacing|" +
            "z-index").split("|");
        var ret = [];
        for (var i=0, ln=browserPrefix.length; i<ln; i++) {
            Array.prototype.push.apply(
                ret,
                (( browserPrefix[i] + prefixProperties.join("|" + browserPrefix[i]) ).split("|"))
            );
        }
        Array.prototype.push.apply(ret, prefixProperties);
        Array.prototype.push.apply(ret, properties);
        
        return ret;
        
    })() );
    


    var functions = lang.arrayToMap(
        ("hsl|hsla|rgb|rgba|url|attr|counter|counters|abs|adjust_color|adjust_hue|" +
         "alpha|join|blue|ceil|change_color|comparable|complement|darken|desaturate|" + 
         "floor|grayscale|green|hue|if|invert|join|length|lighten|lightness|mix|" + 
         "nth|opacify|opacity|percentage|quote|red|round|saturate|saturation|" +
         "scale_color|transparentize|type_of|unit|unitless|unquote").split("|")
    );

    var constants = lang.arrayToMap(
        ("absolute|all-scroll|always|armenian|auto|baseline|below|bidi-override|" +
        "block|bold|bolder|border-box|both|bottom|break-all|break-word|capitalize|center|" +
        "char|circle|cjk-ideographic|col-resize|collapse|content-box|crosshair|dashed|" +
        "decimal-leading-zero|decimal|default|disabled|disc|" +
        "distribute-all-lines|distribute-letter|distribute-space|" +
        "distribute|dotted|double|e-resize|ellipsis|fixed|georgian|groove|" +
        "hand|hebrew|help|hidden|hiragana-iroha|hiragana|horizontal|" +
        "ideograph-alpha|ideograph-numeric|ideograph-parenthesis|" +
        "ideograph-space|inactive|inherit|inline-block|inline|inset|inside|" +
        "inter-ideograph|inter-word|italic|justify|katakana-iroha|katakana|" +
        "keep-all|left|lighter|line-edge|line-through|line|list-item|loose|" +
        "lower-alpha|lower-greek|lower-latin|lower-roman|lowercase|lr-tb|ltr|" +
        "medium|middle|move|n-resize|ne-resize|newspaper|no-drop|no-repeat|" +
        "nw-resize|none|normal|not-allowed|nowrap|oblique|outset|outside|" +
        "overline|pointer|progress|relative|repeat-x|repeat-y|repeat|right|" +
        "ridge|row-resize|rtl|s-resize|scroll|se-resize|separate|small-caps|" +
        "solid|square|static|strict|super|sw-resize|table-footer-group|" +
        "table-header-group|tb-rl|text-bottom|text-top|text|thick|thin|top|" +
        "transparent|underline|upper-alpha|upper-latin|upper-roman|uppercase|" +
        "vertical-ideographic|vertical-text|visible|w-resize|wait|whitespace|" +
        "zero").split("|")
    );

    var colors = lang.arrayToMap(
        ("aliceblue|antiquewhite|aqua|aquamarine|azure|beige|bisque|black|" +
        "blanchedalmond|blue|blueviolet|brown|burlywood|cadetblue|" +
        "chartreuse|chocolate|coral|cornflowerblue|cornsilk|crimson|cyan|" +
        "darkblue|darkcyan|darkgoldenrod|darkgray|darkgreen|darkgrey|" +
        "darkkhaki|darkmagenta|darkolivegreen|darkorange|darkorchid|darkred|" +
        "darksalmon|darkseagreen|darkslateblue|darkslategray|darkslategrey|" +
        "darkturquoise|darkviolet|deeppink|deepskyblue|dimgray|dimgrey|" +
        "dodgerblue|firebrick|floralwhite|forestgreen|fuchsia|gainsboro|" +
        "ghostwhite|gold|goldenrod|gray|green|greenyellow|grey|honeydew|" +
        "hotpink|indianred|indigo|ivory|khaki|lavender|lavenderblush|" +
        "lawngreen|lemonchiffon|lightblue|lightcoral|lightcyan|" +
        "lightgoldenrodyellow|lightgray|lightgreen|lightgrey|lightpink|" +
        "lightsalmon|lightseagreen|lightskyblue|lightslategray|" +
        "lightslategrey|lightsteelblue|lightyellow|lime|limegreen|linen|" +
        "magenta|maroon|mediumaquamarine|mediumblue|mediumorchid|" +
        "mediumpurple|mediumseagreen|mediumslateblue|mediumspringgreen|" +
        "mediumturquoise|mediumvioletred|midnightblue|mintcream|mistyrose|" +
        "moccasin|navajowhite|navy|oldlace|olive|olivedrab|orange|orangered|" +
        "orchid|palegoldenrod|palegreen|paleturquoise|palevioletred|" +
        "papayawhip|peachpuff|peru|pink|plum|powderblue|purple|rebeccapurple|" +
        "red|rosybrown|royalblue|saddlebrown|salmon|sandybrown|seagreen|" +
        "seashell|sienna|silver|skyblue|slateblue|slategray|slategrey|snow|" +
        "springgreen|steelblue|tan|teal|thistle|tomato|turquoise|violet|" +
        "wheat|white|whitesmoke|yellow|yellowgreen").split("|")
    );
    
    var keywords = lang.arrayToMap(
        ("@mixin|@extend|@include|@import|@media|@debug|@warn|@if|@for|@each|@while|@else|@font-face|@-webkit-keyframes|if|and|!default|module|def|end|declare").split("|")
    );
    
    var tags = lang.arrayToMap(
        ("a|abbr|acronym|address|applet|area|article|aside|audio|b|base|basefont|bdo|" + 
         "big|blockquote|body|br|button|canvas|caption|center|cite|code|col|colgroup|" + 
         "command|datalist|dd|del|details|dfn|dir|div|dl|dt|em|embed|fieldset|" + 
         "figcaption|figure|font|footer|form|frame|frameset|h1|h2|h3|h4|h5|h6|head|" + 
         "header|hgroup|hr|html|i|iframe|img|input|ins|keygen|kbd|label|legend|li|" + 
         "link|map|mark|menu|meta|meter|nav|noframes|noscript|object|ol|optgroup|" + 
         "option|output|p|param|pre|progress|q|rp|rt|ruby|s|samp|script|section|select|" + 
         "small|source|span|strike|strong|style|sub|summary|sup|table|tbody|td|" + 
         "textarea|tfoot|th|thead|time|title|tr|tt|u|ul|var|video|wbr|xmp").split("|")
    );

    var numRe = "\\-?(?:(?:[0-9]+)|(?:[0-9]*\\.[0-9]+))";

    this.$rules = {
        "start" : [
            {
                token : "comment",
                regex : "\\/\\/.*$"
            },
            {
                token : "comment", // multi line comment
                regex : "\\/\\*",
                next : "comment"
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
                token : "constant.numeric",
                regex : numRe + "(?:em|ex|px|cm|mm|in|pt|pc|deg|rad|grad|ms|s|hz|khz|%)"
            }, {
                token : "constant.numeric", // hex6 color
                regex : "#[a-f0-9]{6}"
            }, {
                token : "constant.numeric", // hex3 color
                regex : "#[a-f0-9]{3}"
            }, {
                token : "constant.numeric",
                regex : numRe
            }, {
                token : ["support.function", "string", "support.function"],
                regex : "(url\\()(.*)(\\))"
            }, {
                token : function(value) {
                    if (properties.hasOwnProperty(value.toLowerCase()))
                        return "support.type";
                    if (keywords.hasOwnProperty(value))
                        return "keyword";
                    else if (constants.hasOwnProperty(value))
                        return "constant.language";
                    else if (functions.hasOwnProperty(value))
                        return "support.function";
                    else if (colors.hasOwnProperty(value.toLowerCase()))
                        return "support.constant.color";
                    else if (tags.hasOwnProperty(value.toLowerCase()))
                        return "variable.language";
                    else
                        return "text";
                },
                regex : "\\-?[@a-z_][@a-z0-9_\\-]*"
            }, {
                token : "variable",
                regex : "[a-z_\\-$][a-z0-9_\\-$]*\\b"
            }, {
                token: "variable.language",
                regex: "#[a-z0-9-_]+"
            }, {
                token: "variable.language",
                regex: "\\.[a-z0-9-_]+"
            }, {
                token: "variable.language",
                regex: ":[a-z0-9-_]+"
            }, {
                token: "constant",
                regex: "[a-z0-9-_]+"
            }, {
                token : "keyword.operator",
                regex : "<|>|<=|>=|==|!=|-|%|#|\\+|\\$|\\+|\\*"
            }, {
                token : "paren.lparen",
                regex : "[[({]"
            }, {
                token : "paren.rparen",
                regex : "[\\])}]"
            }, {
                token : "text",
                regex : "\\s+"
            }, {
                caseInsensitive: true
            }
        ],
        "comment" : [
            {
                token : "comment", // closing comment
                regex : "\\*\\/",
                next : "start"
            }, {
                defaultToken : "comment"
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
        ]
    };
};

oop.inherits(ScssHighlightRules, TextHighlightRules);

exports.ScssHighlightRules = ScssHighlightRules;

});

ace.define("ace/mode/sass_highlight_rules",["require","exports","module","ace/lib/oop","ace/lib/lang","ace/mode/scss_highlight_rules"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../lib/oop");
var lang = acequire("../lib/lang");
var ScssHighlightRules = acequire("./scss_highlight_rules").ScssHighlightRules;

var SassHighlightRules = function() {
    ScssHighlightRules.call(this);
    var start = this.$rules.start;
    if (start[1].token == "comment") {
        start.splice(1, 1, {
            onMatch: function(value, currentState, stack) {
                stack.unshift(this.next, -1, value.length - 2, currentState);
                return "comment";
            },
            regex: /^\s*\/\*/,
            next: "comment"
        }, {
            token: "error.invalid",
            regex: "/\\*|[{;}]"
        }, {
            token: "support.type",
            regex: /^\s*:[\w\-]+\s/
        });
        
        this.$rules.comment = [
            {regex: /^\s*/, onMatch: function(value, currentState, stack) {
                if (stack[1] === -1)
                    stack[1] = Math.max(stack[2], value.length - 1);
                if (value.length <= stack[1]) {stack.shift();stack.shift();stack.shift();
                    this.next = stack.shift();
                    return "text";
                } else {
                    this.next = "";
                    return "comment";
                }
            }, next: "start"},
            {defaultToken: "comment"}
        ];
    }
};

oop.inherits(SassHighlightRules, ScssHighlightRules);

exports.SassHighlightRules = SassHighlightRules;

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

ace.define("ace/mode/sass",["require","exports","module","ace/lib/oop","ace/mode/text","ace/mode/sass_highlight_rules","ace/mode/folding/coffee"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../lib/oop");
var TextMode = acequire("./text").Mode;
var SassHighlightRules = acequire("./sass_highlight_rules").SassHighlightRules;
var FoldMode = acequire("./folding/coffee").FoldMode;

var Mode = function() {
    this.HighlightRules = SassHighlightRules;
    this.foldingRules = new FoldMode();
    this.$behaviour = this.$defaultBehaviour;
};
oop.inherits(Mode, TextMode);

(function() {   
    this.lineCommentStart = "//";
    this.$id = "ace/mode/sass";
}).call(Mode.prototype);

exports.Mode = Mode;

});
