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

import type { Rule } from 'eslint';
import type { Node } from 'estree';

//------------------------------------------------------------------------------
// Rule Definition
//------------------------------------------------------------------------------

const plugin: { rules: Record<string, Rule.RuleModule> } = {
  rules: {
    'no-template-vars': {
      meta: {
        type: 'problem',
        docs: { description: 'Disallow variables in translation template strings' },
        schema: [],
      },
      create(context: Rule.RuleContext): Rule.RuleListener {
        function handler(node: Node): void {
          const callNode = node as Node & {
            arguments: Array<Node & { type: string; expressions?: Node[] }>;
          };
          // Check all arguments (e.g., tn has singular and plural templates)
          for (const arg of callNode.arguments ?? []) {
            if (
              arg.type === 'TemplateLiteral' &&
              (arg as Node & { expressions?: Node[] }).expressions?.length
            ) {
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
    'sentence-case-buttons': {
      meta: {
        type: 'suggestion',
        docs: { description: 'Enforce sentence case for button text in translations' },
        schema: [],
      },
      create(context: Rule.RuleContext): Rule.RuleListener {
        function isTitleCase(str: string): boolean {
          // Match "Delete Dataset", "Create Chart", etc. (2+ title-cased words)
          return /^[A-Z][a-z]+(\s+[A-Z][a-z]*)+$/.test(str);
        }

        function isButtonContext(node: Node & { parent?: Node }): boolean {
          const { parent } = node as Node & {
            parent?: Node & Record<string, unknown>;
          };
          if (!parent) return false;

          // Check for button-specific props
          if (parent.type === 'Property') {
            const key = (parent as unknown as { key: { name: string } }).key
              .name;
            return [
              'primaryButtonName',
              'secondaryButtonName',
              'confirmButtonText',
              'cancelButtonText',
            ].includes(key);
          }

          // Check for Button components
          // Cast to string because ESTree Node type doesn't include JSX types
          if ((parent.type as string) === 'JSXExpressionContainer') {
            const jsx = (parent as Node & { parent?: Node }).parent as
              | (Node & {
                  type: string;
                  openingElement?: { name: { name: string } };
                })
              | undefined;
            if ((jsx?.type as string) === 'JSXElement') {
              const elementName = jsx?.openingElement?.name.name;
              return elementName === 'Button';
            }
          }

          return false;
        }

        function handler(node: Node): void {
          const callNode = node as Node & {
            arguments: Array<Node & { type: string; value?: unknown }>;
          };
          // Check all string literal arguments (e.g., tn has singular and plural)
          for (const arg of callNode.arguments ?? []) {
            if (arg.type === 'Literal' && typeof arg.value === 'string') {
              const text = arg.value;

              if (
                isButtonContext(node as Node & { parent?: Node }) &&
                isTitleCase(text)
              ) {
                const sentenceCase = text
                  .toLowerCase()
                  .replace(/^\w/, (c: string) => c.toUpperCase());
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
};

module.exports = plugin;
