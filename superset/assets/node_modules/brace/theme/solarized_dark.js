ace.define("ace/theme/solarized_dark",["require","exports","module","ace/lib/dom"], function(acequire, exports, module) {

exports.isDark = true;
exports.cssClass = "ace-solarized-dark";
exports.cssText = ".ace-solarized-dark .ace_gutter {\
background: #01313f;\
color: #d0edf7\
}\
.ace-solarized-dark .ace_print-margin {\
width: 1px;\
background: #33555E\
}\
.ace-solarized-dark {\
background-color: #002B36;\
color: #93A1A1\
}\
.ace-solarized-dark .ace_entity.ace_other.ace_attribute-name,\
.ace-solarized-dark .ace_storage {\
color: #93A1A1\
}\
.ace-solarized-dark .ace_cursor,\
.ace-solarized-dark .ace_string.ace_regexp {\
color: #D30102\
}\
.ace-solarized-dark .ace_marker-layer .ace_active-line,\
.ace-solarized-dark .ace_marker-layer .ace_selection {\
background: rgba(255, 255, 255, 0.1)\
}\
.ace-solarized-dark.ace_multiselect .ace_selection.ace_start {\
box-shadow: 0 0 3px 0px #002B36;\
}\
.ace-solarized-dark .ace_marker-layer .ace_step {\
background: rgb(102, 82, 0)\
}\
.ace-solarized-dark .ace_marker-layer .ace_bracket {\
margin: -1px 0 0 -1px;\
border: 1px solid rgba(147, 161, 161, 0.50)\
}\
.ace-solarized-dark .ace_gutter-active-line {\
background-color: #0d3440\
}\
.ace-solarized-dark .ace_marker-layer .ace_selected-word {\
border: 1px solid #073642\
}\
.ace-solarized-dark .ace_invisible {\
color: rgba(147, 161, 161, 0.50)\
}\
.ace-solarized-dark .ace_keyword,\
.ace-solarized-dark .ace_meta,\
.ace-solarized-dark .ace_support.ace_class,\
.ace-solarized-dark .ace_support.ace_type {\
color: #859900\
}\
.ace-solarized-dark .ace_constant.ace_character,\
.ace-solarized-dark .ace_constant.ace_other {\
color: #CB4B16\
}\
.ace-solarized-dark .ace_constant.ace_language {\
color: #B58900\
}\
.ace-solarized-dark .ace_constant.ace_numeric {\
color: #D33682\
}\
.ace-solarized-dark .ace_fold {\
background-color: #268BD2;\
border-color: #93A1A1\
}\
.ace-solarized-dark .ace_entity.ace_name.ace_function,\
.ace-solarized-dark .ace_entity.ace_name.ace_tag,\
.ace-solarized-dark .ace_support.ace_function,\
.ace-solarized-dark .ace_variable,\
.ace-solarized-dark .ace_variable.ace_language {\
color: #268BD2\
}\
.ace-solarized-dark .ace_string {\
color: #2AA198\
}\
.ace-solarized-dark .ace_comment {\
font-style: italic;\
color: #657B83\
}\
.ace-solarized-dark .ace_indent-guide {\
background: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAACCAYAAACZgbYnAAAAEklEQVQImWNg0Db1ZVCxc/sPAAd4AlUHlLenAAAAAElFTkSuQmCC) right repeat-y\
}";

var dom = acequire("../lib/dom");
dom.importCssString(exports.cssText, exports.cssClass);
});
