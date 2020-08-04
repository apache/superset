import renderableChildren from './helpers/renderableChildren';
import wrapValidator from './helpers/wrapValidator';

function validateChildren(propType, children, props, ...rest) {
  let error;
  children.some((child) => {
    error = propType({ ...props, children: child }, 'children', ...rest);
    return error;
  });

  return error || null;
}

export default function childrenOf(propType) {
  function childrenOfPropType(props, propName, componentName, ...rest) {
    if (propName !== 'children') {
      return new TypeError(`${componentName} is using the childrenOf validator on non-children prop "${propName}"`);
    }

    const { [propName]: propValue } = props;

    if (propValue == null) {
      return null;
    }
    const children = renderableChildren(propValue);
    if (children.length === 0) {
      return null;
    }

    return validateChildren(propType, children, props, componentName, ...rest);
  }

  childrenOfPropType.isRequired = (props, propName, componentName, ...rest) => {
    if (propName !== 'children') {
      return new TypeError(`${componentName} is using the childrenOf validator on non-children prop "${propName}"`);
    }

    const children = renderableChildren(props[propName]);
    if (children.length === 0) {
      return new TypeError(`\`${componentName}\` requires at least one node of type ${propType.typeName || propType.name}`);
    }

    return validateChildren(propType, children, props, componentName, ...rest);
  };

  return wrapValidator(childrenOfPropType, 'childrenOf', propType);
}
