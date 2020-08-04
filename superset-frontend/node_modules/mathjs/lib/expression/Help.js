'use strict';

var object = require('../utils/object');
var string = require('../utils/string');

function factory (type, config, load, typed) {
  var parser = load(require('./function/parser'))();

  /**
   * Documentation object
   * @param {Object} doc  Object containing properties:
   *                      {string} name
   *                      {string} category
   *                      {string} description
   *                      {string[]} syntax
   *                      {string[]} examples
   *                      {string[]} seealso
   * @constructor
   */
  function Help(doc) {
    if (!(this instanceof Help)) {
      throw new SyntaxError('Constructor must be called with the new operator');
    }

    if (!doc)  throw new Error('Argument "doc" missing');

    this.doc = doc;
  }

  /**
   * Attach type information
   */
  Help.prototype.type = 'Help';
  Help.prototype.isHelp = true;

  /**
   * Generate a string representation of the Help object
   * @return {string} Returns a string
   * @private
   */
  Help.prototype.toString = function () {
    var doc = this.doc || {};
    var desc = '\n';

    if (doc.name) {
      desc += 'Name: ' + doc.name + '\n\n';
    }
    if (doc.category) {
      desc += 'Category: ' + doc.category + '\n\n';
    }
    if (doc.description) {
      desc += 'Description:\n    ' + doc.description + '\n\n';
    }
    if (doc.syntax) {
      desc += 'Syntax:\n    ' + doc.syntax.join('\n    ') + '\n\n';
    }
    if (doc.examples) {
      desc += 'Examples:\n';
      for (var i = 0; i < doc.examples.length; i++) {
        var expr = doc.examples[i];
        desc += '    ' + expr + '\n';

        var res;
        try {
          // note: res can be undefined when `expr` is an empty string
          res = parser.eval(expr);
        }
        catch (e) {
          res = e;
        }
        if (res !== undefined && !type.isHelp(res)) {
          desc += '        ' + string.format(res, {precision: 14}) + '\n';
        }
      }
      desc += '\n';
    }
    if (doc.seealso && doc.seealso.length) {
      desc += 'See also: ' + doc.seealso.join(', ') + '\n';
    }

    return desc;
  };

  /**
   * Export the help object to JSON
   */
  Help.prototype.toJSON = function () {
    var obj = object.clone(this.doc);
    obj.mathjs = 'Help';
    return obj;
  };

  /**
   * Instantiate a Help object from a JSON object
   * @param {Object} json
   * @returns {Help} Returns a new Help object
   */
  Help.fromJSON = function (json) {
    var doc = {};
    for (var prop in json) {
      if (prop !== 'mathjs') { // ignore mathjs field
        doc[prop] = json[prop];
      }
    }
    return new Help(doc);
  };

  /**
   * Returns a string representation of the Help object
   */
  Help.prototype.valueOf = Help.prototype.toString;

  return Help;
}

exports.name = 'Help';
exports.path = 'type';
exports.factory = factory;
