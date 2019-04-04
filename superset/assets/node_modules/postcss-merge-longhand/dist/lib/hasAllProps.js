"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});

exports.default = (rule, ...props) => {
    return props.every(p => rule.some(({ prop }) => prop && ~prop.indexOf(p)));
};

module.exports = exports["default"];