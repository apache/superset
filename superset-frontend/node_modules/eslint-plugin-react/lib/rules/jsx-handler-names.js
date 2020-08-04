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
      oneOf: [
        {
          type: 'object',
          properties: {
            eventHandlerPrefix: {type: 'string'},
            eventHandlerPropPrefix: {type: 'string'}
          },
          additionalProperties: false
        }, {
          type: 'object',
          properties: {
            eventHandlerPrefix: {type: 'string'},
            eventHandlerPropPrefix: {
              type: 'boolean',
              enum: [false]
            }
          },
          additionalProperties: false
        }, {
          type: 'object',
          properties: {
            eventHandlerPrefix: {
              type: 'boolean',
              enum: [false]
            },
            eventHandlerPropPrefix: {type: 'string'}
          },
          additionalProperties: false
        }
      ]
    }]
  },

  create(context) {
    function isPrefixDisabled(prefix) {
      return prefix === false;
    }

    const configuration = context.options[0] || {};

    const eventHandlerPrefix = isPrefixDisabled(configuration.eventHandlerPrefix) ?
      null :
      configuration.eventHandlerPrefix || 'handle';
    const eventHandlerPropPrefix = isPrefixDisabled(configuration.eventHandlerPropPrefix) ?
      null :
      configuration.eventHandlerPropPrefix || 'on';

    const EVENT_HANDLER_REGEX = !eventHandlerPrefix ?
      null :
      new RegExp(`^((props\\.${eventHandlerPropPrefix || ''})|((.*\\.)?${eventHandlerPrefix}))[A-Z].*$`);
    const PROP_EVENT_HANDLER_REGEX = !eventHandlerPropPrefix ?
      null :
      new RegExp(`^(${eventHandlerPropPrefix}[A-Z].*|ref)$`);

    return {
      JSXAttribute(node) {
        if (!node.value || !node.value.expression || !node.value.expression.object) {
          return;
        }

        const propKey = typeof node.name === 'object' ? node.name.name : node.name;
        const propValue = context.getSourceCode().getText(node.value.expression).replace(/^this\.|.*::/, '');

        if (propKey === 'ref') {
          return;
        }

        const propIsEventHandler = PROP_EVENT_HANDLER_REGEX && PROP_EVENT_HANDLER_REGEX.test(propKey);
        const propFnIsNamedCorrectly = EVENT_HANDLER_REGEX && EVENT_HANDLER_REGEX.test(propValue);

        if (
          propIsEventHandler &&
          propFnIsNamedCorrectly !== null &&
          !propFnIsNamedCorrectly
        ) {
          context.report({
            node,
            message: `Handler function for ${propKey} prop key must begin with '${eventHandlerPrefix}'`
          });
        } else if (
          propFnIsNamedCorrectly &&
          propIsEventHandler !== null &&
          !propIsEventHandler
        ) {
          context.report({
            node,
            message: `Prop key for ${propValue} must begin with '${eventHandlerPropPrefix}'`
          });
        }
      }
    };
  }
};
