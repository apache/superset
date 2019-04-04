"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
var logger_1 = require("../util/logger");
var logger = logger_1.rootLogger.child({ namespace: 'jest-preset' });
function createJestPreset(_a, from) {
    var _b = (_a === void 0 ? {} : _a).allowJs, allowJs = _b === void 0 ? false : _b;
    if (from === void 0) { from = {}; }
    var _c;
    logger.debug({ allowJs: allowJs }, 'creating jest presets', allowJs ? 'handling' : 'not handling', 'JavaScript files');
    return __assign({ transform: __assign({}, from.transform, (_c = {}, _c[allowJs ? '^.+\\.[tj]sx?$' : '^.+\\.tsx?$'] = 'ts-jest', _c)) }, (from.testMatch ? { testMatch: from.testMatch } : undefined), (from.moduleFileExtensions ? { moduleFileExtensions: from.moduleFileExtensions } : undefined));
}
exports.createJestPreset = createJestPreset;
