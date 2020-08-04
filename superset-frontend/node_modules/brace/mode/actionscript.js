ace.define("ace/mode/actionscript_highlight_rules",["require","exports","module","ace/lib/oop","ace/mode/text_highlight_rules"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../lib/oop");
var TextHighlightRules = acequire("./text_highlight_rules").TextHighlightRules;

var ActionScriptHighlightRules = function() {

    this.$rules = { start: 
       [ { token: 'support.class.actionscript.2',
           regex: '\\b(?:R(?:ecordset|DBMSResolver|adioButton(?:Group)?)|X(?:ML(?:Socket|Node|Connector)?|UpdateResolverDataHolder)|M(?:M(?:Save|Execute)|icrophoneMicrophone|o(?:use|vieClip(?:Loader)?)|e(?:nu(?:Bar)?|dia(?:Controller|Display|Playback))|ath)|B(?:yName|inding|utton)|S(?:haredObject|ystem|crollPane|t(?:yleSheet|age|ream)|ound|e(?:ndEvent|rviceObject)|OAPCall|lide)|N(?:umericStepper|et(?:stream|S(?:tream|ervices)|Connection|Debug(?:Config)?))|C(?:heckBox|o(?:ntextMenu(?:Item)?|okie|lor|m(?:ponentMixins|boBox))|ustomActions|lient|amera)|T(?:ypedValue|ext(?:Snapshot|Input|F(?:ield|ormat)|Area)|ree|AB)|Object|D(?:ownload|elta(?:Item|Packet)?|at(?:e(?:Chooser|Field)?|a(?:G(?:lue|rid)|Set|Type)))|U(?:RL|TC|IScrollBar)|P(?:opUpManager|endingCall|r(?:intJob|o(?:duct|gressBar)))|E(?:ndPoint|rror)|Video|Key|F(?:RadioButton|GridColumn|MessageBox|BarChart|S(?:croll(?:Bar|Pane)|tyleFormat|plitView)|orm|C(?:heckbox|omboBox|alendar)|unction|T(?:icker|ooltip(?:Lite)?|ree(?:Node)?)|IconButton|D(?:ataGrid|raggablePane)|P(?:ieChart|ushButton|ro(?:gressBar|mptBox))|L(?:i(?:stBox|neChart)|oadingBox)|AdvancedMessageBox)|W(?:indow|SDLURL|ebService(?:Connector)?)|L(?:ist|o(?:calConnection|ad(?:er|Vars)|g)|a(?:unch|bel))|A(?:sBroadcaster|cc(?:ordion|essibility)|S(?:Set(?:Native|PropFlags)|N(?:ew|ative)|C(?:onstructor|lamp(?:2)?)|InstanceOf)|pplication|lert|rray))\\b' },
         { token: 'support.function.actionscript.2',
           regex: '\\b(?:s(?:h(?:ift|ow(?:GridLines|Menu|Border|Settings|Headers|ColumnHeaders|Today|Preferences)?|ad(?:ow|ePane))|c(?:hema|ale(?:X|Mode|Y|Content)|r(?:oll(?:Track|Drag)?|een(?:Resolution|Color|DPI)))|t(?:yleSheet|op(?:Drag|A(?:nimation|llSounds|gent))?|epSize|a(?:tus|rt(?:Drag|A(?:nimation|gent))?))|i(?:n|ze|lence(?:TimeOut|Level))|o(?:ngname|urce|rt(?:Items(?:By)?|On(?:HeaderRelease)?|able(?:Columns)?)?)|u(?:ppressInvalidCalls|bstr(?:ing)?)|p(?:li(?:ce|t)|aceCol(?:umnsEqually|lumnsEqually))|e(?:nd(?:DefaultPushButtonEvent|AndLoad)?|curity|t(?:R(?:GB|o(?:otNode|w(?:Height|Count))|esizable(?:Columns)?|a(?:nge|te))|G(?:ain|roupName)|X(?:AxisTitle)?|M(?:i(?:n(?:imum|utes)|lliseconds)|o(?:nth(?:Names)?|tionLevel|de)|ultilineMode|e(?:ssage|nu(?:ItemEnabled(?:At)?|EnabledAt)|dia)|a(?:sk|ximum))|B(?:u(?:tton(?:s|Width)|fferTime)|a(?:seTabIndex|ndwidthLimit|ckground))|S(?:howAsDisabled|croll(?:ing|Speed|Content|Target|P(?:osition|roperties)|barState|Location)|t(?:yle(?:Property)?|opOnFocus|at(?:us|e))|i(?:ze|lenceLevel)|ort(?:able(?:Columns)?|Function)|p(?:litterBarPosition|acing)|e(?:conds|lect(?:Multiple|ion(?:Required|Type)?|Style|Color|ed(?:Node(?:s)?|Cell|I(?:nd(?:ices|ex)|tem(?:s)?))?|able))|kin|m(?:oothness|allScroll))|H(?:ighlight(?:s|Color)|Scroll|o(?:urs|rizontal)|eader(?:Symbol|Height|Text|Property|Format|Width|Location)?|as(?:Shader|CloseBox))|Y(?:ear|AxisTitle)?|N(?:ode(?:Properties|ExpansionHandler)|ewTextFormat)|C(?:h(?:ildNodes|a(?:ngeHandler|rt(?:Title|EventHandler)))|o(?:ntent(?:Size)?|okie|lumns)|ell(?:Symbol|Data)|l(?:i(?:ckHandler|pboard)|oseHandler)|redentials)|T(?:ype(?:dVaule)?|i(?:tle(?:barHeight)?|p(?:Target|Offset)?|me(?:out(?:Handler)?)?)|oggle|extFormat|ransform)|I(?:s(?:Branch|Open)|n(?:terval|putProperty)|con(?:SymbolName)?|te(?:rator|m(?:ByKey|Symbol)))|Orientation|D(?:i(?:splay(?:Range|Graphics|Mode|Clip|Text|edMonth)|rection)|uration|e(?:pth(?:Below|To|Above)|fault(?:GatewayURL|Mappings|NodeIconSymbolName)|l(?:iveryMode|ay)|bug(?:ID)?)|a(?:yOfWeekNames|t(?:e(?:Filter)?|a(?:Mapping(?:s)?|Item(?:Text|Property|Format)|Provider|All(?:Height|Property|Format|Width))?))|ra(?:wConnectors|gContent))|U(?:se(?:Shadow|HandCursor|EchoSuppression|rInput|Fade)|TC(?:M(?:i(?:nutes|lliseconds)|onth)|Seconds|Hours|Date|FullYear))|P(?:osition|ercentComplete|an(?:e(?:M(?:inimumSize|aximumSize)|Size|Title))?|ro(?:pert(?:y(?:Data)?|iesAt)|gress))|E(?:nabled|dit(?:Handler|able)|xpand(?:NodeTrigger|erSymbolName))|V(?:Scroll|olume|alue(?:Source)?)|KeyFrameInterval|Quality|F(?:i(?:eld|rst(?:DayOfWeek|VisibleNode))|ocus|ullYear|ps|ade(?:InLength|OutLength)|rame(?:Color|Width))|Width|L(?:ine(?:Color|Weight)|o(?:opback|adTarget)|a(?:rgeScroll|bel(?:Source|Placement)?))|A(?:s(?:Boolean|String|Number)|n(?:yTypedValue|imation)|ctiv(?:e(?:State(?:Handler)?|Handler)|ateHandler)|utoH(?:ideScrollBar|eight)))?|paratorBefore|ek|lect(?:ion(?:Disabled|Unfocused)?|ed(?:Node(?:s)?|Child|I(?:nd(?:ices|ex)|tem(?:s)?)|Dat(?:e|a))?|able(?:Ranges)?)|rver(?:String)?)|kip|qrt|wapDepths|lice|aveToSharedObj|moothing)|h(?:scroll(?:Policy)?|tml(?:Text)?|i(?:t(?:Test(?:TextNearPos)?|Area)|de(?:BuiltInItems|Child)?|ghlight(?:2D|3D)?)|orizontal|e(?:ight|ader(?:Re(?:nderer|lease)|Height|Text))|P(?:osition|ageScrollSize)|a(?:s(?:childNodes|MP3|S(?:creen(?:Broadcast|Playback)|treaming(?:Video|Audio)|ort)|Next|OwnProperty|Pr(?:inting|evious)|EmbeddedVideo|VideoEncoder|A(?:ccesibility|udio(?:Encoder)?))|ndlerName)|LineScrollSize)|ye(?:sLabel|ar)|n(?:o(?:t|de(?:Name|Close|Type|Open|Value)|Label)|u(?:llValue|mChild(?:S(?:creens|lides)|ren|Forms))|e(?:w(?:Item|line|Value|LocationDialog)|xt(?:S(?:cene|ibling|lide)|TabIndex|Value|Frame)?)?|ame(?:s)?)|c(?:h(?:ildNodes|eck|a(?:nge(?:sPending)?|r(?:CodeAt|At))|r)|o(?:s|n(?:st(?:ant|ructor)|nect|c(?:urrency|at)|t(?:ent(?:Type|Path)?|ains|rol(?:Placement|lerPolicy))|denseWhite|version)|py|l(?:or|umn(?:Stretch|Name(?:s)?|Count))|m(?:p(?:onent|lete)|ment))|u(?:stomItems|ePoint(?:s)?|r(?:veTo|Value|rent(?:Slide|ChildSlide|Item|F(?:ocused(?:S(?:creen|lide)|Form)|ps))))|e(?:il|ll(?:Renderer|Press|Edit|Focus(?:In|Out)))|l(?:i(?:ck|ents)|o(?:se(?:Button|Pane)?|ne(?:Node)?)|ear(?:S(?:haredObjects|treams)|Timeout|Interval)?)|a(?:ncelLabel|tch|p(?:tion|abilities)|l(?:cFields|l(?:e(?:e|r))?))|reate(?:GatewayConnection|Menu|Se(?:rver|gment)|C(?:hild(?:AtDepth)?|l(?:ient|ass(?:ChildAtDepth|Object(?:AtDepth)?))|all)|Text(?:Node|Field)|Item|Object(?:AtDepth)?|PopUp|E(?:lement|mptyMovieClip)))|t(?:h(?:is|row)|ype(?:of|Name)?|i(?:tle(?:StyleDeclaration)?|me(?:out)?)|o(?:talTime|String|olTipText|p|UpperCase|ggle(?:HighQuality)?|Lo(?:caleString|werCase))|e(?:st|llTarget|xt(?:RightMargin|Bold|S(?:ize|elected)|Height|Color|I(?:ndent|talic)|Disabled|Underline|F(?:ield|ont)|Width|LeftMargin|Align)?)|a(?:n|rget(?:Path)?|b(?:Stops|Children|Index|Enabled|leName))|r(?:y|igger|ac(?:e|k(?:AsMenu)?)))|i(?:s(?:Running|Branch|NaN|Con(?:soleOpen|nected)|Toggled|Installed|Open|D(?:own|ebugger)|P(?:urchased|ro(?:totypeOf|pertyEnumerable))|Empty|F(?:inite|ullyPopulated)|Local|Active)|n(?:s(?:tall|ertBefore)|cludeDeltaPacketInfo|t|it(?:ialize|Component|Pod|A(?:pplication|gent))?|de(?:nt|terminate|x(?:InParent(?:Slide|Form)?|Of)?)|put|validate|finity|LocalInternetCache)?|con(?:F(?:ield|unction))?|t(?:e(?:ratorScrolled|m(?:s|RollO(?:ut|ver)|ClassName))|alic)|d3|p|fFrameLoaded|gnore(?:Case|White))|o(?:s|n(?:R(?:ollO(?:ut|ver)|e(?:s(?:ize|ult)|l(?:ease(?:Outside)?|aseOutside)))|XML|Mouse(?:Move|Down|Up|Wheel)|S(?:ync|croller|tatus|oundComplete|e(?:tFocus|lect(?:edItem)?))|N(?:oticeEvent|etworkChange)|C(?:hanged|onnect|l(?:ipEvent|ose))|ID3|D(?:isconnect|eactivate|ata|ragO(?:ut|ver))|Un(?:install|load)|P(?:aymentResult|ress)|EnterFrame|K(?:illFocus|ey(?:Down|Up))|Fault|Lo(?:ad|g)|A(?:ctiv(?:ity|ate)|ppSt(?:op|art)))?|pe(?:n|ration)|verLayChildren|kLabel|ldValue|r(?:d)?)|d(?:i(?:s(?:connect|play(?:Normal|ed(?:Month|Year)|Full)|able(?:Shader|d(?:Ranges|Days)|CloseBox|Events))|rection)|o(?:cTypeDecl|tall|Decoding|main|LazyDecoding)|u(?:plicateMovieClip|ration)|e(?:stroy(?:ChildAt|Object)|code|fault(?:PushButton(?:Enabled)?|KeydownHandler)?|l(?:ta(?:Packet(?:Changed)?)?|ete(?:PopUp|All)?)|blocking)|a(?:shBoardSave|yNames|ta(?:Provider)?|rkshadow)|r(?:opdown(?:Width)?|a(?:w|gO(?:ut|ver))))|u(?:se(?:Sort|HandCursor|Codepage|EchoSuppression)|n(?:shift|install|derline|escape|format|watch|lo(?:ck|ad(?:Movie(?:Num)?)?))|pdate(?:Results|Mode|I(?:nputProperties|tem(?:ByIndex)?)|P(?:acket|roperties)|View|AfterEvent)|rl)|join|p(?:ixelAspectRatio|o(?:sition|p|w)|u(?:sh|rge|blish)|ercen(?:tComplete|Loaded)|lay(?:head(?:Change|Time)|ing|Hidden|erType)?|a(?:ssword|use|r(?:se(?:XML|CSS|Int|Float)|ent(?:Node|Is(?:S(?:creen|lide)|Form))|ams))|r(?:int(?:Num|AsBitmap(?:Num)?)?|o(?:to(?:type)?|pert(?:y|ies)|gress)|e(?:ss|v(?:ious(?:S(?:ibling|lide)|Value)?|Scene|Frame)|ferred(?:Height|Width))))|e(?:scape|n(?:code(?:r)?|ter(?:Frame)?|dFill|able(?:Shader|d|CloseBox|Events))|dit(?:able|Field|LocationDialog)|v(?:ent|al(?:uate)?)|q|x(?:tended|p|ec(?:ute)?|actSettings)|m(?:phasized(?:StyleDeclaration)?|bedFonts))|v(?:i(?:sible|ewPod)|ScrollPolicy|o(?:id|lume)|ersion|P(?:osition|ageScrollSize)|a(?:l(?:idat(?:ionError|e(?:Property|ActivationKey)?)|ue(?:Of)?)|riable)|LineScrollSize)|k(?:ind|ey(?:Down|Up|Press|FrameInterval))|q(?:sort|uality)|f(?:scommand|i(?:n(?:d(?:Text|First|Last)?|ally)|eldInfo|lter(?:ed|Func)?|rst(?:Slide|Child|DayOfWeek|VisibleNode)?)|o(?:nt|cus(?:In|edCell|Out|Enabled)|r(?:egroundDisabled|mat(?:ter)?))|unctionName|ps|l(?:oor|ush)|ace|romCharCode)|w(?:i(?:th|dth)|ordWrap|atch|riteAccess)|l(?:t|i(?:st(?:Owner)?|ne(?:Style|To))|o(?:c(?:k|a(?:t(?:ion|eByld)|l(?:ToGlobal|FileReadDisable)))|opback|ad(?:Movie(?:Num)?|S(?:crollContent|ound)|ed|Variables(?:Num)?|Application)?|g(?:Changes)?)|e(?:ngth|ft(?:Margin)?|ading)?|a(?:st(?:Slide|Child|Index(?:Of)?)?|nguage|b(?:el(?:Placement|F(?:ield|unction))?|leField)))|a(?:s(?:scociate(?:Controller|Display)|in|pectRatio|function)|nd|c(?:ceptConnection|tiv(?:ityLevel|ePlayControl)|os)|t(?:t(?:ach(?:Movie|Sound|Video|Audio)|ributes)|an(?:2)?)|dd(?:header|RequestHeader|Menu(?:Item(?:At)?|At)?|Sort|Header|No(?:tice|de(?:At)?)|C(?:olumn(?:At)?|uePoint)|T(?:oLocalInternetCache|reeNode(?:At)?)|I(?:con|tem(?:s(?:At)?|At)?)|DeltaItem|P(?:od|age|roperty)|EventListener|View|FieldInfo|Listener|Animation)?|uto(?:Size|Play|KeyNav|Load)|pp(?:endChild|ly(?:Changes|Updates)?)|vHardwareDisable|fterLoaded|l(?:ternateRowColors|ign|l(?:ow(?:InsecureDomain|Domain)|Transitions(?:InDone|OutDone))|bum)|r(?:tist|row|g(?:uments|List))|gent|bs)|r(?:ight(?:Margin)?|o(?:ot(?:S(?:creen|lide)|Form)|und|w(?:Height|Count)|llO(?:ut|ver))|e(?:s(?:yncDepth|t(?:orePane|artAnimation|rict)|iz(?:e|able(?:Columns)?)|olveDelta|ult(?:s)?|ponse)|c(?:o(?:ncile(?:Results|Updates)|rd)|eive(?:Video|Audio))|draw|jectConnection|place(?:Sel|ItemAt|AllItems)?|ve(?:al(?:Child)?|rse)|quest(?:SizeChange|Payment)?|f(?:errer|resh(?:ScrollContent|Destinations|Pane|FromSources)?)|lease(?:Outside)?|ad(?:Only|Access)|gister(?:SkinElement|C(?:olor(?:Style|Name)|lass)|InheritingStyle|Proxy)|move(?:Range|M(?:ovieClip|enu(?:Item(?:At)?|At))|Background|Sort|No(?:tice|de(?:sAt|At)?)|C(?:olum(?:nAt|At)|uePoints)|T(?:extField|reeNode(?:At)?)|Item(?:At)?|Pod|EventListener|FromLocalInternetCache|Listener|All(?:C(?:olumns|uePoints)|Items)?))|a(?:ndom|te|dioDot))|g(?:t|oto(?:Slide|NextSlide|PreviousSlide|FirstSlide|LastSlide|And(?:Stop|Play))|e(?:nre|t(?:R(?:GB|o(?:otNode|wCount)|e(?:sizable|mote))|X(?:AxisTitle)?|M(?:i(?:n(?:imum(?:Size)?|utes)|lliseconds)|onth(?:Names)?|ultilineMode|e(?:ssage|nu(?:ItemAt|EnabledAt|At))|aximum(?:Size)?)|B(?:ytes(?:Total|Loaded)|ounds|utton(?:s|Width)|eginIndex|a(?:ndwidthLimit|ckground))|S(?:howAsDisabled|croll(?:ing|Speed|Content|Position|barState|Location)|t(?:yle(?:Names)?|opOnFocus|ate)|ize|o(?:urce|rtState)|p(?:litterBarPosition|acing)|e(?:conds|lect(?:Multiple|ion(?:Required|Type)|Style|ed(?:Node(?:s)?|Cell|Text|I(?:nd(?:ices|ex)|tem(?:s)?))?)|rvice)|moothness|WFVersion)|H(?:ighlight(?:s|Color)|ours|e(?:ight|ader(?:Height|Text|Property|Format|Width|Location)?)|as(?:Shader|CloseBox))|Y(?:ear|AxisTitle)?|N(?:o(?:tices|de(?:DisplayedAt|At))|um(?:Children|berAvailable)|e(?:wTextFormat|xtHighestDepth))|C(?:h(?:ild(?:S(?:creen|lide)|Nodes|Form|At)|artTitle)|o(?:n(?:tent|figInfo)|okie|de|unt|lumn(?:Names|Count|Index|At))|uePoint|ellIndex|loseHandler|a(?:ll|retIndex))|T(?:ypedValue|i(?:tle(?:barHeight)?|p(?:Target|Offset)?|me(?:stamp|zoneOffset|out(?:State|Handler)|r)?)|oggle|ext(?:Extent|Format)?|r(?:ee(?:NodeAt|Length)|ans(?:form|actionId)))|I(?:s(?:Branch|Open)|n(?:stanceAtDepth|d(?:icesByKey|exByKey))|con(?:SymbolName)?|te(?:rator|m(?:sByKey|By(?:Name|Key)|id|ID|At))|d)|O(?:utput(?:Parameter(?:s|ByName)?|Value(?:s)?)|peration|ri(?:entation|ginalCellData))|D(?:i(?:s(?:play(?:Range|Mode|Clip|Index|edMonth)|kUsage)|rection)|uration|e(?:pth|faultNodeIconSymbolName|l(?:taPacket|ay)|bug(?:Config|ID)?)|a(?:y(?:OfWeekNames)?|t(?:e|a(?:Mapping(?:s)?|Item(?:Text|Property|Format)|Label|All(?:Height|Property|Format|Width))?))|rawConnectors)|U(?:se(?:Shadow|HandCursor|rInput|Fade)|RL|TC(?:M(?:i(?:nutes|lliseconds)|onth)|Seconds|Hours|Da(?:y|te)|FullYear))|P(?:o(?:sition|ds)|ercentComplete|a(?:n(?:e(?:M(?:inimums|aximums)|Height|Title|Width))?|rentNode)|r(?:operty(?:Name|Data)?|efer(?:ences|red(?:Height|Width))))|E(?:n(?:dIndex|abled)|ditingData|x(?:panderSymbolName|andNodeTrigger))|V(?:iewed(?:Pods|Applications)|olume|ersion|alue(?:Source)?)|F(?:i(?:eld|rst(?:DayOfWeek|VisibleNode))|o(?:ntList|cus)|ullYear|ade(?:InLength|OutLength)|rame(?:Color|Width))|Width|L(?:ine(?:Color|Weight)|o(?:cal|adTarget)|ength|a(?:stTabIndex|bel(?:Source)?))|A(?:s(?:cii|Boolean|String|Number)|n(?:yTypedValue|imation)|ctiv(?:eState(?:Handler)?|ateHandler)|utoH(?:ideScrollBar|eight)|llItems|gent))?)?|lobal(?:StyleFormat|ToLocal)?|ain|roupName)|x(?:updatePackety|mlDecl)?|m(?:y(?:MethodName|Call)|in(?:imum)?|o(?:nthNames|tion(?:TimeOut|Level)|de(?:lChanged)?|use(?:Move|O(?:ut|ver)|Down(?:Somewhere|Outside)?|Up(?:Somewhere)?|WheelEnabled)|ve(?:To)?)|u(?:ted|lti(?:pleS(?:imultaneousAllowed|elections)|line))|e(?:ssage|nu(?:Show|Hide)?|th(?:od)?|diaType)|a(?:nufacturer|tch|x(?:scroll|hscroll|imum|HPosition|Chars|VPosition)?)|b(?:substring|chr|ord|length))|b(?:ytes(?:Total|Loaded)|indFormat(?:Strings|Function)|o(?:ttom(?:Scroll)?|ld|rder(?:Color)?)|u(?:tton(?:Height|Width)|iltInItems|ffer(?:Time|Length)|llet)|e(?:foreApplyUpdates|gin(?:GradientFill|Fill))|lockIndent|a(?:ndwidth|ckground(?:Style|Color|Disabled)?)|roadcastMessage)|onHTTPStatus)\\b' },
         { token: 'support.constant.actionscript.2',
           regex: '\\b(?:__proto__|__resolve|_accProps|_alpha|_changed|_currentframe|_droptarget|_flash|_focusrect|_framesloaded|_global|_height|_highquality|_level|_listeners|_lockroot|_name|_parent|_quality|_root|_rotation|_soundbuftime|_target|_totalframes|_url|_visible|_width|_x|_xmouse|_xscale|_y|_ymouse|_yscale)\\b' },
         { token: 'keyword.control.actionscript.2',
           regex: '\\b(?:dynamic|extends|import|implements|interface|public|private|new|static|super|var|for|in|break|continue|while|do|return|if|else|case|switch)\\b' },
         { token: 'storage.type.actionscript.2',
           regex: '\\b(?:Boolean|Number|String|Void)\\b' },
         { token: 'constant.language.actionscript.2',
           regex: '\\b(?:null|undefined|true|false)\\b' },
         { token: 'constant.numeric.actionscript.2',
           regex: '\\b(?:0(?:x|X)[0-9a-fA-F]*|(?:[0-9]+\\.?[0-9]*|\\.[0-9]+)(?:(?:e|E)(?:\\+|-)?[0-9]+)?)(?:L|l|UL|ul|u|U|F|f)?\\b' },
         { token: 'punctuation.definition.string.begin.actionscript.2',
           regex: '"',
           push: 
            [ { token: 'punctuation.definition.string.end.actionscript.2',
                regex: '"',
                next: 'pop' },
              { token: 'constant.character.escape.actionscript.2',
                regex: '\\\\.' },
              { defaultToken: 'string.quoted.double.actionscript.2' } ] },
         { token: 'punctuation.definition.string.begin.actionscript.2',
           regex: '\'',
           push: 
            [ { token: 'punctuation.definition.string.end.actionscript.2',
                regex: '\'',
                next: 'pop' },
              { token: 'constant.character.escape.actionscript.2',
                regex: '\\\\.' },
              { defaultToken: 'string.quoted.single.actionscript.2' } ] },
         { token: 'support.constant.actionscript.2',
           regex: '\\b(?:BACKSPACE|CAPSLOCK|CONTROL|DELETEKEY|DOWN|END|ENTER|HOME|INSERT|LEFT|LN10|LN2|LOG10E|LOG2E|MAX_VALUE|MIN_VALUE|NEGATIVE_INFINITY|NaN|PGDN|PGUP|PI|POSITIVE_INFINITY|RIGHT|SPACE|SQRT1_2|SQRT2|UP)\\b' },
         { token: 'punctuation.definition.comment.actionscript.2',
           regex: '/\\*',
           push: 
            [ { token: 'punctuation.definition.comment.actionscript.2',
                regex: '\\*/',
                next: 'pop' },
              { defaultToken: 'comment.block.actionscript.2' } ] },
         { token: 'punctuation.definition.comment.actionscript.2',
           regex: '//.*$',
           push_: 
            [ { token: 'comment.line.double-slash.actionscript.2',
                regex: '$',
                next: 'pop' },
              { defaultToken: 'comment.line.double-slash.actionscript.2' } ] },
         { token: 'keyword.operator.actionscript.2',
           regex: '\\binstanceof\\b' },
         { token: 'keyword.operator.symbolic.actionscript.2',
           regex: '[-!%&*+=/?:]' },
         { token: 
            [ 'meta.preprocessor.actionscript.2',
              'punctuation.definition.preprocessor.actionscript.2',
              'meta.preprocessor.actionscript.2' ],
           regex: '^([ \\t]*)(#)([a-zA-Z]+)' },
         { token: 
            [ 'storage.type.function.actionscript.2',
              'meta.function.actionscript.2',
              'entity.name.function.actionscript.2',
              'meta.function.actionscript.2',
              'punctuation.definition.parameters.begin.actionscript.2' ],
           regex: '\\b(function)(\\s+)([a-zA-Z_]\\w*)(\\s*)(\\()',
           push: 
            [ { token: 'punctuation.definition.parameters.end.actionscript.2',
                regex: '\\)',
                next: 'pop' },
              { token: 'variable.parameter.function.actionscript.2',
                regex: '[^,)$]+' },
              { defaultToken: 'meta.function.actionscript.2' } ] },
         { token: 
            [ 'storage.type.class.actionscript.2',
              'meta.class.actionscript.2',
              'entity.name.type.class.actionscript.2',
              'meta.class.actionscript.2',
              'storage.modifier.extends.actionscript.2',
              'meta.class.actionscript.2',
              'entity.other.inherited-class.actionscript.2' ],
           regex: '\\b(class)(\\s+)([a-zA-Z_](?:\\w|\\.)*)(?:(\\s+)(extends)(\\s+)([a-zA-Z_](?:\\w|\\.)*))?' } ] };
    
    this.normalizeRules();
};

ActionScriptHighlightRules.metaData = { fileTypes: [ 'as' ],
      keyEquivalent: '^~A',
      name: 'ActionScript',
      scopeName: 'source.actionscript.2' };


oop.inherits(ActionScriptHighlightRules, TextHighlightRules);

exports.ActionScriptHighlightRules = ActionScriptHighlightRules;
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

ace.define("ace/mode/actionscript",["require","exports","module","ace/lib/oop","ace/mode/text","ace/mode/actionscript_highlight_rules","ace/mode/folding/cstyle"], function(acequire, exports, module) {
"use strict";

var oop = acequire("../lib/oop");
var TextMode = acequire("./text").Mode;
var ActionScriptHighlightRules = acequire("./actionscript_highlight_rules").ActionScriptHighlightRules;
var FoldMode = acequire("./folding/cstyle").FoldMode;

var Mode = function() {
    this.HighlightRules = ActionScriptHighlightRules;
    this.foldingRules = new FoldMode();
    this.$behaviour = this.$defaultBehaviour;
};
oop.inherits(Mode, TextMode);

(function() {
    this.lineCommentStart = "//";
    this.blockComment = {start: "/*", end: "*/"};
    this.$id = "ace/mode/actionscript";
}).call(Mode.prototype);

exports.Mode = Mode;
});
