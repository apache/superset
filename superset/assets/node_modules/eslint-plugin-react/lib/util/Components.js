/**
 * @fileoverview Utility class and functions for React components detection
 * @author Yannick Croissant
 */
'use strict';

const has = require('has');
const util = require('util');
const doctrine = require('doctrine');
const variableUtil = require('./variable');
const pragmaUtil = require('./pragma');
const astUtil = require('./ast');
const propTypes = require('./propTypes');

function getId(node) {
  return node && node.range.join(':');
}

function usedPropTypesAreEquivalent(propA, propB) {
  if (propA.name === propB.name) {
    if (!propA.allNames && !propB.allNames) {
      return true;
    } else if (Array.isArray(propA.allNames) && Array.isArray(propB.allNames) && propA.allNames.join('') === propB.allNames.join('')) {
      return true;
    }
    return false;
  }
  return false;
}

function mergeUsedPropTypes(propsList, newPropsList) {
  const propsToAdd = [];
  newPropsList.forEach(newProp => {
    const newPropisAlreadyInTheList = propsList.some(prop => usedPropTypesAreEquivalent(prop, newProp));
    if (!newPropisAlreadyInTheList) {
      propsToAdd.push(newProp);
    }
  });
  return propsList.concat(propsToAdd);
}

/**
 * Components
 */
class Components {
  constructor() {
    this._list = {};
  }

  /**
   * Add a node to the components list, or update it if it's already in the list
   *
   * @param {ASTNode} node The AST node being added.
   * @param {Number} confidence Confidence in the component detection (0=banned, 1=maybe, 2=yes)
   * @returns {Object} Added component object
   */
  add(node, confidence) {
    const id = getId(node);
    if (this._list[id]) {
      if (confidence === 0 || this._list[id].confidence === 0) {
        this._list[id].confidence = 0;
      } else {
        this._list[id].confidence = Math.max(this._list[id].confidence, confidence);
      }
      return this._list[id];
    }
    this._list[id] = {
      node: node,
      confidence: confidence
    };
    return this._list[id];
  }

  /**
   * Find a component in the list using its node
   *
   * @param {ASTNode} node The AST node being searched.
   * @returns {Object} Component object, undefined if the component is not found or has confidence value of 0.
   */
  get(node) {
    const id = getId(node);
    if (this._list[id] && this._list[id].confidence >= 1) {
      return this._list[id];
    }
    return null;
  }

  /**
   * Update a component in the list
   *
   * @param {ASTNode} node The AST node being updated.
   * @param {Object} props Additional properties to add to the component.
   */
  set(node, props) {
    while (node && !this._list[getId(node)]) {
      node = node.parent;
    }
    if (!node) {
      return;
    }
    const id = getId(node);
    let copyUsedPropTypes;
    if (this._list[id]) {
      // usedPropTypes is an array. _extend replaces existing array with a new one which caused issue #1309.
      // preserving original array so it can be merged later on.
      copyUsedPropTypes = this._list[id].usedPropTypes && this._list[id].usedPropTypes.slice();
    }
    this._list[id] = util._extend(this._list[id], props);
    if (this._list[id] && props.usedPropTypes) {
      this._list[id].usedPropTypes = mergeUsedPropTypes(copyUsedPropTypes || [], props.usedPropTypes);
    }
  }

  /**
   * Return the components list
   * Components for which we are not confident are not returned
   *
   * @returns {Object} Components list
   */
  list() {
    const list = {};
    const usedPropTypes = {};

    // Find props used in components for which we are not confident
    for (const i in this._list) {
      if (!has(this._list, i) || this._list[i].confidence >= 2) {
        continue;
      }
      let component = null;
      let node = null;
      node = this._list[i].node;
      while (!component && node.parent) {
        node = node.parent;
        // Stop moving up if we reach a decorator
        if (node.type === 'Decorator') {
          break;
        }
        component = this.get(node);
      }
      if (component) {
        const newUsedProps = (this._list[i].usedPropTypes || []).filter(propType => !propType.node || propType.node.kind !== 'init');

        const componentId = getId(component.node);
        usedPropTypes[componentId] = (usedPropTypes[componentId] || []).concat(newUsedProps);
      }
    }

    // Assign used props in not confident components to the parent component
    for (const j in this._list) {
      if (!has(this._list, j) || this._list[j].confidence < 2) {
        continue;
      }
      const id = getId(this._list[j].node);
      list[j] = this._list[j];
      if (usedPropTypes[id]) {
        list[j].usedPropTypes = (list[j].usedPropTypes || []).concat(usedPropTypes[id]);
      }
    }
    return list;
  }

