"use strict";
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
var __spread = (this && this.__spread) || function () {
    for (var ar = [], i = 0; i < arguments.length; i++) ar = ar.concat(__read(arguments[i]));
    return ar;
};
Object.defineProperty(exports, "__esModule", { value: true });
var _a;
var bs_logger_1 = require("bs-logger");
var fs_1 = require("fs");
var path_1 = require("path");
var create_jest_preset_1 = require("./config/create-jest-preset");
var paths_to_module_name_mapper_1 = require("./config/paths-to-module-name-mapper");
var ts_jest_transformer_1 = require("./ts-jest-transformer");
var logger_1 = require("./util/logger");
var messages_1 = require("./util/messages");
var testing_1 = require("./util/testing");
var version_checkers_1 = require("./util/version-checkers");
var warn = logger_1.rootLogger.child((_a = {}, _a[bs_logger_1.LogContexts.logLevel] = bs_logger_1.LogLevels.warn, _a));
var helperMoved = function (name, helper) {
    return warn.wrap(messages_1.interpolate(messages_1.Deprecateds.HelperMovedToUtils, { helper: name }), helper);
};
exports.mocked = helperMoved('mocked', testing_1.mocked);
exports.createJestPreset = helperMoved('createJestPreset', create_jest_preset_1.createJestPreset);
exports.pathsToModuleNameMapper = helperMoved('pathsToModuleNameMapper', paths_to_module_name_mapper_1.pathsToModuleNameMapper);
exports.version = require('../package.json').version;
exports.digest = fs_1.readFileSync(path_1.resolve(__dirname, '..', '.ts-jest-digest'), 'utf8');
var transformer;
function defaultTransformer() {
    return transformer || (transformer = createTransformer());
}
function createTransformer(baseConfig) {
    version_checkers_1.VersionCheckers.jest.warn();
    return new ts_jest_transformer_1.TsJestTransformer(baseConfig);
}
exports.createTransformer = createTransformer;
function process() {
    var args = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        args[_i] = arguments[_i];
    }
    var _a;
    return (_a = defaultTransformer()).process.apply(_a, __spread(args));
}
exports.process = process;
function getCacheKey() {
    var args = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        args[_i] = arguments[_i];
    }
    var _a;
    return (_a = defaultTransformer()).getCacheKey.apply(_a, __spread(args));
}
exports.getCacheKey = getCacheKey;
exports.canInstrument = false;
var jestPreset = create_jest_preset_1.createJestPreset();
exports.jestPreset = jestPreset;
exports.__singleton = function () { return transformer; };
exports.__resetModule = function () { return (transformer = undefined); };
