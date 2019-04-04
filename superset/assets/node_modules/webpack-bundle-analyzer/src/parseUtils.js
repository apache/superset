const fs = require('fs');
const _ = require('lodash');
const acorn = require('acorn');
const walk = require('acorn/dist/walk');

module.exports = {
  parseBundle
};

function parseBundle(bundlePath) {
  const content = fs.readFileSync(bundlePath, 'utf8');
  const ast = acorn.parse(content, {
    sourceType: 'script',
    // I believe in a bright future of ECMAScript!
    // Actually, it's set to `2050` to support the latest ECMAScript version that currently exists.
    // Seems like `acorn` supports such weird option value.
    ecmaVersion: 2050
  });

  const walkState = {
    locations: null
  };

  walk.recursive(
    ast,
    walkState,
    {
      CallExpression(node, state, c) {
        if (state.locations) return;

        const args = node.arguments;

        // Main chunk with webpack loader.
        // Modules are stored in first argument:
        // (function (...) {...})(<modules>)
        if (
          node.callee.type === 'FunctionExpression' &&
          !node.callee.id &&
          args.length === 1 &&
          isSimpleModulesList(args[0])
        ) {
          state.locations = getModulesLocations(args[0]);
          return;
        }

        // Async Webpack < v4 chunk without webpack loader.
        // webpackJsonp([<chunks>], <modules>, ...)
        // As function name may be changed with `output.jsonpFunction` option we can't rely on it's default name.
        if (
          node.callee.type === 'Identifier' &&
          mayBeAsyncChunkArguments(args) &&
          isModulesList(args[1])
        ) {
          state.locations = getModulesLocations(args[1]);
          return;
        }

        // Async Webpack v4 chunk without webpack loader.
        // (window.webpackJsonp=window.webpackJsonp||[]).push([[<chunks>], <modules>, ...]);
        // As function name may be changed with `output.jsonpFunction` option we can't rely on it's default name.
        if (isAsyncChunkPushExpression(node)) {
          state.locations = getModulesLocations(args[0].elements[1]);
          return;
        }

        // Walking into arguments because some of plugins (e.g. `DedupePlugin`) or some Webpack
        // features (e.g. `umd` library output) can wrap modules list into additional IIFE.
        _.each(args, arg => c(arg, state));
      }
    }
  );

  let modules;

  if (walkState.locations) {
    modules = _.mapValues(walkState.locations,
      loc => content.slice(loc.start, loc.end)
    );
  } else {
    modules = {};
  }

  return {
    src: content,
    modules
  };
}

function isModulesList(node) {
  return (
    isSimpleModulesList(node) ||
    // Modules are contained in expression `Array([minimum ID]).concat([<module>, <module>, ...])`
    isOptimizedModulesArray(node)
  );
}

function isSimpleModulesList(node) {
  return (
    // Modules are contained in hash. Keys are module ids.
    isModulesHash(node) ||
    // Modules are contained in array. Indexes are module ids.
    isModulesArray(node)
  );
}

function isModulesHash(node) {
  return (
    node.type === 'ObjectExpression' &&
    _(node.properties)
      .map('value')
      .every(isModuleWrapper)
  );
}

function isModulesArray(node) {
  return (
    node.type === 'ArrayExpression' &&
    _.every(node.elements, elem =>
      // Some of array items may be skipped because there is no module with such id
      !elem ||
      isModuleWrapper(elem)
    )
  );
}

function isOptimizedModulesArray(node) {
  // Checking whether modules are contained in `Array(<minimum ID>).concat(...modules)` array:
  // https://github.com/webpack/webpack/blob/v1.14.0/lib/Template.js#L91
  // The `<minimum ID>` + array indexes are module ids
  return (
    node.type === 'CallExpression' &&
    node.callee.type === 'MemberExpression' &&
    // Make sure the object called is `Array(<some number>)`
    node.callee.object.type === 'CallExpression' &&
    node.callee.object.callee.type === 'Identifier' &&
    node.callee.object.callee.name === 'Array' &&
    node.callee.object.arguments.length === 1 &&
    isNumericId(node.callee.object.arguments[0]) &&
    // Make sure the property X called for `Array(<some number>).X` is `concat`
    node.callee.property.type === 'Identifier' &&
    node.callee.property.name === 'concat' &&
    // Make sure exactly one array is passed in to `concat`
    node.arguments.length === 1 &&
    isModulesArray(node.arguments[0])
  );
}

function isModuleWrapper(node) {
  return (
    // It's an anonymous function expression that wraps module
    ((node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression') && !node.id) ||
    // If `DedupePlugin` is used it can be an ID of duplicated module...
    isModuleId(node) ||
    // or an array of shape [<module_id>, ...args]
    (node.type === 'ArrayExpression' && node.elements.length > 1 && isModuleId(node.elements[0]))
  );
}

function isModuleId(node) {
  return (node.type === 'Literal' && (isNumericId(node) || typeof node.value === 'string'));
}

function isNumericId(node) {
  return (node.type === 'Literal' && Number.isInteger(node.value) && node.value >= 0);
}

function isChunkIds(node) {
  // Array of numeric or string ids. Chunk IDs are strings when NamedChunksPlugin is used
  return (
    node.type === 'ArrayExpression' &&
    _.every(node.elements, isModuleId)
  );
}

function isAsyncChunkPushExpression(node) {
  const {
    callee,
    arguments: args
  } = node;

  return (
    callee.type === 'MemberExpression' &&
    callee.property.name === 'push' &&
    callee.object.type === 'AssignmentExpression' &&
    callee.object.left.object &&
    (
      callee.object.left.object.name === 'window' ||
      // Webpack 4 uses `this` instead of `window`
      callee.object.left.object.type === 'ThisExpression'
    ) &&
    args.length === 1 &&
    args[0].type === 'ArrayExpression' &&
    mayBeAsyncChunkArguments(args[0].elements) &&
    isModulesList(args[0].elements[1])
  );
}

function mayBeAsyncChunkArguments(args) {
  return (
    args.length >= 2 &&
    isChunkIds(args[0])
  );
}

function getModulesLocations(node) {
  if (node.type === 'ObjectExpression') {
    // Modules hash
    const modulesNodes = node.properties;

    return _.transform(modulesNodes, (result, moduleNode) => {
      const moduleId = moduleNode.key.name || moduleNode.key.value;

      result[moduleId] = getModuleLocation(moduleNode.value);
    }, {});
  }

  const isOptimizedArray = (node.type === 'CallExpression');

  if (node.type === 'ArrayExpression' || isOptimizedArray) {
    // Modules array or optimized array
    const minId = isOptimizedArray ?
      // Get the [minId] value from the Array() call first argument literal value
      node.callee.object.arguments[0].value :
      // `0` for simple array
      0;
    const modulesNodes = isOptimizedArray ?
      // The modules reside in the `concat()` function call arguments
      node.arguments[0].elements :
      node.elements;

    return _.transform(modulesNodes, (result, moduleNode, i) => {
      if (!moduleNode) return;
      result[i + minId] = getModuleLocation(moduleNode);
    }, {});
  }

  return {};
}

function getModuleLocation(node) {
  return {
    start: node.start,
    end: node.end
  };
}
