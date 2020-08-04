import _Object$getOwnPropertyDescriptor from "../../core-js/object/get-own-property-descriptor";
import _Reflect$get from "../../core-js/reflect/get";
import superPropBase from "./superPropBase";
export default function _get(target, property, receiver) {
  if (typeof Reflect !== "undefined" && _Reflect$get) {
    _get = _Reflect$get;
  } else {
    _get = function _get(target, property, receiver) {
      var base = superPropBase(target, property);
      if (!base) return;

      var desc = _Object$getOwnPropertyDescriptor(base, property);

      if (desc.get) {
        return desc.get.call(receiver);
      }

      return desc.value;
    };
  }

  return _get(target, property, receiver || target);
}