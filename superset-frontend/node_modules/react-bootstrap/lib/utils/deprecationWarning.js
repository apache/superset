"use strict";

var _interopRequireDefault = require("@babel/runtime-corejs2/helpers/interopRequireDefault");

exports.__esModule = true;
exports._resetWarned = _resetWarned;
exports.default = void 0;

var _inheritsLoose2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/inheritsLoose"));

var _warning = _interopRequireDefault(require("warning"));

var warned = {};

function deprecationWarning(oldname, newname, link) {
  var message;

  if (typeof oldname === 'object') {
    message = oldname.message;
  } else {
    message = oldname + " is deprecated. Use " + newname + " instead.";

    if (link) {
      message += "\nYou can read more about it at " + link;
    }
  }

  if (warned[message]) {
    return;
  }

  process.env.NODE_ENV !== "production" ? (0, _warning.default)(false, message) : void 0;
  warned[message] = true;
}

deprecationWarning.wrapper = function (Component) {
  for (var _len = arguments.length, args = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
    args[_key - 1] = arguments[_key];
  }

  return (
    /*#__PURE__*/
    function (_Component) {
      (0, _inheritsLoose2.default)(DeprecatedComponent, _Component);

      function DeprecatedComponent() {
        return _Component.apply(this, arguments) || this;
      }

      var _proto = DeprecatedComponent.prototype;

      _proto.UNSAFE_componentWillMount = function UNSAFE_componentWillMount() {
        // eslint-disable-line
        deprecationWarning.apply(void 0, args);

        if (_Component.prototype.UNSAFE_componentWillMount) {
          var _Component$prototype$;

          for (var _len2 = arguments.length, methodArgs = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
            methodArgs[_key2] = arguments[_key2];
          }

          (_Component$prototype$ = _Component.prototype.UNSAFE_componentWillMount).call.apply(_Component$prototype$, [this].concat(methodArgs));
        }
      };

      return DeprecatedComponent;
    }(Component)
  );
};

var _default = deprecationWarning;
exports.default = _default;

function _resetWarned() {
  warned = {};
}