/* jshint proto: true */
var Constants = require('./constants');
var clone = require('clone');

var utils = {
    getLocation: function(index, inputStream) {
        var n = index + 1,
            line = null,
            column = -1;

        while (--n >= 0 && inputStream.charAt(n) !== '\n') {
            column++;
        }

        if (typeof index === 'number') {
            line = (inputStream.slice(0, index).match(/\n/g) || '').length;
        }

        return {
            line: line,
            column: column
        };
    },
    copyArray: function(arr) {
        var i, length = arr.length,
            copy = new Array(length);
        
        for (i = 0; i < length; i++) {
            copy[i] = arr[i];
        }
        return copy;
    },
    clone: function (obj) {
        var cloned = {};
        for (var prop in obj) {
            if (obj.hasOwnProperty(prop)) {
                cloned[prop] = obj[prop];
            }
        }
        return cloned;
    },
    copyOptions: function(obj1, obj2) {
        if (obj2 && obj2._defaults) {
            return obj2;
        }
        var opts = utils.defaults(obj1, obj2);
        if (opts.strictMath) {
            opts.math = Constants.Math.STRICT_LEGACY;
        }
        // Back compat with changed relativeUrls option
        if (opts.relativeUrls) {
            opts.rewriteUrls = Constants.RewriteUrls.ALL;
        }
        if (typeof opts.math === 'string') {
            switch (opts.math.toLowerCase()) {
                case 'always':
                    opts.math = Constants.Math.ALWAYS;
                    break;
                case 'parens-division':
                    opts.math = Constants.Math.PARENS_DIVISION;
                    break;
                case 'strict':
                case 'parens':
                    opts.math = Constants.Math.PARENS;
                    break;
                case 'strict-legacy':
                    opts.math = Constants.Math.STRICT_LEGACY;
            }
        }
        if (typeof opts.rewriteUrls === 'string') {
            switch (opts.rewriteUrls.toLowerCase()) {
                case 'off':
                    opts.rewriteUrls = Constants.RewriteUrls.OFF;
                    break;
                case 'local':
                    opts.rewriteUrls = Constants.RewriteUrls.LOCAL;
                    break;
                case 'all':
                    opts.rewriteUrls = Constants.RewriteUrls.ALL;
                    break;
            }
        }
        return opts;
    },
    defaults: function(obj1, obj2) {
        var newObj = obj2 || {};
        if (!obj2._defaults) {
            newObj = {};
            var defaults = clone(obj1);
            newObj._defaults = defaults;
            var cloned = obj2 ? clone(obj2) : {};
            Object.assign(newObj, defaults, cloned);
        }
        return newObj;
    },
    merge: function(obj1, obj2) {
        for (var prop in obj2) {
            if (obj2.hasOwnProperty(prop)) {
                obj1[prop] = obj2[prop];
            }
        }
        return obj1;
    },
    flattenArray: function(arr, result) {
        result = result || [];
        for (var i = 0, length = arr.length; i < length; i++) {
            var value = arr[i];
            if (Array.isArray(value)) {
                utils.flattenArray(value, result);
            } else {
                if (value !== undefined) {
                    result.push(value);
                }
            }
        }
        return result;
    }
};

module.exports = utils;