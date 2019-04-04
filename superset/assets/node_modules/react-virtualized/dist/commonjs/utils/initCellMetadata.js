'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = initCellMetadata;
/**
 * Initializes metadata for an axis and its cells.
 * This data is used to determine which cells are visible given a container size and scroll position.
 *
 * @param cellCount Total number of cells.
 * @param size Either a fixed size or a function that returns the size for a given given an index.
 * @return Object mapping cell index to cell metadata (size, offset)
 */
function initCellMetadata(_ref) {
  var cellCount = _ref.cellCount,
      size = _ref.size;

  var sizeGetter = typeof size === 'function' ? size : function () {
    return size;
  };

  var cellMetadata = [];
  var offset = 0;

  for (var i = 0; i < cellCount; i++) {
    var _size = sizeGetter({ index: i });

    if (_size == null || isNaN(_size)) {
      throw Error('Invalid size returned for cell ' + i + ' of value ' + _size);
    }

    cellMetadata[i] = {
      size: _size,
      offset: offset
    };

    offset += _size;
  }

  return cellMetadata;
}