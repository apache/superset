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
  },
  create(context) {
    return {
      CallExpression(node) {
        const nodeName = getNodeName(node.callee);

        if (!isDescribe(node) && !isTestCase(node)) return;

        const preferredNodeName = getPreferredNodeName(nodeName);

        if (!preferredNodeName) return;

        context.report({
          message: 'Use "{{ preferredNodeName }}" instead',
          node: node.callee,
          data: { preferredNodeName },
          fix(fixer) {
            return [fixer.replaceText(node.callee, preferredNodeName)];
          },
        });
      },
    };
  },
};

function getPreferredNodeName(nodeName) {
  const firstChar = nodeName.charAt(0);

  if (firstChar === 'f') {
    return `${nodeName.slice(1)}.only`;
  }

  if (firstChar === 'x') {
    return `${nodeName.slice(1)}.skip`;
  }
}
