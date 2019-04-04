// @flow

import StencilMode from '../gl/stencil_mode';
import DepthMode from '../gl/depth_mode';
import CullFaceMode from '../gl/cull_face_mode';
import {
    backgroundUniformValues,
    backgroundPatternUniformValues
} from './program/background_program';

import type Painter from './painter';
import type SourceCache from '../source/source_cache';
import type BackgroundStyleLayer from '../style/style_layer/background_style_layer';

export default drawBackground;

function drawBackground(painter: Painter, sourceCache: SourceCache, layer: BackgroundStyleLayer) {
    const color = layer.paint.get('background-color');
    const opacity = layer.paint.get('background-opacity');

    if (opacity === 0) return;

    const context = painter.context;
    const gl = context.gl;
    const transform = painter.transform;
    const tileSize = transform.tileSize;
    const image = layer.paint.get('background-pattern');
    if (painter.isPatternMissing(image)) return;

    const pass = (!image && color.a === 1 && opacity === 1) ? 'opaque' : 'translucent';
    if (painter.renderPass !== pass) return;

    const stencilMode = StencilMode.disabled;
    const depthMode = painter.depthModeForSublayer(0, pass === 'opaque' ? DepthMode.ReadWrite : DepthMode.ReadOnly);
    const colorMode = painter.colorModeForRenderPass();

    const program = painter.useProgram(image ? 'backgroundPattern' : 'background');

    const tileIDs = transform.coveringTiles({tileSize});

    if (image) {
        context.activeTexture.set(gl.TEXTURE0);
        painter.imageManager.bind(painter.context);
    }

    const crossfade = layer.getCrossfadeParameters();
    for (const tileID of tileIDs) {
        const matrix = painter.transform.calculatePosMatrix(tileID.toUnwrapped());

        const uniformValues = image ?
            backgroundPatternUniformValues(matrix, opacity, painter, image, {tileID, tileSize}, crossfade) :
            backgroundUniformValues(matrix, opacity, color);

        program.draw(context, gl.TRIANGLES, depthMode, stencilMode, colorMode, CullFaceMode.disabled,
            uniformValues, layer.id, painter.tileExtentBuffer,
            painter.quadTriangleIndexBuffer, painter.tileExtentSegments);
    }
}
