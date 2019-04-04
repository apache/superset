'use strict';

var _ariaQuery = require('aria-query');

var _jsxAstUtils = require('jsx-ast-utils');

var _schemas = require('../util/schemas');

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } } /**
                                                                                                                                                                                                     * @fileoverview Enforce that elements that do not support ARIA roles,
                                                                                                                                                                                                     *  states and properties do not have those attributes.
                                                                                                                                                                                                     * @author Ethan Cohen
                                                                                                                                                                                                     */

// ----------------------------------------------------------------------------
// Rule Definition
// ----------------------------------------------------------------------------

var errorMessage = function errorMessage(invalidProp) {
  return 'This element does not support ARIA roles, states and properties. Try removing the prop \'' + invalidProp + '\'.';
};

var schema = (0, _schemas.generateObjSchema)();

module.exports = {
  meta: {
    docs: {},
    schema: [schema]
  },

  create: function create(context) {
    return {
      JSXOpeningElement: function JSXOpeningElement(node) {
        var nodeType = (0, _jsxAstUtils.elementType)(node);
        var nodeAttrs = _ariaQuery.dom.get(nodeType) || {};
        var _nodeAttrs$reserved = nodeAttrs.reserved,
            isReservedNodeType = _nodeAttrs$reserved === undefined ? false : _nodeAttrs$reserved;

        // If it's not reserved, then it can have aria-* roles, states, and properties

        if (isReservedNodeType === false) {
          return;
        }

        var invalidAttributes = [].concat(_toConsumableArray(_ariaQuery.aria.keys())).concat('role');

        node.attributes.forEach(function (prop) {
          if (prop.type === 'JSXSpreadAttribute') {
            return;
          }

          var name = (0, _jsxAstUtils.propName)(prop);
          var normalizedName = name ? name.toLowerCase() : '';

          if (invalidAttributes.indexOf(normalizedName) > -1) {
            context.report({
              node: node,
              message: errorMessage(name)
            });
          }
        });
      }
    };
  }
};