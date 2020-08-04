'use strict';

exports.__esModule = true;

var _symbolObservable = require('symbol-observable');

var _symbolObservable2 = _interopRequireDefault(_symbolObservable);

var _flyd = require('flyd');

var _flyd2 = _interopRequireDefault(_flyd);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var noop = function noop() {};

var config = {
  fromESObservable: function fromESObservable(observable) {
    var stream = _flyd2.default.stream();

    var _observable$subscribe = observable.subscribe({
      next: function next(value) {
        return stream(value);
      },
      error: function error(_error) {
        return stream({ error: _error });
      },
      complete: function complete() {
        return stream.end(true);
      }
    }),
        unsubscribe = _observable$subscribe.unsubscribe;

    _flyd2.default.on(unsubscribe, stream.end);
    return stream;
  },

  toESObservable: function toESObservable(stream) {
    var _ref;

    return _ref = {
      subscribe: function subscribe(observer) {
        var sub = _flyd2.default.on(observer.next || noop, stream);
        _flyd2.default.on(function (_) {
          return observer.complete();
        }, sub.end);
        return {
          unsubscribe: function unsubscribe() {
            return sub.end(true);
          }
        };
      }
    }, _ref[_symbolObservable2.default] = function () {
      return this;
    }, _ref;
  }
};

exports.default = config;