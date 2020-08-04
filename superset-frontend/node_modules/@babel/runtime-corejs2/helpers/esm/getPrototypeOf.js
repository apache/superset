import _Object$getPrototypeOf from "../../core-js/object/get-prototype-of";
import _Object$setPrototypeOf from "../../core-js/object/set-prototype-of";
export default function _getPrototypeOf(o) {
  _getPrototypeOf = _Object$setPrototypeOf ? _Object$getPrototypeOf : function _getPrototypeOf(o) {
    return o.__proto__ || _Object$getPrototypeOf(o);
  };
  return _getPrototypeOf(o);
}