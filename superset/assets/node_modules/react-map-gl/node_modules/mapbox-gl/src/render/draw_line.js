// @flow

import DepthMode from '../gl/depth_mode';
import CullFaceMode from '../gl/cull_face_mode';
import Texture from './texture';
import {
    lineUniformValues,
    linePatternUniformValues,
    lineSDFUniformValues,
    lineGradientUniformValues
} from './program/line_program';

import type Painter from './painter';
import type SourceCache from '../source/source_cache';
import type LineStyleLayer from '../style/style_layer/line_style_layer';
import type LineBucket from '../data/bucket/line_bucket';
import type {OverscaledTileID} from '../source/tile_id';

export default function drawLine(painter: Painter, sourceCache: SourceCache, layer: LineStyleLayer, coords: Array<OverscaledTileID>) {
    if (painter.renderPass !== 'translucent') return;

    const opacity = layer.paint.get('line-opacity');
    const width = layer.paint.get('line-width');
    if (opacity.constantOr(1) === 0 || width.constantOr(1) === 0) return;

    const depthMode = painter.depthModeForSublayer(0, DepthMode.ReadOnly);
    const colorMode = painter.colorModeForRenderPass();

    const dasharray = layer.paint.get('line-dasharray');
    const patternProperty = layer.paint.get('line-pattern');
    const image = patternProperty.constantOr((1: any));

    const gradient = layer.paint.get('line-gradient');
    const crossfade = layer.getCrossfadeParameters();

    const programId =
        dasharray ? 'lineSDF' :
        image ? 'linePattern' :
        gradient ? 'lineGradient' : 'line';

    const context = painter.context;
    const gl = context.gl;

    let firstTile = true;

    if (gradient) {
        context.activeTexture.set(gl.TEXTURE0);

        let gradientTexture = layer.gradientTexture;
        if (!layer.gradient) return;
        if (!gradientTexture) gradientTexture = layer.gradientTexture = new Texture(context, layer.gradient, gl.RGBA);
        gradientTexture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);
    }

    for (const coord of coords) {
        const tile = sourceCache.getTile(coord);

        if (image && !tile.patternsLoaded()) continue;

        const bucket: ?LineBucket = (tile.getBucket(layer): any);
        if (!bucket) continue;

        const programConfiguration = bucket.programConfigurations.get(layer.id);
        const prevProgram = painter.context.program.get();
        const program = painter.useProgram(programId, programConfiguration);
        const programChanged = firstTile || program.program !== prevProgram;

        const constantPattern = patternProperty.constantOr(null);
        if (constantPattern && tile.imageAtlas) {
            const posTo = tile.imageAtlas.patternPositions[constantPattern.to];
            const posFrom = tile.imageAtlas.patternPositions[constantPattern.from];
            if (posTo && posFrom) programConfiguration.setConstantPatternPositions(posTo, posFrom);
        }

        const uniformValues = dasharray ? lineSDFUniformValues(painter, tile, layer, dasharray, crossfade) :
            image ? linePatternUniformValues(painter, tile, layer, crossfade) :
            gradient ? lineGradientUniformValues(painter, tile, layer) :
            lineUniformValues(painter, tile, layer);

        if (dasharray && (programChanged || painter.lineAtlas.dirty)) {
            context.activeTexture.set(gl.TEXTURE0);
            painter.lineAtlas.bind(context);
        } else if (image) {
            context.activeTexture.set(gl.TEXTURE0);
            tile.imageAtlasTexture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);
            programConfiguration.updatePatternPaintBuffers(crossfade);
        }

        program.draw(context, gl.TRIANGLES, depthMode,
            painter.stencilModeForClipping(coord), colorMode, CullFaceMode.disabled, uniformValues,
            layer.id, bucket.layoutVertexBuffer, bucket.indexBuffer, bucket.segments,
            layer.paint, painter.transform.zoom, programConfiguration);

        firstTile = false;
        // once refactored so that bound texture state is managed, we'll also be able to remove this firstTile/programChanged logic
    }
}
