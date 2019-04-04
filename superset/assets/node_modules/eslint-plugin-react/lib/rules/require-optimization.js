/**
 * @fileoverview Enforce React components to have a shouldComponentUpdate method
 * @author Evgueni Naverniouk
 */
'use strict';

const has = require('has');
const Components = require('../util/Components');
const docsUrl = require('../util/docsUrl');

module.exports = {
  meta: {
    docs: {
      description: 'Enforce React components to have a shouldComponentUpdate method',
      category: 'Best Practices',
      recommended: false,
      url: docsUrl('require-optimization')
    },

    schema: [{
      type: 'object',
      properties: {
        allowDecorators: {
          type: 'array',
          items: {
            type: 'string'
          }
        }
      },
      additionalProperties: false
    }]
  },

  create: Components.detect((context, components, utils) => {
    const MISSING_MESSAGE = 'Component is not optimized. Please add a shouldComponentUpdate method.';
    const configuration = context.options[0] || {};
    const allowDecorators = configuration.allowDecorators || [];

    /**
     * Checks to see if our component is decorated by PureRenderMixin via reactMixin
     * @param {ASTNode} node The AST node being checked.
     * @returns {Boolean} True if node is decorated with a PureRenderMixin, false if not.
     */
    const hasPureRenderDecorator = function (node) {
      if (node.decorators && node.decorators.length) {
        for (let i = 0, l = node.decorators.length; i < l; i++) {
          if (
            node.decorators[i].expression &&
            node.decorators[i].expression.callee &&
            node.decorators[i].expression.callee.object &&
            node.decorators[i].expression.callee.object.name === 'reactMixin' &&
            node.decorators[i].expression.callee.property &&
            node.decorators[i].expression.callee.property.name === 'decorate' &&
            node.decorators[i].expression.arguments &&
            node.decorators[i].expression.arguments.length &&
            node.decorators[i].expression.arguments[0].name === 'PureRenderMixin'
          ) {
            return true;
          }
        }
      }

      return false;
    };

    /**
     * Checks to see if our component is custom decorated
     * @param {ASTNode} node The AST node being checked.
     * @returns {Boolean} True if node is decorated name with a custom decorated, false if not.
     */
    const hasCustomDecorator = function (node) {
      const allowLength = allowDecorators.length;

      if (allowLength && node.decorators && node.decorators.length) {
        for (let i = 0; i < allowLength; i++) {
          for (let j = 0, l = node.decorators.length; j < l; j++) {
            if (
              node.decorators[j].expression &&
              node.decorators[j].expression.name === allowDecorators[i]
            ) {
              return true;
            }
          }
        }
      }

      return false;
    };

    /**
     * Checks if we are declaring a shouldComponentUpdate method
     * @param {ASTNode} node The AST node being checked.
     * @returns {Boolean} True if we are declaring a shouldComponentUpdate method, false if not.
     */
    const isSCUDeclarеd = function (node) {
      return Boolean(
        node &&
        node.name === 'shouldComponentUpdate'
      );
    };

    /**
     * Checks if we are declaring a PureRenderMixin mixin
     * @param {ASTNode} node The AST node being checked.
     * @returns {Boolean} True if we are declaring a PureRenderMixin method, false if not.
     */
    const isPureRenderDeclared = function (node) {
      let hasPR = false;
      if (node.value && node.value.elements) {
        for (let i = 0, l = node.value.elements.length; i < l; i++) {
          if (node.value.elements[i] && node.value.elements[i].name === 'PureRenderMixin') {
            hasPR = true;
            break;
          }
        }
      }

      return Boolean(
        node &&
        node.key.name === 'mixins' &&
        hasPR
      );
    };

    /**
     * Mark shouldComponentUpdate as declared
     * @param {ASTNode} node The AST node being checked.
     */
    const markSCUAsDeclared = function (node) {
      components.set(node, {
        hasSCU: true
      });
    };

    /**
     * Reports missing optimization for a given component
     * @param {Object} component The component to process
     */
    const reportMissingOptimization = function (component) {
      context.report({
        node: component.node,
        message: MISSING_MESSAGE,
        data: {
          component: component.name
        }
      });
    };

    /**
     * Checks if we are declaring function in class
     * @returns {Boolean} True if we are declaring function in class, false if not.
     */
    const isFunctionInClass = function () {
      let blockNode;
      let scope = context.getScope();
      while (scope) {
        blockNode = scope.block;
        if (blockNode && blockNode.type === 'ClassDeclaration') {
          return true;
        }
        scope = scope.upper;
      }

      return false;
    };

    return {
      ArrowFunctionExpression: function (node) {
        // Stateless Functional Components cannot be optimized (yet)
        markSCUAsDeclared(node);
      },

      ClassDeclaration: function (node) {
        if (!(hasPureRenderDecorator(node) || hasCustomDecorator(node) || utils.isPureComponent(node))) {
          return;
        }
        markSCUAsDeclared(node);
      },

      FunctionDeclaration: function (node) {
        // Skip if the function is declared in the class
        if (isFunctionInClass()) {
          return;
        }
        // Stateless Functional Components cannot be optimized (yet)
        markSCUAsDeclared(node);
      },

      FunctionExpression: function (node) {
        // Skip if the function is declared in the class
        if (isFunctionInClass()) {
          return;
        }
        // Stateless Functional Components cannot be optimized (yet)
        markSCUAsDeclared(node);
      },

      MethodDefinition: function (node) {
        if (!isSCUDeclarеd(node.key)) {
          return;
        }
        markSCUAsDeclared(node);
      },

      ObjectExpression: function (node) {
        // Search for the shouldComponentUpdate declaration
        for (let i = 0, l = node.properties.length; i < l; i++) {
          if (
            !node.properties[i].key || (
              !isSCUDeclarеd(node.properties[i].key) &&
              !isPureRenderDeclared(node.properties[i])
            )
          ) {
            continue;
          }
          markSCUAsDeclared(node);
        }
      },

      'Program:exit': function () {
        const list = components.list();

        // Report missing shouldComponentUpdate for all components
        for (const component in list) {
          if (!has(list, component) || list[component].hasSCU) {
            continue;
          }
          reportMissingOptimization(list[component]);
        }
      }
    };
  })
};
