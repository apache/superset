'use strict';

const getDocsUrl = require('./util').getDocsUrl;
const isTestCase = require('./util').isTestCase;

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
        if (!isTestCase(node) || node.arguments.length !== 2) {
          return;
        }

        const callback = node.arguments[1];

        if (
          !/^(Arrow)?FunctionExpression$/.test(callback.type) ||
          callback.params.length !== 1
        ) {
          return;
        }

        const argument = callback.params[0];
        context.report({
          node: argument,
          message: 'Illegal usage of test callback',
          fix(fixer) {
            const sourceCode = context.getSourceCode();
            const body = callback.body;
            const firstBodyToken = sourceCode.getFirstToken(body);
            const lastBodyToken = sourceCode.getLastToken(body);
            const tokenBeforeArgument = sourceCode.getTokenBefore(argument);
            const tokenAfterArgument = sourceCode.getTokenAfter(argument);
            const argumentInParens =
              tokenBeforeArgument.value === '(' &&
              tokenAfterArgument.value === ')';

            let argumentFix = fixer.replaceText(argument, '()');

            if (argumentInParens) {
              argumentFix = fixer.remove(argument);
            }

            let newCallback = argument.name;

            if (argumentInParens) {
              newCallback = `(${newCallback})`;
            }

            let beforeReplacement = `new Promise(${newCallback} => `;
            let afterReplacement = ')';
            let replaceBefore = true;

            if (body.type === 'BlockStatement') {
              const keyword = callback.async ? 'await' : 'return';

              beforeReplacement = `${keyword} ${beforeReplacement}{`;
              afterReplacement += '}';
              replaceBefore = false;
            }

            return [
              argumentFix,
              replaceBefore
                ? fixer.insertTextBefore(firstBodyToken, beforeReplacement)
                : fixer.insertTextAfter(firstBodyToken, beforeReplacement),
              fixer.insertTextAfter(lastBodyToken, afterReplacement),
            ];
          },
        });
      },
    };
  },
};
