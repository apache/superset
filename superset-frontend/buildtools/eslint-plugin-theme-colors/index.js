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

const _ = require('lodash');
const COLOR_KEYWORDS = require('./colors');

function getObjectExpressionPropertyNodes(
  objectExpressionNode,
  propertyNodes = [],
) {
  _.each(objectExpressionNode.properties, propertyNode => {
    propertyNodes.push(propertyNode);

    if (propertyNode?.value?.type === 'ObjectExpression') {
      propertyNodes.concat(
        getObjectExpressionPropertyNodes(propertyNode.value, propertyNodes),
      );
    }
  });

  return propertyNodes;
}

function hasHexColor(quasi) {
  if (typeof quasi === 'string') {
    const regex = /#([a-f0-9]{3}|[a-f0-9]{4}(?:[a-f0-9]{2}){0,2})\b/gi;
    return quasi.match(regex);
  }

  return false;
}

function hasRgbColor(quasi) {
  if (typeof quasi === 'string') {
    const regex = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d+(?:\.\d+)?))?\)/i;
    return quasi.match(regex);
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
        quasi.match(regexColon) ||
        quasi.match(regexSemicolon) ||
        (strict && quasi === color)
      );
    });
  }
  return false;
}

const WARNING_MESSAGE =
  'Theme color variables are preferred over rgb(a)/hex/literal colors';
const parsedNodes = [];

//------------------------------------------------------------------------------
// Rule Definition
//------------------------------------------------------------------------------

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  rules: {
    'no-literal-colors': {
      create(context) {
        return {
          TaggedTemplateExpression(node) {
            if (
              (node.tag.name === 'css' ||
                node?.tag?.object?.name === 'styled') &&
              node?.quasi?.quasis.length
            ) {
              if (node.quasi.type === 'TemplateLiteral') {
                const { quasis } = node.quasi;
                quasis.forEach(quasi => {
                  if (quasi?.type === 'TemplateElement' && quasi?.value?.raw) {
                    const rawValue = quasi.value.raw;
                    if (
                      hasHexColor(rawValue) ||
                      hasRgbColor(rawValue) ||
                      hasLiteralColor(rawValue)
                    ) {
                      context.report(node, node.loc, WARNING_MESSAGE);
                    }
                  }
                });
              }
            }
          },
          ObjectExpression(node) {
            const propertyNodes = getObjectExpressionPropertyNodes(node);
            propertyNodes.forEach(prop => {
              if (prop?.value?.type === 'Literal' && prop?.value?.value) {
                const value = prop?.value?.value;
                if (
                  !parsedNodes.find(
                    p => JSON.stringify(p.loc) === JSON.stringify(prop.loc),
                  )
                ) {
                  if (
                    hasHexColor(value) ||
                    hasRgbColor(value) ||
                    hasLiteralColor(value, true)
                  ) {
                    context.report(node, prop.loc, WARNING_MESSAGE);
                  }
                }
              }
              parsedNodes.push(prop);
            });
          },
        };
      },
    },
  },
};
