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
var util_1 = require("util");
var config_set_1 = require("./config/config-set");
var json_1 = require("./util/json");
var jsonable_value_1 = require("./util/jsonable-value");
var logger_1 = require("./util/logger");
var messages_1 = require("./util/messages");
var sha1_1 = require("./util/sha1");
exports.INSPECT_CUSTOM = util_1.inspect.custom || 'inspect';
var TsJestTransformer = (function () {
    function TsJestTransformer(baseOptions) {
        if (baseOptions === void 0) { baseOptions = {}; }
        this.options = __assign({}, baseOptions);
        this.id = TsJestTransformer._nextTransformerId;
        this.logger = logger_1.rootLogger.child({
            transformerId: this.id,
            namespace: 'jest-transformer',
        });
        this.logger.debug({ baseOptions: baseOptions }, 'created new transformer');
    }
    Object.defineProperty(TsJestTransformer, "lastTransformerId", {
        get: function () {
            return TsJestTransformer._lastTransformerId;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(TsJestTransformer, "_nextTransformerId", {
        get: function () {
            return ++TsJestTransformer._lastTransformerId;
        },
        enumerable: true,
        configurable: true
    });
    TsJestTransformer.prototype[exports.INSPECT_CUSTOM] = function () {
        return "[object TsJestTransformer<#" + this.id + ">]";
    };
    TsJestTransformer.prototype.configsFor = function (jestConfig) {
        var csi;
        var jestConfigObj;
        if (typeof jestConfig === 'string') {
            csi = TsJestTransformer._configSetsIndex.find(function (cs) { return cs.jestConfig.serialized === jestConfig; });
            if (csi)
                return csi.configSet;
            jestConfigObj = json_1.parse(jestConfig);
        }
        else {
            csi = TsJestTransformer._configSetsIndex.find(function (cs) { return cs.jestConfig.value === jestConfig; });
            if (csi)
                return csi.configSet;
            var serialized_1 = json_1.stringify(jestConfig);
            csi = TsJestTransformer._configSetsIndex.find(function (cs) { return cs.jestConfig.serialized === serialized_1; });
            if (csi) {
                csi.jestConfig.value = jestConfig;
                return csi.configSet;
            }
            jestConfigObj = jestConfig;
        }
        this.logger.info("no matching config-set found, creating a new one");
        var configSet = new config_set_1.ConfigSet(jestConfigObj, this.options, this.logger);
        TsJestTransformer._configSetsIndex.push({
            jestConfig: new jsonable_value_1.JsonableValue(jestConfigObj),
            configSet: configSet,
        });
        return configSet;
    };
    TsJestTransformer.prototype.process = function (input, filePath, jestConfig, transformOptions) {
        this.logger.debug({ fileName: filePath, transformOptions: transformOptions }, 'processing', filePath);
        var result;
        var source = input;
        var configs = this.configsFor(jestConfig);
        var hooks = configs.hooks;
        var stringify = configs.shouldStringifyContent(filePath);
        var babelJest = stringify ? undefined : configs.babelJestTransformer;
        var isDefinitionFile = filePath.endsWith('.d.ts');
        var isJsFile = !isDefinitionFile && /\.jsx?$/.test(filePath);
        var isTsFile = isDefinitionFile || /\.tsx?$/.test(filePath);
        if (stringify) {
            result = "module.exports=" + JSON.stringify(source);
        }
        else if (isDefinitionFile) {
            result = '';
        }
        else if (!configs.typescript.options.allowJs && isJsFile) {
            this.logger.warn({ fileName: filePath }, messages_1.interpolate(messages_1.Errors.GotJsFileButAllowJsFalse, { path: filePath }));
            result = source;
        }
        else if (isJsFile || isTsFile) {
            result = configs.tsCompiler.compile(source, filePath);
        }
        else {
            var message = babelJest ? messages_1.Errors.GotUnknownFileTypeWithBabel : messages_1.Errors.GotUnknownFileTypeWithoutBabel;
            this.logger.warn({ fileName: filePath }, messages_1.interpolate(message, { path: filePath }));
            result = source;
        }
        if (babelJest) {
            this.logger.debug({ fileName: filePath }, 'calling babel-jest processor');
            result = babelJest.process(result, filePath, jestConfig, __assign({}, transformOptions, { instrument: false }));
        }
        if (hooks.afterProcess) {
            this.logger.debug({ fileName: filePath, hookName: 'afterProcess' }, 'calling afterProcess hook');
            var newResult = hooks.afterProcess([input, filePath, jestConfig, transformOptions], result);
            if (newResult !== undefined) {
                return newResult;
            }
        }
        return result;
    };
    TsJestTransformer.prototype.getCacheKey = function (fileContent, filePath, jestConfigStr, transformOptions) {
        if (transformOptions === void 0) { transformOptions = {}; }
        this.logger.debug({ fileName: filePath, transformOptions: transformOptions }, 'computing cache key for', filePath);
        var configs = this.configsFor(jestConfigStr);
        var _a = transformOptions.instrument, instrument = _a === void 0 ? false : _a, _b = transformOptions.rootDir, rootDir = _b === void 0 ? configs.rootDir : _b;
        return sha1_1.sha1(configs.cacheKey, '\x00', rootDir, '\x00', "instrument:" + (instrument ? 'on' : 'off'), '\x00', fileContent, '\x00', filePath);
    };
    TsJestTransformer._configSetsIndex = [];
    TsJestTransformer._lastTransformerId = 0;
    return TsJestTransformer;
}());
exports.TsJestTransformer = TsJestTransformer;
