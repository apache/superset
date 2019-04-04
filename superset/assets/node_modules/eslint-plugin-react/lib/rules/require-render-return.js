/**
 * @fileoverview Enforce ES5 or ES6 class for returning value in render function.
 * @author Mark Orel
 */
'use strict';

const has = require('has');
const Components = require('../util/Components');
const astUtil = require('../util/ast');
const docsUrl = require('../util/docsUrl');

// ------------------------------------------------------------------------------
// Rule Definition
// ------------------------------------------------------------------------------

module.exports = {
  meta: {
    docs: {
      description: 'Enforce ES5 or ES6 class for returning value in render function',
      category: 'Possible Errors',
      recommended: true,
      url: docsUrl('require-render-return')
    },
    schema: [{}]
  },

  create: Components.detect((context, components, utils) => {
    /**
     * Mark a return statement as present
     * @param {ASTNode} node The AST node being checked.
     */
    function markReturnStatementPresent(node) {
      components.set(node, {
        hasReturnStatement: true
      });
    }

    /**
     * Check if a given AST node has a render method
     * @param {ASTNode} node The AST node being checked.
     * @returns {Boolean} True if there is a render method, false if not
     */
    function hasRenderMethod(node) {
      const properties = astUtil.getComponentProperties(node);
      for (let i = 0, j = properties.length; i < j; i++) {
        if (astUtil.getPropertyName(properties[i]) !== 'render' || !properties[i].value) {
          continue;
        }
        return astUtil.isFunctionLikeExpression(properties[i].value);
      }
      return false;
    }

    return {
      ReturnStatement: function(node) {
        const ancestors = context.getAncestors(node).reverse();
        let depth = 0;
        for (let i = 0, j = ancestors.length; i < j; i++) {
          if (/Function(Expression|Declaration)$/.test(ancestors[i].type)) {
            depth++;
          }
          if (
            !/(MethodDefinition|(Class)?Property)$/.test(ancestors[i].type) ||
            astUtil.getPropertyName(ancestors[i]) !== 'render' ||
            depth > 1
          ) {
            continue;
          }
          markReturnStatementPresent(node);
        }
      },

      ArrowFunctionExpression: function(node) {
        if (node.expression === false || astUtil.getPropertyName(node.parent) !== 'render') {
          return;
        }
        markReturnStatementPresent(node);
      },

      'Program:exit': function() {
        const list = components.list();
        for (const component in list) {
          if (
            !has(list, component) ||
            !hasRenderMethod(list[component].node) ||
            list[component].hasReturnStatement ||
            (!utils.isES5Component(list[component].node) && !utils.isES6Component(list[component].node))
          ) {
            continue;
          }
          context.report({
            node: list[component].node,
            message: 'Your render method should have return statement'
          });
        }
      }
    };
  })
};
