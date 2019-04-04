'use strict';

const getDocsUrl = require('./util').getDocsUrl;
const expectCase = require('./util').expectCase;
const expectNotCase = require('./util').expectNotCase;
const expectResolveCase = require('./util').expectResolveCase;
const expectRejectCase = require('./util').expectRejectCase;
const method = require('./util').method;

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
        if (
          !(
            expectNotCase(node) ||
            expectResolveCase(node) ||
            expectRejectCase(node)
          ) &&
          expectCase(node) &&
          (method(node).name === 'toBe' || method(node).name === 'toEqual') &&
          node.arguments[0].property &&
          node.arguments[0].property.name === 'length'
        ) {
          const propertyDot = context
            .getSourceCode()
            .getFirstTokenBetween(
              node.arguments[0].object,
              node.arguments[0].property,
              token => token.value === '.'
            );
          context.report({
            fix(fixer) {
              return [
                fixer.remove(propertyDot),
                fixer.remove(node.arguments[0].property),
                fixer.replaceText(method(node), 'toHaveLength'),
              ];
            },
            message: 'Use toHaveLength() instead',
            node: method(node),
          });
        }
      },
    };
  },
};
