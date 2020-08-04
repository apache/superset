'use strict';

const expectCase = require('./util').expectCase;
const getDocsUrl = require('./util').getDocsUrl;
const method = require('./util').method;

module.exports = {
  meta: {
    docs: {
      url: getDocsUrl(__filename),
    },
    fixable: 'code',
  },
  create(context) {
    // The Jest methods which have aliases. The canonical name is the first
    // index of each item.
    const methodNames = [
      ['toHaveBeenCalled', 'toBeCalled'],
      ['toHaveBeenCalledTimes', 'toBeCalledTimes'],
      ['toHaveBeenCalledWith', 'toBeCalledWith'],
      ['toHaveBeenLastCalledWith', 'lastCalledWith'],
      ['toHaveBeenNthCalledWith', 'nthCalledWith'],
      ['toHaveReturned', 'toReturn'],
      ['toHaveReturnedTimes', 'toReturnTimes'],
      ['toHaveReturnedWith', 'toReturnWith'],
      ['toHaveLastReturnedWith', 'lastReturnedWith'],
      ['toHaveNthReturnedWith', 'nthReturnedWith'],
      ['toThrow', 'toThrowError'],
    ];

    return {
      CallExpression(node) {
        if (!expectCase(node)) {
          return;
        }

        // Check if the method used matches any of ours.
        const propertyName = method(node) && method(node).name;
        const methodItem = methodNames.find(item => item[1] === propertyName);

        if (methodItem) {
          context.report({
            message: `Replace {{ replace }}() with its canonical name of {{ canonical }}()`,
            data: {
              replace: methodItem[1],
              canonical: methodItem[0],
            },
            node: method(node),
            fix(fixer) {
              return [fixer.replaceText(method(node), methodItem[0])];
            },
          });
        }
      },
    };
  },
};
