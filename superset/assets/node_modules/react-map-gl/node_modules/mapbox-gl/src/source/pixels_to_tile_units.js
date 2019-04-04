// @flow

import EXTENT from '../data/extent';

import type {OverscaledTileID} from './tile_id';

/**
 * Converts a pixel value at a the given zoom level to tile units.
 *
 * The shaders mostly calculate everything in tile units so style
 * properties need to be converted from pixels to tile units using this.
 *
 * For example, a translation by 30 pixels at zoom 6.5 will be a
 * translation by pixelsToTileUnits(30, 6.5) tile units.
 *
 * @returns value in tile units
 * @private
 */
export default function(tile: {tileID: OverscaledTileID, tileSize: number}, pixelValue: number, z: number): number {
    return pixelValue * (EXTENT / (tile.tileSize * Math.pow(2, z - tile.tileID.overscaledZ)));
}
