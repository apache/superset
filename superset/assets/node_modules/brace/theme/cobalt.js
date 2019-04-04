ace.define("ace/theme/cobalt",["require","exports","module","ace/lib/dom"], function(acequire, exports, module) {

exports.isDark = true;
exports.cssClass = "ace-cobalt";
exports.cssText = ".ace-cobalt .ace_gutter {\
background: #011e3a;\
color: rgb(128,145,160)\
}\
.ace-cobalt .ace_print-margin {\
width: 1px;\
background: #555555\
}\
.ace-cobalt {\
background-color: #002240;\
color: #FFFFFF\
}\
.ace-cobalt .ace_cursor {\
color: #FFFFFF\
}\
.ace-cobalt .ace_marker-layer .ace_selection {\
background: rgba(179, 101, 57, 0.75)\
}\
.ace-cobalt.ace_multiselect .ace_selection.ace_start {\
box-shadow: 0 0 3px 0px #002240;\
}\
.ace-cobalt .ace_marker-layer .ace_step {\
background: rgb(127, 111, 19)\
}\
.ace-cobalt .ace_marker-layer .ace_bracket {\
margin: -1px 0 0 -1px;\
border: 1px solid rgba(255, 255, 255, 0.15)\
}\
.ace-cobalt .ace_marker-layer .ace_active-line {\
background: rgba(0, 0, 0, 0.35)\
}\
.ace-cobalt .ace_gutter-active-line {\
background-color: rgba(0, 0, 0, 0.35)\
}\
.ace-cobalt .ace_marker-layer .ace_selected-word {\
border: 1px solid rgba(179, 101, 57, 0.75)\
}\
.ace-cobalt .ace_invisible {\
color: rgba(255, 255, 255, 0.15)\
}\
.ace-cobalt .ace_keyword,\
.ace-cobalt .ace_meta {\
color: #FF9D00\
}\
.ace-cobalt .ace_constant,\
.ace-cobalt .ace_constant.ace_character,\
.ace-cobalt .ace_constant.ace_character.ace_escape,\
.ace-cobalt .ace_constant.ace_other {\
color: #FF628C\
}\
.ace-cobalt .ace_invalid {\
color: #F8F8F8;\
background-color: #800F00\
}\
.ace-cobalt .ace_support {\
color: #80FFBB\
}\
.ace-cobalt .ace_support.ace_constant {\
color: #EB939A\
}\
.ace-cobalt .ace_fold {\
background-color: #FF9D00;\
border-color: #FFFFFF\
}\
.ace-cobalt .ace_support.ace_function {\
color: #FFB054\
}\
.ace-cobalt .ace_storage {\
color: #FFEE80\
}\
.ace-cobalt .ace_entity {\
color: #FFDD00\
}\
.ace-cobalt .ace_string {\
color: #3AD900\
}\
.ace-cobalt .ace_string.ace_regexp {\
color: #80FFC2\
}\
.ace-cobalt .ace_comment {\
font-style: italic;\
color: #0088FF\
}\
.ace-cobalt .ace_heading,\
.ace-cobalt .ace_markup.ace_heading {\
color: #C8E4FD;\
background-color: #001221\
}\
.ace-cobalt .ace_list,\
.ace-cobalt .ace_markup.ace_list {\
background-color: #130D26\
}\
.ace-cobalt .ace_variable {\
color: #CCCCCC\
}\
.ace-cobalt .ace_variable.ace_language {\
color: #FF80E1\
}\
.ace-cobalt .ace_meta.ace_tag {\
color: #9EFFFF\
}\
.ace-cobalt .ace_indent-guide {\
background: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAACCAYAAACZgbYnAAAAEklEQVQImWNgYGBgYHCLSvkPAAP3AgSDTRd4AAAAAElFTkSuQmCC) right repeat-y\
}\
";

var dom = acequire("../lib/dom");
dom.importCssString(exports.cssText, exports.cssClass);
});
