var Width = 'width',
    Height = 'height',
    Padding = 'padding',
    Skip = {skip: true};

export function viewWidth(view, width) {
  var a = view.autosize(),
      p = view.padding();
  return width - (a && a.contains === Padding ? p.left + p.right : 0);
}

export function viewHeight(view, height) {
  var a = view.autosize(),
      p = view.padding();
  return height - (a && a.contains === Padding ? p.top + p.bottom : 0);
}

export function initializeResize(view) {
  var s = view._signals,
      w = s[Width],
      h = s[Height],
      p = s[Padding];

  function resetSize() {
    view._autosize = view._resize = 1;
  }

  // respond to width signal
  view._resizeWidth = view.add(null,
    function(_) {
      view._width = _.size;
      view._viewWidth = viewWidth(view, _.size);
      resetSize();
    },
    {size: w}
  );

  // respond to height signal
  view._resizeHeight = view.add(null,
    function(_) {
      view._height = _.size;
      view._viewHeight = viewHeight(view, _.size);
      resetSize();
    },
    {size: h}
  );

  // respond to padding signal
  var resizePadding = view.add(null, resetSize, {pad: p});

  // set rank to run immediately after source signal
  view._resizeWidth.rank = w.rank + 1;
  view._resizeHeight.rank = h.rank + 1;
  resizePadding.rank = p.rank + 1;
}

export function resizeView(viewWidth, viewHeight, width, height, origin, auto) {
  this.runAfter(function(view) {
    var rerun = 0;

    // reset autosize flag
    view._autosize = 0;

    // width value changed: update signal, skip resize op
    if (view.width() !== width) {
      rerun = 1;
      view.signal(Width, width, Skip); // set width, skip update calc
      view._resizeWidth.skip(true); // skip width resize handler
    }

    // height value changed: update signal, skip resize op
    if (view.height() !== height) {
      rerun = 1;
      view.signal(Height, height, Skip); // set height, skip update calc
      view._resizeHeight.skip(true); // skip height resize handler
    }

    // view width changed: update view property, set resize flag
    if (view._viewWidth !== viewWidth) {
      view._resize = 1;
      view._viewWidth = viewWidth;
    }

    // view height changed: update view property, set resize flag
    if (view._viewHeight !== viewHeight) {
      view._resize = 1;
      view._viewHeight = viewHeight;
    }

    // origin changed: update view property, set resize flag
    if (view._origin[0] !== origin[0] || view._origin[1] !== origin[1]) {
      view._resize = 1;
      view._origin = origin;
    }

    // run dataflow on width/height signal change
    if (rerun) view.run('enter');
    if (auto) view.runAfter(v => v.resize());
  }, false, 1);
}
