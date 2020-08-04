import isPlainObject from './helpers/isPlainObject';
import typeOf from './helpers/typeOf';
import wrapValidator from './helpers/wrapValidator';

/*
  code adapted from https://github.com/facebook/react/blob/14156e56b9cf18ac86963185c5af4abddf3ff811/src/isomorphic/classic/types/ReactPropTypes.js#L202-L206
  so that it can be called outside of React's normal PropType flow
*/

const ReactPropTypeLocationNames = {
  prop: 'prop',
  context: 'context',
  childContext: 'child context',
};

function object(props, propName, componentName, location, propFullName) {
  const { [propName]: propValue } = props;
  if (propValue == null) {
    return null;
  }

  if (isPlainObject(propValue)) {
    return null;
  }
  const locationName = ReactPropTypeLocationNames[location] || location;
  return new TypeError(`Invalid ${locationName} \`${propFullName}\` of type \`${typeOf(propValue)}\` supplied to \`${componentName}\`, expected \`object\`.`);
}
object.isRequired = function objectRequired(
  props,
  propName,
  componentName,
  location,
  propFullName,
  ...rest
) {
  const { [propName]: propValue } = props;
  if (propValue == null) {
    const locationName = ReactPropTypeLocationNames[location] || location;
    return new TypeError(`The ${locationName} \`${propFullName}\` is marked as required in \`${componentName}\`, but its value is \`${propValue}\`.`);
  }
  return object(props, propName, componentName, location, propFullName, ...rest);
};

export default () => wrapValidator(object, 'object');
