var _Object$getOwnPropertySymbols = require("../core-js/object/get-own-property-symbols");

var _Object$defineProperty = require("../core-js/object/define-property");

function _defineEnumerableProperties(obj, descs) {
  for (var key in descs) {
    var desc = descs[key];
    desc.configurable = desc.enumerable = true;
    if ("value" in desc) desc.writable = true;

    _Object$defineProperty(obj, key, desc);
  }

  if (_Object$getOwnPropertySymbols) {
    var objectSymbols = _Object$getOwnPropertySymbols(descs);

    for (var i = 0; i < objectSymbols.length; i++) {
      var sym = objectSymbols[i];
      var desc = descs[sym];
      desc.configurable = desc.enumerable = true;
      if ("value" in desc) desc.writable = true;

      _Object$defineProperty(obj, sym, desc);
    }
  }

  return obj;
}

module.exports = _defineEnumerableProperties;