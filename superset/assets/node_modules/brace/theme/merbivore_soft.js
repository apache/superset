ace.define("ace/theme/merbivore_soft",["require","exports","module","ace/lib/dom"], function(acequire, exports, module) {

exports.isDark = true;
exports.cssClass = "ace-merbivore-soft";
exports.cssText = ".ace-merbivore-soft .ace_gutter {\
background: #262424;\
color: #E6E1DC\
}\
.ace-merbivore-soft .ace_print-margin {\
width: 1px;\
background: #262424\
}\
.ace-merbivore-soft {\
background-color: #1C1C1C;\
color: #E6E1DC\
}\
.ace-merbivore-soft .ace_cursor {\
color: #FFFFFF\
}\
.ace-merbivore-soft .ace_marker-layer .ace_selection {\
background: #494949\
}\
.ace-merbivore-soft.ace_multiselect .ace_selection.ace_start {\
box-shadow: 0 0 3px 0px #1C1C1C;\
}\
.ace-merbivore-soft .ace_marker-layer .ace_step {\
background: rgb(102, 82, 0)\
}\
.ace-merbivore-soft .ace_marker-layer .ace_bracket {\
margin: -1px 0 0 -1px;\
border: 1px solid #404040\
}\
.ace-merbivore-soft .ace_marker-layer .ace_active-line {\
background: #333435\
}\
.ace-merbivore-soft .ace_gutter-active-line {\
background-color: #333435\
}\
.ace-merbivore-soft .ace_marker-layer .ace_selected-word {\
border: 1px solid #494949\
}\
.ace-merbivore-soft .ace_invisible {\
color: #404040\
}\
.ace-merbivore-soft .ace_entity.ace_name.ace_tag,\
.ace-merbivore-soft .ace_keyword,\
.ace-merbivore-soft .ace_meta,\
.ace-merbivore-soft .ace_meta.ace_tag,\
.ace-merbivore-soft .ace_storage {\
color: #FC803A\
}\
.ace-merbivore-soft .ace_constant,\
.ace-merbivore-soft .ace_constant.ace_character,\
.ace-merbivore-soft .ace_constant.ace_character.ace_escape,\
.ace-merbivore-soft .ace_constant.ace_other,\
.ace-merbivore-soft .ace_support.ace_type {\
color: #68C1D8\
}\
.ace-merbivore-soft .ace_constant.ace_character.ace_escape {\
color: #B3E5B4\
}\
.ace-merbivore-soft .ace_constant.ace_language {\
color: #E1C582\
}\
.ace-merbivore-soft .ace_constant.ace_library,\
.ace-merbivore-soft .ace_string,\
.ace-merbivore-soft .ace_support.ace_constant {\
color: #8EC65F\
}\
.ace-merbivore-soft .ace_constant.ace_numeric {\
color: #7FC578\
}\
.ace-merbivore-soft .ace_invalid,\
.ace-merbivore-soft .ace_invalid.ace_deprecated {\
color: #FFFFFF;\
background-color: #FE3838\
}\
.ace-merbivore-soft .ace_fold {\
background-color: #FC803A;\
border-color: #E6E1DC\
}\
.ace-merbivore-soft .ace_comment,\
.ace-merbivore-soft .ace_meta {\
font-style: italic;\
color: #AC4BB8\
}\
.ace-merbivore-soft .ace_entity.ace_other.ace_attribute-name {\
color: #EAF1A3\
}\
.ace-merbivore-soft .ace_indent-guide {\
background: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAACCAYAAACZgbYnAAAAEklEQVQImWOQkpLyZfD09PwPAAfYAnaStpHRAAAAAElFTkSuQmCC) right repeat-y\
}";

var dom = acequire("../lib/dom");
dom.importCssString(exports.cssText, exports.cssClass);
});
