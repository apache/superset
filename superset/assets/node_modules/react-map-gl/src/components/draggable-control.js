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
import PropTypes from 'prop-types';
import BaseControl from './base-control';

import type {MjolnirEvent} from 'mjolnir.js';

const propTypes = Object.assign({}, BaseControl.propTypes, {
  draggable: PropTypes.bool,
  onDrag: PropTypes.func,
  onDragEnd: PropTypes.func,
  onDragStart: PropTypes.func,
  // Offset from the left
  offsetLeft: PropTypes.number,
  // Offset from the top
  offsetTop: PropTypes.number
});

const defaultProps = Object.assign({}, BaseControl.defaultProps, {
  draggable: false
});

export type Coordinate = [number, number];
export type Offset = [number, number];

export default class DraggableControl extends BaseControl {

  static propTypes = propTypes;
  static defaultProps = defaultProps;

  constructor(props) {
    super(props);
    this.state = {
      dragPos: null,
      dragOffset: null
    };
  }

  componentWillUnmount() {
    super.componentWillUnmount();
    this._removeDragEvents();
  }

  _setupDragEvents() {
    const {eventManager} = this._context;
    if (!eventManager) {
      return;
    }

    // panstart is already attached by parent class BaseControl,
    // here we just add listeners for subsequent drag events
    this._dragEvents = {
      panmove: this._onDrag,
      panend: this._onDragEnd,
      pancancel: this._onDragCancel
    };
    eventManager.on(this._dragEvents);
  }

  _removeDragEvents() {
    const {eventManager} = this._context;
    if (!eventManager || !this._dragEvents) {
      return;
    }
    eventManager.off(this._dragEvents);
    this._dragEvents = null;
  }

  _getDragEventPosition(event: MjolnirEvent): Coordinate {
    const {offsetCenter: {x, y}} = event;
    return [x, y];
  }

  /**
   * Returns offset of top-left of marker from drag start event
   * (used for positioning marker relative to next mouse coordinates)
   */
  _getDragEventOffset(event: MjolnirEvent): Offset {
    const {center: {x, y}} = event;
    const rect = this._containerRef.current.getBoundingClientRect();
    return [rect.left - x, rect.top - y];
  }

  _getDraggedPosition(dragPos: Coordinate, dragOffset: Offset): Coordinate {
    return [
      dragPos[0] + dragOffset[0],
      dragPos[1] + dragOffset[1]
    ];
  }

  _getDragLngLat(dragPos: Coordinate, dragOffset: Offset): Coordinate {
    const {offsetLeft, offsetTop} = this.props;
    const [x, y] = this._getDraggedPosition(dragPos, dragOffset);
    // Unproject x/y value while respecting offset coordinates
    return this._context.viewport.unproject([x - offsetLeft, y - offsetTop]);
  }

  _onDragStart = (event: MjolnirEvent) => {
    const {draggable, captureDrag} = this.props;
    if (draggable || captureDrag) {
      event.stopPropagation();
    }
    if (!draggable) {
      return;
    }

    const dragPos = this._getDragEventPosition(event);
    const dragOffset = this._getDragEventOffset(event);
    this.setState({dragPos, dragOffset});
    this._setupDragEvents();

    if (this.props.onDragStart) {
      event.lngLat = this._getDragLngLat(dragPos, dragOffset);
      this.props.onDragStart(event);
    }
  }

  _onDrag = (event: MjolnirEvent) => {
    event.stopPropagation();

    const dragPos = this._getDragEventPosition(event);
    this.setState({dragPos});

    if (this.props.onDrag) {
      event.lngLat = this._getDragLngLat(dragPos, this.state.dragOffset);
      this.props.onDrag(event);
    }
  }

  _onDragEnd = (event: MjolnirEvent) => {
    const {dragPos, dragOffset} = this.state;

    event.stopPropagation();
    this.setState({dragPos: null, dragOffset: null});
    this._removeDragEvents();

    if (this.props.onDragEnd) {
      event.lngLat = this._getDragLngLat(dragPos, dragOffset);
      this.props.onDragEnd(event);
    }
  }

  _onDragCancel = (event: MjolnirEvent) => {
    event.stopPropagation();
    this.setState({dragPos: null, dragOffset: null});
    this._removeDragEvents();
  }
}