  /**
   * Return the length of the components list
   * Components for which we are not confident are not counted
   *
   * @returns {Number} Components list length
   */
  length() {
    let length = 0;
    for (const i in this._list) {
      if (!has(this._list, i) || this._list[i].confidence < 2) {
        continue;
      }
      length++;
    }
    return length;
  }
}

function componentRule(rule, context) {
  const createClass = pragmaUtil.getCreateClassFromContext(context);
  const pragma = pragmaUtil.getFromContext(context);
  const sourceCode = context.getSourceCode();
  const components = new Components();

  // Utilities for component detection
  const utils = {

    /**
     * Check if the node is a React ES5 component
     *
     * @param {ASTNode} node The AST node being checked.
     * @returns {Boolean} True if the node is a React ES5 component, false if not
     */
    isES5Component: function(node) {
      if (!node.parent) {
        return false;
      }
      return new RegExp(`^(${pragma}\\.)?${createClass}$`).test(sourceCode.getText(node.parent.callee));
    },

    /**
     * Check if the node is a React ES6 component
     *
     * @param {ASTNode} node The AST node being checked.
     * @returns {Boolean} True if the node is a React ES6 component, false if not
     */
    isES6Component: function(node) {
      if (utils.isExplicitComponent(node)) {
        return true;
      }

      if (!node.superClass) {
        return false;
      }
      return new RegExp(`^(${pragma}\\.)?(Pure)?Component$`).test(sourceCode.getText(node.superClass));
    },

    /**
     * Check if the node is explicitly declared as a descendant of a React Component
     *
     * @param {ASTNode} node The AST node being checked (can be a ReturnStatement or an ArrowFunctionExpression).
     * @returns {Boolean} True if the node is explicitly declared as a descendant of a React Component, false if not
     */
    isExplicitComponent: function(node) {
      let comment;
      // Sometimes the passed node may not have been parsed yet by eslint, and this function call crashes.
      // Can be removed when eslint sets "parent" property for all nodes on initial AST traversal: https://github.com/eslint/eslint-scope/issues/27
      // eslint-disable-next-line no-warning-comments
      // FIXME: Remove try/catch when https://github.com/eslint/eslint-scope/issues/27 is implemented.
      try {
        comment = sourceCode.getJSDocComment(node);
      } catch (e) {
        comment = null;
      }

      if (comment === null) {
        return false;
      }

      const commentAst = doctrine.parse(comment.value, {
        unwrap: true,
        tags: ['extends', 'augments']
      });

      const relevantTags = commentAst.tags.filter(tag => tag.name === 'React.Component' || tag.name === 'React.PureComponent');

      return relevantTags.length > 0;
    },

    /**
     * Checks to see if our component extends React.PureComponent
     *
     * @param {ASTNode} node The AST node being checked.
     * @returns {Boolean} True if node extends React.PureComponent, false if not
     */
    isPureComponent: function (node) {
      if (node.superClass) {
        return new RegExp(`^(${pragma}\\.)?PureComponent$`).test(sourceCode.getText(node.superClass));
      }
      return false;
    },

    /**
     * Check if createElement is destructured from React import
     *
     * @returns {Boolean} True if createElement is destructured from React
     */
    hasDestructuredReactCreateElement: function() {
      const variables = variableUtil.variablesInScope(context);
      const variable = variableUtil.getVariable(variables, 'createElement');
      if (variable) {
        const map = variable.scope.set;
        if (map.has('React')) {
          return true;
        }
      }
      return false;
    },

    /**
     * Checks to see if node is called within React.createElement
     *
     * @param {ASTNode} node The AST node being checked.
     * @returns {Boolean} True if React.createElement called
     */
    isReactCreateElement: function(node) {
      const calledOnReact = (
        node &&
        node.callee &&
        node.callee.object &&
        node.callee.object.name === 'React' &&
        node.callee.property &&
        node.callee.property.name === 'createElement'
      );

      const calledDirectly = (
        node &&
        node.callee &&
        node.callee.name === 'createElement'
      );

      if (this.hasDestructuredReactCreateElement()) {
        return calledDirectly || calledOnReact;
      }
      return calledOnReact;
    },

    getReturnPropertyAndNode(ASTnode) {
      let property;
      let node = ASTnode;
      switch (node.type) {
        case 'ReturnStatement':
          property = 'argument';
          break;
        case 'ArrowFunctionExpression':
          property = 'body';
          if (node[property] && node[property].type === 'BlockStatement') {
            node = utils.findReturnStatement(node);
            property = 'argument';
          }
          break;
        default:
          node = utils.findReturnStatement(node);
          property = 'argument';
      }
      return {
        node: node,
        property: property
      };
    },

    /**
     * Check if the node is returning JSX
     *
     * @param {ASTNode} ASTnode The AST node being checked
     * @param {Boolean} strict If true, in a ternary condition the node must return JSX in both cases
     * @returns {Boolean} True if the node is returning JSX, false if not
     */
    isReturningJSX: function(ASTnode, strict) {
      const nodeAndProperty = utils.getReturnPropertyAndNode(ASTnode);
      const node = nodeAndProperty.node;
      const property = nodeAndProperty.property;

      if (!node) {
        return false;
      }

      const returnsConditionalJSXConsequent =
        node[property] &&
        node[property].type === 'ConditionalExpression' &&
        node[property].consequent.type === 'JSXElement'
      ;
      const returnsConditionalJSXAlternate =
        node[property] &&
        node[property].type === 'ConditionalExpression' &&
        node[property].alternate.type === 'JSXElement'
      ;
      const returnsConditionalJSX =
        strict ?
          (returnsConditionalJSXConsequent && returnsConditionalJSXAlternate) :
          (returnsConditionalJSXConsequent || returnsConditionalJSXAlternate);

      const returnsJSX =
        node[property] &&
        node[property].type === 'JSXElement'
      ;
      const returnsReactCreateElement = this.isReactCreateElement(node[property]);

      return Boolean(
        returnsConditionalJSX ||
        returnsJSX ||
        returnsReactCreateElement
      );
    },

    /**
     * Check if the node is returning null
     *
     * @param {ASTNode} ASTnode The AST node being checked
     * @returns {Boolean} True if the node is returning null, false if not
     */
    isReturningNull(ASTnode) {
      const nodeAndProperty = utils.getReturnPropertyAndNode(ASTnode);
      const property = nodeAndProperty.property;
      const node = nodeAndProperty.node;

      if (!node) {
        return false;
      }

      return node[property] && node[property].value === null;
    },

    /**
     * Check if the node is returning JSX or null
     *
     * @param {ASTNode} ASTnode The AST node being checked
     * @param {Boolean} strict If true, in a ternary condition the node must return JSX in both cases
     * @returns {Boolean} True if the node is returning JSX or null, false if not
     */
    isReturningJSXOrNull(ASTNode, strict) {
      return utils.isReturningJSX(ASTNode, strict) || utils.isReturningNull(ASTNode);
    },

    /**
     * Find a return statment in the current node
     *
     * @param {ASTNode} ASTnode The AST node being checked
     */
    findReturnStatement: astUtil.findReturnStatement,

    /**
     * Get the parent component node from the current scope
     *
     * @returns {ASTNode} component node, null if we are not in a component
     */
    getParentComponent: function() {
      return (
        utils.getParentES6Component() ||
        utils.getParentES5Component() ||
        utils.getParentStatelessComponent()
      );
    },

    /**
     * Get the parent ES5 component node from the current scope
     *
     * @returns {ASTNode} component node, null if we are not in a component
     */
    getParentES5Component: function() {
      let scope = context.getScope();
      while (scope) {
        const node = scope.block && scope.block.parent && scope.block.parent.parent;
        if (node && utils.isES5Component(node)) {
          return node;
        }
        scope = scope.upper;
      }
      return null;
    },

    /**
     * Get the parent ES6 component node from the current scope
     *
     * @returns {ASTNode} component node, null if we are not in a component
     */
    getParentES6Component: function() {
      let scope = context.getScope();
      while (scope && scope.type !== 'class') {
        scope = scope.upper;
      }
      const node = scope && scope.block;
      if (!node || !utils.isES6Component(node)) {
        return null;
      }
      return node;
    },

    /**
     * Get the parent stateless component node from the current scope
     *
     * @returns {ASTNode} component node, null if we are not in a component
     */
    getParentStatelessComponent: function() {
      let scope = context.getScope();
      while (scope) {
        const node = scope.block;
        const isClass = node.type === 'ClassExpression';
        const isFunction = /Function/.test(node.type); // Functions
        const isMethod = node.parent && node.parent.type === 'MethodDefinition'; // Classes methods
        const isArgument = node.parent && node.parent.type === 'CallExpression'; // Arguments (callback, etc.)
        // Attribute Expressions inside JSX Elements (<button onClick={() => props.handleClick()}></button>)
        const isJSXExpressionContainer = node.parent && node.parent.type === 'JSXExpressionContainer';
        // Stop moving up if we reach a class or an argument (like a callback)
        if (isClass || isArgument) {
          return null;
        }
        // Return the node if it is a function that is not a class method and is not inside a JSX Element
        if (isFunction && !isMethod && !isJSXExpressionContainer && utils.isReturningJSXOrNull(node)) {
          return node;
        }
        scope = scope.upper;
      }
      return null;
    },

    /**
     * Get the related component from a node
     *
     * @param {ASTNode} node The AST node being checked (must be a MemberExpression).
     * @returns {ASTNode} component node, null if we cannot find the component
     */
    getRelatedComponent: function(node) {
      let i;
      let j;
      let k;
      let l;
      let componentNode;
      // Get the component path
      const componentPath = [];
      while (node) {
        if (node.property && node.property.type === 'Identifier') {
          componentPath.push(node.property.name);
        }
        if (node.object && node.object.type === 'Identifier') {
          componentPath.push(node.object.name);
        }
        node = node.object;
      }
      componentPath.reverse();
      const componentName = componentPath.slice(0, componentPath.length - 1).join('.');

      // Find the variable in the current scope
      const variableName = componentPath.shift();
      if (!variableName) {
        return null;
      }
      let variableInScope;
      const variables = variableUtil.variablesInScope(context);
      for (i = 0, j = variables.length; i < j; i++) {
        if (variables[i].name === variableName) {
          variableInScope = variables[i];
          break;
        }
      }
      if (!variableInScope) {
        return null;
      }

      // Try to find the component using variable references
      const refs = variableInScope.references;
      let refId;
      for (i = 0, j = refs.length; i < j; i++) {
        refId = refs[i].identifier;
        if (refId.parent && refId.parent.type === 'MemberExpression') {
          refId = refId.parent;
        }
        if (sourceCode.getText(refId) !== componentName) {
          continue;
        }
        if (refId.type === 'MemberExpression') {
          componentNode = refId.parent.right;
        } else if (refId.parent && refId.parent.type === 'VariableDeclarator') {
          componentNode = refId.parent.init;
        }
        break;
      }

      if (componentNode) {
        // Return the component
        return components.add(componentNode, 1);
      }

      // Try to find the component using variable declarations
      let defInScope;
      const defs = variableInScope.defs;
      for (i = 0, j = defs.length; i < j; i++) {
        if (defs[i].type === 'ClassName' || defs[i].type === 'FunctionName' || defs[i].type === 'Variable') {
          defInScope = defs[i];
          break;
        }
      }
      if (!defInScope || !defInScope.node) {
        return null;
      }
      componentNode = defInScope.node.init || defInScope.node;

      // Traverse the node properties to the component declaration
      for (i = 0, j = componentPath.length; i < j; i++) {
        if (!componentNode.properties) {
          continue;
        }
        for (k = 0, l = componentNode.properties.length; k < l; k++) {
          if (componentNode.properties[k].key && componentNode.properties[k].key.name === componentPath[i]) {
            componentNode = componentNode.properties[k];
            break;
          }
        }
        if (!componentNode || !componentNode.value) {
          return null;
        }
        componentNode = componentNode.value;
      }

      // Return the component
      return components.add(componentNode, 1);
    }
  };

  // Component detection instructions
  const detectionInstructions = {
    ClassExpression: function(node) {
      if (!utils.isES6Component(node)) {
        return;
      }
      components.add(node, 2);
    },

    ClassDeclaration: function(node) {
      if (!utils.isES6Component(node)) {
        return;
      }
      components.add(node, 2);
    },

    ClassProperty: function(node) {
      node = utils.getParentComponent();
      if (!node) {
        return;
      }
      components.add(node, 2);
    },

    ObjectExpression: function(node) {
      if (!utils.isES5Component(node)) {
        return;
      }
      components.add(node, 2);
    },

    FunctionExpression: function(node) {
      if (node.async) {
        components.add(node, 0);
        return;
      }
      const component = utils.getParentComponent();
      if (
        !component ||
        (component.parent && component.parent.type === 'JSXExpressionContainer')
      ) {
        // Ban the node if we cannot find a parent component
        components.add(node, 0);
        return;
      }
      components.add(component, 1);
    },

    FunctionDeclaration: function(node) {
      if (node.async) {
        components.add(node, 0);
        return;
      }
      node = utils.getParentComponent();
      if (!node) {
        return;
      }
      components.add(node, 1);
    },

    ArrowFunctionExpression: function(node) {
      if (node.async) {
        components.add(node, 0);
        return;
      }
      const component = utils.getParentComponent();
      if (
        !component ||
        (component.parent && component.parent.type === 'JSXExpressionContainer')
      ) {
        // Ban the node if we cannot find a parent component
        components.add(node, 0);
        return;
      }
      if (component.expression && utils.isReturningJSX(component)) {
        components.add(component, 2);
      } else {
        components.add(component, 1);
      }
    },

    ThisExpression: function(node) {
      const component = utils.getParentComponent();
      if (!component || !/Function/.test(component.type) || !node.parent.property) {
        return;
      }
      // Ban functions accessing a property on a ThisExpression
      components.add(node, 0);
    },

    ReturnStatement: function(node) {
      if (!utils.isReturningJSX(node)) {
        return;
      }
      node = utils.getParentComponent();
      if (!node) {
        const scope = context.getScope();
        components.add(scope.block, 1);
        return;
      }
      components.add(node, 2);
    }
  };

  // Update the provided rule instructions to add the component detection
  const ruleInstructions = rule(context, components, utils);
  const updatedRuleInstructions = util._extend({}, ruleInstructions);
  const propTypesInstructions = propTypes(context, components, utils);
  const allKeys = new Set(Object.keys(detectionInstructions).concat(Object.keys(propTypesInstructions)));
  allKeys.forEach(instruction => {
    updatedRuleInstructions[instruction] = function(node) {
      if (instruction in detectionInstructions) {
        detectionInstructions[instruction](node);
      }
      if (instruction in propTypesInstructions) {
        propTypesInstructions[instruction](node);
      }
      return ruleInstructions[instruction] ? ruleInstructions[instruction](node) : void 0;
    };
  });

  // Return the updated rule instructions
  return updatedRuleInstructions;
}

module.exports = Object.assign(Components, {
  detect(rule) {
    return componentRule.bind(this, rule);
  }
});
