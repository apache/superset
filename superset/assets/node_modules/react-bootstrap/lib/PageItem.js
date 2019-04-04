'use strict';

exports.__esModule = true;

var _PagerItem = require('./PagerItem');

var _PagerItem2 = _interopRequireDefault(_PagerItem);

var _deprecationWarning = require('./utils/deprecationWarning');

var _deprecationWarning2 = _interopRequireDefault(_deprecationWarning);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.default = _deprecationWarning2.default.wrapper(_PagerItem2.default, '`<PageItem>`', '`<Pager.Item>`');
module.exports = exports['default'];