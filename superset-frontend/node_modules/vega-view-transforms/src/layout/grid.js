import {
  All, AxisRole, ColFooter, ColHeader, ColTitle, Column, Each, End, Flush,
  Group, LegendRole, Middle, Row,
  RowFooter, RowHeader, RowTitle,
  TitleRole, X, Y
} from '../constants';
import {tempBounds} from './util';
import {Bounds} from 'vega-scenegraph';
import {isObject} from 'vega-util';

// aggregation functions for grid margin determination
const min = (a, b) => Math.floor(Math.min(a, b));
const max = (a, b) => Math.ceil(Math.max(a, b));

function gridLayoutGroups(group) {
  var groups = group.items,
      n = groups.length,
      i = 0, mark, items;

  var views = {
    marks:      [],
    rowheaders: [],
    rowfooters: [],
    colheaders: [],
    colfooters: [],
    rowtitle: null,
    coltitle: null
  };

  // layout axes, gather legends, collect bounds
  for (; i<n; ++i) {
    mark = groups[i];
    items = mark.items;
    if (mark.marktype === Group) {
      switch (mark.role) {
        case AxisRole:
        case LegendRole:
        case TitleRole:
          break;
        case RowHeader: views.rowheaders.push(...items); break;
        case RowFooter: views.rowfooters.push(...items); break;
        case ColHeader: views.colheaders.push(...items); break;
        case ColFooter: views.colfooters.push(...items); break;
        case RowTitle:  views.rowtitle = items[0]; break;
        case ColTitle:  views.coltitle = items[0]; break;
        default:        views.marks.push(...items);
      }
    }
  }

  return views;
}

function bboxFlush(item) {
  return new Bounds().set(0, 0, item.width || 0, item.height || 0);
}

function bboxFull(item) {
  var b = item.bounds.clone();
  return b.empty()
    ? b.set(0, 0, 0, 0)
    : b.translate(-(item.x || 0), -(item.y || 0));
}

function get(opt, key, d) {
  var v = isObject(opt) ? opt[key] : opt;
  return v != null ? v : (d !== undefined ? d : 0);
}

function offsetValue(v) {
  return v < 0 ? Math.ceil(-v) : 0;
}

