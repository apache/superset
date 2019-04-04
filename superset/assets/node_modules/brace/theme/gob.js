ace.define("ace/theme/gob",["require","exports","module","ace/lib/dom"], function(acequire, exports, module) {

exports.isDark = true;
exports.cssClass = "ace-gob";
exports.cssText = ".ace-gob .ace_gutter {\
background: #0B1818;\
color: #03EE03\
}\
.ace-gob .ace_print-margin {\
width: 1px;\
background: #131313\
}\
.ace-gob {\
background-color: #0B0B0B;\
color: #00FF00\
}\
.ace-gob .ace_cursor {\
border-color: rgba(16, 248, 255, 0.90);\
background-color: rgba(16, 240, 248, 0.70);\
opacity: 0.4;\
}\
.ace-gob .ace_marker-layer .ace_selection {\
background: rgba(221, 240, 255, 0.20)\
}\
.ace-gob.ace_multiselect .ace_selection.ace_start {\
box-shadow: 0 0 3px 0px #141414;\
}\
.ace-gob .ace_marker-layer .ace_step {\
background: rgb(16, 128, 0)\
}\
.ace-gob .ace_marker-layer .ace_bracket {\
margin: -1px 0 0 -1px;\
border: 1px solid rgba(64, 255, 255, 0.25)\
}\
.ace-gob .ace_marker-layer .ace_active-line {\
background: rgba(255, 255, 255, 0.04)\
}\
.ace-gob .ace_gutter-active-line {\
background-color: rgba(255, 255, 255, 0.04)\
}\
.ace-gob .ace_marker-layer .ace_selected-word {\
border: 1px solid rgba(192, 240, 255, 0.20)\
}\
.ace-gob .ace_invisible {\
color: rgba(255, 255, 255, 0.25)\
}\
.ace-gob .ace_keyword,\
.ace-gob .ace_meta {\
color: #10D8E8\
}\
.ace-gob .ace_constant,\
.ace-gob .ace_constant.ace_character,\
.ace-gob .ace_constant.ace_character.ace_escape,\
.ace-gob .ace_constant.ace_other,\
.ace-gob .ace_heading,\
.ace-gob .ace_markup.ace_heading,\
.ace-gob .ace_support.ace_constant {\
color: #10F0A0\
}\
.ace-gob .ace_invalid.ace_illegal {\
color: #F8F8F8;\
background-color: rgba(86, 45, 86, 0.75)\
}\
.ace-gob .ace_invalid.ace_deprecated {\
text-decoration: underline;\
font-style: italic;\
color: #20F8C0\
}\
.ace-gob .ace_support {\
color: #20E8B0\
}\
.ace-gob .ace_fold {\
background-color: #50B8B8;\
border-color: #70F8F8\
}\
.ace-gob .ace_support.ace_function {\
color: #00F800\
}\
.ace-gob .ace_list,\
.ace-gob .ace_markup.ace_list,\
.ace-gob .ace_storage {\
color: #10FF98\
}\
.ace-gob .ace_entity.ace_name.ace_function,\
.ace-gob .ace_meta.ace_tag,\
.ace-gob .ace_variable {\
color: #00F868\
}\
.ace-gob .ace_string {\
color: #10F060\
}\
.ace-gob .ace_string.ace_regexp {\
color: #20F090;\
}\
.ace-gob .ace_comment {\
font-style: italic;\
color: #00E060;\
}\
.ace-gob .ace_variable {\
color: #00F888;\
}\
.ace-gob .ace_xml-pe {\
color: #488858;\
}\
.ace-gob .ace_indent-guide {\
background: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAACCAYAAACZgbYnAAAAEklEQVQImWMQERFpYLC1tf0PAAgOAnPnhxyiAAAAAElFTkSuQmCC) right repeat-y\
}\
";

var dom = acequire("../lib/dom");
dom.importCssString(exports.cssText, exports.cssClass);
});
