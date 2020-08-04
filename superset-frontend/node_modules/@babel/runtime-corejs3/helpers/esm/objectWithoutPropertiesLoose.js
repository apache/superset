import _indexOfInstanceProperty from "../../core-js/instance/index-of";
import _Object$keys from "../../core-js/object/keys";
export default function _objectWithoutPropertiesLoose(source, excluded) {
  if (source == null) return {};
  var target = {};

  var sourceKeys = _Object$keys(source);

  var key, i;

  for (i = 0; i < sourceKeys.length; i++) {
    key = sourceKeys[i];
    if (_indexOfInstanceProperty(excluded).call(excluded, key) >= 0) continue;
    target[key] = source[key];
  }

  return target;
}