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

ace.define("ace/mode/c_cpp_highlight_rules",["require","exports","module","ace/lib/oop","ace/mode/doc_comment_highlight_rules","ace/mode/text_highlight_rules"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../lib/oop");
var DocCommentHighlightRules = acequire("./doc_comment_highlight_rules").DocCommentHighlightRules;
var TextHighlightRules = acequire("./text_highlight_rules").TextHighlightRules;
var cFunctions = exports.cFunctions = "\\b(?:hypot(?:f|l)?|s(?:scanf|ystem|nprintf|ca(?:nf|lb(?:n(?:f|l)?|ln(?:f|l)?))|i(?:n(?:h(?:f|l)?|f|l)?|gn(?:al|bit))|tr(?:s(?:tr|pn)|nc(?:py|at|mp)|c(?:spn|hr|oll|py|at|mp)|to(?:imax|d|u(?:l(?:l)?|max)|k|f|l(?:d|l)?)|error|pbrk|ftime|len|rchr|xfrm)|printf|et(?:jmp|vbuf|locale|buf)|qrt(?:f|l)?|w(?:scanf|printf)|rand)|n(?:e(?:arbyint(?:f|l)?|xt(?:toward(?:f|l)?|after(?:f|l)?))|an(?:f|l)?)|c(?:s(?:in(?:h(?:f|l)?|f|l)?|qrt(?:f|l)?)|cos(?:h(?:f)?|f|l)?|imag(?:f|l)?|t(?:ime|an(?:h(?:f|l)?|f|l)?)|o(?:s(?:h(?:f|l)?|f|l)?|nj(?:f|l)?|pysign(?:f|l)?)|p(?:ow(?:f|l)?|roj(?:f|l)?)|e(?:il(?:f|l)?|xp(?:f|l)?)|l(?:o(?:ck|g(?:f|l)?)|earerr)|a(?:sin(?:h(?:f|l)?|f|l)?|cos(?:h(?:f|l)?|f|l)?|tan(?:h(?:f|l)?|f|l)?|lloc|rg(?:f|l)?|bs(?:f|l)?)|real(?:f|l)?|brt(?:f|l)?)|t(?:ime|o(?:upper|lower)|an(?:h(?:f|l)?|f|l)?|runc(?:f|l)?|gamma(?:f|l)?|mp(?:nam|file))|i(?:s(?:space|n(?:ormal|an)|cntrl|inf|digit|u(?:nordered|pper)|p(?:unct|rint)|finite|w(?:space|c(?:ntrl|type)|digit|upper|p(?:unct|rint)|lower|al(?:num|pha)|graph|xdigit|blank)|l(?:ower|ess(?:equal|greater)?)|al(?:num|pha)|gr(?:eater(?:equal)?|aph)|xdigit|blank)|logb(?:f|l)?|max(?:div|abs))|di(?:v|fftime)|_Exit|unget(?:c|wc)|p(?:ow(?:f|l)?|ut(?:s|c(?:har)?|wc(?:har)?)|error|rintf)|e(?:rf(?:c(?:f|l)?|f|l)?|x(?:it|p(?:2(?:f|l)?|f|l|m1(?:f|l)?)?))|v(?:s(?:scanf|nprintf|canf|printf|w(?:scanf|printf))|printf|f(?:scanf|printf|w(?:scanf|printf))|w(?:scanf|printf)|a_(?:start|copy|end|arg))|qsort|f(?:s(?:canf|e(?:tpos|ek))|close|tell|open|dim(?:f|l)?|p(?:classify|ut(?:s|c|w(?:s|c))|rintf)|e(?:holdexcept|set(?:e(?:nv|xceptflag)|round)|clearexcept|testexcept|of|updateenv|r(?:aiseexcept|ror)|get(?:e(?:nv|xceptflag)|round))|flush|w(?:scanf|ide|printf|rite)|loor(?:f|l)?|abs(?:f|l)?|get(?:s|c|pos|w(?:s|c))|re(?:open|e|ad|xp(?:f|l)?)|m(?:in(?:f|l)?|od(?:f|l)?|a(?:f|l|x(?:f|l)?)?))|l(?:d(?:iv|exp(?:f|l)?)|o(?:ngjmp|cal(?:time|econv)|g(?:1(?:p(?:f|l)?|0(?:f|l)?)|2(?:f|l)?|f|l|b(?:f|l)?)?)|abs|l(?:div|abs|r(?:int(?:f|l)?|ound(?:f|l)?))|r(?:int(?:f|l)?|ound(?:f|l)?)|gamma(?:f|l)?)|w(?:scanf|c(?:s(?:s(?:tr|pn)|nc(?:py|at|mp)|c(?:spn|hr|oll|py|at|mp)|to(?:imax|d|u(?:l(?:l)?|max)|k|f|l(?:d|l)?|mbs)|pbrk|ftime|len|r(?:chr|tombs)|xfrm)|to(?:b|mb)|rtomb)|printf|mem(?:set|c(?:hr|py|mp)|move))|a(?:s(?:sert|ctime|in(?:h(?:f|l)?|f|l)?)|cos(?:h(?:f|l)?|f|l)?|t(?:o(?:i|f|l(?:l)?)|exit|an(?:h(?:f|l)?|2(?:f|l)?|f|l)?)|b(?:s|ort))|g(?:et(?:s|c(?:har)?|env|wc(?:har)?)|mtime)|r(?:int(?:f|l)?|ound(?:f|l)?|e(?:name|alloc|wind|m(?:ove|quo(?:f|l)?|ainder(?:f|l)?))|a(?:nd|ise))|b(?:search|towc)|m(?:odf(?:f|l)?|em(?:set|c(?:hr|py|mp)|move)|ktime|alloc|b(?:s(?:init|towcs|rtowcs)|towc|len|r(?:towc|len))))\\b";

var c_cppHighlightRules = function() {

    var keywordControls = (
        "break|case|continue|default|do|else|for|goto|if|_Pragma|" +
        "return|switch|while|catch|operator|try|throw|using"
    );
    
    var storageType = (
        "asm|__asm__|auto|bool|_Bool|char|_Complex|double|enum|float|" +
        "_Imaginary|int|long|short|signed|struct|typedef|union|unsigned|void|" +
        "class|wchar_t|template|char16_t|char32_t"
    );

    var storageModifiers = (
        "const|extern|register|restrict|static|volatile|inline|private|" +
        "protected|public|friend|explicit|virtual|export|mutable|typename|" +
        "constexpr|new|delete|alignas|alignof|decltype|noexcept|thread_local"
    );

    var keywordOperators = (
        "and|and_eq|bitand|bitor|compl|not|not_eq|or|or_eq|typeid|xor|xor_eq" +
        "const_cast|dynamic_cast|reinterpret_cast|static_cast|sizeof|namespace"
    );

    var builtinConstants = (
        "NULL|true|false|TRUE|FALSE|nullptr"
    );

    var keywordMapper = this.$keywords = this.createKeywordMapper({
        "keyword.control" : keywordControls,
        "storage.type" : storageType,
        "storage.modifier" : storageModifiers,
        "keyword.operator" : keywordOperators,
        "variable.language": "this",
        "constant.language": builtinConstants
    }, "identifier");

    var identifierRe = "[a-zA-Z\\$_\u00a1-\uffff][a-zA-Z\\d\\$_\u00a1-\uffff]*\\b";
    var escapeRe = /\\(?:['"?\\abfnrtv]|[0-7]{1,3}|x[a-fA-F\d]{2}|u[a-fA-F\d]{4}U[a-fA-F\d]{8}|.)/.source;
    var formatRe = "%"
          + /(\d+\$)?/.source // field (argument #)
          + /[#0\- +']*/.source // flags
          + /[,;:_]?/.source // separator character (AltiVec)
          + /((-?\d+)|\*(-?\d+\$)?)?/.source // minimum field width
          + /(\.((-?\d+)|\*(-?\d+\$)?)?)?/.source // precision
          + /(hh|h|ll|l|j|t|z|q|L|vh|vl|v|hv|hl)?/.source // length modifier
          + /(\[[^"\]]+\]|[diouxXDOUeEfFgGaACcSspn%])/.source; // conversion type

    this.$rules = { 
        "start" : [
            {
                token : "comment",
                regex : "//$",
                next : "start"
            }, {
                token : "comment",
                regex : "//",
                next : "singleLineComment"
            },
            DocCommentHighlightRules.getStartRule("doc-start"),
            {
                token : "comment", // multi line comment
                regex : "\\/\\*",
                next : "comment"
            }, {
                token : "string", // character
                regex : "'(?:" + escapeRe + "|.)?'"
            }, {
                token : "string.start",
                regex : '"', 
                stateName: "qqstring",
                next: [
                    { token: "string", regex: /\\\s*$/, next: "qqstring" },
                    { token: "constant.language.escape", regex: escapeRe },
                    { token: "constant.language.escape", regex: formatRe },
                    { token: "string.end", regex: '"|$', next: "start" },
                    { defaultToken: "string"}
                ]
            }, {
                token : "string.start",
                regex : 'R"\\(', 
                stateName: "rawString",
                next: [
                    { token: "string.end", regex: '\\)"', next: "start" },
                    { defaultToken: "string"}
                ]
            }, {
                token : "constant.numeric", // hex
                regex : "0[xX][0-9a-fA-F]+(L|l|UL|ul|u|U|F|f|ll|LL|ull|ULL)?\\b"
            }, {
                token : "constant.numeric", // float
                regex : "[+-]?\\d+(?:(?:\\.\\d*)?(?:[eE][+-]?\\d+)?)?(L|l|UL|ul|u|U|F|f|ll|LL|ull|ULL)?\\b"
            }, {
                token : "keyword", // pre-compiler directives
                regex : "#\\s*(?:include|import|pragma|line|define|undef)\\b",
                next  : "directive"
            }, {
                token : "keyword", // special case pre-compiler directive
                regex : "#\\s*(?:endif|if|ifdef|else|elif|ifndef)\\b"
            }, {
                token : "support.function.C99.c",
                regex : cFunctions
            }, {
                token : keywordMapper,
                regex : "[a-zA-Z_$][a-zA-Z0-9_$]*"
            }, {
                token : "keyword.operator",
                regex : /--|\+\+|<<=|>>=|>>>=|<>|&&|\|\||\?:|[*%\/+\-&\^|~!<>=]=?/
            }, {
              token : "punctuation.operator",
              regex : "\\?|\\:|\\,|\\;|\\."
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
                regex : "\\*\\/",
                next : "start"
            }, {
                defaultToken : "comment"
            }
        ],
        "singleLineComment" : [
            {
                token : "comment",
                regex : /\\$/,
                next : "singleLineComment"
            }, {
                token : "comment",
                regex : /$/,
                next : "start"
            }, {
                defaultToken: "comment"
            }
        ],
        "directive" : [
            {
                token : "constant.other.multiline",
                regex : /\\/
            },
            {
                token : "constant.other.multiline",
                regex : /.*\\/
            },
            {
                token : "constant.other",
                regex : "\\s*<.+?>",
                next : "start"
            },
            {
                token : "constant.other", // single line
                regex : '\\s*["](?:(?:\\\\.)|(?:[^"\\\\]))*?["]',
                next : "start"
            }, 
            {
                token : "constant.other", // single line
                regex : "\\s*['](?:(?:\\\\.)|(?:[^'\\\\]))*?[']",
                next : "start"
            },
            {
                token : "constant.other",
                regex : /[^\\\/]+/,
                next : "start"
            }
        ]
    };

    this.embedRules(DocCommentHighlightRules, "doc-",
        [ DocCommentHighlightRules.getEndRule("start") ]);
    this.normalizeRules();
};

oop.inherits(c_cppHighlightRules, TextHighlightRules);

exports.c_cppHighlightRules = c_cppHighlightRules;
});

ace.define("ace/mode/objectivec_highlight_rules",["require","exports","module","ace/lib/oop","ace/mode/doc_comment_highlight_rules","ace/mode/c_cpp_highlight_rules"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../lib/oop");
var DocCommentHighlightRules = acequire("./doc_comment_highlight_rules").DocCommentHighlightRules;
var C_Highlight_File = acequire("./c_cpp_highlight_rules");
var CHighlightRules = C_Highlight_File.c_cppHighlightRules;

var ObjectiveCHighlightRules = function() {

    var escapedConstRe = "\\\\(?:[abefnrtv'\"?\\\\]|" + 
                         "[0-3]\\d{1,2}|" +
                         "[4-7]\\d?|" +
                         "222|" +
                         "x[a-zA-Z0-9]+)";

    var specialVariables = [{
            regex: "\\b_cmd\\b",
            token: "variable.other.selector.objc"
        }, {
            regex: "\\b(?:self|super)\\b",
            token: "variable.language.objc"
        }
    ];

    var cObj = new CHighlightRules();
    var cRules = cObj.getRules();

    this.$rules = {
    "start": [ 
        {
            token : "comment",
            regex : "\\/\\/.*$"
        },
        DocCommentHighlightRules.getStartRule("doc-start"),
        {
            token : "comment", // multi line comment
            regex : "\\/\\*",
            next : "comment"
        }, 
        {
            token: [ "storage.type.objc", "punctuation.definition.storage.type.objc", 
                       "entity.name.type.objc", "text", "entity.other.inherited-class.objc"
                     ],
            regex: "(@)(interface|protocol)(?!.+;)(\\s+[A-Za-z_][A-Za-z0-9_]*)(\\s*:\\s*)([A-Za-z]+)"
        },
        {
            token: [ "storage.type.objc" ],
            regex: "(@end)"
        },
        {
            token: [ "storage.type.objc", "entity.name.type.objc", 
                        "entity.other.inherited-class.objc"
                     ],
            regex: "(@implementation)(\\s+[A-Za-z_][A-Za-z0-9_]*)(\\s*?::\\s*(?:[A-Za-z][A-Za-z0-9]*))?"
        },
        {
            token: "string.begin.objc",
            regex: '@"',
            next: "constant_NSString"
        },
        {
            token: "storage.type.objc",
            regex: "\\bid\\s*<",
            next: "protocol_list"
        },
        {
            token: "keyword.control.macro.objc",
            regex: "\\bNS_DURING|NS_HANDLER|NS_ENDHANDLER\\b"
        },
        {
            token: ["punctuation.definition.keyword.objc", "keyword.control.exception.objc"],
            regex: "(@)(try|catch|finally|throw)\\b"
        },
        {
            token: ["punctuation.definition.keyword.objc", "keyword.other.objc"],
            regex: "(@)(defs|encode)\\b"
        },
        {
            token: ["storage.type.id.objc", "text"],
            regex: "(\\bid\\b)(\\s|\\n)?"
        },
        {
            token: "storage.type.objc",
            regex: "\\bIBOutlet|IBAction|BOOL|SEL|id|unichar|IMP|Class\\b"
        },
        {
            token: [ "punctuation.definition.storage.type.objc", "storage.type.objc"],
            regex: "(@)(class|protocol)\\b"
        },
        {
            token: [ "punctuation.definition.storage.type.objc", "punctuation"],
            regex: "(@selector)(\\s*\\()",
            next: "selectors"
        },
        {
            token: [ "punctuation.definition.storage.modifier.objc", "storage.modifier.objc"],
            regex: "(@)(synchronized|public|private|protected|package)\\b"
        },
        {
            token: "constant.language.objc",
            regex: "\\bYES|NO|Nil|nil\\b"
        },
        {
            token:  "support.variable.foundation",
            regex: "\\bNSApp\\b"
        },
        {
            token: [ "support.function.cocoa.leopard"],
            regex: "(?:\\b)(NS(?:Rect(?:ToCGRect|FromCGRect)|MakeCollectable|S(?:tringFromProtocol|ize(?:ToCGSize|FromCGSize))|Draw(?:NinePartImage|ThreePartImage)|P(?:oint(?:ToCGPoint|FromCGPoint)|rotocolFromString)|EventMaskFromType|Value))(?:\\b)"
        },
        {
            token: ["support.function.cocoa"],
            regex: "(?:\\b)(NS(?:R(?:ound(?:DownToMultipleOfPageSize|UpToMultipleOfPageSize)|un(?:CriticalAlertPanel(?:RelativeToWindow)?|InformationalAlertPanel(?:RelativeToWindow)?|AlertPanel(?:RelativeToWindow)?)|e(?:set(?:MapTable|HashTable)|c(?:ycleZone|t(?:Clip(?:List)?|F(?:ill(?:UsingOperation|List(?:UsingOperation|With(?:Grays|Colors(?:UsingOperation)?))?)?|romString))|ordAllocationEvent)|turnAddress|leaseAlertPanel|a(?:dPixel|l(?:MemoryAvailable|locateCollectable))|gisterServicesProvider)|angeFromString)|Get(?:SizeAndAlignment|CriticalAlertPanel|InformationalAlertPanel|UncaughtExceptionHandler|FileType(?:s)?|WindowServerMemory|AlertPanel)|M(?:i(?:n(?:X|Y)|d(?:X|Y))|ouseInRect|a(?:p(?:Remove|Get|Member|Insert(?:IfAbsent|KnownAbsent)?)|ke(?:R(?:ect|ange)|Size|Point)|x(?:Range|X|Y)))|B(?:itsPer(?:SampleFromDepth|PixelFromDepth)|e(?:stDepth|ep|gin(?:CriticalAlertSheet|InformationalAlertSheet|AlertSheet)))|S(?:ho(?:uldRetainWithZone|w(?:sServicesMenuItem|AnimationEffect))|tringFrom(?:R(?:ect|ange)|MapTable|S(?:ize|elector)|HashTable|Class|Point)|izeFromString|e(?:t(?:ShowsServicesMenuItem|ZoneName|UncaughtExceptionHandler|FocusRingStyle)|lectorFromString|archPathForDirectoriesInDomains)|wap(?:Big(?:ShortToHost|IntToHost|DoubleToHost|FloatToHost|Long(?:ToHost|LongToHost))|Short|Host(?:ShortTo(?:Big|Little)|IntTo(?:Big|Little)|DoubleTo(?:Big|Little)|FloatTo(?:Big|Little)|Long(?:To(?:Big|Little)|LongTo(?:Big|Little)))|Int|Double|Float|L(?:ittle(?:ShortToHost|IntToHost|DoubleToHost|FloatToHost|Long(?:ToHost|LongToHost))|ong(?:Long)?)))|H(?:ighlightRect|o(?:stByteOrder|meDirectory(?:ForUser)?)|eight|ash(?:Remove|Get|Insert(?:IfAbsent|KnownAbsent)?)|FSType(?:CodeFromFileType|OfFile))|N(?:umberOfColorComponents|ext(?:MapEnumeratorPair|HashEnumeratorItem))|C(?:o(?:n(?:tainsRect|vert(?:GlyphsToPackedGlyphs|Swapped(?:DoubleToHost|FloatToHost)|Host(?:DoubleToSwapped|FloatToSwapped)))|unt(?:MapTable|HashTable|Frames|Windows(?:ForContext)?)|py(?:M(?:emoryPages|apTableWithZone)|Bits|HashTableWithZone|Object)|lorSpaceFromDepth|mpare(?:MapTables|HashTables))|lassFromString|reate(?:MapTable(?:WithZone)?|HashTable(?:WithZone)?|Zone|File(?:namePboardType|ContentsPboardType)))|TemporaryDirectory|I(?:s(?:ControllerMarker|EmptyRect|FreedObject)|n(?:setRect|crementExtraRefCount|te(?:r(?:sect(?:sRect|ionR(?:ect|ange))|faceStyleForKey)|gralRect)))|Zone(?:Realloc|Malloc|Name|Calloc|Fr(?:omPointer|ee))|O(?:penStepRootDirectory|ffsetRect)|D(?:i(?:sableScreenUpdates|videRect)|ottedFrameRect|e(?:c(?:imal(?:Round|Multiply|S(?:tring|ubtract)|Normalize|Co(?:py|mpa(?:ct|re))|IsNotANumber|Divide|Power|Add)|rementExtraRefCountWasZero)|faultMallocZone|allocate(?:MemoryPages|Object))|raw(?:Gr(?:oove|ayBezel)|B(?:itmap|utton)|ColorTiledRects|TiledRects|DarkBezel|W(?:hiteBezel|indowBackground)|LightBezel))|U(?:serName|n(?:ionR(?:ect|ange)|registerServicesProvider)|pdateDynamicServices)|Java(?:Bundle(?:Setup|Cleanup)|Setup(?:VirtualMachine)?|Needs(?:ToLoadClasses|VirtualMachine)|ClassesF(?:orBundle|romPath)|ObjectNamedInPath|ProvidesClasses)|P(?:oint(?:InRect|FromString)|erformService|lanarFromDepth|ageSize)|E(?:n(?:d(?:MapTableEnumeration|HashTableEnumeration)|umerate(?:MapTable|HashTable)|ableScreenUpdates)|qual(?:R(?:ects|anges)|Sizes|Points)|raseRect|xtraRefCount)|F(?:ileTypeForHFSTypeCode|ullUserName|r(?:ee(?:MapTable|HashTable)|ame(?:Rect(?:WithWidth(?:UsingOperation)?)?|Address)))|Wi(?:ndowList(?:ForContext)?|dth)|Lo(?:cationInRange|g(?:v|PageSize)?)|A(?:ccessibility(?:R(?:oleDescription(?:ForUIElement)?|aiseBadArgumentException)|Unignored(?:Children(?:ForOnlyChild)?|Descendant|Ancestor)|PostNotification|ActionDescription)|pplication(?:Main|Load)|vailableWindowDepths|ll(?:MapTable(?:Values|Keys)|HashTableObjects|ocate(?:MemoryPages|Collectable|Object)))))(?:\\b)"
        },
        {
            token: ["support.class.cocoa.leopard"],
            regex: "(?:\\b)(NS(?:RuleEditor|G(?:arbageCollector|radient)|MapTable|HashTable|Co(?:ndition|llectionView(?:Item)?)|T(?:oolbarItemGroup|extInputClient|r(?:eeNode|ackingArea))|InvocationOperation|Operation(?:Queue)?|D(?:ictionaryController|ockTile)|P(?:ointer(?:Functions|Array)|athC(?:o(?:ntrol(?:Delegate)?|mponentCell)|ell(?:Delegate)?)|r(?:intPanelAccessorizing|edicateEditor(?:RowTemplate)?))|ViewController|FastEnumeration|Animat(?:ionContext|ablePropertyContainer)))(?:\\b)"
        },
        {
            token: ["support.class.cocoa"],
            regex: "(?:\\b)(NS(?:R(?:u(?:nLoop|ler(?:Marker|View))|e(?:sponder|cursiveLock|lativeSpecifier)|an(?:domSpecifier|geSpecifier))|G(?:etCommand|lyph(?:Generator|Storage|Info)|raphicsContext)|XML(?:Node|D(?:ocument|TD(?:Node)?)|Parser|Element)|M(?:iddleSpecifier|ov(?:ie(?:View)?|eCommand)|utable(?:S(?:tring|et)|C(?:haracterSet|opying)|IndexSet|D(?:ictionary|ata)|URLRequest|ParagraphStyle|A(?:ttributedString|rray))|e(?:ssagePort(?:NameServer)?|nu(?:Item(?:Cell)?|View)?|t(?:hodSignature|adata(?:Item|Query(?:ResultGroup|AttributeValueTuple)?)))|a(?:ch(?:BootstrapServer|Port)|trix))|B(?:itmapImageRep|ox|u(?:ndle|tton(?:Cell)?)|ezierPath|rowser(?:Cell)?)|S(?:hadow|c(?:anner|r(?:ipt(?:SuiteRegistry|C(?:o(?:ercionHandler|mmand(?:Description)?)|lassDescription)|ObjectSpecifier|ExecutionContext|WhoseTest)|oll(?:er|View)|een))|t(?:epper(?:Cell)?|atus(?:Bar|Item)|r(?:ing|eam))|imple(?:HorizontalTypesetter|CString)|o(?:cketPort(?:NameServer)?|und|rtDescriptor)|p(?:e(?:cifierTest|ech(?:Recognizer|Synthesizer)|ll(?:Server|Checker))|litView)|e(?:cureTextField(?:Cell)?|t(?:Command)?|archField(?:Cell)?|rializer|gmentedC(?:ontrol|ell))|lider(?:Cell)?|avePanel)|H(?:ost|TTP(?:Cookie(?:Storage)?|URLResponse)|elpManager)|N(?:ib(?:Con(?:nector|trolConnector)|OutletConnector)?|otification(?:Center|Queue)?|u(?:ll|mber(?:Formatter)?)|etService(?:Browser)?|ameSpecifier)|C(?:ha(?:ngeSpelling|racterSet)|o(?:n(?:stantString|nection|trol(?:ler)?|ditionLock)|d(?:ing|er)|unt(?:Command|edSet)|pying|lor(?:Space|P(?:ick(?:ing(?:Custom|Default)|er)|anel)|Well|List)?|m(?:p(?:oundPredicate|arisonPredicate)|boBox(?:Cell)?))|u(?:stomImageRep|rsor)|IImageRep|ell|l(?:ipView|o(?:seCommand|neCommand)|assDescription)|a(?:ched(?:ImageRep|URLResponse)|lendar(?:Date)?)|reateCommand)|T(?:hread|ypesetter|ime(?:Zone|r)|o(?:olbar(?:Item(?:Validations)?)?|kenField(?:Cell)?)|ext(?:Block|Storage|Container|Tab(?:le(?:Block)?)?|Input|View|Field(?:Cell)?|List|Attachment(?:Cell)?)?|a(?:sk|b(?:le(?:Header(?:Cell|View)|Column|View)|View(?:Item)?))|reeController)|I(?:n(?:dex(?:S(?:pecifier|et)|Path)|put(?:Manager|S(?:tream|erv(?:iceProvider|er(?:MouseTracker)?)))|vocation)|gnoreMisspelledWords|mage(?:Rep|Cell|View)?)|O(?:ut(?:putStream|lineView)|pen(?:GL(?:Context|Pixel(?:Buffer|Format)|View)|Panel)|bj(?:CTypeSerializationCallBack|ect(?:Controller)?))|D(?:i(?:st(?:antObject(?:Request)?|ributed(?:NotificationCenter|Lock))|ctionary|rectoryEnumerator)|ocument(?:Controller)?|e(?:serializer|cimalNumber(?:Behaviors|Handler)?|leteCommand)|at(?:e(?:Components|Picker(?:Cell)?|Formatter)?|a)|ra(?:wer|ggingInfo))|U(?:ser(?:InterfaceValidations|Defaults(?:Controller)?)|RL(?:Re(?:sponse|quest)|Handle(?:Client)?|C(?:onnection|ache|redential(?:Storage)?)|Download(?:Delegate)?|Prot(?:ocol(?:Client)?|ectionSpace)|AuthenticationChallenge(?:Sender)?)?|n(?:iqueIDSpecifier|doManager|archiver))|P(?:ipe|o(?:sitionalSpecifier|pUpButton(?:Cell)?|rt(?:Message|NameServer|Coder)?)|ICTImageRep|ersistentDocument|DFImageRep|a(?:steboard|nel|ragraphStyle|geLayout)|r(?:int(?:Info|er|Operation|Panel)|o(?:cessInfo|tocolChecker|perty(?:Specifier|ListSerialization)|gressIndicator|xy)|edicate))|E(?:numerator|vent|PSImageRep|rror|x(?:ception|istsCommand|pression))|V(?:iew(?:Animation)?|al(?:idated(?:ToobarItem|UserInterfaceItem)|ue(?:Transformer)?))|Keyed(?:Unarchiver|Archiver)|Qui(?:ckDrawView|tCommand)|F(?:ile(?:Manager|Handle|Wrapper)|o(?:nt(?:Manager|Descriptor|Panel)?|rm(?:Cell|atter)))|W(?:hoseSpecifier|indow(?:Controller)?|orkspace)|L(?:o(?:c(?:k(?:ing)?|ale)|gicalTest)|evelIndicator(?:Cell)?|ayoutManager)|A(?:ssertionHandler|nimation|ctionCell|ttributedString|utoreleasePool|TSTypesetter|ppl(?:ication|e(?:Script|Event(?:Manager|Descriptor)))|ffineTransform|lert|r(?:chiver|ray(?:Controller)?))))(?:\\b)"
        },
        {
            token: ["support.type.cocoa.leopard"],
            regex: "(?:\\b)(NS(?:R(?:u(?:nLoop|ler(?:Marker|View))|e(?:sponder|cursiveLock|lativeSpecifier)|an(?:domSpecifier|geSpecifier))|G(?:etCommand|lyph(?:Generator|Storage|Info)|raphicsContext)|XML(?:Node|D(?:ocument|TD(?:Node)?)|Parser|Element)|M(?:iddleSpecifier|ov(?:ie(?:View)?|eCommand)|utable(?:S(?:tring|et)|C(?:haracterSet|opying)|IndexSet|D(?:ictionary|ata)|URLRequest|ParagraphStyle|A(?:ttributedString|rray))|e(?:ssagePort(?:NameServer)?|nu(?:Item(?:Cell)?|View)?|t(?:hodSignature|adata(?:Item|Query(?:ResultGroup|AttributeValueTuple)?)))|a(?:ch(?:BootstrapServer|Port)|trix))|B(?:itmapImageRep|ox|u(?:ndle|tton(?:Cell)?)|ezierPath|rowser(?:Cell)?)|S(?:hadow|c(?:anner|r(?:ipt(?:SuiteRegistry|C(?:o(?:ercionHandler|mmand(?:Description)?)|lassDescription)|ObjectSpecifier|ExecutionContext|WhoseTest)|oll(?:er|View)|een))|t(?:epper(?:Cell)?|atus(?:Bar|Item)|r(?:ing|eam))|imple(?:HorizontalTypesetter|CString)|o(?:cketPort(?:NameServer)?|und|rtDescriptor)|p(?:e(?:cifierTest|ech(?:Recognizer|Synthesizer)|ll(?:Server|Checker))|litView)|e(?:cureTextField(?:Cell)?|t(?:Command)?|archField(?:Cell)?|rializer|gmentedC(?:ontrol|ell))|lider(?:Cell)?|avePanel)|H(?:ost|TTP(?:Cookie(?:Storage)?|URLResponse)|elpManager)|N(?:ib(?:Con(?:nector|trolConnector)|OutletConnector)?|otification(?:Center|Queue)?|u(?:ll|mber(?:Formatter)?)|etService(?:Browser)?|ameSpecifier)|C(?:ha(?:ngeSpelling|racterSet)|o(?:n(?:stantString|nection|trol(?:ler)?|ditionLock)|d(?:ing|er)|unt(?:Command|edSet)|pying|lor(?:Space|P(?:ick(?:ing(?:Custom|Default)|er)|anel)|Well|List)?|m(?:p(?:oundPredicate|arisonPredicate)|boBox(?:Cell)?))|u(?:stomImageRep|rsor)|IImageRep|ell|l(?:ipView|o(?:seCommand|neCommand)|assDescription)|a(?:ched(?:ImageRep|URLResponse)|lendar(?:Date)?)|reateCommand)|T(?:hread|ypesetter|ime(?:Zone|r)|o(?:olbar(?:Item(?:Validations)?)?|kenField(?:Cell)?)|ext(?:Block|Storage|Container|Tab(?:le(?:Block)?)?|Input|View|Field(?:Cell)?|List|Attachment(?:Cell)?)?|a(?:sk|b(?:le(?:Header(?:Cell|View)|Column|View)|View(?:Item)?))|reeController)|I(?:n(?:dex(?:S(?:pecifier|et)|Path)|put(?:Manager|S(?:tream|erv(?:iceProvider|er(?:MouseTracker)?)))|vocation)|gnoreMisspelledWords|mage(?:Rep|Cell|View)?)|O(?:ut(?:putStream|lineView)|pen(?:GL(?:Context|Pixel(?:Buffer|Format)|View)|Panel)|bj(?:CTypeSerializationCallBack|ect(?:Controller)?))|D(?:i(?:st(?:antObject(?:Request)?|ributed(?:NotificationCenter|Lock))|ctionary|rectoryEnumerator)|ocument(?:Controller)?|e(?:serializer|cimalNumber(?:Behaviors|Handler)?|leteCommand)|at(?:e(?:Components|Picker(?:Cell)?|Formatter)?|a)|ra(?:wer|ggingInfo))|U(?:ser(?:InterfaceValidations|Defaults(?:Controller)?)|RL(?:Re(?:sponse|quest)|Handle(?:Client)?|C(?:onnection|ache|redential(?:Storage)?)|Download(?:Delegate)?|Prot(?:ocol(?:Client)?|ectionSpace)|AuthenticationChallenge(?:Sender)?)?|n(?:iqueIDSpecifier|doManager|archiver))|P(?:ipe|o(?:sitionalSpecifier|pUpButton(?:Cell)?|rt(?:Message|NameServer|Coder)?)|ICTImageRep|ersistentDocument|DFImageRep|a(?:steboard|nel|ragraphStyle|geLayout)|r(?:int(?:Info|er|Operation|Panel)|o(?:cessInfo|tocolChecker|perty(?:Specifier|ListSerialization)|gressIndicator|xy)|edicate))|E(?:numerator|vent|PSImageRep|rror|x(?:ception|istsCommand|pression))|V(?:iew(?:Animation)?|al(?:idated(?:ToobarItem|UserInterfaceItem)|ue(?:Transformer)?))|Keyed(?:Unarchiver|Archiver)|Qui(?:ckDrawView|tCommand)|F(?:ile(?:Manager|Handle|Wrapper)|o(?:nt(?:Manager|Descriptor|Panel)?|rm(?:Cell|atter)))|W(?:hoseSpecifier|indow(?:Controller)?|orkspace)|L(?:o(?:c(?:k(?:ing)?|ale)|gicalTest)|evelIndicator(?:Cell)?|ayoutManager)|A(?:ssertionHandler|nimation|ctionCell|ttributedString|utoreleasePool|TSTypesetter|ppl(?:ication|e(?:Script|Event(?:Manager|Descriptor)))|ffineTransform|lert|r(?:chiver|ray(?:Controller)?))))(?:\\b)"
        },
        {
            token: ["support.class.quartz"],
            regex: "(?:\\b)(C(?:I(?:Sampler|Co(?:ntext|lor)|Image(?:Accumulator)?|PlugIn(?:Registration)?|Vector|Kernel|Filter(?:Generator|Shape)?)|A(?:Renderer|MediaTiming(?:Function)?|BasicAnimation|ScrollLayer|Constraint(?:LayoutManager)?|T(?:iledLayer|extLayer|rans(?:ition|action))|OpenGLLayer|PropertyAnimation|KeyframeAnimation|Layer|A(?:nimation(?:Group)?|ction))))(?:\\b)"
        },
        {
            token: ["support.type.quartz"],
            regex: "(?:\\b)(C(?:G(?:Float|Point|Size|Rect)|IFormat|AConstraintAttribute))(?:\\b)"
        },
        {
            token: ["support.type.cocoa"],
            regex: "(?:\\b)(NS(?:R(?:ect(?:Edge)?|ange)|G(?:lyph(?:Relation|LayoutMode)?|radientType)|M(?:odalSession|a(?:trixMode|p(?:Table|Enumerator)))|B(?:itmapImageFileType|orderType|uttonType|ezelStyle|ackingStoreType|rowserColumnResizingType)|S(?:cr(?:oll(?:er(?:Part|Arrow)|ArrowPosition)|eenAuxiliaryOpaque)|tringEncoding|ize|ocketNativeHandle|election(?:Granularity|Direction|Affinity)|wapped(?:Double|Float)|aveOperationType)|Ha(?:sh(?:Table|Enumerator)|ndler(?:2)?)|C(?:o(?:ntrol(?:Size|Tint)|mp(?:ositingOperation|arisonResult))|ell(?:State|Type|ImagePosition|Attribute))|T(?:hreadPrivate|ypesetterGlyphInfo|i(?:ckMarkPosition|tlePosition|meInterval)|o(?:ol(?:TipTag|bar(?:SizeMode|DisplayMode))|kenStyle)|IFFCompression|ext(?:TabType|Alignment)|ab(?:State|leViewDropOperation|ViewType)|rackingRectTag)|ImageInterpolation|Zone|OpenGL(?:ContextAuxiliary|PixelFormatAuxiliary)|D(?:ocumentChangeType|atePickerElementFlags|ra(?:werState|gOperation))|UsableScrollerParts|P(?:oint|r(?:intingPageOrder|ogressIndicator(?:Style|Th(?:ickness|readInfo))))|EventType|KeyValueObservingOptions|Fo(?:nt(?:SymbolicTraits|TraitMask|Action)|cusRingType)|W(?:indow(?:OrderingMode|Depth)|orkspace(?:IconCreationOptions|LaunchOptions)|ritingDirection)|L(?:ineBreakMode|ayout(?:Status|Direction))|A(?:nimation(?:Progress|Effect)|ppl(?:ication(?:TerminateReply|DelegateReply|PrintReply)|eEventManagerSuspensionID)|ffineTransformStruct|lertStyle)))(?:\\b)"
        },
        {
            token: ["support.constant.cocoa"],
            regex: "(?:\\b)(NS(?:NotFound|Ordered(?:Ascending|Descending|Same)))(?:\\b)"
        },
        {
            token: ["support.constant.notification.cocoa.leopard"],
            regex: "(?:\\b)(NS(?:MenuDidBeginTracking|ViewDidUpdateTrackingAreas)?Notification)(?:\\b)"
        },
        {
            token: ["support.constant.notification.cocoa"],
            regex: "(?:\\b)(NS(?:Menu(?:Did(?:RemoveItem|SendAction|ChangeItem|EndTracking|AddItem)|WillSendAction)|S(?:ystemColorsDidChange|plitView(?:DidResizeSubviews|WillResizeSubviews))|C(?:o(?:nt(?:extHelpModeDid(?:Deactivate|Activate)|rolT(?:intDidChange|extDid(?:BeginEditing|Change|EndEditing)))|lor(?:PanelColorDidChange|ListDidChange)|mboBox(?:Selection(?:IsChanging|DidChange)|Will(?:Dismiss|PopUp)))|lassDescriptionNeededForClass)|T(?:oolbar(?:DidRemoveItem|WillAddItem)|ext(?:Storage(?:DidProcessEditing|WillProcessEditing)|Did(?:BeginEditing|Change|EndEditing)|View(?:DidChange(?:Selection|TypingAttributes)|WillChangeNotifyingTextView))|ableView(?:Selection(?:IsChanging|DidChange)|ColumnDid(?:Resize|Move)))|ImageRepRegistryDidChange|OutlineView(?:Selection(?:IsChanging|DidChange)|ColumnDid(?:Resize|Move)|Item(?:Did(?:Collapse|Expand)|Will(?:Collapse|Expand)))|Drawer(?:Did(?:Close|Open)|Will(?:Close|Open))|PopUpButton(?:CellWillPopUp|WillPopUp)|View(?:GlobalFrameDidChange|BoundsDidChange|F(?:ocusDidChange|rameDidChange))|FontSetChanged|W(?:indow(?:Did(?:Resi(?:ze|gn(?:Main|Key))|M(?:iniaturize|ove)|Become(?:Main|Key)|ChangeScreen(?:|Profile)|Deminiaturize|Update|E(?:ndSheet|xpose))|Will(?:M(?:iniaturize|ove)|BeginSheet|Close))|orkspace(?:SessionDid(?:ResignActive|BecomeActive)|Did(?:Mount|TerminateApplication|Unmount|PerformFileOperation|Wake|LaunchApplication)|Will(?:Sleep|Unmount|PowerOff|LaunchApplication)))|A(?:ntialiasThresholdChanged|ppl(?:ication(?:Did(?:ResignActive|BecomeActive|Hide|ChangeScreenParameters|U(?:nhide|pdate)|FinishLaunching)|Will(?:ResignActive|BecomeActive|Hide|Terminate|U(?:nhide|pdate)|FinishLaunching))|eEventManagerWillProcessFirstEvent)))Notification)(?:\\b)"
        },
        {
            token: ["support.constant.cocoa.leopard"],
            regex: "(?:\\b)(NS(?:RuleEditor(?:RowType(?:Simple|Compound)|NestingMode(?:Si(?:ngle|mple)|Compound|List))|GradientDraws(?:BeforeStartingLocation|AfterEndingLocation)|M(?:inusSetExpressionType|a(?:chPortDeallocate(?:ReceiveRight|SendRight|None)|pTable(?:StrongMemory|CopyIn|ZeroingWeakMemory|ObjectPointerPersonality)))|B(?:oxCustom|undleExecutableArchitecture(?:X86|I386|PPC(?:64)?)|etweenPredicateOperatorType|ackgroundStyle(?:Raised|Dark|L(?:ight|owered)))|S(?:tring(?:DrawingTruncatesLastVisibleLine|EncodingConversion(?:ExternalRepresentation|AllowLossy))|ubqueryExpressionType|p(?:e(?:ech(?:SentenceBoundary|ImmediateBoundary|WordBoundary)|llingState(?:GrammarFlag|SpellingFlag))|litViewDividerStyleThi(?:n|ck))|e(?:rvice(?:RequestTimedOutError|M(?:iscellaneousError|alformedServiceDictionaryError)|InvalidPasteboardDataError|ErrorM(?:inimum|aximum)|Application(?:NotFoundError|LaunchFailedError))|gmentStyle(?:Round(?:Rect|ed)|SmallSquare|Capsule|Textured(?:Rounded|Square)|Automatic)))|H(?:UDWindowMask|ashTable(?:StrongMemory|CopyIn|ZeroingWeakMemory|ObjectPointerPersonality))|N(?:oModeColorPanel|etServiceNoAutoRename)|C(?:hangeRedone|o(?:ntainsPredicateOperatorType|l(?:orRenderingIntent(?:RelativeColorimetric|Saturation|Default|Perceptual|AbsoluteColorimetric)|lectorDisabledOption))|ellHit(?:None|ContentArea|TrackableArea|EditableTextArea))|T(?:imeZoneNameStyle(?:S(?:hort(?:Standard|DaylightSaving)|tandard)|DaylightSaving)|extFieldDatePickerStyle|ableViewSelectionHighlightStyle(?:Regular|SourceList)|racking(?:Mouse(?:Moved|EnteredAndExited)|CursorUpdate|InVisibleRect|EnabledDuringMouseDrag|A(?:ssumeInside|ctive(?:In(?:KeyWindow|ActiveApp)|WhenFirstResponder|Always))))|I(?:n(?:tersectSetExpressionType|dexedColorSpaceModel)|mageScale(?:None|Proportionally(?:Down|UpOrDown)|AxesIndependently))|Ope(?:nGLPFAAllowOfflineRenderers|rationQueue(?:DefaultMaxConcurrentOperationCount|Priority(?:High|Normal|Very(?:High|Low)|Low)))|D(?:iacriticInsensitiveSearch|ownloadsDirectory)|U(?:nionSetExpressionType|TF(?:16(?:BigEndianStringEncoding|StringEncoding|LittleEndianStringEncoding)|32(?:BigEndianStringEncoding|StringEncoding|LittleEndianStringEncoding)))|P(?:ointerFunctions(?:Ma(?:chVirtualMemory|llocMemory)|Str(?:ongMemory|uctPersonality)|C(?:StringPersonality|opyIn)|IntegerPersonality|ZeroingWeakMemory|O(?:paque(?:Memory|Personality)|bjectP(?:ointerPersonality|ersonality)))|at(?:hStyle(?:Standard|NavigationBar|PopUp)|ternColorSpaceModel)|rintPanelShows(?:Scaling|Copies|Orientation|P(?:a(?:perSize|ge(?:Range|SetupAccessory))|review)))|Executable(?:RuntimeMismatchError|NotLoadableError|ErrorM(?:inimum|aximum)|L(?:inkError|oadError)|ArchitectureMismatchError)|KeyValueObservingOption(?:Initial|Prior)|F(?:i(?:ndPanelSubstringMatchType(?:StartsWith|Contains|EndsWith|FullWord)|leRead(?:TooLargeError|UnknownStringEncodingError))|orcedOrderingSearch)|Wi(?:ndow(?:BackingLocation(?:MainMemory|Default|VideoMemory)|Sharing(?:Read(?:Only|Write)|None)|CollectionBehavior(?:MoveToActiveSpace|CanJoinAllSpaces|Default))|dthInsensitiveSearch)|AggregateExpressionType))(?:\\b)"
        },
        {
            token: ["support.constant.cocoa"],
            regex: "(?:\\b)(NS(?:R(?:GB(?:ModeColorPanel|ColorSpaceModel)|ight(?:Mouse(?:D(?:own(?:Mask)?|ragged(?:Mask)?)|Up(?:Mask)?)|T(?:ext(?:Movement|Alignment)|ab(?:sBezelBorder|StopType))|ArrowFunctionKey)|ound(?:RectBezelStyle|Bankers|ed(?:BezelStyle|TokenStyle|DisclosureBezelStyle)|Down|Up|Plain|Line(?:CapStyle|JoinStyle))|un(?:StoppedResponse|ContinuesResponse|AbortedResponse)|e(?:s(?:izableWindowMask|et(?:CursorRectsRunLoopOrdering|FunctionKey))|ce(?:ssedBezelStyle|iver(?:sCantHandleCommandScriptError|EvaluationScriptError))|turnTextMovement|doFunctionKey|quiredArgumentsMissingScriptError|l(?:evancyLevelIndicatorStyle|ative(?:Before|After))|gular(?:SquareBezelStyle|ControlSize)|moveTraitFontAction)|a(?:n(?:domSubelement|geDateMode)|tingLevelIndicatorStyle|dio(?:ModeMatrix|Button)))|G(?:IFFileType|lyph(?:Below|Inscribe(?:B(?:elow|ase)|Over(?:strike|Below)|Above)|Layout(?:WithPrevious|A(?:tAPoint|gainstAPoint))|A(?:ttribute(?:BidiLevel|Soft|Inscribe|Elastic)|bove))|r(?:ooveBorder|eaterThan(?:Comparison|OrEqualTo(?:Comparison|PredicateOperatorType)|PredicateOperatorType)|a(?:y(?:ModeColorPanel|ColorSpaceModel)|dient(?:None|Con(?:cave(?:Strong|Weak)|vex(?:Strong|Weak)))|phiteControlTint)))|XML(?:N(?:o(?:tationDeclarationKind|de(?:CompactEmptyElement|IsCDATA|OptionsNone|Use(?:SingleQuotes|DoubleQuotes)|Pre(?:serve(?:NamespaceOrder|C(?:haracterReferences|DATA)|DTD|Prefixes|E(?:ntities|mptyElements)|Quotes|Whitespace|A(?:ttributeOrder|ll))|ttyPrint)|ExpandEmptyElement))|amespaceKind)|CommentKind|TextKind|InvalidKind|D(?:ocument(?:X(?:MLKind|HTMLKind|Include)|HTMLKind|T(?:idy(?:XML|HTML)|extKind)|IncludeContentTypeDeclaration|Validate|Kind)|TDKind)|P(?:arser(?:GTRequiredError|XMLDeclNot(?:StartedError|FinishedError)|Mi(?:splaced(?:XMLDeclarationError|CDATAEndStringError)|xedContentDeclNot(?:StartedError|FinishedError))|S(?:t(?:andaloneValueError|ringNot(?:StartedError|ClosedError))|paceRequiredError|eparatorRequiredError)|N(?:MTOKENRequiredError|o(?:t(?:ationNot(?:StartedError|FinishedError)|WellBalancedError)|DTDError)|amespaceDeclarationError|AMERequiredError)|C(?:haracterRef(?:In(?:DTDError|PrologError|EpilogError)|AtEOFError)|o(?:nditionalSectionNot(?:StartedError|FinishedError)|mment(?:NotFinishedError|ContainsDoubleHyphenError))|DATANotFinishedError)|TagNameMismatchError|In(?:ternalError|valid(?:HexCharacterRefError|C(?:haracter(?:RefError|InEntityError|Error)|onditionalSectionError)|DecimalCharacterRefError|URIError|Encoding(?:NameError|Error)))|OutOfMemoryError|D(?:ocumentStartError|elegateAbortedParseError|OCTYPEDeclNotFinishedError)|U(?:RI(?:RequiredError|FragmentError)|n(?:declaredEntityError|parsedEntityError|knownEncodingError|finishedTagError))|P(?:CDATARequiredError|ublicIdentifierRequiredError|arsedEntityRef(?:MissingSemiError|NoNameError|In(?:Internal(?:SubsetError|Error)|PrologError|EpilogError)|AtEOFError)|r(?:ocessingInstructionNot(?:StartedError|FinishedError)|ematureDocumentEndError))|E(?:n(?:codingNotSupportedError|tity(?:Ref(?:In(?:DTDError|PrologError|EpilogError)|erence(?:MissingSemiError|WithoutNameError)|LoopError|AtEOFError)|BoundaryError|Not(?:StartedError|FinishedError)|Is(?:ParameterError|ExternalError)|ValueRequiredError))|qualExpectedError|lementContentDeclNot(?:StartedError|FinishedError)|xt(?:ernalS(?:tandaloneEntityError|ubsetNotFinishedError)|raContentError)|mptyDocumentError)|L(?:iteralNot(?:StartedError|FinishedError)|T(?:RequiredError|SlashRequiredError)|essThanSymbolInAttributeError)|Attribute(?:RedefinedError|HasNoValueError|Not(?:StartedError|FinishedError)|ListNot(?:StartedError|FinishedError)))|rocessingInstructionKind)|E(?:ntity(?:GeneralKind|DeclarationKind|UnparsedKind|P(?:ar(?:sedKind|ameterKind)|redefined))|lement(?:Declaration(?:MixedKind|UndefinedKind|E(?:lementKind|mptyKind)|Kind|AnyKind)|Kind))|Attribute(?:N(?:MToken(?:sKind|Kind)|otationKind)|CDATAKind|ID(?:Ref(?:sKind|Kind)|Kind)|DeclarationKind|En(?:tit(?:yKind|iesKind)|umerationKind)|Kind))|M(?:i(?:n(?:XEdge|iaturizableWindowMask|YEdge|uteCalendarUnit)|terLineJoinStyle|ddleSubelement|xedState)|o(?:nthCalendarUnit|deSwitchFunctionKey|use(?:Moved(?:Mask)?|E(?:ntered(?:Mask)?|ventSubtype|xited(?:Mask)?))|veToBezierPathElement|mentary(?:ChangeButton|Push(?:Button|InButton)|Light(?:Button)?))|enuFunctionKey|a(?:c(?:intoshInterfaceStyle|OSRomanStringEncoding)|tchesPredicateOperatorType|ppedRead|x(?:XEdge|YEdge))|ACHOperatingSystem)|B(?:MPFileType|o(?:ttomTabsBezelBorder|ldFontMask|rderlessWindowMask|x(?:Se(?:condary|parator)|OldStyle|Primary))|uttLineCapStyle|e(?:zelBorder|velLineJoinStyle|low(?:Bottom|Top)|gin(?:sWith(?:Comparison|PredicateOperatorType)|FunctionKey))|lueControlTint|ack(?:spaceCharacter|tabTextMovement|ingStore(?:Retained|Buffered|Nonretained)|TabCharacter|wardsSearch|groundTab)|r(?:owser(?:NoColumnResizing|UserColumnResizing|AutoColumnResizing)|eakFunctionKey))|S(?:h(?:ift(?:JISStringEncoding|KeyMask)|ow(?:ControlGlyphs|InvisibleGlyphs)|adowlessSquareBezelStyle)|y(?:s(?:ReqFunctionKey|tem(?:D(?:omainMask|efined(?:Mask)?)|FunctionKey))|mbolStringEncoding)|c(?:a(?:nnedOption|le(?:None|ToFit|Proportionally))|r(?:oll(?:er(?:NoPart|Increment(?:Page|Line|Arrow)|Decrement(?:Page|Line|Arrow)|Knob(?:Slot)?|Arrows(?:M(?:inEnd|axEnd)|None|DefaultSetting))|Wheel(?:Mask)?|LockFunctionKey)|eenChangedEventType))|t(?:opFunctionKey|r(?:ingDrawing(?:OneShot|DisableScreenFontSubstitution|Uses(?:DeviceMetrics|FontLeading|LineFragmentOrigin))|eam(?:Status(?:Reading|NotOpen|Closed|Open(?:ing)?|Error|Writing|AtEnd)|Event(?:Has(?:BytesAvailable|SpaceAvailable)|None|OpenCompleted|E(?:ndEncountered|rrorOccurred)))))|i(?:ngle(?:DateMode|UnderlineStyle)|ze(?:DownFontAction|UpFontAction))|olarisOperatingSystem|unOSOperatingSystem|pecialPageOrder|e(?:condCalendarUnit|lect(?:By(?:Character|Paragraph|Word)|i(?:ng(?:Next|Previous)|onAffinity(?:Downstream|Upstream))|edTab|FunctionKey)|gmentSwitchTracking(?:Momentary|Select(?:One|Any)))|quareLineCapStyle|witchButton|ave(?:ToOperation|Op(?:tions(?:Yes|No|Ask)|eration)|AsOperation)|mall(?:SquareBezelStyle|C(?:ontrolSize|apsFontMask)|IconButtonBezelStyle))|H(?:ighlightModeMatrix|SBModeColorPanel|o(?:ur(?:Minute(?:SecondDatePickerElementFlag|DatePickerElementFlag)|CalendarUnit)|rizontalRuler|meFunctionKey)|TTPCookieAcceptPolicy(?:Never|OnlyFromMainDocumentDomain|Always)|e(?:lp(?:ButtonBezelStyle|KeyMask|FunctionKey)|avierFontAction)|PUXOperatingSystem)|Year(?:MonthDa(?:yDatePickerElementFlag|tePickerElementFlag)|CalendarUnit)|N(?:o(?:n(?:StandardCharacterSetFontMask|ZeroWindingRule|activatingPanelMask|LossyASCIIStringEncoding)|Border|t(?:ification(?:SuspensionBehavior(?:Hold|Coalesce|D(?:eliverImmediately|rop))|NoCoalescing|CoalescingOn(?:Sender|Name)|DeliverImmediately|PostToAllSessions)|PredicateType|EqualToPredicateOperatorType)|S(?:cr(?:iptError|ollerParts)|ubelement|pecifierError)|CellMask|T(?:itle|opLevelContainersSpecifierError|abs(?:BezelBorder|NoBorder|LineBorder))|I(?:nterfaceStyle|mage)|UnderlineStyle|FontChangeAction)|u(?:ll(?:Glyph|CellType)|m(?:eric(?:Search|PadKeyMask)|berFormatter(?:Round(?:Half(?:Down|Up|Even)|Ceiling|Down|Up|Floor)|Behavior(?:10|Default)|S(?:cientificStyle|pellOutStyle)|NoStyle|CurrencyStyle|DecimalStyle|P(?:ercentStyle|ad(?:Before(?:Suffix|Prefix)|After(?:Suffix|Prefix))))))|e(?:t(?:Services(?:BadArgumentError|NotFoundError|C(?:ollisionError|ancelledError)|TimeoutError|InvalidError|UnknownError|ActivityInProgress)|workDomainMask)|wlineCharacter|xt(?:StepInterfaceStyle|FunctionKey))|EXTSTEPStringEncoding|a(?:t(?:iveShortGlyphPacking|uralTextAlignment)|rrowFontMask))|C(?:hange(?:ReadOtherContents|GrayCell(?:Mask)?|BackgroundCell(?:Mask)?|Cleared|Done|Undone|Autosaved)|MYK(?:ModeColorPanel|ColorSpaceModel)|ircular(?:BezelStyle|Slider)|o(?:n(?:stantValueExpressionType|t(?:inuousCapacityLevelIndicatorStyle|entsCellMask|ain(?:sComparison|erSpecifierError)|rol(?:Glyph|KeyMask))|densedFontMask)|lor(?:Panel(?:RGBModeMask|GrayModeMask|HSBModeMask|C(?:MYKModeMask|olorListModeMask|ustomPaletteModeMask|rayonModeMask)|WheelModeMask|AllModesMask)|ListModeColorPanel)|reServiceDirectory|m(?:p(?:osite(?:XOR|Source(?:In|O(?:ut|ver)|Atop)|Highlight|C(?:opy|lear)|Destination(?:In|O(?:ut|ver)|Atop)|Plus(?:Darker|Lighter))|ressedFontMask)|mandKeyMask))|u(?:stom(?:SelectorPredicateOperatorType|PaletteModeColorPanel)|r(?:sor(?:Update(?:Mask)?|PointingDevice)|veToBezierPathElement))|e(?:nterT(?:extAlignment|abStopType)|ll(?:State|H(?:ighlighted|as(?:Image(?:Horizontal|OnLeftOrBottom)|OverlappingImage))|ChangesContents|Is(?:Bordered|InsetButton)|Disabled|Editable|LightsBy(?:Gray|Background|Contents)|AllowsMixedState))|l(?:ipPagination|o(?:s(?:ePathBezierPathElement|ableWindowMask)|ckAndCalendarDatePickerStyle)|ear(?:ControlTint|DisplayFunctionKey|LineFunctionKey))|a(?:seInsensitive(?:Search|PredicateOption)|n(?:notCreateScriptCommandError|cel(?:Button|TextMovement))|chesDirectory|lculation(?:NoError|Overflow|DivideByZero|Underflow|LossOfPrecision)|rriageReturnCharacter)|r(?:itical(?:Request|AlertStyle)|ayonModeColorPanel))|T(?:hick(?:SquareBezelStyle|erSquareBezelStyle)|ypesetter(?:Behavior|HorizontalTabAction|ContainerBreakAction|ZeroAdvancementAction|OriginalBehavior|ParagraphBreakAction|WhitespaceAction|L(?:ineBreakAction|atestBehavior))|i(?:ckMark(?:Right|Below|Left|Above)|tledWindowMask|meZoneDatePickerElementFlag)|o(?:olbarItemVisibilityPriority(?:Standard|High|User|Low)|pTabsBezelBorder|ggleButton)|IFF(?:Compression(?:N(?:one|EXT)|CCITTFAX(?:3|4)|OldJPEG|JPEG|PackBits|LZW)|FileType)|e(?:rminate(?:Now|Cancel|Later)|xt(?:Read(?:InapplicableDocumentTypeError|WriteErrorM(?:inimum|aximum))|Block(?:M(?:i(?:nimum(?:Height|Width)|ddleAlignment)|a(?:rgin|ximum(?:Height|Width)))|B(?:o(?:ttomAlignment|rder)|aselineAlignment)|Height|TopAlignment|P(?:ercentageValueType|adding)|Width|AbsoluteValueType)|StorageEdited(?:Characters|Attributes)|CellType|ured(?:RoundedBezelStyle|BackgroundWindowMask|SquareBezelStyle)|Table(?:FixedLayoutAlgorithm|AutomaticLayoutAlgorithm)|Field(?:RoundedBezel|SquareBezel|AndStepperDatePickerStyle)|WriteInapplicableDocumentTypeError|ListPrependEnclosingMarker))|woByteGlyphPacking|ab(?:Character|TextMovement|le(?:tP(?:oint(?:Mask|EventSubtype)?|roximity(?:Mask|EventSubtype)?)|Column(?:NoResizing|UserResizingMask|AutoresizingMask)|View(?:ReverseSequentialColumnAutoresizingStyle|GridNone|S(?:olid(?:HorizontalGridLineMask|VerticalGridLineMask)|equentialColumnAutoresizingStyle)|NoColumnAutoresizing|UniformColumnAutoresizingStyle|FirstColumnOnlyAutoresizingStyle|LastColumnOnlyAutoresizingStyle)))|rackModeMatrix)|I(?:n(?:sert(?:CharFunctionKey|FunctionKey|LineFunctionKey)|t(?:Type|ernalS(?:criptError|pecifierError))|dexSubelement|validIndexSpecifierError|formational(?:Request|AlertStyle)|PredicateOperatorType)|talicFontMask|SO(?:2022JPStringEncoding|Latin(?:1StringEncoding|2StringEncoding))|dentityMappingCharacterCollection|llegalTextMovement|mage(?:R(?:ight|ep(?:MatchesDevice|LoadStatus(?:ReadingHeader|Completed|InvalidData|Un(?:expectedEOF|knownType)|WillNeedAllData)))|Below|C(?:ellType|ache(?:BySize|Never|Default|Always))|Interpolation(?:High|None|Default|Low)|O(?:nly|verlaps)|Frame(?:Gr(?:oove|ayBezel)|Button|None|Photo)|L(?:oadStatus(?:ReadError|C(?:ompleted|ancelled)|InvalidData|UnexpectedEOF)|eft)|A(?:lign(?:Right|Bottom(?:Right|Left)?|Center|Top(?:Right|Left)?|Left)|bove)))|O(?:n(?:State|eByteGlyphPacking|OffButton|lyScrollerArrows)|ther(?:Mouse(?:D(?:own(?:Mask)?|ragged(?:Mask)?)|Up(?:Mask)?)|TextMovement)|SF1OperatingSystem|pe(?:n(?:GL(?:GO(?:Re(?:setLibrary|tainRenderers)|ClearFormatCache|FormatCacheSize)|PFA(?:R(?:obust|endererID)|M(?:inimumPolicy|ulti(?:sample|Screen)|PSafe|aximumPolicy)|BackingStore|S(?:creenMask|te(?:ncilSize|reo)|ingleRenderer|upersample|ample(?:s|Buffers|Alpha))|NoRecovery|C(?:o(?:lor(?:Size|Float)|mpliant)|losestPolicy)|OffScreen|D(?:oubleBuffer|epthSize)|PixelBuffer|VirtualScreenCount|FullScreen|Window|A(?:cc(?:umSize|elerated)|ux(?:Buffers|DepthStencil)|l(?:phaSize|lRenderers))))|StepUnicodeReservedBase)|rationNotSupportedForKeyS(?:criptError|pecifierError))|ffState|KButton|rPredicateType|bjC(?:B(?:itfield|oolType)|S(?:hortType|tr(?:ingType|uctType)|electorType)|NoType|CharType|ObjectType|DoubleType|UnionType|PointerType|VoidType|FloatType|Long(?:Type|longType)|ArrayType))|D(?:i(?:s(?:c(?:losureBezelStyle|reteCapacityLevelIndicatorStyle)|playWindowRunLoopOrdering)|acriticInsensitivePredicateOption|rect(?:Selection|PredicateModifier))|o(?:c(?:ModalWindowMask|ument(?:Directory|ationDirectory))|ubleType|wn(?:TextMovement|ArrowFunctionKey))|e(?:s(?:cendingPageOrder|ktopDirectory)|cimalTabStopType|v(?:ice(?:NColorSpaceModel|IndependentModifierFlagsMask)|eloper(?:Directory|ApplicationDirectory))|fault(?:ControlTint|TokenStyle)|lete(?:Char(?:acter|FunctionKey)|FunctionKey|LineFunctionKey)|moApplicationDirectory)|a(?:yCalendarUnit|teFormatter(?:MediumStyle|Behavior(?:10|Default)|ShortStyle|NoStyle|FullStyle|LongStyle))|ra(?:wer(?:Clos(?:ingState|edState)|Open(?:ingState|State))|gOperation(?:Generic|Move|None|Copy|Delete|Private|Every|Link|All)))|U(?:ser(?:CancelledError|D(?:irectory|omainMask)|FunctionKey)|RL(?:Handle(?:NotLoaded|Load(?:Succeeded|InProgress|Failed))|CredentialPersistence(?:None|Permanent|ForSession))|n(?:scaledWindowMask|cachedRead|i(?:codeStringEncoding|talicFontMask|fiedTitleAndToolbarWindowMask)|d(?:o(?:CloseGroupingRunLoopOrdering|FunctionKey)|e(?:finedDateComponent|rline(?:Style(?:Single|None|Thick|Double)|Pattern(?:Solid|D(?:ot|ash(?:Dot(?:Dot)?)?)))))|known(?:ColorSpaceModel|P(?:ointingDevice|ageOrder)|KeyS(?:criptError|pecifierError))|boldFontMask)|tilityWindowMask|TF8StringEncoding|p(?:dateWindowsRunLoopOrdering|TextMovement|ArrowFunctionKey))|J(?:ustifiedTextAlignment|PEG(?:2000FileType|FileType)|apaneseEUC(?:GlyphPacking|StringEncoding))|P(?:o(?:s(?:t(?:Now|erFontMask|WhenIdle|ASAP)|iti(?:on(?:Replace|Be(?:fore|ginning)|End|After)|ve(?:IntType|DoubleType|FloatType)))|pUp(?:NoArrow|ArrowAt(?:Bottom|Center))|werOffEventType|rtraitOrientation)|NGFileType|ush(?:InCell(?:Mask)?|OnPushOffButton)|e(?:n(?:TipMask|UpperSideMask|PointingDevice|LowerSideMask)|riodic(?:Mask)?)|P(?:S(?:caleField|tatus(?:Title|Field)|aveButton)|N(?:ote(?:Title|Field)|ame(?:Title|Field))|CopiesField|TitleField|ImageButton|OptionsButton|P(?:a(?:perFeedButton|ge(?:Range(?:To|From)|ChoiceMatrix))|reviewButton)|LayoutButton)|lainTextTokenStyle|a(?:useFunctionKey|ragraphSeparatorCharacter|ge(?:DownFunctionKey|UpFunctionKey))|r(?:int(?:ing(?:ReplyLater|Success|Cancelled|Failure)|ScreenFunctionKey|erTable(?:NotFound|OK|Error)|FunctionKey)|o(?:p(?:ertyList(?:XMLFormat|MutableContainers(?:AndLeaves)?|BinaryFormat|Immutable|OpenStepFormat)|rietaryStringEncoding)|gressIndicator(?:BarStyle|SpinningStyle|Preferred(?:SmallThickness|Thickness|LargeThickness|AquaThickness)))|e(?:ssedTab|vFunctionKey))|L(?:HeightForm|CancelButton|TitleField|ImageButton|O(?:KButton|rientationMatrix)|UnitsButton|PaperNameButton|WidthForm))|E(?:n(?:terCharacter|d(?:sWith(?:Comparison|PredicateOperatorType)|FunctionKey))|v(?:e(?:nOddWindingRule|rySubelement)|aluatedObjectExpressionType)|qualTo(?:Comparison|PredicateOperatorType)|ra(?:serPointingDevice|CalendarUnit|DatePickerElementFlag)|x(?:clude(?:10|QuickDrawElementsIconCreationOption)|pandedFontMask|ecuteFunctionKey))|V(?:i(?:ew(?:M(?:in(?:XMargin|YMargin)|ax(?:XMargin|YMargin))|HeightSizable|NotSizable|WidthSizable)|aPanelFontAction)|erticalRuler|a(?:lidationErrorM(?:inimum|aximum)|riableExpressionType))|Key(?:SpecifierEvaluationScriptError|Down(?:Mask)?|Up(?:Mask)?|PathExpressionType|Value(?:MinusSetMutation|SetSetMutation|Change(?:Re(?:placement|moval)|Setting|Insertion)|IntersectSetMutation|ObservingOption(?:New|Old)|UnionSetMutation|ValidationError))|QTMovie(?:NormalPlayback|Looping(?:BackAndForthPlayback|Playback))|F(?:1(?:1FunctionKey|7FunctionKey|2FunctionKey|8FunctionKey|3FunctionKey|9FunctionKey|4FunctionKey|5FunctionKey|FunctionKey|0FunctionKey|6FunctionKey)|7FunctionKey|i(?:nd(?:PanelAction(?:Replace(?:A(?:ndFind|ll(?:InSelection)?))?|S(?:howFindPanel|e(?:tFindString|lectAll(?:InSelection)?))|Next|Previous)|FunctionKey)|tPagination|le(?:Read(?:No(?:SuchFileError|PermissionError)|CorruptFileError|In(?:validFileNameError|applicableStringEncodingError)|Un(?:supportedSchemeError|knownError))|HandlingPanel(?:CancelButton|OKButton)|NoSuchFileError|ErrorM(?:inimum|aximum)|Write(?:NoPermissionError|In(?:validFileNameError|applicableStringEncodingError)|OutOfSpaceError|Un(?:supportedSchemeError|knownError))|LockingError)|xedPitchFontMask)|2(?:1FunctionKey|7FunctionKey|2FunctionKey|8FunctionKey|3FunctionKey|9FunctionKey|4FunctionKey|5FunctionKey|FunctionKey|0FunctionKey|6FunctionKey)|o(?:nt(?:Mo(?:noSpaceTrait|dernSerifsClass)|BoldTrait|S(?:ymbolicClass|criptsClass|labSerifsClass|ansSerifClass)|C(?:o(?:ndensedTrait|llectionApplicationOnlyMask)|larendonSerifsClass)|TransitionalSerifsClass|I(?:ntegerAdvancementsRenderingMode|talicTrait)|O(?:ldStyleSerifsClass|rnamentalsClass)|DefaultRenderingMode|U(?:nknownClass|IOptimizedTrait)|Panel(?:S(?:hadowEffectModeMask|t(?:andardModesMask|rikethroughEffectModeMask)|izeModeMask)|CollectionModeMask|TextColorEffectModeMask|DocumentColorEffectModeMask|UnderlineEffectModeMask|FaceModeMask|All(?:ModesMask|EffectsModeMask))|ExpandedTrait|VerticalTrait|F(?:amilyClassMask|reeformSerifsClass)|Antialiased(?:RenderingMode|IntegerAdvancementsRenderingMode))|cusRing(?:Below|Type(?:None|Default|Exterior)|Only|Above)|urByteGlyphPacking|rm(?:attingError(?:M(?:inimum|aximum))?|FeedCharacter))|8FunctionKey|unction(?:ExpressionType|KeyMask)|3(?:1FunctionKey|2FunctionKey|3FunctionKey|4FunctionKey|5FunctionKey|FunctionKey|0FunctionKey)|9FunctionKey|4FunctionKey|P(?:RevertButton|S(?:ize(?:Title|Field)|etButton)|CurrentField|Preview(?:Button|Field))|l(?:oat(?:ingPointSamplesBitmapFormat|Type)|agsChanged(?:Mask)?)|axButton|5FunctionKey|6FunctionKey)|W(?:heelModeColorPanel|indow(?:s(?:NTOperatingSystem|CP125(?:1StringEncoding|2StringEncoding|3StringEncoding|4StringEncoding|0StringEncoding)|95(?:InterfaceStyle|OperatingSystem))|M(?:iniaturizeButton|ovedEventType)|Below|CloseButton|ToolbarButton|ZoomButton|Out|DocumentIconButton|ExposedEventType|Above)|orkspaceLaunch(?:NewInstance|InhibitingBackgroundOnly|Default|PreferringClassic|WithoutA(?:ctivation|ddingToRecents)|A(?:sync|nd(?:Hide(?:Others)?|Print)|llowingClassicStartup))|eek(?:day(?:CalendarUnit|OrdinalCalendarUnit)|CalendarUnit)|a(?:ntsBidiLevels|rningAlertStyle)|r(?:itingDirection(?:RightToLeft|Natural|LeftToRight)|apCalendarComponents))|L(?:i(?:stModeMatrix|ne(?:Moves(?:Right|Down|Up|Left)|B(?:order|reakBy(?:C(?:harWrapping|lipping)|Truncating(?:Middle|Head|Tail)|WordWrapping))|S(?:eparatorCharacter|weep(?:Right|Down|Up|Left))|ToBezierPathElement|DoesntMove|arSlider)|teralSearch|kePredicateOperatorType|ghterFontAction|braryDirectory)|ocalDomainMask|e(?:ssThan(?:Comparison|OrEqualTo(?:Comparison|PredicateOperatorType)|PredicateOperatorType)|ft(?:Mouse(?:D(?:own(?:Mask)?|ragged(?:Mask)?)|Up(?:Mask)?)|T(?:ext(?:Movement|Alignment)|ab(?:sBezelBorder|StopType))|ArrowFunctionKey))|a(?:yout(?:RightToLeft|NotDone|CantFit|OutOfGlyphs|Done|LeftToRight)|ndscapeOrientation)|ABColorSpaceModel)|A(?:sc(?:iiWithDoubleByteEUCGlyphPacking|endingPageOrder)|n(?:y(?:Type|PredicateModifier|EventMask)|choredSearch|imation(?:Blocking|Nonblocking(?:Threaded)?|E(?:ffect(?:DisappearingItemDefault|Poof)|ase(?:In(?:Out)?|Out))|Linear)|dPredicateType)|t(?:Bottom|tachmentCharacter|omicWrite|Top)|SCIIStringEncoding|d(?:obe(?:GB1CharacterCollection|CNS1CharacterCollection|Japan(?:1CharacterCollection|2CharacterCollection)|Korea1CharacterCollection)|dTraitFontAction|minApplicationDirectory)|uto(?:saveOperation|Pagination)|pp(?:lication(?:SupportDirectory|D(?:irectory|e(?:fined(?:Mask)?|legateReply(?:Success|Cancel|Failure)|activatedEventType))|ActivatedEventType)|KitDefined(?:Mask)?)|l(?:ternateKeyMask|pha(?:ShiftKeyMask|NonpremultipliedBitmapFormat|FirstBitmapFormat)|ert(?:SecondButtonReturn|ThirdButtonReturn|OtherReturn|DefaultReturn|ErrorReturn|FirstButtonReturn|AlternateReturn)|l(?:ScrollerParts|DomainsMask|PredicateModifier|LibrariesDirectory|ApplicationsDirectory))|rgument(?:sWrongScriptError|EvaluationScriptError)|bove(?:Bottom|Top)|WTEventType)))(?:\\b)"
        },
        {
        token: "support.function.C99.c",
        regex: C_Highlight_File.cFunctions
        },
        {
            token : cObj.getKeywords(),
            regex : "[a-zA-Z_$][a-zA-Z0-9_$]*\\b"
        },
        {
            token: "punctuation.section.scope.begin.objc",
            regex: "\\[",
            next: "bracketed_content"
        },
        {
            token: "meta.function.objc",
            regex: "^(?:-|\\+)\\s*"
        }
    ],
    "constant_NSString": [
        {
            token: "constant.character.escape.objc",
            regex: escapedConstRe
        },
        {
            token: "invalid.illegal.unknown-escape.objc",
            regex: "\\\\."
        },
        {
            token: "string",
            regex: '[^"\\\\]+'
        },
        {
            token: "punctuation.definition.string.end",
            regex: "\"",
            next: "start"
        }
    ],
    "protocol_list": [
        {
            token: "punctuation.section.scope.end.objc",
            regex: ">",
            next: "start"
        },
        {
            token: "support.other.protocol.objc",
            regex: "\bNS(?:GlyphStorage|M(?:utableCopying|enuItem)|C(?:hangeSpelling|o(?:ding|pying|lorPicking(?:Custom|Default)))|T(?:oolbarItemValidations|ext(?:Input|AttachmentCell))|I(?:nputServ(?:iceProvider|erMouseTracker)|gnoreMisspelledWords)|Obj(?:CTypeSerializationCallBack|ect)|D(?:ecimalNumberBehaviors|raggingInfo)|U(?:serInterfaceValidations|RL(?:HandleClient|DownloadDelegate|ProtocolClient|AuthenticationChallengeSender))|Validated(?:ToobarItem|UserInterfaceItem)|Locking)\b"
        }
    ],
    "selectors": [
        {
            token: "support.function.any-method.name-of-parameter.objc",
            regex: "\\b(?:[a-zA-Z_:][\\w]*)+"
        },
        {
            token: "punctuation",
            regex: "\\)",
            next: "start"
        }
    ],
    "bracketed_content": [
        {
            token: "punctuation.section.scope.end.objc",
            regex: "]",
            next: "start"
        },
        {
            token: ["support.function.any-method.objc"],
            regex: "(?:predicateWithFormat:| NSPredicate predicateWithFormat:)",
            next: "start"
        },
        {
            token: "support.function.any-method.objc",
            regex: "\\w+(?::|(?=]))",
            next: "start"
        }
    ],
    "bracketed_strings": [
        {
            token: "punctuation.section.scope.end.objc",
            regex: "]",
            next: "start"
        },
        {
            token: "keyword.operator.logical.predicate.cocoa",
            regex: "\\b(?:AND|OR|NOT|IN)\\b"
        },
        {
            token: ["invalid.illegal.unknown-method.objc", "punctuation.separator.arguments.objc"],
            regex: "\\b(\\w+)(:)"
        },
        {
            regex: "\\b(?:ALL|ANY|SOME|NONE)\\b",
            token: "constant.language.predicate.cocoa"
        },
        {
            regex: "\\b(?:NULL|NIL|SELF|TRUE|YES|FALSE|NO|FIRST|LAST|SIZE)\\b",
            token: "constant.language.predicate.cocoa"
        },
        {
            regex: "\\b(?:MATCHES|CONTAINS|BEGINSWITH|ENDSWITH|BETWEEN)\\b",
            token: "keyword.operator.comparison.predicate.cocoa"
        },
        {
            regex: "\\bC(?:ASEINSENSITIVE|I)\\b",
            token: "keyword.other.modifier.predicate.cocoa"
        },
        {
            regex: "\\b(?:ANYKEY|SUBQUERY|CAST|TRUEPREDICATE|FALSEPREDICATE)\\b",
            token: "keyword.other.predicate.cocoa"
        },
        {
            regex: escapedConstRe,
            token: "constant.character.escape.objc"
        },
        {
            regex: "\\\\.",
            token: "invalid.illegal.unknown-escape.objc"
        },
        {
            token: "string",
            regex: '[^"\\\\]'
        },
        {
            token: "punctuation.definition.string.end.objc",
            regex: "\"",
            next: "predicates"
        }
    ],
    "comment" : [
        {
            token : "comment", // closing comment
            regex : ".*?\\*\\/",
            next : "start"
        }, {
            defaultToken : "comment"
        }
    ],
    "methods" : [
        {
            token : "meta.function.objc",
            regex : "(?=\\{|#)|;",
            next : "start"
        }
    ]
};
    for (var r in cRules) {
        if (this.$rules[r]) {
            if (this.$rules[r].push)
                this.$rules[r].push.apply(this.$rules[r], cRules[r]);
        } else {
            this.$rules[r] = cRules[r];
        }
    }
    
    this.$rules.bracketed_content = this.$rules.bracketed_content.concat(
        this.$rules.start, specialVariables
    );

    this.embedRules(DocCommentHighlightRules, "doc-",
        [ DocCommentHighlightRules.getEndRule("start") ]);
};

oop.inherits(ObjectiveCHighlightRules, CHighlightRules);

exports.ObjectiveCHighlightRules = ObjectiveCHighlightRules;
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

ace.define("ace/mode/objectivec",["require","exports","module","ace/lib/oop","ace/mode/text","ace/mode/objectivec_highlight_rules","ace/mode/folding/cstyle"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../lib/oop");
var TextMode = acequire("./text").Mode;
var ObjectiveCHighlightRules = acequire("./objectivec_highlight_rules").ObjectiveCHighlightRules;
var CStyleFoldMode = acequire("./folding/cstyle").FoldMode;

var Mode = function() {
    this.HighlightRules = ObjectiveCHighlightRules;
    this.foldingRules = new CStyleFoldMode();
    this.$behaviour = this.$defaultBehaviour;
};
oop.inherits(Mode, TextMode);

(function() {
    this.lineCommentStart = "//";
    this.blockComment = {start: "/*", end: "*/"};
    this.$id = "ace/mode/objectivec";
}).call(Mode.prototype);

exports.Mode = Mode;
});
