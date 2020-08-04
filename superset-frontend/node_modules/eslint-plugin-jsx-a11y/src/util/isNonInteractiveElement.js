/**
 * @flow
 */

import {
  dom,
  elementRoles,
  roles,
} from 'aria-query';
import {
  AXObjects,
  elementAXObjects,
} from 'axobject-query';
import type { Node } from 'ast-types-flow';
import includes from 'array-includes';
import attributesComparator from './attributesComparator';

const roleKeys = [...roles.keys()];
const elementRoleEntries = [...elementRoles];

const nonInteractiveRoles = new Set(
  roleKeys
    .filter((name) => {
      const role = roles.get(name);
      return (
        !role.abstract
        && !role.superClass.some(
          classes => includes(classes, 'widget'),
        )
      );
    }),
);

const interactiveRoles = new Set(
    [].concat(
      roleKeys,
      // 'toolbar' does not descend from widget, but it does support
      // aria-activedescendant, thus in practice we treat it as a widget.
      'toolbar',
    )
    .filter((name) => {
      const role = roles.get(name);
      return (
        !role.abstract
        && role.superClass.some(
          classes => includes(classes, 'widget'),
        )
      );
    }),
);

const nonInteractiveElementRoleSchemas = elementRoleEntries
  .reduce((
    accumulator,
    [
      elementSchema,
      roleSet,
    ],
  ) => {
    if ([...roleSet].every(
      (role): boolean => nonInteractiveRoles.has(role),
    )) {
      accumulator.push(elementSchema);
    }
    return accumulator;
  }, []);

const interactiveElementRoleSchemas = elementRoleEntries
  .reduce((
    accumulator,
    [
      elementSchema,
      roleSet,
    ],
  ) => {
    if ([...roleSet].some(
      (role): boolean => interactiveRoles.has(role),
    )) {
      accumulator.push(elementSchema);
    }
    return accumulator;
  }, []);

const nonInteractiveAXObjects = new Set(
  [...AXObjects.keys()]
    .filter(name => includes(['window', 'structure'], AXObjects.get(name).type)),
);

const nonInteractiveElementAXObjectSchemas = [...elementAXObjects]
  .reduce((
    accumulator,
    [
      elementSchema,
      AXObjectSet,
    ],
  ) => {
    if ([...AXObjectSet].every(
      (role): boolean => nonInteractiveAXObjects.has(role),
    )) {
      accumulator.push(elementSchema);
    }
    return accumulator;
  }, []);

function checkIsNonInteractiveElement(tagName, attributes): boolean {
  function elementSchemaMatcher(elementSchema) {
    return (
      tagName === elementSchema.name
      && attributesComparator(elementSchema.attributes, attributes)
    );
  }
  // Check in elementRoles for inherent non-interactive role associations for
  // this element.
  const isInherentNonInteractiveElement = nonInteractiveElementRoleSchemas
    .some(elementSchemaMatcher);
  if (isInherentNonInteractiveElement) {
    return true;
  }
  // Check in elementRoles for inherent interactive role associations for
  // this element.
  const isInherentInteractiveElement = interactiveElementRoleSchemas
    .some(elementSchemaMatcher);
  if (isInherentInteractiveElement) {
    return false;
  }
  // Check in elementAXObjects for AX Tree associations for this element.
  const isNonInteractiveAXElement = nonInteractiveElementAXObjectSchemas
    .some(elementSchemaMatcher);
  if (isNonInteractiveAXElement) {
    return true;
  }

  return false;
}

/**
 * Returns boolean indicating whether the given element is a non-interactive
 * element. If the element has either a non-interactive role assigned or it
 * is an element with an inherently non-interactive role, then this utility
 * returns true. Elements that lack either an explicitly assigned role or
 * an inherent role are not considered. For those, this utility returns false
 * because a positive determination of interactiveness cannot be determined.
 */
const isNonInteractiveElement = (
  tagName: string,
  attributes: Array<Node>,
): boolean => {
  // Do not test higher level JSX components, as we do not know what
  // low-level DOM element this maps to.
  if (!dom.has(tagName)) {
    return false;
  }

  return checkIsNonInteractiveElement(tagName, attributes);
};

export default isNonInteractiveElement;
