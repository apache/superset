ace.define("ace/mode/live_script_highlight_rules",["require","exports","module","ace/lib/oop","ace/mode/text_highlight_rules"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../lib/oop");
var TextHighlightRules = acequire("./text_highlight_rules").TextHighlightRules;

var LiveScriptHighlightRules = function() {

    this.$rules = { start: 
       [ { token: 'punctuation.definition.comment.livescript',
           regex: '\\/\\*',
           push: 
            [ { token: 'punctuation.definition.comment.livescript',
                regex: '\\*\\/',
                next: 'pop' },
              { token: 'storage.type.annotation.livescriptscript',
                regex: '@\\w*' },
              { defaultToken: 'comment.block.livescript' } ] },
         { token: 
            [ 'punctuation.definition.comment.livescript',
              'comment.line.number-sign.livescript' ],
           regex: '(#)(?!\\{)(.*$)' },
         { token: 
            [ 'variable.parameter.function.livescript',
              'meta.inline.function.livescript',
              'storage.type.function.livescript',
              'meta.inline.function.livescript',
              'variable.parameter.function.livescript',
              'meta.inline.function.livescript',
              'storage.type.function.livescript' ],
           regex: '(\\s*\\!?\\(\\s*[^()]*?\\))(\\s*)(!?[~-]{1,2}>)|(\\s*\\!?)(\\(?[^()]*?\\)?)(\\s*)(<[~-]{1,2}!?)',
           comment: 'match stuff like: a -> … ' },
         { token: 
            [ 'keyword.operator.new.livescript',
              'meta.class.instance.constructor',
              'entity.name.type.instance.livescript' ],
           regex: '(new)(\\s+)(\\w+(?:\\.\\w*)*)' },
         { token: 'keyword.illegal.livescript',
           regex: '\\bp(?:ackage|r(?:ivate|otected)|ublic)|interface|enum|static|yield\\b' },
         { token: 'punctuation.definition.string.begin.livescript',
           regex: '\'\'\'',
           push: 
            [ { token: 'punctuation.definition.string.end.livescript',
                regex: '\'\'\'',
                next: 'pop' },
              { defaultToken: 'string.quoted.heredoc.livescript' } ] },
         { token: 'punctuation.definition.string.begin.livescript',
           regex: '"""',
           push: 
            [ { token: 'punctuation.definition.string.end.livescript',
                regex: '"""',
                next: 'pop' },
              { token: 'constant.character.escape.livescript',
                regex: '\\\\.' },
              { include: '#interpolated_livescript' },
              { defaultToken: 'string.quoted.double.heredoc.livescript' } ] },
         { token: 'punctuation.definition.string.begin.livescript',
           regex: '``',
           push: 
            [ { token: 'punctuation.definition.string.end.livescript',
                regex: '``',
                next: 'pop' },
              { token: 'constant.character.escape.livescript',
                regex: '\\\\(?:x[\\da-fA-F]{2}|[0-2][0-7]{0,2}|3[0-6][0-7]|37[0-7]?|[4-7][0-7]?|.)' },
              { defaultToken: 'string.quoted.script.livescript' } ] },
         { token: 'string.array-literal.livescript',
           regex: '<\\[',
           push: 
            [ { token: 'string.array-literal.livescript',
                regex: '\\]>',
                next: 'pop' },
              { defaultToken: 'string.array-literal.livescript' } ] },
         { token: 'string.regexp.livescript',
           regex: '/{2}(?![\\s=/*+{}?]).*?[^\\\\]/[igmy]{0,4}(?![a-zA-Z0-9])/{2}' },
         { token: 'string.regexp.livescript',
           regex: '/{2}$',
           push: 
            [ { token: 'string.regexp.livescript',
                regex: '/{2}[imgy]{0,4}',
                next: 'pop' },
              { include: '#embedded_spaced_comment' },
              { include: '#interpolated_livescript' },
              { defaultToken: 'string.regexp.livescript' } ] },
         { token: 'string.regexp.livescript',
           regex: '/{2}',
           push: 
            [ { token: 'string.regexp.livescript',
                regex: '/{2}[imgy]{0,4}',
                next: 'pop' },
              { token: 'constant.character.escape.livescript',
                regex: '\\\\(?:x[\\da-fA-F]{2}|[0-2][0-7]{0,2}|3[0-6][0-7]|37[0-7]?|[4-7][0-7]?|.)' },
              { include: '#interpolated_livescript' },
              { defaultToken: 'string.regexp.livescript' } ] },
         { token: 'string.regexp.livescript',
           regex: '/(?![\\s=/*+{}?]).*?[^\\\\]/[igmy]{0,4}(?![a-zA-Z0-9])' },
         { token: 'keyword.control.livescript',
           regex: '\\b(?<![\\.\\$\\-])(?:t(?:h(?:is|row|en)|ry|ypeof!?|il|o)|c(?:on(?:tinue|st)|a(?:se|tch)|lass)|i(?:n(?:stanceof)?|mp(?:ort(?:\\s+all)?|lements)|[fs])|d(?:e(?:fault|lete|bugger)|o)|f(?:or(?:\\s+own)?|inally|unction|rom|allthrough)|s(?:uper|witch)|e(?:lse|x(?:tends|port)|val)|a(?:nd|rguments)|n(?:ew|ot)|un(?:less|til)|w(?:hile|ith|hen)|o(?:f|r|therwise)|return|break|let|var|loop|match|by)(?!\\-|\\s*:)\\b',
           TODO: 'FIXME: regexp doesn\'t have js equivalent',
           originalRegex: '(?x)\n\t\t\t\t\\b(?<![\\.\\$\\-])(?:\n\t\t        t(?:h(?:is|row|en)|ry|ypeof!?|il|o)\n\t\t        |c(?:on(?:tinue|st)|a(?:se|tch)|lass)\n\t\t        |i(?:n(?:stanceof)?|mp(?:ort(?:\\s+all)?|lements)|[fs])\n\t\t        |d(?:e(?:fault|lete|bugger)|o)\n\t\t        |f(?:or(?:\\s+own)?|inally|unction|rom|allthrough)\n\t\t        |s(?:uper|witch)\n\t\t        |e(?:lse|x(?:tends|port)|val)\n\t\t        |a(?:nd|rguments)\n\t\t        |n(?:ew|ot)\n\t\t        |un(?:less|til)\n\t\t        |w(?:hile|ith|hen)\n\t\t        |o(?:f|r|therwise)\n\t\t        |return|break|let|var|loop\n\t\t        |match\n\t\t        |by\n\t\t\t\t)(?!\\-|\\s*:)\\b\n\t\t\t' },
         { token: 'keyword.operator.livescript',
           regex: '\\b(?<![\\.\\$\\-])(?:instanceof|new|delete|typeof|and|or|is|isnt|not)(?!\\-|\\s*:)\\b',
           TODO: 'FIXME: regexp doesn\'t have js equivalent',
           originalRegex: '(?x)\n\t\t\t\t\\b(?<![\\.\\$\\-])(\n\t\t\t\t\tinstanceof|new|delete|typeof|and|or|is|isnt|not\n\t\t\t\t)(?!\\-|\\s*:)\\b\n\t\t\t' },
         { token: 'keyword.operator.livescript',
           regex: 'and=|or=|%|&|\\^|\\*|\\/|(?<![a-zA-Z$_])(?:\\-)?\\-(?!\\-?>)|\\+\\+|\\+|~(?!~?>)|==|=|!=|<=|>=|<<=|>>=|>>>=|<>|<(?!\\[)|(?<!\\])>|(?<!\\w)!(?!(?:[~\\-]+)?>)|&&|\\.\\.(?:\\.)?|\\s\\.\\s|\\?|\\||\\|\\||\\:|\\*=|(?<!\\()/=|%=|\\+=|\\-=|\\.=|&=|\\(\\.|\\.\\)|\\^=',
           TODO: 'FIXME: regexp doesn\'t have js equivalent',
           originalRegex: '(?x)\n\t\t\t\tand=|or=|%|&|\\^|\\*|\\/|(?<![a-zA-Z$_])(\\-)?\\-(?!\\-?>)|\\+\\+|\\+|\n\t\t\t\t~(?!~?>)|==|=|!=|<=|>=|<<=|>>=|\n\t\t\t\t>>>=|<>|<(?!\\[)|(?<!\\])>|(?<!\\w)!(?!([~\\-]+)?>)|&&|\\.\\.(\\.)?|\\s\\.\\s|\\?|\\||\\|\\||\\:|\\*=|(?<!\\()/=|%=|\\+=|\\-=|\\.=|&=|\\(\\.|\\.\\)|\n\t\t\t\t\\^=\n\t\t\t' },
         { token: 
            [ 'variable.assignment.livescript',
              'variable.assignment.livescript',
              'variable.assignment.livescript',
              'punctuation.separator.key-value',
              'keyword.operator.livescript',
              'variable.assignment.livescript' ],
           regex: '([a-zA-Z\\$_])((?:[\\w$.-])*)(\\s*)(?!\\::)(?:(:)|(=))(\\s*)(?!(?:\\s*!?\\s*\\(.*\\))?\\s*!?[~-]{1,2}>)' },
         { token: 'keyword.operator.livescript',
           regex: '(?<=\\s|^)[\\[\\{](?=.*?[\\]\\}]\\s+[:=])',
           TODO: 'FIXME: regexp doesn\'t have js equivalent',
           originalRegex: '(?<=\\s|^)([\\[\\{])(?=.*?[\\]\\}]\\s+[:=])',
           push: 
            [ { token: 'keyword.operator.livescript',
                regex: '[\\]\\}]\\s*[:=]',
                next: 'pop' },
              { include: '#variable_name' },
              { include: '#instance_variable' },
              { include: '#single_quoted_string' },
              { include: '#double_quoted_string' },
              { include: '#numeric' },
              { defaultToken: 'meta.variable.assignment.destructured.livescript' } ] },
         { token: 
            [ 'meta.function.livescript',
              'entity.name.function.livescript',
              'entity.name.function.livescript',
              'entity.name.function.livescript',
              'entity.name.function.livescript',
              'variable.parameter.function.livescript',
              'entity.name.function.livescript',
              'storage.type.function.livescript' ],
           regex: '(\\s*)(?=[a-zA-Z\\$_])([a-zA-Z\\$_])((?:[\\w$.:-])*)(\\s*)([:=])((?:\\s*!?\\s*\\(.*\\))?)(\\s*)(!?[~-]{1,2}>)' },
         { token: 'storage.type.function.livescript',
           regex: '!?[~-]{1,2}>' },
         { token: 'constant.language.boolean.true.livescript',
           regex: '\\b(?<!\\.)(?:true|on|yes)(?!\\s*[:=])\\b',
           TODO: 'FIXME: regexp doesn\'t have js equivalent',
           originalRegex: '\\b(?<!\\.)(true|on|yes)(?!\\s*[:=])\\b' },
         { token: 'constant.language.boolean.false.livescript',
           regex: '\\b(?<!\\.)(?:false|off|no)(?!\\s*[:=])\\b',
           TODO: 'FIXME: regexp doesn\'t have js equivalent',
           originalRegex: '\\b(?<!\\.)(false|off|no)(?!\\s*[:=])\\b' },
         { token: 'constant.language.null.livescript',
           regex: '\\b(?<!\\.)(?:null|void)(?!\\s*[:=])\\b',
           TODO: 'FIXME: regexp doesn\'t have js equivalent',
           originalRegex: '\\b(?<!\\.)(null|void)(?!\\s*[:=])\\b' },
         { token: 'variable.language.livescript',
           regex: '\\b(?<!\\.)(?:super|this|extends)(?!\\s*[:=])\\b',
           TODO: 'FIXME: regexp doesn\'t have js equivalent',
           originalRegex: '\\b(?<!\\.)(super|this|extends)(?!\\s*[:=])\\b' },
         { token: 
            [ 'storage.type.class.livescript',
              'meta.class.livescript',
              'entity.name.type.class.livescript',
              'meta.class.livescript',
              'keyword.control.inheritance.livescript',
              'meta.class.livescript',
              'entity.other.inherited-class.livescript' ],
           regex: '(class\\b)(\\s+)((?:@?[a-zA-Z$_][\\w$.-]*)?)(?:(\\s+)(extends)(\\s+)(@?[a-zA-Z$_][\\w$.-]*))?' },
         { token: 'keyword.other.livescript',
           regex: '\\b(?:debugger|\\\\)\\b' },
         { token: 'support.class.livescript',
           regex: '\\b(?:Array|ArrayBuffer|Blob|Boolean|Date|document|event|Function|Int(?:8|16|32|64)Array|Math|Map|Number|Object|Proxy|RegExp|Set|String|WeakMap|window|Uint(?:8|16|32|64)Array|XMLHttpRequest)\\b' },
         { token: 'entity.name.type.object.livescript',
           regex: '\\bconsole\\b' },
         { token: 'support.function.console.livescript',
           regex: '(?<=console\\.)(?:debug|warn|info|log|error|time(?:End|-end)|assert)\\b',
           TODO: 'FIXME: regexp doesn\'t have js equivalent',
           originalRegex: '((?<=console\\.)(debug|warn|info|log|error|time(End|-end)|assert))\\b' },
         { token: 'support.function.livescript',
           regex: '\\b(?:decodeURI(?:Component)?|encodeURI(?:Component)?|eval|parse(?:Float|Int)|acequire)\\b' },
         { token: 'support.function.prelude.livescript',
           regex: '(?<![.-])\\b(?:map|filter|reject|partition|find|each|head|tail|last|initial|empty|values|keys|length|cons|append|join|reverse|fold(?:l|r)?1?|unfoldr|and(?:List|-list)|or(?:List|-list)|any|all|unique|sum|product|mean|compact|concat(?:Map|-map)?|maximum|minimum|scan(?:l|r)?1?|replicate|slice|apply|split(?:At|-at)?|take(?:While|-while)?|drop(?:While|-while)?|span|first|break(?:It|-it)|list(?:ToObj|-to-obj)|obj(?:ToFunc|-to-func)|pairs(?:ToObj|-to-obj)|obj(?:ToPairs|-to-pairs|ToLists|-to-lists)|zip(?:All|-all)?(?:With|-with)?|compose|curry|partial|flip|fix|sort(?:With|-with|By|-by)?|group(?:By|-by)|break(?:List|-list|Str|-str)|difference|intersection|union|average|flatten|chars|unchars|repeat|lines|unlines|words|unwords|max|min|negate|abs|signum|quot|rem|div|mod|recip|pi|tau|exp|sqrt|ln|pow|sin|cos|tan|asin|acos|atan|atan2|truncate|round|ceiling|floor|is(?:It|-it)NaN|even|odd|gcd|lcm|disabled__id)\\b(?![.-])',
           TODO: 'FIXME: regexp doesn\'t have js equivalent',
           originalRegex: '(?x)(?<![.-])\\b(\n\t\t\t\tmap|filter|reject|partition|find|each|head|tail|last|initial|empty|\n\t\t\t\tvalues|keys|length|cons|append|join|reverse|fold(l|r)?1?|unfoldr|\n\t\t\t\tand(List|-list)|or(List|-list)|any|all|unique|sum|product|mean|compact|\n\t\t\t\tconcat(Map|-map)?|maximum|minimum|scan(l|r)?1?|replicate|slice|apply|\n\t\t\t\tsplit(At|-at)?|take(While|-while)?|drop(While|-while)?|span|first|\n\t\t\t\tbreak(It|-it)|list(ToObj|-to-obj)|obj(ToFunc|-to-func)|\n\t\t\t\tpairs(ToObj|-to-obj)|obj(ToPairs|-to-pairs|ToLists|-to-lists)|\n\t\t\t\tzip(All|-all)?(With|-with)?|compose|curry|partial|flip|fix|\n\t\t\t\tsort(With|-with|By|-by)?|group(By|-by)|break(List|-list|Str|-str)|\n\t\t\t\tdifference|intersection|union|average|flatten|chars|unchars|repeat|\n\t\t\t\tlines|unlines|words|unwords|max|min|negate|abs|signum|quot|rem|div|mod|\n\t\t\t\trecip|pi|tau|exp|sqrt|ln|pow|sin|cos|tan|asin|acos|atan|atan2|truncate|\n\t\t\t\tround|ceiling|floor|is(It|-it)NaN|even|odd|gcd|lcm|disabled__id\n\t\t\t)\\b(?![.-])',
           comment: 'Generated by DOM query from http://gkz.github.com/prelude-ls/:\n\t      [].slice\n\t        .call(document.querySelectorAll(".nav-pills li a"))\n\t        .map(function(_) {return _.innerText})\n\t        .filter(function(_) {return _.trim() !== \'})\n\t        .slice(2)\n\t        .join("|")\n     \t\t' },
         { token: 'support.function.semireserved.livescript',
           regex: '(?<![.-])\\b(?:that|it|e)\\b',
           TODO: 'FIXME: regexp doesn\'t have js equivalent',
           originalRegex: '(?x)(?<![.-])\\b(that|it|e)\\b' },
         { token: 'support.function.method.array.livescript',
           regex: '(?<=(?:\\.|\\]|\\)))(?:apply|call|concat|every|filter|for(?:Each|-each)|from|has(?:Own|-own)(?:Property|-property)|index(?:Of|-of)|is(?:Prototype|-prototype)(?:Of|-of)|join|last(?:Index|-index)(?:Of|-of)|map|of|pop|property(?:Is|-is)(?:Enumerable|-enumerable)|push|reduce(?:Right|-right)?|reverse|shift|slice|some|sort|splice|to(?:Locale|-locale)?(?:String|-string)|unshift|valueOf)\\b(?!-)',
           TODO: 'FIXME: regexp doesn\'t have js equivalent',
           originalRegex: '(?x)((?<=(\\.|\\]|\\)))(\n\t\t\t\tapply|call|concat|every|filter|for(Each|-each)|\n\t\t\t\tfrom|has(Own|-own)(Property|-property)|index(Of|-of)|\n\t\t\t\tis(Prototype|-prototype)(Of|-of)|join|last(Index|-index)(Of|-of)|\n\t\t\t\tmap|of|pop|property(Is|-is)(Enumerable|-enumerable)|push|\n\t\t\t\treduce(Right|-right)?|reverse|shift|slice|some|sort|\n\t\t\t\tsplice|to(Locale|-locale)?(String|-string)|unshift|valueOf\n\t\t\t))\\b(?!-) ' },
         { token: 'support.function.static.array.livescript',
           regex: '(?<=Array\\.)isArray\\b',
           TODO: 'FIXME: regexp doesn\'t have js equivalent',
           originalRegex: '(?x)((?<=Array\\.)(\n\t\t\t\tisArray\n\t\t\t))\\b' },
         { token: 'support.function.static.object.livescript',
           regex: '(?<=Object\\.)(?:create|ace.define(?:Propert|-propert)(?:ies|y)|freeze|get(?:Own|-own)(?:Property|-property)(?:Descriptors?|Names)|get(?:Property|-property)(?:Descriptor|Names)|getPrototypeOf|is(?:(?:Extensible|-extensible)|(?:Frozen|-frozen)|(?:Sealed|-sealed))?|keys|prevent(?:Extensions|-extensions)|seal)\\b',
           TODO: 'FIXME: regexp doesn\'t have js equivalent',
           originalRegex: '(?x)((?<=Object\\.)(\n\t\t\t\tcreate|ace.define(Propert|-propert)(ies|y)|freeze|\n\t\t\t\tget(Own|-own)(Property|-property)(Descriptors?|Names)|\n\t\t\t\tget(Property|-property)(Descriptor|Names)|getPrototypeOf|\n\t\t\t\tis((Extensible|-extensible)|(Frozen|-frozen)|(Sealed|-sealed))?|\n\t\t\t\tkeys|prevent(Extensions|-extensions)|seal\n\t\t\t))\\b' },
         { token: 'support.function.static.math.livescript',
           regex: '(?<=Math\\.)(?:abs|acos|acosh|asin|asinh|atan|atan2|atanh|ceil|cos|cosh|exp|expm1|floor|hypot|log|log10|log1p|log2|max|min|pow|random|round|sign|sin|sinh|sqrt|tan|tanh|trunc)\\b',
           TODO: 'FIXME: regexp doesn\'t have js equivalent',
           originalRegex: '(?x)((?<=Math\\.)(\n\t\t\t\tabs|acos|acosh|asin|asinh|atan|atan2|atanh|ceil|cos|cosh|exp|expm1|floor|\n\t\t\t\thypot|log|log10|log1p|log2|max|min|pow|random|round|sign|sin|sinh|sqrt|\n\t\t\t\ttan|tanh|trunc\n\t\t\t))\\b' },
         { token: 'support.function.static.number.livescript',
           regex: '(?<=Number\\.)(?:is(?:Finite|Integer|NaN)|to(?:Integer|-integer))\\b',
           TODO: 'FIXME: regexp doesn\'t have js equivalent',
           originalRegex: '(?x)((?<=Number\\.)(\n\t\t\t\tis(Finite|Integer|NaN)|to(Integer|-integer)\n\t\t\t))\\b' },
         { token: 'constant.language.livescript',
           regex: '\\b(?:Infinity|NaN|undefined)\\b' },
         { token: 'punctuation.terminator.statement.livescript',
           regex: '\\;' },
         { token: 'meta.delimiter.object.comma.livescript',
           regex: ',[ |\\t]*' },
         { token: 'meta.delimiter.method.period.livescript',
           regex: '\\.' },
         { token: 'meta.brace.curly.livescript', regex: '\\{|\\}' },
         { token: 'meta.brace.round.livescript', regex: '\\(|\\)' },
         { token: 'meta.brace.square.livescript', regex: '\\[|\\]\\s*' },
         { include: '#instance_variable' },
         { include: '#backslash_string' },
         { include: '#single_quoted_string' },
         { include: '#double_quoted_string' },
         { include: '#numeric' } ],
      '#backslash_string': 
       [ { token: 'string.quoted.single.livescript',
           regex: '\\\\(?:[\\\\)\\s,\\};\\]])?',
           push: 
            [ { token: 'punctuation.definition.string.end.livescript',
                regex: '[\\\\)\\s,\\};\\]]',
                next: 'pop' },
              { defaultToken: 'string.quoted.single.livescript' } ] } ],
      '#double_quoted_string': 
       [ { token: 'punctuation.definition.string.begin.livescript',
           regex: '"',
           push: 
            [ { token: 'punctuation.definition.string.end.livescript',
                regex: '"',
                next: 'pop' },
              { token: 'constant.character.escape.livescript',
                regex: '\\\\(?:x[\\da-fA-F]{2}|[0-2][0-7]{0,2}|3[0-6][0-7]|37[0-7]?|[4-7][0-7]?|.)' },
              { include: '#interpolated_livescript' },
              { defaultToken: 'string.quoted.double.livescript' } ] } ],
      '#embedded_comment': 
       [ { token: 
            [ 'punctuation.definition.comment.livescript',
              'comment.line.number-sign.livescript' ],
           regex: '(?<!\\\\)(#)(.*$)',
           TODO: 'FIXME: regexp doesn\'t have js equivalent',
           originalRegex: '(?<!\\\\)(#).*$\\n' } ],
      '#embedded_spaced_comment': 
       [ { token: 
            [ 'punctuation.definition.comment.livescript',
              'comment.line.number-sign.livescript' ],
           regex: '(?<!\\\\)(#\\s)(.*$)',
           TODO: 'FIXME: regexp doesn\'t have js equivalent',
           originalRegex: '(?<!\\\\)(#\\s).*$\\n' } ],
      '#constructor_variable': 
       [ { token: 'variable.other.readwrite.constructor.livescript',
           regex: '[a-zA-Z$_][\\w$-]*@{2}(?:[a-zA-Z$_][\\w$-]*)?' } ],
      '#instance_variable': 
       [ { token: 'variable.other.readwrite.instance.livescript',
           regex: '(?<!\\S)@(?:[a-zA-Z$_][\\w$-]*)?',
           TODO: 'FIXME: regexp doesn\'t have js equivalent',
           originalRegex: '(?<!\\S)(@)([a-zA-Z$_][\\w$-]*)?' } ],
      '#interpolated_livescript': 
       [ { todo: 
            { token: 'punctuation.section.embedded.livescript',
              regex: '\\#\\{',
              push: 
               [ { token: 'punctuation.section.embedded.livescript',
                   regex: '\\}',
                   next: 'pop' },
                 { include: '$self' },
                 { defaultToken: 'source.livescript.embedded.source' } ] } },
         { todo: 
            { token: 'source.livescript.embedded.source.simple',
              regex: '\\#',
              push: 
               [ { token: 'source.livescript.embedded.source.simple',
                   regex: '',
                   next: 'pop' },
                 { include: '$self' },
                 { defaultToken: 'source.livescript.embedded.source.simple' } ] } } ],
      '#numeric': 
       [ { token: 'constant.numeric.livescript',
           regex: '(?<![\\$@a-zA-Z_])(?:[0-9]+r[0-9_]+|(?:16r|0[xX])[0-9a-fA-F_]+|[0-9]+(?:\\.[0-9_]+)?(?:e[+\\-]?[0-9_]+)?[_a-zA-Z]*)',
           TODO: 'FIXME: regexp doesn\'t have js equivalent',
           originalRegex: '(?<![\\$@a-zA-Z_])(([0-9]+r[0-9_]+)|((16r|0[xX])[0-9a-fA-F_]+)|([0-9]+(\\.[0-9_]+)?(e[+\\-]?[0-9_]+)?)[_a-zA-Z]*)' } ],
      '#single_quoted_string': 
       [ { token: 'punctuation.definition.string.begin.livescript',
           regex: '\'',
           push: 
            [ { token: 'punctuation.definition.string.end.livescript',
                regex: '\'',
                next: 'pop' },
              { token: 'constant.character.escape.livescript',
                regex: '\\\\(?:x[\\da-fA-F]{2}|[0-2][0-7]{0,2}|3[0-6][0-7]?|37[0-7]?|[4-7][0-7]?|.)' },
              { defaultToken: 'string.quoted.single.livescript' } ] } ],
      '#variable_name': 
       [ { token: 'variable.assignment.livescript',
           regex: '[a-zA-Z\\$_][\\w$-]*(?:\\.\\w+)*(?!\\-)' } ] }
    
    this.normalizeRules();
};

LiveScriptHighlightRules.metaData = { comment: 'LiveScript Syntax: version 1',
      fileTypes: [ 'ls', 'Slakefile', 'ls.erb' ],
      firstLineMatch: '^#!.*\\bls',
      foldingStartMarker: '^\\s*class\\s+\\S.*$|.*(->|=>)\\s*$|.*[\\[{]\\s*$',
      foldingStopMarker: '^\\s*$|^\\s*[}\\]]\\s*$',
      keyEquivalent: '^~C',
      name: 'LiveScript',
      scopeName: 'source.livescript' }


oop.inherits(LiveScriptHighlightRules, TextHighlightRules);

exports.LiveScriptHighlightRules = LiveScriptHighlightRules;
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
    
    this.foldingStartMarker = /(\{|\[)[^\}\]]*$|^\s*(\/\*)/;
    this.foldingStopMarker = /^[^\[\{]*(\}|\])|^[\s\*]*(\*\/)/;
    this.singleLineBlockCommentRe= /^\s*(\/\*).*\*\/\s*$/;
    this.tripleStarBlockCommentRe = /^\s*(\/\*\*\*).*\*\/\s*$/;
    this.startRegionRe = /^\s*(\/\*|\/\/)#region\b/;
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
        
        var re = /^\s*(?:\/\*|\/\/)#(end)?region\b/;
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

ace.define("ace/mode/live_script",["require","exports","module","ace/lib/oop","ace/mode/text","ace/mode/live_script_highlight_rules","ace/mode/folding/cstyle"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../lib/oop");
var TextMode = acequire("./text").Mode;
var LiveScriptHighlightRules = acequire("./live_script_highlight_rules").LiveScriptHighlightRules;
var FoldMode = acequire("./folding/cstyle").FoldMode;

var Mode = function() {
    this.HighlightRules = LiveScriptHighlightRules;
    this.foldingRules = new FoldMode();
};
oop.inherits(Mode, TextMode);

(function() {
    this.$id = "ace/mode/live_script"
}).call(Mode.prototype);

exports.Mode = Mode;
});
