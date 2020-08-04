import { array, arrayOf } from 'prop-types';

import and from './and';
import between from './between';
import nonNegativeInteger from './nonNegativeInteger';
import object from './object';
import withShape from './withShape';
import typeOf from './helpers/typeOf';
import wrapValidator from './helpers/wrapValidator';

const minValidator = nonNegativeInteger;
const maxValidator = and([nonNegativeInteger, between({ gte: 1 })]);

function validateRange(min, max) {
  if (typeof max !== 'number' || typeof min !== 'number') {
    return null; // no additional checking needed unless both are present
  }

  if (min <= max) {
    return null;
  }
  return new RangeError('min must be less than or equal to max');
}

const specifierShape = {
  validator(props, propName) {
    const { [propName]: propValue } = props;
    if (typeof propValue !== 'function') {
      return new TypeError('"validator" must be a propType validator function');
    }
    return null;
  },

  min(props, propName) {
    return minValidator(props, propName) || validateRange(props.min, props.max);
  },

  max(props, propName) {
    return maxValidator(props, propName) || validateRange(props.min, props.max);
  },
};

function getMinMax({ min, max }) {
  let minimum;
  let maximum;
  if (typeof min !== 'number' && typeof max !== 'number') {
    // neither provided, default to "1"
    minimum = 1;
    maximum = 1;
  } else {
    minimum = typeof min === 'number' ? min : 1;
    maximum = typeof max === 'number' ? max : Infinity;
  }
  return { minimum, maximum };
}

function chunkByType(items) {
  let chunk = [];
  let lastType;
  return items.reduce((chunks, item) => {
    const itemType = typeOf(item);
    if (!lastType || itemType === lastType) {
      chunk.push(item);
    } else {
      chunks.push(chunk);
      chunk = [item];
    }
    lastType = itemType;
    return chunks;
  }, []).concat(chunk.length > 0 ? [chunk] : []);
}

function validateChunks(specifiers, props, propName, componentName, ...rest) {
  const { [propName]: items } = props;
  const chunks = chunkByType(items);

  for (let i = 0; i < specifiers.length; i += 1) {
    const { validator, min, max } = specifiers[i];

    const { minimum, maximum } = getMinMax({ min, max });

    if (chunks.length === 0 && minimum === 0) {
      // no chunks left, but this specifier does not require any items
      continue; // eslint-disable-line no-continue
    }

    const arrayOfValidator = arrayOf(validator).isRequired;

    const chunk = chunks.shift(); // extract the next chunk to test

    const chunkError = arrayOfValidator(
      { ...props, [propName]: chunk },
      propName,
      componentName,
      ...rest,
    );

    if (chunkError) { // this chunk is invalid
      if (minimum === 0) { // but, specifier has a min of 0 and can be skipped
        chunks.unshift(chunk); // put the chunk back, for the next iteration
        continue; // eslint-disable-line no-continue
      }
      return chunkError;
    }

    // chunk is valid!

    if (chunk.length < minimum) {
      return new RangeError(`${componentName}: specifier index ${i} requires a minimum of ${min} items, but only has ${chunk.length}.`);
    }

    if (chunk.length > maximum) {
      return new RangeError(`${componentName}: specifier index ${i} requires a maximum of ${max} items, but has ${chunk.length}.`);
    }
  }

  if (chunks.length > 0) {
    return new TypeError(`${componentName}: after all ${specifiers.length} specifiers matched, ${chunks.length} types of items were remaining.`);
  }

  return null;
}

const specifierValidator = withShape(object(), specifierShape).isRequired;

export default function sequenceOfValidator(...specifiers) {
  if (specifiers.length === 0) {
    throw new RangeError('sequenceOf: at least one specifier is required');
  }

  const errors = specifiers.map((specifier, i) => specifierValidator(
    { specifier },
    'specifier',
    'sequenceOf specifier',
    `suequenceOf specifier, index ${i}`,
    `specifier, index ${i}`,
  ));
  if (errors.some(Boolean)) {
    throw new TypeError(`
      sequenceOf: all specifiers must match the appropriate shape.

      Errors:
        ${errors.map((e, i) => ` - Argument index ${i}: ${e.message}`).join(',\n        ')}
    `);
  }

  const validator = function sequenceOf(props, propName, ...rest) {
    const { [propName]: propValue } = props;

    if (propValue == null) {
      return null;
    }

    const error = array(props, propName, ...rest);
    if (error) {
      return error;
    }

    return validateChunks(specifiers, props, propName, ...rest);
  };

  validator.isRequired = function sequenceOfRequired(props, propName, componentName, ...rest) {
    const error = array.isRequired(props, propName, componentName, ...rest);
    if (error) {
      return error;
    }

    return validateChunks(specifiers, props, propName, componentName, ...rest);
  };

  return wrapValidator(validator, 'sequenceOf', specifiers);
}
