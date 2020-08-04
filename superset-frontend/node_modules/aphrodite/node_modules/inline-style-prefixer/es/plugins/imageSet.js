import isPrefixedValue from 'css-in-js-utils/lib/isPrefixedValue';

// http://caniuse.com/#feat=css-image-set
var prefixes = ['-webkit-', ''];

export default function imageSet(property, value) {
  if (typeof value === 'string' && !isPrefixedValue(value) && value.indexOf('image-set(') > -1) {
    return prefixes.map(function (prefix) {
      return value.replace(/image-set\(/g, prefix + 'image-set(');
    });
  }
}