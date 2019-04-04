/**
 * @fileoverview Runs `prettier` as an ESLint rule.
 * @author Andres Suarez
 */

'use strict';

// ------------------------------------------------------------------------------
//  Requirements
// ------------------------------------------------------------------------------

const diff = require('fast-diff');
const docblock = require('jest-docblock');

// ------------------------------------------------------------------------------
//  Constants
// ------------------------------------------------------------------------------

// Preferred Facebook style.
const FB_PRETTIER_OPTIONS = {
  singleQuote: true,
  trailingComma: 'all',
  bracketSpacing: false,
  jsxBracketSameLine: true,
  parser: 'flow'
};

const LINE_ENDING_RE = /\r\n|[\r\n\u2028\u2029]/;

const OPERATION_INSERT = 'insert';
const OPERATION_DELETE = 'delete';
const OPERATION_REPLACE = 'replace';

// ------------------------------------------------------------------------------
//  Privates
// ------------------------------------------------------------------------------

// Lazily-loaded Prettier.
let prettier;

// ------------------------------------------------------------------------------
//  Helpers
// ------------------------------------------------------------------------------

/**
 * Gets the location of a given index in the source code for a given context.
 * @param {RuleContext} context - The ESLint rule context.
 * @param {number} index - An index in the source code.
 * @returns {Object} An object containing numeric `line` and `column` keys.
 */
function getLocFromIndex(context, index) {
  // If `sourceCode.getLocFromIndex` is available from ESLint, use it - added
  // in ESLint 3.16.0.
  const sourceCode = context.getSourceCode();
  if (typeof sourceCode.getLocFromIndex === 'function') {
    return sourceCode.getLocFromIndex(index);
  }
  const text = sourceCode.getText();
  if (typeof index !== 'number') {
    throw new TypeError('Expected `index` to be a number.');
  }
  if (index < 0 || index > text.length) {
    throw new RangeError('Index out of range.');
  }
  // Loosely based on
  // https://github.com/eslint/eslint/blob/18a519fa/lib/ast-utils.js#L408-L438
  const lineEndingPattern = /\r\n|[\r\n\u2028\u2029]/g;
  let offset = 0;
  let line = 0;
  let match;
  while ((match = lineEndingPattern.exec(text))) {
    const next = match.index + match[0].length;
    if (index < next) {
      break;
    }
    line++;
    offset = next;
  }
  return {
    line: line + 1,
    column: index - offset
  };
}

/**
 * Converts invisible characters to a commonly recognizable visible form.
 * @param {string} str - The string with invisibles to convert.
 * @returns {string} The converted string.
 */
function showInvisibles(str) {
  let ret = '';
  for (let i = 0; i < str.length; i++) {
    switch (str[i]) {
      case ' ':
        ret += '·'; // Middle Dot, \u00B7
        break;
      case '\n':
        ret += '⏎'; // Return Symbol, \u23ce
        break;
      case '\t':
        ret += '↹'; // Left Arrow To Bar Over Right Arrow To Bar, \u21b9
        break;
      case '\r':
        ret += '␍'; // Carriage Return Symbol, \u240D
        break;
      default:
        ret += str[i];
        break;
    }
  }
  return ret;
}

/**
 * Generate results for differences between source code and formatted version.
 * @param {string} source - The original source.
 * @param {string} prettierSource - The Prettier formatted source.
 * @returns {Array} - An array contains { operation, offset, insertText, deleteText }
 */
