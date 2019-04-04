// @flow

import Color from '../style-spec/util/color';
import DepthMode from '../gl/depth_mode';
import CullFaceMode from '../gl/cull_face_mode';
import {
    fillUniformValues,
    fillPatternUniformValues,
    fillOutlineUniformValues,
    fillOutlinePatternUniformValues
} from './program/fill_program';

import type Painter from './painter';
import type SourceCache from '../source/source_cache';
import type FillStyleLayer from '../style/style_layer/fill_style_layer';
import type FillBucket from '../data/bucket/fill_bucket';
import type {OverscaledTileID} from '../source/tile_id';

export default drawFill;

function drawFill(painter: Painter, sourceCache: SourceCache, layer: FillStyleLayer, coords: Array<OverscaledTileID>) {
    const color = layer.paint.get('fill-color');
    const opacity = layer.paint.get('fill-opacity');

    if (opacity.constantOr(1) === 0) {
        return;
    }

    const colorMode = painter.colorModeForRenderPass();

    const pattern = layer.paint.get('fill-pattern');
    const pass = (!pattern.constantOr((1: any)) &&
        color.constantOr(Color.transparent).a === 1 &&
        opacity.constantOr(0) === 1) ? 'opaque' : 'translucent';

    // Draw fill
    if (painter.renderPass === pass) {
        const depthMode = painter.depthModeForSublayer(
            1, painter.renderPass === 'opaque' ? DepthMode.ReadWrite : DepthMode.ReadOnly);
        drawFillTiles(painter, sourceCache, layer, coords, depthMode, colorMode, false);
    }

    // Draw stroke
    if (painter.renderPass === 'translucent' && layer.paint.get('fill-antialias')) {

        // If we defined a different color for the fill outline, we are
        // going to ignore the bits in 0x07 and just care about the global
        // clipping mask.
        // Otherwise, we only want to drawFill the antialiased parts that are
        // *outside* the current shape. This is important in case the fill
        // or stroke color is translucent. If we wouldn't clip to outside
        // the current shape, some pixels from the outline stroke overlapped
        // the (non-antialiased) fill.
        const depthMode = painter.depthModeForSublayer(
            layer.getPaintProperty('fill-outline-color') ? 2 : 0, DepthMode.ReadOnly);
        drawFillTiles(painter, sourceCache, layer, coords, depthMode, colorMode, true);
    }
}

function drawFillTiles(painter, sourceCache, layer, coords, depthMode, colorMode, isOutline) {
    const gl = painter.context.gl;

    const patternProperty = layer.paint.get('fill-pattern');
    const image = patternProperty && patternProperty.constantOr((1: any));
    const crossfade = layer.getCrossfadeParameters();
    let drawMode, programName, uniformValues, indexBuffer, segments;

    if (!isOutline) {
        programName = image ? 'fillPattern' : 'fill';
        drawMode = gl.TRIANGLES;
    } else {
        programName = image && !layer.getPaintProperty('fill-outline-color') ? 'fillOutlinePattern' : 'fillOutline';
        drawMode = gl.LINES;
    }


    for (const coord of coords) {
        const tile = sourceCache.getTile(coord);
        if (image && !tile.patternsLoaded()) continue;


        const bucket: ?FillBucket = (tile.getBucket(layer): any);
        if (!bucket) continue;

        const programConfiguration = bucket.programConfigurations.get(layer.id);
        const program = painter.useProgram(programName, programConfiguration);

        if (image) {
            painter.context.activeTexture.set(gl.TEXTURE0);
            tile.imageAtlasTexture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);
            programConfiguration.updatePatternPaintBuffers(crossfade);
        }

        const constantPattern = patternProperty.constantOr(null);
        if (constantPattern && tile.imageAtlas) {
            const posTo = tile.imageAtlas.patternPositions[constantPattern.to];
            const posFrom = tile.imageAtlas.patternPositions[constantPattern.from];
            if (posTo && posFrom) programConfiguration.setConstantPatternPositions(posTo, posFrom);
        }

        const tileMatrix = painter.translatePosMatrix(coord.posMatrix, tile,
            layer.paint.get('fill-translate'), layer.paint.get('fill-translate-anchor'));

        if (!isOutline) {
            indexBuffer = bucket.indexBuffer;
            segments = bucket.segments;
            uniformValues = image ?
                fillPatternUniformValues(tileMatrix, painter, crossfade, tile) :
                fillUniformValues(tileMatrix);
        } else {
            indexBuffer = bucket.indexBuffer2;
            segments = bucket.segments2;
            const drawingBufferSize = [gl.drawingBufferWidth, gl.drawingBufferHeight];
            uniformValues = (programName === 'fillOutlinePattern' && image) ?
                fillOutlinePatternUniformValues(tileMatrix, painter, crossfade, tile, drawingBufferSize) :
                fillOutlineUniformValues(tileMatrix, drawingBufferSize);
        }

        program.draw(painter.context, drawMode, depthMode,
            painter.stencilModeForClipping(coord), colorMode, CullFaceMode.disabled, uniformValues,
            layer.id, bucket.layoutVertexBuffer, indexBuffer, segments,
            layer.paint, painter.transform.zoom, programConfiguration);
    }
}
