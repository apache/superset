/**
 * @fileoverview Prevent missing props validation in a React component definition
 * @author Yannick Croissant
 */
'use strict';

// As for exceptions for props.children or props.className (and alike) look at
// https://github.com/yannickcr/eslint-plugin-react/issues/7

const has = require('has');
const Components = require('../util/Components');
const docsUrl = require('../util/docsUrl');

// ------------------------------------------------------------------------------
// Constants
// ------------------------------------------------------------------------------

const PROPS_REGEX = /^(props|nextProps)$/;
const DIRECT_PROPS_REGEX = /^(props|nextProps)\s*(\.|\[)/;

// ------------------------------------------------------------------------------
// Rule Definition
// ------------------------------------------------------------------------------

module.exports = {
  meta: {
    docs: {
      description: 'Prevent missing props validation in a React component definition',
      category: 'Best Practices',
      recommended: true,
      url: docsUrl('prop-types')
    },

    schema: [{
      type: 'object',
      properties: {
        ignore: {
          type: 'array',
          items: {
            type: 'string'
          }
        },
        customValidators: {
          type: 'array',
          items: {
            type: 'string'
          }
        },
        skipUndeclared: {
          type: 'boolean'
        }
      },
      additionalProperties: false
    }]
  },

  create: Components.detect((context, components, utils) => {
    const sourceCode = context.getSourceCode();
    const configuration = context.options[0] || {};
    const ignored = configuration.ignore || [];
    const skipUndeclared = configuration.skipUndeclared || false;

    const MISSING_MESSAGE = '\'{{name}}\' is missing in props validation';

    /**
     * Check if we are in a class constructor
     * @return {boolean} true if we are in a class constructor, false if not
     */
    function inConstructor() {
      let scope = context.getScope();
      while (scope) {
        if (scope.block && scope.block.parent && scope.block.parent.kind === 'constructor') {
          return true;
        }
        scope = scope.upper;
      }
      return false;
    }

    /**
     * Check if we are in a class constructor
     * @return {boolean} true if we are in a class constructor, false if not
     */
    function inComponentWillReceiveProps() {
      let scope = context.getScope();
      while (scope) {
        if (
          scope.block && scope.block.parent &&
          scope.block.parent.key && scope.block.parent.key.name === 'componentWillReceiveProps'
        ) {
          return true;
        }
        scope = scope.upper;
      }
      return false;
    }

    /**
     * Check if we are in a class constructor
     * @return {boolean} true if we are in a class constructor, false if not
     */
    function inShouldComponentUpdate() {
      let scope = context.getScope();
      while (scope) {
        if (
          scope.block && scope.block.parent &&
          scope.block.parent.key && scope.block.parent.key.name === 'shouldComponentUpdate'
        ) {
          return true;
        }
        scope = scope.upper;
      }
      return false;
    }

    /**
    * Checks if a prop is being assigned a value props.bar = 'bar'
    * @param {ASTNode} node The AST node being checked.
    * @returns {Boolean}
    */

    function isAssignmentToProp(node) {
      return (
        node.parent &&
        node.parent.type === 'AssignmentExpression' &&
        node.parent.left === node
      );
    }

    /**
     * Checks if we are using a prop
     * @param {ASTNode} node The AST node being checked.
     * @returns {Boolean} True if we are using a prop, false if not.
     */
    function isPropTypesUsage(node) {
      const isClassUsage = (
        (utils.getParentES6Component() || utils.getParentES5Component()) &&
        node.object.type === 'ThisExpression' && node.property.name === 'props'
      );
      const isStatelessFunctionUsage = node.object.name === 'props' && !isAssignmentToProp(node);
      const isNextPropsUsage = node.object.name === 'nextProps' && (inComponentWillReceiveProps() || inShouldComponentUpdate());
      return isClassUsage || isStatelessFunctionUsage || isNextPropsUsage;
    }

    /**
     * Checks if the prop is ignored
     * @param {String} name Name of the prop to check.
     * @returns {Boolean} True if the prop is ignored, false if not.
     */
    function isIgnored(name) {
      return ignored.indexOf(name) !== -1;
    }

    /**
     * Checks if the component must be validated
     * @param {Object} component The component to process
     * @returns {Boolean} True if the component must be validated, false if not.
     */
    function mustBeValidated(component) {
      const isSkippedByConfig = skipUndeclared && typeof component.declaredPropTypes === 'undefined';
      return Boolean(
        component &&
        component.usedPropTypes &&
        !component.ignorePropsValidation &&
        !isSkippedByConfig
      );
    }

    /**
     * Internal: Checks if the prop is declared
     * @param {Object} declaredPropTypes Description of propTypes declared in the current component
     * @param {String[]} keyList Dot separated name of the prop to check.
     * @returns {Boolean} True if the prop is declared, false if not.
     */
    function _isDeclaredInComponent(declaredPropTypes, keyList) {
      for (let i = 0, j = keyList.length; i < j; i++) {
        const key = keyList[i];
        const propType = (
          declaredPropTypes && (
            // Check if this key is declared
            (declaredPropTypes[key] || // If not, check if this type accepts any key
            declaredPropTypes.__ANY_KEY__)
          )
        );

        if (!propType) {
          // If it's a computed property, we can't make any further analysis, but is valid
          return key === '__COMPUTED_PROP__';
        }
        if (typeof propType === 'object' && !propType.type) {
          return true;
        }
        // Consider every children as declared
        if (propType.children === true) {
          return true;
        }
        if (propType.acceptedProperties) {
          return key in propType.acceptedProperties;
        }
        if (propType.type === 'union') {
          // If we fall in this case, we know there is at least one complex type in the union
          if (i + 1 >= j) {
            // this is the last key, accept everything
            return true;
          }
          // non trivial, check all of them
          const unionTypes = propType.children;
          const unionPropType = {};
          for (let k = 0, z = unionTypes.length; k < z; k++) {
            unionPropType[key] = unionTypes[k];
            const isValid = _isDeclaredInComponent(
              unionPropType,
              keyList.slice(i)
            );
            if (isValid) {
              return true;
            }
          }

          // every possible union were invalid
          return false;
        }
        declaredPropTypes = propType.children;
      }
      return true;
    }

    /**
     * Checks if the prop is declared
     * @param {ASTNode} node The AST node being checked.
     * @param {String[]} names List of names of the prop to check.
     * @returns {Boolean} True if the prop is declared, false if not.
     */
    function isDeclaredInComponent(node, names) {
      while (node) {
        const component = components.get(node);

        const isDeclared =
          component && component.confidence === 2 &&
          _isDeclaredInComponent(component.declaredPropTypes || {}, names)
        ;
        if (isDeclared) {
          return true;
        }
        node = node.parent;
      }
      return false;
    }

    /**
     * Checks if the prop has spread operator.
     * @param {ASTNode} node The AST node being marked.
     * @returns {Boolean} True if the prop has spread operator, false if not.
     */
    function hasSpreadOperator(node) {
      const tokens = sourceCode.getTokens(node);
      return tokens.length && tokens[0].value === '...';
    }

    /**
     * Removes quotes from around an identifier.
     * @param {string} the identifier to strip
     */
    function stripQuotes(string) {
      return string.replace(/^\'|\'$/g, '');
    }

    /**
     * Retrieve the name of a key node
     * @param {ASTNode} node The AST node with the key.
     * @return {string} the name of the key
     */
    function getKeyValue(node) {
      if (node.type === 'ObjectTypeProperty') {
        const tokens = context.getFirstTokens(node, 2);
        return (tokens[0].value === '+' || tokens[0].value === '-'
          ? tokens[1].value
          : stripQuotes(tokens[0].value)
        );
      }
      const key = node.key || node.argument;
      return key.type === 'Identifier' ? key.name : key.value;
    }

    /**
     * Retrieve the name of a property node
     * @param {ASTNode} node The AST node with the property.
     * @return {string} the name of the property or undefined if not found
     */
    function getPropertyName(node) {
      const isDirectProp = DIRECT_PROPS_REGEX.test(sourceCode.getText(node));
      const isInClassComponent = utils.getParentES6Component() || utils.getParentES5Component();
      const isNotInConstructor = !inConstructor();
      const isNotInComponentWillReceiveProps = !inComponentWillReceiveProps();
      const isNotInShouldComponentUpdate = !inShouldComponentUpdate();
      if (isDirectProp && isInClassComponent && isNotInConstructor && isNotInComponentWillReceiveProps
        && isNotInShouldComponentUpdate) {
        return void 0;
      }
      if (!isDirectProp) {
        node = node.parent;
      }
      const property = node.property;
      if (property) {
        switch (property.type) {
          case 'Identifier':
            if (node.computed) {
              return '__COMPUTED_PROP__';
            }
            return property.name;
          case 'MemberExpression':
            return void 0;
          case 'Literal':
            // Accept computed properties that are literal strings
            if (typeof property.value === 'string') {
              return property.value;
            }
            // falls through
          default:
            if (node.computed) {
              return '__COMPUTED_PROP__';
            }
            break;
        }
      }
      return void 0;
    }

    /**
     * Mark a prop type as used
     * @param {ASTNode} node The AST node being marked.
     */
    function markPropTypesAsUsed(node, parentNames) {
      parentNames = parentNames || [];
      let type;
      let name;
      let allNames;
      let properties;
      switch (node.type) {
        case 'MemberExpression':
          name = getPropertyName(node);
          if (name) {
            allNames = parentNames.concat(name);
            if (node.parent.type === 'MemberExpression') {
              markPropTypesAsUsed(node.parent, allNames);
            }
            // Do not mark computed props as used.
            type = name !== '__COMPUTED_PROP__' ? 'direct' : null;
          } else if (
            node.parent.id &&
            node.parent.id.properties &&
            node.parent.id.properties.length &&
            getKeyValue(node.parent.id.properties[0])
          ) {
            type = 'destructuring';
            properties = node.parent.id.properties;
          }
          break;
        case 'ArrowFunctionExpression':
        case 'FunctionDeclaration':
        case 'FunctionExpression':
          type = 'destructuring';
          properties = node.params[0].properties;
          break;
        case 'MethodDefinition':
          const destructuring = node.value && node.value.params && node.value.params[0] && node.value.params[0].type === 'ObjectPattern';
          if (destructuring) {
            type = 'destructuring';
            properties = node.value.params[0].properties;
            break;
          } else {
            return;
          }
        case 'VariableDeclarator':
          for (let i = 0, j = node.id.properties.length; i < j; i++) {
            // let {props: {firstname}} = this
            const thisDestructuring = (
              !hasSpreadOperator(node.id.properties[i]) &&
              (PROPS_REGEX.test(node.id.properties[i].key.name) || PROPS_REGEX.test(node.id.properties[i].key.value)) &&
              node.id.properties[i].value.type === 'ObjectPattern'
            );
            // let {firstname} = props
            const directDestructuring =
              PROPS_REGEX.test(node.init.name) &&
              (utils.getParentStatelessComponent() || inConstructor() || inComponentWillReceiveProps())
            ;

            if (thisDestructuring) {
              properties = node.id.properties[i].value.properties;
            } else if (directDestructuring) {
              properties = node.id.properties;
            } else {
              continue;
            }
            type = 'destructuring';
            break;
          }
          break;
        default:
          throw new Error(`${node.type} ASTNodes are not handled by markPropTypesAsUsed`);
      }

      const component = components.get(utils.getParentComponent());
      const usedPropTypes = (component && component.usedPropTypes || []).slice();

      switch (type) {
        case 'direct':
          // Ignore Object methods
          if (Object.prototype[name]) {
            break;
          }

          const isDirectProp = DIRECT_PROPS_REGEX.test(sourceCode.getText(node));

          usedPropTypes.push({
            name: name,
            allNames: allNames,
            node: (
              !isDirectProp && !inConstructor() && !inComponentWillReceiveProps() ?
                node.parent.property :
                node.property
            )
          });
          break;
        case 'destructuring':
          for (let k = 0, l = properties.length; k < l; k++) {
            if (hasSpreadOperator(properties[k]) || properties[k].computed) {
              continue;
            }
            const propName = getKeyValue(properties[k]);

            let currentNode = node;
            allNames = [];
            while (currentNode.property && !PROPS_REGEX.test(currentNode.property.name)) {
              allNames.unshift(currentNode.property.name);
              currentNode = currentNode.object;
            }
            allNames.push(propName);

            if (propName) {
              usedPropTypes.push({
                name: propName,
                allNames: allNames,
                node: properties[k]
              });
            }
          }
          break;
        default:
          break;
      }

      components.set(node, {
        usedPropTypes: usedPropTypes
      });
    }

    /**
     * Reports undeclared proptypes for a given component
     * @param {Object} component The component to process
     */
    function reportUndeclaredPropTypes(component) {
      let allNames;
      for (let i = 0, j = component.usedPropTypes.length; i < j; i++) {
        allNames = component.usedPropTypes[i].allNames;
        if (
          isIgnored(allNames[0]) ||
          isDeclaredInComponent(component.node, allNames)
        ) {
          continue;
        }
        context.report(
          component.usedPropTypes[i].node,
          MISSING_MESSAGE, {
            name: allNames.join('.').replace(/\.__COMPUTED_PROP__/g, '[]')
          }
        );
      }
    }

    /**
     * @param {ASTNode} node We expect either an ArrowFunctionExpression,
     *   FunctionDeclaration, or FunctionExpression
     */
    function markDestructuredFunctionArgumentsAsUsed(node) {
      const destructuring = node.params && node.params[0] && node.params[0].type === 'ObjectPattern';
      if (destructuring && components.get(node)) {
        markPropTypesAsUsed(node);
      }
    }

    // --------------------------------------------------------------------------
    // Public
    // --------------------------------------------------------------------------

    return {
      VariableDeclarator: function(node) {
        const destructuring = node.init && node.id && node.id.type === 'ObjectPattern';
        // let {props: {firstname}} = this
        const thisDestructuring = destructuring && node.init.type === 'ThisExpression';
        // let {firstname} = props
        const directDestructuring =
          destructuring &&
          PROPS_REGEX.test(node.init.name) &&
          (utils.getParentStatelessComponent() || inConstructor() || inComponentWillReceiveProps())
        ;

        if (!thisDestructuring && !directDestructuring) {
          return;
        }
        markPropTypesAsUsed(node);
      },

      FunctionDeclaration: markDestructuredFunctionArgumentsAsUsed,

      ArrowFunctionExpression: markDestructuredFunctionArgumentsAsUsed,

      FunctionExpression: function(node) {
        if (node.parent.type === 'MethodDefinition') {
          return;
        }
        markDestructuredFunctionArgumentsAsUsed(node);
      },

      MemberExpression: function(node) {
        if (isPropTypesUsage(node)) {
          markPropTypesAsUsed(node);
        }
      },

      MethodDefinition: function(node) {
        const destructuring = node.value && node.value.params && node.value.params[0] && node.value.params[0].type === 'ObjectPattern';
        if (node.key.name === 'componentWillReceiveProps' && destructuring) {
          markPropTypesAsUsed(node);
        }

        if (node.key.name === 'shouldComponentUpdate' && destructuring) {
          markPropTypesAsUsed(node);
        }
      },

      'Program:exit': function() {
        const list = components.list();
        // Report undeclared proptypes for all classes
        for (const component in list) {
          if (!has(list, component) || !mustBeValidated(list[component])) {
            continue;
          }
          reportUndeclaredPropTypes(list[component]);
        }
      }
    };
  })
};
