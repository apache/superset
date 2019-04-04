// @flow
import assert from 'assert';

import type {StructArray} from '../util/struct_array';
import type {TriangleIndexArray, LineIndexArray, LineStripIndexArray} from '../data/index_array_type';
import type Context from '../gl/context';


class IndexBuffer {
    context: Context;
    buffer: WebGLBuffer;
    dynamicDraw: boolean;

    constructor(context: Context, array: TriangleIndexArray | LineIndexArray | LineStripIndexArray, dynamicDraw?: boolean) {
        this.context = context;
        const gl = context.gl;
        this.buffer = gl.createBuffer();
        this.dynamicDraw = Boolean(dynamicDraw);

        // The bound index buffer is part of vertex array object state. We don't want to
        // modify whatever VAO happens to be currently bound, so make sure the default
        // vertex array provided by the context is bound instead.
        this.context.unbindVAO();

        context.bindElementBuffer.set(this.buffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, array.arrayBuffer, this.dynamicDraw ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);

        if (!this.dynamicDraw) {
            delete array.arrayBuffer;
        }
    }

    bind() {
        this.context.bindElementBuffer.set(this.buffer);
    }

    updateData(array: StructArray) {
        const gl = this.context.gl;
        assert(this.dynamicDraw);
        // The right VAO will get this buffer re-bound later in VertexArrayObject#bind
        // See https://github.com/mapbox/mapbox-gl-js/issues/5620
        this.context.unbindVAO();
        this.bind();
        gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, 0, array.arrayBuffer);
    }

    destroy() {
        const gl = this.context.gl;
        if (this.buffer) {
            gl.deleteBuffer(this.buffer);
            delete this.buffer;
        }
    }
}

export default IndexBuffer;
