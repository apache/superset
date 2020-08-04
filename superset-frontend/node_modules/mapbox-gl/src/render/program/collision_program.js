// @flow

import {
    Uniform1f,
    Uniform2f,
    UniformMatrix4f
} from '../uniform_binding';
import pixelsToTileUnits from '../../source/pixels_to_tile_units';

import type Context from '../../gl/context';
import type {UniformValues, UniformLocations} from '../uniform_binding';
import type Transform from '../../geo/transform';
import type Tile from '../../source/tile';

export type CollisionUniformsType = {|
    'u_matrix': UniformMatrix4f,
    'u_camera_to_center_distance': Uniform1f,
    'u_pixels_to_tile_units': Uniform1f,
    'u_extrude_scale': Uniform2f,
    'u_overscale_factor': Uniform1f
|};

const collisionUniforms = (context: Context, locations: UniformLocations): CollisionUniformsType => ({
    'u_matrix': new UniformMatrix4f(context, locations.u_matrix),
    'u_camera_to_center_distance': new Uniform1f(context, locations.u_camera_to_center_distance),
    'u_pixels_to_tile_units': new Uniform1f(context, locations.u_pixels_to_tile_units),
    'u_extrude_scale': new Uniform2f(context, locations.u_extrude_scale),
    'u_overscale_factor': new Uniform1f(context, locations.u_overscale_factor)
});

const collisionUniformValues = (
    matrix: Float32Array,
    transform: Transform,
    tile: Tile
): UniformValues<CollisionUniformsType> => {
    const pixelRatio = pixelsToTileUnits(tile, 1, transform.zoom);
    const scale = Math.pow(2, transform.zoom - tile.tileID.overscaledZ);
    const overscaleFactor = tile.tileID.overscaleFactor();
    return {
        'u_matrix': matrix,
        'u_camera_to_center_distance': transform.cameraToCenterDistance,
        'u_pixels_to_tile_units': pixelRatio,
        'u_extrude_scale': [transform.pixelsToGLUnits[0] / (pixelRatio * scale),
            transform.pixelsToGLUnits[1] / (pixelRatio * scale)],
        'u_overscale_factor': overscaleFactor
    };
};

export { collisionUniforms, collisionUniformValues };
