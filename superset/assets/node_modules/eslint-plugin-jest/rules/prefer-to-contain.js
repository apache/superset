'use strict';

const getDocsUrl = require('./util').getDocsUrl;
const expectCase = require('./util').expectCase;
const expectResolveCase = require('./util').expectResolveCase;
const expectRejectCase = require('./util').expectRejectCase;
const method = require('./util').method;
const argument = require('./util').argument;

const isEqualityCheck = node =>
  method(node) &&
  (method(node).name === 'toBe' || method(node).name === 'toEqual');

const isArgumentValid = node =>
  argument(node).value === true || argument(node).value === false;

const hasOneArgument = node => node.arguments && node.arguments.length === 1;

const isValidEqualityCheck = node =>
  isEqualityCheck(node) &&
  hasOneArgument(node.parent.parent) &&
  isArgumentValid(node);

const isEqualityNegation = node =>
  method(node).name === 'not' && isValidEqualityCheck(node.parent);

const hasIncludesMethod = node =>
  node.arguments[0] &&
  node.arguments[0].callee &&
  node.arguments[0].callee.property &&
  node.arguments[0].callee.property.name === 'includes';

const isValidIncludesMethod = node =>
  hasIncludesMethod(node) && hasOneArgument(node.arguments[0]);

const getNegationFixes = (node, sourceCode, fixer) => {
  const negationPropertyDot = sourceCode.getFirstTokenBetween(
    node.parent.object,
    node.parent.property,
    token => token.value === '.'
  );
  const toContainFunc =
    isEqualityNegation(node) && argument(node.parent).value
      ? 'not.toContain'
      : 'toContain';

  //.includes function argument
  const containArg = node.arguments[0].arguments[0];
  return [
    fixer.remove(negationPropertyDot),
    fixer.remove(method(node)),
    fixer.replaceText(method(node.parent), toContainFunc),
    fixer.replaceText(argument(node.parent), sourceCode.getText(containArg)),
  ];
};

const getCommonFixes = (node, sourceCode, fixer) => {
  const containArg = node.arguments[0].arguments[0];
  const includesCaller = node.arguments[0].callee;

  const propertyDot = sourceCode.getFirstTokenBetween(
    includesCaller.object,
    includesCaller.property,
    token => token.value === '.'
  );

  const closingParenthesis = sourceCode.getTokenAfter(containArg);
  const openParenthesis = sourceCode.getTokenBefore(containArg);

  return [
    fixer.remove(containArg),
    fixer.remove(includesCaller.property),
    fixer.remove(propertyDot),
    fixer.remove(closingParenthesis),
    fixer.remove(openParenthesis),
  ];
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
      CallExpression(node) {
        if (
          !(expectResolveCase(node) || expectRejectCase(node)) &&
          expectCase(node) &&
          (isEqualityNegation(node) || isValidEqualityCheck(node)) &&
          isValidIncludesMethod(node)
        ) {
          context.report({
            fix(fixer) {
              const sourceCode = context.getSourceCode();

              let fixArr = getCommonFixes(node, sourceCode, fixer);
              if (isEqualityNegation(node)) {
                return getNegationFixes(node, sourceCode, fixer).concat(fixArr);
              }

              const toContainFunc = argument(node).value
                ? 'toContain'
                : 'not.toContain';

              //.includes function argument
              const containArg = node.arguments[0].arguments[0];

              fixArr.push(fixer.replaceText(method(node), toContainFunc));
              fixArr.push(
                fixer.replaceText(
                  argument(node),
                  sourceCode.getText(containArg)
                )
              );
              return fixArr;
            },
            message: 'Use toContain() instead',
            node: method(node),
          });
        }
      },
    };
  },
};
