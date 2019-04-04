'use strict';

var _jsxAstUtils = require('jsx-ast-utils');

var _schemas = require('../util/schemas');

/**
 * @fileoverview Performs validity check on anchor hrefs. Warns when anchors are used as buttons.
 * @author Almero Steyn
 * 
 */

// ----------------------------------------------------------------------------
// Rule Definition
// ----------------------------------------------------------------------------

var allAspects = ['noHref', 'invalidHref', 'preferButton'];

var preferButtonErrorMessage = 'Anchor used as a button. ' + 'Anchors are primarily expected to navigate. ' + 'Use the button element instead.';

var noHrefErrorMessage = 'The href attribute is required on an anchor. ' + 'Provide a valid, navigable address as the href value.';

var invalidHrefErrorMessage = 'The href attribute requires a valid address. ' + 'Provide a valid, navigable address as the href value.';

var schema = (0, _schemas.generateObjSchema)({
  components: _schemas.arraySchema,
  specialLink: _schemas.arraySchema,
  aspects: (0, _schemas.enumArraySchema)(allAspects, 1)
});

module.exports = {
  meta: {
    docs: {},
    schema: [schema]
  },

  create: function create(context) {
    return {
      JSXOpeningElement: function JSXOpeningElement(node) {
        var attributes = node.attributes;
        var options = context.options[0] || {};
        var componentOptions = options.components || [];
        var typeCheck = ['a'].concat(componentOptions);
        var nodeType = (0, _jsxAstUtils.elementType)(node);

        // Only check anchor elements and custom types.
        if (typeCheck.indexOf(nodeType) === -1) {
          return;
        }

        // Set up the rule aspects to check.
        var aspects = options.aspects || allAspects;

        // Create active aspect flag object. Failing checks will only report
        // if the related flag is set to true.
        var activeAspects = {};
        allAspects.forEach(function (aspect) {
          activeAspects[aspect] = aspects.indexOf(aspect) !== -1;
        });

        var propOptions = options.specialLink || [];
        var propsToValidate = ['href'].concat(propOptions);
        var values = propsToValidate.map(function (prop) {
          return (0, _jsxAstUtils.getProp)(node.attributes, prop);
        }).map(function (prop) {
          return (0, _jsxAstUtils.getPropValue)(prop);
        });
        // Checks if any actual or custom href prop is provided.
        var hasAnyHref = values.filter(function (value) {
          return value === undefined || value === null;
        }).length !== values.length;
        // Need to check for spread operator as props can be spread onto the element
        // leading to an incorrect validation error.
        var hasSpreadOperator = attributes.filter(function (prop) {
          return prop.type === 'JSXSpreadAttribute';
        }).length > 0;
        var onClick = (0, _jsxAstUtils.getProp)(attributes, 'onClick');

        // When there is no href at all, specific scenarios apply:
        if (!hasAnyHref) {
          // If no spread operator is found and no onClick event is present
          // it is a link without href.
          if (!hasSpreadOperator && activeAspects.noHref && (!onClick || onClick && !activeAspects.preferButton)) {
            context.report({
              node: node,
              message: noHrefErrorMessage
            });
          }
          // If no spread operator is found but an onClick is preset it should be a button.
          if (!hasSpreadOperator && onClick && activeAspects.preferButton) {
            context.report({
              node: node,
              message: preferButtonErrorMessage
            });
          }
          return;
        }

        // Hrefs have been found, now check for validity.
        var invalidHrefValues = values.filter(function (value) {
          return value !== undefined && value !== null;
        }).filter(function (value) {
          return typeof value === 'string' && (!value.length || value === '#' || /^\W*?javascript/.test(value));
        });
        if (invalidHrefValues.length !== 0) {
          // If an onClick is found it should be a button, otherwise it is an invalid link.
          if (onClick && activeAspects.preferButton) {
            context.report({
              node: node,
              message: preferButtonErrorMessage
            });
          } else if (activeAspects.invalidHref) {
            context.report({
              node: node,
              message: invalidHrefErrorMessage
            });
          }
        }
      }
    };
  }
};