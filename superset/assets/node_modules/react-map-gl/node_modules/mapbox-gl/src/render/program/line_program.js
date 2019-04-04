// @flow

import {
    Uniform1i,
    Uniform1f,
    Uniform2f,
    Uniform4f,
    UniformMatrix4f
} from '../uniform_binding';
import pixelsToTileUnits from '../../source/pixels_to_tile_units';
import { extend } from '../../util/util';
import browser from '../../util/browser';

import type Context from '../../gl/context';
import type {UniformValues, UniformLocations} from '../uniform_binding';
import type Transform from '../../geo/transform';
import type Tile from '../../source/tile';
import type {CrossFaded} from '../../style/properties';
import type LineStyleLayer from '../../style/style_layer/line_style_layer';
import type Painter from '../painter';
import type {CrossfadeParameters} from '../../style/evaluation_parameters';

export type LineUniformsType = {|
    'u_matrix': UniformMatrix4f,
    'u_ratio': Uniform1f,
    'u_gl_units_to_pixels': Uniform2f
|};

export type LineGradientUniformsType = {|
    'u_matrix': UniformMatrix4f,
    'u_ratio': Uniform1f,
    'u_gl_units_to_pixels': Uniform2f,
    'u_image': Uniform1i
|};

export type LinePatternUniformsType = {|
    'u_matrix': UniformMatrix4f,
    'u_texsize': Uniform2f,
    'u_ratio': Uniform1f,
    'u_gl_units_to_pixels': Uniform2f,
    'u_image': Uniform1i,
    'u_scale': Uniform4f,
    'u_fade': Uniform1f
|};

export type LineSDFUniformsType = {|
    'u_matrix': UniformMatrix4f,
    'u_ratio': Uniform1f,
    'u_gl_units_to_pixels': Uniform2f,
    'u_patternscale_a': Uniform2f,
    'u_patternscale_b': Uniform2f,
    'u_sdfgamma': Uniform1f,
    'u_image': Uniform1i,
    'u_tex_y_a': Uniform1f,
    'u_tex_y_b': Uniform1f,
    'u_mix': Uniform1f
|};

const lineUniforms = (context: Context, locations: UniformLocations): LineUniformsType => ({
    'u_matrix': new UniformMatrix4f(context, locations.u_matrix),
    'u_ratio': new Uniform1f(context, locations.u_ratio),
    'u_gl_units_to_pixels': new Uniform2f(context, locations.u_gl_units_to_pixels)
});

const lineGradientUniforms = (context: Context, locations: UniformLocations): LineGradientUniformsType => ({
    'u_matrix': new UniformMatrix4f(context, locations.u_matrix),
    'u_ratio': new Uniform1f(context, locations.u_ratio),
    'u_gl_units_to_pixels': new Uniform2f(context, locations.u_gl_units_to_pixels),
    'u_image': new Uniform1i(context, locations.u_image)
});

const linePatternUniforms = (context: Context, locations: UniformLocations): LinePatternUniformsType => ({
    'u_matrix': new UniformMatrix4f(context, locations.u_matrix),
    'u_texsize': new Uniform2f(context, locations.u_texsize),
    'u_ratio': new Uniform1f(context, locations.u_ratio),
    'u_image': new Uniform1i(context, locations.u_image),
    'u_gl_units_to_pixels': new Uniform2f(context, locations.u_gl_units_to_pixels),
    'u_scale': new Uniform4f(context, locations.u_scale),
    'u_fade': new Uniform1f(context, locations.u_fade)
});

const lineSDFUniforms = (context: Context, locations: UniformLocations): LineSDFUniformsType => ({
    'u_matrix': new UniformMatrix4f(context, locations.u_matrix),
    'u_ratio': new Uniform1f(context, locations.u_ratio),
    'u_gl_units_to_pixels': new Uniform2f(context, locations.u_gl_units_to_pixels),
    'u_patternscale_a': new Uniform2f(context, locations.u_patternscale_a),
    'u_patternscale_b': new Uniform2f(context, locations.u_patternscale_b),
    'u_sdfgamma': new Uniform1f(context, locations.u_sdfgamma),
    'u_image': new Uniform1i(context, locations.u_image),
    'u_tex_y_a': new Uniform1f(context, locations.u_tex_y_a),
    'u_tex_y_b': new Uniform1f(context, locations.u_tex_y_b),
    'u_mix': new Uniform1f(context, locations.u_mix)
});

