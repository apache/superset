/* global window */
import {clear, isWebGL} from '../webgl';
import {log} from '../utils';
import Group from './group';
import assert from '../utils/assert';

const ILLEGAL_ARG = 'Illegal argument to pick';

function getDevicePixelRatio() {
  return typeof window !== 'undefined' ? window.devicePixelRatio : 1;
}

export default function pickModels(gl, {
  models,
  position,
  uniforms = {}, // eslint-disable-line
  parameters = {},
  settings,
  useDevicePixelRatio = null, // deprecated
  useDevicePixels = true,
  framebuffer
}) {
  assert(isWebGL(gl), ILLEGAL_ARG);
  assert(framebuffer, ILLEGAL_ARG);
  assert(position, ILLEGAL_ARG);
  if (useDevicePixelRatio !== null) {
    log.deprecated('useDevicePixelRatio', 'useDevicePixels')();
    useDevicePixels = useDevicePixelRatio;
  }

  const [x, y] = position;

  // Match our picking framebuffer with the size of the canvas drawing buffer
  framebuffer.resize({width: gl.canvas.width, height: gl.canvas.height});

  // Compensate for devicePixelRatio
  // Note: this assumes the canvas framebuffer has been matched
  const dpr = useDevicePixels ? getDevicePixelRatio() : 1;
  // Reverse the y coordinate
  const deviceX = x * dpr;
  const deviceY = gl.canvas.height - y * dpr;

  // return withParameters(gl, {
  //   // framebuffer,
  //   // // We are only interested in one pixel, no need to render anything else
  //   // scissorTest: {x: deviceX, y: deviceY, w: 1, h: 1}
  // }, () => {
  const group = new Group({children: models});
  return group.traverseReverse(model => {

    if (model.isPickable()) {
      // Clear the frame buffer
      clear(gl, {framebuffer, color: true, depth: true});

      // Render picking colors
      /* eslint-disable camelcase */
      model.setUniforms({picking_uActive: 1});
      model.draw({uniforms, parameters, settings, framebuffer});
      model.setUniforms({picking_uActive: 0});

      // Sample Read color in the central pixel, to be mapped as a picking color
      const color = framebuffer.readPixels({
        x: deviceX,
        y: deviceY,
        width: 1,
        height: 1,
        format: gl.RGBA,
        type: gl.UNSIGNED_BYTE});

      const isPicked = color[0] !== 0 || color[1] !== 0 || color[2] !== 0;

      // Add the information to the stack
      if (isPicked) {
        return {
          model,
          color,
          x,
          y,
          deviceX,
          deviceY
        };
      }
    }

    return null;
  });
  // });
}
