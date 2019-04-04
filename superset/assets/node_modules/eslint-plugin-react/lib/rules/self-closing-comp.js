/**
 * @fileoverview Prevent extra closing tags for components without children
 * @author Yannick Croissant
 */
'use strict';

const docsUrl = require('../util/docsUrl');
const jsxUtil = require('../util/jsx');

// ------------------------------------------------------------------------------
// Rule Definition
// ------------------------------------------------------------------------------

const optionDefaults = {component: true, html: true};

module.exports = {
  meta: {
    docs: {
      description: 'Prevent extra closing tags for components without children',
      category: 'Stylistic Issues',
      recommended: false,
      url: docsUrl('self-closing-comp')
    },
    fixable: 'code',

    schema: [{
      type: 'object',
      properties: {
        component: {
          default: optionDefaults.component,
          type: 'boolean'
        },
        html: {
          default: optionDefaults.html,
          type: 'boolean'
        }
      },
      additionalProperties: false
    }]
  },

  create: function(context) {
    function isComponent(node) {
      return node.name && node.name.type === 'JSXIdentifier' && !jsxUtil.isDOMComponent(node);
    }

    function hasChildren(node) {
      const childrens = node.parent.children;
      if (
        !childrens.length ||
        (childrens.length === 1 && (childrens[0].type === 'Literal' || childrens[0].type === 'JSXText') && !childrens[0].value.replace(/(?!\xA0)\s/g, ''))
      ) {
        return false;
      }
      return true;
    }

    function isShouldBeSelfClosed(node) {
      const configuration = Object.assign({}, optionDefaults, context.options[0]);
      return (
        configuration.component && isComponent(node) ||
        configuration.html && jsxUtil.isDOMComponent(node)
      ) && !node.selfClosing && !hasChildren(node);
    }

    // --------------------------------------------------------------------------
    // Public
    // --------------------------------------------------------------------------

    return {

      JSXOpeningElement: function(node) {
        if (!isShouldBeSelfClosed(node)) {
          return;
        }
        context.report({
          node: node,
          message: 'Empty components are self-closing',
          fix: function(fixer) {
            // Represents the last character of the JSXOpeningElement, the '>' character
            const openingElementEnding = node.range[1] - 1;
            // Represents the last character of the JSXClosingElement, the '>' character
            const closingElementEnding = node.parent.closingElement.range[1];

            // Replace />.*<\/.*>/ with '/>'
            const range = [openingElementEnding, closingElementEnding];
            return fixer.replaceTextRange(range, ' />');
          }
        });
      }
    };
  }
};
