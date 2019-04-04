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

import assert from '../utils/assert';
import {deepEqual} from '../utils/deep-equal';
import View from '../views/view';
import Viewport from '../viewports/viewport';
import log from '../utils/log';
import {flatten} from '../utils/flatten';

const INITIAL_VIEW_STATE = {latitude: 0, longitude: 0, zoom: 1};

export default class ViewManager {
  constructor(props = {}) {
    // List of view descriptors, gets re-evaluated when width/height changes
    this.views = [];
    this.width = 100;
    this.height = 100;
    this.viewState = INITIAL_VIEW_STATE;

    this._viewports = []; // Generated viewports
    this._needsRedraw = 'Initial render';
    this._needsUpdate = true;

    Object.seal(this);

    // Init with default map viewport
    this.setProps(props);
  }

  finalize() {}

  // Check if a redraw is needed
  needsRedraw({clearRedrawFlags = true} = {}) {
    const redraw = this._needsRedraw;
    if (clearRedrawFlags) {
      this._needsRedraw = false;
    }
    return redraw;
  }

  // Layers will be redrawn (in next animation frame)
  setNeedsRedraw(reason) {
    this._needsRedraw = this._needsRedraw || reason;
  }

  // Layers will be updated deeply (in next animation frame)
  // Potentially regenerating attributes and sub layers
  setNeedsUpdate(reason) {
    this._needsUpdate = this._needsUpdate || reason;
    this._needsRedraw = this._needsRedraw || reason;
  }

  // Get a set of viewports for a given width and height
  // TODO - Intention is for deck.gl to autodeduce width and height and drop the need for props
  getViewports() {
    this._rebuildViewportsFromViews();
    return this._viewports;
  }

  /**
   * Projects xyz (possibly latitude and longitude) to pixel coordinates in window
   * using viewport projection parameters
   * - [longitude, latitude] to [x, y]
   * - [longitude, latitude, Z] => [x, y, z]
   * Note: By default, returns top-left coordinates for canvas/SVG type render
   *
   * @param {Array} lngLatZ - [lng, lat] or [lng, lat, Z]
   * @param {Object} opts - options
   * @param {Object} opts.topLeft=true - Whether projected coords are top left
   * @return {Array} - [x, y] or [x, y, z] in top left coords
   */
  project(xyz, opts = {topLeft: true}) {
    const viewports = this.getViewports();
    for (let i = viewports.length - 1; i >= 0; --i) {
      const viewport = viewports[i];
      if (viewport.contains(xyz, opts)) {
        return viewport.project(xyz, opts);
      }
    }
    return null;
  }

  /**
   * Unproject pixel coordinates on screen onto world coordinates,
   * (possibly [lon, lat]) on map.
   * - [x, y] => [lng, lat]
   * - [x, y, z] => [lng, lat, Z]
   * @param {Array} xyz -
   * @param {Object} opts - options
   * @param {Object} opts.topLeft=true - Whether origin is top left
   * @return {Array|null} - [lng, lat, Z] or [X, Y, Z]
   */
  unproject(xyz, opts) {
    const viewports = this.getViewports();
    for (let i = viewports.length - 1; i >= 0; --i) {
      const viewport = viewports[i];
      if (viewport.containsPixel(xyz, opts)) {
        return viewport.unproject(xyz);
      }
    }
    return null;
  }

  /**
   * Set props needed for layer rendering and picking.
   * Parameters are to be passed as a single object, with the following values:
   * @param {Boolean} useDevicePixels
   */
  /* eslint-disable complexity */
  setProps(props) {
    if ('views' in props) {
      this.setViews(props.views);
    }

    // TODO - support multiple view states
    if ('viewState' in props) {
      this.setViewState(props.viewState);
    }

    if ('width' in props || 'height' in props) {
      this.setSize(props.width, props.height);
    }

    if ('useDevicePixels' in props) {
      this.context.useDevicePixels = props.useDevicePixels;
    }
  }
  /* eslint-enable complexity */

  setSize(width, height) {
    assert(Number.isFinite(width) && Number.isFinite(height));
    if (width !== this.width || height !== this.height) {
      this.width = width;
      this.height = height;
      this.setNeedsUpdate('Size changed');
    }
  }

  // Update the view descriptor list and set change flag if needed
  // Does not actually rebuild the `Viewport`s until `getViewports` is called
  setViews(views) {
    // DEPRECATED: Ensure any "naked" Viewports are wrapped in View instances
    views = flatten(views, {filter: Boolean}).map(
      view => (view instanceof Viewport ? new View({viewportInstance: view}) : view)
    );

    const viewsChanged = this._diffViews(views, this.views);
    if (viewsChanged) {
      this.setNeedsUpdate('views changed');
    }

    this.views = views;
  }

  setViewState(viewState) {
    if (viewState) {
      const viewStateChanged = deepEqual(viewState, this.viewState);

      if (viewStateChanged) {
        this.setNeedsUpdate('viewState changed');
      }

      this.viewState = viewState;
    } else {
      log.warn('setting null viewState')();
    }
  }

  //
  // PRIVATE METHODS
  //

  // Rebuilds viewports from descriptors towards a certain window size
  _rebuildViewportsFromViews() {
    const updateReason = this._needsUpdate;
    if (updateReason) {
      const {width, height, views, viewState} = this;

      this._viewports = views.map(view => view.makeViewport({width, height, viewState}));

      // We've just rebuilt the Viewports to match the View descriptors,
      // so clear the update flag and set the render flag
      this._needsUpdate = false;
    }
  }

  // Check if viewport array has changed, returns true if any change
  // Note that descriptors can be the same
  _diffViews(newViews, oldViews) {
    if (newViews.length !== oldViews.length) {
      return true;
    }

    return newViews.some((_, i) => !newViews[i].equals(oldViews[i]));
  }
}
