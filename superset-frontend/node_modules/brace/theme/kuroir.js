ace.define("ace/theme/kuroir",["require","exports","module","ace/lib/dom"], function(acequire, exports, module) {

exports.isDark = false;
exports.cssClass = "ace-kuroir";
exports.cssText = "\
.ace-kuroir .ace_gutter {\
background: #e8e8e8;\
color: #333;\
}\
.ace-kuroir .ace_print-margin {\
width: 1px;\
background: #e8e8e8;\
}\
.ace-kuroir {\
background-color: #E8E9E8;\
color: #363636;\
}\
.ace-kuroir .ace_cursor {\
color: #202020;\
}\
.ace-kuroir .ace_marker-layer .ace_selection {\
background: rgba(245, 170, 0, 0.57);\
}\
.ace-kuroir.ace_multiselect .ace_selection.ace_start {\
box-shadow: 0 0 3px 0px #E8E9E8;\
}\
.ace-kuroir .ace_marker-layer .ace_step {\
background: rgb(198, 219, 174);\
}\
.ace-kuroir .ace_marker-layer .ace_bracket {\
margin: -1px 0 0 -1px;\
border: 1px solid rgba(0, 0, 0, 0.29);\
}\
.ace-kuroir .ace_marker-layer .ace_active-line {\
background: rgba(203, 220, 47, 0.22);\
}\
.ace-kuroir .ace_gutter-active-line {\
background-color: rgba(203, 220, 47, 0.22);\
}\
.ace-kuroir .ace_marker-layer .ace_selected-word {\
border: 1px solid rgba(245, 170, 0, 0.57);\
}\
.ace-kuroir .ace_invisible {\
color: #BFBFBF\
}\
.ace-kuroir .ace_fold {\
border-color: #363636;\
}\
.ace-kuroir .ace_constant{color:#CD6839;}.ace-kuroir .ace_constant.ace_numeric{color:#9A5925;}.ace-kuroir .ace_support{color:#104E8B;}.ace-kuroir .ace_support.ace_function{color:#005273;}.ace-kuroir .ace_support.ace_constant{color:#CF6A4C;}.ace-kuroir .ace_storage{color:#A52A2A;}.ace-kuroir .ace_invalid.ace_illegal{color:#FD1224;\
background-color:rgba(255, 6, 0, 0.15);}.ace-kuroir .ace_invalid.ace_deprecated{text-decoration:underline;\
font-style:italic;\
color:#FD1732;\
background-color:#E8E9E8;}.ace-kuroir .ace_string{color:#639300;}.ace-kuroir .ace_string.ace_regexp{color:#417E00;\
background-color:#C9D4BE;}.ace-kuroir .ace_comment{color:rgba(148, 148, 148, 0.91);\
background-color:rgba(220, 220, 220, 0.56);}.ace-kuroir .ace_variable{color:#009ACD;}.ace-kuroir .ace_meta.ace_tag{color:#005273;}.ace-kuroir .ace_markup.ace_heading{color:#B8012D;\
background-color:rgba(191, 97, 51, 0.051);}.ace-kuroir .ace_markup.ace_list{color:#8F5B26;}\
";

var dom = acequire("../lib/dom");
dom.importCssString(exports.cssText, exports.cssClass);
});
