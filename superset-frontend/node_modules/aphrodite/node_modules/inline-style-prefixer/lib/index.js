'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.prefix = exports.createPrefixer = undefined;

var _createPrefixer = require('./createPrefixer');

var _createPrefixer2 = _interopRequireDefault(_createPrefixer);

var _data = require('./data');

var _data2 = _interopRequireDefault(_data);

var _backgroundClip = require('./plugins/backgroundClip');

var _backgroundClip2 = _interopRequireDefault(_backgroundClip);

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

var _grid = require('./plugins/grid');

var _grid2 = _interopRequireDefault(_grid);

var _imageSet = require('./plugins/imageSet');

var _imageSet2 = _interopRequireDefault(_imageSet);

var _logical = require('./plugins/logical');

var _logical2 = _interopRequireDefault(_logical);

var _position = require('./plugins/position');

var _position2 = _interopRequireDefault(_position);

var _sizing = require('./plugins/sizing');

var _sizing2 = _interopRequireDefault(_sizing);

var _transition = require('./plugins/transition');

var _transition2 = _interopRequireDefault(_transition);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var plugins = [_backgroundClip2.default, _crossFade2.default, _cursor2.default, _filter2.default, _flexboxOld2.default, _gradient2.default, _grid2.default, _imageSet2.default, _logical2.default, _position2.default, _sizing2.default, _transition2.default, _flex2.default];

var prefix = (0, _createPrefixer2.default)({
  prefixMap: _data2.default.prefixMap,
  plugins: plugins
});

exports.createPrefixer = _createPrefixer2.default;
exports.prefix = prefix;