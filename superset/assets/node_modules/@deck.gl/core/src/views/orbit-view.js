import View from './view';
import Viewport from '../viewports/viewport';

// TODO - use math.gl
import {createMat4, transformVector} from '../utils/math-utils';
import mat4_multiply from 'gl-mat4/multiply';
import mat4_lookAt from 'gl-mat4/lookAt';
import mat4_scale from 'gl-mat4/scale';
import mat4_perspective from 'gl-mat4/perspective';
import mat4_translate from 'gl-mat4/translate';
import mat4_rotateX from 'gl-mat4/rotateX';
import mat4_rotateY from 'gl-mat4/rotateY';
import mat4_rotateZ from 'gl-mat4/rotateZ';

const DEGREES_TO_RADIANS = Math.PI / 180;

// TODO - remove need for custom project overrides
class OrbitViewport extends Viewport {
  project(xyz, {topLeft = false} = {}) {
    const v = transformVector(this.pixelProjectionMatrix, [...xyz, 1]);
    const [x, y, z] = v;
    const y2 = topLeft ? this.height - y : y;
    return [x, y2, z];
  }

  unproject(xyz, {topLeft = false} = {}) {
    const [x, y, z] = xyz;
    const y2 = topLeft ? this.height - y : y;
    return transformVector(this.pixelUnprojectionMatrix, [x, y2, z, 1]);
  }
}

export default class OrbitView extends View {
  // Get camera `distance` to make view fit a box centered at lookat position in the viewport.
  // @param {Array} boundingBox - [sizeX, sizeY, sizeZ]], defines the dimensions of bounding box
  static getDistance({boundingBox, fov}) {
    const halfMaxSide = Math.max(boundingBox[0], boundingBox[1], boundingBox[2]) / 2;
    const distance = halfMaxSide / Math.tan(fov / 180 * Math.PI / 2);
    return distance;
  }

  /* eslint-disable complexity, max-statements */
  _getViewport(props) {
    const {viewState} = props;
    const width = props.width || 1;
    const height = props.height || 1;

    // Get view matrix parameters from view state
    // Projection matrix arguments
    // TODO - Extracting from viewState is deprecated
    const fovy = props.fov || props.fovy || viewState.fovy || 75; // Field of view covered by camera
    const near = props.near || viewState.near || 1; // Distance of near clipping plane
    const far = props.far || viewState.far || 100; // Distance of far clipping plane
    const aspect = Number.isFinite(viewState.aspect) ? viewState.aspect : width / height;

    const fovyRadians = fovy * DEGREES_TO_RADIANS;

    return new OrbitViewport({
      id: this.id,
      viewMatrix: this._getViewMatrix(props.viewState),
      projectionMatrix: mat4_perspective([], fovyRadians, aspect, near, far),
      x: props.x,
      y: props.y,
      width,
      height
    });
  }
  /* eslint-enable complexity, max-statements */

  _getViewMatrix(viewState) {
    const {
      distance, // From eye position to lookAt
      rotationX = 0, // Rotating angle around X axis
      rotationOrbit = 0, // Rotating angle around orbit axis
      orbitAxis = 'Z', // Orbit axis with 360 degrees rotating freedom, can only be 'Y' or 'Z'

      lookAt = [0, 0, 0], // Which point is camera looking at, default origin
      up = [0, 1, 0], // Defines up direction, default positive y axis
      zoom = 1
    } = viewState;

    const rotationMatrix = mat4_rotateX([], createMat4(), -rotationX / 180 * Math.PI);
    if (orbitAxis === 'Z') {
      mat4_rotateZ(rotationMatrix, rotationMatrix, -rotationOrbit / 180 * Math.PI);
    } else {
      mat4_rotateY(rotationMatrix, rotationMatrix, -rotationOrbit / 180 * Math.PI);
    }

    const translateMatrix = createMat4();
    mat4_scale(translateMatrix, translateMatrix, [zoom, zoom, zoom]);
    mat4_translate(translateMatrix, translateMatrix, [-lookAt[0], -lookAt[1], -lookAt[2]]);

    const viewMatrix = mat4_lookAt([], [0, 0, distance], [0, 0, 0], up);
    mat4_multiply(
      viewMatrix,
      viewMatrix,
      mat4_multiply(rotationMatrix, rotationMatrix, translateMatrix)
    );

    return viewMatrix;
  }

  /** Move camera to make a model bounding box centered at lookat position fit in the viewport.
   * @param {Array} boundingBox - [sizeX, sizeY, sizeZ]], define the dimensions of bounding box
   * @returns a new OrbitViewport object
   */
  fitBounds(boundingBox, viewState) {
    const {width, height, fov, near, far} = this;

    return this._getViewport({
      width,
      height,
      fov,
      near,
      far
    });
  }
}

OrbitView.displayName = 'OrbitView';
