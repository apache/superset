/**
 * @fileoverview Forbid certain elements
 * @author Kenneth Chung
 */
'use strict';

const has = require('has');
const docsUrl = require('../util/docsUrl');

// ------------------------------------------------------------------------------
// Rule Definition
// ------------------------------------------------------------------------------

module.exports = {
  meta: {
    docs: {
      description: 'Forbid certain elements',
      category: 'Best Practices',
      recommended: false,
      url: docsUrl('forbid-elements')
    },

    schema: [{
      type: 'object',
      properties: {
        forbid: {
          type: 'array',
          items: {
            anyOf: [
              {type: 'string'},
              {
                type: 'object',
                properties: {
                  element: {type: 'string'},
                  message: {type: 'string'}
                },
                required: ['element'],
                additionalProperties: false
              }
            ]
          }
        }
      },
      additionalProperties: false
    }]
  },

  create: function(context) {
    const sourceCode = context.getSourceCode();
    const configuration = context.options[0] || {};
    const forbidConfiguration = configuration.forbid || [];

    const indexedForbidConfigs = {};

    forbidConfiguration.forEach(item => {
      if (typeof item === 'string') {
        indexedForbidConfigs[item] = {element: item};
      } else {
        indexedForbidConfigs[item.element] = item;
      }
    });

    function errorMessageForElement(name) {
      const message = `<${name}> is forbidden`;
      const additionalMessage = indexedForbidConfigs[name].message;

      if (additionalMessage) {
        return `${message}, ${additionalMessage}`;
      }

      return message;
    }

    function isValidCreateElement(node) {
      return node.callee
        && node.callee.type === 'MemberExpression'
        && node.callee.object.name === 'React'
        && node.callee.property.name === 'createElement'
        && node.arguments.length > 0;
    }

    function reportIfForbidden(element, node) {
      if (has(indexedForbidConfigs, element)) {
        context.report({
          node: node,
          message: errorMessageForElement(element)
        });
      }
    }

    return {
      JSXOpeningElement: function(node) {
        reportIfForbidden(sourceCode.getText(node.name), node.name);
      },

      CallExpression: function(node) {
        if (!isValidCreateElement(node)) {
          return;
        }

        const argument = node.arguments[0];
        const argType = argument.type;

        if (argType === 'Identifier' && /^[A-Z_]/.test(argument.name)) {
          reportIfForbidden(argument.name, argument);
        } else if (argType === 'Literal' && /^[a-z][^\.]*$/.test(argument.value)) {
          reportIfForbidden(argument.value, argument);
        } else if (argType === 'MemberExpression') {
          reportIfForbidden(sourceCode.getText(argument), argument);
        }
      }
    };
  }
};
