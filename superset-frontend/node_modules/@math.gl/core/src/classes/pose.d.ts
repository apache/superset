// Copyright (c) 2017 Uber Technologies, Inc.
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
import Matrix4 from './matrix4';
import Vector3 from './vector3';
import Euler from './euler';

type PoseOptions = {
  position?: number[];
  orientation?: number[];
  x?: number;
  y?: number;
  z?: number;
  roll?: number;
  pitch?: number;
  yaw?: number;
};

export default class Pose {
  /**
   * A pose contains both rotation and rotations.
   * Note that every single pose defines its own coordinate system
   * (with the position of the pose in the origin, and zero rotations).
   * These "pose relative" coordinate will be centered on the defining
   * pose's position and with with the defining pose's orientation
   * aligned with axis.
   * @param {Object} options
   * @param {Number[]} [options.position]
   * @param {Number[]} [options.orientation]
   * @param {Number} [options.x]
   * @param {Number} [options.y]
   * @param {Number} [options.z]
   * @param {Number} [options.roll]
   * @param {Number} [options.pitch]
   * @param {Number} [options.yaw]
   */
  constructor(options?: PoseOptions);

  x: number;
  y: number;
  z: number;
  roll: number;
  pitch: number;
  yaw: number;

  getPosition(): Vector3;
  getOrientation(): Euler;

  equals(pose: Pose): boolean;
  exactEquals(pose: Pose): boolean;

  /**
   * Returns a 4x4 matrix that transforms a coordinates (in the same
   * coordinate system as this pose) into the "pose-relative" coordinate
   * system defined by this pose.
   * The pose relative coordinates with have origin in the position of this
   * pose, and axis will be aligned with the rotation of this pose.
   */
  getTransformationMatrix(): Matrix4;

  /**
   * Given a second pose that represent the same object in a second coordinate
   * system, this method returns a 4x4 matrix that transforms coordinates in the
   * second coordinate system into the coordinate system of this pose.
   */
  getTransformationMatrixFromPose(pose: Pose): Matrix4;

  /**
   * Given a second pose that represent the same object in a second coordinate
   * system, this method returns a 4x4 matrix that transforms coordinates in the
   * coordinate system of this pose into the coordinate system of the second pose.
   *
   * Note: This method returns the inverse of `this.getTransformationMatrixFromPose(pose)`
   */
  getTransformationMatrixToPose(pose: Pose): Matrix4;
}
