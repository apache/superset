var _Object$create = require("../core-js/object/create");

var _Object$keys = require("../core-js/object/keys");

var _reduceInstanceProperty = require("../core-js/instance/reduce");

var _typeof = require("../helpers/typeof");

var _Symbol$replace = require("../core-js/symbol/replace");

var _WeakMap = require("../core-js/weak-map");

var wrapNativeSuper = require("./wrapNativeSuper");

var getPrototypeOf = require("./getPrototypeOf");

var possibleConstructorReturn = require("./possibleConstructorReturn");

var inherits = require("./inherits");

function _wrapRegExp(re, groups) {
  module.exports = _wrapRegExp = function _wrapRegExp(re, groups) {
    return new BabelRegExp(re, undefined, groups);
  };

  var _RegExp = wrapNativeSuper(RegExp);

  var _super = RegExp.prototype;

  var _groups = new _WeakMap();

  function BabelRegExp(re, flags, groups) {
    var _this = _RegExp.call(this, re, flags);

    _groups.set(_this, groups || _groups.get(re));

    return _this;
  }

  inherits(BabelRegExp, _RegExp);

  BabelRegExp.prototype.exec = function (str) {
    var result = _super.exec.call(this, str);

    if (result) result.groups = buildGroups(result, this);
    return result;
  };

  BabelRegExp.prototype[_Symbol$replace] = function (str, substitution) {
    if (typeof substitution === "string") {
      var groups = _groups.get(this);

      return _super[_Symbol$replace].call(this, str, substitution.replace(/\$<([^>]+)>/g, function (_, name) {
        return "$" + groups[name];
      }));
    } else if (typeof substitution === "function") {
      var _this = this;

      return _super[_Symbol$replace].call(this, str, function () {
        var args = [];
        args.push.apply(args, arguments);

        if (_typeof(args[args.length - 1]) !== "object") {
          args.push(buildGroups(args, _this));
        }

        return substitution.apply(this, args);
      });
    } else {
      return _super[_Symbol$replace].call(this, str, substitution);
    }
  };

  function buildGroups(result, re) {
    var _context;

    var g = _groups.get(re);

    return _reduceInstanceProperty(_context = _Object$keys(g)).call(_context, function (groups, name) {
      groups[name] = result[g[name]];
      return groups;
    }, _Object$create(null));
  }

  return _wrapRegExp.apply(this, arguments);
}

module.exports = _wrapRegExp;