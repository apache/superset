'use strict';

exports.__esModule = true;
exports.createEventHandlerWithConfig = undefined;

var _symbolObservable = require('symbol-observable');

var _symbolObservable2 = _interopRequireDefault(_symbolObservable);

var _changeEmitter = require('change-emitter');

var _setObservableConfig = require('./setObservableConfig');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var createEventHandlerWithConfig = exports.createEventHandlerWithConfig = function createEventHandlerWithConfig(config) {
  return function () {
    var _config$fromESObserva;

    var emitter = (0, _changeEmitter.createChangeEmitter)();
    var stream = config.fromESObservable((_config$fromESObserva = {
      subscribe: function subscribe(observer) {
        var unsubscribe = emitter.listen(function (value) {
          return observer.next(value);
        });
        return { unsubscribe: unsubscribe };
      }
    }, _config$fromESObserva[_symbolObservable2.default] = function () {
      return this;
    }, _config$fromESObserva));
    return {
      handler: emitter.emit,
      stream: stream
    };
  };
};

var createEventHandler = createEventHandlerWithConfig(_setObservableConfig.config);

exports.default = createEventHandler;