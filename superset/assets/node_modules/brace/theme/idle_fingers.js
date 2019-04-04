ace.define("ace/theme/idle_fingers",["require","exports","module","ace/lib/dom"], function(acequire, exports, module) {

exports.isDark = true;
exports.cssClass = "ace-idle-fingers";
exports.cssText = ".ace-idle-fingers .ace_gutter {\
background: #3b3b3b;\
color: rgb(153,153,153)\
}\
.ace-idle-fingers .ace_print-margin {\
width: 1px;\
background: #3b3b3b\
}\
.ace-idle-fingers {\
background-color: #323232;\
color: #FFFFFF\
}\
.ace-idle-fingers .ace_cursor {\
color: #91FF00\
}\
.ace-idle-fingers .ace_marker-layer .ace_selection {\
background: rgba(90, 100, 126, 0.88)\
}\
.ace-idle-fingers.ace_multiselect .ace_selection.ace_start {\
box-shadow: 0 0 3px 0px #323232;\
}\
.ace-idle-fingers .ace_marker-layer .ace_step {\
background: rgb(102, 82, 0)\
}\
.ace-idle-fingers .ace_marker-layer .ace_bracket {\
margin: -1px 0 0 -1px;\
border: 1px solid #404040\
}\
.ace-idle-fingers .ace_marker-layer .ace_active-line {\
background: #353637\
}\
.ace-idle-fingers .ace_gutter-active-line {\
background-color: #353637\
}\
.ace-idle-fingers .ace_marker-layer .ace_selected-word {\
border: 1px solid rgba(90, 100, 126, 0.88)\
}\
.ace-idle-fingers .ace_invisible {\
color: #404040\
}\
.ace-idle-fingers .ace_keyword,\
.ace-idle-fingers .ace_meta {\
color: #CC7833\
}\
.ace-idle-fingers .ace_constant,\
.ace-idle-fingers .ace_constant.ace_character,\
.ace-idle-fingers .ace_constant.ace_character.ace_escape,\
.ace-idle-fingers .ace_constant.ace_other,\
.ace-idle-fingers .ace_support.ace_constant {\
color: #6C99BB\
}\
.ace-idle-fingers .ace_invalid {\
color: #FFFFFF;\
background-color: #FF0000\
}\
.ace-idle-fingers .ace_fold {\
background-color: #CC7833;\
border-color: #FFFFFF\
}\
.ace-idle-fingers .ace_support.ace_function {\
color: #B83426\
}\
.ace-idle-fingers .ace_variable.ace_parameter {\
font-style: italic\
}\
.ace-idle-fingers .ace_string {\
color: #A5C261\
}\
.ace-idle-fingers .ace_string.ace_regexp {\
color: #CCCC33\
}\
.ace-idle-fingers .ace_comment {\
font-style: italic;\
color: #BC9458\
}\
.ace-idle-fingers .ace_meta.ace_tag {\
color: #FFE5BB\
}\
.ace-idle-fingers .ace_entity.ace_name {\
color: #FFC66D\
}\
.ace-idle-fingers .ace_collab.ace_user1 {\
color: #323232;\
background-color: #FFF980\
}\
.ace-idle-fingers .ace_indent-guide {\
background: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAACCAYAAACZgbYnAAAAEklEQVQImWMwMjLyZYiPj/8PAAreAwAI1+g0AAAAAElFTkSuQmCC) right repeat-y\
}";

var dom = acequire("../lib/dom");
dom.importCssString(exports.cssText, exports.cssClass);
});