const lineUniformValues = (
    painter: Painter,
    tile: Tile,
    layer: LineStyleLayer
): UniformValues<LineUniformsType> => {
    const transform = painter.transform;

    return {
        'u_matrix': calculateMatrix(painter, tile, layer),
        'u_ratio': 1 / pixelsToTileUnits(tile, 1, transform.zoom),
        'u_gl_units_to_pixels': [
            1 / transform.pixelsToGLUnits[0],
            1 / transform.pixelsToGLUnits[1]
        ]
    };
};

const lineGradientUniformValues = (
    painter: Painter,
    tile: Tile,
    layer: LineStyleLayer
): UniformValues<LineGradientUniformsType> => {
    return extend(lineUniformValues(painter, tile, layer), {
        'u_image': 0
    });
};

const linePatternUniformValues = (
    painter: Painter,
    tile: Tile,
    layer: LineStyleLayer,
    crossfade: CrossfadeParameters
): UniformValues<LinePatternUniformsType> => {
    const transform = painter.transform;
    const tileZoomRatio = calculateTileRatio(tile, transform);
    return {
        'u_matrix': calculateMatrix(painter, tile, layer),
        'u_texsize': tile.imageAtlasTexture.size,
        // camera zoom ratio
        'u_ratio': 1 / pixelsToTileUnits(tile, 1, transform.zoom),
        'u_image': 0,
        // this assumes all images in the icon atlas texture have the same pixel ratio
        'u_scale': [browser.devicePixelRatio, tileZoomRatio, crossfade.fromScale, crossfade.toScale],
        'u_fade': crossfade.t,
        'u_gl_units_to_pixels': [
            1 / transform.pixelsToGLUnits[0],
            1 / transform.pixelsToGLUnits[1]
        ]
    };
};

const lineSDFUniformValues = (
    painter: Painter,
    tile: Tile,
    layer: LineStyleLayer,
    dasharray: CrossFaded<Array<number>>,
    crossfade: CrossfadeParameters
): UniformValues<LineSDFUniformsType> => {
    const transform = painter.transform;
    const lineAtlas = painter.lineAtlas;
    const tileRatio = calculateTileRatio(tile, transform);

    const round = layer.layout.get('line-cap') === 'round';

    const posA = lineAtlas.getDash(dasharray.from, round);
    const posB = lineAtlas.getDash(dasharray.to, round);

    const widthA = posA.width * crossfade.fromScale;
    const widthB = posB.width * crossfade.toScale;

    return extend(lineUniformValues(painter, tile, layer), {
        'u_patternscale_a': [tileRatio / widthA, -posA.height / 2],
        'u_patternscale_b': [tileRatio / widthB, -posB.height / 2],
        'u_sdfgamma': lineAtlas.width / (Math.min(widthA, widthB) * 256 * browser.devicePixelRatio) / 2,
        'u_image': 0,
        'u_tex_y_a': posA.y,
        'u_tex_y_b': posB.y,
        'u_mix': crossfade.t
    });
};

function calculateTileRatio(tile: Tile, transform: Transform) {
    return 1 / pixelsToTileUnits(tile, 1, transform.tileZoom);
}

function calculateMatrix(painter, tile, layer) {
    return painter.translatePosMatrix(
        tile.tileID.posMatrix,
        tile,
        layer.paint.get('line-translate'),
        layer.paint.get('line-translate-anchor')
    );
}

export {
    lineUniforms,
    lineGradientUniforms,
    linePatternUniforms,
    lineSDFUniforms,
    lineUniformValues,
    lineGradientUniformValues,
    linePatternUniformValues,
    lineSDFUniformValues
};
