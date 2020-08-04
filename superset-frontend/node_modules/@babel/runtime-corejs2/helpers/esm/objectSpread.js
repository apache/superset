import _Object$getOwnPropertyDescriptor from "../../core-js/object/get-own-property-descriptor";
import _Object$getOwnPropertySymbols from "../../core-js/object/get-own-property-symbols";
import _Object$keys from "../../core-js/object/keys";
import defineProperty from "./defineProperty";
export default function _objectSpread(target) {
  for (var i = 1; i < arguments.length; i++) {
    var source = arguments[i] != null ? Object(arguments[i]) : {};

    var ownKeys = _Object$keys(source);

    if (typeof _Object$getOwnPropertySymbols === 'function') {
      ownKeys = ownKeys.concat(_Object$getOwnPropertySymbols(source).filter(function (sym) {
        return _Object$getOwnPropertyDescriptor(source, sym).enumerable;
      }));
    }

    ownKeys.forEach(function (key) {
      defineProperty(target, key, source[key]);
    });
  }

  return target;
}