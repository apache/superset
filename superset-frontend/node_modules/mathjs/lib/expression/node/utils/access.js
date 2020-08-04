'use strict';

var errorTransform = require('../../transform/error.transform').transform;
var getSafeProperty = require('../../../utils/customs').getSafeProperty;

function factory (type, config, load, typed) {
  var subset = load(require('../../../function/matrix/subset'));

  /**
   * Retrieve part of an object:
   *
   * - Retrieve a property from an object
   * - Retrieve a part of a string
   * - Retrieve a matrix subset
   *
   * @param {Object | Array | Matrix | string} object
   * @param {Index} index
   * @return {Object | Array | Matrix | string} Returns the subset
   */
  return function access(object, index) {
    try {
      if (Array.isArray(object)) {
        return subset(object, index);
      }
      else if (object && typeof object.subset === 'function') { // Matrix
        return object.subset(index);
      }
      else if (typeof object === 'string') {
        // TODO: move getStringSubset into a separate util file, use that
        return subset(object, index);
      }
      else if (typeof object === 'object') {
        if (!index.isObjectProperty()) {
          throw new TypeError('Cannot apply a numeric index as object property');
        }

        return getSafeProperty(object, index.getObjectProperty());
      }
      else {
        throw new TypeError('Cannot apply index: unsupported type of object');
      }
    }
    catch (err) {
      throw errorTransform(err);
    }
  }
}

exports.factory = factory;
