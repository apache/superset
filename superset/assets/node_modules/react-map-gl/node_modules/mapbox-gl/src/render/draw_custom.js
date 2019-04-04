// @flow

export default drawCustom;

import DepthMode from '../gl/depth_mode';
import StencilMode from '../gl/stencil_mode';
import {prepareOffscreenFramebuffer, drawOffscreenTexture} from './offscreen';

import type Painter from './painter';
import type SourceCache from '../source/source_cache';
import type CustomStyleLayer from '../style/style_layer/custom_style_layer';

function drawCustom(painter: Painter, sourceCache: SourceCache, layer: CustomStyleLayer) {

    const context = painter.context;
    const implementation = layer.implementation;

    if (painter.renderPass === 'offscreen') {

        const prerender = implementation.prerender;
        if (prerender) {
            painter.setCustomLayerDefaults();

            prerender.call(implementation, context.gl, painter.transform.customLayerMatrix());

            context.setDirty();
            painter.setBaseState();
        }

        if (implementation.renderingMode === '3d') {
            painter.setCustomLayerDefaults();

            prepareOffscreenFramebuffer(painter, layer);
            implementation.render(context.gl, painter.transform.customLayerMatrix());

            context.setDirty();
            painter.setBaseState();
        }

    } else if (painter.renderPass === 'translucent') {

        if (implementation.renderingMode === '3d') {
            drawOffscreenTexture(painter, layer, 1);

        } else {
            painter.setCustomLayerDefaults();

            context.setColorMode(painter.colorModeForRenderPass());
            context.setStencilMode(StencilMode.disabled);

            const depthMode = painter.depthModeForSublayer(0, DepthMode.ReadOnly);
            context.setDepthMode(depthMode);

            implementation.render(context.gl, painter.transform.customLayerMatrix());

            context.setDirty();
            painter.setBaseState();
            context.bindFramebuffer.set(null);
        }
    }
}
