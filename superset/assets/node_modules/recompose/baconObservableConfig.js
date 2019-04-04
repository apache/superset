'use strict';

exports.__esModule = true;

var _symbolObservable = require('symbol-observable');

var _symbolObservable2 = _interopRequireDefault(_symbolObservable);

var _baconjs = require('baconjs');

var _baconjs2 = _interopRequireDefault(_baconjs);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var config = {
  fromESObservable: function fromESObservable(observable) {
    return _baconjs2.default.fromBinder(function (sink) {
      var _observable$subscribe = observable.subscribe({
        next: function next(val) {
          return sink(new _baconjs2.default.Next(val));
        },
        error: function error(err) {
          return sink(new _baconjs2.default.Error(err));
        },
        complete: function complete() {
          return sink(new _baconjs2.default.End());
        }
      }),
          unsubscribe = _observable$subscribe.unsubscribe;

      return unsubscribe;
    });
  },
  toESObservable: function toESObservable(stream) {
    var _ref;

    return _ref = {
      subscribe: function subscribe(observer) {
        var unsubscribe = stream.subscribe(function (event) {
          if (event.hasValue()) {
            observer.next(event.value());
          } else if (event.isError()) {
            observer.error(event.error);
          } else if (event.isEnd()) {
            observer.complete();
          }
        });
        return { unsubscribe: unsubscribe };
      }
    }, _ref[_symbolObservable2.default] = function () {
      return this;
    }, _ref;
  }
};

exports.default = config;