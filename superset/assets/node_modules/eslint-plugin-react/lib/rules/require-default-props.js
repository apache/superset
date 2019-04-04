/**
 * @fileOverview Enforce a defaultProps definition for every prop that is not a required prop.
 * @author Vitor Balocco
 */
'use strict';

const has = require('has');
const Components = require('../util/Components');
const variableUtil = require('../util/variable');
const annotations = require('../util/annotations');
const astUtil = require('../util/ast');
const propsUtil = require('../util/props');
const docsUrl = require('../util/docsUrl');

const QUOTES_REGEX = /^["']|["']$/g;

// ------------------------------------------------------------------------------
// Rule Definition
// ------------------------------------------------------------------------------

module.exports = {
  meta: {
    docs: {
      description: 'Enforce a defaultProps definition for every prop that is not a required prop.',
      category: 'Best Practices',
      url: docsUrl('require-default-props')
    },

    schema: [{
      type: 'object',
      properties: {
        forbidDefaultForRequired: {
          type: 'boolean'
        }
      },
      additionalProperties: false
    }]
  },

  create: Components.detect((context, components, utils) => {
    const sourceCode = context.getSourceCode();
    const propWrapperFunctions = new Set(context.settings.propWrapperFunctions || []);
    const configuration = context.options[0] || {};
    const forbidDefaultForRequired = configuration.forbidDefaultForRequired || false;
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
        name: sourceCode.getText(property.key).replace(QUOTES_REGEX, ''),
        isRequired: propsUtil.isRequiredPropType(property.value),
        node: property
      }));
    }

    /**
     * Extracts a PropType from a TypeAnnotation node.
     * @param   {ASTNode} node TypeAnnotation node.
     * @returns {Object[]}     Array of PropType object representations, to be consumed by `addPropTypesToComponent`.
     */
    function getPropTypesFromTypeAnnotation(node) {
      let properties;

      switch (node.typeAnnotation.type) {
        case 'GenericTypeAnnotation':
          let annotation = resolveGenericTypeAnnotation(node.typeAnnotation);

          if (annotation && annotation.id) {
            annotation = variableUtil.findVariableByName(context, annotation.id.name);
          }

          properties = annotation ? (annotation.properties || []) : [];
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

      return objectExpression.properties.map(property => sourceCode.getText(property.key).replace(QUOTES_REGEX, ''));
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

      const defaults = component.defaultProps || {};

      defaultProps.forEach(defaultProp => {
        defaults[defaultProp] = true;
      });

      components.set(component.node, {
        defaultProps: defaults
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

    /**
     * Reports all propTypes passed in that don't have a defaultProp counterpart.
     * @param  {Object[]} propTypes    List of propTypes to check.
     * @param  {Object}   defaultProps Object of defaultProps to check. Keys are the props names.
     * @return {void}
     */
    function reportPropTypesWithoutDefault(propTypes, defaultProps) {
      // If this defaultProps is "unresolved", then we should ignore this component and not report
      // any errors for it, to avoid false-positives with e.g. external defaultProps declarations or spread operators.
      if (defaultProps === 'unresolved') {
        return;
      }

      propTypes.forEach(prop => {
        if (prop.isRequired) {
          if (forbidDefaultForRequired && defaultProps[prop.name]) {
            context.report(
              prop.node,
              'propType "{{name}}" is required and should not have a defaultProp declaration.',
              {name: prop.name}
            );
          }
          return;
        }

        if (defaultProps[prop.name]) {
          return;
        }

        context.report(
          prop.node,
          'propType "{{name}}" is not required, but has no corresponding defaultProp declaration.',
          {name: prop.name}
        );
      });
    }

    /**
     * Extracts a PropType from a TypeAnnotation contained in generic node.
     * @param   {ASTNode} node TypeAnnotation node.
     * @returns {Object[]}     Array of PropType object representations, to be consumed by `addPropTypesToComponent`.
     */
    function getPropTypesFromGeneric(node) {
      let annotation = resolveGenericTypeAnnotation(node);

      if (annotation && annotation.id) {
        annotation = variableUtil.findVariableByName(context, annotation.id.name);
      }

      const properties = annotation ? (annotation.properties || []) : [];

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

    function hasPropTypesAsGeneric(node) {
      return node && node.parent && node.parent.type === 'ClassDeclaration';
    }

    function handlePropTypesAsGeneric(node) {
      const component = components.get(utils.getParentES6Component());
      if (!component) {
        return;
      }

      if (node.params[0]) {
        addPropTypesToComponent(component, getPropTypesFromGeneric(node.params[0], context));
      }
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
        //   foo: PropTypes.string.isRequired,
        //   bar: PropTypes.string
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
        // MyComponent.propTypes.baz = PropTypes.string;
        if (node.parent.type === 'MemberExpression' && node.parent.parent.type === 'AssignmentExpression') {
          if (isPropType) {
            addPropTypesToComponent(component, [{
              name: node.parent.property.name,
              isRequired: propsUtil.isRequiredPropType(node.parent.parent.right),
              node: node.parent.parent
            }]);
          } else {
            addDefaultPropsToComponent(component, [node.parent.property.name]);
          }

          return;
        }
      },

      // e.g.:
      // class Hello extends React.Component {
      //   static get propTypes() {
      //     return {
      //       name: PropTypes.string
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
      //     foo: PropTypes.string,
      //     bar: PropTypes.string.isRequired
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

        const isPropType = astUtil.getPropertyName(node) === 'propTypes';
        const isDefaultProp = astUtil.getPropertyName(node) === 'defaultProps' || astUtil.getPropertyName(node) === 'getDefaultProps';

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
      // createReactClass({
      //   render: function() {
      //     return <div>{this.props.foo}</div>;
      //   },
      //   propTypes: {
      //     foo: PropTypes.string.isRequired,
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

      // e.g.:
      // type HelloProps = {
      //   foo?: string
      // };
      // class Hello extends React.Component<HelloProps> {
      //   static defaultProps = {
      //     foo: 'default'
      //   }
      //   render() {
      //     return <div>{this.props.foo}</div>;
      //   }
      // };
      TypeParameterInstantiation: function(node) {
        if (hasPropTypesAsGeneric(node)) {
          handlePropTypesAsGeneric(node);
          return;
        }
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

          // If no propTypes could be found, we don't report anything.
          if (!list[component].propTypes) {
            continue;
          }

          reportPropTypesWithoutDefault(
            list[component].propTypes,
            list[component].defaultProps || {}
          );
        }
      }
    };
  })
};
