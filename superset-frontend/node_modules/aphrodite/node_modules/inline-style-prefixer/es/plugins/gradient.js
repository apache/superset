import isPrefixedValue from 'css-in-js-utils/lib/isPrefixedValue';

var prefixes = ['-webkit-', '-moz-', ''];
var values = /linear-gradient|radial-gradient|repeating-linear-gradient|repeating-radial-gradient/gi;

export default function gradient(property, value) {
  if (typeof value === 'string' && !isPrefixedValue(value) && values.test(value)) {
    return prefixes.map(function (prefix) {
      return value.replace(values, function (grad) {
        return prefix + grad;
      });
    });
  }
}