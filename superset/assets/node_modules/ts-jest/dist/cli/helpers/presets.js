"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var JestPresetNames;
(function (JestPresetNames) {
    JestPresetNames["default"] = "ts-jest/presets/default";
    JestPresetNames["jsWithTs"] = "ts-jest/presets/js-with-ts";
    JestPresetNames["jsWIthBabel"] = "ts-jest/presets/js-with-babel";
})(JestPresetNames = exports.JestPresetNames || (exports.JestPresetNames = {}));
var definePreset = function (fullName) { return ({
    fullName: fullName,
    get name() {
        return this.isDefault ? 'ts-jest' : fullName;
    },
    get label() {
        return fullName.split('/').pop();
    },
    get jsVarName() {
        return this.isDefault
            ? 'defaults'
            : fullName
                .split('/')
                .pop()
                .replace(/\-([a-z])/g, function (_, l) { return l.toUpperCase(); });
    },
    get value() {
        return require("../../../" + fullName.replace(/^ts-jest\//, '') + "/jest-preset");
    },
    jsImport: function (varName) {
        if (varName === void 0) { varName = 'tsjPreset'; }
        return "const { " + this.jsVarName + ": " + varName + " } = require('ts-jest/presets')";
    },
    get isDefault() {
        return fullName === JestPresetNames.default;
    },
}); };
exports.allPresets = {};
exports.defaults = (exports.allPresets[JestPresetNames.default] = definePreset(JestPresetNames.default));
exports.jsWithTs = (exports.allPresets[JestPresetNames.jsWithTs] = definePreset(JestPresetNames.jsWithTs));
exports.jsWIthBabel = (exports.allPresets[JestPresetNames.jsWIthBabel] = definePreset(JestPresetNames.jsWIthBabel));
