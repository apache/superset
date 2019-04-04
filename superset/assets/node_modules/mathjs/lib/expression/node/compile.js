// the compile functions which compile a Node into JavaScript are not
// exposed as class methods for security reasons to prevent being able to
// override them or create fake Nodes. Instead, only compile functions of
// registered nodes can be executed

var hasOwnProperty = require('../../utils/object').hasOwnProperty;

function factory () {
  // map with node type as key and compile functions as value
  var compileFunctions = {}

  /**
   * Register a compile function for a node
   * @param {string} type
   * @param {function} compileFunction
   *                      The compile function, invoked as
   *                      compileFunction(node, defs, args)
   */
  function register(type, compileFunction) {
    if (compileFunctions[type] === undefined) {
      compileFunctions[type] = compileFunction;
    }
    else {
      throw new Error('Cannot register type "' + type + '": already exists');
    }
  }

  /**
   * Compile a Node into JavaScript
   * @param {Node} node
   * @param {Object} defs     Object which can be used to define functions
   *                          or constants globally available for the compiled
   *                          expression
   * @param {Object} args     Object with local function arguments, the key is
   *                          the name of the argument, and the value is `true`.
   *                          The object may not be mutated, but must be
   *                          extended instead.
   * @return {string} Returns JavaScript code
   */
  function compile (node, defs, args) {
    if (hasOwnProperty(compileFunctions, node.type)) {
      var compileFunction = compileFunctions[node.type];
      return compileFunction(node, defs, args);
    }
    else if (typeof node._compile === 'function' &&
        !hasOwnProperty(node, '_compile')) {
      // Compatibility for CustomNodes
      // TODO: this is a security risk, change it such that you have to register CustomNodes separately in math.js, like math.expression.node.register(MyCustomNode)
      return node._compile(defs, args);
    }
    else {
      throw new Error('Cannot compile node: unknown type "' + node.type + '"');
    }
  }

  return {
    register: register,
    compile: compile
  }
}

exports.factory = factory;
