'use strict';

const getDocsUrl = require('./util').getDocsUrl;
const argument = require('./util').argument;
const argument2 = require('./util').argument2;
const expectToBeCase = require('./util').expectToBeCase;
const expectToEqualCase = require('./util').expectToEqualCase;
const expectNotToEqualCase = require('./util').expectNotToEqualCase;
const expectNotToBeCase = require('./util').expectNotToBeCase;
const method = require('./util').method;
const method2 = require('./util').method2;

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
        const is = expectToBeCase(node, null) || expectToEqualCase(node, null);
        const isNot =
          expectNotToEqualCase(node, null) || expectNotToBeCase(node, null);

        if (is || isNot) {
          context.report({
            fix(fixer) {
              if (is) {
                return [
                  fixer.replaceText(method(node), 'toBeNull'),
                  fixer.remove(argument(node)),
                ];
              }
              return [
                fixer.replaceText(method2(node), 'toBeNull'),
                fixer.remove(argument2(node)),
              ];
            },
            message: 'Use toBeNull() instead',
            node: is ? method(node) : method2(node),
          });
        }
      },
    };
  },
};
