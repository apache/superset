/* Use as
import {checkProps} from '../util/check-props;'

const PROP_CHECKS = {
  // Removed props no longer supported, print error and link to upgrade guide
  removedProps: {
  },
  // Deprecated props
  deprecatedProps: {
    offset: 'accessor',
    stride: 'accessor',
    type: 'accessor',
    size: 'accessor',
    divisor: 'accessor',
    normalized: 'accessor',
    integer: 'accessor'
  },
  // Deprecated props that can be autosubstituted, print warning and return updated props object
  replacedProps: {
    bytes: 'byteLength'
  }
}

class Buffer {
  setProps(props) {
    checkProps('Buffer', props, PROP_CHECKS);
  }
}
*/
import log from './log';

export function checkProps(className, props, propChecks) {
  const {removedProps = {}, deprecatedProps = {}, replacedProps = {}} = propChecks;

  // removedProps: Removed props no longer supported
  // print error and link to upgrade guide
  for (const propName in removedProps) {
    if (propName in props) {
      const replacementProp = removedProps[propName];
      const replacement = replacementProp ? `${className}.${removedProps[propName]}` : 'N/A';
      log.removed(`${className}.${propName}`, replacement)();
    }
  }

  // deprecatedProps: Deprecated props that can not be autosubstituted
  // print warning and rely on caller to substitute
  for (const propName in deprecatedProps) {
    if (propName in props) {
      const replacementProp = deprecatedProps[propName];
      log.deprecated(`${className}.${propName}`, `${className}.${replacementProp}`)();
    }
  }

  // replacedProps: Deprecated props that can be autosubstituted
  // print warning and return updated props object
  let newProps = null;
  for (const propName in replacedProps) {
    if (propName in props) {
      const replacementProp = replacedProps[propName];
      log.deprecated(`${className}.${propName}`, `${className}.${replacementProp}`)();
      newProps = newProps || Object.assign({}, props);
      newProps[replacementProp] = props[propName];
      delete newProps[propName];
    }
  }

  return newProps || props;
}
