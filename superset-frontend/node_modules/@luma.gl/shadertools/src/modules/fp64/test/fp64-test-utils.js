// Copyright (c) 2015 - 2017 Uber Technologies, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the 'Software'), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

// Special utility functions for df64 tests

/* eslint-disable camelcase, prefer-template, max-len */
/* global window, document, */

import {Buffer, Program, assembleShaders, registerShaderModules, fp64} from '@luma.gl/core';
import {
  initializeGL,
  initializeTexTarget,
  render,
  getGPUOutput
} from '../../../test/gpu-test-utils';

const BUFFER_DATA = new Float32Array([1, 1, -1, 1, 1, -1, -1, -1]);

function fp64ify(a) {
  const hi = Math.fround(a);
  const lo = a - Math.fround(a);
  return new Float32Array([hi, lo]);
}

function getFloat64(upper = 256) {
  return Math.random() * Math.pow(2.0, (Math.random() - 0.5) * upper);
}

export function getRelativeError64(result, reference) {
  const reference64 = reference[0] + reference[1];
  const result64 = result[0] + result[1];
  // When refrence valu is < 1, dividing with it increases total value of difference.
  if (reference64 < 1) {
    return Math.abs(reference64 - result64);
  }
  return Math.abs((reference64 - result64) / reference64);
}

export function getRelativeError(result, reference) {
  return Math.abs((reference - result) / reference);
}

function getBinaryShader(operation) {
  return `\
attribute vec3 positions;
uniform vec2 a;
uniform vec2 b;
varying vec4 vColor;
void main(void) {
  gl_Position = vec4(positions, 1.0);
  vec2 result = ${operation}(a, b);
  vColor = vec4(result.x, result.y, 0.0, 1.0);
}
`;
}

function getUnaryShader(operation) {
  return `\
attribute vec3 positions;
uniform vec2 a;
varying vec4 vColor;
void main(void) {
  gl_Position = vec4(positions, 1.0);
  vec2 result = ${operation}(a);
  vColor = vec4(result.x, result.y, 0.0, 1.0);
}
`;
}

const FS_RENDER_VCOLOR = `\
precision highp float;
varying vec4 vColor;
void main(void) {
  gl_FragColor = vColor;
}
`;

function setupFloatTest(gl, {glslFunc, binary = false, limit = 256, op}) {
  const a = getFloat64(limit);
  const b = getFloat64(limit);
  const expected = op(a, b);

  const a_fp64 = fp64ify(a);
  const b_fp64 = fp64ify(b);
  const expected_fp64 = fp64ify(expected);

  const vs = binary ? getBinaryShader(glslFunc) : getUnaryShader(glslFunc);

  const program = new Program(
    gl,
    assembleShaders(gl, {
      vs,
      fs: FS_RENDER_VCOLOR,
      modules: ['fp64']
    })
  );

  program
    .setBuffers({
      positions: new Buffer(gl, {target: gl.ARRAY_BUFFER, data: BUFFER_DATA, size: 2})
    })
    .setUniforms({
      a: a_fp64,
      b: b_fp64,
      ONE: 1.0
    });

  return {a, b, expected, a_fp64, b_fp64, expected_fp64, program};
}

const ITERATIONS = 10;
const EPSILON = 1e-14;

export function testcase(gl, {glslFunc, binary, op, limit = 256, t}) {
  for (let idx0 = 0; idx0 < ITERATIONS; idx0++) {
    const {a, b, a_fp64, b_fp64, expected_fp64} = setupFloatTest(gl, {
      glslFunc,
      binary,
      op,
      limit
    });
    render(gl);
    const gpu_result = getGPUOutput(gl);
    const relativeError = getRelativeError64(gpu_result, expected_fp64);
    const args = binary ? `(${a.toPrecision(2)}, ${b.toPrecision(2)})` : `(${a.toPrecision(2)})`;
    const message = `${glslFunc}${args}: error=${relativeError}, within ${EPSILON}`;
    t.ok(relativeError < EPSILON, message);
    if (relativeError >= EPSILON) {
      t.comment(` (tested ${a_fp64.toString()}, ${b_fp64.toString()})`);
    }
  }
  t.end();
}

// Main entrance
const canvas = document.createElement('canvas');
canvas.width = 16;
canvas.height = 16;

export const gl = initializeGL(canvas);
initializeTexTarget(gl);
registerShaderModules([fp64]);

window.onload = () => {
  document.body.appendChild(canvas);
};
