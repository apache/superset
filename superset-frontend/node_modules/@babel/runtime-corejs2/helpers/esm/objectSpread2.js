import _Object$defineProperty from "../../core-js/object/define-property";
import _Object$defineProperties from "../../core-js/object/define-properties";
import _Object$getOwnPropertyDescriptors from "../../core-js/object/get-own-property-descriptors";
import _Object$getOwnPropertyDescriptor from "../../core-js/object/get-own-property-descriptor";
import _Object$getOwnPropertySymbols from "../../core-js/object/get-own-property-symbols";
import _Object$keys from "../../core-js/object/keys";
import defineProperty from "./defineProperty";

function ownKeys(object, enumerableOnly) {
  var keys = _Object$keys(object);

  if (_Object$getOwnPropertySymbols) {
    var symbols = _Object$getOwnPropertySymbols(object);

    if (enumerableOnly) symbols = symbols.filter(function (sym) {
      return _Object$getOwnPropertyDescriptor(object, sym).enumerable;
    });
    keys.push.apply(keys, symbols);
  }

  return keys;
}

export default function _objectSpread2(target) {
  for (var i = 1; i < arguments.length; i++) {
    var source = arguments[i] != null ? arguments[i] : {};

    if (i % 2) {
      ownKeys(Object(source), true).forEach(function (key) {
        defineProperty(target, key, source[key]);
      });
    } else if (_Object$getOwnPropertyDescriptors) {
      _Object$defineProperties(target, _Object$getOwnPropertyDescriptors(source));
    } else {
      ownKeys(Object(source)).forEach(function (key) {
        _Object$defineProperty(target, key, _Object$getOwnPropertyDescriptor(source, key));
      });
    }
  }

  return target;
}