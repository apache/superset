import _forEachInstanceProperty from "../../core-js/instance/for-each";
import _Object$getOwnPropertyDescriptor from "../../core-js/object/get-own-property-descriptor";
import _filterInstanceProperty from "../../core-js/instance/filter";
import _concatInstanceProperty from "../../core-js/instance/concat";
import _Object$getOwnPropertySymbols from "../../core-js/object/get-own-property-symbols";
import _Object$keys from "../../core-js/object/keys";
import defineProperty from "./defineProperty";
export default function _objectSpread(target) {
  for (var i = 1; i < arguments.length; i++) {
    var source = arguments[i] != null ? Object(arguments[i]) : {};

    var ownKeys = _Object$keys(source);

    if (typeof _Object$getOwnPropertySymbols === 'function') {
      var _context;

      ownKeys = _concatInstanceProperty(ownKeys).call(ownKeys, _filterInstanceProperty(_context = _Object$getOwnPropertySymbols(source)).call(_context, function (sym) {
        return _Object$getOwnPropertyDescriptor(source, sym).enumerable;
      }));
    }

    _forEachInstanceProperty(ownKeys).call(ownKeys, function (key) {
      defineProperty(target, key, source[key]);
    });
  }

  return target;
}