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

const COLOR_KEYWORDS = require('./colors');

function hasHexColor(quasi) {
  if (typeof quasi === 'string') {
    const regex = /#([a-f0-9]{3}|[a-f0-9]{4}(?:[a-f0-9]{2}){0,2})\b/gi;
    return !!quasi.match(regex);
  }
  return false;
}

function hasRgbColor(quasi) {
  if (typeof quasi === 'string') {
    const regex = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d+(?:\.\d+)?))?\)/i;
    return !!quasi.match(regex);
  }
  return false;
}

function hasLiteralColor(quasi, strict = false) {
  if (typeof quasi === 'string') {
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
  return false;
}

const WARNING_MESSAGE =
  'Theme color variables are preferred over rgb(a)/hex/literal colors';

//------------------------------------------------------------------------------
// Rule Definition
//------------------------------------------------------------------------------

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  rules: {
    'no-literal-colors': {
      create(context) {
        const warned = [];
        return {
          TemplateElement(node) {
            const rawValue = node?.value?.raw;
            const isChildParentTagged =
              node?.parent?.parent?.type === 'TaggedTemplateExpression';
            const isChildParentArrow =
              node?.parent?.parent?.type === 'ArrowFunctionExpression';
            const isParentTemplateLiteral =
              node?.parent?.type === 'TemplateLiteral';
            const loc = node?.parent?.parent?.loc;
            const locId = loc && JSON.stringify(loc);
            const hasWarned = warned.includes(locId);
            if (
              !hasWarned &&
              (isChildParentTagged ||
                (isChildParentArrow && isParentTemplateLiteral)) &&
              rawValue &&
              (hasLiteralColor(rawValue) ||
                hasHexColor(rawValue) ||
                hasRgbColor(rawValue))
            ) {
              context.report(node, loc, WARNING_MESSAGE);
              warned.push(locId);
            }
          },
          Literal(node) {
            const value = node?.value;
            const isParentProperty = node?.parent?.type === 'Property';
            const locId = JSON.stringify(node.loc);
            const hasWarned = warned.includes(locId);

            if (
              !hasWarned &&
              isParentProperty &&
              value &&
              (hasLiteralColor(value, true) ||
                hasHexColor(value) ||
                hasRgbColor(value))
            ) {
              context.report(node, node.loc, WARNING_MESSAGE);
              warned.push(locId);
            }
          },
        };
      },
    },
  },
};
