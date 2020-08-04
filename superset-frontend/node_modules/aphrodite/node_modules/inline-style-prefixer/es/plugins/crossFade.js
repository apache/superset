import isPrefixedValue from 'css-in-js-utils/lib/isPrefixedValue';

// http://caniuse.com/#search=cross-fade
var prefixes = ['-webkit-', ''];

export default function crossFade(property, value) {
  if (typeof value === 'string' && !isPrefixedValue(value) && value.indexOf('cross-fade(') > -1) {
    return prefixes.map(function (prefix) {
      return value.replace(/cross-fade\(/g, prefix + 'cross-fade(');
    });
  }
}