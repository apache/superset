'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createPrefixer = require('./createPrefixer');

var _createPrefixer2 = _interopRequireDefault(_createPrefixer);

var _cursor = require('./plugins/cursor');

var _cursor2 = _interopRequireDefault(_cursor);

var _crossFade = require('./plugins/crossFade');

var _crossFade2 = _interopRequireDefault(_crossFade);

var _filter = require('./plugins/filter');

var _filter2 = _interopRequireDefault(_filter);

var _flex = require('./plugins/flex');

var _flex2 = _interopRequireDefault(_flex);

var _flexboxOld = require('./plugins/flexboxOld');

var _flexboxOld2 = _interopRequireDefault(_flexboxOld);

var _gradient = require('./plugins/gradient');

var _gradient2 = _interopRequireDefault(_gradient);

var _imageSet = require('./plugins/imageSet');

var _imageSet2 = _interopRequireDefault(_imageSet);

var _position = require('./plugins/position');

var _position2 = _interopRequireDefault(_position);

var _sizing = require('./plugins/sizing');

var _sizing2 = _interopRequireDefault(_sizing);

var _transition = require('./plugins/transition');

var _transition2 = _interopRequireDefault(_transition);

var _static = require('../static');

var _static2 = _interopRequireDefault(_static);

var _dynamicData = require('./dynamicData');

var _dynamicData2 = _interopRequireDefault(_dynamicData);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var plugins = [_crossFade2.default, _cursor2.default, _filter2.default, _flexboxOld2.default, _gradient2.default, _imageSet2.default, _position2.default, _sizing2.default, _transition2.default, _flex2.default];

var Prefixer = (0, _createPrefixer2.default)({
  prefixMap: _dynamicData2.default.prefixMap,
  plugins: plugins
}, _static2.default);
exports.default = Prefixer;
module.exports = exports['default'];