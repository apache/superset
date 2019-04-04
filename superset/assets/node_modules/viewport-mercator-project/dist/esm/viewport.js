import _slicedToArray from "@babel/runtime/helpers/esm/slicedToArray";
import _classCallCheck from "@babel/runtime/helpers/esm/classCallCheck";
import _createClass from "@babel/runtime/helpers/esm/createClass";
import { createMat4 } from './math-utils';
import { worldToPixels, pixelsToWorld } from './web-mercator-utils';
import * as mat4 from 'gl-matrix/mat4';
var IDENTITY = createMat4();

var Viewport = function () {
  function Viewport() {
    var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
        width = _ref.width,
        height = _ref.height,
        _ref$viewMatrix = _ref.viewMatrix,
        viewMatrix = _ref$viewMatrix === void 0 ? IDENTITY : _ref$viewMatrix,
        _ref$projectionMatrix = _ref.projectionMatrix,
        projectionMatrix = _ref$projectionMatrix === void 0 ? IDENTITY : _ref$projectionMatrix;

    _classCallCheck(this, Viewport);

    this.width = width || 1;
    this.height = height || 1;
    this.scale = 1;
    this.pixelsPerMeter = 1;
    this.viewMatrix = viewMatrix;
    this.projectionMatrix = projectionMatrix;
    var vpm = createMat4();
    mat4.multiply(vpm, vpm, this.projectionMatrix);
    mat4.multiply(vpm, vpm, this.viewMatrix);
    this.viewProjectionMatrix = vpm;
    var m = createMat4();
    mat4.scale(m, m, [this.width / 2, -this.height / 2, 1]);
    mat4.translate(m, m, [1, -1, 0]);
    mat4.multiply(m, m, this.viewProjectionMatrix);
    var mInverse = mat4.invert(createMat4(), m);

    if (!mInverse) {
      throw new Error('Pixel project matrix not invertible');
    }

    this.pixelProjectionMatrix = m;
    this.pixelUnprojectionMatrix = mInverse;
    this.equals = this.equals.bind(this);
    this.project = this.project.bind(this);
    this.unproject = this.unproject.bind(this);
    this.projectPosition = this.projectPosition.bind(this);
    this.unprojectPosition = this.unprojectPosition.bind(this);
    this.projectFlat = this.projectFlat.bind(this);
    this.unprojectFlat = this.unprojectFlat.bind(this);
  }

  _createClass(Viewport, [{
    key: "equals",
    value: function equals(viewport) {
      if (!(viewport instanceof Viewport)) {
        return false;
      }

      return viewport.width === this.width && viewport.height === this.height && mat4.equals(viewport.projectionMatrix, this.projectionMatrix) && mat4.equals(viewport.viewMatrix, this.viewMatrix);
    }
  }, {
    key: "project",
    value: function project(xyz) {
      var _ref2 = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
          _ref2$topLeft = _ref2.topLeft,
          topLeft = _ref2$topLeft === void 0 ? true : _ref2$topLeft;

      var worldPosition = this.projectPosition(xyz);
      var coord = worldToPixels(worldPosition, this.pixelProjectionMatrix);

      var _coord = _slicedToArray(coord, 2),
          x = _coord[0],
          y = _coord[1];

      var y2 = topLeft ? y : this.height - y;
      return xyz.length === 2 ? [x, y2] : [x, y2, coord[2]];
    }
  }, {
    key: "unproject",
    value: function unproject(xyz) {
      var _ref3 = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
          _ref3$topLeft = _ref3.topLeft,
          topLeft = _ref3$topLeft === void 0 ? true : _ref3$topLeft,
          targetZ = _ref3.targetZ;

      var _xyz = _slicedToArray(xyz, 3),
          x = _xyz[0],
          y = _xyz[1],
          z = _xyz[2];

      var y2 = topLeft ? y : this.height - y;
      var targetZWorld = targetZ && targetZ * this.pixelsPerMeter;
      var coord = pixelsToWorld([x, y2, z], this.pixelUnprojectionMatrix, targetZWorld);

      var _this$unprojectPositi = this.unprojectPosition(coord),
          _this$unprojectPositi2 = _slicedToArray(_this$unprojectPositi, 3),
          X = _this$unprojectPositi2[0],
          Y = _this$unprojectPositi2[1],
          Z = _this$unprojectPositi2[2];

      if (Number.isFinite(z)) {
        return [X, Y, Z];
      }

      return Number.isFinite(targetZ) ? [X, Y, targetZ] : [X, Y];
    }
  }, {
    key: "projectPosition",
    value: function projectPosition(xyz) {
      var _this$projectFlat = this.projectFlat(xyz),
          _this$projectFlat2 = _slicedToArray(_this$projectFlat, 2),
          X = _this$projectFlat2[0],
          Y = _this$projectFlat2[1];

      var Z = (xyz[2] || 0) * this.pixelsPerMeter;
      return [X, Y, Z];
    }
  }, {
    key: "unprojectPosition",
    value: function unprojectPosition(xyz) {
      var _this$unprojectFlat = this.unprojectFlat(xyz),
          _this$unprojectFlat2 = _slicedToArray(_this$unprojectFlat, 2),
          X = _this$unprojectFlat2[0],
          Y = _this$unprojectFlat2[1];

      var Z = (xyz[2] || 0) / this.pixelsPerMeter;
      return [X, Y, Z];
    }
  }, {
    key: "projectFlat",
    value: function projectFlat(xyz) {
      var scale = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : this.scale;
      return xyz;
    }
  }, {
    key: "unprojectFlat",
    value: function unprojectFlat(xyz) {
      var scale = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : this.scale;
      return xyz;
    }
  }]);

  return Viewport;
}();

export { Viewport as default };
//# sourceMappingURL=viewport.js.map