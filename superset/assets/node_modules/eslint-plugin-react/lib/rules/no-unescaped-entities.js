/**
 * @fileoverview HTML special characters should be escaped.
 * @author Patrick Hayes
 */
'use strict';

const docsUrl = require('../util/docsUrl');

// ------------------------------------------------------------------------------
// Rule Definition
// ------------------------------------------------------------------------------

// NOTE: '<' and '{' are also problematic characters, but they do not need
// to be included here because it is a syntax error when these characters are
// included accidentally.
const DEFAULTS = ['>', '"', '\'', '}'];

module.exports = {
  meta: {
    docs: {
      description: 'Detect unescaped HTML entities, which might represent malformed tags',
      category: 'Possible Errors',
      recommended: true,
      url: docsUrl('no-unescaped-entities')
    },
    schema: [{
      type: 'object',
      properties: {
        forbid: {
          type: 'array',
          items: {
            type: 'string'
          }
        }
      },
      additionalProperties: false
    }]
  },

  create: function(context) {
    function reportInvalidEntity(node) {
      const configuration = context.options[0] || {};
      const entities = configuration.forbid || DEFAULTS;

      // HTML entites are already escaped in node.value (as well as node.raw),
      // so pull the raw text from context.getSourceCode()
      for (let i = node.loc.start.line; i <= node.loc.end.line; i++) {
        let rawLine = context.getSourceCode().lines[i - 1];
        let start = 0;
        let end = rawLine.length;
        if (i === node.loc.start.line) {
          start = node.loc.start.column;
        }
        if (i === node.loc.end.line) {
          end = node.loc.end.column;
        }
        rawLine = rawLine.substring(start, end);
        for (let j = 0; j < entities.length; j++) {
          for (let index = 0; index < rawLine.length; index++) {
            const c = rawLine[index];
            if (c === entities[j]) {
              context.report({
                loc: {line: i, column: start + index},
                message: 'HTML entities must be escaped.',
                node: node
              });
            }
          }
        }
      }
    }

    return {
      'Literal, JSXText': function(node) {
        if (node.parent.type === 'JSXElement') {
          reportInvalidEntity(node);
        }
      }
    };
  }
};
