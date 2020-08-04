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

// Adaptation of THREE.js Spherical class, under MIT license
import {formatValue, equals, config} from '../lib/common';
import {degrees, radians, clamp} from '../lib/common';
import Vector3 from './vector3';

// @ts-ignore: error TS2307: Cannot find module 'gl-matrix/...'.
import * as vec3 from 'gl-matrix/vec3';

// TODO - import epsilon
const EPSILON = 0.000001;

const EARTH_RADIUS_METERS = 6.371e6;

// Todo [rho, theta, phi] ?
export default class SphericalCoordinates {
  // @ts-ignore TS2740: Type '{}' is missing the following properties from type
  // eslint-disable-next-line complexity
  constructor({
    phi = 0,
    theta = 0,
    radius = 1,
    bearing = undefined,
    pitch = undefined,
    altitude = undefined,
    radiusScale = EARTH_RADIUS_METERS
  } = {}) {
    this.phi = phi;
    this.theta = theta;
    // TODO - silently accepts illegal 0
    this.radius = radius || altitude || 1; // radial distance from center
    this.radiusScale = radiusScale || 1; // Used by lngLatZ

    if (bearing !== undefined) {
      this.bearing = bearing; // up / down towards top and bottom pole
    }
    if (pitch !== undefined) {
      this.pitch = pitch; // around the equator of the sphere
    }
    this.check();
  }

  toString() {
    return this.formatString(config);
  }

  formatString({printTypes = false}) {
    const f = formatValue;
    return `${printTypes ? 'Spherical' : ''}\
[rho:${f(this.radius)},theta:${f(this.theta)},phi:${f(this.phi)}]`;
  }

  equals(other) {
    return (
      equals(this.radius, other.radius) &&
      equals(this.theta, other.theta) &&
      equals(this.phi, other.phi)
    );
  }

  exactEquals(other) {
    return this.radius === other.radius && this.theta === other.theta && this.phi === other.phi;
  }

  /* eslint-disable brace-style */
  // Cartographic (bearing 0 north, pitch 0 look from above)
  get bearing() {
    return 180 - degrees(this.phi);
  }
  set bearing(v) {
    this.phi = Math.PI - radians(v);
  }
  get pitch() {
    return degrees(this.theta);
  }
  set pitch(v) {
    this.theta = radians(v);
  }
  // get pitch() { return 90 - degrees(this.phi); }
  // set pitch(v) { this.phi = radians(v) + Math.PI / 2; }
  // get altitude() { return this.radius - 1; } // relative altitude

  // lnglatZ coordinates
  get longitude() {
    return degrees(this.phi);
  }
  get latitude() {
    return degrees(this.theta);
  }
  get lng() {
    return degrees(this.phi);
  }
  get lat() {
    return degrees(this.theta);
  }
  get z() {
    return (this.radius - 1) * this.radiusScale;
  }
  /* eslint-enable brace-style */

  set(radius, phi, theta) {
    this.radius = radius;
    this.phi = phi;
    this.theta = theta;
    return this.check();
  }

  clone() {
    return new SphericalCoordinates().copy(this);
  }

  copy(other) {
    this.radius = other.radius;
    this.phi = other.phi;
    this.theta = other.theta;
    return this.check();
  }

  fromLngLatZ([lng, lat, z]) {
    this.radius = 1 + z / this.radiusScale;
    this.phi = radians(lat);
    this.theta = radians(lng);
  }

  fromVector3(v) {
    this.radius = vec3.length(v);
    if (this.radius > 0) {
      this.theta = Math.atan2(v[0], v[1]); // equator angle around y-up axis
      this.phi = Math.acos(clamp(v[2] / this.radius, -1, 1)); // polar angle
    }
    return this.check();
  }

  toVector3() {
    return new Vector3(0, 0, this.radius)
      .rotateX({radians: this.theta})
      .rotateZ({radians: this.phi});
  }

  // restrict phi to be betwee EPS and PI-EPS
  makeSafe() {
    this.phi = Math.max(EPSILON, Math.min(Math.PI - EPSILON, this.phi));
    return this;
  }

  check() {
    // this.makeSafe();
    if (!Number.isFinite(this.phi) || !Number.isFinite(this.theta) || !(this.radius > 0)) {
      throw new Error('SphericalCoordinates: some fields set to invalid numbers');
    }
    return this;
  }
}
