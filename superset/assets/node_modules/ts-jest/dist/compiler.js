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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var bs_logger_1 = require("bs-logger");
var buffer_from_1 = __importDefault(require("buffer-from"));
var stableStringify = require("fast-json-stable-stringify");
var fs_1 = require("fs");
var mkdirp = require("mkdirp");
var path_1 = require("path");
var messages_1 = require("./util/messages");
var sha1_1 = require("./util/sha1");
var hasOwn = Object.prototype.hasOwnProperty;
function createCompiler(configs) {
    var e_1, _a, _b, _c;
    var logger = configs.logger.child({ namespace: 'ts-compiler' });
    logger.debug('creating typescript compiler', configs.tsJest.isolatedModules ? '(isolated modules)' : '(language service)');
    var cachedir = configs.tsCacheDir;
    var memoryCache = {
        contents: Object.create(null),
        versions: Object.create(null),
        outputs: Object.create(null),
    };
    var ts = configs.compilerModule;
    var cwd = configs.cwd;
    var extensions = ['.ts', '.tsx'];
    var _d = configs.typescript, compilerOptions = _d.options, fileNames = _d.fileNames;
    if (compilerOptions.allowJs) {
        extensions.push('.js');
        extensions.push('.jsx');
    }
    try {
        for (var fileNames_1 = __values(fileNames), fileNames_1_1 = fileNames_1.next(); !fileNames_1_1.done; fileNames_1_1 = fileNames_1.next()) {
            var path = fileNames_1_1.value;
            memoryCache.versions[path] = 1;
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (fileNames_1_1 && !fileNames_1_1.done && (_a = fileNames_1.return)) _a.call(fileNames_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    var getExtension = compilerOptions.jsx === ts.JsxEmit.Preserve
        ? function (path) { return (/\.[tj]sx$/.test(path) ? '.jsx' : '.js'); }
        : function (_) { return '.js'; };
    var transformers = configs.tsCustomTransformers;
    var getOutput = function (code, fileName) {
        logger.debug({ fileName: fileName }, 'getOutput(): compiling as isolated module');
        var result = ts.transpileModule(code, {
            fileName: fileName,
            transformers: transformers,
            compilerOptions: compilerOptions,
            reportDiagnostics: configs.shouldReportDiagnostic(fileName),
        });
        if (result.diagnostics)
            configs.raiseDiagnostics(result.diagnostics, fileName, logger);
        return [result.outputText, result.sourceMapText];
    };
    var getTypeInfo = function (_code, _fileName, _position) {
        throw new TypeError(messages_1.Errors.TypesUnavailableWithoutTypeCheck);
    };
    if (!configs.tsJest.isolatedModules) {
        var updateMemoryCache_1 = function (code, fileName) {
            logger.debug({ fileName: fileName }, "updateMemoryCache()");
            if (memoryCache.contents[fileName] !== code) {
                memoryCache.contents[fileName] = code;
                memoryCache.versions[fileName] = (memoryCache.versions[fileName] || 0) + 1;
            }
        };
        var serviceHostDebugCtx = (_b = {},
            _b[bs_logger_1.LogContexts.logLevel] = bs_logger_1.LogLevels.debug,
            _b.namespace = 'ts:serviceHost',
            _b.call = null,
            _b);
        var serviceHostTraceCtx = __assign({}, serviceHostDebugCtx, (_c = {}, _c[bs_logger_1.LogContexts.logLevel] = bs_logger_1.LogLevels.trace, _c));
        var serviceHost = {
            getScriptFileNames: function () { return Object.keys(memoryCache.versions); },
            getScriptVersion: function (fileName) {
                var version = memoryCache.versions[fileName];
                return version === undefined ? undefined : String(version);
            },
            getScriptSnapshot: function (fileName) {
                var hit = hasOwn.call(memoryCache.contents, fileName);
                logger.trace({ fileName: fileName, cacheHit: hit }, "getScriptSnapshot():", 'cache', hit ? 'hit' : 'miss');
                if (!hit) {
                    memoryCache.contents[fileName] = ts.sys.readFile(fileName);
                }
                var contents = memoryCache.contents[fileName];
                if (contents === undefined) {
                    return;
                }
                return ts.ScriptSnapshot.fromString(contents);
            },
            fileExists: ts.sys.fileExists,
            readFile: logger.wrap(serviceHostTraceCtx, 'readFile', ts.sys.readFile),
            readDirectory: ts.sys.readDirectory,
            getDirectories: ts.sys.getDirectories,
            directoryExists: ts.sys.directoryExists,
            getNewLine: function () { return '\n'; },
            getCurrentDirectory: function () { return cwd; },
            getCompilationSettings: function () { return compilerOptions; },
            getDefaultLibFileName: function () { return ts.getDefaultLibFilePath(compilerOptions); },
            getCustomTransformers: function () { return transformers; },
        };
        logger.debug('creating language service');
        var service_1 = ts.createLanguageService(serviceHost);
        getOutput = function (code, fileName) {
            logger.debug({ fileName: fileName }, 'getOutput(): compiling using language service');
            updateMemoryCache_1(code, fileName);
            var output = service_1.getEmitOutput(fileName);
            if (configs.shouldReportDiagnostic(fileName)) {
                logger.debug({ fileName: fileName }, 'getOutput(): computing diagnostics');
                var diagnostics = service_1
                    .getCompilerOptionsDiagnostics()
                    .concat(service_1.getSyntacticDiagnostics(fileName))
                    .concat(service_1.getSemanticDiagnostics(fileName));
                configs.raiseDiagnostics(diagnostics, fileName, logger);
            }
            if (output.emitSkipped) {
                throw new TypeError(path_1.relative(cwd, fileName) + ": Emit skipped");
            }
            if (output.outputFiles.length === 0) {
                throw new TypeError(messages_1.interpolate(messages_1.Errors.UnableToRequireDefinitionFile, {
                    file: path_1.basename(fileName),
                }));
            }
            return [output.outputFiles[1].text, output.outputFiles[0].text];
        };
        getTypeInfo = function (code, fileName, position) {
            updateMemoryCache_1(code, fileName);
            var info = service_1.getQuickInfoAtPosition(fileName, position);
            var name = ts.displayPartsToString(info ? info.displayParts : []);
            var comment = ts.displayPartsToString(info ? info.documentation : []);
            return { name: name, comment: comment };
        };
    }
    var compile = readThrough(cachedir, memoryCache, getOutput, getExtension, cwd, logger);
    return { cwd: cwd, compile: compile, getTypeInfo: getTypeInfo, extensions: extensions, cachedir: cachedir, ts: ts };
}
exports.createCompiler = createCompiler;
function readThrough(cachedir, memoryCache, compile, getExtension, cwd, logger) {
    if (!cachedir) {
        return function (code, fileName, lineOffset) {
            logger.debug({ fileName: fileName }, 'readThrough(): no cache');
            var _a = __read(compile(code, fileName, lineOffset), 2), value = _a[0], sourceMap = _a[1];
            var output = updateOutput(value, fileName, sourceMap, getExtension, cwd);
            memoryCache.outputs[fileName] = output;
            return output;
        };
    }
    mkdirp.sync(cachedir);
    return function (code, fileName, lineOffset) {
        var cachePath = path_1.join(cachedir, getCacheName(code, fileName));
        var extension = getExtension(fileName);
        var outputPath = "" + cachePath + extension;
        try {
            var output_1 = fs_1.readFileSync(outputPath, 'utf8');
            if (isValidCacheContent(output_1)) {
                logger.debug({ fileName: fileName }, 'readThrough(): cache hit');
                memoryCache.outputs[fileName] = output_1;
                return output_1;
            }
        }
        catch (err) { }
        logger.debug({ fileName: fileName }, 'readThrough(): cache miss');
        var _a = __read(compile(code, fileName, lineOffset), 2), value = _a[0], sourceMap = _a[1];
        var output = updateOutput(value, fileName, sourceMap, getExtension, cwd);
        logger.debug({ fileName: fileName, outputPath: outputPath }, 'readThrough(): writing caches');
        memoryCache.outputs[fileName] = output;
        fs_1.writeFileSync(outputPath, output);
        return output;
    };
}
function updateOutput(outputText, fileName, sourceMap, getExtension, sourceRoot) {
    var base = path_1.basename(fileName);
    var base64Map = buffer_from_1.default(updateSourceMap(sourceMap, fileName, sourceRoot), 'utf8').toString('base64');
    var sourceMapContent = "data:application/json;charset=utf-8;base64," + base64Map;
    var sourceMapLength = (base + ".map").length + (getExtension(fileName).length - path_1.extname(fileName).length);
    return outputText.slice(0, -sourceMapLength) + sourceMapContent;
}
function updateSourceMap(sourceMapText, fileName, _sourceRoot) {
    var sourceMap = JSON.parse(sourceMapText);
    sourceMap.file = fileName;
    sourceMap.sources = [fileName];
    delete sourceMap.sourceRoot;
    return stableStringify(sourceMap);
}
function getCacheName(sourceCode, fileName) {
    return sha1_1.sha1(path_1.extname(fileName), '\x00', sourceCode);
}
function isValidCacheContent(contents) {
    return /(?:9|0=|Q==)$/.test(contents.slice(-3));
}
