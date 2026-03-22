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

const fs = require('fs');
const path = require('path');
const glob = require('glob');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

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
 * Process a single file
 */
function processFile(filepath) {
  const code = fs.readFileSync(filepath, 'utf8');

  try {
    const ast = parser.parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript', 'decorators-legacy'],
      attachComments: true,
    });

    // Run all checks
    checkNoLiteralColors(ast, filepath);
    checkNoFaIcons(ast, filepath);
    checkI18nTemplates(ast, filepath);
    checkUntranslatedStrings(ast, filepath);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(
      `${YELLOW}⚠${RESET} Could not parse ${filepath}: ${error.message}`,
    );
    warningCount += 1;
  }
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
    /\/cypress\//,
    /\/cypress-base\//,
    /\/esm\//,
    /\/lib\//,
    /\/dist\//,
    /plugins\/legacy-/, // Legacy plugins can have old color patterns
    /\/vendor\//, // Third-party vendor code
    /spec\/fixtures\//, // Test fixtures
    /theme\/exampleThemes/, // Theme examples legitimately have colors
    /\/color\/utils/, // Color utility functions legitimately work with colors
    /\/theme\/utils/, // Theme utility functions legitimately work with colors
    /packages\/superset-ui-core\/src\/color\/index\.ts/, // Core brand color constants
  ];

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
        '**/cypress/**',
        '**/cypress-base/**',
        '**/esm/**', // Build artifacts
        '**/lib/**', // Build artifacts
        '**/dist/**', // Build artifacts
        'plugins/legacy-*/**', // Legacy plugins
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
    return;
  }

  // eslint-disable-next-line no-console
  console.log(`Checking ${files.length} files for Superset custom rules...\\n`);

  files.forEach(file => {
    // Resolve the file path
    const resolvedPath = path.resolve(file);
    if (fs.existsSync(resolvedPath)) {
      processFile(resolvedPath);
    } else if (fs.existsSync(file)) {
      processFile(file);
    }
  });

  // eslint-disable-next-line no-console
  console.log(`\\n${errorCount} errors, ${warningCount} warnings`);

  if (errorCount > 0) {
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  checkNoLiteralColors,
  checkNoFaIcons,
  checkI18nTemplates,
  checkUntranslatedStrings,
};
