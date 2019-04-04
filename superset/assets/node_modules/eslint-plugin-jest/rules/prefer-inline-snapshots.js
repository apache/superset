'use strict';

const getDocsUrl = require('./util').getDocsUrl;

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
        const propertyName = node.callee.property && node.callee.property.name;
        if (propertyName === 'toMatchSnapshot') {
          context.report({
            fix(fixer) {
              return [
                fixer.replaceText(
                  node.callee.property,
                  'toMatchInlineSnapshot'
                ),
              ];
            },
            message: 'Use toMatchInlineSnapshot() instead',
            node: node.callee.property,
          });
        } else if (propertyName === 'toThrowErrorMatchingSnapshot') {
          context.report({
            fix(fixer) {
              return [
                fixer.replaceText(
                  node.callee.property,
                  'toThrowErrorMatchingInlineSnapshot'
                ),
              ];
            },
            message: 'Use toThrowErrorMatchingInlineSnapshot() instead',
            node: node.callee.property,
          });
        }
      },
    };
  },
};
