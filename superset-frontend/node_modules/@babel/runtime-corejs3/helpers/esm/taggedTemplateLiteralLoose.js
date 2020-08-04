import _sliceInstanceProperty from "../../core-js/instance/slice";
export default function _taggedTemplateLiteralLoose(strings, raw) {
  if (!raw) {
    raw = _sliceInstanceProperty(strings).call(strings, 0);
  }

  strings.raw = raw;
  return strings;
}