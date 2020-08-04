import { arrayOf, array } from 'prop-types';
import and from './and';
import uniqueArray from './uniqueArray';

const unique = uniqueArray();

export default function uniqueArrayOfTypeValidator(type, ...rest) {
  if (typeof type !== 'function') {
    throw new TypeError('type must be a validator function');
  }

  let mapper = null;
  let name = 'uniqueArrayOfType';

  if (rest.length === 1) {
    if (typeof rest[0] === 'function') {
      ([mapper] = rest);
    } else if (typeof rest[0] === 'string') {
      ([name] = rest);
    } else {
      throw new TypeError('single input must either be string or function');
    }
  } else if (rest.length === 2) {
    if (typeof rest[0] === 'function' && typeof rest[1] === 'string') {
      ([mapper, name] = rest);
    } else {
      throw new TypeError('multiple inputs must be in [function, string] order');
    }
  } else if (rest.length > 2) {
    throw new TypeError('only [], [name], [mapper], and [mapper, name] are valid inputs');
  }

  function uniqueArrayOfMapped(props, propName, ...args) {
    const { [propName]: propValue } = props;
    if (propValue == null) {
      return null;
    }

    const values = propValue.map(mapper);
    return unique({ ...props, [propName]: values }, propName, ...args);
  }

  uniqueArrayOfMapped.isRequired = function isRequired(props, propName, ...args) {
    const { [propName]: propValue } = props;
    if (propValue == null) {
      return array.isRequired(props, propName, ...args);
    }
    return uniqueArrayOfMapped(props, propName, ...args);
  };

  const arrayValidator = arrayOf(type);

  const uniqueValidator = mapper ? uniqueArrayOfMapped : unique;

  const validator = and([arrayValidator, uniqueValidator], name);
  validator.isRequired = and([
    uniqueValidator.isRequired,
    arrayValidator.isRequired,
  ], `${name}.isRequired`);

  return validator;
}
