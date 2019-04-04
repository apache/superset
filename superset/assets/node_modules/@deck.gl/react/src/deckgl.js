// Copyright (c) 2015 - 2017 Uber Technologies, Inc.
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

import React, {createElement, cloneElement} from 'react';
import PropTypes from 'prop-types';
import autobind from './utils/autobind';
import {inheritsFrom} from './utils/inherits-from';
import {Deck, Layer, log} from '@deck.gl/core';

const propTypes = Object.assign({}, Deck.getPropTypes(PropTypes), {
  viewports: PropTypes.array, // Deprecated
  viewport: PropTypes.object // Deprecated
});

const defaultProps = Deck.defaultProps;

export default class DeckGL extends React.Component {
  constructor(props) {
    super(props);
    this.state = {};
    this.children = [];
    autobind(this);
  }

  componentDidMount() {
    this.deck = new Deck(
      Object.assign({}, this.props, {
        canvas: this.deckCanvas,
        viewState: this._getViewState(this.props),
        // Note: If Deck event handling change size or view state, it calls onResize to update
        onViewStateChange: this._onViewStateChange,
        onResize: this._onResize
      })
    );
    this._updateFromProps(this.props);
  }

  componentWillReceiveProps(nextProps) {
    this._updateFromProps(nextProps);
  }

  componentWillUnmount() {
    this.deck.finalize();
  }

  // Public API

  pickObject({x, y, radius = 0, layerIds = null}) {
    return this.deck.pickObject({x, y, radius, layerIds});
  }

  pickMultipleObjects({x, y, radius = 0, layerIds = null, depth = 10}) {
    return this.deck.pickMultipleObjects({x, y, radius, layerIds, depth});
  }

  pickObjects({x, y, width = 1, height = 1, layerIds = null}) {
    return this.deck.pickObjects({x, y, width, height, layerIds});
  }

  queryObject(opts) {
    log.deprecated('queryObject', 'pickObject')();
    return this.deck.pickObject(opts);
  }

  queryVisibleObjects(opts) {
    log.deprecated('queryVisibleObjects', 'pickObjects')();
    return this.pickObjects(opts);
  }

  // Callbacks

  // Forward callback and then call forceUpdate to guarantee that sub components update
  _onResize(...args) {
    if (this.props.onResize) {
      this.props.onResize(...args);
    }
    this.forceUpdate();
  }

  // Forward callback and then call forceUpdate to guarantee that sub components update
  _onViewStateChange(...args) {
    if (this.props.onViewStateChange) {
      this.props.onViewStateChange(...args);
    }
    this.forceUpdate();
  }

  // Private Helpers

  // 1. Extract any JSX layers from the react children
  // 2. Handle any backwards compatiblity props for React layer
  // Needs to be called both from initial mount, and when new props arrive
  _updateFromProps(nextProps) {
    // extract any deck.gl layers masquerading as react elements from props.children
    const {layers, children} = this._extractJSXLayers(nextProps.children);

    if (this.deck) {
      this.deck.setProps(
        Object.assign({}, nextProps, {
          views: this._getViews(nextProps),
          viewState: this._getViewState(nextProps),
          // Avoid modifying layers array if no JSX layers were found
          layers: layers ? [...layers, ...nextProps.layers] : nextProps.layers
        })
      );
    }

    this.children = children;
  }

  // Support old `viewports` prop (React only!)
  _getViews(props) {
    if (props.viewports) {
      log.deprecated('DeckGL.viewports', 'DeckGL.views')();
    }
    if (props.viewport) {
      log.deprecated('DeckGL.viewport', 'DeckGL.views')();
    }
    return props.views || props.viewports || (props.viewport && [props.viewport]);
  }

  // Supports old "geospatial view state as separate props" style (React only!)
  _getViewState(props) {
    let {viewState} = props;

    if (!viewState && 'latitude' in props && 'longitude' in props && 'zoom' in props) {
      const {latitude, longitude, zoom, pitch = 0, bearing = 0} = props;
      viewState = props.viewState || {latitude, longitude, zoom, pitch, bearing};
    }

    return viewState;
  }

  // extracts any deck.gl layers masquerading as react elements from props.children
  _extractJSXLayers(children) {
    const reactChildren = []; // extract real react elements (i.e. not deck.gl layers)
    let layers = null; // extracted layer from react children, will add to deck.gl layer array

    React.Children.forEach(children, reactElement => {
      if (reactElement) {
        // For some reason Children.forEach doesn't filter out `null`s
        const LayerType = reactElement.type;
        if (inheritsFrom(LayerType, Layer)) {
          const layer = new LayerType(reactElement.props);
          layers = layers || [];
          layers.push(layer);
        } else {
          reactChildren.push(reactElement);
        }
      }
    });

    return {layers, children: reactChildren};
  }

  // Iterate over views and reposition children associated with views
  // TODO - Can we supply a similar function for the non-React case?
  _renderChildrenUnderViews(children) {
    // Flatten out nested views array
    const views = this.deck ? this.deck.getViewports() : [];

    // Build a view id to view index
    const viewMap = {};
    views.forEach(view => {
      if (view.id) {
        viewMap[view.id] = view;
      }
    });

    return children.map(
      // If child specifies props.viewId, position under view, otherwise render as normal
      (child, i) =>
        child.props.viewId || child.props.viewId ? this._positionChild({child, viewMap, i}) : child
    );
  }

  _positionChild({child, viewMap, i}) {
    const {viewId, viewportId} = child.props;
    if (viewportId) {
      log.deprecated('viewportId', 'viewId')();
    }
    const view = viewMap[viewId || viewportId];

    // Drop (auto-hide) elements with viewId that are not matched by any current view
    if (!view) {
      return null;
    }

    // Resolve potentially relative dimensions using the deck.gl container size
    const {x, y, width, height} = view;

    // Clone the element with width and height set per view
    const newProps = Object.assign({}, child.props, {width, height});

    // Inject map properties
    // TODO - this is too react-map-gl specific
    Object.assign(newProps, view.getMercatorParams(), {
      visible: view.isMapSynched()
    });

    const clone = cloneElement(child, newProps);

    // Wrap it in an absolutely positioning div
    const style = {position: 'absolute', left: x, top: y, width, height};
    const key = `view-child-${viewId}-${i}`;
    return createElement('div', {key, id: key, style}, clone);
  }

  render() {
    // Render the background elements (typically react-map-gl instances)
    // using the view descriptors
    const children = this._renderChildrenUnderViews(this.children);

    // Note that width and height are handled by deck.gl
    const {id} = this.props;
    // TODO - this styling is enforced for correct positioning with children
    // It can override the styling set by `Deck`, this should be consolidated.
    const style = Object.assign({}, {position: 'absolute', left: 0, top: 0}, this.props.style);

    const canvas = createElement('canvas', {
      ref: c => (this.deckCanvas = c),
      key: 'deck-canvas',
      id,
      style
    });

    // Render deck.gl as last child
    children.push(canvas);

    return createElement('div', {id: 'deckgl-wrapper'}, children);
  }
}

DeckGL.propTypes = propTypes;
DeckGL.defaultProps = defaultProps;
