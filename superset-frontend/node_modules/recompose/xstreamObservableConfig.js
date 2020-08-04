'use strict';

exports.__esModule = true;

var _symbolObservable = require('symbol-observable');

var _symbolObservable2 = _interopRequireDefault(_symbolObservable);

var _xstream = require('xstream');

var _xstream2 = _interopRequireDefault(_xstream);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var noop = function noop() {};

var config = {
  fromESObservable: function fromESObservable(observable) {
    return _xstream2.default.create({
      subscription: null,
      start: function start(listener) {
        this.subscription = observable.subscribe(listener);
      },
      stop: function stop() {
        this.subscription.unsubscribe();
      }
    });
  },
  toESObservable: function toESObservable(stream) {
    var _ref;

    return _ref = {
      subscribe: function subscribe(observer) {
        var listener = {
          next: observer.next || noop,
          error: observer.error || noop,
          complete: observer.complete || noop
        };
        stream.addListener(listener);
        return {
          unsubscribe: function unsubscribe() {
            return stream.removeListener(listener);
          }
        };
      }
    }, _ref[_symbolObservable2.default] = function () {
      return this;
    }, _ref;
  }
};

exports.default = config;