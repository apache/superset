/**
 * @fileoverview Comments inside children section of tag should be placed inside braces.
 * @author Ben Vinegar
 */
'use strict';

const docsUrl = require('../util/docsUrl');

// ------------------------------------------------------------------------------
// Rule Definition
// ------------------------------------------------------------------------------

module.exports = {
  meta: {
    docs: {
      description: 'Comments inside children section of tag should be placed inside braces',
      category: 'Possible Errors',
      recommended: true,
      url: docsUrl('jsx-no-comment-textnodes')
    },

    schema: [{
      type: 'object',
      properties: {},
      additionalProperties: false
    }]
  },

  create: function(context) {
    function reportLiteralNode(node) {
      context.report(node, 'Comments inside children section of tag should be placed inside braces');
    }

    // --------------------------------------------------------------------------
    // Public
    // --------------------------------------------------------------------------

    return {
      Literal: function(node) {
        const sourceCode = context.getSourceCode();
        // since babel-eslint has the wrong node.raw, we'll get the source text
        const rawValue = sourceCode.getText(node);
        if (/^\s*\/(\/|\*)/m.test(rawValue)) {
          // inside component, e.g. <div>literal</div>
          if (node.parent.type !== 'JSXAttribute' &&
              node.parent.type !== 'JSXExpressionContainer' &&
              node.parent.type.indexOf('JSX') !== -1) {
            reportLiteralNode(node);
          }
        }
      }
    };
  }
};
