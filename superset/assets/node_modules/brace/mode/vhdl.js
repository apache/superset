ace.define("ace/mode/vhdl_highlight_rules",["require","exports","module","ace/lib/oop","ace/mode/text_highlight_rules"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../lib/oop");
var TextHighlightRules = acequire("./text_highlight_rules").TextHighlightRules;

var VHDLHighlightRules = function() {


    
    var keywords = "access|after|ailas|all|architecture|assert|attribute|"+
                   "begin|block|buffer|bus|case|component|configuration|"+
                   "disconnect|downto|else|elsif|end|entity|file|for|function|"+
                   "generate|generic|guarded|if|impure|in|inertial|inout|is|"+
                   "label|linkage|literal|loop|mapnew|next|of|on|open|"+
                   "others|out|port|process|pure|range|record|reject|"+
                   "report|return|select|shared|subtype|then|to|transport|"+
                   "type|unaffected|united|until|wait|when|while|with";
    
    var storageType = "bit|bit_vector|boolean|character|integer|line|natural|"+
                      "positive|real|register|severity|signal|signed|"+
                      "std_logic|std_logic_vector|string||text|time|unsigned|"+
                      "variable";
    
    var storageModifiers = "array|constant";
    
    var keywordOperators = "abs|and|mod|nand|nor|not|rem|rol|ror|sla|sll|sra"+
                           "srl|xnor|xor";
    
    var builtinConstants = (
        "true|false|null"
    );


    var keywordMapper = this.createKeywordMapper({
        "keyword.operator": keywordOperators,
        "keyword": keywords,
        "constant.language": builtinConstants,
        "storage.modifier": storageModifiers,
        "storage.type": storageType
    }, "identifier", true);

    this.$rules = {
        "start" : [ {
            token : "comment",
            regex : "--.*$"
        }, {
            token : "string",           // " string
            regex : '".*?"'
        }, {
            token : "string",           // ' string
            regex : "'.*?'"
        }, {
            token : "constant.numeric", // float
            regex : "[+-]?\\d+(?:(?:\\.\\d*)?(?:[eE][+-]?\\d+)?)?\\b"
        }, {
            token : "keyword", // pre-compiler directives
            regex : "\\s*(?:library|package|use)\\b"
        }, {
            token : keywordMapper,
            regex : "[a-zA-Z_$][a-zA-Z0-9_$]*\\b"
        }, {
            token : "keyword.operator",
            regex : "&|\\*|\\+|\\-|\\/|<|=|>|\\||=>|\\*\\*|:=|\\/=|>=|<=|<>" 
        }, {
              token : "punctuation.operator",
              regex : "\\'|\\:|\\,|\\;|\\."
        },{
            token : "paren.lparen",
            regex : "[[(]"
        }, {
            token : "paren.rparen",
            regex : "[\\])]"
        }, {
            token : "text",
            regex : "\\s+"
        } ]

       
    };
};

oop.inherits(VHDLHighlightRules, TextHighlightRules);

exports.VHDLHighlightRules = VHDLHighlightRules;
});

ace.define("ace/mode/vhdl",["require","exports","module","ace/lib/oop","ace/mode/text","ace/mode/vhdl_highlight_rules"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../lib/oop");
var TextMode = acequire("./text").Mode;
var VHDLHighlightRules = acequire("./vhdl_highlight_rules").VHDLHighlightRules;

var Mode = function() {
    this.HighlightRules = VHDLHighlightRules;
    this.$behaviour = this.$defaultBehaviour;
};
oop.inherits(Mode, TextMode);

(function() {

    this.lineCommentStart = "--";

    this.$id = "ace/mode/vhdl";
}).call(Mode.prototype);

exports.Mode = Mode;

});
