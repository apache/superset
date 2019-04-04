/**
 * @fileoverview Validate spacing before closing bracket in JSX.
 * @author ryym
 * @deprecated
 */
'use strict';

const getTokenBeforeClosingBracket = require('../util/getTokenBeforeClosingBracket');
const docsUrl = require('../util/docsUrl');
const log = require('../util/log');

let isWarnedForDeprecation = false;

// ------------------------------------------------------------------------------
// Rule Definition
// ------------------------------------------------------------------------------

module.exports = {
  meta: {
    deprecated: true,
    docs: {
      description: 'Validate spacing before closing bracket in JSX',
      category: 'Stylistic Issues',
      recommended: false,
      url: docsUrl('jsx-space-before-closing')
    },
    fixable: 'code',

    schema: [{
      enum: ['always', 'never']
    }]
  },

  create: function(context) {
    const configuration = context.options[0] || 'always';
    const sourceCode = context.getSourceCode();

    const NEVER_MESSAGE = 'A space is forbidden before closing bracket';
    const ALWAYS_MESSAGE = 'A space is required before closing bracket';

    // --------------------------------------------------------------------------
    // Public
    // --------------------------------------------------------------------------

    return {
      JSXOpeningElement: function(node) {
        if (!node.selfClosing) {
          return;
        }

        const leftToken = getTokenBeforeClosingBracket(node);
        const closingSlash = sourceCode.getTokenAfter(leftToken);

        if (leftToken.loc.end.line !== closingSlash.loc.start.line) {
          return;
        }

        if (configuration === 'always' && !sourceCode.isSpaceBetweenTokens(leftToken, closingSlash)) {
          context.report({
            loc: closingSlash.loc.start,
            message: ALWAYS_MESSAGE,
            fix: function(fixer) {
              return fixer.insertTextBefore(closingSlash, ' ');
            }
          });
        } else if (configuration === 'never' && sourceCode.isSpaceBetweenTokens(leftToken, closingSlash)) {
          context.report({
            loc: closingSlash.loc.start,
            message: NEVER_MESSAGE,
            fix: function(fixer) {
              const previousToken = sourceCode.getTokenBefore(closingSlash);
              return fixer.removeRange([previousToken.range[1], closingSlash.range[0]]);
            }
          });
        }
      },

      Program: function() {
        if (isWarnedForDeprecation) {
          return;
        }

        log('The react/jsx-space-before-closing rule is deprecated. ' +
            'Please use the react/jsx-tag-spacing rule with the ' +
            '"beforeSelfClosing" option instead.');
        isWarnedForDeprecation = true;
      }
    };
  }
};
