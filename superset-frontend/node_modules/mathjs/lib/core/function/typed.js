'use strict';

// Note: this file is here purely for generation of documentation for `math.typed`

function factory (type, config, load, typed, math) {
  /**
   * Create a typed-function which checks the types of the arguments and
   * can match them against multiple provided signatures. The typed-function
   * automatically converts inputs in order to find a matching signature.
   * Typed functions throw informative errors in case of wrong input arguments.
   *
   * See the library [typed-function](https://github.com/josdejong/typed-function)
   * for detailed documentation.
   *
   * Syntax:
   *
   *     math.typed(name, signatures) : function
   *     math.typed(signatures) : function
   *
   * Examples:
   *
   *     // create a typed function with multiple types per argument (type union)
   *     var fn2 = typed({
   *       'number | boolean': function (b) {
   *         return 'b is a number or boolean';
   *       },
   *       'string, number | boolean': function (a, b) {
   *         return 'a is a string, b is a number or boolean';
   *       }
   *     });
   *
   *     // create a typed function with an any type argument
   *     var log = typed({
   *       'string, any': function (event, data) {
   *         console.log('event: ' + event + ', data: ' + JSON.stringify(data));
   *       }
   *     });
   *
   * @param {string} [name]                          Optional name for the typed-function
   * @param {Object<string, function>} signatures   Object with one ore multiple function signatures
   * @returns {function} The created typed-function.
   */
  return typed;
}

exports.name = 'typed';
exports.factory = factory;
