"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var crypto_1 = require("crypto");
exports.cache = Object.create(null);
function sha1() {
    var data = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        data[_i] = arguments[_i];
    }
    var canCache = data.length === 1 && typeof data[0] === 'string';
    var cacheKey;
    if (canCache) {
        cacheKey = data[0];
        if (cacheKey in exports.cache) {
            return exports.cache[cacheKey];
        }
    }
    var hash = crypto_1.createHash('sha1');
    data.forEach(function (item) {
        if (typeof item === 'string')
            hash.update(item, 'utf8');
        else
            hash.update(item);
    });
    var res = hash.digest('hex').toString();
    if (canCache) {
        exports.cache[cacheKey] = res;
    }
    return res;
}
exports.sha1 = sha1;
