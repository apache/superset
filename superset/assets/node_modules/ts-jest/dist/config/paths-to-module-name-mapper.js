"use strict";
var __values = (this && this.__values) || function (o) {
    var m = typeof Symbol === "function" && o[Symbol.iterator], i = 0;
    if (m) return m.call(o);
    return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
};
Object.defineProperty(exports, "__esModule", { value: true });
var _a;
var bs_logger_1 = require("bs-logger");
var logger_1 = require("../util/logger");
var messages_1 = require("../util/messages");
var escapeRegex = function (str) { return str.replace(/[-\\^$*+?.()|[\]{}]/g, '\\$&'); };
var logger = logger_1.rootLogger.child((_a = {}, _a[bs_logger_1.LogContexts.namespace] = 'path-mapper', _a));
exports.pathsToModuleNameMapper = function (mapping, _a) {
    var _b = (_a === void 0 ? {} : _a).prefix, prefix = _b === void 0 ? '' : _b;
    var e_1, _c;
    var jestMap = {};
    try {
        for (var _d = __values(Object.keys(mapping)), _e = _d.next(); !_e.done; _e = _d.next()) {
            var fromPath = _e.value;
            var pattern = void 0;
            var toPaths = mapping[fromPath];
            if (toPaths.length === 0) {
                logger.warn(messages_1.interpolate(messages_1.Errors.NotMappingPathWithEmptyMap, { path: fromPath }));
                continue;
            }
            else if (toPaths.length > 1) {
                logger.warn(messages_1.interpolate(messages_1.Errors.MappingOnlyFirstTargetOfPath, {
                    path: fromPath,
                    count: toPaths.length,
                }));
            }
            var target = toPaths[0];
            var segments = fromPath.split(/\*/g);
            if (segments.length === 1) {
                pattern = "^" + escapeRegex(fromPath) + "$";
                jestMap[pattern] = "" + prefix + target;
            }
            else if (segments.length === 2) {
                pattern = "^" + escapeRegex(segments[0]) + "(.*)" + escapeRegex(segments[1]) + "$";
                jestMap[pattern] = "" + prefix + target.replace(/\*/g, '$1');
            }
            else {
                logger.warn(messages_1.interpolate(messages_1.Errors.NotMappingMultiStarPath, { path: fromPath }));
                continue;
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (_e && !_e.done && (_c = _d.return)) _c.call(_d);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return jestMap;
};
