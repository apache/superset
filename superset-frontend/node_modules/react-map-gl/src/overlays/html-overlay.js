// @flow

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

import React from 'react';
import PropTypes from 'prop-types';
import BaseControl from '../components/base-control';

import type {BaseControlProps} from '../components/base-control';

const propTypes = Object.assign({}, BaseControl.propTypes, {
  redraw: PropTypes.func.isRequired,
  style: PropTypes.object
});

const defaultProps = {
  captureScroll: false,
  captureDrag: false,
  captureClick: false,
  captureDoubleClick: false
};

export type HTMLOverlayProps = BaseControlProps & {
  redraw: Function,
  style?: Object
};

export default class HTMLOverlay extends BaseControl<HTMLOverlayProps, *, HTMLDivElement> {
  static propTypes = propTypes;
  static defaultProps = defaultProps;

  _render() {
    const {viewport, isDragging} = this._context;
    const style = Object.assign(
      {
        position: 'absolute',
        left: 0,
        top: 0,
        width: viewport.width,
        height: viewport.height
      },
      this.props.style
    );

    return (
      <div ref={this._containerRef} style={style}>
        {this.props.redraw({
          width: viewport.width,
          height: viewport.height,
          isDragging,
          project: viewport.project.bind(viewport),
          unproject: viewport.unproject.bind(viewport)
        })}
      </div>
    );
  }
}
