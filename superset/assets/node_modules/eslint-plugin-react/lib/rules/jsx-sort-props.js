/**
 * @fileoverview Enforce props alphabetical sorting
 * @author Ilya Volodin, Yannick Croissant
 */
'use strict';

const propName = require('jsx-ast-utils/propName');
const docsUrl = require('../util/docsUrl');
const jsxUtil = require('../util/jsx');

// ------------------------------------------------------------------------------
// Rule Definition
// ------------------------------------------------------------------------------

function isCallbackPropName(name) {
  return /^on[A-Z]/.test(name);
}

const RESERVED_PROPS_LIST = [
  'children',
  'dangerouslySetInnerHTML',
  'key',
  'ref'
];

function isReservedPropName(name, list) {
  return list.indexOf(name) >= 0;
}

function propNameCompare(a, b, options) {
  if (options.ignoreCase) {
    a = a.toLowerCase();
    b = b.toLowerCase();
  }
  if (options.reservedFirst) {
    const aIsReserved = isReservedPropName(a, options.reservedList);
    const bIsReserved = isReservedPropName(b, options.reservedList);
    if ((aIsReserved && bIsReserved) || (!aIsReserved && !bIsReserved)) {
      return a.localeCompare(b);
    } else if (aIsReserved && !bIsReserved) {
      return -1;
    }
    return 1;
  }
  return a.localeCompare(b);
}

/**
 * Create an array of arrays where each subarray is composed of attributes
 * that are considered sortable.
 * @param {Array<JSXSpreadAttribute|JSXAttribute>} attributes
 * @return {Array<Array<JSXAttribute>}
 */
function getGroupsOfSortableAttributes(attributes) {
  const sortableAttributeGroups = [];
  let groupCount = 0;
  for (let i = 0; i < attributes.length; i++) {
    const lastAttr = attributes[i - 1];
    // If we have no groups or if the last attribute was JSXSpreadAttribute
    // then we start a new group. Append attributes to the group until we
    // come across another JSXSpreadAttribute or exhaust the array.
    if (
      !lastAttr ||
      (lastAttr.type === 'JSXSpreadAttribute' &&
        attributes[i].type !== 'JSXSpreadAttribute')
    ) {
      groupCount++;
      sortableAttributeGroups[groupCount - 1] = [];
    }
    if (attributes[i].type !== 'JSXSpreadAttribute') {
      sortableAttributeGroups[groupCount - 1].push(attributes[i]);
    }
  }
  return sortableAttributeGroups;
}

const generateFixerFunction = (node, context, reservedList) => {
  const sourceCode = context.getSourceCode();
  const attributes = node.attributes.slice(0);
  const configuration = context.options[0] || {};
  const ignoreCase = configuration.ignoreCase || false;
  const reservedFirst = configuration.reservedFirst || false;

  // Sort props according to the context. Only supports ignoreCase.
  // Since we cannot safely move JSXSpreadAttribute (due to potential variable overrides),
  // we only consider groups of sortable attributes.
  const sortableAttributeGroups = getGroupsOfSortableAttributes(attributes);
  const sortedAttributeGroups = sortableAttributeGroups.slice(0).map(group =>
    group.slice(0).sort((a, b) =>
      propNameCompare(propName(a), propName(b), {ignoreCase, reservedFirst, reservedList})
    )
  );

  return function(fixer) {
    const fixers = [];
    let source = sourceCode.getText();

    // Replace each unsorted attribute with the sorted one.
    sortableAttributeGroups.forEach((sortableGroup, ii) => {
      sortableGroup.forEach((attr, jj) => {
        const sortedAttr = sortedAttributeGroups[ii][jj];
        const sortedAttrText = sourceCode.getText(sortedAttr);
        fixers.push({
          range: [attr.range[0], attr.range[1]],
          text: sortedAttrText
        });
      });
    });

    fixers.sort((a, b) => a.range[0] < b.range[0]);

    const rangeStart = fixers[fixers.length - 1].range[0];
    const rangeEnd = fixers[0].range[1];

    fixers.forEach(fix => {
      source = `${source.substr(0, fix.range[0])}${fix.text}${source.substr(fix.range[1])}`;
    });

    return fixer.replaceTextRange([rangeStart, rangeEnd], source.substr(rangeStart, rangeEnd - rangeStart));
  };
};

/**
 * Checks if the `reservedFirst` option is valid
 * @param {Object} context The context of the rule
 * @param {Boolean|Array<String>} reservedFirst The `reservedFirst` option
 * @return {?Function} If an error is detected, a function to generate the error message, otherwise, `undefined`
 */
