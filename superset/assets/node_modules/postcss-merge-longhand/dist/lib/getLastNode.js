"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});

exports.default = (rule, prop) => {
    return rule.filter(n => n.prop && n.prop === prop).pop();
};

module.exports = exports["default"];