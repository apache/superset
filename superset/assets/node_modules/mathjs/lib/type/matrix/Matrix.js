'use strict';

var util = require('../../utils/index');

var string = util.string;

var isString = string.isString;

function factory (type, config, load, typed) {
  /**
   * @constructor Matrix
   *
   * A Matrix is a wrapper around an Array. A matrix can hold a multi dimensional
   * array. A matrix can be constructed as:
   *     var matrix = math.matrix(data)
   *
   * Matrix contains the functions to resize, get and set values, get the size,
   * clone the matrix and to convert the matrix to a vector, array, or scalar.
   * Furthermore, one can iterate over the matrix using map and forEach.
   * The internal Array of the Matrix can be accessed using the function valueOf.
   *
   * Example usage:
   *     var matrix = math.matrix([[1, 2], [3, 4]]);
   *     matix.size();              // [2, 2]
   *     matrix.resize([3, 2], 5);
   *     matrix.valueOf();          // [[1, 2], [3, 4], [5, 5]]
   *     matrix.subset([1,2])       // 3 (indexes are zero-based)
   *
   */
  function Matrix() {
    if (!(this instanceof Matrix)) {
      throw new SyntaxError('Constructor must be called with the new operator');
    }
  }

  /**
   * Attach type information
   */
  Matrix.prototype.type = 'Matrix';
  Matrix.prototype.isMatrix = true;

  /**
   * Get the Matrix storage constructor for the given format.
   *
   * @param {string} format       The Matrix storage format.
   *
   * @return {Function}           The Matrix storage constructor.
   */
  Matrix.storage = function (format) {
    // check storage format is a string
    if (!isString(format)) {
      throw new TypeError('format must be a string value');
    }

    // get storage format constructor
    var constructor = Matrix._storage[format];
    if (!constructor) {
      throw new SyntaxError('Unsupported matrix storage format: ' + format);
    }

    // return storage constructor
    return constructor;
  };

  // a map with all constructors for all storage types
  Matrix._storage = {};

  /**
   * Get the storage format used by the matrix.
   *
   * Usage:
   *     var format = matrix.storage()                   // retrieve storage format
   *
   * @return {string}           The storage format.
   */
  Matrix.prototype.storage = function () {
    // must be implemented by each of the Matrix implementations
    throw new Error('Cannot invoke storage on a Matrix interface');
  };
  
  /**
   * Get the datatype of the data stored in the matrix.
   *
   * Usage:
   *     var format = matrix.datatype()                   // retrieve matrix datatype
   *
   * @return {string}           The datatype.
   */
  Matrix.prototype.datatype = function () {
    // must be implemented by each of the Matrix implementations
    throw new Error('Cannot invoke datatype on a Matrix interface');
  };

  /**
   * Create a new Matrix With the type of the current matrix instance
   * @param {Array | Object} data
   * @param {string} [datatype]
   */
  Matrix.prototype.create = function (data, datatype) {
    throw new Error('Cannot invoke create on a Matrix interface');
  };

  /**
   * Get a subset of the matrix, or replace a subset of the matrix.
   *
   * Usage:
   *     var subset = matrix.subset(index)               // retrieve subset
   *     var value = matrix.subset(index, replacement)   // replace subset
   *
   * @param {Index} index
   * @param {Array | Matrix | *} [replacement]
   * @param {*} [defaultValue=0]      Default value, filled in on new entries when
   *                                  the matrix is resized. If not provided,
   *                                  new matrix elements will be filled with zeros.
   */
  Matrix.prototype.subset = function (index, replacement, defaultValue) {
    // must be implemented by each of the Matrix implementations
    throw new Error('Cannot invoke subset on a Matrix interface');
  };

  /**
   * Get a single element from the matrix.
   * @param {number[]} index   Zero-based index
   * @return {*} value
   */
  Matrix.prototype.get = function (index) {
    // must be implemented by each of the Matrix implementations
    throw new Error('Cannot invoke get on a Matrix interface');
  };

  /**
   * Replace a single element in the matrix.
   * @param {number[]} index   Zero-based index
   * @param {*} value
   * @param {*} [defaultValue]        Default value, filled in on new entries when
   *                                  the matrix is resized. If not provided,
   *                                  new matrix elements will be left undefined.
   * @return {Matrix} self
   */
  Matrix.prototype.set = function (index, value, defaultValue) {
    // must be implemented by each of the Matrix implementations
    throw new Error('Cannot invoke set on a Matrix interface');
  };

  /**
   * Resize the matrix to the given size. Returns a copy of the matrix when 
   * `copy=true`, otherwise return the matrix itself (resize in place).
   *
   * @param {number[]} size           The new size the matrix should have.
   * @param {*} [defaultValue=0]      Default value, filled in on new entries.
   *                                  If not provided, the matrix elements will
   *                                  be filled with zeros.
   * @param {boolean} [copy]          Return a resized copy of the matrix
   *
   * @return {Matrix}                 The resized matrix
   */
  Matrix.prototype.resize = function (size, defaultValue) {
    // must be implemented by each of the Matrix implementations
    throw new Error('Cannot invoke resize on a Matrix interface');
  };

  /**
   * Reshape the matrix to the given size. Returns a copy of the matrix when
   * `copy=true`, otherwise return the matrix itself (reshape in place).
   *
   * @param {number[]} size           The new size the matrix should have.
   * @param {boolean} [copy]          Return a reshaped copy of the matrix
   *
   * @return {Matrix}                 The reshaped matrix
   */
  Matrix.prototype.reshape = function (size, defaultValue) {
    // must be implemented by each of the Matrix implementations
    throw new Error('Cannot invoke reshape on a Matrix interface');
  };

  /**
   * Create a clone of the matrix
   * @return {Matrix} clone
   */
  Matrix.prototype.clone = function () {
    // must be implemented by each of the Matrix implementations
    throw new Error('Cannot invoke clone on a Matrix interface');
  };

  /**
   * Retrieve the size of the matrix.
   * @returns {number[]} size
   */
  Matrix.prototype.size = function() {
    // must be implemented by each of the Matrix implementations
    throw new Error('Cannot invoke size on a Matrix interface');
  };

  /**
   * Create a new matrix with the results of the callback function executed on
   * each entry of the matrix.
   * @param {Function} callback   The callback function is invoked with three
   *                              parameters: the value of the element, the index
   *                              of the element, and the Matrix being traversed.
   * @param {boolean} [skipZeros] Invoke callback function for non-zero values only.
   *
   * @return {Matrix} matrix
   */
  Matrix.prototype.map = function (callback, skipZeros) {
    // must be implemented by each of the Matrix implementations
    throw new Error('Cannot invoke map on a Matrix interface');
  };

  /**
   * Execute a callback function on each entry of the matrix.
   * @param {Function} callback   The callback function is invoked with three
   *                              parameters: the value of the element, the index
   *                              of the element, and the Matrix being traversed.
   */
  Matrix.prototype.forEach = function (callback) {
    // must be implemented by each of the Matrix implementations
    throw new Error('Cannot invoke forEach on a Matrix interface');
  };

  /**
   * Create an Array with a copy of the data of the Matrix
   * @returns {Array} array
   */
  Matrix.prototype.toArray = function () {
    // must be implemented by each of the Matrix implementations
    throw new Error('Cannot invoke toArray on a Matrix interface');
  };

  /**
   * Get the primitive value of the Matrix: a multidimensional array
   * @returns {Array} array
   */
  Matrix.prototype.valueOf = function () {
    // must be implemented by each of the Matrix implementations
    throw new Error('Cannot invoke valueOf on a Matrix interface');
  };

  /**
   * Get a string representation of the matrix, with optional formatting options.
   * @param {Object | number | Function} [options]  Formatting options. See
   *                                                lib/utils/number:format for a
   *                                                description of the available
   *                                                options.
   * @returns {string} str
   */
  Matrix.prototype.format = function (options) {
    // must be implemented by each of the Matrix implementations
    throw new Error('Cannot invoke format on a Matrix interface');
  };

  /**
   * Get a string representation of the matrix
   * @returns {string} str
   */
  Matrix.prototype.toString = function () {
    // must be implemented by each of the Matrix implementations
    throw new Error('Cannot invoke toString on a Matrix interface');
  };
   
  // exports
  return Matrix;
}

exports.name = 'Matrix';
exports.path = 'type';
exports.factory = factory;
