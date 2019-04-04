import Viewport from '../viewports/viewport';
// import log from '../utils/log';

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

/*
 * A deck.gl Viewport class used by OrbitController
 * Adds zoom and pixel translation on top of the PerspectiveViewport
 */
export default class OrbitViewport extends Viewport {
  constructor({
    id = 'orbit-viewport',
    // viewport arguments
    width, // Width of viewport
    height, // Height of viewport
    // view matrix arguments
    distance, // From eye position to lookAt
    rotationX = 0, // Rotating angle around X axis
    rotationOrbit = 0, // Rotating angle around orbit axis
    orbitAxis = 'Z', // Orbit axis with 360 degrees rotating freedom, can only be 'Y' or 'Z'
    lookAt = [0, 0, 0], // Which point is camera looking at, default origin
    up = [0, 1, 0], // Defines up direction, default positive y axis
    // projection matrix arguments
    fov = 75, // Field of view covered by camera
    near = 1, // Distance of near clipping plane
    far = 100, // Distance of far clipping plane
    zoom = 1
  }) {
    // TODO - Once OrbitViewport is aligned with the View system, deprecated it
    // log.deprecated('OrbitViewport', 'OrbitView')();

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
    const fovRadians = fov * DEGREES_TO_RADIANS;
    const aspect = width / height;
    const perspectiveMatrix = mat4_perspective([], fovRadians, aspect, near, far);

    super({
      id,
      viewMatrix: mat4_multiply(
        viewMatrix,
        viewMatrix,
        mat4_multiply(rotationMatrix, rotationMatrix, translateMatrix)
      ),
      projectionMatrix: perspectiveMatrix,
      width,
      height
    });

    this.width = width;
    this.height = height;
    this.distance = distance;
    this.rotationX = rotationX;
    this.rotationOrbit = rotationOrbit;
    this.orbitAxis = orbitAxis;
    this.lookAt = lookAt;
    this.up = up;
    this.fov = fov;
    this.near = near;
    this.far = far;
    this.zoom = zoom;
  }

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

  /** Get camera `distance` to make view fit a box centered at lookat position in the viewport.
   * @param {Array} sizes - [sizeX, sizeY, sizeZ]], define the dimensions of bounding box
   * @returns {Nunber} the new distance parameter
   */
  getDistance({boundingBox, fov}) {
    const halfMaxSide = Math.max(boundingBox[0], boundingBox[1], boundingBox[2]) / 2;
    const distance = halfMaxSide / Math.tan(fov / 180 * Math.PI / 2);
    return distance;
  }

  /** Move camera to make a model bounding box centered at lookat position fit in the viewport.
   * @param {Array} boundingBox - [sizeX, sizeY, sizeZ]], define the dimensions of bounding box
   * @returns a new OrbitViewport object
   */
  fitBounds(boundingBox) {
    const {
      width,
      height,
      rotationX,
      rotationOrbit,
      orbitAxis,
      lookAt,
      up,
      fov,
      near,
      far,
      zoom
    } = this;

    return new OrbitViewport({
      width,
      height,
      rotationX,
      rotationOrbit,
      orbitAxis,
      up,
      fov,
      near,
      far,
      zoom,
      lookAt,
      distance: this.getDistance({boundingBox, fov})
    });
  }
}

OrbitViewport.displayName = 'OrbitViewport';
