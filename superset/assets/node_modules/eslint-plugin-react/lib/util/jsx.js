/**
 * @fileoverview Utility functions for JSX
 */
'use strict';

const elementType = require('jsx-ast-utils/elementType');

const COMPAT_TAG_REGEX = /^[a-z]|\-/;

/**
 * Checks if a node represents a DOM element.
 * @param {String} node - JSXOpeningElement to check.
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

module.exports = {
  isDOMComponent: isDOMComponent
};
