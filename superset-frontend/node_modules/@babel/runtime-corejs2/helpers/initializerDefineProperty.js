var _Object$defineProperty = require("../core-js/object/define-property");

function _initializerDefineProperty(target, property, descriptor, context) {
  if (!descriptor) return;

  _Object$defineProperty(target, property, {
    enumerable: descriptor.enumerable,
    configurable: descriptor.configurable,
    writable: descriptor.writable,
    value: descriptor.initializer ? descriptor.initializer.call(context) : void 0
  });
}

module.exports = _initializerDefineProperty;