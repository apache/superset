import _Array$from from "../../core-js/array/from";
import _isIterable from "../../core-js/is-iterable";
export default function _iterableToArray(iter) {
  if (_isIterable(Object(iter)) || Object.prototype.toString.call(iter) === "[object Arguments]") return _Array$from(iter);
}