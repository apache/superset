'use strict';

const getDocsUrl = require('./util').getDocsUrl;
const isDescribe = require('./util').isDescribe;
const isTestCase = require('./util').isTestCase;

const newDescribeContext = () => ({
  describeTitles: [],
  testTitles: [],
});

const handleTestCaseTitles = (context, titles, node, title) => {
  if (isTestCase(node)) {
    if (titles.indexOf(title) !== -1) {
      context.report({
        message:
          'Test title is used multiple times in the same describe block.',
        node,
      });
    }
    titles.push(title);
  }
};

const handleDescribeBlockTitles = (context, titles, node, title) => {
  if (!isDescribe(node)) {
    return;
  }
  if (titles.indexOf(title) !== -1) {
    context.report({
      message:
        'Describe block title is used multiple times in the same describe block.',
      node,
    });
  }
  titles.push(title);
};

const isFirstArgLiteral = node =>
  node.arguments && node.arguments[0] && node.arguments[0].type === 'Literal';

module.exports = {
  meta: {
    docs: {
      url: getDocsUrl(__filename),
    },
  },
  create(context) {
    const contexts = [newDescribeContext()];
    return {
      CallExpression(node) {
        const currentLayer = contexts[contexts.length - 1];
        if (isDescribe(node)) {
          contexts.push(newDescribeContext());
        }
        if (!isFirstArgLiteral(node)) {
          return;
        }

        const title = node.arguments[0].value;
        handleTestCaseTitles(context, currentLayer.testTitles, node, title);
        handleDescribeBlockTitles(
          context,
          currentLayer.describeTitles,
          node,
          title
        );
      },
      'CallExpression:exit'(node) {
        if (isDescribe(node)) {
          contexts.pop();
        }
      },
    };
  },
};
