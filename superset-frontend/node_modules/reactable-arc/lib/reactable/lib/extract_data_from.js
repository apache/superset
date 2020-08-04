'use strict';

Object.defineProperty(exports, '__esModule', {
    value: true
});
exports.extractDataFrom = extractDataFrom;

var _stringable = require('./stringable');

function extractDataFrom(key, column) {
    var value;
    if (typeof key !== 'undefined' && key !== null && key.__reactableMeta === true) {
        value = key.data[column];
    } else {
        value = key[column];
    }

    if (typeof value !== 'undefined' && value !== null && value.__reactableMeta === true) {
        value = typeof value.props.value !== 'undefined' && value.props.value !== null ? value.props.value : value.value;
    }

    return (0, _stringable.stringable)(value) ? value : '';
}
