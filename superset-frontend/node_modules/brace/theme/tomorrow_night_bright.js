ace.define("ace/theme/tomorrow_night_bright",["require","exports","module","ace/lib/dom"], function(acequire, exports, module) {

exports.isDark = true;
exports.cssClass = "ace-tomorrow-night-bright";
exports.cssText = ".ace-tomorrow-night-bright .ace_gutter {\
background: #1a1a1a;\
color: #DEDEDE\
}\
.ace-tomorrow-night-bright .ace_print-margin {\
width: 1px;\
background: #1a1a1a\
}\
.ace-tomorrow-night-bright {\
background-color: #000000;\
color: #DEDEDE\
}\
.ace-tomorrow-night-bright .ace_cursor {\
color: #9F9F9F\
}\
.ace-tomorrow-night-bright .ace_marker-layer .ace_selection {\
background: #424242\
}\
.ace-tomorrow-night-bright.ace_multiselect .ace_selection.ace_start {\
box-shadow: 0 0 3px 0px #000000;\
}\
.ace-tomorrow-night-bright .ace_marker-layer .ace_step {\
background: rgb(102, 82, 0)\
}\
.ace-tomorrow-night-bright .ace_marker-layer .ace_bracket {\
margin: -1px 0 0 -1px;\
border: 1px solid #888888\
}\
.ace-tomorrow-night-bright .ace_marker-layer .ace_highlight {\
border: 1px solid rgb(110, 119, 0);\
border-bottom: 0;\
box-shadow: inset 0 -1px rgb(110, 119, 0);\
margin: -1px 0 0 -1px;\
background: rgba(255, 235, 0, 0.1)\
}\
.ace-tomorrow-night-bright .ace_marker-layer .ace_active-line {\
background: #2A2A2A\
}\
.ace-tomorrow-night-bright .ace_gutter-active-line {\
background-color: #2A2A2A\
}\
.ace-tomorrow-night-bright .ace_stack {\
background-color: rgb(66, 90, 44)\
}\
.ace-tomorrow-night-bright .ace_marker-layer .ace_selected-word {\
border: 1px solid #888888\
}\
.ace-tomorrow-night-bright .ace_invisible {\
color: #343434\
}\
.ace-tomorrow-night-bright .ace_keyword,\
.ace-tomorrow-night-bright .ace_meta,\
.ace-tomorrow-night-bright .ace_storage,\
.ace-tomorrow-night-bright .ace_storage.ace_type,\
.ace-tomorrow-night-bright .ace_support.ace_type {\
color: #C397D8\
}\
.ace-tomorrow-night-bright .ace_keyword.ace_operator {\
color: #70C0B1\
}\
.ace-tomorrow-night-bright .ace_constant.ace_character,\
.ace-tomorrow-night-bright .ace_constant.ace_language,\
.ace-tomorrow-night-bright .ace_constant.ace_numeric,\
.ace-tomorrow-night-bright .ace_keyword.ace_other.ace_unit,\
.ace-tomorrow-night-bright .ace_support.ace_constant,\
.ace-tomorrow-night-bright .ace_variable.ace_parameter {\
color: #E78C45\
}\
.ace-tomorrow-night-bright .ace_constant.ace_other {\
color: #EEEEEE\
}\
.ace-tomorrow-night-bright .ace_invalid {\
color: #CED2CF;\
background-color: #DF5F5F\
}\
.ace-tomorrow-night-bright .ace_invalid.ace_deprecated {\
color: #CED2CF;\
background-color: #B798BF\
}\
.ace-tomorrow-night-bright .ace_fold {\
background-color: #7AA6DA;\
border-color: #DEDEDE\
}\
.ace-tomorrow-night-bright .ace_entity.ace_name.ace_function,\
.ace-tomorrow-night-bright .ace_support.ace_function,\
.ace-tomorrow-night-bright .ace_variable {\
color: #7AA6DA\
}\
.ace-tomorrow-night-bright .ace_support.ace_class,\
.ace-tomorrow-night-bright .ace_support.ace_type {\
color: #E7C547\
}\
.ace-tomorrow-night-bright .ace_heading,\
.ace-tomorrow-night-bright .ace_markup.ace_heading,\
.ace-tomorrow-night-bright .ace_string {\
color: #B9CA4A\
}\
.ace-tomorrow-night-bright .ace_entity.ace_name.ace_tag,\
.ace-tomorrow-night-bright .ace_entity.ace_other.ace_attribute-name,\
.ace-tomorrow-night-bright .ace_meta.ace_tag,\
.ace-tomorrow-night-bright .ace_string.ace_regexp,\
.ace-tomorrow-night-bright .ace_variable {\
color: #D54E53\
}\
.ace-tomorrow-night-bright .ace_comment {\
color: #969896\
}\
.ace-tomorrow-night-bright .ace_c9searchresults.ace_keyword {\
color: #C2C280\
}\
.ace-tomorrow-night-bright .ace_indent-guide {\
background: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAACCAYAAACZgbYnAAAAEklEQVQImWNgYGBgYFBXV/8PAAJoAXX4kT2EAAAAAElFTkSuQmCC) right repeat-y\
}";

var dom = acequire("../lib/dom");
dom.importCssString(exports.cssText, exports.cssClass);
});
