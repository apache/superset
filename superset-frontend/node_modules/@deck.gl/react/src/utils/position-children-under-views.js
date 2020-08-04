import {createElement} from 'react';
import {View, log} from '@deck.gl/core';
import {inheritsFrom} from './inherits-from';
import evaluateChildren from './evaluate-children';

// Iterate over views and reposition children associated with views
// TODO - Can we supply a similar function for the non-React case?
export default function positionChildrenUnderViews({children, viewports, deck, ContextProvider}) {
  const {viewManager} = deck || {};

  if (!viewManager || !viewManager.views.length) {
    return [];
  }

  const defaultViewId = viewManager.views[0].id;

  return children.map((child, i) => {
    if (child.props.viewportId) {
      log.removed('viewportId', '<View>')();
    }
    if (child.props.viewId) {
      log.removed('viewId', '<View>')();
    }

    // Unless child is a View, position / render as part of the default view
    let viewId = defaultViewId;
    let viewChildren = child;

    if (inheritsFrom(child.type, View)) {
      viewId = child.props.id || defaultViewId;
      viewChildren = child.props.children;
    }
    const childStyle = viewChildren && viewChildren.props && viewChildren.props.style;

    const viewport = viewManager.getViewport(viewId);
    const viewState = viewManager.getViewState(viewId);

    // Drop (auto-hide) elements with viewId that are not matched by any current view
    if (!viewport) {
      return null;
    }

    // Resolve potentially relative dimensions using the deck.gl container size
    const {x, y, width, height} = viewport;

    viewChildren = evaluateChildren(viewChildren, {
      x,
      y,
      width,
      height,
      viewport,
      viewState
    });

    const style = {
      position: 'absolute',
      // Use child's z-index for ordering
      zIndex: childStyle && childStyle.zIndex,
      // If this container is on top, it will block interaction with the deck canvas
      pointerEvents: 'none',
      left: x,
      top: y,
      width,
      height
    };
    const key = `view-child-${viewId}-${i}`;

    if (ContextProvider) {
      const contextValue = {
        viewport,
        container: deck.canvas.offsetParent,
        eventManager: deck.eventManager,
        onViewStateChange: deck._onViewStateChange
      };
      viewChildren = createElement(ContextProvider, {value: contextValue}, viewChildren);
    }

    return createElement('div', {key, id: key, style}, viewChildren);
  });
}
