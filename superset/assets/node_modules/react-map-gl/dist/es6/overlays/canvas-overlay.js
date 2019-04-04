import _defineProperty from "@babel/runtime/helpers/esm/defineProperty";
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
import { createElement } from 'react';
import PropTypes from 'prop-types';
import BaseControl from '../components/base-control';
import { window } from '../utils/globals';
const propTypes = Object.assign({}, BaseControl.propTypes, {
  redraw: PropTypes.func.isRequired
});
const defaultProps = {
  captureScroll: false,
  captureDrag: false,
  captureClick: false,
  captureDoubleClick: false
};
export default class CanvasOverlay extends BaseControl {
  constructor(props) {
    super(props);

    _defineProperty(this, "_redraw", () => {
      const ctx = this._ctx;

      if (!ctx) {
        return;
      }

      const pixelRatio = window.devicePixelRatio || 1;
      ctx.save();
      ctx.scale(pixelRatio, pixelRatio);
      const _this$_context = this._context,
            viewport = _this$_context.viewport,
            isDragging = _this$_context.isDragging;
      this.props.redraw({
        width: viewport.width,
        height: viewport.height,
        ctx,
        isDragging,
        project: viewport.project.bind(viewport),
        unproject: viewport.unproject.bind(viewport)
      });
      ctx.restore();
    });
  }

  componentDidMount() {
    this._canvas = this._containerRef.current;
    this._ctx = this._canvas.getContext('2d');

    this._redraw();
  }

  _render() {
    const pixelRatio = window.devicePixelRatio || 1;
    const _this$_context$viewpo = this._context.viewport,
          width = _this$_context$viewpo.width,
          height = _this$_context$viewpo.height;

    this._redraw();

    return createElement('canvas', {
      ref: this._containerRef,
      width: width * pixelRatio,
      height: height * pixelRatio,
      style: {
        width: `${width}px`,
        height: `${height}px`,
        position: 'absolute',
        left: 0,
        top: 0
      }
    });
  }

}
CanvasOverlay.displayName = 'CanvasOverlay';
CanvasOverlay.propTypes = propTypes;
CanvasOverlay.defaultProps = defaultProps;
//# sourceMappingURL=canvas-overlay.js.map