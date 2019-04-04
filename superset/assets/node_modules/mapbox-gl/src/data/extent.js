// @flow

/**
 * The maximum value of a coordinate in the internal tile coordinate system. Coordinates of
 * all source features normalized to this extent upon load.
 *
 * The value is a consequence of the following:
 *
 * * Vertex buffer store positions as signed 16 bit integers.
 * * One bit is lost for signedness to support tile buffers.
 * * One bit is lost because the line vertex buffer used to pack 1 bit of other data into the int.
 *   This is no longer the case but we're reserving this bit anyway.
 * * One bit is lost to support features extending past the extent on the right edge of the tile.
 * * This leaves us with 2^13 = 8192
 *
 * @private
 * @readonly
 */
export default 8192;
