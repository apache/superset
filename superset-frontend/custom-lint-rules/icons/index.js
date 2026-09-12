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

import { eslintCompatPlugin } from '@oxlint/plugins';

/**
 * @fileoverview Rule to warn about direct imports from @ant-design/icons
 * @author Apache
 */

//------------------------------------------------------------------------------
// Rule Definition
//------------------------------------------------------------------------------

/**
 * @typedef {Object} JSXAttribute
 * @property {Object} [name]
 * @property {string} [name.name]
 * @property {Object} [value]
 * @property {string} [value.type]
 * @property {string} [value.value]
 * @property {Object} [value.expression]
 * @property {string} [value.expression.value]
 */

/**
 * @typedef {Object} JSXOpeningElement
 * @property {Object} name
 * @property {string} name.name
 * @property {JSXAttribute[]} attributes
 */

/**
 * @typedef {Object} JSXElementNode
 * @property {string} type
 * @property {JSXOpeningElement} openingElement
 */

/** @type {{ rules: Record<string, import('oxlint').Rule.RuleModule> }} */
const plugin = eslintCompatPlugin({
  meta: {
    name: '@superset-ui/icons',
  },
  rules: {
    'no-fa-icons-usage': {
      meta: {
        type: 'problem',
        docs: {
          description:
            'Disallow the usage of FontAwesome icons in the codebase',
          category: 'Best Practices',
        },
        schema: [],
      },
      /**
       * @param {import('oxlint').Rule.RuleContext} context
       * @returns {import('oxlint').Rule.RuleListener}
       */
      createOnce(context) {
        return {
          /**
           * Check for JSX elements with class names containing "fa"
           * @param {import('estree').Node} node
           * @returns {void}
           */
          JSXElement(node) {
            /** @type {JSXElementNode} */
            const jsxNode = node;
            if (
              jsxNode.openingElement &&
              jsxNode.openingElement.name.name === 'i' &&
              jsxNode.openingElement.attributes &&
              jsxNode.openingElement.attributes.some(attr => {
                if (attr.name?.name !== 'className') return false;
                // Handle className="fa fa-home"
                if (attr.value?.type === 'Literal') {
                  return /fa fa-/.test(attr.value.value ?? '');
                }
                // Handle className={'fa fa-home'}
                if (attr.value?.type === 'JSXExpressionContainer') {
                  return /fa fa-/.test(attr.value.expression?.value ?? '');
                }
                return false;
              })
            ) {
              context.report({
                node,
                message:
                  'FontAwesome icons should not be used. Use the src/components/Icons component instead.',
              });
            }
          },
        };
      },
    },
  },
});

export default plugin;
