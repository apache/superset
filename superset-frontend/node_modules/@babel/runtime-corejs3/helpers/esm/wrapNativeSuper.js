import _Object$create from "../../core-js/object/create";
import _Map from "../../core-js/map";
import getPrototypeOf from "./getPrototypeOf";
import setPrototypeOf from "./setPrototypeOf";
import isNativeFunction from "./isNativeFunction";
import construct from "./construct";
export default function _wrapNativeSuper(Class) {
  var _cache = typeof _Map === "function" ? new _Map() : undefined;

  _wrapNativeSuper = function _wrapNativeSuper(Class) {
    if (Class === null || !isNativeFunction(Class)) return Class;

    if (typeof Class !== "function") {
      throw new TypeError("Super expression must either be null or a function");
    }

    if (typeof _cache !== "undefined") {
      if (_cache.has(Class)) return _cache.get(Class);

      _cache.set(Class, Wrapper);
    }

    function Wrapper() {
      return construct(Class, arguments, getPrototypeOf(this).constructor);
    }

    Wrapper.prototype = _Object$create(Class.prototype, {
      constructor: {
        value: Wrapper,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
    return setPrototypeOf(Wrapper, Class);
  };

  return _wrapNativeSuper(Class);
}