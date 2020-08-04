export function width(view) {
  var padding = view.padding();
  return Math.max(0, view._viewWidth + padding.left + padding.right);
}

export function height(view) {
  var padding = view.padding();
  return Math.max(0, view._viewHeight + padding.top + padding.bottom);
}

export function offset(view) {
  var padding = view.padding(),
      origin = view._origin;
  return [
    padding.left + origin[0],
    padding.top + origin[1]
  ];
}

export function resizeRenderer(view) {
  var origin = offset(view),
      w = width(view),
      h = height(view);

  view._renderer.background(view.background());
  view._renderer.resize(w, h, origin);
  view._handler.origin(origin);

  view._resizeListeners.forEach(function(handler) {
    try {
      handler(w, h);
    } catch (error) {
      view.error(error);
    }
  });
}