export function gridLayout(view, groups, opt) {
  var dirty = !opt.nodirty,
      bbox = opt.bounds === Flush ? bboxFlush : bboxFull,
      bounds = tempBounds.set(0, 0, 0, 0),
      alignCol = get(opt.align, Column),
      alignRow = get(opt.align, Row),
      padCol = get(opt.padding, Column),
      padRow = get(opt.padding, Row),
      ncols = opt.columns || groups.length,
      nrows = ncols <= 0 ? 1 : Math.ceil(groups.length / ncols),
      n = groups.length,
      xOffset = Array(n), xExtent = Array(ncols), xMax = 0,
      yOffset = Array(n), yExtent = Array(nrows), yMax = 0,
      dx = Array(n), dy = Array(n), boxes = Array(n),
      m, i, c, r, b, g, px, py, x, y, offset;

  for (i=0; i<ncols; ++i) xExtent[i] = 0;
  for (i=0; i<nrows; ++i) yExtent[i] = 0;

  // determine offsets for each group
  for (i=0; i<n; ++i) {
    g = groups[i];
    b = boxes[i] = bbox(g);
    g.x = g.x || 0; dx[i] = 0;
    g.y = g.y || 0; dy[i] = 0;
    c = i % ncols;
    r = ~~(i / ncols);
    xMax = Math.max(xMax, px = Math.ceil(b.x2));
    yMax = Math.max(yMax, py = Math.ceil(b.y2));
    xExtent[c] = Math.max(xExtent[c], px);
    yExtent[r] = Math.max(yExtent[r], py);
    xOffset[i] = padCol + offsetValue(b.x1);
    yOffset[i] = padRow + offsetValue(b.y1);
    if (dirty) view.dirty(groups[i]);
  }

  // set initial alignment offsets
  for (i=0; i<n; ++i) {
    if (i % ncols === 0) xOffset[i] = 0;
    if (i < ncols) yOffset[i] = 0;
  }

  // enforce column alignment constraints
  if (alignCol === Each) {
    for (c=1; c<ncols; ++c) {
      for (offset=0, i=c; i<n; i += ncols) {
        if (offset < xOffset[i]) offset = xOffset[i];
      }
      for (i=c; i<n; i += ncols) {
        xOffset[i] = offset + xExtent[c-1];
      }
    }
  } else if (alignCol === All) {
    for (offset=0, i=0; i<n; ++i) {
      if (i % ncols && offset < xOffset[i]) offset = xOffset[i];
    }
    for (i=0; i<n; ++i) {
      if (i % ncols) xOffset[i] = offset + xMax;
    }
  } else {
    for (alignCol=false, c=1; c<ncols; ++c) {
      for (i=c; i<n; i += ncols) {
        xOffset[i] += xExtent[c-1];
      }
    }
  }

  // enforce row alignment constraints
  if (alignRow === Each) {
    for (r=1; r<nrows; ++r) {
      for (offset=0, i=r*ncols, m=i+ncols; i<m; ++i) {
        if (offset < yOffset[i]) offset = yOffset[i];
      }
      for (i=r*ncols; i<m; ++i) {
        yOffset[i] = offset + yExtent[r-1];
      }
    }
  } else if (alignRow === All) {
    for (offset=0, i=ncols; i<n; ++i) {
      if (offset < yOffset[i]) offset = yOffset[i];
    }
    for (i=ncols; i<n; ++i) {
      yOffset[i] = offset + yMax;
    }
  } else {
    for (alignRow=false, r=1; r<nrows; ++r) {
      for (i=r*ncols, m=i+ncols; i<m; ++i) {
        yOffset[i] += yExtent[r-1];
      }
    }
  }

  // perform horizontal grid layout
  for (x=0, i=0; i<n; ++i) {
    x = xOffset[i] + (i % ncols ? x : 0);
    dx[i] += x - groups[i].x;
  }

  // perform vertical grid layout
  for (c=0; c<ncols; ++c) {
    for (y=0, i=c; i<n; i += ncols) {
      y += yOffset[i];
      dy[i] += y - groups[i].y;
    }
  }

  // perform horizontal centering
  if (alignCol && get(opt.center, Column) && nrows > 1) {
    for (i=0; i<n; ++i) {
      b = alignCol === All ? xMax : xExtent[i % ncols];
      x = b - boxes[i].x2 - groups[i].x - dx[i];
      if (x > 0) dx[i] += x / 2;
    }
  }

  // perform vertical centering
  if (alignRow && get(opt.center, Row) && ncols !== 1) {
    for (i=0; i<n; ++i) {
      b = alignRow === All ? yMax : yExtent[~~(i / ncols)];
      y = b - boxes[i].y2 - groups[i].y - dy[i];
      if (y > 0) dy[i] += y / 2;
    }
  }

  // position grid relative to anchor
  for (i=0; i<n; ++i) {
    bounds.union(boxes[i].translate(dx[i], dy[i]));
  }
  x = get(opt.anchor, X);
  y = get(opt.anchor, Y);
  switch (get(opt.anchor, Column)) {
    case End:    x -= bounds.width(); break;
    case Middle: x -= bounds.width() / 2;
  }
  switch (get(opt.anchor, Row)) {
    case End:    y -= bounds.height(); break;
    case Middle: y -= bounds.height() / 2;
  }
  x = Math.round(x);
  y = Math.round(y);

  // update mark positions, bounds, dirty
  bounds.clear();
  for (i=0; i<n; ++i) {
    groups[i].mark.bounds.clear();
  }
  for (i=0; i<n; ++i) {
    g = groups[i];
    g.x += (dx[i] += x);
    g.y += (dy[i] += y);
    bounds.union(g.mark.bounds.union(g.bounds.translate(dx[i], dy[i])));
    if (dirty) view.dirty(g);
  }

  return bounds;
}

