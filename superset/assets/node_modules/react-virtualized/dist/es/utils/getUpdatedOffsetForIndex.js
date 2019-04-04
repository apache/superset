/**
 * Determines a new offset that ensures a certain cell is visible, given the current offset.
 * If the cell is already visible then the current offset will be returned.
 * If the current offset is too great or small, it will be adjusted just enough to ensure the specified index is visible.
 *
 * @param align Desired alignment within container; one of "auto" (default), "start", or "end"
 * @param cellOffset Offset (x or y) position for cell
 * @param cellSize Size (width or height) of cell
 * @param containerSize Total size (width or height) of the container
 * @param currentOffset Container's current (x or y) offset
 * @return Offset to use to ensure the specified cell is visible
 */
export default function getUpdatedOffsetForIndex(_ref) {
  var _ref$align = _ref.align,
      align = _ref$align === undefined ? 'auto' : _ref$align,
      cellOffset = _ref.cellOffset,
      cellSize = _ref.cellSize,
      containerSize = _ref.containerSize,
      currentOffset = _ref.currentOffset;

  var maxOffset = cellOffset;
  var minOffset = maxOffset - containerSize + cellSize;

  switch (align) {
    case 'start':
      return maxOffset;
    case 'end':
      return minOffset;
    case 'center':
      return maxOffset - (containerSize - cellSize) / 2;
    default:
      return Math.max(minOffset, Math.min(maxOffset, currentOffset));
  }
}