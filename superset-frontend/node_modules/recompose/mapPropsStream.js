'use strict';

exports.__esModule = true;
exports.mapPropsStreamWithConfig = undefined;

var _symbolObservable = require('symbol-observable');

var _symbolObservable2 = _interopRequireDefault(_symbolObservable);

var _createEagerFactory = require('./createEagerFactory');

var _createEagerFactory2 = _interopRequireDefault(_createEagerFactory);

var _componentFromStream = require('./componentFromStream');

var _setDisplayName = require('./setDisplayName');

var _setDisplayName2 = _interopRequireDefault(_setDisplayName);

var _wrapDisplayName = require('./wrapDisplayName');

var _wrapDisplayName2 = _interopRequireDefault(_wrapDisplayName);

var _setObservableConfig = require('./setObservableConfig');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var identity = function identity(t) {
  return t;
};

var mapPropsStreamWithConfig = exports.mapPropsStreamWithConfig = function mapPropsStreamWithConfig(config) {
  var componentFromStream = (0, _componentFromStream.componentFromStreamWithConfig)({
    fromESObservable: identity,
    toESObservable: identity
  });
  return function (transform) {
    return function (BaseComponent) {
      var factory = (0, _createEagerFactory2.default)(BaseComponent);
      var fromESObservable = config.fromESObservable,
          toESObservable = config.toESObservable;

      return componentFromStream(function (props$) {
        var _ref;

        return _ref = {
          subscribe: function subscribe(observer) {
            var subscription = toESObservable(transform(fromESObservable(props$))).subscribe({
              next: function next(childProps) {
                return observer.next(factory(childProps));
              }
            });
            return {
              unsubscribe: function unsubscribe() {
                return subscription.unsubscribe();
              }
            };
          }
        }, _ref[_symbolObservable2.default] = function () {
          return this;
        }, _ref;
      });
    };
  };
};

var mapPropsStream = function mapPropsStream(transform) {
  var hoc = mapPropsStreamWithConfig(_setObservableConfig.config)(transform);

  if (process.env.NODE_ENV !== 'production') {
    return function (BaseComponent) {
      return (0, _setDisplayName2.default)((0, _wrapDisplayName2.default)(BaseComponent, 'mapPropsStream'))(hoc(BaseComponent));
    };
  }
  return hoc;
};

exports.default = mapPropsStream;