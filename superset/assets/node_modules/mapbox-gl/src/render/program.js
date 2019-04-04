// @flow

import browser from '../util/browser';

import {prelude} from '../shaders';
import assert from 'assert';
import ProgramConfiguration from '../data/program_configuration';
import VertexArrayObject from './vertex_array_object';
import Context from '../gl/context';

import type SegmentVector from '../data/segment';
import type VertexBuffer from '../gl/vertex_buffer';
import type IndexBuffer from '../gl/index_buffer';
import type DepthMode from '../gl/depth_mode';
import type StencilMode from '../gl/stencil_mode';
import type ColorMode from '../gl/color_mode';
import type CullFaceMode from '../gl/cull_face_mode';
import type {UniformBindings, UniformValues, UniformLocations} from './uniform_binding';

export type DrawMode =
    | $PropertyType<WebGLRenderingContext, 'LINES'>
    | $PropertyType<WebGLRenderingContext, 'TRIANGLES'>
    | $PropertyType<WebGLRenderingContext, 'LINE_STRIP'>;

class Program<Us: UniformBindings> {
    program: WebGLProgram;
    attributes: {[string]: number};
    numAttributes: number;
    fixedUniforms: Us;
    binderUniforms: UniformBindings;

    constructor(context: Context,
                source: {fragmentSource: string, vertexSource: string},
                configuration: ProgramConfiguration,
                fixedUniforms: (Context, UniformLocations) => Us,
                showOverdrawInspector: boolean) {
        const gl = context.gl;
        this.program = gl.createProgram();

        const defines = configuration.defines().concat(
            `#define DEVICE_PIXEL_RATIO ${browser.devicePixelRatio.toFixed(1)}`);
        if (showOverdrawInspector) {
            defines.push('#define OVERDRAW_INSPECTOR;');
        }

        const fragmentSource = defines.concat(prelude.fragmentSource, source.fragmentSource).join('\n');
        const vertexSource = defines.concat(prelude.vertexSource, source.vertexSource).join('\n');
        const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fragmentShader, fragmentSource);
        gl.compileShader(fragmentShader);
        assert(gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS), (gl.getShaderInfoLog(fragmentShader): any));
        gl.attachShader(this.program, fragmentShader);

        const vertexShader = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vertexShader, vertexSource);
        gl.compileShader(vertexShader);
        assert(gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS), (gl.getShaderInfoLog(vertexShader): any));
        gl.attachShader(this.program, vertexShader);

        // Manually bind layout attributes in the order defined by their
        // ProgramInterface so that we don't dynamically link an unused
        // attribute at position 0, which can cause rendering to fail for an
        // entire layer (see #4607, #4728)
        const layoutAttributes = configuration.layoutAttributes || [];
        for (let i = 0; i < layoutAttributes.length; i++) {
            gl.bindAttribLocation(this.program, i, layoutAttributes[i].name);
        }

        gl.linkProgram(this.program);
        assert(gl.getProgramParameter(this.program, gl.LINK_STATUS), (gl.getProgramInfoLog(this.program): any));

        this.numAttributes = gl.getProgramParameter(this.program, gl.ACTIVE_ATTRIBUTES);

        this.attributes = {};
        const uniformLocations = {};

        for (let i = 0; i < this.numAttributes; i++) {
            const attribute = gl.getActiveAttrib(this.program, i);
            if (attribute) {
                this.attributes[attribute.name] = gl.getAttribLocation(this.program, attribute.name);
            }
        }

        const numUniforms = gl.getProgramParameter(this.program, gl.ACTIVE_UNIFORMS);
        for (let i = 0; i < numUniforms; i++) {
            const uniform = gl.getActiveUniform(this.program, i);
            if (uniform) {
                uniformLocations[uniform.name] = gl.getUniformLocation(this.program, uniform.name);
            }
        }

        this.fixedUniforms = fixedUniforms(context, uniformLocations);
        this.binderUniforms = configuration.getUniforms(context, uniformLocations);
    }

    draw(context: Context,
         drawMode: DrawMode,
         depthMode: $ReadOnly<DepthMode>,
         stencilMode: $ReadOnly<StencilMode>,
         colorMode: $ReadOnly<ColorMode>,
         cullFaceMode: $ReadOnly<CullFaceMode>,
         uniformValues: UniformValues<Us>,
         layerID: string,
         layoutVertexBuffer: VertexBuffer,
         indexBuffer: IndexBuffer,
         segments: SegmentVector,
         currentProperties: any,
         zoom: ?number,
         configuration: ?ProgramConfiguration,
         dynamicLayoutBuffer: ?VertexBuffer,
         dynamicLayoutBuffer2: ?VertexBuffer) {

        const gl = context.gl;

        context.program.set(this.program);
        context.setDepthMode(depthMode);
        context.setStencilMode(stencilMode);
        context.setColorMode(colorMode);
        context.setCullFace(cullFaceMode);

        for (const name in this.fixedUniforms) {
            this.fixedUniforms[name].set(uniformValues[name]);
        }

        if (configuration) {
            configuration.setUniforms(context, this.binderUniforms, currentProperties, {zoom: (zoom: any)});
        }

        const primitiveSize = {
            [gl.LINES]: 2,
            [gl.TRIANGLES]: 3,
            [gl.LINE_STRIP]: 1
        }[drawMode];

        for (const segment of segments.get()) {
            const vaos = segment.vaos || (segment.vaos = {});
            const vao: VertexArrayObject = vaos[layerID] || (vaos[layerID] = new VertexArrayObject());

            vao.bind(
                context,
                this,
                layoutVertexBuffer,
                configuration ? configuration.getPaintVertexBuffers() : [],
                indexBuffer,
                segment.vertexOffset,
                dynamicLayoutBuffer,
                dynamicLayoutBuffer2
            );

            gl.drawElements(
                drawMode,
                segment.primitiveLength * primitiveSize,
                gl.UNSIGNED_SHORT,
                segment.primitiveOffset * primitiveSize * 2);
        }
    }
}

export default Program;
