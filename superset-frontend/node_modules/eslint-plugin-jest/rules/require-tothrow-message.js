'use strict';

const argument = require('./util').argument;
const expectCase = require('./util').expectCase;
const getDocsUrl = require('./util').getDocsUrl;
const method = require('./util').method;

module.exports = {
  meta: {
    docs: {
      url: getDocsUrl(__filename),
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (!expectCase(node)) {
          return;
        }

        const propertyName = method(node) && method(node).name;

        // Look for `toThrow` calls with no arguments.
        if (
          ['toThrow', 'toThrowError'].indexOf(propertyName) > -1 &&
          !argument(node)
        ) {
          context.report({
            message: `Add an error message to {{ propertyName }}()`,
            data: {
              propertyName,
            },
            node: method(node),
          });
        }
      },
    };
  },
};
