import { array } from 'prop-types';
import wrapValidator from './helpers/wrapValidator';

function uniqueCountWithSet(arr) { return new Set(arr).size; }
/* istanbul ignore next */
function uniqueCountLegacy(arr) {
  const seen = [];
  arr.forEach((item) => {
    if (seen.indexOf(item) === -1) {
      seen.push(item);
    }
  });
  return seen.length;
}

const getUniqueCount = typeof Set === 'function' ? uniqueCountWithSet : /* istanbul ignore next */ uniqueCountLegacy;

function requiredUniqueArray(props, propName, componentName, ...rest) {
  const result = array.isRequired(props, propName, componentName, ...rest);
  if (result != null) {
    return result;
  }

  const { [propName]: propValue } = props;
  const uniqueCount = getUniqueCount(propValue);
  if (uniqueCount !== propValue.length) {
    return new RangeError(`${componentName}: values must be unique. ${propValue.length - uniqueCount} duplicate values found.`);
  }
  return null;
}

function uniqueArray(props, propName, ...rest) {
  const { [propName]: propValue } = props;
  if (propValue == null) {
    return null;
  }

  return requiredUniqueArray(props, propName, ...rest);
}
uniqueArray.isRequired = requiredUniqueArray;

export default () => wrapValidator(uniqueArray, 'uniqueArray');