function generateDifferences(source, prettierSource) {
  // fast-diff returns the differences between two texts as a series of
  // INSERT, DELETE or EQUAL operations. The results occur only in these
  // sequences:
  //           /-> INSERT -> EQUAL
  //    EQUAL |           /-> EQUAL
  //           \-> DELETE |
  //                      \-> INSERT -> EQUAL
  // Instead of reporting issues at each INSERT or DELETE, certain sequences
  // are batched together and are reported as a friendlier "replace" operation:
  // - A DELETE immediately followed by an INSERT.
  // - Any number of INSERTs and DELETEs where the joining EQUAL of one's end
  // and another's beginning does not have line endings (i.e. issues that occur
  // on contiguous lines).

  const results = diff(source, prettierSource);
  const differences = [];

  const batch = [];
  let offset = 0; // NOTE: INSERT never advances the offset.
  while (results.length) {
    const result = results.shift();
    const op = result[0];
    const text = result[1];
    switch (op) {
      case diff.INSERT:
      case diff.DELETE:
        batch.push(result);
        break;
      case diff.EQUAL:
        if (results.length) {
          if (batch.length) {
            if (LINE_ENDING_RE.test(text)) {
              flush();
              offset += text.length;
            } else {
              batch.push(result);
            }
          } else {
            offset += text.length;
          }
        }
        break;
      default:
        throw new Error(`Unexpected fast-diff operation "${op}"`);
    }
    if (batch.length && !results.length) {
      flush();
    }
  }

  return differences;

  function flush() {
    let aheadDeleteText = '';
    let aheadInsertText = '';
    while (batch.length) {
      const next = batch.shift();
      const op = next[0];
      const text = next[1];
      switch (op) {
        case diff.INSERT:
          aheadInsertText += text;
          break;
        case diff.DELETE:
          aheadDeleteText += text;
          break;
        case diff.EQUAL:
          aheadDeleteText += text;
          aheadInsertText += text;
          break;
      }
    }
    if (aheadDeleteText && aheadInsertText) {
      differences.push({
        offset,
        operation: OPERATION_REPLACE,
        insertText: aheadInsertText,
        deleteText: aheadDeleteText
      });
    } else if (!aheadDeleteText && aheadInsertText) {
      differences.push({
        offset,
        operation: OPERATION_INSERT,
        insertText: aheadInsertText
      });
    } else if (aheadDeleteText && !aheadInsertText) {
      differences.push({
        offset,
        operation: OPERATION_DELETE,
        deleteText: aheadDeleteText
      });
    }
    offset += aheadDeleteText.length;
  }
}

// ------------------------------------------------------------------------------
//  Rule Definition
// ------------------------------------------------------------------------------

/**
 * Reports an "Insert ..." issue where text must be inserted.
 * @param {RuleContext} context - The ESLint rule context.
 * @param {number} offset - The source offset where to insert text.
 * @param {string} text - The text to be inserted.
 * @returns {void}
 */
function reportInsert(context, offset, text) {
  const pos = getLocFromIndex(context, offset);
  const range = [offset, offset];
  context.report({
    message: 'Insert `{{ code }}`',
    data: { code: showInvisibles(text) },
    loc: { start: pos, end: pos },
    fix(fixer) {
      return fixer.insertTextAfterRange(range, text);
    }
  });
}

/**
 * Reports a "Delete ..." issue where text must be deleted.
 * @param {RuleContext} context - The ESLint rule context.
 * @param {number} offset - The source offset where to delete text.
 * @param {string} text - The text to be deleted.
 * @returns {void}
 */
function reportDelete(context, offset, text) {
  const start = getLocFromIndex(context, offset);
  const end = getLocFromIndex(context, offset + text.length);
  const range = [offset, offset + text.length];
  context.report({
    message: 'Delete `{{ code }}`',
    data: { code: showInvisibles(text) },
    loc: { start, end },
    fix(fixer) {
      return fixer.removeRange(range);
    }
  });
}

/**
 * Reports a "Replace ... with ..." issue where text must be replaced.
 * @param {RuleContext} context - The ESLint rule context.
 * @param {number} offset - The source offset where to replace deleted text
 with inserted text.
 * @param {string} deleteText - The text to be deleted.
 * @param {string} insertText - The text to be inserted.
 * @returns {void}
 */
function reportReplace(context, offset, deleteText, insertText) {
  const start = getLocFromIndex(context, offset);
  const end = getLocFromIndex(context, offset + deleteText.length);
  const range = [offset, offset + deleteText.length];
  context.report({
    message: 'Replace `{{ deleteCode }}` with `{{ insertCode }}`',
    data: {
      deleteCode: showInvisibles(deleteText),
      insertCode: showInvisibles(insertText)
    },
    loc: { start, end },
    fix(fixer) {
      return fixer.replaceTextRange(range, insertText);
    }
  });
}

/**
 * Get the pragma from the ESLint rule context.
 * @param {RuleContext} context - The ESLint rule context.
 * @returns {string|null}
 */
function getPragma(context) {
  const pluginOptions = context.options[1];

  if (!pluginOptions) {
    return null;
  }

  const pragmaRef =
    typeof pluginOptions === 'string' ? pluginOptions : pluginOptions.pragma;

  // Remove leading @
  return pragmaRef ? pragmaRef.slice(1) : null;
}

// ------------------------------------------------------------------------------
//  Module Definition
// ------------------------------------------------------------------------------

