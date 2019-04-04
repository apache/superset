'use strict';

exports.__esModule = true;

var _most = require('most');

var config = {
  fromESObservable: _most.from || _most.Stream.from,
  toESObservable: function toESObservable(stream) {
    return stream;
  }
};

exports.default = config;