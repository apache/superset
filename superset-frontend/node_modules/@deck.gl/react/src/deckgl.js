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

import React, {createElement} from 'react';
import PropTypes from 'prop-types';
import {Deck, experimental} from '@deck.gl/core';
const {memoize} = experimental;

import extractJSXLayers from './utils/extract-jsx-layers';
import positionChildrenUnderViews from './utils/position-children-under-views';

const propTypes = Deck.getPropTypes(PropTypes);

const defaultProps = Deck.defaultProps;

export default class DeckGL extends React.Component {
  constructor(props) {
    super(props);

    this.viewports = null;
    this.children = null;

    // The redraw flag of deck
    this._needsRedraw = null;

    // Bind public methods
    this.pickObject = this.pickObject.bind(this);
    this.pickMultipleObjects = this.pickMultipleObjects.bind(this);
    this.pickObjects = this.pickObjects.bind(this);

    // Memoized functions
    this._extractJSXLayers = memoize(extractJSXLayers);
    this._positionChildrenUnderViews = memoize(positionChildrenUnderViews);
  }

  componentDidMount() {
    // Allows a subclass of Deck to be used
    // TODO - update propTypes / defaultProps?
    const DeckClass = this.props.Deck || Deck;

    // DEVTOOLS can cause this to be called twice
    this.deck =
      this.deck ||
      new DeckClass(
        Object.assign({}, this.props, {
          canvas: this.deckCanvas,
          // The Deck's animation loop is independent from React's render cycle, causing potential
          // synchronization issues. We provide this custom render function to make sure that React
          // and Deck update on the same schedule.
          _customRender: this._customRender.bind(this)
        })
      );
    this._updateFromProps(this.props);
  }

  // This method checks if React needs to call `render`.
  // Props changes may lead to 3 types of updates:
  // 1. Only the WebGL context - updated in Deck's render cycle (next animation frame)
  // 2. Only the DOM - updated in React's lifecycle (now)
  // 3. Both the WebGL context and the DOM - defer React rerender to next animation frame just
  //    before Deck redraw to ensure perfect synchronization & avoid excessive redraw
  //    This is because multiple changes may happen to Deck between two frames e.g. transition
  shouldComponentUpdate(nextProps) {
    // Update Deck's props. If Deck needs redraw, this will trigger a call to `_customRender` in
    // the next animation frame.
    this._updateFromProps(nextProps);

    // If the child components have changed, React needs to rerender (case 2 or 3)
    const childrenChanged = this.children !== this._parseJSX(nextProps).children;
    // If the views have changed, both React and WebGL context need update (case 3)
    const viewsChanged = this.deck.viewManager && this.deck.viewManager.needsRedraw();

    // Only call `render` right away in case 2
    return childrenChanged && !viewsChanged;
  }

  componentDidUpdate() {
    // render has just been called. The children are positioned based on the current view state.
    // Redraw Deck canvas immediately, if necessary, using the current view state, so that it
    // matches the child components.
    this._redrawDeck();
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

  // Callbacks
  _redrawDeck() {
    if (this._needsRedraw) {
      // Only redraw it we have received a dirty flag
      this.deck._drawLayers(this._needsRedraw);
      this._needsRedraw = null;
    }
  }

  _customRender(redrawReason) {
    // Save the dirty flag for later
    this._needsRedraw = redrawReason;

    // Viewport/view state is passed to child components as props.
    // If they have changed, we need to trigger a React rerender to update children props.
    const viewports = this.deck.viewManager.getViewports();
    if (viewports !== this.viewports) {
      // Viewports have changed, update children props first.
      // This will delay the Deck canvas redraw till after React update (in componentDidUpdate)
      // so that the canvas does not get rendered before the child components update.
      this.forceUpdate();
    } else {
      this._redrawDeck();
    }
  }

  // Private Helpers

  _parseJSX(props) {
    return this._extractJSXLayers({
      layers: props.layers,
      views: props.views,
      children: props.children
    });
  }

  // 1. Extract any JSX layers from the react children
  // 2. Handle any backwards compatiblity props for React layer
  // Needs to be called both from initial mount, and when new props are received
  _updateFromProps(props) {
    // extract any deck.gl layers masquerading as react elements from props.children
    const {layers, views} = this._parseJSX(props);
    const deckProps = Object.assign({}, props, {
      layers,
      views
    });

    this.deck.setProps(deckProps);
  }

  render() {
    // Save the viewports and children used for this render
    const {viewManager} = this.deck || {};
    this.viewports = viewManager && viewManager.getViewports();
    this.children = this._parseJSX(this.props).children;

    // Render the background elements (typically react-map-gl instances)
    // using the view descriptors
    const children = this._positionChildrenUnderViews({
      children: this.children,
      viewports: this.viewports,
      deck: this.deck,
      ContextProvider: this.props.ContextProvider
    });

    // TODO - this styling is enforced for correct positioning with children
    // It can override the styling set by `Deck`, this should be consolidated.
    // Note that width and height are handled by deck.gl
    const style = Object.assign({}, {position: 'absolute', left: 0, top: 0}, this.props.style);

    const canvas = createElement('canvas', {
      ref: c => (this.deckCanvas = c),
      key: 'deck-canvas',
      id: this.props.id,
      style
    });

    // Render deck.gl as the last child
    return createElement('div', {id: 'deckgl-wrapper'}, [children, canvas]);
  }
}

DeckGL.propTypes = propTypes;
DeckGL.defaultProps = defaultProps;
