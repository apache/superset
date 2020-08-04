import React from 'react';
import isRegex from 'is-regex';
import find from 'array.prototype.find';

import getComponentName from './helpers/getComponentName';
import wrapValidator from './helpers/wrapValidator';

function stripHOCs(fullName, namesOfHOCsToStrip) {
  let innerName = fullName;
  while ((/\([^()]*\)/g).test(innerName)) {
    let HOC = innerName;
    let previousHOC;
    do {
      previousHOC = HOC;
      HOC = previousHOC.replace(/\([^()]*\)/g, '');
    } while (previousHOC !== HOC);

    if (namesOfHOCsToStrip.indexOf(HOC) === -1) {
      return innerName;
    }
    innerName = innerName.replace(RegExp(`^${HOC}\\(|\\)$`, 'g'), '');
  }
  return innerName;
}

function hasName(name, namesOfHOCsToStrip, propValue, propName, componentName, ...rest) {
  if (Array.isArray(propValue)) {
    return find(
      propValue.map((item) => hasName(
        name,
        namesOfHOCsToStrip,
        item,
        propName,
        componentName,
        ...rest,
      )),
      Boolean,
    ) || null;
  }

  if (!React.isValidElement(propValue)) {
    return new TypeError(
      `${componentName}.${propName} is not a valid React element`,
    );
  }

  const { type } = propValue;
  const componentNameFromType = getComponentName(type);
  const innerComponentName = namesOfHOCsToStrip.length > 0
    ? stripHOCs(componentNameFromType, namesOfHOCsToStrip)
    : componentNameFromType;

  if (isRegex(name) && !name.test(innerComponentName)) {
    return new TypeError(
      `\`${componentName}.${propName}\` only accepts components matching the regular expression ${name}`,
    );
  }

  if (!isRegex(name) && innerComponentName !== name) {
    return new TypeError(
      `\`${componentName}.${propName}\` only accepts components named ${name}, got ${innerComponentName}`,
    );
  }

  return null;
}

export default function componentWithName(
  name,
  options = {},
) {
  if (typeof name !== 'string' && !isRegex(name)) {
    throw new TypeError('name must be a string or a regex');
  }

  const passedOptions = Object.keys(options);
  if (passedOptions.length > 1 || (passedOptions.length === 1 && passedOptions[0] !== 'stripHOCs')) {
    throw new TypeError(`The only options supported are: “stripHOCs”, got: “${passedOptions.join('”, “')}”`);
  }
  const { stripHOCs: namesOfHOCsToStrip = [] } = options;

  const allHOCNamesAreValid = namesOfHOCsToStrip.every((x) => {
    if (typeof x !== 'string' || /[()]/g.test(x)) {
      return false;
    }
    return /^(?:[a-z][a-zA-Z0-9]+|[A-Z][a-z][a-zA-Z0-9]+)$/.test(x);
  });
  if (!allHOCNamesAreValid) {
    throw new TypeError('every provided HOC name must be a string with no parens, and in camelCase');
  }

  function componentWithNameValidator(props, propName, componentName, ...rest) {
    const { [propName]: propValue } = props;
    if (props[propName] == null) {
      return null;
    }
    return hasName(name, namesOfHOCsToStrip, propValue, propName, componentName, ...rest);
  }

  componentWithNameValidator.isRequired = function componentWithNameRequired(
    props,
    propName,
    componentName,
    ...rest
  ) {
    const { [propName]: propValue } = props;
    if (propValue == null) {
      return new TypeError(`\`${componentName}.${propName}\` requires at least one component named ${name}`);
    }
    return hasName(name, namesOfHOCsToStrip, propValue, propName, componentName, ...rest);
  };

  return wrapValidator(componentWithNameValidator, `componentWithName:${name}`, name);
}
