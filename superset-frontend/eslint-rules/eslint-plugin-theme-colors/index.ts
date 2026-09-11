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

import type { Rule } from 'eslint';
import type { Node, SourceLocation } from 'estree';

import COLOR_KEYWORDS from './colors';

function hasHexColor(quasi: string): boolean {
  const regex = /#([a-f0-9]{3}|[a-f0-9]{4}(?:[a-f0-9]{2}){0,2})\b/gi;
  return !!quasi.match(regex);
}

function hasRgbColor(quasi: string): boolean {
  const regex = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d+(?:\.\d+)?))?\)/i;
  return !!quasi.match(regex);
}

function hasLiteralColor(quasi: string, strict: boolean = false): boolean {
  // matches literal colors at the start or end of a CSS prop
  return COLOR_KEYWORDS.some((color: string) => {
    const regexColon = new RegExp(`: ${color}`);
    const regexSemicolon = new RegExp(` ${color};`);
    return (
      !!quasi.match(regexColon) ||
      !!quasi.match(regexSemicolon) ||
      (strict && quasi === color)
    );
  });
}

const WARNING_MESSAGE: string =
  'Theme color variables are preferred over rgb(a)/hex/literal colors';

//------------------------------------------------------------------------------
// Rule Definition
//------------------------------------------------------------------------------

interface TemplateElementNode {
  type: string;
  value?: { raw: string };
  loc?: SourceLocation | null;
  parent?: {
    type: string;
    parent?: { type: string; loc?: SourceLocation | null };
  };
}

interface LiteralNode {
  type: string;
  value?: unknown;
  loc?: SourceLocation | null;
  parent?: { type: string };
}

const plugin: { rules: Record<string, Rule.RuleModule> } = {
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
      create(context: Rule.RuleContext): Rule.RuleListener {
        const warned: string[] = [];
        return {
          TemplateElement(node: Node): void {
            const templateNode = node as TemplateElementNode;
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
                ...(loc && { loc: loc as SourceLocation }),
                message: WARNING_MESSAGE,
              });
              if (locId) {
                warned.push(locId);
              }
            }
          },
          Literal(node: Node): void {
            const literalNode = node as LiteralNode;
            const value = literalNode?.value;
            // Only process string literals (not numbers, booleans, null, or RegExp)
            if (typeof value !== 'string') {
              return;
            }
            const parent = literalNode?.parent as Node & {
              type: string;
              value?: Node;
            };
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
                ...(node.loc && { loc: node.loc as SourceLocation }),
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
};

module.exports = plugin;
