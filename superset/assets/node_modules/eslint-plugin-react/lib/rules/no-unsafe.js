/**
 * @fileoverview Prevent usage of UNSAFE_ methods
 * @author Sergei Startsev
 */

'use strict';

const Components = require('../util/Components');
const astUtil = require('../util/ast');
const docsUrl = require('../util/docsUrl');
const versionUtil = require('../util/version');

// ------------------------------------------------------------------------------
// Rule Definition
// ------------------------------------------------------------------------------

module.exports = {
  meta: {
    docs: {
      description: 'Prevent usage of UNSAFE_ methods',
      category: 'Best Practices',
      recommended: false,
      url: docsUrl('no-unsafe')
    },
    schema: []
  },

  create: Components.detect((context, components, utils) => {
    const isApplicable = versionUtil.testReactVersion(context, '16.3.0');
    if (!isApplicable) {
      return {};
    }

    /**
     * Returns a list of unsafe methods
     * @returns {Array} A list of unsafe methods
     */
    function getUnsafeMethods() {
      return [
        'UNSAFE_componentWillMount',
        'UNSAFE_componentWillReceiveProps',
        'UNSAFE_componentWillUpdate'
      ];
    }

    /**
     * Checks if a passed method is unsafe
     * @param {string} method Life cycle method
     * @returns {boolean} Returns true for unsafe methods, otherwise returns false
     */
    function isUnsafe(method) {
      const unsafeMethods = getUnsafeMethods();
      return unsafeMethods.indexOf(method) !== -1;
    }

    /**
     * Reports the error for an unsafe method
     * @param {ASTNode} node The AST node being checked
     * @param {string} method Life cycle method
     */
    function checkUnsafe(node, method) {
      if (!isUnsafe(method)) {
        return;
      }

      context.report({
        node: node,
        message: `${method} is unsafe for use in async rendering, see https://reactjs.org/blog/2018/03/27/update-on-async-rendering.html`
      });
    }

    /**
     * Returns life cycle methods if available
     * @param {ASTNode} node The AST node being checked.
     * @returns {Array} The array of methods.
     */
    function getLifeCycleMethods(node) {
      const properties = astUtil.getComponentProperties(node);
      return properties.map(property => astUtil.getPropertyName(property));
    }

    /**
     * Checks life cycle methods
     * @param {ASTNode} node The AST node being checked.
     */
    function checkLifeCycleMethods(node) {
      if (utils.isES5Component(node) || utils.isES6Component(node)) {
        const methods = getLifeCycleMethods(node);
        methods.forEach(method => checkUnsafe(node, method));
      }
    }

    return {
      ClassDeclaration: checkLifeCycleMethods,
      ClassExpression: checkLifeCycleMethods,
      ObjectExpression: checkLifeCycleMethods
    };
  })
};
