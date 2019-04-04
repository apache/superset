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
import {createElement} from 'react';
import PropTypes from 'prop-types';
import DraggableControl from './draggable-control';

const propTypes = Object.assign({}, DraggableControl.propTypes, {
  // Custom className
  className: PropTypes.string,
  // Longitude of the anchor point
  longitude: PropTypes.number.isRequired,
  // Latitude of the anchor point
  latitude: PropTypes.number.isRequired
});

const defaultProps = Object.assign({}, DraggableControl.defaultProps, {
  className: '',
  offsetLeft: 0,
  offsetTop: 0
});

/*
 * PureComponent doesn't update when context changes.
 * The only way is to implement our own shouldComponentUpdate here. Considering
 * the parent component (StaticMap or InteractiveMap) is pure, and map re-render
 * is almost always triggered by a viewport change, we almost definitely need to
 * recalculate the marker's position when the parent re-renders.
 */
export default class Marker extends DraggableControl {

  static propTypes = propTypes;
  static defaultProps = defaultProps;

  _getPosition(): [number, number] {
    const {longitude, latitude, offsetLeft, offsetTop} = this.props;
    const {dragPos, dragOffset} = this.state;

    // If dragging, just return the current drag position
    if (dragPos) {
      return this._getDraggedPosition(dragPos, dragOffset);
    }

    // Otherwise return the projected lat/lng with offset
    let [x, y] = this._context.viewport.project([longitude, latitude]);
    x += offsetLeft;
    y += offsetTop;
    return [x, y];
  }

  _render() {
    const {className, draggable} = this.props;
    const {dragPos} = this.state;

    const [x, y] = this._getPosition();

    const containerStyle = {
      position: 'absolute',
      left: x,
      top: y,
      cursor: draggable ? (dragPos ? 'grabbing' : 'grab') : 'auto'
    };

    return createElement('div', {
      className: `mapboxgl-marker ${className}`,
      ref: this._containerRef,
      style: containerStyle,
      children: this.props.children
    });
  }

}
