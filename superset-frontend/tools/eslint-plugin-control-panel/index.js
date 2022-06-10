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
 * @fileoverview Rule to warn about incorrect order of sections in control panel
 * @author Apache
 */

//------------------------------------------------------------------------------
// Rule Definition
//------------------------------------------------------------------------------

// The section order is still in development, might be a subject to changes
const EXPECTED_SECTIONS_ORDER = [
  {
    name: /^(Chart|Table|Map)$/i,
    isOptional: false,
    isPositionFixed: true,
    stringifiedName: 'Chart, Table or Map',
  },
  { name: 'Time', isOptional: true, isPositionFixed: true },
  { name: 'Filter', isOptional: true, isPositionFixed: false },
  {
    name: /Settings/i,
    isOptional: true,
    isPositionFixed: false,
    stringifiedName: 'Settings or alike',
  },
];

const getErrorMessage = faultySection =>
  `\nThe order of control panel sections is not correct. The expected section order is: \n${EXPECTED_SECTIONS_ORDER.map(
    section =>
      `${section.stringifiedName || section.name}${
        section.isOptional ? ' (optional)' : ''
      }`,
  ).join('\n')} \n\nSection ${
    faultySection.stringifiedName || faultySection.name
  } is in wrong place${faultySection.isOptional ? '.' : ' or missing.'}`;

function getControlPanelAsObjectExpression(context, node) {
  if (node.declaration?.type === 'ObjectExpression') {
    return node.declaration;
  }
  let identifierNode;
  if (node.declaration?.type === 'Identifier') {
    identifierNode = node.declaration;
  } else if (node.type === 'ExportNamedDeclaration') {
    identifierNode = node.specifiers?.find(
      specifier => specifier.exported?.name === 'default',
    )?.local;
  }
  if (identifierNode?.type === 'Identifier') {
    const variableDef = context.getScope().set.get(identifierNode.name)
      ?.defs?.[0];
    if (
      variableDef?.type === 'Variable' &&
      variableDef?.node?.type === 'VariableDeclarator' &&
      variableDef?.node?.init?.type === 'ObjectExpression'
    ) {
      return variableDef.node.init;
    }
  }
  return null;
}

function getSectionLabels(node) {
  if (!Array.isArray(node.properties)) {
    return [];
  }
  const controlPanelSections = node.properties.find(
    property => property.key.name === 'controlPanelSections',
  );
  if (
    !controlPanelSections ||
    controlPanelSections.value?.type !== 'ArrayExpression'
  ) {
    return [];
  }
  return controlPanelSections.value.elements.reduce((acc, element) => {
    const labelNode = element.properties?.find(
      property => property.key?.name === 'label',
    )?.value;
    // labelNode is CallExpression if translation is used, otherwise Literal
    if (
      labelNode?.type === 'CallExpression' &&
      labelNode?.callee.name === 't' &&
      labelNode?.arguments.length === 1
    ) {
      acc.push(labelNode.arguments[0].value);
    } else if (labelNode?.type === 'Literal') {
      acc.push(labelNode.value);
    }
    return acc;
  }, []);
}

function findSectionInWrongOrder(sectionLabels) {
  return EXPECTED_SECTIONS_ORDER.find((section, index) => {
    // false if not optional section is missing
    if (!sectionLabels.some(label => label.match(section.name))) {
      return !section.isOptional;
    }
    // false if section has incorrect index
    if (section.isPositionFixed) {
      return !sectionLabels[index].match(section.name);
    }
    const sectionIndex = sectionLabels.findIndex(label =>
      label.match(section.name),
    );
    // false if order of sections is incorrect
    return sectionLabels
      .slice(0, sectionIndex)
      .some(
        prevSection =>
          sectionLabels.findIndex(label => label.match(prevSection.name)) >=
          sectionIndex,
      );
  });
}

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  rules: {
    'ensure-sections-order': {
      create(context) {
        function handler(node) {
          const controlPanelObject = getControlPanelAsObjectExpression(
            context,
            node,
          );
          if (controlPanelObject) {
            const sectionLabels = getSectionLabels(controlPanelObject);
            const sectionInWrongOrder = findSectionInWrongOrder(sectionLabels);
            if (sectionInWrongOrder) {
              context.report({
                node,
                message: getErrorMessage(sectionInWrongOrder),
              });
            }
          }
        }
        return {
          ExportDefaultDeclaration: handler,
          ExportNamedDeclaration: handler,
        };
      },
    },
  },
};
