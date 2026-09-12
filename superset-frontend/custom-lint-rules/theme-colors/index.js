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
 * @fileoverview Rule to warn about literal colors
 * @author Apache
 */

import { eslintCompatPlugin } from '@oxlint/plugins';
import { COLOR_KEYWORDS } from './colors.js';

/**
 * @param {string} quasi
 * @returns {boolean}
 */
function hasHexColor(quasi) {
  const regex = /#([a-f0-9]{3}|[a-f0-9]{4}(?:[a-f0-9]{2}){0,2})\b/gi;
  return !!quasi.match(regex);
}

/**
 * @param {string} quasi
 * @returns {boolean}
 */
function hasRgbColor(quasi) {
  const regex = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d+(?:\.\d+)?))?\)/i;
  return !!quasi.match(regex);
}

/**
 * @param {string} quasi
 * @param {boolean} [strict=false]
 * @returns {boolean}
 */
function hasLiteralColor(quasi, strict = false) {
  // matches literal colors at the start or end of a CSS prop
  return COLOR_KEYWORDS.some(color => {
    const regexColon = new RegExp(`: ${color}`);
    const regexSemicolon = new RegExp(` ${color};`);
    return (
      !!quasi.match(regexColon) ||
      !!quasi.match(regexSemicolon) ||
      (strict && quasi === color)
    );
  });
}

/** @type {string} */
const WARNING_MESSAGE =
  'Theme color variables are preferred over rgb(a)/hex/literal colors';

//------------------------------------------------------------------------------
// Rule Definition
//------------------------------------------------------------------------------

/**
 * @typedef {Object} TemplateElementNode
 * @property {string} type
 * @property {Object} [value]
 * @property {string} [value.raw]
 * @property {Object} [loc]
 * @property {Object} [parent]
 * @property {string} [parent.type]
 * @property {Object} [parent.parent]
 * @property {string} [parent.parent.type]
 * @property {Object} [parent.parent.loc]
 */

/**
 * @typedef {Object} LiteralNode
 * @property {string} type
 * @property {unknown} [value]
 * @property {Object} [loc]
 * @property {Object} [parent]
 * @property {string} [parent.type]
 */

/** @type {{ rules: Record<string, import('oxlint').Rule.RuleModule> }} */
const plugin = eslintCompatPlugin({
  meta: {
    name: '@superset-ui/theme-colors',
  },
  rules: {
    'no-literal-colors': {
      meta: {
        type: 'suggestion',
        docs: {
          description:
            'Disallow literal color values; use theme colors instead',
        },
        schema: [],
      },
      /**
       * @param {import('oxlint').Rule.RuleContext} context
       * @returns {import('oxlint').Rule.RuleListener}
       */
      createOnce(context) {
        /** @type {string[]} */
        const warned = [];

        return {
          /**
           * @param {import('estree').Node} node
           * @returns {void}
           */
          TemplateElement(node) {
            /** @type {TemplateElementNode} */
            const templateNode = node;
            const rawValue = templateNode?.value?.raw;
            const isChildParentTagged =
              templateNode?.parent?.parent?.type === 'TaggedTemplateExpression';
            const isChildParentArrow =
              templateNode?.parent?.parent?.type === 'ArrowFunctionExpression';
            const isParentTemplateLiteral =
              templateNode?.parent?.type === 'TemplateLiteral';
            const loc = templateNode?.parent?.parent?.loc;
            const locId = loc && JSON.stringify(loc);
            const hasWarned = locId ? warned.includes(locId) : false;

            if (
              !hasWarned &&
              (isChildParentTagged ||
                (isChildParentArrow && isParentTemplateLiteral)) &&
              rawValue &&
              (hasLiteralColor(rawValue) ||
                hasHexColor(rawValue) ||
                hasRgbColor(rawValue))
            ) {
              context.report({
                node,
                ...(loc && { loc }),
                message: WARNING_MESSAGE,
              });
              if (locId) {
                warned.push(locId);
              }
            }
          },

          /**
           * @param {import('estree').Node} node
           * @returns {void}
           */
          Literal(node) {
            /** @type {LiteralNode} */
            const literalNode = node;
            const value = literalNode?.value;

            // Only process string literals (not numbers, booleans, null, or RegExp)
            if (typeof value !== 'string') {
              return;
            }

            const parent = literalNode?.parent;
            // Only check property values, not keys (e.g., { color: 'red' } not { red: 1 })
            const isPropertyValue =
              parent?.type === 'Property' && parent.value === node;
            const locId = node.loc ? JSON.stringify(node.loc) : null;
            const hasWarned = locId ? warned.includes(locId) : false;

            if (
              !hasWarned &&
              isPropertyValue &&
              (hasLiteralColor(value, true) ||
                hasHexColor(value) ||
                hasRgbColor(value))
            ) {
              context.report({
                node,
                ...(node.loc && { loc: node.loc }),
                message: WARNING_MESSAGE,
              });
              if (locId) {
                warned.push(locId);
              }
            }
          },
        };
      },
    },
  },
});

export default plugin;
