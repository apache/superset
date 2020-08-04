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
import React, {createRef} from 'react';
import PropTypes from 'prop-types';
import type {MjolnirEvent} from 'mjolnir.js';

import BaseControl from './base-control';
import {getDynamicPosition, ANCHOR_POSITION} from '../utils/dynamic-position';

import type {BaseControlProps} from './base-control';
import type {PositionType} from '../utils/dynamic-position';

const propTypes = Object.assign({}, BaseControl.propTypes, {
  // Custom className
  className: PropTypes.string,
  // Longitude of the anchor point
  longitude: PropTypes.number.isRequired,
  // Latitude of the anchor point
  latitude: PropTypes.number.isRequired,
  // Altitude of the anchor point
  altitude: PropTypes.number,
  // Offset from the left
  offsetLeft: PropTypes.number,
  // Offset from the top
  offsetTop: PropTypes.number,
  // Size of the tip
  tipSize: PropTypes.number,
  // Whether to show close button
  closeButton: PropTypes.bool,
  // Whether to close on click
  closeOnClick: PropTypes.bool,
  // The popup's location relative to the coordinate
  anchor: PropTypes.oneOf(Object.keys(ANCHOR_POSITION)),
  // Whether the popup anchor should be auto-adjusted to fit within the container
  dynamicPosition: PropTypes.bool,
  // Whether popups should be sorted by depth. Useful when using multiple popups with tilted map.
  sortByDepth: PropTypes.bool,
  // Callback when component is closed
  onClose: PropTypes.func
});

const defaultProps = Object.assign({}, BaseControl.defaultProps, {
  className: '',
  altitude: 0,
  offsetLeft: 0,
  offsetTop: 0,
  tipSize: 10,
  anchor: 'bottom',
  dynamicPosition: true,
  sortByDepth: false,
  closeButton: true,
  closeOnClick: true,
  onClose: () => {}
});

export type PopupProps = BaseControlProps & {
  className: string,
  longitude: number,
  latitude: number,
  altitude: number,
  offsetLeft: number,
  offsetTop: number,
  tipSize: number,
  closeButton: boolean,
  closeOnClick: boolean,
  anchor: PositionType,
  dynamicPosition: boolean,
  sortByDepth: boolean,
  onClose: Function
};

/*
 * PureComponent doesn't update when context changes.
 * The only way is to implement our own shouldComponentUpdate here. Considering
 * the parent component (StaticMap or InteractiveMap) is pure, and map re-render
 * is almost always triggered by a viewport change, we almost definitely need to
 * recalculate the popup's position when the parent re-renders.
 */
export default class Popup extends BaseControl<PopupProps, *, HTMLDivElement> {
  static propTypes = propTypes;
  static defaultProps = defaultProps;

  _closeOnClick: boolean = false;
  _contentRef: {current: null | HTMLDivElement} = createRef();

  componentDidMount() {
    super.componentDidMount();
    // Container just got a size, re-calculate position
    this.forceUpdate();
  }

  _getPosition(x: number, y: number): PositionType {
    const {viewport} = this._context;
    const {anchor, dynamicPosition, tipSize} = this.props;
    const content = this._contentRef.current;

    if (content) {
      return dynamicPosition
        ? getDynamicPosition({
            x,
            y,
            anchor,
            padding: tipSize,
            width: viewport.width,
            height: viewport.height,
            selfWidth: content.clientWidth,
            selfHeight: content.clientHeight
          })
        : anchor;
    }

    return anchor;
  }

  _getContainerStyle(x: number, y: number, z: number, positionType: PositionType) {
    const {viewport} = this._context;
    const {offsetLeft, offsetTop, sortByDepth} = this.props;
    const anchorPosition = ANCHOR_POSITION[positionType];
    const left = x + offsetLeft;
    const top = y + offsetTop;
    const style = {
      position: 'absolute',
      transform: `
        translate(${-anchorPosition.x * 100}%, ${-anchorPosition.y * 100}%)
        translate(${left}px, ${top}px)
      `,
      display: undefined,
      zIndex: undefined
    };

    if (!sortByDepth) {
      return style;
    }
    if (z > 1 || z < -1 || x < 0 || x > viewport.width || y < 0 || y > viewport.height) {
      // clipped
      style.display = 'none';
    } else {
      // use z-index to rearrange components
      style.zIndex = Math.floor(((1 - z) / 2) * 100000);
    }

    return style;
  }

  _onClick = (evt: MjolnirEvent) => {
    if (this.props.captureClick) {
      evt.stopPropagation();
    }

    if (this.props.closeOnClick || evt.target.className === 'mapboxgl-popup-close-button') {
      this.props.onClose();

      const {eventManager} = this._context;
      if (eventManager) {
        // Using with InteractiveMap
        // After we call `onClose` on `anyclick`, this component will be unmounted
        // at which point we unregister the event listeners and stop blocking propagation.
        // Then after a short delay a `click` event will fire
        // Attach a one-time event listener here to prevent it from triggering `onClick` of the base map
        eventManager.once('click', e => e.stopPropagation(), evt.target);
      }
    }
  };

  _renderTip(positionType: PositionType) {
    const {tipSize} = this.props;

    return <div key="tip" className="mapboxgl-popup-tip" style={{borderWidth: tipSize}} />;
  }

  _renderContent() {
    const {closeButton, children} = this.props;
    // If eventManager does not exist (using with static map), listen to React event
    const onClick = this._context.eventManager ? null : this._onClick;

    return (
      <div
        key="content"
        ref={this._contentRef}
        className="mapboxgl-popup-content"
        onClick={onClick}
      >
        {closeButton && (
          <button key="close-button" className="mapboxgl-popup-close-button" type="button">
            ×
          </button>
        )}
        {children}
      </div>
    );
  }

  _render() {
    const {className, longitude, latitude, altitude} = this.props;

    const [x, y, z] = this._context.viewport.project([longitude, latitude, altitude]);

    const positionType = this._getPosition(x, y);
    const containerStyle = this._getContainerStyle(x, y, z, positionType);

    return (
      <div
        className={`mapboxgl-popup mapboxgl-popup-anchor-${positionType} ${className}`}
        style={containerStyle}
        ref={this._containerRef}
      >
        {this._renderTip(positionType)}
        {this._renderContent()}
      </div>
    );
  }
}