module.exports = {
  showInvisibles,
  generateDifferences,
  configs: {
    recommended: {
      extends: ['prettier'],
      plugins: ['prettier'],
      rules: {
        'prettier/prettier': 'error'
      }
    }
  },
  rules: {
    prettier: {
      meta: {
        docs: {
          url: 'https://github.com/prettier/eslint-plugin-prettier#options'
        },
        fixable: 'code',
        schema: [
          // Prettier options:
          {
            anyOf: [
              { enum: [null, 'fb'] },
              { type: 'object', properties: {}, additionalProperties: true }
            ]
          },
          {
            anyOf: [
              // Pragma:
              { type: 'string', pattern: '^@\\w+$' },
              {
                type: 'object',
                properties: {
                  pragma: { type: 'string', pattern: '^@\\w+$' },
                  usePrettierrc: { type: 'boolean' }
                },
                additionalProperties: true
              }
            ]
          }
        ]
      },
      create(context) {
        const pragma = getPragma(context);
        const usePrettierrc =
          !context.options[1] || context.options[1].usePrettierrc !== false;
        const sourceCode = context.getSourceCode();
        const filepath = context.getFilename();
        const source = sourceCode.text;

        // The pragma is only valid if it is found in a block comment at the very
        // start of the file.
        if (pragma) {
          // ESLint 3.x reports the shebang as a "Line" node, while ESLint 4.x
          // reports it as a "Shebang" node. This works for both versions:
          const hasShebang = source.startsWith('#!');
          const allComments = sourceCode.getAllComments();
          const firstComment = hasShebang ? allComments[1] : allComments[0];
          if (
            !(
              firstComment &&
              firstComment.type === 'Block' &&
              firstComment.loc.start.line === (hasShebang ? 2 : 1) &&
              firstComment.loc.start.column === 0
            )
          ) {
            return {};
          }
          const parsed = docblock.parse(firstComment.value);
          if (parsed[pragma] !== '') {
            return {};
          }
        }

        if (prettier && prettier.clearConfigCache) {
          prettier.clearConfigCache();
        }

        return {
          Program() {
            if (!prettier) {
              // Prettier is expensive to load, so only load it if needed.
              prettier = require('prettier');
            }

            const eslintPrettierOptions =
              context.options[0] === 'fb'
                ? FB_PRETTIER_OPTIONS
                : context.options[0];

            const prettierRcOptions =
              usePrettierrc &&
              prettier.resolveConfig &&
              prettier.resolveConfig.sync
                ? prettier.resolveConfig.sync(filepath, {
                    editorconfig: true
                  })
                : null;

            // prettier.getFileInfo was added in v1.13
            const prettierFileInfo =
              prettier.getFileInfo && prettier.getFileInfo.sync
                ? prettier.getFileInfo.sync(filepath, {
                    ignorePath: '.prettierignore'
                  })
                : { ignored: false, inferredParser: null };

            // Skip if file is ignored using a .prettierignore file
            if (prettierFileInfo.ignored) {
              return;
            }

            const initialOptions = {};

            // ESLint suppports processors that let you extract and lint JS
            // fragments within a non-JS language. In the cases where prettier
            // supports the same language as a processor, we want to process
            // the provided source code as javascript (as ESLint provides the
            // rules with fragments of JS) instead of guessing the parser
            // based off the filename. Otherwise, for instance, on a .md file we
            // end up trying to run prettier over a fragment of JS using the
            // markdown parser, which throws an error.
            // If we can't infer the parser from from the filename, either
            // because no filename was provided or because there is no parser
            // found for the filename, use javascript.
            // This is added to the options first, so that
            // prettierRcOptions and eslintPrettierOptions can still override
            // the parser.
            //
            // `parserBlocklist` should contain the list of prettier parser
            // names for file types where:
            // * Prettier supports parsing the file type
            // * There is an ESLint processor that extracts JavaScript snippets
            //   from the file type.
            const parserBlocklist = [null, 'graphql', 'markdown', 'html'];
            if (
              parserBlocklist.indexOf(prettierFileInfo.inferredParser) !== -1
            ) {
              initialOptions.parser = 'babylon';
            }

            const prettierOptions = Object.assign(
              {},
              initialOptions,
              prettierRcOptions,
              eslintPrettierOptions,
              { filepath }
            );

            const prettierSource = prettier.format(source, prettierOptions);
            if (source !== prettierSource) {
              const differences = generateDifferences(source, prettierSource);

              differences.forEach(difference => {
                switch (difference.operation) {
                  case OPERATION_INSERT:
                    reportInsert(
                      context,
                      difference.offset,
                      difference.insertText
                    );
                    break;
                  case OPERATION_DELETE:
                    reportDelete(
                      context,
                      difference.offset,
                      difference.deleteText
                    );
                    break;
                  case OPERATION_REPLACE:
                    reportReplace(
                      context,
                      difference.offset,
                      difference.deleteText,
                      difference.insertText
                    );
                    break;
                }
              });
            }
          }
        };
      }
    }
  }
};
