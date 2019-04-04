import { getProp, getLiteralPropValue } from 'jsx-ast-utils';

const presentationRoles = new Set([
  'presentation',
  'none',
]);

const isPresentationRole = (tagName, attributes) => presentationRoles.has(
    getLiteralPropValue(getProp(attributes, 'role')),
  );

export default isPresentationRole;
