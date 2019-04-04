'use strict';

exports.__esModule = true;

var _symbolObservable = require('symbol-observable');

var _symbolObservable2 = _interopRequireDefault(_symbolObservable);

var _rx = require('rx');

var _rx2 = _interopRequireDefault(_rx);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var config = {
  fromESObservable: function fromESObservable(observable) {
    return _rx2.default.Observable.create(function (observer) {
      var _observable$subscribe = observable.subscribe({
        next: function next(val) {
          return observer.onNext(val);
        },
        error: function error(_error) {
          return observer.onError(_error);
        },
        complete: function complete() {
          return observer.onCompleted();
        }
      }),
          unsubscribe = _observable$subscribe.unsubscribe;

      return unsubscribe;
    });
  },
  toESObservable: function toESObservable(rxObservable) {
    var _ref;

    return _ref = {
      subscribe: function subscribe(observer) {
        var subscription = rxObservable.subscribe(function (val) {
          return observer.next(val);
        }, function (error) {
          return observer.error(error);
        }, function () {
          return observer.complete();
        });
        return { unsubscribe: function unsubscribe() {
            return subscription.dispose();
          } };
      }
    }, _ref[_symbolObservable2.default] = function () {
      return this;
    }, _ref;
  }
};

exports.default = config;