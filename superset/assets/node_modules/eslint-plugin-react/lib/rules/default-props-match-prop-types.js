/**
 * @fileOverview Enforce all defaultProps are defined in propTypes
 * @author Vitor Balocco
 * @author Roy Sutton
 */
'use strict';

const has = require('has');
const Components = require('../util/Components');
const variableUtil = require('../util/variable');
const annotations = require('../util/annotations');
const astUtil = require('../util/ast');
const propsUtil = require('../util/props');
const docsUrl = require('../util/docsUrl');

// ------------------------------------------------------------------------------
// Rule Definition
// ------------------------------------------------------------------------------

module.exports = {
  meta: {
    docs: {
      description: 'Enforce all defaultProps are defined and not "required" in propTypes.',
      category: 'Best Practices',
      url: docsUrl('default-props-match-prop-types')
    },

    schema: [{
      type: 'object',
      properties: {
        allowRequiredDefaults: {
          default: false,
          type: 'boolean'
        }
      },
      additionalProperties: false
    }]
  },

  create: Components.detect((context, components, utils) => {
    const configuration = context.options[0] || {};
    const allowRequiredDefaults = configuration.allowRequiredDefaults || false;
    const propWrapperFunctions = new Set(context.settings.propWrapperFunctions || []);
    // Used to track the type annotations in scope.
    // Necessary because babel's scopes do not track type annotations.
    let stack = null;

    /**
     * Try to resolve the node passed in to a variable in the current scope. If the node passed in is not
     * an Identifier, then the node is simply returned.
     * @param   {ASTNode} node The node to resolve.
     * @returns {ASTNode|null} Return null if the value could not be resolved, ASTNode otherwise.
     */
    function resolveNodeValue(node) {
      if (node.type === 'Identifier') {
        return variableUtil.findVariableByName(context, node.name);
      }
      if (
        node.type === 'CallExpression' &&
        propWrapperFunctions.has(node.callee.name) &&
        node.arguments && node.arguments[0]
      ) {
        return resolveNodeValue(node.arguments[0]);
      }
      return node;
    }

    /**
     * Helper for accessing the current scope in the stack.
     * @param {string} key The name of the identifier to access. If omitted, returns the full scope.
     * @param {ASTNode} value If provided sets the new value for the identifier.
     * @returns {Object|ASTNode} Either the whole scope or the ASTNode associated with the given identifier.
     */
    function typeScope(key, value) {
      if (arguments.length === 0) {
        return stack[stack.length - 1];
      } else if (arguments.length === 1) {
        return stack[stack.length - 1][key];
      }
      stack[stack.length - 1][key] = value;
      return value;
    }

    /**
     * Tries to find the definition of a GenericTypeAnnotation in the current scope.
     * @param  {ASTNode}      node The node GenericTypeAnnotation node to resolve.
     * @return {ASTNode|null}      Return null if definition cannot be found, ASTNode otherwise.
     */
    function resolveGenericTypeAnnotation(node) {
      if (node.type !== 'GenericTypeAnnotation' || node.id.type !== 'Identifier') {
        return null;
      }

      return variableUtil.findVariableByName(context, node.id.name) || typeScope(node.id.name);
    }

    function resolveUnionTypeAnnotation(node) {
      // Go through all the union and resolve any generic types.
      return node.types.map(annotation => {
        if (annotation.type === 'GenericTypeAnnotation') {
          return resolveGenericTypeAnnotation(annotation);
        }

        return annotation;
      });
    }

    /**
     * Extracts a PropType from an ObjectExpression node.
     * @param   {ASTNode} objectExpression ObjectExpression node.
     * @returns {Object[]}        Array of PropType object representations, to be consumed by `addPropTypesToComponent`.
     */
    function getPropTypesFromObjectExpression(objectExpression) {
      const props = objectExpression.properties.filter(property => property.type !== 'ExperimentalSpreadProperty' && property.type !== 'SpreadElement');

      return props.map(property => ({
        name: property.key.name,
        isRequired: propsUtil.isRequiredPropType(property.value),
        node: property
      }));
    }

    /**
     * Handles Props defined in IntersectionTypeAnnotation nodes
     * e.g. type Props = PropsA & PropsB
     * @param   {ASTNode} intersectionTypeAnnotation ObjectExpression node.
     * @returns {Object[]}
     */
    function getPropertiesFromIntersectionTypeAnnotationNode(annotation) {
      return annotation.types.reduce((properties, type) => {
        annotation = resolveGenericTypeAnnotation(type);

        if (annotation && annotation.id) {
          annotation = variableUtil.findVariableByName(context, annotation.id.name);
        }

        if (!annotation || !annotation.properties) {
          return properties;
        }

        return properties.concat(annotation.properties);
      }, []);
    }

    /**
     * Extracts a PropType from a TypeAnnotation node.
     * @param   {ASTNode} node TypeAnnotation node.
     * @returns {Object[]}     Array of PropType object representations, to be consumed by `addPropTypesToComponent`.
     */
    function getPropTypesFromTypeAnnotation(node) {
      let properties = [];

      switch (node.typeAnnotation.type) {
        case 'GenericTypeAnnotation':
          let annotation = resolveGenericTypeAnnotation(node.typeAnnotation);

          if (annotation && annotation.type === 'IntersectionTypeAnnotation') {
            properties = getPropertiesFromIntersectionTypeAnnotationNode(annotation);
          } else {
            if (annotation && annotation.id) {
              annotation = variableUtil.findVariableByName(context, annotation.id.name);
            }

            properties = annotation ? (annotation.properties || []) : [];
          }

          break;

        case 'UnionTypeAnnotation':
          const union = resolveUnionTypeAnnotation(node.typeAnnotation);
          properties = union.reduce((acc, curr) => {
            if (!curr) {
              return acc;
            }

            return acc.concat(curr.properties);
          }, []);
          break;

        case 'ObjectTypeAnnotation':
          properties = node.typeAnnotation.properties;
          break;

        default:
          properties = [];
          break;
      }

      const props = properties.filter(property => property.type === 'ObjectTypeProperty');

      return props.map(property => {
        // the `key` property is not present in ObjectTypeProperty nodes, so we need to get the key name manually.
        const tokens = context.getFirstTokens(property, 1);
        const name = tokens[0].value;

        return {
          name: name,
          isRequired: !property.optional,
          node: property
        };
      });
    }

    /**
     * Extracts a DefaultProp from an ObjectExpression node.
     * @param   {ASTNode} objectExpression ObjectExpression node.
     * @returns {Object|string}            Object representation of a defaultProp, to be consumed by
     *                                     `addDefaultPropsToComponent`, or string "unresolved", if the defaultProps
     *                                     from this ObjectExpression can't be resolved.
     */
    function getDefaultPropsFromObjectExpression(objectExpression) {
      const hasSpread = objectExpression.properties.find(property => property.type === 'ExperimentalSpreadProperty' || property.type === 'SpreadElement');

      if (hasSpread) {
        return 'unresolved';
      }

      return objectExpression.properties.map(defaultProp => ({
        name: defaultProp.key.name,
        node: defaultProp
      }));
    }

    /**
     * Marks a component's DefaultProps declaration as "unresolved". A component's DefaultProps is
     * marked as "unresolved" if we cannot safely infer the values of its defaultProps declarations
     * without risking false negatives.
     * @param   {Object} component The component to mark.
     * @returns {void}
     */
    function markDefaultPropsAsUnresolved(component) {
      components.set(component.node, {
        defaultProps: 'unresolved'
      });
    }

    /**
     * Adds propTypes to the component passed in.
     * @param   {ASTNode}  component The component to add the propTypes to.
     * @param   {Object[]} propTypes propTypes to add to the component.
     * @returns {void}
     */
    function addPropTypesToComponent(component, propTypes) {
      const props = component.propTypes || [];

      components.set(component.node, {
        propTypes: props.concat(propTypes)
      });
    }

    /**
     * Adds defaultProps to the component passed in.
     * @param   {ASTNode}         component    The component to add the defaultProps to.
     * @param   {String[]|String} defaultProps defaultProps to add to the component or the string "unresolved"
     *                                         if this component has defaultProps that can't be resolved.
     * @returns {void}
     */
    function addDefaultPropsToComponent(component, defaultProps) {
      // Early return if this component's defaultProps is already marked as "unresolved".
      if (component.defaultProps === 'unresolved') {
        return;
      }

      if (defaultProps === 'unresolved') {
        markDefaultPropsAsUnresolved(component);
        return;
      }

      const defaults = component.defaultProps || [];

      components.set(component.node, {
        defaultProps: defaults.concat(defaultProps)
      });
    }

    /**
     * Tries to find a props type annotation in a stateless component.
     * @param  {ASTNode} node The AST node to look for a props type annotation.
     * @return {void}
     */
    function handleStatelessComponent(node) {
      if (!node.params || !node.params.length || !annotations.isAnnotatedFunctionPropsDeclaration(node, context)) {
        return;
      }

      // find component this props annotation belongs to
      const component = components.get(utils.getParentStatelessComponent());
      if (!component) {
        return;
      }

      addPropTypesToComponent(component, getPropTypesFromTypeAnnotation(node.params[0].typeAnnotation, context));
    }

    function handlePropTypeAnnotationClassProperty(node) {
      // find component this props annotation belongs to
      const component = components.get(utils.getParentES6Component());
      if (!component) {
        return;
      }
      addPropTypesToComponent(component, getPropTypesFromTypeAnnotation(node.typeAnnotation, context));
    }

    function isPropTypeAnnotation(node) {
      return (astUtil.getPropertyName(node) === 'props' && !!node.typeAnnotation);
    }

    function propFromName(propTypes, name) {
      return propTypes.find(prop => prop.name === name);
    }

    /**
     * Reports all defaultProps passed in that don't have an appropriate propTypes counterpart.
     * @param  {Object[]} propTypes    Array of propTypes to check.
     * @param  {Object}   defaultProps Object of defaultProps to check. Keys are the props names.
     * @return {void}
     */
    function reportInvalidDefaultProps(propTypes, defaultProps) {
      // If this defaultProps is "unresolved" or the propTypes is undefined, then we should ignore
      // this component and not report any errors for it, to avoid false-positives with e.g.
      // external defaultProps/propTypes declarations or spread operators.
      if (defaultProps === 'unresolved' || !propTypes) {
        return;
      }

      defaultProps.forEach(defaultProp => {
        const prop = propFromName(propTypes, defaultProp.name);

        if (prop && (allowRequiredDefaults || !prop.isRequired)) {
          return;
        }

        if (prop) {
          context.report(
            defaultProp.node,
            'defaultProp "{{name}}" defined for isRequired propType.',
            {name: defaultProp.name}
          );
        } else {
          context.report(
            defaultProp.node,
            'defaultProp "{{name}}" has no corresponding propTypes declaration.',
            {name: defaultProp.name}
          );
        }
      });
    }

    // --------------------------------------------------------------------------
    // Public API
    // --------------------------------------------------------------------------

    return {
      MemberExpression: function(node) {
        const isPropType = propsUtil.isPropTypesDeclaration(node);
        const isDefaultProp = propsUtil.isDefaultPropsDeclaration(node);

        if (!isPropType && !isDefaultProp) {
          return;
        }

        // find component this propTypes/defaultProps belongs to
        const component = utils.getRelatedComponent(node);
        if (!component) {
          return;
        }

        // e.g.:
        // MyComponent.propTypes = {
        //   foo: React.PropTypes.string.isRequired,
        //   bar: React.PropTypes.string
        // };
        //
        // or:
        //
        // MyComponent.propTypes = myPropTypes;
        if (node.parent.type === 'AssignmentExpression') {
          const expression = resolveNodeValue(node.parent.right);
          if (!expression || expression.type !== 'ObjectExpression') {
            // If a value can't be found, we mark the defaultProps declaration as "unresolved", because
            // we should ignore this component and not report any errors for it, to avoid false-positives
            // with e.g. external defaultProps declarations.
            if (isDefaultProp) {
              markDefaultPropsAsUnresolved(component);
            }

            return;
          }

          if (isPropType) {
            addPropTypesToComponent(component, getPropTypesFromObjectExpression(expression));
          } else {
            addDefaultPropsToComponent(component, getDefaultPropsFromObjectExpression(expression));
          }

          return;
        }

        // e.g.:
        // MyComponent.propTypes.baz = React.PropTypes.string;
        if (node.parent.type === 'MemberExpression' && node.parent.parent &&
          node.parent.parent.type === 'AssignmentExpression') {
          if (isPropType) {
            addPropTypesToComponent(component, [{
              name: node.parent.property.name,
              isRequired: propsUtil.isRequiredPropType(node.parent.parent.right),
              node: node.parent.parent
            }]);
          } else {
            addDefaultPropsToComponent(component, [{
              name: node.parent.property.name,
              node: node.parent.parent
            }]);
          }

          return;
        }
      },

      // e.g.:
      // class Hello extends React.Component {
      //   static get propTypes() {
      //     return {
      //       name: React.PropTypes.string
      //     };
      //   }
      //   static get defaultProps() {
      //     return {
      //       name: 'Dean'
      //     };
      //   }
      //   render() {
      //     return <div>Hello {this.props.name}</div>;
      //   }
      // }
      MethodDefinition: function(node) {
        if (!node.static || node.kind !== 'get') {
          return;
        }

        const isPropType = propsUtil.isPropTypesDeclaration(node);
        const isDefaultProp = propsUtil.isDefaultPropsDeclaration(node);

        if (!isPropType && !isDefaultProp) {
          return;
        }

        // find component this propTypes/defaultProps belongs to
        const component = components.get(utils.getParentES6Component());
        if (!component) {
          return;
        }

        const returnStatement = utils.findReturnStatement(node);
        if (!returnStatement) {
          return;
        }

        const expression = resolveNodeValue(returnStatement.argument);
        if (!expression || expression.type !== 'ObjectExpression') {
          return;
        }

        if (isPropType) {
          addPropTypesToComponent(component, getPropTypesFromObjectExpression(expression));
        } else {
          addDefaultPropsToComponent(component, getDefaultPropsFromObjectExpression(expression));
        }
      },

      // e.g.:
      // class Greeting extends React.Component {
      //   render() {
      //     return (
      //       <h1>Hello, {this.props.foo} {this.props.bar}</h1>
      //     );
      //   }
      //   static propTypes = {
      //     foo: React.PropTypes.string,
      //     bar: React.PropTypes.string.isRequired
      //   };
      // }
      ClassProperty: function(node) {
        if (isPropTypeAnnotation(node)) {
          handlePropTypeAnnotationClassProperty(node);
          return;
        }

        if (!node.static) {
          return;
        }

        if (!node.value) {
          return;
        }

        const propName = astUtil.getPropertyName(node);
        const isPropType = propName === 'propTypes';
        const isDefaultProp = propName === 'defaultProps' || propName === 'getDefaultProps';

        if (!isPropType && !isDefaultProp) {
          return;
        }

        // find component this propTypes/defaultProps belongs to
        const component = components.get(utils.getParentES6Component());
        if (!component) {
          return;
        }

        const expression = resolveNodeValue(node.value);
        if (!expression || expression.type !== 'ObjectExpression') {
          return;
        }

        if (isPropType) {
          addPropTypesToComponent(component, getPropTypesFromObjectExpression(expression));
        } else {
          addDefaultPropsToComponent(component, getDefaultPropsFromObjectExpression(expression));
        }
      },

      // e.g.:
      // React.createClass({
      //   render: function() {
      //     return <div>{this.props.foo}</div>;
      //   },
      //   propTypes: {
      //     foo: React.PropTypes.string.isRequired,
      //   },
      //   getDefaultProps: function() {
      //     return {
      //       foo: 'default'
      //     };
      //   }
      // });
      ObjectExpression: function(node) {
        // find component this propTypes/defaultProps belongs to
        const component = utils.isES5Component(node) && components.get(node);
        if (!component) {
          return;
        }

        // Search for the proptypes declaration
        node.properties.forEach(property => {
          if (property.type === 'ExperimentalSpreadProperty' || property.type === 'SpreadElement') {
            return;
          }

          const isPropType = propsUtil.isPropTypesDeclaration(property);
          const isDefaultProp = propsUtil.isDefaultPropsDeclaration(property);

          if (!isPropType && !isDefaultProp) {
            return;
          }

          if (isPropType && property.value.type === 'ObjectExpression') {
            addPropTypesToComponent(component, getPropTypesFromObjectExpression(property.value));
            return;
          }

          if (isDefaultProp && property.value.type === 'FunctionExpression') {
            const returnStatement = utils.findReturnStatement(property);
            if (!returnStatement || returnStatement.argument.type !== 'ObjectExpression') {
              return;
            }

            addDefaultPropsToComponent(component, getDefaultPropsFromObjectExpression(returnStatement.argument));
          }
        });
      },

      TypeAlias: function(node) {
        typeScope(node.id.name, node.right);
      },

      Program: function() {
        stack = [{}];
      },

      BlockStatement: function () {
        stack.push(Object.create(typeScope()));
      },

      'BlockStatement:exit': function () {
        stack.pop();
      },

      // Check for type annotations in stateless components
      FunctionDeclaration: handleStatelessComponent,
      ArrowFunctionExpression: handleStatelessComponent,
      FunctionExpression: handleStatelessComponent,

      'Program:exit': function() {
        stack = null;
        const list = components.list();

        for (const component in list) {
          if (!has(list, component)) {
            continue;
          }

          // If no defaultProps could be found, we don't report anything.
          if (!list[component].defaultProps) {
            return;
          }

          reportInvalidDefaultProps(
            list[component].propTypes,
            list[component].defaultProps || {}
          );
        }
      }
    };
  })
};
