import { oneOf, array, arrayOf } from 'prop-types';
import or from './or';
import explicitNull from './explicitNull';
import withShape from './withShape';
import wrapValidator from './helpers/wrapValidator';

let arrayOfValidator;
const validator = or([
  explicitNull, // null/undefined
  oneOf([
    false,
    '',
    NaN,
  ]),
  withShape(array, {
    length: oneOf([0]).isRequired,
  }).isRequired,
  (...args) => arrayOfValidator(...args),
]);
arrayOfValidator = arrayOf(validator).isRequired;

export default () => wrapValidator(validator, 'empty');
