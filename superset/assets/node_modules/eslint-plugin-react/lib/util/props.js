/**
 * @fileoverview Utility functions for props
 */
'use strict';

const astUtil = require('./ast');

/**
 * Checks if the Identifier node passed in looks like a propTypes declaration.
 * @param {ASTNode} node The node to check. Must be an Identifier node.
 * @returns {Boolean} `true` if the node is a propTypes declaration, `false` if not
 */
function isPropTypesDeclaration(node) {
  if (node && node.type === 'ClassProperty') {
    // Flow support
    if (node.typeAnnotation && node.key.name === 'props') {
      return true;
    }
  }
  return astUtil.getPropertyName(node) === 'propTypes';
}

/**
 * Checks if the node passed in looks like a contextTypes declaration.
 * @param {ASTNode} node The node to check.
 * @returns {Boolean} `true` if the node is a contextTypes declaration, `false` if not
 */
function isContextTypesDeclaration(node) {
  if (node && node.type === 'ClassProperty') {
    // Flow support
    if (node.typeAnnotation && node.key.name === 'context') {
      return true;
    }
  }
  return astUtil.getPropertyName(node) === 'contextTypes';
}

/**
 * Checks if the node passed in looks like a childContextTypes declaration.
 * @param {ASTNode} node The node to check.
 * @returns {Boolean} `true` if the node is a childContextTypes declaration, `false` if not
 */
function isChildContextTypesDeclaration(node) {
  return astUtil.getPropertyName(node) === 'childContextTypes';
}

/**
 * Checks if the Identifier node passed in looks like a defaultProps declaration.
 * @param {ASTNode} node The node to check. Must be an Identifier node.
 * @returns {Boolean} `true` if the node is a defaultProps declaration, `false` if not
 */
function isDefaultPropsDeclaration(node) {
  const propName = astUtil.getPropertyName(node);
  return (propName === 'defaultProps' || propName === 'getDefaultProps');
}

/**
 * Checks if the PropTypes MemberExpression node passed in declares a required propType.
 * @param {ASTNode} propTypeExpression node to check. Must be a `PropTypes` MemberExpression.
 * @returns {Boolean} `true` if this PropType is required, `false` if not.
 */
function isRequiredPropType(propTypeExpression) {
  return propTypeExpression.type === 'MemberExpression' && propTypeExpression.property.name === 'isRequired';
}

module.exports = {
  isPropTypesDeclaration: isPropTypesDeclaration,
  isContextTypesDeclaration: isContextTypesDeclaration,
  isChildContextTypesDeclaration: isChildContextTypesDeclaration,
  isDefaultPropsDeclaration: isDefaultPropsDeclaration,
  isRequiredPropType: isRequiredPropType
};