// eslint-disable-next-line consistent-return
function validateReservedFirstConfig(context, reservedFirst) {
  if (reservedFirst) {
    if (Array.isArray(reservedFirst)) {
      // Only allow a subset of reserved words in customized lists
      // eslint-disable-next-line consistent-return
      const nonReservedWords = reservedFirst.filter(word => {
        if (!isReservedPropName(word, RESERVED_PROPS_LIST)) {
          return true;
        }
      });

      if (reservedFirst.length === 0) {
        return function(decl) {
          context.report({
            node: decl,
            message: 'A customized reserved first list must not be empty'
          });
        };
      } else if (nonReservedWords.length > 0) {
        return function(decl) {
          context.report({
            node: decl,
            message: 'A customized reserved first list must only contain a subset of React reserved props.' +
              ' Remove: {{ nonReservedWords }}',
            data: {
              nonReservedWords: nonReservedWords.toString()
            }
          });
        };
      }
    }
  }
}

module.exports = {
  meta: {
    docs: {
      description: 'Enforce props alphabetical sorting',
      category: 'Stylistic Issues',
      recommended: false,
      url: docsUrl('jsx-sort-props')
    },
    fixable: 'code',
    schema: [{
      type: 'object',
      properties: {
        // Whether callbacks (prefixed with "on") should be listed at the very end,
        // after all other props. Supersedes shorthandLast.
        callbacksLast: {
          type: 'boolean'
        },
        // Whether shorthand properties (without a value) should be listed first
        shorthandFirst: {
          type: 'boolean'
        },
        // Whether shorthand properties (without a value) should be listed last
        shorthandLast: {
          type: 'boolean'
        },
        ignoreCase: {
          type: 'boolean'
        },
        // Whether alphabetical sorting should be enforced
        noSortAlphabetically: {
          type: 'boolean'
        },
        reservedFirst: {
          type: ['array', 'boolean']
        }
      },
      additionalProperties: false
    }]
  },

  create: function(context) {
    const configuration = context.options[0] || {};
    const ignoreCase = configuration.ignoreCase || false;
    const callbacksLast = configuration.callbacksLast || false;
    const shorthandFirst = configuration.shorthandFirst || false;
    const shorthandLast = configuration.shorthandLast || false;
    const noSortAlphabetically = configuration.noSortAlphabetically || false;
    const reservedFirst = configuration.reservedFirst || false;
    const reservedFirstError = validateReservedFirstConfig(context, reservedFirst);
    let reservedList = Array.isArray(reservedFirst) ? reservedFirst : RESERVED_PROPS_LIST;

    return {
      JSXOpeningElement: function(node) {
        // `dangerouslySetInnerHTML` is only "reserved" on DOM components
        if (reservedFirst && !jsxUtil.isDOMComponent(node)) {
          reservedList = reservedList.filter(prop => prop !== 'dangerouslySetInnerHTML');
        }

        node.attributes.reduce((memo, decl, idx, attrs) => {
          if (decl.type === 'JSXSpreadAttribute') {
            return attrs[idx + 1];
          }

          let previousPropName = propName(memo);
          let currentPropName = propName(decl);
          const previousValue = memo.value;
          const currentValue = decl.value;
          const previousIsCallback = isCallbackPropName(previousPropName);
          const currentIsCallback = isCallbackPropName(currentPropName);

          if (ignoreCase) {
            previousPropName = previousPropName.toLowerCase();
            currentPropName = currentPropName.toLowerCase();
          }

          if (reservedFirst) {
            if (reservedFirstError) {
              reservedFirstError(decl);
              return memo;
            }

            const previousIsReserved = isReservedPropName(previousPropName, reservedList);
            const currentIsReserved = isReservedPropName(currentPropName, reservedList);

            if (previousIsReserved && !currentIsReserved) {
              return decl;
            }
            if (!previousIsReserved && currentIsReserved) {
              context.report({
                node: decl,
                message: 'Reserved props must be listed before all other props',
                fix: generateFixerFunction(node, context, reservedList)
              });
              return memo;
            }
          }

          if (callbacksLast) {
            if (!previousIsCallback && currentIsCallback) {
              // Entering the callback prop section
              return decl;
            }
            if (previousIsCallback && !currentIsCallback) {
              // Encountered a non-callback prop after a callback prop
              context.report({
                node: memo,
                message: 'Callbacks must be listed after all other props'
              });
              return memo;
            }
          }

          if (shorthandFirst) {
            if (currentValue && !previousValue) {
              return decl;
            }
            if (!currentValue && previousValue) {
              context.report({
                node: memo,
                message: 'Shorthand props must be listed before all other props'
              });
              return memo;
            }
          }

          if (shorthandLast) {
            if (!currentValue && previousValue) {
              return decl;
            }
            if (currentValue && !previousValue) {
              context.report({
                node: memo,
                message: 'Shorthand props must be listed after all other props'
              });
              return memo;
            }
          }

          if (!noSortAlphabetically && currentPropName < previousPropName) {
            context.report({
              node: decl,
              message: 'Props should be sorted alphabetically',
              fix: generateFixerFunction(node, context, reservedList)
            });
            return memo;
          }

          return decl;
        }, node.attributes[0]);
      }
    };
  }
};
