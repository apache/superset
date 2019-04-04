/**
 * @fileoverview Enforces consistent naming for boolean props
 * @author Ev Haus
 */
'use strict';

const has = require('has');
const Components = require('../util/Components');
const propsUtil = require('../util/props');
const docsUrl = require('../util/docsUrl');

// ------------------------------------------------------------------------------
// Rule Definition
// ------------------------------------------------------------------------------

module.exports = {
  meta: {
    docs: {
      category: 'Stylistic Issues',
      description: 'Enforces consistent naming for boolean props',
      recommended: false,
      url: docsUrl('boolean-prop-naming')
    },

    schema: [{
      additionalProperties: false,
      properties: {
        propTypeNames: {
          items: {
            type: 'string'
          },
          minItems: 1,
          type: 'array',
          uniqueItems: true
        },
        rule: {
          default: '^(is|has)[A-Z]([A-Za-z0-9]?)+',
          minLength: 1,
          type: 'string'
        },
        message: {
          minLength: 1,
          type: 'string'
        }
      },
      type: 'object'
    }]
  },

  create: Components.detect((context, components, utils) => {
    const sourceCode = context.getSourceCode();
    const config = context.options[0] || {};
    const rule = config.rule ? new RegExp(config.rule) : null;
    const propTypeNames = config.propTypeNames || ['bool'];
    const propWrapperFunctions = new Set(context.settings.propWrapperFunctions || []);

    // Remembers all Flowtype object definitions
    const objectTypeAnnotations = new Map();

    /**
     * Returns the prop key to ensure we handle the following cases:
     * propTypes: {
     *   full: React.PropTypes.bool,
     *   short: PropTypes.bool,
     *   direct: bool,
     *   required: PropTypes.bool.isRequired
     * }
     * @param {Object} node The node we're getting the name of
     */
    function getPropKey(node) {
      // Check for `ExperimentalSpreadProperty` (ESLint 3/4) and `SpreadElement` (ESLint 5)
      // so we can skip validation of those fields.
      // Otherwise it will look for `node.value.property` which doesn't exist and breaks ESLint.
      if (node.type === 'ExperimentalSpreadProperty' || node.type === 'SpreadElement') {
        return null;
      }
      if (node.value.property) {
        const name = node.value.property.name;
        if (name === 'isRequired') {
          if (node.value.object && node.value.object.property) {
            return node.value.object.property.name;
          }
          return null;
        }
        return name;
      }
      if (node.value.type === 'Identifier') {
        return node.value.name;
      }
      return null;
    }

    /**
	 * Returns the name of the given node (prop)
	 * @param {Object} node The node we're getting the name of
	 */
    function getPropName(node) {
      // Due to this bug https://github.com/babel/babel-eslint/issues/307
      // we can't get the name of the Flow object key name. So we have
      // to hack around it for now.
      if (node.type === 'ObjectTypeProperty') {
        return sourceCode.getFirstToken(node).value;
      }

      return node.key.name;
    }

    /**
     * Checks and mark props with invalid naming
     * @param {Object} node The component node we're testing
     * @param {Array} proptypes A list of Property object (for each proptype defined)
     */
    function validatePropNaming(node, proptypes) {
      const component = components.get(node) || node;
      const invalidProps = component.invalidProps || [];

      (proptypes || []).forEach(prop => {
        const propKey = getPropKey(prop);
        const flowCheck = (
          prop.type === 'ObjectTypeProperty' &&
          prop.value.type === 'BooleanTypeAnnotation' &&
          rule.test(getPropName(prop)) === false
        );
        const regularCheck = (
          propKey &&
          propTypeNames.indexOf(propKey) >= 0 &&
          rule.test(getPropName(prop)) === false
        );

        if (flowCheck || regularCheck) {
          invalidProps.push(prop);
        }
      });

      components.set(node, {
        invalidProps: invalidProps
      });
    }

    /**
     * Reports invalid prop naming
     * @param {Object} component The component to process
     */
    function reportInvalidNaming(component) {
      component.invalidProps.forEach(propNode => {
        const propName = getPropName(propNode);
        context.report({
          node: propNode,
          message: config.message || 'Prop name ({{ propName }}) doesn\'t match rule ({{ pattern }})',
          data: {
            component: propName,
            propName: propName,
            pattern: config.rule
          }
        });
      });
    }

    function checkPropWrapperArguments(node, args) {
      if (!node || !Array.isArray(args)) {
        return;
      }
      args.filter(arg => arg.type === 'ObjectExpression').forEach(object => validatePropNaming(node, object.properties));
    }

    // --------------------------------------------------------------------------
    // Public
    // --------------------------------------------------------------------------

    return {
      ClassProperty: function(node) {
        if (!rule || !propsUtil.isPropTypesDeclaration(node)) {
          return;
        }
        if (node.value && node.value.type === 'CallExpression' && propWrapperFunctions.has(sourceCode.getText(node.value.callee))) {
          checkPropWrapperArguments(node, node.value.arguments);
        }
        if (node.value && node.value.properties) {
          validatePropNaming(node, node.value.properties);
        }
        if (node.typeAnnotation && node.typeAnnotation.typeAnnotation) {
          validatePropNaming(node, node.typeAnnotation.typeAnnotation.properties);
        }
      },

      MemberExpression: function(node) {
        if (!rule || !propsUtil.isPropTypesDeclaration(node)) {
          return;
        }
        const component = utils.getRelatedComponent(node);
        if (!component || !node.parent.right) {
          return;
        }
        const right = node.parent.right;
        if (right.type === 'CallExpression' && propWrapperFunctions.has(sourceCode.getText(right.callee))) {
          checkPropWrapperArguments(component.node, right.arguments);
          return;
        }
        validatePropNaming(component.node, node.parent.right.properties);
      },

      ObjectExpression: function(node) {
        if (!rule) {
          return;
        }

        // Search for the proptypes declaration
        node.properties.forEach(property => {
          if (!propsUtil.isPropTypesDeclaration(property)) {
            return;
          }
          validatePropNaming(node, property.value.properties);
        });
      },

      TypeAlias: function(node) {
        // Cache all ObjectType annotations, we will check them at the end
        if (node.right.type === 'ObjectTypeAnnotation') {
          objectTypeAnnotations.set(node.id.name, node.right);
        }
      },

      'Program:exit': function() {
        if (!rule) {
          return;
        }

        const list = components.list();
        Object.keys(list).forEach(component => {
          // If this is a functional component that uses a global type, check it
          if (
            list[component].node.type === 'FunctionDeclaration' &&
            list[component].node.params &&
            list[component].node.params.length &&
            list[component].node.params[0].typeAnnotation
          ) {
            const typeNode = list[component].node.params[0].typeAnnotation;
            const annotation = typeNode.typeAnnotation;

            let propType;
            if (annotation.type === 'GenericTypeAnnotation') {
              propType = objectTypeAnnotations.get(annotation.id.name);
            } else if (annotation.type === 'ObjectTypeAnnotation') {
              propType = annotation;
            }
            if (propType) {
              validatePropNaming(list[component].node, propType.properties);
            }
          }

          if (!has(list, component) || (list[component].invalidProps || []).length) {
            reportInvalidNaming(list[component]);
          }
        });

        // Reset cache
        objectTypeAnnotations.clear();
      }
    };
  })
};
