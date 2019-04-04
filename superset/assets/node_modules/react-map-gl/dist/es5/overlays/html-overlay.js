"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _classCallCheck2 = _interopRequireDefault(require("@babel/runtime/helpers/classCallCheck"));

var _createClass2 = _interopRequireDefault(require("@babel/runtime/helpers/createClass"));

var _possibleConstructorReturn2 = _interopRequireDefault(require("@babel/runtime/helpers/possibleConstructorReturn"));

var _getPrototypeOf2 = _interopRequireDefault(require("@babel/runtime/helpers/getPrototypeOf"));

var _inherits2 = _interopRequireDefault(require("@babel/runtime/helpers/inherits"));

var _react = require("react");

var _propTypes = _interopRequireDefault(require("prop-types"));

var _baseControl = _interopRequireDefault(require("../components/base-control"));

// Copyright (c) 2015 Uber Technologies, Inc.
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.
var propTypes = Object.assign({}, _baseControl.default.propTypes, {
  redraw: _propTypes.default.func.isRequired,
  style: _propTypes.default.object
});
var defaultProps = {
  captureScroll: false,
  captureDrag: false,
  captureClick: false,
  captureDoubleClick: false
};

var HTMLOverlay =
/*#__PURE__*/
function (_BaseControl) {
  (0, _inherits2.default)(HTMLOverlay, _BaseControl);

  function HTMLOverlay() {
    (0, _classCallCheck2.default)(this, HTMLOverlay);
    return (0, _possibleConstructorReturn2.default)(this, (0, _getPrototypeOf2.default)(HTMLOverlay).apply(this, arguments));
  }

  (0, _createClass2.default)(HTMLOverlay, [{
    key: "_render",
    value: function _render() {
      var _this$_context = this._context,
          viewport = _this$_context.viewport,
          isDragging = _this$_context.isDragging;
      var style = Object.assign({
        position: 'absolute',
        left: 0,
        top: 0,
        width: viewport.width,
        height: viewport.height
      }, this.props.style);
      return (0, _react.createElement)('div', {
        ref: this._containerRef,
        style: style
      }, this.props.redraw({
        width: viewport.width,
        height: viewport.height,
        isDragging: isDragging,
        project: viewport.project.bind(viewport),
        unproject: viewport.unproject.bind(viewport)
      }));
    }
  }]);
  return HTMLOverlay;
}(_baseControl.default);

exports.default = HTMLOverlay;
HTMLOverlay.displayName = 'HTMLOverlay';
HTMLOverlay.propTypes = propTypes;
HTMLOverlay.defaultProps = defaultProps;
//# sourceMappingURL=html-overlay.js.map