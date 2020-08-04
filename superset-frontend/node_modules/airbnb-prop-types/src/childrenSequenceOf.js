import sequenceOf from './sequenceOf';
import renderableChildren from './helpers/renderableChildren';
import wrapValidator from './helpers/wrapValidator';

export default function childrenSequenceOfValidator(...specifiers) {
  const seq = sequenceOf(...specifiers);

  const validator = function childrenSequenceOf(props, propName, componentName, ...rest) {
    if (propName !== 'children') {
      return new TypeError(`${componentName} is using the childrenSequenceOf validator on non-children prop "${propName}"`);
    }

    const { [propName]: propValue } = props;
    const children = renderableChildren(propValue);
    if (children.length === 0) {
      return null;
    }
    return seq({ ...props, children }, propName, componentName, ...rest);
  };

  validator.isRequired = function childrenSequenceOfRequired(
    props,
    propName,
    componentName,
    ...rest
  ) {
    if (propName !== 'children') {
      return new TypeError(`${componentName} is using the childrenSequenceOf validator on non-children prop "${propName}"`);
    }

    const { [propName]: propValue } = props;
    const children = renderableChildren(propValue);
    if (children.length === 0) {
      return new TypeError(`${componentName}: renderable children are required.`);
    }
    return seq.isRequired({ ...props, children }, propName, componentName, ...rest);
  };

  return wrapValidator(validator, 'childrenSequenceOf', specifiers);
}
