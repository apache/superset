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

import {document} from '../utils/globals';
import PropTypes from 'prop-types';
import BaseControl from './base-control';
import React from 'react';
import mapboxgl from '../utils/mapboxgl';

import type {BaseControlProps} from './base-control';

const propTypes = Object.assign({}, BaseControl.propTypes, {
  // Custom className
  className: PropTypes.string,
  /* eslint-disable max-len */
  // `container` is the [compatible DOM element](https://developer.mozilla.org/en-US/docs/Web/API/Element/requestFullScreen#Compatible_elements)
  // which should be made full screen. By default, the map container element will be made full screen.
  /* eslint-enable max-len */
  container: PropTypes.object
});

const defaultProps = Object.assign({}, BaseControl.defaultProps, {
  className: '',
  container: null
});

export type FullscreenControlProps = BaseControlProps & {
  className: string,
  container: ?HTMLElement
};

type State = {
  isFullscreen: boolean,
  showButton: boolean
};

export default class FullscreenControl extends BaseControl<
  FullscreenControlProps,
  State,
  HTMLDivElement
> {
  static propTypes = propTypes;
  static defaultProps = defaultProps;

  state = {
    isFullscreen: false,
    showButton: false
  };

  _mapboxFullscreenControl: any = null;

  componentDidMount() {
    const container = this.props.container || this._context.mapContainer;

    this._mapboxFullscreenControl = new mapboxgl.FullscreenControl({
      container
    });

    // eslint-disable-next-line
    this.setState({
      showButton: this._mapboxFullscreenControl._checkFullscreenSupport()
    });

    document.addEventListener(
      this._mapboxFullscreenControl._fullscreenchange,
      this._onFullscreenChange
    );
  }

  componentWillUnmount() {
    document.removeEventListener(
      this._mapboxFullscreenControl._fullscreenchange,
      this._onFullscreenChange
    );
  }

  _onFullscreenChange = () => {
    const nextState = !this._mapboxFullscreenControl._fullscreen;
    // this is a hack
    // Mapbox use `_fullscreen` flag to toggle fullscreen mode
    this._mapboxFullscreenControl._fullscreen = nextState;
    this.setState({isFullscreen: nextState});
  };

  _onClickFullscreen = () => {
    this._mapboxFullscreenControl._onClickFullscreen();
  };

  _renderButton(type: string, label: string, callback: Function) {
    return (
      <button
        key={type}
        className={`mapboxgl-ctrl-icon mapboxgl-ctrl-${type}`}
        type="button"
        title={label}
        onClick={callback}
      />
    );
  }

  _render() {
    if (!this.state.showButton) {
      return null;
    }

    const {className} = this.props;
    const {isFullscreen} = this.state;

    const type = isFullscreen ? 'shrink' : 'fullscreen';

    return (
      <div className={`mapboxgl-ctrl mapboxgl-ctrl-group ${className}`} ref={this._containerRef}>
        {this._renderButton(type, 'Toggle fullscreen', this._onClickFullscreen)}
      </div>
    );
  }
}
