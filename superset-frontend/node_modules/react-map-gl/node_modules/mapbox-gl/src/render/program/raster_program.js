// @flow

import {
    Uniform1i,
    Uniform1f,
    Uniform2f,
    Uniform3f,
    UniformMatrix4f
} from '../uniform_binding';

import type Context from '../../gl/context';
import type {UniformValues, UniformLocations} from '../uniform_binding';
import type RasterStyleLayer from '../../style/style_layer/raster_style_layer';

export type RasterUniformsType = {|
    'u_matrix': UniformMatrix4f,
    'u_tl_parent': Uniform2f,
    'u_scale_parent': Uniform1f,
    'u_buffer_scale': Uniform1f,
    'u_fade_t': Uniform1f,
    'u_opacity': Uniform1f,
    'u_image0': Uniform1i,
    'u_image1': Uniform1i,
    'u_brightness_low': Uniform1f,
    'u_brightness_high': Uniform1f,
    'u_saturation_factor': Uniform1f,
    'u_contrast_factor': Uniform1f,
    'u_spin_weights': Uniform3f
|};

const rasterUniforms = (context: Context, locations: UniformLocations): RasterUniformsType => ({
    'u_matrix': new UniformMatrix4f(context, locations.u_matrix),
    'u_tl_parent': new Uniform2f(context, locations.u_tl_parent),
    'u_scale_parent': new Uniform1f(context, locations.u_scale_parent),
    'u_buffer_scale': new Uniform1f(context, locations.u_buffer_scale),
    'u_fade_t': new Uniform1f(context, locations.u_fade_t),
    'u_opacity': new Uniform1f(context, locations.u_opacity),
    'u_image0': new Uniform1i(context, locations.u_image0),
    'u_image1': new Uniform1i(context, locations.u_image1),
    'u_brightness_low': new Uniform1f(context, locations.u_brightness_low),
    'u_brightness_high': new Uniform1f(context, locations.u_brightness_high),
    'u_saturation_factor': new Uniform1f(context, locations.u_saturation_factor),
    'u_contrast_factor': new Uniform1f(context, locations.u_contrast_factor),
    'u_spin_weights': new Uniform3f(context, locations.u_spin_weights)
});

const rasterUniformValues = (
    matrix: Float32Array,
    parentTL: [number, number],
    parentScaleBy: number,
    fade: {mix: number, opacity: number},
    layer: RasterStyleLayer
): UniformValues<RasterUniformsType> => ({
    'u_matrix': matrix,
    'u_tl_parent': parentTL,
    'u_scale_parent': parentScaleBy,
    'u_buffer_scale': 1,
    'u_fade_t': fade.mix,
    'u_opacity': fade.opacity * layer.paint.get('raster-opacity'),
    'u_image0': 0,
    'u_image1': 1,
    'u_brightness_low': layer.paint.get('raster-brightness-min'),
    'u_brightness_high': layer.paint.get('raster-brightness-max'),
    'u_saturation_factor': saturationFactor(layer.paint.get('raster-saturation')),
    'u_contrast_factor': contrastFactor(layer.paint.get('raster-contrast')),
    'u_spin_weights': spinWeights(layer.paint.get('raster-hue-rotate'))
});

function spinWeights(angle) {
    angle *= Math.PI / 180;
    const s = Math.sin(angle);
    const c = Math.cos(angle);
    return [
        (2 * c + 1) / 3,
        (-Math.sqrt(3) * s - c + 1) / 3,
        (Math.sqrt(3) * s - c + 1) / 3
    ];
}

function contrastFactor(contrast) {
    return contrast > 0 ?
        1 / (1 - contrast) :
        1 + contrast;
}

function saturationFactor(saturation) {
    return saturation > 0 ?
        1 - 1 / (1.001 - saturation) :
        -saturation;
}

export { rasterUniforms, rasterUniformValues };
