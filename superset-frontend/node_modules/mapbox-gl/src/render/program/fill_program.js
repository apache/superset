// @flow

import {patternUniformValues} from './pattern';
import {
    Uniform1i,
    Uniform1f,
    Uniform2f,
    Uniform4f,
    UniformMatrix4f
} from '../uniform_binding';
import { extend } from '../../util/util';

import type Painter from '../painter';
import type {UniformValues, UniformLocations} from '../uniform_binding';
import type Context from '../../gl/context';
import type {CrossfadeParameters} from '../../style/evaluation_parameters';
import type Tile from '../../source/tile';

export type FillUniformsType = {|
    'u_matrix': UniformMatrix4f
|};

export type FillOutlineUniformsType = {|
    'u_matrix': UniformMatrix4f,
    'u_world': Uniform2f
|};

export type FillPatternUniformsType = {|
    'u_matrix': UniformMatrix4f,
    // pattern uniforms:
    'u_texsize': Uniform2f,
    'u_image': Uniform1i,
    'u_pixel_coord_upper': Uniform2f,
    'u_pixel_coord_lower': Uniform2f,
    'u_scale': Uniform4f,
    'u_fade': Uniform1f
|};

export type FillOutlinePatternUniformsType = {|
    'u_matrix': UniformMatrix4f,
    'u_world': Uniform2f,
    // pattern uniforms:
    'u_texsize': Uniform2f,
    'u_image': Uniform1i,
    'u_pixel_coord_upper': Uniform2f,
    'u_pixel_coord_lower': Uniform2f,
    'u_scale': Uniform4f,
    'u_fade': Uniform1f
|};

const fillUniforms = (context: Context, locations: UniformLocations): FillUniformsType => ({
    'u_matrix': new UniformMatrix4f(context, locations.u_matrix)
});

const fillPatternUniforms = (context: Context, locations: UniformLocations): FillPatternUniformsType => ({
    'u_matrix': new UniformMatrix4f(context, locations.u_matrix),
    'u_image': new Uniform1i(context, locations.u_image),
    'u_texsize': new Uniform2f(context, locations.u_texsize),
    'u_pixel_coord_upper': new Uniform2f(context, locations.u_pixel_coord_upper),
    'u_pixel_coord_lower': new Uniform2f(context, locations.u_pixel_coord_lower),
    'u_scale': new Uniform4f(context, locations.u_scale),
    'u_fade': new Uniform1f(context, locations.u_fade)

});

const fillOutlineUniforms = (context: Context, locations: UniformLocations): FillOutlineUniformsType => ({
    'u_matrix': new UniformMatrix4f(context, locations.u_matrix),
    'u_world': new Uniform2f(context, locations.u_world)
});

const fillOutlinePatternUniforms = (context: Context, locations: UniformLocations): FillOutlinePatternUniformsType => ({
    'u_matrix': new UniformMatrix4f(context, locations.u_matrix),
    'u_world': new Uniform2f(context, locations.u_world),
    'u_image': new Uniform1i(context, locations.u_image),
    'u_texsize': new Uniform2f(context, locations.u_texsize),
    'u_pixel_coord_upper': new Uniform2f(context, locations.u_pixel_coord_upper),
    'u_pixel_coord_lower': new Uniform2f(context, locations.u_pixel_coord_lower),
    'u_scale': new Uniform4f(context, locations.u_scale),
    'u_fade': new Uniform1f(context, locations.u_fade)
});

const fillUniformValues = (matrix: Float32Array): UniformValues<FillUniformsType> => ({
    'u_matrix': matrix
});

const fillPatternUniformValues = (
    matrix: Float32Array,
    painter: Painter,
    crossfade: CrossfadeParameters,
    tile: Tile
): UniformValues<FillPatternUniformsType> => extend(
    fillUniformValues(matrix),
    patternUniformValues(crossfade, painter, tile)
);

const fillOutlineUniformValues = (
    matrix: Float32Array,
    drawingBufferSize: [number, number]
): UniformValues<FillOutlineUniformsType> => ({
    'u_matrix': matrix,
    'u_world': drawingBufferSize
});

const fillOutlinePatternUniformValues = (
    matrix: Float32Array,
    painter: Painter,
    crossfade: CrossfadeParameters,
    tile: Tile,
    drawingBufferSize: [number, number]
): UniformValues<FillOutlinePatternUniformsType> => extend(
    fillPatternUniformValues(matrix, painter, crossfade, tile),
    {
        'u_world': drawingBufferSize
    }
);

export {
    fillUniforms,
    fillPatternUniforms,
    fillOutlineUniforms,
    fillOutlinePatternUniforms,
    fillUniformValues,
    fillPatternUniformValues,
    fillOutlineUniformValues,
    fillOutlinePatternUniformValues
};
