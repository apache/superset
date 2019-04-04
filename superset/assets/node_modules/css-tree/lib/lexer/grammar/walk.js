'use strict';

var noop = function() {};

function ensureFunction(value) {
    return typeof value === 'function' ? value : noop;
}

module.exports = function(node, fn, context) {
    function walk(node) {
        enter.call(context, node);

        switch (node.type) {
            case 'Group':
                node.terms.forEach(walk);
                break;

            case 'Function':
            case 'Parentheses':
                walk(node.children);
                break;

            case 'Keyword':
            case 'Type':
            case 'Property':
            case 'Combinator':
            case 'Comma':
            case 'Slash':
            case 'String':
            case 'Percent':
                break;

            default:
                throw new Error('Unknown type: ' + node.type);
        }

        leave.call(context, node);
    }

    var enter = noop;
    var leave = noop;

    if (typeof fn === 'function') {
        enter = fn;
    } else if (fn) {
        enter = ensureFunction(fn.enter);
        leave = ensureFunction(fn.leave);
    }

    if (enter === noop && leave === noop) {
        throw new Error('Neither `enter` nor `leave` walker handler is set or both aren\'t a function');
    }

    walk(node, context);
};
