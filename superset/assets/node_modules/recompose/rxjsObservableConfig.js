'use strict';

exports.__esModule = true;

var _rxjs = require('rxjs');

var _rxjs2 = _interopRequireDefault(_rxjs);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var config = {
  fromESObservable: _rxjs2.default.Observable.from,
  toESObservable: function toESObservable(stream) {
    return stream;
  }
};

exports.default = config;