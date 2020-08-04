'use strict';

const getDocsUrl = require('./util').getDocsUrl;
const getNodeName = require('./util').getNodeName;
const isTestCase = require('./util').isTestCase;
const isDescribe = require('./util').isDescribe;

module.exports = {
  meta: {
    docs: {
      url: getDocsUrl(__filename),
    },
    fixable: 'code',
    schema: [
      {
        type: 'object',
        properties: {
          fn: {
            enum: ['it', 'test'],
          },
          withinDescribe: {
            enum: ['it', 'test'],
          },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const configObj = context.options[0] || {};
    const testKeyword = configObj.fn || 'test';
    const testKeywordWithinDescribe =
      configObj.withinDescribe || configObj.fn || 'it';

    let describeNestingLevel = 0;

    return {
      CallExpression(node) {
        const nodeName = getNodeName(node.callee);

        if (isDescribe(node)) {
          describeNestingLevel++;
        }

        if (
          isTestCase(node) &&
          describeNestingLevel === 0 &&
          nodeName.indexOf(testKeyword) === -1
        ) {
          const oppositeTestKeyword = getOppositeTestKeyword(testKeyword);

          context.report({
            message:
              "Prefer using '{{ testKeyword }}' instead of '{{ oppositeTestKeyword }}'",
            node: node.callee,
            data: { testKeyword, oppositeTestKeyword },
            fix(fixer) {
              const nodeToReplace =
                node.callee.type === 'MemberExpression'
                  ? node.callee.object
                  : node.callee;

              const fixedNodeName = getPreferredNodeName(nodeName, testKeyword);
              return [fixer.replaceText(nodeToReplace, fixedNodeName)];
            },
          });
        }

        if (
          isTestCase(node) &&
          describeNestingLevel > 0 &&
          nodeName.indexOf(testKeywordWithinDescribe) === -1
        ) {
          const oppositeTestKeyword = getOppositeTestKeyword(
            testKeywordWithinDescribe
          );

          context.report({
            message:
              "Prefer using '{{ testKeywordWithinDescribe }}' instead of '{{ oppositeTestKeyword }}' within describe",
            node: node.callee,
            data: { testKeywordWithinDescribe, oppositeTestKeyword },
            fix(fixer) {
              const nodeToReplace =
                node.callee.type === 'MemberExpression'
                  ? node.callee.object
                  : node.callee;

              const fixedNodeName = getPreferredNodeName(
                nodeName,
                testKeywordWithinDescribe
              );
              return [fixer.replaceText(nodeToReplace, fixedNodeName)];
            },
          });
        }
      },
      'CallExpression:exit'(node) {
        if (isDescribe(node)) {
          describeNestingLevel--;
        }
      },
    };
  },
};

function getPreferredNodeName(nodeName, preferredTestKeyword) {
  switch (nodeName) {
    case 'fit':
      return 'test.only';
    default:
      return nodeName.startsWith('f') || nodeName.startsWith('x')
        ? nodeName.charAt(0) + preferredTestKeyword
        : preferredTestKeyword;
  }
}

function getOppositeTestKeyword(test) {
  if (test === 'test') {
    return 'it';
  }

  return 'test';
}
