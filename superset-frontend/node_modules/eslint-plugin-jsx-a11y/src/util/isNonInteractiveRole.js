/**
 * @flow
 */

import {
  dom,
  roles as rolesMap,
} from 'aria-query';
import type { Node } from 'ast-types-flow';
import { getProp, getLiteralPropValue } from 'jsx-ast-utils';
import includes from 'array-includes';

const roles = [...rolesMap.keys()];
const nonInteractiveRoles = roles
  .filter(name => !rolesMap.get(name).abstract)
  .filter(name => !rolesMap.get(name).superClass.some(
    klasses => includes(klasses, 'widget')),
  );

/**
 * Returns boolean indicating whether the given element has a role
 * that is associated with a non-interactive component. Non-interactive roles
 * include `listitem`, `article`, or `dialog`. These are roles that indicate
 * for the most part containers.
 *
 * Elements with these roles should not respond or handle user interactions.
 * For example, an `onClick` handler should not be assigned to an element with
 * the role `listitem`. An element inside the `listitem`, like a button or a
 * link, should handle the click.
 *
 * This utility returns true for elements that are assigned a non-interactive
 * role. It will return false for elements that do not have a role. So whereas
 * a `div` might be considered non-interactive, for the purpose of this utility,
 * it is considered neither interactive nor non-interactive -- a determination
 * cannot be made in this case and false is returned.
 */

const isNonInteractiveRole = (
  tagName: string,
  attributes: Array<Node>,
): boolean => {
  // Do not test higher level JSX components, as we do not know what
  // low-level DOM element this maps to.
  if (!dom.has(tagName)) {
    return false;
  }

  const role = getLiteralPropValue(getProp(attributes, 'role'));

  let isNonInteractive = false;
  const normalizedValues = String(role).toLowerCase().split(' ');
  const validRoles = normalizedValues.reduce((
    accumulator: Array<string>,
    name: string,
  ) => {
    if (includes(roles, name)) {
      accumulator.push(name);
    }
    return accumulator;
  }, []);
  if (validRoles.length > 0) {
    // The first role value is a series takes precedence.
    isNonInteractive = includes(nonInteractiveRoles, validRoles[0]);
  }

  return isNonInteractive;
};

export default isNonInteractiveRole;
