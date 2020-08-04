/**
 * @fileoverview Prevent waiting for arbitrary time periods
 * @author Elad Shahar
 */

'use strict'

module.exports = {
  meta: {
    docs: {
      description: 'Prevent waiting for arbitrary time periods',
      category: 'Possible Errors',
      recommended: true,
      url: 'https://docs.cypress.io/guides/references/best-practices.html#Unnecessary-Waiting',
    },
    schema: [],
    messages: {
      unexpected: 'Do not wait for arbitrary time periods',
    },
  },
  create (context) {
    return {
      CallExpression (node) {
        if (isCallingCyWait(node) && isNumberArgument(node)) {
          context.report({ node, messageId: 'unexpected' })
        }
      },
    }
  },
}

function isCallingCyWait (node) {
  return node.callee.type === 'MemberExpression' &&
         node.callee.object.type === 'Identifier' &&
         node.callee.object.name === 'cy' &&
         node.callee.property.type === 'Identifier' &&
         node.callee.property.name === 'wait'
}

function isNumberArgument (node) {
  return node.arguments.length > 0 &&
         node.arguments[0].type === 'Literal' &&
         typeof (node.arguments[0].value) === 'number'
}
