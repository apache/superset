/**
 * @fileoverview Report missing `key` props in iterators/collection literals.
 * @author Ben Mosher
 */
'use strict';

const hasProp = require('jsx-ast-utils/hasProp');
const docsUrl = require('../util/docsUrl');


// ------------------------------------------------------------------------------
// Rule Definition
// ------------------------------------------------------------------------------

module.exports = {
  meta: {
    docs: {
      description: 'Report missing `key` props in iterators/collection literals',
      category: 'Possible Errors',
      recommended: true,
      url: docsUrl('jsx-key')
    },
    schema: []
  },

  create: function(context) {
    function checkIteratorElement(node) {
      if (node.type === 'JSXElement' && !hasProp(node.openingElement.attributes, 'key')) {
        context.report({
          node: node,
          message: 'Missing "key" prop for element in iterator'
        });
      }
    }

    function getReturnStatement(body) {
      return body.filter(item => item.type === 'ReturnStatement')[0];
    }

    return {
      JSXElement: function(node) {
        if (hasProp(node.openingElement.attributes, 'key')) {
          return;
        }

        if (node.parent.type === 'ArrayExpression') {
          context.report({
            node: node,
            message: 'Missing "key" prop for element in array'
          });
        }
      },

      // Array.prototype.map
      CallExpression: function (node) {
        if (node.callee && node.callee.type !== 'MemberExpression') {
          return;
        }

        if (node.callee && node.callee.property && node.callee.property.name !== 'map') {
          return;
        }

        const fn = node.arguments[0];
        const isFn = fn && fn.type === 'FunctionExpression';
        const isArrFn = fn && fn.type === 'ArrowFunctionExpression';

        if (isArrFn && fn.body.type === 'JSXElement') {
          checkIteratorElement(fn.body);
        }

        if (isFn || isArrFn) {
          if (fn.body.type === 'BlockStatement') {
            const returnStatement = getReturnStatement(fn.body.body);
            if (returnStatement && returnStatement.argument) {
              checkIteratorElement(returnStatement.argument);
            }
          }
        }
      }
    };
  }
};
