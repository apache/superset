'use strict';

var getSafeProperty = require('../../utils/customs').getSafeProperty;

function factory (type, config, load, typed, math) {
  var docs = load(require('../embeddedDocs'));

  /**
   * Retrieve help on a function or data type.
   * Help files are retrieved from the documentation in math.expression.docs.
   *
   * Syntax:
   *
   *    math.help(search)
   *
   * Examples:
   *
   *    console.log(math.help('sin').toString());
   *    console.log(math.help(math.add).toString());
   *    console.log(math.help(math.add).toJSON());
   *
   * @param {Function | string | Object} search   A function or function name
   *                                              for which to get help
   * @return {Help} A help object
   */
  return typed('help', {
    'any': function (search) {
      var prop;
      var name = search;

      if (typeof search !== 'string') {
        for (prop in math) {
          // search in functions and constants
          if (math.hasOwnProperty(prop) && (search === math[prop])) {
            name = prop;
            break;
          }
        }

        /* TODO: implement help for data types
         if (!text) {
         // search data type
         for (prop in math.type) {
         if (math.type.hasOwnProperty(prop)) {
         if (search === math.type[prop]) {
         text = prop;
         break;
         }
         }
         }
         }
         */
      }

      var doc = getSafeProperty(docs, name);
      if (!doc) {
        throw new Error('No documentation found on "' + name + '"');
      }
      return new type.Help(doc);
    }
  });
}

exports.math = true; // request access to the math namespace as 5th argument of the factory function
exports.name = 'help';
exports.factory = factory;
