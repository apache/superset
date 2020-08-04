import entries from 'object.entries';

import shape from './shape';
import valuesOf from './valuesOf';
import wrapValidator from './helpers/wrapValidator';

function number(props, propName, componentName) {
  const value = props[propName];
  if (typeof value === 'number' && !isNaN(value)) {
    return null;
  }

  return new TypeError(`${componentName}: ${propName} must be a non-NaN number.`);
}

function numberOrPropsFunc(props, propName) {
  const value = props[propName];

  if (typeof value === 'function') {
    return null;
  }

  if (typeof value === 'number' && !isNaN(value)) {
    return null;
  }

  return new TypeError(`${propName}: a function, or a non-NaN number is required`);
}

function lowerCompare(value, { gt, gte }) {
  if (typeof gt === 'number') {
    return value > gt;
  }
  if (typeof gte === 'number') {
    return value >= gte;
  }
  return true;
}

function upperCompare(value, { lt, lte }) {
  if (typeof lt === 'number') {
    return value < lt;
  }
  if (typeof lte === 'number') {
    return value <= lte;
  }
  return true;
}

function greaterThanError({ gt, gte }) {
  if (typeof gt === 'number') {
    return `greater than ${gt}`;
  }
  if (typeof gte === 'number') {
    return `greater than or equal to ${gte}`;
  }
  return '';
}

function lessThanError({ lt, lte }) {
  if (typeof lt === 'number') {
    return `less than ${lt}`;
  }
  if (typeof lte === 'number') {
    return `less than or equal to ${lte}`;
  }
  return '';
}

function errorMessage(componentName, propName, opts) {
  const errors = [greaterThanError(opts), lessThanError(opts)].filter(Boolean).join(' and ');
  return `${componentName}: ${propName} must be ${errors}`;
}

function propsThunkify(opts) {
  return entries(opts).reduce((acc, [key, value]) => {
    const numberThunk = typeof value === 'number' ? () => value : value;
    return { ...acc, [key]: numberThunk };
  }, {});
}

function invokeWithProps(optsThunks, props) {
  return entries(optsThunks).reduce((acc, [key, thunk]) => {
    const value = thunk(props);
    return { ...acc, [key]: value };
  }, {});
}

const argValidators = [
  shape({ lt: numberOrPropsFunc, gt: numberOrPropsFunc }).isRequired,
  shape({ lte: numberOrPropsFunc, gt: numberOrPropsFunc }).isRequired,
  shape({ lt: numberOrPropsFunc, gte: numberOrPropsFunc }).isRequired,
  shape({ lte: numberOrPropsFunc, gte: numberOrPropsFunc }).isRequired,
  shape({ lt: numberOrPropsFunc }).isRequired,
  shape({ lte: numberOrPropsFunc }).isRequired,
  shape({ gt: numberOrPropsFunc }).isRequired,
  shape({ gte: numberOrPropsFunc }).isRequired,
];
function argValidator(props, propName) {
  return argValidators.every((validator) => !!validator(props, propName));
}

const thunkValueValidator = valuesOf(number).isRequired;

export default function betweenValidator(options) {
  const argError = argValidator({ options }, 'options');
  if (argError) {
    throw new TypeError('between: only one of the pairs of `lt`/`lte`, and `gt`/`gte`, may be supplied, and at least one pair must be provided.');
  }

  const optsThunks = propsThunkify(options);

  const validator = function between(props, propName, componentName, ...rest) {
    const { [propName]: propValue } = props;
    if (propValue == null) {
      return null;
    }

    if (typeof propValue !== 'number') {
      return new RangeError(`${componentName}: ${propName} must be a number, got "${typeof propValue}"`);
    }

    const opts = invokeWithProps(optsThunks, props);
    const thunkValuesError = thunkValueValidator(
      { [propName]: opts },
      propName,
      componentName,
      ...rest,
    );
    if (thunkValuesError) {
      return thunkValuesError;
    }

    if (!lowerCompare(propValue, opts) || !upperCompare(propValue, opts)) {
      return new RangeError(errorMessage(componentName, propName, opts));
    }

    return null;
  };
  validator.isRequired = function betweenRequired(props, propName, componentName, ...rest) {
    const { [propName]: propValue } = props;
    if (typeof propValue !== 'number') {
      return new RangeError(`${componentName}: ${propName} must be a number, got "${typeof propValue}"`);
    }

    const opts = invokeWithProps(optsThunks, props);
    const thunkValuesError = thunkValueValidator(
      { [propName]: opts },
      propName,
      componentName,
      ...rest,
    );
    if (thunkValuesError) {
      return thunkValuesError;
    }

    if (!lowerCompare(propValue, opts) || !upperCompare(propValue, opts)) {
      return new RangeError(errorMessage(componentName, propName, opts));
    }

    return null;
  };

  return wrapValidator(validator, 'between', options);
}
