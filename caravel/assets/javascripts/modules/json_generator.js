var jsep = require("jsep");

var typeMap = {
    sum: 'doubleSum',
    doubleSum: 'doubleSum',
    longSum: 'longSum',
};

var capitalize = function (string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
};

var convertFuncCall = function (node) {
    var funcName = node.callee.name;
    var fieldName = node.arguments[0].name;
    if (!funcName) return;
    var m = funcName.toLowerCase().match(/^(double|long)?(sum|min|max)$/);
    if (!m) return;

    var varType = m[1] || 'double'; // default to double
    var funcType = m[2];

    var type = varType + capitalize(funcType);

    return {
        type: type,
        name: fieldName,
        fieldName: fieldName,
    };
};

var parse = function (expression) {
    expression = expression.trim();
    var parse_tree = jsep(expression);
    parse_tree = convertFuncCall(parse_tree);
    return parse_tree;
};

module.exports = {
    parse: parse
};