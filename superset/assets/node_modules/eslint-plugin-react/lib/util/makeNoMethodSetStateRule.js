/**
 * @fileoverview Prevent usage of setState in lifecycle methods
 * @author Yannick Croissant
 */
'use strict';

const docsUrl = require('./docsUrl');

// ------------------------------------------------------------------------------
// Rule Definition
// ------------------------------------------------------------------------------

function makeNoMethodSetStateRule(methodName, shouldCheckUnsafeCb) {
  return {
    meta: {
      docs: {
        description: `Prevent usage of setState in ${methodName}`,
        category: 'Best Practices',
        recommended: false,
        url: docsUrl(methodName)
      },

      schema: [{
        enum: ['disallow-in-func']
      }]
    },

    create: function(context) {
      const mode = context.options[0] || 'allow-in-func';

      function nameMatches(name) {
        if (name === methodName) {
          return true;
        }

        if (typeof shouldCheckUnsafeCb === 'function' && shouldCheckUnsafeCb(context)) {
          return name === `UNSAFE_${methodName}`;
        }

        return false;
      }

      // --------------------------------------------------------------------------
      // Public
      // --------------------------------------------------------------------------

      return {

        CallExpression: function(node) {
          const callee = node.callee;
          if (
            callee.type !== 'MemberExpression' ||
            callee.object.type !== 'ThisExpression' ||
            callee.property.name !== 'setState'
          ) {
            return;
          }
          const ancestors = context.getAncestors(callee).reverse();
          let depth = 0;
          for (let i = 0, j = ancestors.length; i < j; i++) {
            const ancestor = ancestors[i];
            if (/Function(Expression|Declaration)$/.test(ancestor.type)) {
              depth++;
            }
            if (
              (ancestor.type !== 'Property' && ancestor.type !== 'MethodDefinition') ||
              !nameMatches(ancestor.key.name) ||
              (mode !== 'disallow-in-func' && depth > 1)
            ) {
              continue;
            }
            context.report({
              node: callee,
              message: `Do not use setState in ${ancestor.key.name}`
            });
            break;
          }
        }
      };
    }
  };
}

module.exports = makeNoMethodSetStateRule;
