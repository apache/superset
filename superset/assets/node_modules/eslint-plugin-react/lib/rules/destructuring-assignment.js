/**
 * @fileoverview Enforce consistent usage of destructuring assignment of props, state, and context.
 **/
'use strict';

const Components = require('../util/Components');
const docsUrl = require('../util/docsUrl');

const DEFAULT_OPTION = 'always';

module.exports = {
  meta: {
    docs: {
      description: 'Enforce consistent usage of destructuring assignment of props, state, and context',
      category: 'Stylistic Issues',
      recommended: false,
      url: docsUrl('destructuring-assignment')
    },
    schema: [{
      type: 'string',
      enum: [
        'always',
        'never'
      ]
    }, {
      type: 'object',
      properties: {
        ignoreClassFields: {
          type: 'boolean'
        }
      },
      additionalProperties: false
    }]
  },

  create: Components.detect((context, components, utils) => {
    const configuration = context.options[0] || DEFAULT_OPTION;
    const ignoreClassFields = context.options[1] && context.options[1].ignoreClassFields === true || false;

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
     * @param {ASTNode} node We expect either an ArrowFunctionExpression,
     *   FunctionDeclaration, or FunctionExpression
     */
    function handleStatelessComponent(node) {
      const destructuringProps = node.params && node.params[0] && node.params[0].type === 'ObjectPattern';
      const destructuringContext = node.params && node.params[1] && node.params[1].type === 'ObjectPattern';

      if (destructuringProps && components.get(node) && configuration === 'never') {
        context.report({
          node: node,
          message: 'Must never use destructuring props assignment in SFC argument'
        });
      } else if (destructuringContext && components.get(node) && configuration === 'never') {
        context.report({
          node: node,
          message: 'Must never use destructuring context assignment in SFC argument'
        });
      }
    }

    function handleSFCUsage(node) {
      // props.aProp || context.aProp
      const isPropUsed = (node.object.name === 'props' || node.object.name === 'context') && !isAssignmentToProp(node);
      if (isPropUsed && configuration === 'always') {
        context.report({
          node: node,
          message: `Must use destructuring ${node.object.name} assignment`
        });
      }
    }

    function handleClassUsage(node) {
      // this.props.Aprop || this.context.aProp || this.state.aState
      const isPropUsed = (
        node.object.type === 'MemberExpression' && node.object.object.type === 'ThisExpression' &&
        (node.object.property.name === 'props' || node.object.property.name === 'context' || node.object.property.name === 'state') &&
        !isAssignmentToProp(node)
      );

      if (
        isPropUsed && configuration === 'always' &&
        !(ignoreClassFields && node.parent.type === 'ClassProperty')
      ) {
        context.report({
          node: node,
          message: `Must use destructuring ${node.object.property.name} assignment`
        });
      }
    }

    return {

      FunctionDeclaration: handleStatelessComponent,

      ArrowFunctionExpression: handleStatelessComponent,

      FunctionExpression: handleStatelessComponent,

      MemberExpression: function(node) {
        const SFCComponent = components.get(context.getScope(node).block);
        const classComponent = utils.getParentComponent(node);
        if (SFCComponent) {
          handleSFCUsage(node);
        }
        if (classComponent) {
          handleClassUsage(node, classComponent);
        }
      },

      VariableDeclarator: function(node) {
        const classComponent = utils.getParentComponent(node);
        const SFCComponent = components.get(context.getScope(node).block);

        const destructuring = (node.init && node.id && node.id.type === 'ObjectPattern');
        // let {foo} = props;
        const destructuringSFC = destructuring && (node.init.name === 'props' || node.init.name === 'context');
        // let {foo} = this.props;
        const destructuringClass = destructuring && node.init.object && node.init.object.type === 'ThisExpression' && (
          node.init.property.name === 'props' || node.init.property.name === 'context' || node.init.property.name === 'state'
        );

        if (SFCComponent && destructuringSFC && configuration === 'never') {
          context.report({
            node: node,
            message: `Must never use destructuring ${node.init.name} assignment`
          });
        }

        if (
          classComponent && destructuringClass && configuration === 'never' &&
          !(ignoreClassFields && node.parent.type === 'ClassProperty')
        ) {
          context.report({
            node: node,
            message: `Must never use destructuring ${node.init.property.name} assignment`
          });
        }
      }
    };
  })
};
