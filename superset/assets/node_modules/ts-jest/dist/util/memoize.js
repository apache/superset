"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var cacheProp = Symbol.for('[memoize]');
function Memoize(keyBuilder) {
    return function (_, propertyKey, descriptor) {
        if (descriptor.value != null) {
            descriptor.value = memoize(propertyKey, descriptor.value, keyBuilder || (function (v) { return v; }));
        }
        else if (descriptor.get != null) {
            descriptor.get = memoize(propertyKey, descriptor.get, keyBuilder || (function () { return propertyKey; }));
        }
    };
}
exports.Memoize = Memoize;
function ensureCache(target, reset) {
    if (reset === void 0) { reset = false; }
    if (reset || !target[cacheProp]) {
        Object.defineProperty(target, cacheProp, {
            value: Object.create(null),
            configurable: true,
        });
    }
    return target[cacheProp];
}
function ensureChildCache(target, key, reset) {
    if (reset === void 0) { reset = false; }
    var dict = ensureCache(target);
    if (reset || !dict[key]) {
        dict[key] = new Map();
    }
    return dict[key];
}
function memoize(namespace, func, keyBuilder) {
    return function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        var cache = ensureChildCache(this, namespace);
        var key = keyBuilder.apply(this, args);
        if (cache.has(key))
            return cache.get(key);
        var res = func.apply(this, args);
        cache.set(key, res);
        return res;
    };
}
