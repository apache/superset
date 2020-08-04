import getPrototypeOf from "./getPrototypeOf";
import isNativeReflectConstruct from "./isNativeReflectConstruct";
import possibleConstructorReturn from "./possibleConstructorReturn";
export default function _createSuper(Derived) {
  return function () {
    var Super = getPrototypeOf(Derived),
        result;

    if (isNativeReflectConstruct()) {
      var NewTarget = getPrototypeOf(this).constructor;
      result = Reflect.construct(Super, arguments, NewTarget);
    } else {
      result = Super.apply(this, arguments);
    }

    return possibleConstructorReturn(this, result);
  };
}