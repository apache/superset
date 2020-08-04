// Copyright (c) 2015 - 2017 Uber Technologies, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

import {fp32} from '@luma.gl/core';
import projectShader from './project.glsl';
import {getUniformsFromViewport} from './viewport-uniforms';

const INITIAL_MODULE_OPTIONS = {};

function getUniforms(opts = INITIAL_MODULE_OPTIONS) {
  if (opts.viewport) {
    return getUniformsFromViewport(opts);
  }
  return {};
}

export default {
  name: 'project',
  dependencies: [fp32],
  vs: projectShader,
  getUniforms,
  deprecations: [
    // Deprecated, remove in v8
    {type: 'function', old: 'project_scale', new: 'project_size'},
    {type: 'function', old: 'project_to_clipspace', new: 'project_common_position_to_clipspace'},
    {type: 'function', old: 'project_pixel_to_clipspace', new: 'project_pixel_size_to_clipspace'}
  ]
};
