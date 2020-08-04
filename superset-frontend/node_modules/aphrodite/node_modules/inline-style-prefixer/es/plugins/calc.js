import isPrefixedValue from 'css-in-js-utils/lib/isPrefixedValue';

var prefixes = ['-webkit-', '-moz-', ''];

export default function calc(property, value) {
  if (typeof value === 'string' && !isPrefixedValue(value) && value.indexOf('calc(') > -1) {
    return prefixes.map(function (prefix) {
      return value.replace(/calc\(/g, prefix + 'calc(');
    });
  }
}