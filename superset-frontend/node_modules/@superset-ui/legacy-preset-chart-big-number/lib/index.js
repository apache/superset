"use strict";

exports.__esModule = true;
exports.BigNumberChartPreset = exports.BigNumberTotalChartPlugin = exports.BigNumberChartPlugin = void 0;

var _index = _interopRequireDefault(require("./BigNumber/index"));

exports.BigNumberChartPlugin = _index.default;

var _index2 = _interopRequireDefault(require("./BigNumberTotal/index"));

exports.BigNumberTotalChartPlugin = _index2.default;

var _preset = _interopRequireDefault(require("./preset"));

exports.BigNumberChartPreset = _preset.default;

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }