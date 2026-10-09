#!/usr/bin/env node
/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

/**
 * Custom rule checker for Superset-specific linting patterns
 * Runs as a separate check without needing custom binaries
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import glob from 'glob';
import * as parser from '@babel/parser';
import traverseModule from '@babel/traverse';

const traverse = traverseModule.default;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ANSI color codes
const RED = '\x1B[31m';
const YELLOW = '\x1B[33m';
const RESET = '\x1B[0m';

let errorCount = 0;
let warningCount = 0;

/**
 * Check if a node has an eslint-disable comment
 */
function hasEslintDisable(path, ruleName = 'theme-colors/no-literal-colors') {
  const { node, parent } = path;

  // Check leadingComments on the node itself
  if (node.leadingComments) {
    const hasDisable = node.leadingComments.some(
      comment =>
        (comment.value.includes('eslint-disable-next-line') ||
          comment.value.includes('eslint-disable')) &&
        comment.value.includes(ruleName),
    );
    if (hasDisable) return true;
  }

  // Check leadingComments on parent nodes (for expressions in assignments, etc.)
  if (parent && parent.leadingComments) {
    const hasDisable = parent.leadingComments.some(
      comment =>
        (comment.value.includes('eslint-disable-next-line') ||
          comment.value.includes('eslint-disable')) &&
        comment.value.includes(ruleName),
    );
    if (hasDisable) return true;
  }

  // Check if parent is a statement with leading comments
  let current = path;
  while (current.parent) {
    current = current.parent;
    if (current.node && current.node.leadingComments) {
      const hasDisable = current.node.leadingComments.some(
        comment =>
          (comment.value.includes('eslint-disable-next-line') ||
            comment.value.includes('eslint-disable')) &&
          comment.value.includes(ruleName),
      );
      if (hasDisable) return true;
    }
  }

  return false;
}

/**
 * Check for literal color values (hex, rgb, rgba)
 */
function checkNoLiteralColors(ast, filepath) {
  const colorPatterns = [
    /^#[0-9A-Fa-f]{3,6}$/, // Hex colors
    /^rgb\(/, // RGB colors
    /^rgba\(/, // RGBA colors
  ];

  traverse(ast, {
    StringLiteral(path) {
      const { value } = path.node;
      if (colorPatterns.some(pattern => pattern.test(value))) {
        // Check if this line has an eslint-disable comment
        if (hasEslintDisable(path)) {
          return; // Skip this violation
        }

        // eslint-disable-next-line no-console
        console.error(
          `${RED}✖${RESET} ${filepath}: Literal color "${value}" found. Use theme colors instead.`,
        );
        errorCount += 1;
      }
    },
    // Check styled-components template literals
    TemplateLiteral(path) {
      path.node.quasis.forEach(quasi => {
        const value = quasi.value.raw;
        // Look for CSS color properties
        if (
          value.match(
            /(?:color|background|border-color|outline-color):\s*(#[0-9A-Fa-f]{3,6}|rgb|rgba)/,
          )
        ) {
          // Check if this line has an eslint-disable comment
          if (hasEslintDisable(path)) {
            return; // Skip this violation
          }

          // eslint-disable-next-line no-console
          console.error(
            `${RED}✖${RESET} ${filepath}: Literal color in styled component. Use theme colors instead.`,
          );
          errorCount += 1;
        }
      });
    },
  });
}

/**
 * Check for FontAwesome icon usage
 */
function checkNoFaIcons(ast, filepath) {
  traverse(ast, {
    ImportDeclaration(path) {
      const source = path.node.source.value;
      if (source.includes('@fortawesome') || source.includes('font-awesome')) {
        // eslint-disable-next-line no-console
        console.error(
          `${RED}✖${RESET} ${filepath}: FontAwesome import detected. Use @superset-ui/core/components/Icons instead.`,
        );
        errorCount += 1;
      }
    },
    JSXAttribute(path) {
      if (path.node.name.name === 'className') {
        const { value } = path.node;
        if (
          value &&
          value.type === 'StringLiteral' &&
          value.value.includes('fa-')
        ) {
          // eslint-disable-next-line no-console
          console.error(
            `${RED}✖${RESET} ${filepath}: FontAwesome class detected. Use Icons component instead.`,
          );
          errorCount += 1;
        }
      }
    },
  });
}

/**
 * App code (and plugins) must go through the @superset-ui/core/components
 * wrappers rather than importing from antd directly, so theming and behavior
 * stay centralized in one place. The wrapper packages themselves
 * (superset-ui-core, superset-core) are the legitimate exception -- they're
 * what the wrappers are built from -- and `theme/utils` files that introspect
 * antd's own design tokens are exempted the same way checkNoLiteralColors
 * already exempts that directory (there is no wrapper for "list antd's own
 * token names").
 */
const ANTD_DIRECT_IMPORT_EXEMPT = [
  /\/theme\/utils\//,
  /packages\/superset-ui-core\//,
  /packages\/superset-core\//,
];

function checkNoDirectAntdImports(ast, filepath) {
  if (ANTD_DIRECT_IMPORT_EXEMPT.some(pattern => pattern.test(filepath))) {
    return;
  }

  traverse(ast, {
    'ImportDeclaration|ExportNamedDeclaration|ExportAllDeclaration': function (
      path,
    ) {
      const source = path.node.source?.value ?? '';
      if (source === 'antd' || source.startsWith('antd/')) {
        if (hasEslintDisable(path, 'no-restricted-imports')) return;

        // eslint-disable-next-line no-console
        console.error(
          `${RED}✖${RESET} ${filepath}: Direct import from "${source}". ` +
            `Use the @superset-ui/core/components wrapper instead.`,
        );
        errorCount += 1;
      }
    },
  });
}

/**
 * Check for improper i18n template usage
 */
function checkI18nTemplates(ast, filepath) {
  traverse(ast, {
    CallExpression(path) {
      const { callee } = path.node;
      // Check for t() or tn() functions
      if (
        callee.type === 'Identifier' &&
        (callee.name === 't' || callee.name === 'tn')
      ) {
        const args = path.node.arguments;
        if (args.length > 0 && args[0].type === 'TemplateLiteral') {
          const templateLiteral = args[0];
          if (templateLiteral.expressions.length > 0) {
            // eslint-disable-next-line no-console
            console.error(
              `${RED}✖${RESET} ${filepath}: Template variables in t() function. Use parameterized messages instead.`,
            );
            errorCount += 1;
          }
        }
      }
    },
  });
}

/**
 * Check for eager t()/tn() calls in `label` / `description` properties of
 * config objects evaluated at module load (e.g., controlPanel files). The
 * translation is captured at module-evaluation time, before i18n has loaded,
 * and never updates when the user switches language. The fix is to wrap the
 * call in an arrow function: `label: () => t('Foo')`.
 *
 * Limited to controlPanel files because that's where this pattern is
 * problematic at scale; t() inside JSX or component bodies is evaluated at
 * render time and works fine.
 */
const EAGER_T_WATCHED_PROPS = new Set(['label', 'description']);

function checkEagerTranslationsInConfig(ast, filepath) {
  if (!/controlPanel\.(ts|tsx|js|jsx)$/.test(filepath)) return;

  traverse(ast, {
    ObjectProperty(path) {
      const { node } = path;
      if (node.computed || node.shorthand) return;

      const keyName =
        node.key.type === 'Identifier'
          ? node.key.name
          : node.key.type === 'StringLiteral'
            ? node.key.value
            : null;
      if (!keyName || !EAGER_T_WATCHED_PROPS.has(keyName)) return;

      const { value } = node;
      if (
        value.type !== 'CallExpression' ||
        value.callee.type !== 'Identifier' ||
        (value.callee.name !== 't' && value.callee.name !== 'tn')
      ) {
        return;
      }

      if (hasEslintDisable(path, 'i18n-strings/no-eager-t-in-config')) return;

      // Warn (not error) because there are many pre-existing violations.
      // The ESLint plugin provides an autofix so authors can sweep files
      // as they touch them. Promote to error once the codebase is clean.
      // eslint-disable-next-line no-console
      console.warn(
        `${YELLOW}⚠${RESET} ${filepath}:${node.loc?.start.line ?? '?'}: ` +
          `Eager \`${keyName}: ${value.callee.name}(...)\` is evaluated at ` +
          `module load, before i18n is initialized. Wrap in an arrow ` +
          `function: \`${keyName}: () => ${value.callee.name}(...)\`. ` +
          `Run \`eslint --fix\` to autofix.`,
      );
      warningCount += 1;
    },
  });
}

/**
 * Props that should contain translated strings
 */
const TRANSLATABLE_PROPS = new Set([
  'title',
  'placeholder',
  'label',
  'alt',
  'aria-label',
  'aria-placeholder',
  'aria-roledescription',
  'aria-valuetext',
]);

/**
 * Props that should NOT be checked for translation
 */
const IGNORED_PROPS = new Set([
  'className',
  'id',
  'name',
  'type',
  'role',
  'href',
  'src',
  'key',
  'data-test',
  'data-testid',
  'htmlFor',
  'target',
  'rel',
  'method',
  'action',
  'pattern',
  'accept',
  'autoComplete',
  'inputMode',
  'lang',
  'dir',
  'xmlns',
  'viewBox',
  'd',
  'fill',
  'stroke',
  'transform',
  'style',
  'dangerouslySetInnerHTML',
]);

/**
 * SQL keywords and technical terms that should not be translated
 */
const TECHNICAL_TERMS = new Set([
  // SQL keywords
  'SELECT',
  'FROM',
  'WHERE',
  'HAVING',
  'GROUP',
  'ORDER',
  'BY',
  'JOIN',
  'LEFT',
  'RIGHT',
  'INNER',
  'OUTER',
  'FULL',
  'CROSS',
  'ON',
  'AND',
  'OR',
  'NOT',
  'IN',
  'EXISTS',
  'BETWEEN',
  'LIKE',
  'IS',
  'NULL',
  'TRUE',
  'FALSE',
  'ASC',
  'DESC',
  'LIMIT',
  'OFFSET',
  'UNION',
  'ALL',
  'DISTINCT',
  'AS',
  'CASE',
  'WHEN',
  'THEN',
  'ELSE',
  'END',
  'CAST',
  'CONVERT',
  // SQL date functions (common in Superset)
  'DATETIME',
  'DATEADD',
  'DATETRUNC',
  'LASTDAY',
  'HOLIDAY',
  'DATE',
  'TIME',
  'TIMESTAMP',
  'YEAR',
  'MONTH',
  'DAY',
  'HOUR',
  'MINUTE',
  'SECOND',
  'WEEK',
  // Data types
  'JSON',
  'XML',
  'CSV',
  'INT',
  'INTEGER',
  'FLOAT',
  'DOUBLE',
  'VARCHAR',
  'CHAR',
  'TEXT',
  'BOOLEAN',
  'BOOL',
  'BIGINT',
  'SMALLINT',
  'DECIMAL',
  // Technical abbreviations
  'SQL',
  'API',
  'URL',
  'URI',
  'HTML',
  'CSS',
  'JS',
  'TS',
  'ID',
  'UUID',
  'HTTP',
  'HTTPS',
  'GET',
  'POST',
  'PUT',
  'DELETE',
  'PATCH',
  // Error/status indicators that are typically not translated
  'OK',
  'ERROR',
  'WARNING',
  'INFO',
  'DEBUG',
  'N/A',
  'TBD',
]);

/**
 * Check if a string looks like it needs translation
 * Returns false for technical strings, identifiers, etc.
 */
function needsTranslation(value) {
  if (typeof value !== 'string') return false;

  const trimmed = value.trim();

  // Empty or whitespace-only strings don't need translation
  if (!trimmed) return false;

  // Single characters don't need translation
  if (trimmed.length === 1) return false;

  // Pure numbers don't need translation
  if (/^-?\d+\.?\d*$/.test(trimmed)) return false;

  // Punctuation-only strings don't need translation
  if (/^[^\w\s]+$/.test(trimmed)) return false;

  // URLs and paths don't need translation
  if (/^(https?:\/\/|\/|\.\/|\.\.\/)/.test(trimmed)) return false;

  // File extensions don't need translation
  if (/^\.\w+$/.test(trimmed)) return false;

  // CSS-like values (colors, sizes, etc.)
  if (
    /^(#[0-9a-f]+|\d+(%|px|em|rem|vh|vw|pt|cm|mm|in)|none|auto|inherit|initial|unset)$/i.test(
      trimmed,
    )
  )
    return false;

  // camelCase or PascalCase identifiers (likely code, not user text)
  if (/^[a-z][a-zA-Z0-9]*$/.test(trimmed) && /[A-Z]/.test(trimmed))
    return false;

  // snake_case or SCREAMING_SNAKE_CASE identifiers
  if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmed) && trimmed.includes('_'))
    return false;

  // kebab-case identifiers (CSS classes, data attributes)
  if (/^[a-z][a-z0-9-]*$/.test(trimmed) && trimmed.includes('-')) return false;

  // Looks like a variable or placeholder pattern
  if (/^[%$]\w+$/.test(trimmed) || /^\{\{?\w+\}?\}$/.test(trimmed))
    return false;

  // Very short strings (2-3 chars) that are all lowercase are likely codes
  if (trimmed.length <= 3 && /^[a-z]+$/.test(trimmed)) return false;

  // Single lowercase words up to 10 chars are often icon names or technical terms
  // (e.g., "check", "stop", "down", "empty", "starred")
  if (/^[a-z]+$/.test(trimmed) && trimmed.length <= 10) return false;

  // Code fragments (contains = or other code syntax)
  if (/[=<>{}[\]]/.test(trimmed)) return false;

  // ALL_CAPS words are usually technical terms (SQL keywords, constants)
  if (/^[A-Z][A-Z0-9]*$/.test(trimmed)) return false;

  // Known technical terms
  if (TECHNICAL_TERMS.has(trimmed.toUpperCase())) return false;

  // Code-like patterns: function calls, SQL syntax examples
  if (/^[a-zA-Z]+\s*\([^)]*\)/.test(trimmed)) return false;

  // SQL-like syntax: "SELECT * FROM", "GROUP BY", etc.
  if (/^(SELECT|FROM|WHERE|GROUP|ORDER|HAVING)\s/i.test(trimmed)) return false;

  // Date format patterns (strftime, moment.js, etc.)
  if (/^%[YymdHMSjWwUzZ%-]+$/.test(trimmed)) return false;
  if (/^%[a-zA-Z][/%\-a-zA-Z]*$/.test(trimmed)) return false;

  // Format patterns with slashes/dashes (e.g., YYYY-MM-DD, mm/dd/yyyy)
  if (/^[YMDHhms/\-:. ]+$/i.test(trimmed) && /[YMDHhms]{2,}/i.test(trimmed))
    return false;

  // Strings ending with colon followed by technical content are often labels
  // But if it's just "Label:" with a space-containing label, it might need translation

  // Strings that are likely user-visible text (contains spaces or is a readable word)
  return (
    /\s/.test(trimmed) || /^[A-Z][a-z]+/.test(trimmed) || trimmed.length > 3
  );
}

/**
 * Check if a JSX expression is wrapped in t() or tn()
 */
function isWrappedInTranslation(node) {
  if (!node) return false;

  // Direct t() or tn() call
  if (node.type === 'CallExpression') {
    const { callee } = node;
    if (
      callee.type === 'Identifier' &&
      (callee.name === 't' || callee.name === 'tn')
    ) {
      return true;
    }
  }

  // JSX expression container with t() call
  if (node.type === 'JSXExpressionContainer') {
    return isWrappedInTranslation(node.expression);
  }

  return false;
}

/**
 * Check for untranslated user-facing strings
 */
function checkUntranslatedStrings(ast, filepath) {
  traverse(ast, {
    // Check JSX attributes for untranslated strings
    JSXAttribute(path) {
      const attrName =
        path.node.name.name ||
        (path.node.name.namespace
          ? `${path.node.name.namespace.name}:${path.node.name.name.name}`
          : null);

      if (!attrName) return;

      // Skip ignored props
      if (IGNORED_PROPS.has(attrName)) return;

      // Skip data-* and aria-* props that aren't in our translatable list
      if (attrName.startsWith('data-') && !TRANSLATABLE_PROPS.has(attrName))
        return;
      if (attrName.startsWith('aria-') && !TRANSLATABLE_PROPS.has(attrName))
        return;

      // Only check props that should be translated
      if (!TRANSLATABLE_PROPS.has(attrName)) return;

      const { value } = path.node;

      // String literal value
      if (value && value.type === 'StringLiteral') {
        if (needsTranslation(value.value)) {
          if (hasEslintDisable(path, 'i18n/no-untranslated-string')) {
            return;
          }
          // eslint-disable-next-line no-console
          console.error(
            `${RED}✖${RESET} ${filepath}: Untranslated string in "${attrName}" prop: "${value.value}". Wrap with t().`,
          );
          errorCount += 1;
        }
      }

      // JSX expression that's not a t() call
      if (value && value.type === 'JSXExpressionContainer') {
        const { expression } = value;
        if (
          expression.type === 'StringLiteral' &&
          needsTranslation(expression.value)
        ) {
          if (!isWrappedInTranslation(value)) {
            if (hasEslintDisable(path, 'i18n/no-untranslated-string')) {
              return;
            }
            // eslint-disable-next-line no-console
            console.error(
              `${RED}✖${RESET} ${filepath}: Untranslated string in "${attrName}" prop: "${expression.value}". Wrap with t().`,
            );
            errorCount += 1;
          }
        }
      }
    },

    // Check JSX text content
    JSXText(path) {
      const text = path.node.value.trim();

      if (needsTranslation(text)) {
        if (hasEslintDisable(path, 'i18n/no-untranslated-string')) {
          return;
        }
        // eslint-disable-next-line no-console
        console.error(
          `${RED}✖${RESET} ${filepath}: Untranslated JSX text: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}". Wrap with {t('...')}.`,
        );
        errorCount += 1;
      }
    },
  });
}

/**
 * Whether a node is a `userEvent.setup()` call.
 */
function isUserEventSetupCall(node) {
  return (
    !!node &&
    node.type === 'CallExpression' &&
    node.callee.type === 'MemberExpression' &&
    node.callee.object.type === 'Identifier' &&
    node.callee.object.name === 'userEvent' &&
    node.callee.property.type === 'Identifier' &&
    node.callee.property.name === 'setup'
  );
}

/**
 * Whether an identifier resolves to a `userEvent.setup()` session.
 *
 * Only a declarator initialized from the call counts. A session assigned
 * separately from its declaration (`let user; user = userEvent.setup()`) is not
 * recognized, and no test file uses that form.
 *
 * @returns true when `name` is bound to a user-event session in this scope
 */
function isUserEventSession(scope, name) {
  const binding = scope.getBinding(name);
  return (
    !!binding &&
    binding.path.node.type === 'VariableDeclarator' &&
    isUserEventSetupCall(binding.path.node.init)
  );
}

/**
 * Check that `userEvent` interactions are awaited.
 *
 * Every `@testing-library/user-event` API returns a promise, so a call used as a
 * bare statement is fire-and-forget: its events are still being dispatched when
 * the next query or assertion runs. That either charges the dispatch time to a
 * later `waitFor` budget or lets an assertion observe the state from before the
 * interaction, and both surface as flaky tests.
 *
 * Both call styles are checked: `userEvent.click(el)` and the session style,
 * `const user = userEvent.setup(); user.click(el)`. The session receiver is
 * resolved through the scope, so only a binding initialized from
 * `userEvent.setup()` is treated as one.
 *
 * Only bare expression statements are reported. A call whose promise is stored
 * or returned (`const pending = userEvent.click(el)`) is left alone, because it
 * may be awaited elsewhere. `userEvent.setup()` is itself exempt: it is
 * synchronous and returns a session object rather than a promise.
 */
function checkAwaitedUserEvent(ast, filepath) {
  traverse(ast, {
    ExpressionStatement(path) {
      const { expression } = path.node;
      if (
        expression.type !== 'CallExpression' ||
        expression.callee.type !== 'MemberExpression'
      ) {
        return;
      }
      const { object, property } = expression.callee;
      if (object.type !== 'Identifier' || property.type !== 'Identifier') {
        return;
      }
      if (
        object.name === 'userEvent'
          ? property.name === 'setup'
          : !isUserEventSession(path.scope, object.name)
      ) {
        return;
      }
      const line = path.node.loc ? path.node.loc.start.line : 0;
      // eslint-disable-next-line no-console
      console.error(
        `${RED}✖${RESET} ${filepath}:${line}: un-awaited ${object.name}.${property.name}(). ` +
          `user-event APIs return promises; await the call so its events are ` +
          `dispatched before the next query or assertion.`,
      );
      errorCount += 1;
    },
  });
}

/**
 * Parse a file, reporting an unparseable file as a warning.
 *
 * @returns the AST, or null when the file could not be parsed
 */
function parseFile(filepath) {
  try {
    return parser.parse(fs.readFileSync(filepath, 'utf8'), {
      sourceType: 'module',
      plugins: ['jsx', 'typescript', 'decorators-legacy'],
      attachComments: true,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(
      `${YELLOW}⚠${RESET} Could not parse ${filepath}: ${error.message}`,
    );
    warningCount += 1;
    return null;
  }
}

/**
 * Process a single file
 */
function processFile(filepath) {
  const ast = parseFile(filepath);
  if (!ast) {
    return;
  }

  // Run all checks
  checkNoLiteralColors(ast, filepath);
  checkNoFaIcons(ast, filepath);
  checkNoDirectAntdImports(ast, filepath);
  checkI18nTemplates(ast, filepath);
  checkEagerTranslationsInConfig(ast, filepath);
  checkUntranslatedStrings(ast, filepath);
}

/**
 * Process a single test file. The checks in `processFile` deliberately skip
 * tests, so the test-only rules run from here instead.
 */
function processTestFile(filepath) {
  const ast = parseFile(filepath);
  if (!ast) {
    return;
  }

  checkAwaitedUserEvent(ast, filepath);
}

/**
 * Application source trees that must be authored in TypeScript. Matches the
 * top-level `src/` directory as well as each package/plugin `src/` directory.
 */
const TS_ONLY_SOURCE_PATTERN =
  /^(src|packages\/[^/]+\/src|plugins\/[^/]+\/src)\//;

/**
 * Jest test and spec files, which the test-only rules apply to.
 */
const TEST_FILE_PATTERN = /\.(test|spec)\.(ts|tsx|js|jsx)$/;

/**
 * Enforce the TypeScript-only frontend convention: no `.js`/`.jsx` files may be
 * added under the application source trees (including test files). Build
 * artifacts and root-level config files (e.g. `.storybook/preview.jsx`,
 * `webpack.config.js`) live outside these trees and are intentionally allowed.
 *
 * @param {string[]} candidateFiles paths relative to `superset-frontend/`
 */
function checkTypeScriptOnlySource(candidateFiles) {
  candidateFiles.forEach(file => {
    if (TS_ONLY_SOURCE_PATTERN.test(file) && /\.(js|jsx)$/.test(file)) {
      // eslint-disable-next-line no-console
      console.error(
        `${RED}✗${RESET} ${file}: frontend source must be TypeScript. ` +
          `Rename to .ts/.tsx (the codebase is mid-migration to full ` +
          `TypeScript; no new .js/.jsx files in src/).`,
      );
      errorCount += 1;
    }
  });
}

/**
 * Main function
 */
function main() {
  const args = process.argv.slice(2);
  let files = args;

  // Define ignore patterns once
  const ignorePatterns = [
    /\.test\./,
    /\.spec\./,
    /\/test\//,
    /\/tests\//,
    /\/storybook\//,
    /^\.storybook\//, // .storybook directory at root
    /\.stories\./,
    /\/demo\//,
    /\/examples\//,
    /\/color\/colorSchemes\//,
    /\/esm\//,
    /\/lib\//,
    /\/dist\//,
    // formerly the legacy-* plugins; they keep old color patterns and
    // eager t() calls pending modernization
    /plugins\/plugin-chart-(calendar|chord|country-map|horizon|paired-t-test|parallel-coordinates|partition|world-map)\//,
    /plugin-chart-point-cluster-map\/src\/controlPanel/, // Data visualization color choices
    /\/vendor\//, // Third-party vendor code
    /spec\/fixtures\//, // Test fixtures
    /theme\/exampleThemes/, // Theme examples legitimately have colors
    /\/color\/utils/, // Color utility functions legitimately work with colors
    /\/theme\/utils/, // Theme utility functions legitimately work with colors
    /packages\/superset-ui-core\/src\/color\/index\.ts/, // Core brand color constants
  ];

  // Enforce TypeScript-only source. Run this on the raw file list (before the
  // ignore patterns below strip out tests/stories) so that e.g. a new
  // `*.test.jsx` is still rejected.
  const tsOnlyCandidates =
    args.length === 0
      ? glob.sync('{src,packages/*/src,plugins/*/src}/**/*.{js,jsx}', {
          ignore: [
            '**/node_modules/**',
            '**/esm/**',
            '**/lib/**',
            '**/dist/**',
          ],
        })
      : args.map(f => f.replace(/^superset-frontend\//, ''));
  checkTypeScriptOnlySource(tsOnlyCandidates);

  // Run the test-only rules. Like the TypeScript-only check above, this works
  // from the raw file list, because the ignore patterns below strip out tests.
  const testCandidates =
    args.length === 0
      ? glob.sync('**/*.{test,spec}.{ts,tsx,js,jsx}', {
          ignore: [
            '**/node_modules/**',
            '**/esm/**',
            '**/lib/**',
            '**/dist/**',
          ],
        })
      : args
          .map(f => f.replace(/^superset-frontend\//, ''))
          .filter(f => TEST_FILE_PATTERN.test(f));
  testCandidates.forEach(file => {
    const resolvedPath = path.resolve(file);
    if (fs.existsSync(resolvedPath)) {
      processTestFile(resolvedPath);
    } else if (fs.existsSync(file)) {
      processTestFile(file);
    }
  });

  // If no files specified, check all
  if (files.length === 0) {
    files = glob.sync('src/**/*.{ts,tsx,js,jsx}', {
      ignore: [
        '**/*.test.*',
        '**/*.spec.*',
        '**/test/**',
        '**/tests/**',
        '**/node_modules/**',
        '**/storybook/**',
        '**/*.stories.*',
        '**/demo/**',
        '**/examples/**',
        '**/color/colorSchemes/**', // Color scheme definitions legitimately contain colors
        '**/esm/**', // Build artifacts
        '**/lib/**', // Build artifacts
        '**/dist/**', // Build artifacts
        'plugins/legacy-*/**', // Legacy plugins
        'plugins/plugin-chart-point-cluster-map/src/controlPanel.*', // Data visualization color choices
        '**/vendor/**',
        'spec/fixtures/**',
        '**/theme/exampleThemes/**',
        '**/color/utils/**',
        '**/theme/utils/**',
        'packages/superset-ui-core/src/color/index.ts', // Core brand color constants
      ],
    });
  } else {
    // Filter to only JS/TS files and remove superset-frontend prefix
    files = files
      .filter(f => /\.(ts|tsx|js|jsx)$/.test(f))
      .map(f => f.replace(/^superset-frontend\//, ''))
      .filter(f => !ignorePatterns.some(pattern => pattern.test(f)));
  }

  if (files.length === 0) {
    // eslint-disable-next-line no-console
    console.log('No files to check.');
  } else {
    // eslint-disable-next-line no-console
    console.log(
      `Checking ${files.length} files for Superset custom rules...\n`,
    );

    files.forEach(file => {
      // Resolve the file path
      const resolvedPath = path.resolve(file);
      if (fs.existsSync(resolvedPath)) {
        processFile(resolvedPath);
      } else if (fs.existsSync(file)) {
        processFile(file);
      }
    });
  }

  // eslint-disable-next-line no-console
  console.log(`\n${errorCount} errors, ${warningCount} warnings`);

  if (errorCount > 0) {
    process.exit(1);
  }
}

// Run if called directly
if (__filename === process.argv[1]) {
  main();
}

export default {
  checkNoLiteralColors,
  checkNoFaIcons,
  checkNoDirectAntdImports,
  checkI18nTemplates,
  checkUntranslatedStrings,
  checkTypeScriptOnlySource,
  checkAwaitedUserEvent,
};
