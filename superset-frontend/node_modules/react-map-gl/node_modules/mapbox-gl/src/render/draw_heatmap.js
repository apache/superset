// @flow

import Texture from './texture';
import Color from '../style-spec/util/color';
import DepthMode from '../gl/depth_mode';
import StencilMode from '../gl/stencil_mode';
import ColorMode from '../gl/color_mode';
import CullFaceMode from '../gl/cull_face_mode';
import {
    heatmapUniformValues,
    heatmapTextureUniformValues
} from './program/heatmap_program';

import type Painter from './painter';
import type SourceCache from '../source/source_cache';
import type HeatmapStyleLayer from '../style/style_layer/heatmap_style_layer';
import type HeatmapBucket from '../data/bucket/heatmap_bucket';
import type {OverscaledTileID} from '../source/tile_id';

export default drawHeatmap;

function drawHeatmap(painter: Painter, sourceCache: SourceCache, layer: HeatmapStyleLayer, coords: Array<OverscaledTileID>) {
    if (layer.paint.get('heatmap-opacity') === 0) {
        return;
    }

    if (painter.renderPass === 'offscreen') {
        const context = painter.context;
        const gl = context.gl;

        const depthMode = painter.depthModeForSublayer(0, DepthMode.ReadOnly);
        // Allow kernels to be drawn across boundaries, so that
        // large kernels are not clipped to tiles
        const stencilMode = StencilMode.disabled;
        // Turn on additive blending for kernels, which is a key aspect of kernel density estimation formula
        const colorMode = new ColorMode([gl.ONE, gl.ONE], Color.transparent, [true, true, true, true]);

        bindFramebuffer(context, painter, layer);

        context.clear({ color: Color.transparent });

        for (let i = 0; i < coords.length; i++) {
            const coord = coords[i];

            // Skip tiles that have uncovered parents to avoid flickering; we don't need
            // to use complex tile masking here because the change between zoom levels is subtle,
            // so it's fine to simply render the parent until all its 4 children are loaded
            if (sourceCache.hasRenderableParent(coord)) continue;

            const tile = sourceCache.getTile(coord);
            const bucket: ?HeatmapBucket = (tile.getBucket(layer): any);
            if (!bucket) continue;

            const programConfiguration = bucket.programConfigurations.get(layer.id);
            const program = painter.useProgram('heatmap', programConfiguration);
            const {zoom} = painter.transform;

            program.draw(context, gl.TRIANGLES, depthMode, stencilMode, colorMode, CullFaceMode.disabled,
                heatmapUniformValues(coord.posMatrix,
                    tile, zoom, layer.paint.get('heatmap-intensity')),
                layer.id, bucket.layoutVertexBuffer, bucket.indexBuffer,
                bucket.segments, layer.paint, painter.transform.zoom,
                programConfiguration);
        }

        context.viewport.set([0, 0, painter.width, painter.height]);

    } else if (painter.renderPass === 'translucent') {
        painter.context.setColorMode(painter.colorModeForRenderPass());
        renderTextureToMap(painter, layer);
    }
}

function bindFramebuffer(context, painter, layer) {
    const gl = context.gl;
    context.activeTexture.set(gl.TEXTURE1);

    // Use a 4x downscaled screen texture for better performance
    context.viewport.set([0, 0, painter.width / 4, painter.height / 4]);

    let fbo = layer.heatmapFbo;

    if (!fbo) {
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        fbo = layer.heatmapFbo = context.createFramebuffer(painter.width / 4, painter.height / 4);

        bindTextureToFramebuffer(context, painter, texture, fbo);

    } else {
        gl.bindTexture(gl.TEXTURE_2D, fbo.colorAttachment.get());
        context.bindFramebuffer.set(fbo.framebuffer);
    }
}

function bindTextureToFramebuffer(context, painter, texture, fbo) {
    const gl = context.gl;
    // Use the higher precision half-float texture where available (producing much smoother looking heatmaps);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, painter.width / 4, painter.height / 4, 0, gl.RGBA,
        context.extTextureHalfFloat ? context.extTextureHalfFloat.HALF_FLOAT_OES : gl.UNSIGNED_BYTE, null);

    fbo.colorAttachment.set(texture);

    // If using half-float texture as a render target is not supported, fall back to a low precision texture
    if (context.extTextureHalfFloat && gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
        context.extTextureHalfFloat = null;
        fbo.colorAttachment.setDirty();
        bindTextureToFramebuffer(context, painter, texture, fbo);
    }
}

function renderTextureToMap(painter, layer) {
    const context = painter.context;
    const gl = context.gl;

    // Here we bind two different textures from which we'll sample in drawing
    // heatmaps: the kernel texture, prepared in the offscreen pass, and a
    // color ramp texture.
    const fbo = layer.heatmapFbo;
    if (!fbo) return;
    context.activeTexture.set(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, fbo.colorAttachment.get());

    context.activeTexture.set(gl.TEXTURE1);
    let colorRampTexture = layer.colorRampTexture;
    if (!colorRampTexture) {
        colorRampTexture = layer.colorRampTexture = new Texture(context, layer.colorRamp, gl.RGBA);
    }
    colorRampTexture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);

    painter.useProgram('heatmapTexture').draw(context, gl.TRIANGLES,
        DepthMode.disabled, StencilMode.disabled, painter.colorModeForRenderPass(), CullFaceMode.disabled,
        heatmapTextureUniformValues(painter, layer, 0, 1),
        layer.id, painter.viewportBuffer, painter.quadTriangleIndexBuffer,
        painter.viewportSegments, layer.paint, painter.transform.zoom);
}
