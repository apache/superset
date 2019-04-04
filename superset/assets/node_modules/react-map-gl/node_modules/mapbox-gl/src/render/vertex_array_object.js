// @flow

import assert from 'assert';

import type Program from './program';
import type VertexBuffer from '../gl/vertex_buffer';
import type IndexBuffer from '../gl/index_buffer';
import type Context from '../gl/context';

class VertexArrayObject {
    context: Context;
    boundProgram: ?Program<*>;
    boundLayoutVertexBuffer: ?VertexBuffer;
    boundPaintVertexBuffers: Array<VertexBuffer>;
    boundIndexBuffer: ?IndexBuffer;
    boundVertexOffset: ?number;
    boundDynamicVertexBuffer: ?VertexBuffer;
    boundDynamicVertexBuffer2: ?VertexBuffer;
    vao: any;

    constructor() {
        this.boundProgram = null;
        this.boundLayoutVertexBuffer = null;
        this.boundPaintVertexBuffers = [];
        this.boundIndexBuffer = null;
        this.boundVertexOffset = null;
        this.boundDynamicVertexBuffer = null;
        this.vao = null;
    }

    bind(context: Context,
         program: Program<*>,
         layoutVertexBuffer: VertexBuffer,
         paintVertexBuffers: Array<VertexBuffer>,
         indexBuffer: ?IndexBuffer,
         vertexOffset: ?number,
         dynamicVertexBuffer: ?VertexBuffer,
         dynamicVertexBuffer2: ?VertexBuffer) {

        this.context = context;

        let paintBuffersDiffer = this.boundPaintVertexBuffers.length !== paintVertexBuffers.length;
        for (let i = 0; !paintBuffersDiffer && i < paintVertexBuffers.length; i++) {
            if (this.boundPaintVertexBuffers[i] !== paintVertexBuffers[i]) {
                paintBuffersDiffer = true;
            }
        }

        const isFreshBindRequired = (
            !this.vao ||
            this.boundProgram !== program ||
            this.boundLayoutVertexBuffer !== layoutVertexBuffer ||
            paintBuffersDiffer ||
            this.boundIndexBuffer !== indexBuffer ||
            this.boundVertexOffset !== vertexOffset ||
            this.boundDynamicVertexBuffer !== dynamicVertexBuffer ||
            this.boundDynamicVertexBuffer2 !== dynamicVertexBuffer2
        );

        if (!context.extVertexArrayObject || isFreshBindRequired) {
            this.freshBind(program, layoutVertexBuffer, paintVertexBuffers, indexBuffer, vertexOffset, dynamicVertexBuffer, dynamicVertexBuffer2);
        } else {
            context.bindVertexArrayOES.set(this.vao);

            if (dynamicVertexBuffer) {
                // The buffer may have been updated. Rebind to upload data.
                dynamicVertexBuffer.bind();
            }

            if (indexBuffer && indexBuffer.dynamicDraw) {
                indexBuffer.bind();
            }

            if (dynamicVertexBuffer2) {
                dynamicVertexBuffer2.bind();
            }
        }
    }

    freshBind(program: Program<*>,
              layoutVertexBuffer: VertexBuffer,
              paintVertexBuffers: Array<VertexBuffer>,
              indexBuffer: ?IndexBuffer,
              vertexOffset: ?number,
              dynamicVertexBuffer: ?VertexBuffer,
              dynamicVertexBuffer2: ?VertexBuffer) {
        let numPrevAttributes;
        const numNextAttributes = program.numAttributes;

        const context = this.context;
        const gl = context.gl;

        if (context.extVertexArrayObject) {
            if (this.vao) this.destroy();
            this.vao = context.extVertexArrayObject.createVertexArrayOES();
            context.bindVertexArrayOES.set(this.vao);
            numPrevAttributes = 0;

            // store the arguments so that we can verify them when the vao is bound again
            this.boundProgram = program;
            this.boundLayoutVertexBuffer = layoutVertexBuffer;
            this.boundPaintVertexBuffers = paintVertexBuffers;
            this.boundIndexBuffer = indexBuffer;
            this.boundVertexOffset = vertexOffset;
            this.boundDynamicVertexBuffer = dynamicVertexBuffer;
            this.boundDynamicVertexBuffer2 = dynamicVertexBuffer2;

        } else {
            numPrevAttributes = context.currentNumAttributes || 0;

            // Disable all attributes from the previous program that aren't used in
            // the new program. Note: attribute indices are *not* program specific!
            for (let i = numNextAttributes; i < numPrevAttributes; i++) {
                // WebGL breaks if you disable attribute 0.
                // http://stackoverflow.com/questions/20305231
                assert(i !== 0);
                gl.disableVertexAttribArray(i);
            }
        }

        layoutVertexBuffer.enableAttributes(gl, program);
        for (const vertexBuffer of paintVertexBuffers) {
            vertexBuffer.enableAttributes(gl, program);
        }

        if (dynamicVertexBuffer) {
            dynamicVertexBuffer.enableAttributes(gl, program);
        }
        if (dynamicVertexBuffer2) {
            dynamicVertexBuffer2.enableAttributes(gl, program);
        }

        layoutVertexBuffer.bind();
        layoutVertexBuffer.setVertexAttribPointers(gl, program, vertexOffset);
        for (const vertexBuffer of paintVertexBuffers) {
            vertexBuffer.bind();
            vertexBuffer.setVertexAttribPointers(gl, program, vertexOffset);
        }

        if (dynamicVertexBuffer) {
            dynamicVertexBuffer.bind();
            dynamicVertexBuffer.setVertexAttribPointers(gl, program, vertexOffset);
        }
        if (indexBuffer) {
            indexBuffer.bind();
        }
        if (dynamicVertexBuffer2) {
            dynamicVertexBuffer2.bind();
            dynamicVertexBuffer2.setVertexAttribPointers(gl, program, vertexOffset);
        }

        context.currentNumAttributes = numNextAttributes;
    }

    destroy() {
        if (this.vao) {
            this.context.extVertexArrayObject.deleteVertexArrayOES(this.vao);
            this.vao = null;
        }
    }
}

export default VertexArrayObject;
