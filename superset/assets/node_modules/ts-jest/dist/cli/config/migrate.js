"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _this = this;
Object.defineProperty(exports, "__esModule", { value: true });
var bs_logger_1 = require("bs-logger");
var fast_json_stable_stringify_1 = __importDefault(require("fast-json-stable-stringify"));
var fs_1 = require("fs");
var json5_1 = require("json5");
var path_1 = require("path");
var backports_1 = require("../../util/backports");
var presets_1 = require("../helpers/presets");
exports.run = function (args) { return __awaiter(_this, void 0, void 0, function () {
    var nullLogger, file, filePath, footNotes, name, isPackage, actualConfig, migratedConfig, presetName, preset, jsTransformers, jsWithTs, jsWithBabel, presetValue, migratedValue, presetValue, migratedValue, before, after, stringify, prefix;
    return __generator(this, function (_a) {
        nullLogger = bs_logger_1.createLogger({ targets: [] });
        file = args._[0];
        filePath = path_1.resolve(process.cwd(), file);
        footNotes = [];
        if (!fs_1.existsSync(filePath)) {
            throw new Error("Configuration file " + file + " does not exists.");
        }
        name = path_1.basename(file);
        isPackage = name === 'package.json';
        if (!/\.(js|json)$/.test(name)) {
            throw new TypeError("Configuration file " + file + " must be a JavaScript or JSON file.");
        }
        actualConfig = require(filePath);
        if (isPackage) {
            actualConfig = actualConfig.jest;
        }
        if (!actualConfig)
            actualConfig = {};
        migratedConfig = backports_1.backportJestConfig(nullLogger, actualConfig);
        if (!migratedConfig.preset && args.jestPreset) {
            if (args.js) {
                presetName = args.js === 'babel' ? presets_1.JestPresetNames.jsWIthBabel : presets_1.JestPresetNames.jsWithTs;
            }
            else {
                jsTransformers = Object.keys(migratedConfig.transform || {}).reduce(function (list, pattern) {
                    if (RegExp(pattern.replace(/^<rootDir>\/?/, '/dummy-project/')).test('/dummy-project/src/foo.js')) {
                        var transformer = migratedConfig.transform[pattern];
                        if (/\bbabel-jest\b/.test(transformer))
                            transformer = 'babel-jest';
                        else if (/\ts-jest\b/.test(transformer))
                            transformer = 'ts-jest';
                        return __spread(list, [transformer]);
                    }
                    return list;
                }, []);
                jsWithTs = jsTransformers.includes('ts-jest');
                jsWithBabel = jsTransformers.includes('babel-jest');
                if (jsWithBabel && !jsWithTs) {
                    presetName = presets_1.JestPresetNames.jsWIthBabel;
                }
                else if (jsWithTs && !jsWithBabel) {
                    presetName = presets_1.JestPresetNames.jsWithTs;
                }
                else {
                    presetName = presets_1.JestPresetNames.default;
                }
            }
            presetName = presetName || presets_1.JestPresetNames.default;
            preset = presets_1.allPresets[presetName];
            footNotes.push("Detected preset '" + preset.label + "' as the best matching preset for your configuration.\nVisit https://kulshekhar.github.io/ts-jest/user/config/#jest-preset for more information about presets.\n");
        }
        else if (migratedConfig.preset && migratedConfig.preset.startsWith('ts-jest')) {
            if (args.jestPreset === false) {
                delete migratedConfig.preset;
            }
            else {
                preset = presets_1.allPresets[migratedConfig.preset] || presets_1.defaults;
            }
        }
        if (preset)
            migratedConfig.preset = preset.name;
        if (migratedConfig.moduleFileExtensions && migratedConfig.moduleFileExtensions.length && preset) {
            presetValue = dedupSort(preset.value.moduleFileExtensions || []).join('::');
            migratedValue = dedupSort(migratedConfig.moduleFileExtensions).join('::');
            if (presetValue === migratedValue) {
                delete migratedConfig.moduleFileExtensions;
            }
        }
        if (migratedConfig.testRegex && preset) {
            migratedConfig.testMatch = null;
        }
        else if (migratedConfig.testMatch && migratedConfig.testMatch.length && preset) {
            presetValue = dedupSort(preset.value.testMatch || []).join('::');
            migratedValue = dedupSort(migratedConfig.testMatch).join('::');
            if (presetValue === migratedValue) {
                delete migratedConfig.testMatch;
            }
        }
        if (migratedConfig.transform) {
            Object.keys(migratedConfig.transform).forEach(function (key) {
                var val = migratedConfig.transform[key];
                if (typeof val === 'string' && /\/?ts-jest(?:\/preprocessor\.js)?$/.test(val)) {
                    ;
                    migratedConfig.transform[key] = 'ts-jest';
                }
            });
        }
        if (preset &&
            migratedConfig.transform &&
            fast_json_stable_stringify_1.default(migratedConfig.transform) === fast_json_stable_stringify_1.default(preset.value.transform)) {
            delete migratedConfig.transform;
        }
        cleanupConfig(actualConfig);
        cleanupConfig(migratedConfig);
        before = fast_json_stable_stringify_1.default(actualConfig);
        after = fast_json_stable_stringify_1.default(migratedConfig);
        if (after === before) {
            process.stderr.write("\nNo migration needed for given Jest configuration\n    ");
            return [2];
        }
        stringify = /\.json$/.test(file) ? JSON.stringify : json5_1.stringify;
        prefix = /\.json$/.test(file) ? '"jest": ' : 'module.exports = ';
        if (preset && migratedConfig.transform) {
            footNotes.push("\nI couldn't check if your \"transform\" value is the same as mine which is: " + stringify(preset.value.transform, undefined, '  ') + "\nIf it is the case, you can safely remove the \"transform\" from what I've migrated.\n");
        }
        process.stderr.write("\nMigrated Jest configuration:\n");
        process.stdout.write("" + prefix + stringify(migratedConfig, undefined, '  ') + "\n");
        if (footNotes.length) {
            process.stderr.write("\n" + footNotes.join('\n') + "\n");
        }
        return [2];
    });
}); };
function cleanupConfig(config) {
    if (config.globals) {
        if (config.globals['ts-jest'] && Object.keys(config.globals['ts-jest']).length === 0) {
            delete config.globals['ts-jest'];
        }
        if (Object.keys(config.globals).length === 0) {
            delete config.globals;
        }
    }
    if (config.transform && Object.keys(config.transform).length === 0) {
        delete config.transform;
    }
    if (config.moduleFileExtensions) {
        config.moduleFileExtensions = dedupSort(config.moduleFileExtensions);
        if (config.moduleFileExtensions.length === 0)
            delete config.moduleFileExtensions;
    }
    if (config.testMatch) {
        config.testMatch = dedupSort(config.testMatch);
        if (config.testMatch.length === 0)
            delete config.testMatch;
    }
    if (config.preset === presets_1.JestPresetNames.default)
        config.preset = presets_1.defaults.name;
}
function dedupSort(arr) {
    return arr
        .filter(function (s, i, a) { return a.findIndex(function (e) { return s.toString() === e.toString(); }) === i; })
        .sort(function (a, b) { return (a.toString() > b.toString() ? 1 : a.toString() < b.toString() ? -1 : 0); });
}
exports.help = function () { return __awaiter(_this, void 0, void 0, function () {
    return __generator(this, function (_a) {
        process.stdout.write("\nUsage:\n  ts-jest config:migrate [options] <config-file>\n\nArguments:\n  <config-file>         Can be a js or json Jest config file. If it is a\n                        package.json file, the configuration will be read from\n                        the \"jest\" property.\n\nOptions:\n  --js ts|babel         Process .js files with ts-jest if 'ts' or with\n                        babel-jest if 'babel'\n  --no-jest-preset      Disable the use of Jest presets\n");
        return [2];
    });
}); };
