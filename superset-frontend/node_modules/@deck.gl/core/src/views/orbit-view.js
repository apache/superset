import View from './view';
import Viewport from '../viewports/viewport';

import {Matrix4} from 'math.gl';
import OrbitController from '../controllers/orbit-controller';

const DEGREES_TO_RADIANS = Math.PI / 180;

function getViewMatrix({height, fovy, orbitAxis, rotationX, rotationOrbit, zoom}) {
  // We position the camera so that one common space unit (world space unit scaled by zoom)
  // at the target maps to one screen pixel.
  // This is a similar technique to that used in web mercator projection
  // By doing so we are able to convert between common space and screen space sizes efficiently
  // in the vertex shader.
  const distance = 0.5 / Math.tan((fovy * DEGREES_TO_RADIANS) / 2);

  const viewMatrix = new Matrix4().lookAt({eye: [0, 0, distance]});

  viewMatrix.rotateX(rotationX * DEGREES_TO_RADIANS);
  if (orbitAxis === 'Z') {
    viewMatrix.rotateZ(rotationOrbit * DEGREES_TO_RADIANS);
  } else {
    viewMatrix.rotateY(rotationOrbit * DEGREES_TO_RADIANS);
  }

  // When height increases, we need to increase the distance from the camera to the target to
  // keep the 1:1 mapping. However, this also changes the projected depth of each position by
  // moving them further away between the near/far plane.
  // Without modifying the default near/far planes, we instead scale down the common space to
  // remove the distortion to the depth field.
  const projectionScale = 1 / (height || 1);
  viewMatrix.scale([projectionScale, projectionScale, projectionScale]);

  return viewMatrix;
}

class OrbitViewport extends Viewport {
  constructor(props) {
    const {
      id,
      x,
      y,
      width,
      height,

      fovy = 50, // From eye position to lookAt
      near,
      far,
      orbitAxis = 'Z', // Orbit axis with 360 degrees rotating freedom, can only be 'Y' or 'Z'
      target = [0, 0, 0], // Which point is camera looking at, default origin

      rotationX = 0, // Rotating angle around X axis
      rotationOrbit = 0, // Rotating angle around orbit axis

      zoom = 0
    } = props;

    super({
      id,
      viewMatrix: getViewMatrix({
        height,
        fovy,
        orbitAxis,
        rotationX,
        rotationOrbit,
        zoom
      }),
      fovy,
      near,
      far,
      x,
      y,
      position: target,
      width,
      height,
      zoom
    });
  }
}

export default class OrbitView extends View {
  constructor(props) {
    super(
      Object.assign({}, props, {
        type: OrbitViewport
      })
    );
  }

  get controller() {
    return this._getControllerProps({
      type: OrbitController,
      ViewportType: OrbitViewport
    });
  }
}

OrbitView.displayName = 'OrbitView';
