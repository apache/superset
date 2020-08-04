'use strict';

exports.__esModule = true;

var _kefir = require('kefir');

var _kefir2 = _interopRequireDefault(_kefir);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var config = {
  fromESObservable: _kefir2.default.fromESObservable,
  toESObservable: function toESObservable(stream) {
    return stream.toESObservable();
  }
};

exports.default = config;