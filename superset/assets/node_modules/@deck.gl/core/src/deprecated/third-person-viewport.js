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
import {Vector3, Matrix4, experimental} from 'math.gl';
const {SphericalCoordinates} = experimental;

function getDirectionFromBearingAndPitch({bearing, pitch}) {
  const spherical = new SphericalCoordinates({bearing, pitch});
  return spherical.toVector3().normalize();
}

export default class ThirdPersonViewport extends Viewport {
  constructor(opts) {
    log.deprecated('ThirdPersonViewport', 'ThirdPersonView')();

    const {bearing, pitch, position, up, zoom} = opts;

    const direction = getDirectionFromBearingAndPitch({
      bearing,
      pitch
    });

    const distance = zoom * 50;

    // TODO somehow need to flip z to make it work
    // check if the position offset is done in the base viewport
    const eye = direction.scale(-distance).multiply(new Vector3(1, 1, -1));

    const viewMatrix = new Matrix4().multiplyRight(
      new Matrix4().lookAt({eye, center: position, up})
    );

    super(
      Object.assign({}, opts, {
        // use meter level
        zoom: null,
        viewMatrix
      })
    );
  }
}
