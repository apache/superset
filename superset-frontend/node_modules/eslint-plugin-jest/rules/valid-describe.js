'use strict';

const getDocsUrl = require('./util').getDocsUrl;
const isDescribe = require('./util').isDescribe;
const isFunction = require('./util').isFunction;

const isAsync = node => node.async;

const isString = node =>
  (node.type === 'Literal' && typeof node.value === 'string') ||
  node.type === 'TemplateLiteral';

const hasParams = node => node.params.length > 0;

const paramsLocation = params => {
  const first = params[0];
  const last = params[params.length - 1];
  return {
    start: {
      line: first.loc.start.line,
      column: first.loc.start.column,
    },
    end: {
      line: last.loc.end.line,
      column: last.loc.end.column,
    },
  };
};

module.exports = {
  meta: {
    docs: {
      url: getDocsUrl(__filename),
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (isDescribe(node)) {
          if (node.arguments.length === 0) {
            return context.report({
              message: 'Describe requires name and callback arguments',
              loc: node.loc,
            });
          }

          const name = node.arguments[0];
          const callbackFunction = node.arguments[1];
          if (!isString(name)) {
            context.report({
              message: 'First argument must be name',
              loc: paramsLocation(node.arguments),
            });
          }
          if (callbackFunction === undefined) {
            return context.report({
              message: 'Describe requires name and callback arguments',
              loc: paramsLocation(node.arguments),
            });
          }
          if (!isFunction(callbackFunction)) {
            return context.report({
              message: 'Second argument must be function',
              loc: paramsLocation(node.arguments),
            });
          }
          if (isAsync(callbackFunction)) {
            context.report({
              message: 'No async describe callback',
              node: callbackFunction,
            });
          }
          if (hasParams(callbackFunction)) {
            context.report({
              message: 'Unexpected argument(s) in describe callback',
              loc: paramsLocation(callbackFunction.params),
            });
          }
          if (callbackFunction.body.type === 'BlockStatement') {
            callbackFunction.body.body.forEach(node => {
              if (node.type === 'ReturnStatement') {
                context.report({
                  message: 'Unexpected return statement in describe callback',
                  node,
                });
              }
            });
          }
        }
      },
    };
  },
};
