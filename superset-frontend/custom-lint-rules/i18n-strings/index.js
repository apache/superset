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
 * @fileoverview Rule to warn about translation template variables
 * @author Apache
 */

//------------------------------------------------------------------------------
// Rule Definition
//------------------------------------------------------------------------------

import { eslintCompatPlugin } from '@oxlint/plugins';

/** @type {{ rules: Record<string, import('oxlint').Rule.RuleModule> }} */
const plugin = eslintCompatPlugin({
  meta: {
    name: '@superset-ui/i18n-strings',
  },
  rules: {
    'no-template-vars': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Disallow variables in translation template strings',
        },
        schema: [],
      },
      /** @param {import('eslint').Rule.RuleContext} context */
      createOnce(context) {
        /** @param {import('estree').Node} node */
        function handler(node) {
          /**
           * @type {import('estree').Node & {
           *   arguments: Array<import('estree').Node & {
           *     type: string;
           *     expressions?: import('estree').Node[];
           *   }>;
           * }}
           */
          const callNode = node;
          // Check all arguments (e.g., tn has singular and plural templates)
          for (const arg of callNode.arguments ?? []) {
            if (arg.type === 'TemplateLiteral' && arg.expressions?.length) {
              context.report({
                node,
                message:
                  "Don't use variables in translation string templates. Flask-babel is a static translation service, so it can't handle strings that include variables",
              });
              break; // Only report once per call
            }
          }
        }
        return {
          "CallExpression[callee.name='t']": handler,
          "CallExpression[callee.name='tn']": handler,
        };
      },
    },
    'no-eager-t-in-config': {
      meta: {
        type: 'problem',
        fixable: 'code',
        docs: {
          description:
            'Disallow eager t()/tn() calls for `label` and `description` in config objects evaluated at module load (e.g., controlPanel files). The translation is captured at module-evaluation time, before i18n has loaded, and never updates when the user switches language. Wrap the call in an arrow function so it is evaluated at render time.',
        },
        schema: [
          {
            type: 'object',
            properties: {
              properties: {
                type: 'array',
                items: { type: 'string' },
              },
            },
            additionalProperties: false,
          },
        ],
        messages: {
          eager:
            'Eager `{{property}}: {{fn}}(...)` is evaluated at module load, before i18n is initialized. Wrap in an arrow function: `{{property}}: () => {{fn}}(...)`.',
        },
      },
      /** @param {import('oxlint').Rule.RuleContext} context */
      createOnce(context) {
        /** @type {string[]} */
        const watchedProps = context?.options?.[0]?.properties ?? [
          'label',
          'description',
        ];
        const TRANSLATE_FNS = new Set(['t', 'tn']);

        /** @param {import('estree').Node} node */
        function handler(node) {
          /**
           * @type {import('estree').Node & {
           *   key: { type: string; name?: string; value?: string };
           *   value: import('estree').Node & {
           *     type: string;
           *     callee?: { type: string; name?: string };
           *   };
           *   shorthand?: boolean;
           *   computed?: boolean;
           * }}
           */
          const prop = node;
          if (prop.shorthand || prop.computed) return;

          const keyName =
            prop.key.type === 'Identifier'
              ? prop.key.name
              : prop.key.type === 'Literal'
                ? prop.key.value
                : undefined;
          if (typeof keyName !== 'string' || !watchedProps.includes(keyName)) {
            return;
          }

          const callee = prop.value;
          if (
            callee.type !== 'CallExpression' ||
            callee.callee?.type !== 'Identifier' ||
            !callee.callee.name ||
            !TRANSLATE_FNS.has(callee.callee.name)
          ) {
            return;
          }

          context.report({
            node: prop.value,
            messageId: 'eager',
            data: { property: keyName, fn: callee.callee.name },
            fix(fixer) {
              const source = context.sourceCode.getText(prop.value);
              return fixer.replaceText(prop.value, `() => ${source}`);
            },
          });
        }

        return {
          Property: handler,
        };
      },
    },
    'sentence-case-buttons': {
      meta: {
        type: 'suggestion',
        docs: {
          description: 'Enforce sentence case for button text in translations',
        },
        schema: [],
      },
      /** @param {import('oxlint').Rule.RuleContext} context */
      createOnce(context) {
        /** @param {string} str */
        function isTitleCase(str) {
          // Match "Delete Dataset", "Create Chart", etc. (2+ title-cased words)
          return /^[A-Z][a-z]+(\s+[A-Z][a-z]*)+$/.test(str);
        }

        /** @param {import('estree').Node & { parent?: import('estree').Node }} node */
        function isButtonContext(node) {
          const { parent } = node;
          if (!parent) return false;

          // Check for button-specific props
          if (parent.type === 'Property') {
            const key =
              /** @type {{ key: { name: string } }} */ (parent).key.name;
            return [
              'primaryButtonName',
              'secondaryButtonName',
              'confirmButtonText',
              'cancelButtonText',
            ].includes(key);
          }

          // Check for Button components
          // Cast to string because ESTree Node type doesn't include JSX types
          if (parent.type === 'JSXExpressionContainer') {
            /**
             * @type {(import('estree').Node & {
             *   type: string;
             *   openingElement?: { name: { name: string } };
             * }) | undefined}
             */
            const jsx = parent.parent;
            if (jsx?.type === 'JSXElement') {
              const elementName = jsx?.openingElement?.name.name;
              return elementName === 'Button';
            }
          }

          return false;
        }

        /** @param {import('estree').Node} node */
        function handler(node) {
          /**
           * @type {import('estree').Node & {
           *   arguments: Array<import('estree').Node & {
           *     type: string;
           *     value?: unknown;
           *   }>;
           * }}
           */
          const callNode = node;
          // Check all string literal arguments (e.g., tn has singular and plural)
          for (const arg of callNode.arguments ?? []) {
            if (arg.type === 'Literal' && typeof arg.value === 'string') {
              const text = arg.value;

              if (isButtonContext(node) && isTitleCase(text)) {
                const sentenceCase = text
                  .toLowerCase()
                  .replace(/^\w/, c => c.toUpperCase());
                context.report({
                  node: arg,
                  message: `Button text should use sentence case: "${text}" should be "${sentenceCase}"`,
                });
              }
            }
          }
        }

        return {
          "CallExpression[callee.name='t']": handler,
          "CallExpression[callee.name='tn']": handler,
        };
      },
    },
  },
});

export default plugin;
