var jsep = require("jsep");

var capitalize = function (str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
};

var convertFuncCall = function (node) {
    var funcName = node.callee.name;
    var fieldName = node.arguments[0].name || "";
    var m = funcName.toLowerCase().match(/^(double|long)?(sum|min|max)$/);
    if (!m) {
        throw new Error("Unsupported function call: " + funcName);
    }

    var varType = m[1] || 'double'; // default to double
    var funcType = m[2];

    var type = varType + capitalize(funcType);

    return {
        type: type,
        name: fieldName,
        fieldName: fieldName
    };
};

var convertField = function (node) {
    var fieldName = node.name;
    return {
        type: "fieldAccess",
        name: fieldName,
        fieldName: fieldName
    };
};

var convertBinary = function (node) {
    var op = node.operator;
    // TODO: Support the "quotient" type
    if (!/[+\-*\/]/.test(op)) {
        throw new Error("Unsupported operation: " + op);
    }
    return {
        type: "arithmetic",
        fn: op,
        fields: [node.left, node.right].map(function (child) {
            return convertArithmetic(child);
        })
    };
};

var convertLiteral = function (node) {
    return {
        type: "constant",
        value: node.value
    };
};

var arithmeticTokenHandler = {
    Identifier: convertField,
    BinaryExpression: convertBinary,
    Literal: convertLiteral
};

var convertArithmetic = function (node) {
    var converter = arithmeticTokenHandler[node.type];
    if (!converter) {
        throw new Error("Invalid Expression (" + node.type + ")");
    }
    return converter(node);
};

var parse = function (expression) {
    expression = expression.trim().replace('\n', '');
    if (!expression) {
        throw new Error("Please enter the expression");
    }
    var parse_tree = jsep(expression);
    var converterMap = {
        CallExpression: convertFuncCall,
        BinaryExpression: convertArithmetic,
        Literal: convertArithmetic
    };
    var converter = converterMap[parse_tree.type];
    if (!converter) {
        throw new Error("Invalid Expression (" + parse_tree.type + ")");
    }
    return converter(parse_tree);
};

module.exports = {
    parse: parse
};