'use strict';

Object.defineProperty(exports, '__esModule', {
    value: true
});
exports.stringable = stringable;

function stringable(thing) {
    return thing !== null && typeof thing !== 'undefined' && typeof (thing.toString === 'function');
}
