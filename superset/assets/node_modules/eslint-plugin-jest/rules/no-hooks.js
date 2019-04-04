'use strict';

const getDocsUrl = require('./util').getDocsUrl;

module.exports = {
  meta: {
    docs: {
      url: getDocsUrl(__filename),
    },
  },
  schema: [
    {
      type: 'object',
      properties: {
        allow: {
          type: 'array',
          contains: ['beforeAll', 'beforeEach', 'afterAll', 'afterEach'],
        },
      },
      additionalProperties: false,
    },
  ],
  create(context) {
    const testHookNames = Object.assign(Object.create(null), {
      beforeAll: true,
      beforeEach: true,
      afterAll: true,
      afterEach: true,
    });

    const whitelistedHookNames = (
      context.options[0] || { allow: [] }
    ).allow.reduce((hashMap, value) => {
      hashMap[value] = true;
      return hashMap;
    }, Object.create(null));

    const isHook = node => testHookNames[node.callee.name];
    const isWhitelisted = node => whitelistedHookNames[node.callee.name];

    return {
      CallExpression(node) {
        if (isHook(node) && !isWhitelisted(node)) {
          context.report({
            node,
            message: "Unexpected '{{ hookName }}' hook",
            data: { hookName: node.callee.name },
          });
        }
      },
    };
  },
};