export function trellisLayout(view, group, opt) {
  var views = gridLayoutGroups(group),
      groups = views.marks,
      bbox = opt.bounds === Flush ? boundFlush : boundFull,
      off = opt.offset,
      ncols = opt.columns || groups.length,
      nrows = ncols <= 0 ? 1 : Math.ceil(groups.length / ncols),
      cells = nrows * ncols,
      x, y, x2, y2, anchor, band, offset;

  // -- initial grid layout
  const bounds = gridLayout(view, groups, opt);
  if (bounds.empty()) bounds.set(0, 0, 0, 0); // empty grid

  // -- layout grid headers and footers --

  // perform row header layout
  if (views.rowheaders) {
    band = get(opt.headerBand, Row, null);
    x = layoutHeaders(view, views.rowheaders, groups, ncols, nrows, -get(off, 'rowHeader'), min, 0, bbox, 'x1', 0, ncols, 1, band);
  }

  // perform column header layout
  if (views.colheaders) {
    band = get(opt.headerBand, Column, null);
    y = layoutHeaders(view, views.colheaders, groups, ncols, ncols, -get(off, 'columnHeader'), min, 1, bbox, 'y1', 0, 1, ncols, band);
  }

  // perform row footer layout
  if (views.rowfooters) {
    band = get(opt.footerBand, Row, null);
    x2 = layoutHeaders(view, views.rowfooters, groups, ncols, nrows,  get(off, 'rowFooter'), max, 0, bbox, 'x2', ncols-1, ncols, 1, band);
  }

  // perform column footer layout
  if (views.colfooters) {
    band = get(opt.footerBand, Column, null);
    y2 = layoutHeaders(view, views.colfooters, groups, ncols, ncols,  get(off, 'columnFooter'), max, 1, bbox, 'y2', cells-ncols, 1, ncols, band);
  }

  // perform row title layout
  if (views.rowtitle) {
    anchor = get(opt.titleAnchor, Row);
    offset = get(off, 'rowTitle');
    offset = anchor === End ? x2 + offset : x - offset;
    band = get(opt.titleBand, Row, 0.5);
    layoutTitle(view, views.rowtitle, offset, 0, bounds, band);
  }

  // perform column title layout
  if (views.coltitle) {
    anchor = get(opt.titleAnchor, Column);
    offset = get(off, 'columnTitle');
    offset = anchor === End ? y2 + offset : y - offset;
    band = get(opt.titleBand, Column, 0.5);
    layoutTitle(view, views.coltitle, offset, 1, bounds, band);
  }
}

function boundFlush(item, field) {
  return field === 'x1' ? (item.x || 0)
    : field === 'y1' ? (item.y || 0)
    : field === 'x2' ? (item.x || 0) + (item.width || 0)
    : field === 'y2' ? (item.y || 0) + (item.height || 0)
    : undefined;
}

function boundFull(item, field) {
  return item.bounds[field];
}

function layoutHeaders(view, headers, groups, ncols, limit, offset, agg, isX, bound, bf, start, stride, back, band) {
  var n = groups.length,
      init = 0,
      edge = 0,
      i, j, k, m, b, h, g, x, y;

  // if no groups, early exit and return 0
  if (!n) return init;

  // compute margin
  for (i=start; i<n; i+=stride) {
    if (groups[i]) init = agg(init, bound(groups[i], bf));
  }

  // if no headers, return margin calculation
  if (!headers.length) return init;

  // check if number of headers exceeds number of rows or columns
  if (headers.length > limit) {
    view.warn('Grid headers exceed limit: ' + limit);
    headers = headers.slice(0, limit);
  }

  // apply offset
  init += offset;

  // clear mark bounds for all headers
  for (j=0, m=headers.length; j<m; ++j) {
    view.dirty(headers[j]);
    headers[j].mark.bounds.clear();
  }

  // layout each header
  for (i=start, j=0, m=headers.length; j<m; ++j, i+=stride) {
    h = headers[j];
    b = h.mark.bounds;

    // search for nearest group to align to
    // necessary if table has empty cells
    for (k=i; k >= 0 && (g = groups[k]) == null; k-=back);

    // assign coordinates and update bounds
    if (isX) {
      x = band == null ? g.x : Math.round(g.bounds.x1 + band * g.bounds.width());
      y = init;
    } else {
      x = init;
      y = band == null ? g.y : Math.round(g.bounds.y1 + band * g.bounds.height());
    }
    b.union(h.bounds.translate(x - (h.x || 0), y - (h.y || 0)));
    h.x = x;
    h.y = y;
    view.dirty(h);

    // update current edge of layout bounds
    edge = agg(edge, b[bf]);
  }

  return edge;
}

function layoutTitle(view, g, offset, isX, bounds, band) {
  if (!g) return;
  view.dirty(g);

  // compute title coordinates
  var x = offset, y = offset;
  isX
    ? (x = Math.round(bounds.x1 + band * bounds.width()))
    : (y = Math.round(bounds.y1 + band * bounds.height()));

  // assign coordinates and update bounds
  g.bounds.translate(x - (g.x || 0), y - (g.y || 0));
  g.mark.bounds.clear().union(g.bounds);
  g.x = x;
  g.y = y;

  // queue title for redraw
  view.dirty(g);
}
