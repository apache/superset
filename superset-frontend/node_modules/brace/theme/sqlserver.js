ace.define("ace/theme/sqlserver",["require","exports","module","ace/lib/dom"], function(acequire, exports, module) {

exports.isDark = false;
exports.cssClass = "ace-sqlserver";
exports.cssText = ".ace-sqlserver .ace_gutter {\
background: #ebebeb;\
color: #333;\
overflow: hidden;\
}\
.ace-sqlserver .ace_print-margin {\
width: 1px;\
background: #e8e8e8;\
}\
.ace-sqlserver {\
background-color: #FFFFFF;\
color: black;\
}\
.ace-sqlserver .ace_identifier {\
color: black;\
}\
.ace-sqlserver .ace_keyword {\
color: #0000FF;\
}\
.ace-sqlserver .ace_numeric {\
color: black;\
}\
.ace-sqlserver .ace_storage {\
color: #11B7BE;\
}\
.ace-sqlserver .ace_keyword.ace_operator,\
.ace-sqlserver .ace_lparen,\
.ace-sqlserver .ace_rparen,\
.ace-sqlserver .ace_punctuation {\
color: #808080;\
}\
.ace-sqlserver .ace_set.ace_statement {\
color: #0000FF;\
text-decoration: underline;\
}\
.ace-sqlserver .ace_cursor {\
color: black;\
}\
.ace-sqlserver .ace_invisible {\
color: rgb(191, 191, 191);\
}\
.ace-sqlserver .ace_constant.ace_buildin {\
color: rgb(88, 72, 246);\
}\
.ace-sqlserver .ace_constant.ace_language {\
color: #979797;\
}\
.ace-sqlserver .ace_constant.ace_library {\
color: rgb(6, 150, 14);\
}\
.ace-sqlserver .ace_invalid {\
background-color: rgb(153, 0, 0);\
color: white;\
}\
.ace-sqlserver .ace_support.ace_function {\
color: #FF00FF;\
}\
.ace-sqlserver .ace_support.ace_constant {\
color: rgb(6, 150, 14);\
}\
.ace-sqlserver .ace_class {\
color: #008080;\
}\
.ace-sqlserver .ace_support.ace_other {\
color: #6D79DE;\
}\
.ace-sqlserver .ace_variable.ace_parameter {\
font-style: italic;\
color: #FD971F;\
}\
.ace-sqlserver .ace_comment {\
color: #008000;\
}\
.ace-sqlserver .ace_constant.ace_numeric {\
color: black;\
}\
.ace-sqlserver .ace_variable {\
color: rgb(49, 132, 149);\
}\
.ace-sqlserver .ace_xml-pe {\
color: rgb(104, 104, 91);\
}\
.ace-sqlserver .ace_support.ace_storedprocedure {\
color: #800000;\
}\
.ace-sqlserver .ace_heading {\
color: rgb(12, 7, 255);\
}\
.ace-sqlserver .ace_list {\
color: rgb(185, 6, 144);\
}\
.ace-sqlserver .ace_marker-layer .ace_selection {\
background: rgb(181, 213, 255);\
}\
.ace-sqlserver .ace_marker-layer .ace_step {\
background: rgb(252, 255, 0);\
}\
.ace-sqlserver .ace_marker-layer .ace_stack {\
background: rgb(164, 229, 101);\
}\
.ace-sqlserver .ace_marker-layer .ace_bracket {\
margin: -1px 0 0 -1px;\
border: 1px solid rgb(192, 192, 192);\
}\
.ace-sqlserver .ace_marker-layer .ace_active-line {\
background: rgba(0, 0, 0, 0.07);\
}\
.ace-sqlserver .ace_gutter-active-line {\
background-color: #dcdcdc;\
}\
.ace-sqlserver .ace_marker-layer .ace_selected-word {\
background: rgb(250, 250, 255);\
border: 1px solid rgb(200, 200, 250);\
}\
.ace-sqlserver .ace_meta.ace_tag {\
color: #0000FF;\
}\
.ace-sqlserver .ace_string.ace_regex {\
color: #FF0000;\
}\
.ace-sqlserver .ace_string {\
color: #FF0000;\
}\
.ace-sqlserver .ace_entity.ace_other.ace_attribute-name {\
color: #994409;\
}\
.ace-sqlserver .ace_indent-guide {\
background: url(\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAACCAYAAACZgbYnAAAAE0lEQVQImWP4////f4bLly//BwAmVgd1/w11/gAAAABJRU5ErkJggg==\") right repeat-y;\
}\
";

var dom = acequire("../lib/dom");
dom.importCssString(exports.cssText, exports.cssClass);
});
