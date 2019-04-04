// @flow
import { ColorAttachment, DepthAttachment } from './value';

import type Context from './context';

class Framebuffer {
    context: Context;
    width: number;
    height: number;
    framebuffer: WebGLFramebuffer;
    colorAttachment: ColorAttachment;
    depthAttachment: DepthAttachment;

    constructor(context: Context, width: number, height: number) {
        this.context = context;
        this.width = width;
        this.height = height;
        const gl = context.gl;
        const fbo = this.framebuffer = gl.createFramebuffer();

        this.colorAttachment = new ColorAttachment(context, fbo);
        this.depthAttachment = new DepthAttachment(context, fbo);
    }

    destroy() {
        const gl = this.context.gl;

        const texture = this.colorAttachment.get();
        if (texture) gl.deleteTexture(texture);

        const renderbuffer = this.depthAttachment.get();
        if (renderbuffer) gl.deleteRenderbuffer(renderbuffer);

        gl.deleteFramebuffer(this.framebuffer);
    }
}

export default Framebuffer;
