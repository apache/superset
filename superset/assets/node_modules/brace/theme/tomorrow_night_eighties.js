ace.define("ace/theme/tomorrow_night_eighties",["require","exports","module","ace/lib/dom"], function(acequire, exports, module) {

exports.isDark = true;
exports.cssClass = "ace-tomorrow-night-eighties";
exports.cssText = ".ace-tomorrow-night-eighties .ace_gutter {\
background: #272727;\
color: #CCC\
}\
.ace-tomorrow-night-eighties .ace_print-margin {\
width: 1px;\
background: #272727\
}\
.ace-tomorrow-night-eighties {\
background-color: #2D2D2D;\
color: #CCCCCC\
}\
.ace-tomorrow-night-eighties .ace_constant.ace_other,\
.ace-tomorrow-night-eighties .ace_cursor {\
color: #CCCCCC\
}\
.ace-tomorrow-night-eighties .ace_marker-layer .ace_selection {\
background: #515151\
}\
.ace-tomorrow-night-eighties.ace_multiselect .ace_selection.ace_start {\
box-shadow: 0 0 3px 0px #2D2D2D;\
}\
.ace-tomorrow-night-eighties .ace_marker-layer .ace_step {\
background: rgb(102, 82, 0)\
}\
.ace-tomorrow-night-eighties .ace_marker-layer .ace_bracket {\
margin: -1px 0 0 -1px;\
border: 1px solid #6A6A6A\
}\
.ace-tomorrow-night-bright .ace_stack {\
background: rgb(66, 90, 44)\
}\
.ace-tomorrow-night-eighties .ace_marker-layer .ace_active-line {\
background: #393939\
}\
.ace-tomorrow-night-eighties .ace_gutter-active-line {\
background-color: #393939\
}\
.ace-tomorrow-night-eighties .ace_marker-layer .ace_selected-word {\
border: 1px solid #515151\
}\
.ace-tomorrow-night-eighties .ace_invisible {\
color: #6A6A6A\
}\
.ace-tomorrow-night-eighties .ace_keyword,\
.ace-tomorrow-night-eighties .ace_meta,\
.ace-tomorrow-night-eighties .ace_storage,\
.ace-tomorrow-night-eighties .ace_storage.ace_type,\
.ace-tomorrow-night-eighties .ace_support.ace_type {\
color: #CC99CC\
}\
.ace-tomorrow-night-eighties .ace_keyword.ace_operator {\
color: #66CCCC\
}\
.ace-tomorrow-night-eighties .ace_constant.ace_character,\
.ace-tomorrow-night-eighties .ace_constant.ace_language,\
.ace-tomorrow-night-eighties .ace_constant.ace_numeric,\
.ace-tomorrow-night-eighties .ace_keyword.ace_other.ace_unit,\
.ace-tomorrow-night-eighties .ace_support.ace_constant,\
.ace-tomorrow-night-eighties .ace_variable.ace_parameter {\
color: #F99157\
}\
.ace-tomorrow-night-eighties .ace_invalid {\
color: #CDCDCD;\
background-color: #F2777A\
}\
.ace-tomorrow-night-eighties .ace_invalid.ace_deprecated {\
color: #CDCDCD;\
background-color: #CC99CC\
}\
.ace-tomorrow-night-eighties .ace_fold {\
background-color: #6699CC;\
border-color: #CCCCCC\
}\
.ace-tomorrow-night-eighties .ace_entity.ace_name.ace_function,\
.ace-tomorrow-night-eighties .ace_support.ace_function,\
.ace-tomorrow-night-eighties .ace_variable {\
color: #6699CC\
}\
.ace-tomorrow-night-eighties .ace_support.ace_class,\
.ace-tomorrow-night-eighties .ace_support.ace_type {\
color: #FFCC66\
}\
.ace-tomorrow-night-eighties .ace_heading,\
.ace-tomorrow-night-eighties .ace_markup.ace_heading,\
.ace-tomorrow-night-eighties .ace_string {\
color: #99CC99\
}\
.ace-tomorrow-night-eighties .ace_comment {\
color: #999999\
}\
.ace-tomorrow-night-eighties .ace_entity.ace_name.ace_tag,\
.ace-tomorrow-night-eighties .ace_entity.ace_other.ace_attribute-name,\
.ace-tomorrow-night-eighties .ace_meta.ace_tag,\
.ace-tomorrow-night-eighties .ace_variable {\
color: #F2777A\
}\
.ace-tomorrow-night-eighties .ace_indent-guide {\
background: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAACCAYAAACZgbYnAAAAEklEQVQImWPQ09NrYAgMjP4PAAtGAwchHMyAAAAAAElFTkSuQmCC) right repeat-y\
}";

var dom = acequire("../lib/dom");
dom.importCssString(exports.cssText, exports.cssClass);
});
