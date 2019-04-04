'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = configureStore;

var _redux = require('redux');

var _lodash = require('lodash.isplainobject');

var _lodash2 = _interopRequireDefault(_lodash);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

var isFunction = function isFunction(arg) {
  return typeof arg === 'function';
};

function configureStore() {
  var middlewares = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];

  return function mockStore() {
    var _getState = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

    function mockStoreWithoutMiddleware() {
      var actions = [];
      var listeners = [];

      var self = {
        getState: function getState() {
          return isFunction(_getState) ? _getState(actions) : _getState;
        },
        getActions: function getActions() {
          return actions;
        },
        dispatch: function dispatch(action) {
          if (!(0, _lodash2.default)(action)) {
            throw new Error('Actions must be plain objects. ' + 'Use custom middleware for async actions.');
          }

          if (typeof action.type === 'undefined') {
            throw new Error('Actions may not have an undefined "type" property. ' + 'Have you misspelled a constant? ' + 'Action: ' + JSON.stringify(action));
          }

          actions.push(action);

          for (var i = 0; i < listeners.length; i++) {
            listeners[i]();
          }

          return action;
        },
        clearActions: function clearActions() {
          actions = [];
        },
        subscribe: function subscribe(cb) {
          if (isFunction(cb)) {
            listeners.push(cb);
          }

          return function () {
            var index = listeners.indexOf(cb);

            if (index < 0) {
              return;
            }
            listeners.splice(index, 1);
          };
        },
        replaceReducer: function replaceReducer(nextReducer) {
          if (!isFunction(nextReducer)) {
            throw new Error('Expected the nextReducer to be a function.');
          }
        }
      };

      return self;
    }

    var mockStoreWithMiddleware = _redux.applyMiddleware.apply(undefined, _toConsumableArray(middlewares))(mockStoreWithoutMiddleware);

    return mockStoreWithMiddleware();
  };
}