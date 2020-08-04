// @flow

import {
    Uniform1i,
    Uniform1f,
    Uniform2f,
    UniformMatrix4f
} from '../uniform_binding';
import pixelsToTileUnits from '../../source/pixels_to_tile_units';

import type Context from '../../gl/context';
import type {UniformValues, UniformLocations} from '../uniform_binding';
import type {OverscaledTileID} from '../../source/tile_id';
import type Tile from '../../source/tile';
import type CircleStyleLayer from '../../style/style_layer/circle_style_layer';
import type Painter from '../painter';

export type CircleUniformsType = {|
    'u_camera_to_center_distance': Uniform1f,
    'u_scale_with_map': Uniform1i,
    'u_pitch_with_map': Uniform1i,
    'u_extrude_scale': Uniform2f,
    'u_matrix': UniformMatrix4f
|};

const circleUniforms = (context: Context, locations: UniformLocations): CircleUniformsType => ({
    'u_camera_to_center_distance': new Uniform1f(context, locations.u_camera_to_center_distance),
    'u_scale_with_map': new Uniform1i(context, locations.u_scale_with_map),
    'u_pitch_with_map': new Uniform1i(context, locations.u_pitch_with_map),
    'u_extrude_scale': new Uniform2f(context, locations.u_extrude_scale),
    'u_matrix': new UniformMatrix4f(context, locations.u_matrix)
});

const circleUniformValues = (
    painter: Painter,
    coord: OverscaledTileID,
    tile: Tile,
    layer: CircleStyleLayer
): UniformValues<CircleUniformsType> => {
    const transform = painter.transform;

    let pitchWithMap: boolean, extrudeScale: [number, number];
    if (layer.paint.get('circle-pitch-alignment') === 'map') {
        const pixelRatio = pixelsToTileUnits(tile, 1, transform.zoom);
        pitchWithMap = true;
        extrudeScale = [pixelRatio, pixelRatio];
    } else {
        pitchWithMap = false;
        extrudeScale = transform.pixelsToGLUnits;
    }

    return {
        'u_camera_to_center_distance': transform.cameraToCenterDistance,
        'u_scale_with_map': +(layer.paint.get('circle-pitch-scale') === 'map'),
        'u_matrix': painter.translatePosMatrix(
            coord.posMatrix,
            tile,
            layer.paint.get('circle-translate'),
            layer.paint.get('circle-translate-anchor')),
        'u_pitch_with_map': +(pitchWithMap),
        'u_extrude_scale': extrudeScale
    };
};

export { circleUniforms, circleUniformValues };
