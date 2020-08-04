/**
 * @fileoverview Utility functions for JSX
 */

'use strict';

const elementType = require('jsx-ast-utils/elementType');

const COMPAT_TAG_REGEX = /^[a-z]|-/;

/**
 * Checks if a node represents a DOM element.
 * @param {object} node - JSXOpeningElement to check.
 * @returns {boolean} Whether or not the node corresponds to a DOM element.
 */
function isDOMComponent(node) {
  let name = elementType(node);

  // Get namespace if the type is JSXNamespacedName or JSXMemberExpression
  if (name.indexOf(':') > -1) {
    name = name.slice(0, name.indexOf(':'));
  } else if (name.indexOf('.') > -1) {
    name = name.slice(0, name.indexOf('.'));
  }

  return COMPAT_TAG_REGEX.test(name);
}

/**
 * Test whether a JSXElement is a fragment
 * @param {JSXElement} node
 * @param {string} reactPragma
 * @param {string} fragmentPragma
 * @returns {boolean}
 */
function isFragment(node, reactPragma, fragmentPragma) {
  const name = node.openingElement.name;

  // <Fragment>
  if (name.type === 'JSXIdentifier' && name.name === fragmentPragma) {
    return true;
  }

  // <React.Fragment>
  if (
    name.type === 'JSXMemberExpression' &&
    name.object.type === 'JSXIdentifier' &&
    name.object.name === reactPragma &&
    name.property.type === 'JSXIdentifier' &&
    name.property.name === fragmentPragma
  ) {
    return true;
  }

  return false;
}

/**
 * Checks if a node represents a JSX element or fragment.
 * @param {object} node - node to check.
 * @returns {boolean} Whether or not the node if a JSX element or fragment.
 */
function isJSX(node) {
  return node && ['JSXElement', 'JSXFragment'].indexOf(node.type) >= 0;
}

/**
 * Check if node is like `key={...}` as in `<Foo key={...} />`
 * @param {ASTNode} node
 * @returns {boolean}
 */
function isJSXAttributeKey(node) {
  return node.type === 'JSXAttribute' &&
    node.name &&
    node.name.type === 'JSXIdentifier' &&
    node.name.name === 'key';
}

/**
 * Check if value has only whitespaces
 * @param {string} value
 * @returns {boolean}
 */
function isWhiteSpaces(value) {
  return typeof value === 'string' ? /^\s*$/.test(value) : false;
}

module.exports = {
  isDOMComponent,
  isFragment,
  isJSX,
  isJSXAttributeKey,
  isWhiteSpaces
};
