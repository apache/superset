'use strict';

const getDocsUrl = require('./util').getDocsUrl;
const getNodeName = require('./util').getNodeName;

const getJestFnCall = node => {
  if (
    (node.type !== 'CallExpression' && node.type !== 'MemberExpression') ||
    (node.callee && node.callee.type !== 'MemberExpression')
  ) {
    return null;
  }

  const obj = node.callee ? node.callee.object : node.object;

  if (obj.type === 'Identifier') {
    return node.type === 'CallExpression' &&
      getNodeName(node.callee) === 'jest.fn'
      ? node
      : null;
  }

  return getJestFnCall(obj);
};

module.exports = {
  meta: {
    docs: {
      url: getDocsUrl(__filename),
    },
    fixable: 'code',
  },
  create(context) {
    return {
      AssignmentExpression(node) {
        if (node.left.type !== 'MemberExpression') return;

        const jestFnCall = getJestFnCall(node.right);

        if (!jestFnCall) return;

        context.report({
          node,
          message: 'Use jest.spyOn() instead.',
          fix(fixer) {
            const leftPropQuote =
              node.left.property.type === 'Identifier' ? "'" : '';
            const arg = jestFnCall.arguments[0];
            const argSource = arg && context.getSourceCode().getText(arg);
            const mockImplementation = argSource
              ? `.mockImplementation(${argSource})`
              : '';

            return [
              fixer.insertTextBefore(node.left, `jest.spyOn(`),
              fixer.replaceTextRange(
                [node.left.object.end, node.left.property.start],
                `, ${leftPropQuote}`
              ),
              fixer.replaceTextRange(
                [node.left.property.end, jestFnCall.end],
                `${leftPropQuote})${mockImplementation}`
              ),
            ];
          },
        });
      },
    };
  },
};
