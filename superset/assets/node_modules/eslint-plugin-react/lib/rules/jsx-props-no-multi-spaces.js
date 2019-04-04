/**
 * @fileoverview Disallow multiple spaces between inline JSX props
 * @author Adrian Moennich
 */

'use strict';

const docsUrl = require('../util/docsUrl');

// ------------------------------------------------------------------------------
// Rule Definition
// ------------------------------------------------------------------------------

module.exports = {
  meta: {
    docs: {
      description: 'Disallow multiple spaces between inline JSX props',
      category: 'Stylistic Issues',
      recommended: false,
      url: docsUrl('jsx-props-no-multi-spaces')
    },
    fixable: 'code',
    schema: []
  },

  create: function (context) {
    const sourceCode = context.getSourceCode();

    function getPropName(propNode) {
      switch (propNode.type) {
        case 'JSXSpreadAttribute':
          return sourceCode.getText(propNode.argument);
        case 'JSXIdentifier':
          return propNode.name;
        case 'JSXMemberExpression':
          return `${getPropName(propNode.object)}.${propNode.property.name}`;
        default:
          return propNode.name.name;
      }
    }

    function checkSpacing(prev, node) {
      if (prev.loc.end.line !== node.loc.end.line) {
        return;
      }
      const between = sourceCode.text.slice(prev.range[1], node.range[0]);
      if (between !== ' ') {
        context.report({
          node: node,
          message: `Expected only one space between "${getPropName(prev)}" and "${getPropName(node)}"`,
          fix: function(fixer) {
            return fixer.replaceTextRange([prev.range[1], node.range[0]], ' ');
          }
        });
      }
    }

    return {
      JSXOpeningElement: function (node) {
        node.attributes.reduce((prev, prop) => {
          checkSpacing(prev, prop);
          return prop;
        }, node.name);
      }
    };
  }
};
