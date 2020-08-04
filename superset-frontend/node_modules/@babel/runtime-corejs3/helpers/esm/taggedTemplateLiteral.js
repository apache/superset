import _Object$defineProperties from "../../core-js/object/define-properties";
import _Object$freeze from "../../core-js/object/freeze";
import _sliceInstanceProperty from "../../core-js/instance/slice";
export default function _taggedTemplateLiteral(strings, raw) {
  if (!raw) {
    raw = _sliceInstanceProperty(strings).call(strings, 0);
  }

  return _Object$freeze(_Object$defineProperties(strings, {
    raw: {
      value: _Object$freeze(raw)
    }
  }));
}