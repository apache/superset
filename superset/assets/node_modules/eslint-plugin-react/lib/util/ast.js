/**
 * @fileoverview Utility functions for AST
 */
'use strict';

/**
 * Find a return statment in the current node
 *
 * @param {ASTNode} ASTnode The AST node being checked
 */
function findReturnStatement(node) {
  if (
    (!node.value || !node.value.body || !node.value.body.body) &&
    (!node.body || !node.body.body)
  ) {
    return false;
  }

  const bodyNodes = (node.value ? node.value.body.body : node.body.body);

  let i = bodyNodes.length - 1;
  for (; i >= 0; i--) {
    if (bodyNodes[i].type === 'ReturnStatement') {
      return bodyNodes[i];
    }
  }
  return false;
}

/**
 * Get node with property's name
 * @param {Object} node - Property.
 * @returns {Object} Property name node.
 */
function getPropertyNameNode(node) {
  if (node.key || ['MethodDefinition', 'Property'].indexOf(node.type) !== -1) {
    return node.key;
  } else if (node.type === 'MemberExpression') {
    return node.property;
  }
  return null;
}

/**
 * Get properties name
 * @param {Object} node - Property.
 * @returns {String} Property name.
 */
function getPropertyName(node) {
  const nameNode = getPropertyNameNode(node);
  return nameNode ? nameNode.name : '';
}

/**
 * Get properties for a given AST node
 * @param {ASTNode} node The AST node being checked.
 * @returns {Array} Properties array.
 */
function getComponentProperties(node) {
  switch (node.type) {
    case 'ClassDeclaration':
    case 'ClassExpression':
      return node.body.body;
    case 'ObjectExpression':
      return node.properties;
    default:
      return [];
  }
}

/**
 * Checks if the node is the first in its line, excluding whitespace.
 * @param {Object} context The node to check
 * @param {ASTNode} node The node to check
 * @return {Boolean} true if it's the first node in its line
 */
function isNodeFirstInLine(context, node) {
  const sourceCode = context.getSourceCode();
  let token = node;
  let lines;
  do {
    token = sourceCode.getTokenBefore(token);
    lines = token.type === 'JSXText'
      ? token.value.split('\n')
      : null;
  } while (
    token.type === 'JSXText' &&
        /^\s*$/.test(lines[lines.length - 1])
  );

  const startLine = node.loc.start.line;
  const endLine = token ? token.loc.end.line : -1;
  return startLine !== endLine;
}

/**
 * Checks if the node is a function or arrow function expression.
 * @param {Object} context The node to check
 * @return {Boolean} true if it's a function-like expression
 */
function isFunctionLikeExpression(node) {
  return node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression';
}

module.exports = {
  findReturnStatement: findReturnStatement,
  getPropertyName: getPropertyName,
  getPropertyNameNode: getPropertyNameNode,
  getComponentProperties: getComponentProperties,
  isNodeFirstInLine: isNodeFirstInLine,
  isFunctionLikeExpression: isFunctionLikeExpression
};
