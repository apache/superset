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
var _a;
var bs_logger_1 = require("bs-logger");
var messages_1 = require("./messages");
var context = (_a = {}, _a[bs_logger_1.LogContexts.namespace] = 'backports', _a);
exports.backportJestConfig = function (logger, config) {
    logger.debug(__assign({}, context, { config: config }), 'backporting config');
    var _a = (config || {}).globals, globals = _a === void 0 ? {} : _a;
    var _b = globals["ts-jest"], tsJest = _b === void 0 ? {} : _b;
    var mergeTsJest = {};
    var hadWarnings = false;
    var warnConfig = function (oldPath, newPath, note) {
        hadWarnings = true;
        logger.warn(context, messages_1.interpolate(note ? messages_1.Deprecateds.ConfigOptionWithNote : messages_1.Deprecateds.ConfigOption, {
            oldPath: oldPath,
            newPath: newPath,
            note: note,
        }));
    };
    if ('__TS_CONFIG__' in globals) {
        warnConfig('globals.__TS_CONFIG__', 'globals.ts-jest.tsConfig');
        if (typeof globals.__TS_CONFIG__ === 'object') {
            mergeTsJest.tsConfig = globals.__TS_CONFIG__;
        }
        delete globals.__TS_CONFIG__;
    }
    if ('__TRANSFORM_HTML__' in globals) {
        warnConfig('globals.__TRANSFORM_HTML__', 'globals.ts-jest.stringifyContentPathRegex');
        if (globals.__TRANSFORM_HTML__) {
            mergeTsJest.stringifyContentPathRegex = '\\.html?$';
        }
        delete globals.__TRANSFORM_HTML__;
    }
    if ('typeCheck' in tsJest) {
        warnConfig('globals.ts-jest.typeCheck', 'globals.ts-jest.isolatedModules');
        mergeTsJest.isolatedModules = !tsJest.typeCheck;
        delete tsJest.typeCheck;
    }
    if ('tsConfigFile' in tsJest) {
        warnConfig('globals.ts-jest.tsConfigFile', 'globals.ts-jest.tsConfig');
        if (tsJest.tsConfigFile) {
            mergeTsJest.tsConfig = tsJest.tsConfigFile;
        }
        delete tsJest.tsConfigFile;
    }
    if ('enableTsDiagnostics' in tsJest) {
        warnConfig('globals.ts-jest.enableTsDiagnostics', 'globals.ts-jest.diagnostics');
        if (tsJest.enableTsDiagnostics) {
            mergeTsJest.diagnostics = { warnOnly: true };
            if (typeof tsJest.enableTsDiagnostics === 'string')
                mergeTsJest.diagnostics.pathRegex = tsJest.enableTsDiagnostics;
        }
        else {
            mergeTsJest.diagnostics = false;
        }
        delete tsJest.enableTsDiagnostics;
    }
    if ('useBabelrc' in tsJest) {
        warnConfig('globals.ts-jest.useBabelrc', 'globals.ts-jest.babelConfig', messages_1.Deprecateds.ConfigOptionUseBabelRcNote);
        if (tsJest.useBabelrc != null) {
            mergeTsJest.babelConfig = tsJest.useBabelrc ? true : {};
        }
        delete tsJest.useBabelrc;
    }
    if ('skipBabel' in tsJest) {
        warnConfig('globals.ts-jest.skipBabel', 'globals.ts-jest.babelConfig');
        if (tsJest.skipBabel === false && !mergeTsJest.babelConfig) {
            mergeTsJest.babelConfig = true;
        }
        delete tsJest.skipBabel;
    }
    if (hadWarnings) {
        logger.warn(context, messages_1.Helps.MigrateConfigUsingCLI);
    }
    return __assign({}, config, { globals: __assign({}, globals, { 'ts-jest': __assign({}, mergeTsJest, tsJest) }) });
};
exports.backportTsJestDebugEnvVar = function (logger) {
    if ('TS_JEST_DEBUG' in process.env) {
        var shouldLog = !/^\s*(?:0|f(?:alse)?|no?|disabled?|off|)\s*$/i.test(process.env.TS_JEST_DEBUG || '');
        delete process.env.TS_JEST_DEBUG;
        if (shouldLog) {
            process.env.TS_JEST_LOG = "ts-jest.log,stderr:warn";
        }
        logger.warn(context, messages_1.interpolate(messages_1.Deprecateds.EnvVar, {
            old: 'TS_JEST_DEBUG',
            new: 'TS_JEST_LOG',
        }));
    }
};
