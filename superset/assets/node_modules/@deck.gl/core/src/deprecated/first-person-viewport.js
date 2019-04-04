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

import Viewport from '../viewports/viewport';
import log from '../utils/log';
import {Matrix4, experimental} from 'math.gl';
const {SphericalCoordinates} = experimental;

function getDirectionFromBearingAndPitch({bearing, pitch}) {
  const spherical = new SphericalCoordinates({bearing, pitch});
  const direction = spherical.toVector3().normalize();
  return direction;
}

export default class FirstPersonViewport extends Viewport {
  constructor(opts = {}) {
    log.deprecated('FirstPersonViewport', 'FirstPersonView')();

    // TODO - push direction handling into Matrix4.lookAt
    const {
      // view matrix arguments
      modelMatrix = null,
      bearing,
      up = [0, 0, 1] // Defines up direction, default positive z axis,
    } = opts;

    // Always calculate direction from bearing and pitch
    const dir = getDirectionFromBearingAndPitch({
      bearing,
      pitch: 89
    });

    // Direction is relative to model coordinates, of course
    const center = modelMatrix ? modelMatrix.transformDirection(dir) : dir;

    // Just the direction. All the positioning is done in viewport.js
    const viewMatrix = new Matrix4().lookAt({eye: [0, 0, 0], center, up});

    super(
      Object.assign({}, opts, {
        zoom: null, // triggers meter level zoom
        viewMatrix
      })
    );
  }
}
