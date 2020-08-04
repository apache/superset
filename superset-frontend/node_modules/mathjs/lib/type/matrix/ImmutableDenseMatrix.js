'use strict';

var util = require('../../utils/index');

var string = util.string;
var object = util.object;

var isArray = Array.isArray;
var isString = string.isString;

function factory (type, config, load) {

  var DenseMatrix = load(require('./DenseMatrix'));

  var smaller = load(require('../../function/relational/smaller'));

  function ImmutableDenseMatrix(data, datatype) {
    if (!(this instanceof ImmutableDenseMatrix))
      throw new SyntaxError('Constructor must be called with the new operator');
    if (datatype && !isString(datatype))
      throw new Error('Invalid datatype: ' + datatype);

    if (type.isMatrix(data) || isArray(data)) {
      // use DenseMatrix implementation
      var matrix = new DenseMatrix(data, datatype);
      // internal structures
      this._data = matrix._data;
      this._size = matrix._size;
      this._datatype = matrix._datatype;
      this._min = null;
      this._max = null;
    }
    else if (data && isArray(data.data) && isArray(data.size)) {
      // initialize fields from JSON representation
      this._data = data.data;
      this._size = data.size;
      this._datatype = data.datatype;
      this._min = typeof data.min !== 'undefined' ? data.min : null;
      this._max = typeof data.max !== 'undefined' ? data.max : null;
    }
    else if (data) {
      // unsupported type
      throw new TypeError('Unsupported type of data (' + util.types.type(data) + ')');
    }
    else {
      // nothing provided
      this._data = [];
      this._size = [0];
      this._datatype = datatype;
      this._min = null;
      this._max = null;
    }
  }

  ImmutableDenseMatrix.prototype = new DenseMatrix();

  /**
   * Attach type information
   */
  ImmutableDenseMatrix.prototype.type = 'ImmutableDenseMatrix';
  ImmutableDenseMatrix.prototype.isImmutableDenseMatrix = true;

  /**
   * Get a subset of the matrix, or replace a subset of the matrix.
   *
   * Usage:
   *     var subset = matrix.subset(index)               // retrieve subset
   *     var value = matrix.subset(index, replacement)   // replace subset
   *
   * @param {Index} index
   * @param {Array | ImmutableDenseMatrix | *} [replacement]
   * @param {*} [defaultValue=0]      Default value, filled in on new entries when
   *                                  the matrix is resized. If not provided,
   *                                  new matrix elements will be filled with zeros.
   */
  ImmutableDenseMatrix.prototype.subset = function (index) {
    switch (arguments.length) {
      case 1:
        // use base implementation
        var m = DenseMatrix.prototype.subset.call(this, index);
        // check result is a matrix
        if (type.isMatrix(m)) {
          // return immutable matrix
          return new ImmutableDenseMatrix({
            data: m._data,
            size: m._size,
            datatype: m._datatype
          });
        }
        return m;
        
        // intentional fall through
      case 2:
      case 3:
        throw new Error('Cannot invoke set subset on an Immutable Matrix instance');

      default:
        throw new SyntaxError('Wrong number of arguments');
    }
  };

  /**
   * Replace a single element in the matrix.
   * @param {Number[]} index   Zero-based index
   * @param {*} value
   * @param {*} [defaultValue]        Default value, filled in on new entries when
   *                                  the matrix is resized. If not provided,
   *                                  new matrix elements will be left undefined.
   * @return {ImmutableDenseMatrix} self
   */
  ImmutableDenseMatrix.prototype.set = function () {
    throw new Error('Cannot invoke set on an Immutable Matrix instance');
  };

  /**
   * Resize the matrix to the given size. Returns a copy of the matrix when
   * `copy=true`, otherwise return the matrix itself (resize in place).
   *
   * @param {Number[]} size           The new size the matrix should have.
   * @param {*} [defaultValue=0]      Default value, filled in on new entries.
   *                                  If not provided, the matrix elements will
   *                                  be filled with zeros.
   * @param {boolean} [copy]          Return a resized copy of the matrix
   *
   * @return {Matrix}                 The resized matrix
   */
  ImmutableDenseMatrix.prototype.resize = function () {
    throw new Error('Cannot invoke resize on an Immutable Matrix instance');
  };

  /**
   * Disallows reshaping in favor of immutability.
   *
   * @throws {Error} Operation not allowed
   */
  ImmutableDenseMatrix.prototype.reshape = function () {
    throw new Error('Cannot invoke reshape on an Immutable Matrix instance');
  };

  /**
   * Create a clone of the matrix
   * @return {ImmutableDenseMatrix} clone
   */
  ImmutableDenseMatrix.prototype.clone = function () {
    var m = new ImmutableDenseMatrix({
      data: object.clone(this._data),
      size: object.clone(this._size),
      datatype: this._datatype
    });
    return m;
  };

  /**
   * Get a JSON representation of the matrix
   * @returns {Object}
   */
  ImmutableDenseMatrix.prototype.toJSON = function () {
    return {
      mathjs: 'ImmutableDenseMatrix',
      data: this._data,
      size: this._size,
      datatype: this._datatype
    };
  };

  /**
   * Generate a matrix from a JSON object
   * @param {Object} json  An object structured like
   *                       `{"mathjs": "ImmutableDenseMatrix", data: [], size: []}`,
   *                       where mathjs is optional
   * @returns {ImmutableDenseMatrix}
   */
  ImmutableDenseMatrix.fromJSON = function (json) {
    return new ImmutableDenseMatrix(json);
  };

  /**
   * Swap rows i and j in Matrix.
   *
   * @param {Number} i       Matrix row index 1
   * @param {Number} j       Matrix row index 2
   *
   * @return {Matrix}        The matrix reference
   */
  ImmutableDenseMatrix.prototype.swapRows = function () {
    throw new Error('Cannot invoke swapRows on an Immutable Matrix instance');
  };

  /**
   * Calculate the minimum value in the set
   * @return {Number | undefined} min
   */
  ImmutableDenseMatrix.prototype.min = function () {
    // check min has been calculated before
    if (this._min === null) {
      // minimum
      var m = null;
      // compute min
      this.forEach(function (v) {
        if (m === null || smaller(v, m))
          m = v;
      });
      this._min = m !== null ? m : undefined;
    }
    return this._min;
  };

  /**
   * Calculate the maximum value in the set
   * @return {Number | undefined} max
   */
  ImmutableDenseMatrix.prototype.max = function () {
    // check max has been calculated before
    if (this._max === null) {
      // maximum
      var m = null;
      // compute max
      this.forEach(function (v) {
        if (m === null || smaller(m, v))
          m = v;
      });
      this._max = m !== null ? m : undefined;
    }
    return this._max;
  };

  // exports
  return ImmutableDenseMatrix;
}

exports.name = 'ImmutableDenseMatrix';
exports.path = 'type';
exports.factory = factory;
