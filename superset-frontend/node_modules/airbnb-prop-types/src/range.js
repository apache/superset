import and from './and';
import between from './between';
import integer from './integer';
import isInteger from './helpers/isInteger';
import wrapValidator from './helpers/wrapValidator';

const MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER || /* istanbul ignore next */ (2 ** 53) - 1;

function isValidLength(x) {
  return isInteger(x) && Math.abs(x) < MAX_SAFE_INTEGER;
}

export default function range(min, max) {
  if (!isValidLength(min) || !isValidLength(max)) {
    throw new RangeError(`"range" requires two integers: ${min} and ${max} given`);
  }
  if (min === max) {
    throw new RangeError('min and max must not be the same');
  }
  return wrapValidator(and([integer(), between({ gte: min, lt: max })], 'range'), 'range', { min, max });
}
