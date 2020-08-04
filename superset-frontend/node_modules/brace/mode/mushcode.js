ace.define("ace/mode/mushcode_highlight_rules",["require","exports","module","ace/lib/oop","ace/mode/text_highlight_rules"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../lib/oop");
var TextHighlightRules = acequire("./text_highlight_rules").TextHighlightRules;

var MushCodeRules = function() {


    var keywords = (
 "@if|"+
 "@ifelse|"+
 "@switch|"+
 "@halt|"+
 "@dolist|"+
 "@create|"+
 "@scent|"+
 "@sound|"+
 "@touch|"+
 "@ataste|"+
 "@osound|"+
 "@ahear|"+
 "@aahear|"+
 "@amhear|"+
 "@otouch|"+
 "@otaste|"+
 "@drop|"+
 "@odrop|"+
 "@adrop|"+
 "@dropfail|"+
 "@odropfail|"+
 "@smell|"+
 "@oemit|"+
 "@emit|"+
 "@pemit|"+
 "@parent|"+
 "@clone|"+
 "@taste|"+
 "whisper|"+
 "page|"+
 "say|"+
 "pose|"+
 "semipose|"+
 "teach|"+
 "touch|"+
 "taste|"+
 "smell|"+
 "listen|"+
 "look|"+
 "move|"+
 "go|"+
 "home|"+
 "follow|"+
 "unfollow|"+
 "desert|"+
 "dismiss|"+
 "@tel"
    );

    var builtinConstants = (
        "=#0"
    );

    var builtinFunctions = (
 "default|"+
 "edefault|"+
 "eval|"+
 "get_eval|"+
 "get|"+
 "grep|"+
 "grepi|"+
 "hasattr|"+
 "hasattrp|"+
 "hasattrval|"+
 "hasattrpval|"+
 "lattr|"+
 "nattr|"+
 "poss|"+
 "udefault|"+
 "ufun|"+
 "u|"+
 "v|"+
 "uldefault|"+
 "xget|"+
 "zfun|"+
 "band|"+
 "bnand|"+
 "bnot|"+
 "bor|"+
 "bxor|"+
 "shl|"+
 "shr|"+
 "and|"+
 "cand|"+
 "cor|"+
 "eq|"+
 "gt|"+
 "gte|"+
 "lt|"+
 "lte|"+
 "nand|"+
 "neq|"+
 "nor|"+
 "not|"+
 "or|"+
 "t|"+
 "xor|"+
 "con|"+
 "entrances|"+
 "exit|"+
 "followers|"+
 "home|"+
 "lcon|"+
 "lexits|"+
 "loc|"+
 "locate|"+
 "lparent|"+
 "lsearch|"+
 "next|"+
 "num|"+
 "owner|"+
 "parent|"+
 "pmatch|"+
 "rloc|"+
 "rnum|"+
 "room|"+
 "where|"+
 "zone|"+
 "worn|"+
 "held|"+
 "carried|"+
 "acos|"+
 "asin|"+
 "atan|"+
 "ceil|"+
 "cos|"+
 "e|"+
 "exp|"+
 "fdiv|"+
 "fmod|"+
 "floor|"+
 "log|"+
 "ln|"+
 "pi|"+
 "power|"+
 "round|"+
 "sin|"+
 "sqrt|"+
 "tan|"+
 "aposs|"+
 "andflags|"+
 "conn|"+
 "commandssent|"+
 "controls|"+
 "doing|"+
 "elock|"+
 "findable|"+
 "flags|"+
 "fullname|"+
 "hasflag|"+
 "haspower|"+
 "hastype|"+
 "hidden|"+
 "idle|"+
 "isbaker|"+
 "lock|"+
 "lstats|"+
 "money|"+
 "who|"+
 "name|"+
 "nearby|"+
 "obj|"+
 "objflags|"+
 "photo|"+
 "poll|"+
 "powers|"+
 "pendingtext|"+
 "receivedtext|"+
 "restarts|"+
 "restarttime|"+
 "subj|"+
 "shortestpath|"+
 "tmoney|"+
 "type|"+
 "visible|"+
 "cat|"+
 "element|"+
 "elements|"+
 "extract|"+
 "filter|"+
 "filterbool|"+
 "first|"+
 "foreach|"+
 "fold|"+
 "grab|"+
 "graball|"+
 "index|"+
 "insert|"+
 "itemize|"+
 "items|"+
 "iter|"+
 "last|"+
 "ldelete|"+
 "map|"+
 "match|"+
 "matchall|"+
 "member|"+
 "mix|"+
 "munge|"+
 "pick|"+
 "remove|"+
 "replace|"+
 "rest|"+
 "revwords|"+
 "setdiff|"+
 "setinter|"+
 "setunion|"+
 "shuffle|"+
 "sort|"+
 "sortby|"+
 "splice|"+
 "step|"+
 "wordpos|"+
 "words|"+
 "add|"+
 "lmath|"+
 "max|"+
 "mean|"+
 "median|"+
 "min|"+
 "mul|"+
 "percent|"+
 "sign|"+
 "stddev|"+
 "sub|"+
 "val|"+
 "bound|"+
 "abs|"+
 "inc|"+
 "dec|"+
 "dist2d|"+
 "dist3d|"+
 "div|"+
 "floordiv|"+
 "mod|"+
 "modulo|"+
 "remainder|"+
 "vadd|"+
 "vdim|"+
 "vdot|"+
 "vmag|"+
 "vmax|"+
 "vmin|"+
 "vmul|"+
 "vsub|"+
 "vunit|"+
 "regedit|"+
 "regeditall|"+
 "regeditalli|"+
 "regediti|"+
 "regmatch|"+
 "regmatchi|"+
 "regrab|"+
 "regraball|"+
 "regraballi|"+
 "regrabi|"+
 "regrep|"+
 "regrepi|"+
 "after|"+
 "alphamin|"+
 "alphamax|"+
 "art|"+
 "before|"+
 "brackets|"+
 "capstr|"+
 "case|"+
 "caseall|"+
 "center|"+
 "containsfansi|"+
 "comp|"+
 "decompose|"+
 "decrypt|"+
 "delete|"+
 "edit|"+
 "encrypt|"+
 "escape|"+
 "if|"+
 "ifelse|"+
 "lcstr|"+
 "left|"+
 "lit|"+
 "ljust|"+
 "merge|"+
 "mid|"+
 "ostrlen|"+
 "pos|"+
 "repeat|"+
 "reverse|"+
 "right|"+
 "rjust|"+
 "scramble|"+
 "secure|"+
 "space|"+
 "spellnum|"+
 "squish|"+
 "strcat|"+
 "strmatch|"+
 "strinsert|"+
 "stripansi|"+
 "stripfansi|"+
 "strlen|"+
 "switch|"+
 "switchall|"+
 "table|"+
 "tr|"+
 "trim|"+
 "ucstr|"+
 "unsafe|"+
 "wrap|"+
 "ctitle|"+
 "cwho|"+
 "channels|"+
 "clock|"+
 "cflags|"+
 "ilev|"+
 "itext|"+
 "inum|"+
 "convsecs|"+
 "convutcsecs|"+
 "convtime|"+
 "ctime|"+
 "etimefmt|"+
 "isdaylight|"+
 "mtime|"+
 "secs|"+
 "msecs|"+
 "starttime|"+
 "time|"+
 "timefmt|"+
 "timestring|"+
 "utctime|"+
 "atrlock|"+
 "clone|"+
 "create|"+
 "cook|"+
 "dig|"+
 "emit|"+
 "lemit|"+
 "link|"+
 "oemit|"+
 "open|"+
 "pemit|"+
 "remit|"+
 "set|"+
 "tel|"+
 "wipe|"+
 "zemit|"+
 "fbcreate|"+
 "fbdestroy|"+
 "fbwrite|"+
 "fbclear|"+
 "fbcopy|"+
 "fbcopyto|"+
 "fbclip|"+
 "fbdump|"+
 "fbflush|"+
 "fbhset|"+
 "fblist|"+
 "fbstats|"+
 "qentries|"+
 "qentry|"+
 "play|"+
 "ansi|"+
 "break|"+
 "c|"+
 "asc|"+
 "die|"+
 "isdbref|"+
 "isint|"+
 "isnum|"+
 "isletters|"+
 "linecoords|"+
 "localize|"+
 "lnum|"+
 "nameshort|"+
 "null|"+
 "objeval|"+
 "r|"+
 "rand|"+
 "s|"+
 "setq|"+
 "setr|"+
 "soundex|"+
 "soundslike|"+
 "valid|"+
 "vchart|"+
 "vchart2|"+
 "vlabel|"+
 "@@|"+
 "bakerdays|"+
 "bodybuild|"+
 "box|"+
 "capall|"+
 "catalog|"+
 "children|"+
 "ctrailer|"+
 "darttime|"+
 "debt|"+
 "detailbar|"+
 "exploredroom|"+
 "fansitoansi|"+
 "fansitoxansi|"+
 "fullbar|"+
 "halfbar|"+
 "isdarted|"+
 "isnewbie|"+
 "isword|"+
 "lambda|"+
 "lobjects|"+
 "lplayers|"+
 "lthings|"+
 "lvexits|"+
 "lvobjects|"+
 "lvplayers|"+
 "lvthings|"+
 "newswrap|"+
 "numsuffix|"+
 "playerson|"+
 "playersthisweek|"+
 "randomad|"+
 "randword|"+
 "realrandword|"+
 "replacechr|"+
 "second|"+
 "splitamount|"+
 "strlenall|"+
 "text|"+
 "third|"+
 "tofansi|"+
 "totalac|"+
 "unique|"+
 "getaddressroom|"+
 "listpropertycomm|"+
 "listpropertyres|"+
 "lotowner|"+
 "lotrating|"+
 "lotratingcount|"+
 "lotvalue|"+
 "boughtproduct|"+
 "companyabb|"+
 "companyicon|"+
 "companylist|"+
 "companyname|"+
 "companyowners|"+
 "companyvalue|"+
 "employees|"+
 "invested|"+
 "productlist|"+
 "productname|"+
 "productowners|"+
 "productrating|"+
 "productratingcount|"+
 "productsoldat|"+
 "producttype|"+
 "ratedproduct|"+
 "soldproduct|"+
 "topproducts|"+
 "totalspentonproduct|"+
 "totalstock|"+
 "transfermoney|"+
 "uniquebuyercount|"+
 "uniqueproductsbought|"+
 "validcompany|"+
 "deletepicture|"+
 "fbsave|"+
 "getpicturesecurity|"+
 "haspicture|"+
 "listpictures|"+
 "picturesize|"+
 "replacecolor|"+
 "rgbtocolor|"+
 "savepicture|"+
 "setpicturesecurity|"+
 "showpicture|"+
 "piechart|"+
 "piechartlabel|"+
 "createmaze|"+
 "drawmaze|"+
 "drawwireframe"
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

    this.$rules = {
        "start" : [
         {
                token : "variable", // mush substitution register
                regex : "%[0-9]{1}"
         },
         {
                token : "variable", // mush substitution register
                regex : "%q[0-9A-Za-z]{1}"
         },
         {
                token : "variable", // mush special character register
                regex : "%[a-zA-Z]{1}"
         },
         {
                token: "variable.language",
                regex: "%[a-z0-9-_]+"
         },
        {
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
            regex : "\\+|\\-|\\*|\\*\\*|\\/|\\/\\/|#|%|<<|>>|\\||\\^|~|<|>|<=|=>|==|!=|<>|="
        }, {
            token : "paren.lparen",
            regex : "[\\[\\(\\{]"
        }, {
            token : "paren.rparen",
            regex : "[\\]\\)\\}]"
        }, {
            token : "text",
            regex : "\\s+"
        } ]
    };
};

oop.inherits(MushCodeRules, TextHighlightRules);

exports.MushCodeRules = MushCodeRules;
});

ace.define("ace/mode/folding/pythonic",["require","exports","module","ace/lib/oop","ace/mode/folding/fold_mode"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../../lib/oop");
var BaseFoldMode = acequire("./fold_mode").FoldMode;

var FoldMode = exports.FoldMode = function(markers) {
    this.foldingStartMarker = new RegExp("([\\[{])(?:\\s*)$|(" + markers + ")(?:\\s*)(?:#.*)?$");
};
oop.inherits(FoldMode, BaseFoldMode);

(function() {

    this.getFoldWidgetRange = function(session, foldStyle, row) {
        var line = session.getLine(row);
        var match = line.match(this.foldingStartMarker);
        if (match) {
            if (match[1])
                return this.openingBracketBlock(session, match[1], row, match.index);
            if (match[2])
                return this.indentationBlock(session, row, match.index + match[2].length);
            return this.indentationBlock(session, row);
        }
    };

}).call(FoldMode.prototype);

});

ace.define("ace/mode/mushcode",["require","exports","module","ace/lib/oop","ace/mode/text","ace/mode/mushcode_highlight_rules","ace/mode/folding/pythonic","ace/range"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../lib/oop");
var TextMode = acequire("./text").Mode;
var MushCodeRules = acequire("./mushcode_highlight_rules").MushCodeRules;
var PythonFoldMode = acequire("./folding/pythonic").FoldMode;
var Range = acequire("../range").Range;

var Mode = function() {
    this.HighlightRules = MushCodeRules;
    this.foldingRules = new PythonFoldMode("\\:");
    this.$behaviour = this.$defaultBehaviour;
};
oop.inherits(Mode, TextMode);

(function() {


    this.getNextLineIndent = function(state, line, tab) {
        var indent = this.$getIndent(line);

        var tokenizedLine = this.getTokenizer().getLineTokens(line, state);
        var tokens = tokenizedLine.tokens;

        if (tokens.length && tokens[tokens.length-1].type == "comment") {
            return indent;
        }

        if (state == "start") {
            var match = line.match(/^.*[\{\(\[:]\s*$/);
            if (match) {
                indent += tab;
            }
        }

        return indent;
    };

   var outdents = {
        "pass": 1,
        "return": 1,
        "raise": 1,
        "break": 1,
        "continue": 1
    };

    this.checkOutdent = function(state, line, input) {
        if (input !== "\r\n" && input !== "\r" && input !== "\n")
            return false;

        var tokens = this.getTokenizer().getLineTokens(line.trim(), state).tokens;

        if (!tokens)
            return false;
        do {
            var last = tokens.pop();
        } while (last && (last.type == "comment" || (last.type == "text" && last.value.match(/^\s+$/))));

        if (!last)
            return false;

        return (last.type == "keyword" && outdents[last.value]);
    };

    this.autoOutdent = function(state, doc, row) {

        row += 1;
        var indent = this.$getIndent(doc.getLine(row));
        var tab = doc.getTabString();
        if (indent.slice(-tab.length) == tab)
            doc.remove(new Range(row, indent.length-tab.length, row, indent.length));
    };

    this.$id = "ace/mode/mushcode";
}).call(Mode.prototype);

exports.Mode = Mode;
});
