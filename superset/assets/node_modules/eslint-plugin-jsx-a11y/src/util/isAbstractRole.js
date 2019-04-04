import {
  dom,
  roles,
} from 'aria-query';
import { getProp, getLiteralPropValue } from 'jsx-ast-utils';

const abstractRoles = new Set([...roles.keys()]
  .filter(role => roles.get(role).abstract));

const DOMElements = [...dom.keys()];

const isAbstractRole = (tagName, attributes) => {
  // Do not test higher level JSX components, as we do not know what
  // low-level DOM element this maps to.
  if (DOMElements.indexOf(tagName) === -1) {
    return false;
  }

  const role = getLiteralPropValue(getProp(attributes, 'role'));

  return abstractRoles.has(role);
};

export default isAbstractRole;
