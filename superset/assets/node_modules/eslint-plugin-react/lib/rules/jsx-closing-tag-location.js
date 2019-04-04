/**
 * @fileoverview Validate closing tag location in JSX
 * @author Ross Solomon
 */
'use strict';

const astUtil = require('../util/ast');
const docsUrl = require('../util/docsUrl');

// ------------------------------------------------------------------------------
// Rule Definition
// ------------------------------------------------------------------------------
module.exports = {
  meta: {
    docs: {
      description: 'Validate closing tag location for multiline JSX',
      category: 'Stylistic Issues',
      recommended: false,
      url: docsUrl('jsx-closing-tag-location')
    },
    fixable: 'whitespace'
  },

  create: function(context) {
    return {
      JSXClosingElement: function(node) {
        if (!node.parent) {
          return;
        }

        const opening = node.parent.openingElement;
        if (opening.loc.start.line === node.loc.start.line) {
          return;
        }

        if (opening.loc.start.column === node.loc.start.column) {
          return;
        }

        let message;
        if (!astUtil.isNodeFirstInLine(context, node)) {
          message = 'Closing tag of a multiline JSX expression must be on its own line.';
        } else {
          message = 'Expected closing tag to match indentation of opening.';
        }

        context.report({
          node: node,
          loc: node.loc,
          message,
          fix: function(fixer) {
            const indent = Array(opening.loc.start.column + 1).join(' ');
            if (astUtil.isNodeFirstInLine(context, node)) {
              return fixer.replaceTextRange(
                [node.range[0] - node.loc.start.column, node.range[0]],
                indent
              );
            }

            return fixer.insertTextBefore(node, `\n${indent}`);
          }
        });
      }
    };
  }
};
