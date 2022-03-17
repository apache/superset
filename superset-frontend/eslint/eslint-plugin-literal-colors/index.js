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

const cssData = require('mdn-data').css;
const _ = require('lodash');

const ALLOWED_VALUES = [
  'auto',
  'inherit',
  'initial',
  'unset',
  'none',
  'revert',
  'invert',
];

function getObjectExpressionPropertyNodes(
  objectExpressionNode,
  propertyNodes = [],
) {
  _.each(objectExpressionNode.properties, propertyNode => {
    propertyNodes.push(propertyNode);

    if (
      propertyNode.value &&
      propertyNode.value.type &&
      propertyNode.value.type === 'ObjectExpression'
    ) {
      propertyNodes.concat(
        getObjectExpressionPropertyNodes(propertyNode.value, propertyNodes),
      );
    }
  });

  return propertyNodes;
}

// returns all CSS properties that might contain a color
function getColorProperties() {
  const colorProperties = [];
  const cssProperties = Object.keys(cssData.properties);

  cssProperties.forEach(key => {
    const cssProp = cssData.properties[key];
    if (cssProp.syntax.includes('<color>')) {
      const positions = cssProp.syntax.includes('||')
        ? cssProp.syntax.split(' || ')
        : ['<color>'];
      // the position of the color in the CSS property value
      const colorPosition = positions.indexOf('<color>');
      colorProperties.push({
        name: key,
        colorPosition,
        ...cssProp,
      });
    }
  });
  return colorProperties;
}

//------------------------------------------------------------------------------
// Rule Definition
//------------------------------------------------------------------------------

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  rules: {
    'no-literal-colors': {
      create(context) {
        return {
          ObjectExpression(node) {
            const propertyNodes = _.uniqBy(
              getObjectExpressionPropertyNodes(node),
              'loc',
            );
            propertyNodes.forEach(prop => {
              if (
                prop.value &&
                prop.value.type &&
                prop.value.type === 'Literal' &&
                prop.value.value &&
                !ALLOWED_VALUES.includes(prop.value.value)
              ) {
                const propertyKey = (prop.key.name || prop.key.value)
                  .replace(/([a-z])([A-Z])/g, '$1-$2')
                  .toLowerCase();
                const colorProperties = getColorProperties();

                // is a css color property
                const colorProperty = colorProperties.find(
                  p => p.name === propertyKey,
                );
                if (colorProperty) {
                  const valuePositions = prop.value.value.split(' ');
                  // found a color in the position that is literal
                  if (valuePositions[colorProperty.colorPosition]) {
                    context.report(
                      node,
                      prop.loc,
                      'Theme color variables are preferred',
                    );
                  }
                }
              }
            });
          },
        };
      },
    },
  },
};
