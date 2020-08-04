import React, {createElement} from 'react';
import {inheritsFrom} from './inherits-from';
import {Layer, View} from '@deck.gl/core';

// recursively wrap render callbacks in `View`
function wrapInView(node) {
  if (!node) {
    return node;
  }
  if (typeof node === 'function') {
    // React.Children does not traverse functions.
    // All render callbacks must be protected under a <View>
    return createElement(View, {}, node);
  }
  if (Array.isArray(node)) {
    return node.map(wrapInView);
  }
  if (inheritsFrom(node.type, View)) {
    return node;
  }
  return node;
}

// extracts any deck.gl layers masquerading as react elements from props.children
export default function extractJSXLayers({children, layers, views}) {
  const reactChildren = []; // extract real react elements (i.e. not deck.gl layers)
  const jsxLayers = []; // extracted layer from react children, will add to deck.gl layer array
  const jsxViews = {};

  // React.children
  React.Children.forEach(wrapInView(children), reactElement => {
    if (reactElement) {
      // For some reason Children.forEach doesn't filter out `null`s
      const ElementType = reactElement.type;
      if (inheritsFrom(ElementType, Layer)) {
        const layer = createLayer(ElementType, reactElement.props);
        jsxLayers.push(layer);
      } else {
        reactChildren.push(reactElement);
      }

      // empty id => default view
      if (ElementType !== View && inheritsFrom(ElementType, View) && reactElement.props.id) {
        const view = new ElementType(reactElement.props);
        jsxViews[view.id] = view;
      }
    }
  });

  // Avoid modifying views if no JSX views were found
  if (Object.keys(jsxViews).length > 0) {
    // If a view is specified in both views prop and JSX, use the one in views
    if (Array.isArray(views)) {
      views.forEach(view => {
        jsxViews[view.id] = view;
      });
    } else if (views) {
      jsxViews[views.id] = views;
    }
    views = Object.values(jsxViews);
  }

  // Avoid modifying layers array if no JSX layers were found
  layers = jsxLayers.length > 0 ? [...jsxLayers, ...layers] : layers;

  return {layers, children: reactChildren, views};
}

function createLayer(LayerType, reactProps) {
  const props = {};
  // Layer.defaultProps is treated as ReactElement.defaultProps and merged into react props
  // Remove them
  const defaultProps = LayerType.defaultProps || {};
  for (const key in reactProps) {
    if (defaultProps[key] !== reactProps[key]) {
      props[key] = reactProps[key];
    }
  }
  return new LayerType(props);
}
