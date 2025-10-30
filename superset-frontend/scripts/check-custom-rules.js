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
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

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
    /\.stories\./,
    /\/demo\//,
    /\/examples\//,
    /\/color\/colorSchemes\//,
    /\/cypress\//,
    /\/cypress-base\//,
    /packages\/superset-ui-demo\//,
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
        'packages/superset-ui-demo/**', // Demo package
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

module.exports = { checkNoLiteralColors, checkNoFaIcons, checkI18nTemplates };
