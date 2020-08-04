var _Object$defineProperties = require("../core-js/object/define-properties");

var _Object$freeze = require("../core-js/object/freeze");

var _sliceInstanceProperty = require("../core-js/instance/slice");

function _taggedTemplateLiteral(strings, raw) {
  if (!raw) {
    raw = _sliceInstanceProperty(strings).call(strings, 0);
  }

  return _Object$freeze(_Object$defineProperties(strings, {
    raw: {
      value: _Object$freeze(raw)
    }
  }));
}

module.exports = _taggedTemplateLiteral;