/**
 * @fileoverview Enforce event handler naming conventions in JSX
 * @author Jake Marsh
 */
'use strict';

const docsUrl = require('../util/docsUrl');

// ------------------------------------------------------------------------------
// Rule Definition
// ------------------------------------------------------------------------------

module.exports = {
  meta: {
    docs: {
      description: 'Enforce event handler naming conventions in JSX',
      category: 'Stylistic Issues',
      recommended: false,
      url: docsUrl('jsx-handler-names')
    },

    schema: [{
      type: 'object',
      properties: {
        eventHandlerPrefix: {
          type: 'string'
        },
        eventHandlerPropPrefix: {
          type: 'string'
        }
      },
      additionalProperties: false
    }]
  },

  create: function(context) {
    const sourceCode = context.getSourceCode();
    const configuration = context.options[0] || {};
    const eventHandlerPrefix = configuration.eventHandlerPrefix || 'handle';
    const eventHandlerPropPrefix = configuration.eventHandlerPropPrefix || 'on';

    const EVENT_HANDLER_REGEX = new RegExp(`^((props\\.${eventHandlerPropPrefix})|((.*\\.)?${eventHandlerPrefix}))[A-Z].*$`);
    const PROP_EVENT_HANDLER_REGEX = new RegExp(`^(${eventHandlerPropPrefix}[A-Z].*|ref)$`);

    return {
      JSXAttribute: function(node) {
        if (!node.value || !node.value.expression || !node.value.expression.object) {
          return;
        }

        const propKey = typeof node.name === 'object' ? node.name.name : node.name;
        const propValue = sourceCode.getText(node.value.expression).replace(/^this\.|.*::/, '');

        if (propKey === 'ref') {
          return;
        }

        const propIsEventHandler = PROP_EVENT_HANDLER_REGEX.test(propKey);
        const propFnIsNamedCorrectly = EVENT_HANDLER_REGEX.test(propValue);

        if (propIsEventHandler && !propFnIsNamedCorrectly) {
          context.report({
            node: node,
            message: `Handler function for ${propKey} prop key must begin with '${eventHandlerPrefix}'`
          });
        } else if (propFnIsNamedCorrectly && !propIsEventHandler) {
          context.report({
            node: node,
            message: `Prop key for ${propValue} must begin with '${eventHandlerPropPrefix}'`
          });
        }
      }
    };
  }
};
