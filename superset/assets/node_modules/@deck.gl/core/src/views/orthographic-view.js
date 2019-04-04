import View from './view';
import Viewport from '../viewports/viewport';

import {Matrix4} from 'math.gl';

export default class OrthographicView extends View {
  _getViewport({x, y, width, height, viewState}) {
    // Get view matrix parameters from view state
    const {
      // view matrix arguments
      eye = [0, 0, 1], // Defines eye position
      lookAt = [0, 0, 0], // Which point is camera looking at, default origin
      up = [0, 1, 0] // Defines up direction, default positive y axis
    } = viewState;

    // Make sure Matrix4.ortho doesn't crash on 0 width/height
    width = width || 1;
    height = height || 1;

    // Get projection matrix parameters from the view itself
    // NOTE: automatically calculated from width and height if not provided
    const {
      // projection matrix arguments
      left = -width / 2, // Left bound of the frustum
      top = -height / 2, // Top bound of the frustum

      near = 1, // Distance of near clipping plane
      far = 100 // Distance of far clipping plane
    } = this.props;

    let {
      right = null, // Right bound of the frustum
      bottom = null // Bottom bound of the frustum
    } = this.props;

    right = Number.isFinite(right) ? right : left + width;
    bottom = Number.isFinite(bottom) ? bottom : top + height;

    return new Viewport({
      id: this.id,
      x,
      y,
      width,
      height,
      viewMatrix: new Matrix4().lookAt({eye, lookAt, up}),
      projectionMatrix: new Matrix4().ortho({left, right, bottom, top, near, far})
    });
  }
}

OrthographicView.displayName = 'OrthographicView';
