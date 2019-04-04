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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var _this = this;
Object.defineProperty(exports, "__esModule", { value: true });
var fs_1 = require("fs");
var json5_1 = require("json5");
var path_1 = require("path");
var presets_1 = require("../helpers/presets");
exports.run = function (args) { return __awaiter(_this, void 0, void 0, function () {
    var file, filePath, name, isPackage, exists, pkgFile, hasPackage, _a, jestPreset, askedTsconfig, force, jsdom, tsconfig, pkgJson, jsFilesProcessor, shouldPostProcessWithBabel, preset, body, base, tsJestConf, content;
    return __generator(this, function (_b) {
        file = args._[0] || 'jest.config.js';
        filePath = path_1.join(process.cwd(), file);
        name = path_1.basename(file);
        isPackage = name === 'package.json';
        exists = fs_1.existsSync(filePath);
        pkgFile = isPackage ? filePath : path_1.join(process.cwd(), 'package.json');
        hasPackage = isPackage || fs_1.existsSync(pkgFile);
        _a = args.jestPreset, jestPreset = _a === void 0 ? true : _a, askedTsconfig = args.tsconfig, force = args.force, jsdom = args.jsdom;
        tsconfig = askedTsconfig === 'tsconfig.json' ? undefined : askedTsconfig;
        pkgJson = hasPackage ? JSON.parse(fs_1.readFileSync(pkgFile, 'utf8')) : {};
        jsFilesProcessor = args.js, shouldPostProcessWithBabel = args.babel;
        if (jsFilesProcessor == null) {
            jsFilesProcessor = shouldPostProcessWithBabel ? 'babel' : undefined;
        }
        else if (shouldPostProcessWithBabel == null) {
            shouldPostProcessWithBabel = jsFilesProcessor === 'babel';
        }
        if (jsFilesProcessor === 'babel') {
            preset = presets_1.jsWIthBabel;
        }
        else if (jsFilesProcessor === 'ts') {
            preset = presets_1.jsWithTs;
        }
        else {
            preset = presets_1.defaults;
        }
        if (isPackage && !exists) {
            throw new Error("File " + file + " does not exists.");
        }
        else if (!isPackage && exists && !force) {
            throw new Error("Configuration file " + file + " already exists.");
        }
        if (!isPackage && !name.endsWith('.js')) {
            throw new TypeError("Configuration file " + file + " must be a .js file or the package.json.");
        }
        if (hasPackage && pkgJson.jest) {
            if (force && !isPackage) {
                delete pkgJson.jest;
                fs_1.writeFileSync(pkgFile, JSON.stringify(pkgJson, undefined, '  '));
            }
            else if (!force) {
                throw new Error("A Jest configuration is already set in " + pkgFile + ".");
            }
        }
        if (isPackage) {
            base = jestPreset ? { preset: preset.name } : __assign({}, preset.value);
            if (!jsdom)
                base.testEnvironment = 'node';
            if (tsconfig || shouldPostProcessWithBabel) {
                tsJestConf = {};
                base.globals = { 'ts-jest': tsJestConf };
                if (tsconfig)
                    tsJestConf.tsconfig = tsconfig;
                if (shouldPostProcessWithBabel)
                    tsJestConf.babelConfig = true;
            }
            body = JSON.stringify(__assign({}, pkgJson, { jest: base }), undefined, '  ');
        }
        else {
            content = [];
            if (!jestPreset) {
                content.push(preset.jsImport('tsjPreset') + ";", '');
            }
            content.push('module.exports = {');
            if (jestPreset) {
                content.push("  preset: '" + preset.name + "',");
            }
            else {
                content.push("  ...tsjPreset,");
            }
            if (!jsdom)
                content.push("  testEnvironment: 'node',");
            if (tsconfig || shouldPostProcessWithBabel) {
                content.push("  globals: {");
                content.push("    'ts-jest': {");
                if (tsconfig)
                    content.push("      tsconfig: " + json5_1.stringify(tsconfig) + ",");
                if (shouldPostProcessWithBabel)
                    content.push("      babelConfig: true,");
                content.push("    },");
                content.push("  },");
            }
            content.push('};');
            body = content.join('\n');
        }
        fs_1.writeFileSync(filePath, body);
        process.stderr.write("\nJest configuration written to \"" + filePath + "\".\n");
        return [2];
    });
}); };
exports.help = function () { return __awaiter(_this, void 0, void 0, function () {
    return __generator(this, function (_a) {
        process.stdout.write("\nUsage:\n  ts-jest config:init [options] [<config-file>]\n\nArguments:\n  <config-file>         Can be a js or json Jest config file. If it is a\n                        package.json file, the configuration will be read from\n                        the \"jest\" property.\n                        Default: jest.config.js\n\nOptions:\n  --force               Discard any existing Jest config\n  --js ts|babel         Process .js files with ts-jest if 'ts' or with\n                        babel-jest if 'babel'\n  --no-jest-preset      Disable the use of Jest presets\n  --tsconfig <file>     Path to the tsconfig.json file\n  --babel               Pipe babel-jest after ts-jest\n  --jsdom               Use jsdom as test environment instead of node\n");
        return [2];
    });
}); };
