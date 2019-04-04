// @flow

import Texture from './texture';
import Color from '../style-spec/util/color';
import DepthMode from '../gl/depth_mode';
import StencilMode from '../gl/stencil_mode';
import CullFaceMode from '../gl/cull_face_mode';
import {extrusionTextureUniformValues} from './program/fill_extrusion_program';

import type Painter from './painter';
import type CustomStyleLayer from '../style/style_layer/custom_style_layer';
import type FillExtrusionStyleLayer from '../style/style_layer/fill_extrusion_style_layer';

export function prepareOffscreenFramebuffer(painter: Painter, layer: CustomStyleLayer | FillExtrusionStyleLayer) {
    const context = painter.context;
    const gl = context.gl;

    let renderTarget = layer.viewportFrame;

    if (painter.depthRboNeedsClear) {
        painter.setupOffscreenDepthRenderbuffer();
    }

    if (!renderTarget) {
        const texture = new Texture(context, {width: painter.width, height: painter.height, data: null}, gl.RGBA);
        texture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);

        renderTarget = layer.viewportFrame = context.createFramebuffer(painter.width, painter.height);
        renderTarget.colorAttachment.set(texture.texture);
    }

    context.bindFramebuffer.set(renderTarget.framebuffer);
    renderTarget.depthAttachment.set(painter.depthRbo);

    if (painter.depthRboNeedsClear) {
        context.clear({ depth: 1 });
        painter.depthRboNeedsClear = false;
    }

    context.clear({ color: Color.transparent });

    context.setStencilMode(StencilMode.disabled);
    context.setDepthMode(new DepthMode(gl.LEQUAL, DepthMode.ReadWrite, [0, 1]));
    context.setColorMode(painter.colorModeForRenderPass());
}

export function drawOffscreenTexture(painter: Painter, layer: CustomStyleLayer | FillExtrusionStyleLayer, opacity: number) {
    const renderedTexture = layer.viewportFrame;
    if (!renderedTexture) return;

    const context = painter.context;
    const gl = context.gl;

    context.activeTexture.set(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, renderedTexture.colorAttachment.get());

    painter.useProgram('extrusionTexture').draw(context, gl.TRIANGLES,
        DepthMode.disabled, StencilMode.disabled,
        painter.colorModeForRenderPass(),
        CullFaceMode.disabled,
        extrusionTextureUniformValues(painter, opacity, 0),
        layer.id, painter.viewportBuffer, painter.quadTriangleIndexBuffer,
        painter.viewportSegments, layer.paint, painter.transform.zoom);
}
