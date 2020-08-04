import _Symbol$iterator from "../../core-js/symbol/iterator";
import _Symbol from "../../core-js/symbol";
export default function _asyncIterator(iterable) {
  var method;

  if (typeof _Symbol !== "undefined") {
    if (_Symbol.asyncIterator) {
      method = iterable[_Symbol.asyncIterator];
      if (method != null) return method.call(iterable);
    }

    if (_Symbol$iterator) {
      method = iterable[_Symbol$iterator];
      if (method != null) return method.call(iterable);
    }
  }

  throw new TypeError("Object is not async iterable");
}