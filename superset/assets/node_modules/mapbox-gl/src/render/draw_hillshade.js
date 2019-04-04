// @flow

import Texture from './texture';
import StencilMode from '../gl/stencil_mode';
import DepthMode from '../gl/depth_mode';
import CullFaceMode from '../gl/cull_face_mode';
import {
    hillshadeUniformValues,
    hillshadeUniformPrepareValues
} from './program/hillshade_program';

import type Painter from './painter';
import type SourceCache from '../source/source_cache';
import type HillshadeStyleLayer from '../style/style_layer/hillshade_style_layer';
import type {OverscaledTileID} from '../source/tile_id';

export default drawHillshade;

function drawHillshade(painter: Painter, sourceCache: SourceCache, layer: HillshadeStyleLayer, tileIDs: Array<OverscaledTileID>) {
    if (painter.renderPass !== 'offscreen' && painter.renderPass !== 'translucent') return;

    const context = painter.context;
    const sourceMaxZoom = sourceCache.getSource().maxzoom;

    const depthMode = painter.depthModeForSublayer(0, DepthMode.ReadOnly);
    const stencilMode = StencilMode.disabled;
    const colorMode = painter.colorModeForRenderPass();

    for (const tileID of tileIDs) {
        const tile = sourceCache.getTile(tileID);
        if (tile.needsHillshadePrepare && painter.renderPass === 'offscreen') {
            prepareHillshade(painter, tile, layer, sourceMaxZoom, depthMode, stencilMode, colorMode);
            continue;
        } else if (painter.renderPass === 'translucent') {
            renderHillshade(painter, tile, layer, depthMode, stencilMode, colorMode);
        }
    }

    context.viewport.set([0, 0, painter.width, painter.height]);
}

function renderHillshade(painter, tile, layer, depthMode, stencilMode, colorMode) {
    const context = painter.context;
    const gl = context.gl;
    const fbo = tile.fbo;
    if (!fbo) return;

    const program = painter.useProgram('hillshade');

    context.activeTexture.set(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, fbo.colorAttachment.get());

    const uniformValues = hillshadeUniformValues(painter, tile, layer);

    if (tile.maskedBoundsBuffer && tile.maskedIndexBuffer && tile.segments) {
        program.draw(context, gl.TRIANGLES, depthMode, stencilMode, colorMode, CullFaceMode.disabled,
            uniformValues, layer.id, tile.maskedBoundsBuffer,
            tile.maskedIndexBuffer, tile.segments);
    } else {
        program.draw(context, gl.TRIANGLES, depthMode, stencilMode, colorMode, CullFaceMode.disabled,
            uniformValues, layer.id, painter.rasterBoundsBuffer,
            painter.quadTriangleIndexBuffer, painter.rasterBoundsSegments);
    }
}

// hillshade rendering is done in two steps. the prepare step first calculates the slope of the terrain in the x and y
// directions for each pixel, and saves those values to a framebuffer texture in the r and g channels.
function prepareHillshade(painter, tile, layer, sourceMaxZoom, depthMode, stencilMode, colorMode) {
    const context = painter.context;
    const gl = context.gl;
    // decode rgba levels by using integer overflow to convert each Uint32Array element -> 4 Uint8Array elements.
    // ex.
    // Uint32:
    // base 10 - 67308
    // base 2 - 0000 0000 0000 0001 0000 0110 1110 1100
    //
    // Uint8:
    // base 10 - 0, 1, 6, 236 (this order is reversed in the resulting array via the overflow.
    // first 8 bits represent 236, so the r component of the texture pixel will be 236 etc.)
    // base 2 - 0000 0000, 0000 0001, 0000 0110, 1110 1100
    if (tile.dem && tile.dem.data) {
        const tileSize = tile.dem.dim;
        const textureStride = tile.dem.stride;

        const pixelData = tile.dem.getPixels();
        context.activeTexture.set(gl.TEXTURE1);

        // if UNPACK_PREMULTIPLY_ALPHA_WEBGL is set to true prior to drawHillshade being called
        // tiles will appear blank, because as you can see above the alpha value for these textures
        // is always 0
        context.pixelStoreUnpackPremultiplyAlpha.set(false);
        tile.demTexture = tile.demTexture || painter.getTileTexture(textureStride);
        if (tile.demTexture) {
            const demTexture = tile.demTexture;
            demTexture.update(pixelData, { premultiply: false });
            demTexture.bind(gl.NEAREST, gl.CLAMP_TO_EDGE);
        } else {
            tile.demTexture = new Texture(context, pixelData, gl.RGBA, { premultiply: false });
            tile.demTexture.bind(gl.NEAREST, gl.CLAMP_TO_EDGE);
        }

        context.activeTexture.set(gl.TEXTURE0);

        let fbo = tile.fbo;

        if (!fbo) {
            const renderTexture = new Texture(context, {width: tileSize, height: tileSize, data: null}, gl.RGBA);
            renderTexture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);

            fbo = tile.fbo = context.createFramebuffer(tileSize, tileSize);
            fbo.colorAttachment.set(renderTexture.texture);
        }

        context.bindFramebuffer.set(fbo.framebuffer);
        context.viewport.set([0, 0, tileSize, tileSize]);

        painter.useProgram('hillshadePrepare').draw(context, gl.TRIANGLES,
            depthMode, stencilMode, colorMode, CullFaceMode.disabled,
            hillshadeUniformPrepareValues(tile, sourceMaxZoom),
            layer.id, painter.rasterBoundsBuffer,
            painter.quadTriangleIndexBuffer, painter.rasterBoundsSegments);

        tile.needsHillshadePrepare = false;
    }
}
