/**
 * @fileoverview Common propTypes sorting functionality.
 */

'use strict';

const astUtil = require('./ast');

/**
 * Returns the value name of a node.
 *
 * @param {ASTNode} node the node to check.
 * @returns {String} The name of the node.
 */
function getValueName(node) {
  return node.type === 'Property' && node.value.property && node.value.property.name;
}

/**
 * Checks if the prop is required or not.
 *
 * @param {ASTNode} node the prop to check.
 * @returns {Boolean} true if the prop is required.
 */
function isRequiredProp(node) {
  return getValueName(node) === 'isRequired';
}

/**
 * Checks if the proptype is a callback by checking if it starts with 'on'.
 *
 * @param {String} propName the name of the proptype to check.
 * @returns {Boolean} true if the proptype is a callback.
 */
function isCallbackPropName(propName) {
  return /^on[A-Z]/.test(propName);
}

/**
 * Checks if the prop is PropTypes.shape.
 *
 * @param {ASTNode} node the prop to check.
 * @returns {Boolean} true if the prop is PropTypes.shape.
 */
function isShapeProp(node) {
  return Boolean(
    node && node.callee && node.callee.property && node.callee.property.name === 'shape'
  );
}

/**
 * Returns the properties of a PropTypes.shape.
 *
 * @param {ASTNode} node the prop to check.
 * @returns {Array} the properties of the PropTypes.shape node.
 */
function getShapeProperties(node) {
  return node.arguments && node.arguments[0] && node.arguments[0].properties;
}

/**
 * Compares two elements.
 *
 * @param {ASTNode} a the first element to compare.
 * @param {ASTNode} b the second element to compare.
 * @param {Context} context The context of the two nodes.
 * @param {Boolean=} ignoreCase whether or not to ignore case when comparing the two elements.
 * @param {Boolean=} requiredFirst whether or not to sort required elements first.
 * @param {Boolean=} callbacksLast whether or not to sort callbacks after everyting else.
 * @returns {Number} the sort order of the two elements.
 */
function sorter(a, b, context, ignoreCase, requiredFirst, callbacksLast) {
  const aKey = String(astUtil.getKeyValue(context, a));
  const bKey = String(astUtil.getKeyValue(context, b));

  if (requiredFirst) {
    if (isRequiredProp(a) && !isRequiredProp(b)) {
      return -1;
    }
    if (!isRequiredProp(a) && isRequiredProp(b)) {
      return 1;
    }
  }

  if (callbacksLast) {
    if (isCallbackPropName(aKey) && !isCallbackPropName(bKey)) {
      return 1;
    }
    if (!isCallbackPropName(aKey) && isCallbackPropName(bKey)) {
      return -1;
    }
  }

  if (ignoreCase) {
    return aKey.localeCompare(bKey);
  }

  if (aKey < bKey) {
    return -1;
  }
  if (aKey > bKey) {
    return 1;
  }
  return 0;
}

/**
 * Fixes sort order of prop types.
 *
 * @param {Fixer} fixer the first element to compare.
 * @param {Object} context the second element to compare.
 * @param {Array} declarations The context of the two nodes.
 * @param {Boolean=} ignoreCase whether or not to ignore case when comparing the two elements.
 * @param {Boolean=} requiredFirst whether or not to sort required elements first.
 * @param {Boolean=} callbacksLast whether or not to sort callbacks after everyting else.
 * @param {Boolean=} sortShapeProp whether or not to sort propTypes defined in PropTypes.shape.
 * @returns {Object|*|{range, text}} the sort order of the two elements.
 */
function fixPropTypesSort(fixer, context, declarations, ignoreCase, requiredFirst, callbacksLast, sortShapeProp) {
  function sortInSource(allNodes, source) {
    const originalSource = source;
    const nodeGroups = allNodes.reduce((acc, curr) => {
      if (curr.type === 'ExperimentalSpreadProperty' || curr.type === 'SpreadElement') {
        acc.push([]);
      } else {
        acc[acc.length - 1].push(curr);
      }
      return acc;
    }, [[]]);

    nodeGroups.forEach((nodes) => {
      const sortedAttributes = nodes
        .slice()
        .sort((a, b) => sorter(a, b, context, ignoreCase, requiredFirst, callbacksLast));

      source = nodes.reduceRight((acc, attr, index) => {
        const sortedAttr = sortedAttributes[index];
        let sortedAttrText = context.getSourceCode().getText(sortedAttr);
        if (sortShapeProp && isShapeProp(sortedAttr.value)) {
          const shape = getShapeProperties(sortedAttr.value);
          if (shape) {
            const attrSource = sortInSource(
              shape,
              originalSource
            );
            sortedAttrText = attrSource.slice(sortedAttr.range[0], sortedAttr.range[1]);
          }
        }
        return `${acc.slice(0, attr.range[0])}${sortedAttrText}${acc.slice(attr.range[1])}`;
      }, source);
    });
    return source;
  }

  const source = sortInSource(declarations, context.getSourceCode().getText());

  const rangeStart = declarations[0].range[0];
  const rangeEnd = declarations[declarations.length - 1].range[1];
  return fixer.replaceTextRange([rangeStart, rangeEnd], source.slice(rangeStart, rangeEnd));
}

module.exports = {
  fixPropTypesSort
};
