'use strict';

const path = require('path');
const version = require('../package.json').version;

const REPO_URL = 'https://github.com/jest-community/eslint-plugin-jest';

const expectCase = node =>
  node.callee.name === 'expect' &&
  node.arguments.length === 1 &&
  node.parent &&
  node.parent.type === 'MemberExpression' &&
  node.parent.parent;

const expectNotCase = node =>
  expectCase(node) &&
  node.parent.parent.type === 'MemberExpression' &&
  methodName(node) === 'not';

const expectResolveCase = node =>
  expectCase(node) &&
  node.parent.parent.type === 'MemberExpression' &&
  methodName(node) === 'resolve';

const expectRejectCase = node =>
  expectCase(node) &&
  node.parent.parent.type === 'MemberExpression' &&
  methodName(node) === 'reject';

const expectToBeCase = (node, arg) =>
  !(expectNotCase(node) || expectResolveCase(node) || expectRejectCase(node)) &&
  expectCase(node) &&
  methodName(node) === 'toBe' &&
  argument(node) &&
  ((argument(node).type === 'Literal' &&
    argument(node).value === null &&
    arg === null) ||
    (argument(node).name === 'undefined' && arg === undefined));

const expectNotToBeCase = (node, arg) =>
  expectNotCase(node) &&
  methodName2(node) === 'toBe' &&
  argument2(node) &&
  ((argument2(node).type === 'Literal' &&
    argument2(node).value === null &&
    arg === null) ||
    (argument2(node).name === 'undefined' && arg === undefined));

const expectToEqualCase = (node, arg) =>
  !(expectNotCase(node) || expectResolveCase(node) || expectRejectCase(node)) &&
  expectCase(node) &&
  methodName(node) === 'toEqual' &&
  argument(node) &&
  ((argument(node).type === 'Literal' &&
    argument(node).value === null &&
    arg === null) ||
    (argument(node).name === 'undefined' && arg === undefined));

const expectNotToEqualCase = (node, arg) =>
  expectNotCase(node) &&
  methodName2(node) === 'toEqual' &&
  argument2(node) &&
  ((argument2(node).type === 'Literal' &&
    argument2(node).value === null &&
    arg === null) ||
    (argument2(node).name === 'undefined' && arg === undefined));

const method = node => node.parent.property;

const method2 = node => node.parent.parent.property;

const methodName = node => method(node).name;

const methodName2 = node => method2(node).name;

const argument = node => node.parent.parent.arguments[0];

const argument2 = node => node.parent.parent.parent.arguments[0];

const describeAliases = Object.assign(Object.create(null), {
  describe: true,
  'describe.only': true,
  'describe.skip': true,
  fdescribe: true,
  xdescribe: true,
});

const testCaseNames = Object.assign(Object.create(null), {
  fit: true,
  it: true,
  'it.only': true,
  'it.skip': true,
  test: true,
  'test.only': true,
  'test.skip': true,
  xit: true,
  xtest: true,
});

const getNodeName = node => {
  function joinNames(a, b) {
    return a && b ? `${a}.${b}` : null;
  }

  switch (node && node.type) {
    case 'Identifier':
      return node.name;
    case 'Literal':
      return node.value;
    case 'TemplateLiteral':
      if (node.expressions.length === 0) return node.quasis[0].value.cooked;
      break;
    case 'MemberExpression':
      return joinNames(getNodeName(node.object), getNodeName(node.property));
  }

  return null;
};

const isTestCase = node =>
  node &&
  node.type === 'CallExpression' &&
  testCaseNames[getNodeName(node.callee)];

const isDescribe = node =>
  node.type === 'CallExpression' && describeAliases[getNodeName(node.callee)];

const isFunction = node =>
  node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression';

/**
 * Generates the URL to documentation for the given rule name. It uses the
 * package version to build the link to a tagged version of the
 * documentation file.
 *
 * @param {string} filename - Name of the eslint rule
 * @returns {string} URL to the documentation for the given rule
 */
const getDocsUrl = filename => {
  const ruleName = path.basename(filename, '.js');

  return `${REPO_URL}/blob/v${version}/docs/rules/${ruleName}.md`;
};

module.exports = {
  method,
  method2,
  argument,
  argument2,
  expectCase,
  expectNotCase,
  expectResolveCase,
  expectRejectCase,
  expectToBeCase,
  expectNotToBeCase,
  expectToEqualCase,
  expectNotToEqualCase,
  getNodeName,
  isDescribe,
  isFunction,
  isTestCase,
  getDocsUrl,
};
