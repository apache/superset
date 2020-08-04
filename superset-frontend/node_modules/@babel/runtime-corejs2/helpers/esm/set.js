import _Object$defineProperty from "../../core-js/object/define-property";
import _Object$getOwnPropertyDescriptor from "../../core-js/object/get-own-property-descriptor";
import _Reflect$set from "../../core-js/reflect/set";
import superPropBase from "./superPropBase";
import defineProperty from "./defineProperty";

function set(target, property, value, receiver) {
  if (typeof Reflect !== "undefined" && _Reflect$set) {
    set = _Reflect$set;
  } else {
    set = function set(target, property, value, receiver) {
      var base = superPropBase(target, property);
      var desc;

      if (base) {
        desc = _Object$getOwnPropertyDescriptor(base, property);

        if (desc.set) {
          desc.set.call(receiver, value);
          return true;
        } else if (!desc.writable) {
          return false;
        }
      }

      desc = _Object$getOwnPropertyDescriptor(receiver, property);

      if (desc) {
        if (!desc.writable) {
          return false;
        }

        desc.value = value;

        _Object$defineProperty(receiver, property, desc);
      } else {
        defineProperty(receiver, property, value);
      }

      return true;
    };
  }

  return set(target, property, value, receiver);
}

export default function _set(target, property, value, receiver, isStrict) {
  var s = set(target, property, value, receiver || target);

  if (!s && isStrict) {
    throw new Error('failed to set property');
  }

  return value;
}