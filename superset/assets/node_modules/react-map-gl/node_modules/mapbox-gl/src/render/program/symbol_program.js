// @flow

import {
    Uniform1i,
    Uniform1f,
    Uniform2f,
    UniformMatrix4f
} from '../uniform_binding';
import { extend } from '../../util/util';

import type Context from '../../gl/context';
import type Painter from '../painter';
import type {UniformValues, UniformLocations} from '../uniform_binding';

export type SymbolIconUniformsType = {|
    'u_is_size_zoom_constant': Uniform1i,
    'u_is_size_feature_constant': Uniform1i,
    'u_size_t': Uniform1f,
    'u_size': Uniform1f,
    'u_camera_to_center_distance': Uniform1f,
    'u_pitch': Uniform1f,
    'u_rotate_symbol': Uniform1i,
    'u_aspect_ratio': Uniform1f,
    'u_fade_change': Uniform1f,
    'u_matrix': UniformMatrix4f,
    'u_label_plane_matrix': UniformMatrix4f,
    'u_gl_coord_matrix': UniformMatrix4f,
    'u_is_text': Uniform1f,
    'u_pitch_with_map': Uniform1i,
    'u_texsize': Uniform2f,
    'u_texture': Uniform1i
|};

export type SymbolSDFUniformsType = {|
    'u_is_size_zoom_constant': Uniform1i,
    'u_is_size_feature_constant': Uniform1i,
    'u_size_t': Uniform1f,
    'u_size': Uniform1f,
    'u_camera_to_center_distance': Uniform1f,
    'u_pitch': Uniform1f,
    'u_rotate_symbol': Uniform1i,
    'u_aspect_ratio': Uniform1f,
    'u_fade_change': Uniform1f,
    'u_matrix': UniformMatrix4f,
    'u_label_plane_matrix': UniformMatrix4f,
    'u_gl_coord_matrix': UniformMatrix4f,
    'u_is_text': Uniform1f,
    'u_pitch_with_map': Uniform1i,
    'u_texsize': Uniform2f,
    'u_texture': Uniform1i,
    'u_gamma_scale': Uniform1f,
    'u_is_halo': Uniform1f
|};

const symbolIconUniforms = (context: Context, locations: UniformLocations): SymbolIconUniformsType => ({
    'u_is_size_zoom_constant': new Uniform1i(context, locations.u_is_size_zoom_constant),
    'u_is_size_feature_constant': new Uniform1i(context, locations.u_is_size_feature_constant),
    'u_size_t': new Uniform1f(context, locations.u_size_t),
    'u_size': new Uniform1f(context, locations.u_size),
    'u_camera_to_center_distance': new Uniform1f(context, locations.u_camera_to_center_distance),
    'u_pitch': new Uniform1f(context, locations.u_pitch),
    'u_rotate_symbol': new Uniform1i(context, locations.u_rotate_symbol),
    'u_aspect_ratio': new Uniform1f(context, locations.u_aspect_ratio),
    'u_fade_change': new Uniform1f(context, locations.u_fade_change),
    'u_matrix': new UniformMatrix4f(context, locations.u_matrix),
    'u_label_plane_matrix': new UniformMatrix4f(context, locations.u_label_plane_matrix),
    'u_gl_coord_matrix': new UniformMatrix4f(context, locations.u_gl_coord_matrix),
    'u_is_text': new Uniform1f(context, locations.u_is_text),
    'u_pitch_with_map': new Uniform1i(context, locations.u_pitch_with_map),
    'u_texsize': new Uniform2f(context, locations.u_texsize),
    'u_texture': new Uniform1i(context, locations.u_texture)
});

const symbolSDFUniforms = (context: Context, locations: UniformLocations): SymbolSDFUniformsType => ({
    'u_is_size_zoom_constant': new Uniform1i(context, locations.u_is_size_zoom_constant),
    'u_is_size_feature_constant': new Uniform1i(context, locations.u_is_size_feature_constant),
    'u_size_t': new Uniform1f(context, locations.u_size_t),
    'u_size': new Uniform1f(context, locations.u_size),
    'u_camera_to_center_distance': new Uniform1f(context, locations.u_camera_to_center_distance),
    'u_pitch': new Uniform1f(context, locations.u_pitch),
    'u_rotate_symbol': new Uniform1i(context, locations.u_rotate_symbol),
    'u_aspect_ratio': new Uniform1f(context, locations.u_aspect_ratio),
    'u_fade_change': new Uniform1f(context, locations.u_fade_change),
    'u_matrix': new UniformMatrix4f(context, locations.u_matrix),
    'u_label_plane_matrix': new UniformMatrix4f(context, locations.u_label_plane_matrix),
    'u_gl_coord_matrix': new UniformMatrix4f(context, locations.u_gl_coord_matrix),
    'u_is_text': new Uniform1f(context, locations.u_is_text),
    'u_pitch_with_map': new Uniform1i(context, locations.u_pitch_with_map),
    'u_texsize': new Uniform2f(context, locations.u_texsize),
    'u_texture': new Uniform1i(context, locations.u_texture),
    'u_gamma_scale': new Uniform1f(context, locations.u_gamma_scale),
    'u_is_halo': new Uniform1f(context, locations.u_is_halo)
});

const symbolIconUniformValues = (
    functionType: string,
    size: ?{uSizeT: number, uSize: number},
    rotateInShader: boolean,
    pitchWithMap: boolean,
    painter: Painter,
    matrix: Float32Array,
    labelPlaneMatrix: Float32Array,
    glCoordMatrix: Float32Array,
    isText: boolean,
    texSize: [number, number]
): UniformValues<SymbolIconUniformsType> => {
    const transform = painter.transform;

    return {
        'u_is_size_zoom_constant': +(functionType === 'constant' || functionType === 'source'),
        'u_is_size_feature_constant': +(functionType === 'constant' || functionType === 'camera'),
        'u_size_t': size ? size.uSizeT : 0,
        'u_size': size ? size.uSize : 0,
        'u_camera_to_center_distance': transform.cameraToCenterDistance,
        'u_pitch': transform.pitch / 360 * 2 * Math.PI,
        'u_rotate_symbol': +rotateInShader,
        'u_aspect_ratio': transform.width / transform.height,
        'u_fade_change': painter.options.fadeDuration ? painter.symbolFadeChange : 1,
        'u_matrix': matrix,
        'u_label_plane_matrix': labelPlaneMatrix,
        'u_gl_coord_matrix': glCoordMatrix,
        'u_is_text': +isText,
        'u_pitch_with_map': +pitchWithMap,
        'u_texsize': texSize,
        'u_texture': 0
    };
};

const symbolSDFUniformValues = (
    functionType: string,
    size: ?{uSizeT: number, uSize: number},
    rotateInShader: boolean,
    pitchWithMap: boolean,
    painter: Painter,
    matrix: Float32Array,
    labelPlaneMatrix: Float32Array,
    glCoordMatrix: Float32Array,
    isText: boolean,
    texSize: [number, number],
    isHalo: boolean
): UniformValues<SymbolSDFUniformsType> => {
    const transform = painter.transform;

    return extend(symbolIconUniformValues(functionType, size,
        rotateInShader, pitchWithMap, painter, matrix, labelPlaneMatrix,
        glCoordMatrix, isText, texSize), {
        'u_gamma_scale': (pitchWithMap ? Math.cos(transform._pitch) * transform.cameraToCenterDistance : 1),
        'u_is_halo': +isHalo
    });
};

export { symbolIconUniforms, symbolSDFUniforms, symbolIconUniformValues, symbolSDFUniformValues };
