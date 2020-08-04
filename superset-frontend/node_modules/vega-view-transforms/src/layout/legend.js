import {
  Bottom, BottomLeft, BottomRight, Each, End, Flush, Left, Middle,
  None, Right, Start, Symbols, Top,
  TopLeft, TopRight
} from '../constants';
import {boundStroke, multiLineOffset} from 'vega-scenegraph';

// utility for looking up legend layout configuration
function lookup(config, orient) {
  const opt = config[orient] || {};
  return (key, d) => opt[key] != null ? opt[key]
    : config[key] != null ? config[key]
    : d;
}

// if legends specify offset directly, use the maximum specified value
function offsets(legends, value) {
  var max = -Infinity;
  legends.forEach(item => {
    if (item.offset != null) max = Math.max(max, item.offset);
  });
  return max > -Infinity ? max : value;
}

export function legendParams(g, orient, config, xb, yb, w, h) {
  const _ = lookup(config, orient),
        offset = offsets(g, _('offset', 0)),
        anchor = _('anchor', Start),
        mult = anchor === End ? 1 : anchor === Middle ? 0.5 : 0;

  const p = {
    align:   Each,
    bounds:  _('bounds', Flush),
    columns: _('direction') === 'vertical' ? 1 : g.length,
    padding: _('margin', 8),
    center:  _('center'),
    nodirty: true
  };

  switch (orient) {
    case Left:
      p.anchor = {
        x: Math.floor(xb.x1) - offset, column: End,
        y: mult * (h || xb.height() + 2 * xb.y1), row: anchor
      };
      break;
    case Right:
      p.anchor = {
        x: Math.ceil(xb.x2) + offset,
        y: mult * (h || xb.height() + 2 * xb.y1), row: anchor
      };
      break;
    case Top:
      p.anchor = {
        y: Math.floor(yb.y1) - offset, row: End,
        x: mult * (w || yb.width() + 2 * yb.x1), column: anchor
      };
      break;
    case Bottom:
      p.anchor = {
        y: Math.ceil(yb.y2) + offset,
        x: mult * (w || yb.width() + 2 * yb.x1), column: anchor
      };
      break;
    case TopLeft:
      p.anchor = {x: offset, y: offset};
      break;
    case TopRight:
      p.anchor = {x: w - offset, y: offset, column: End};
      break;
    case BottomLeft:
      p.anchor = {x: offset, y: h - offset, row: End};
      break;
    case BottomRight:
      p.anchor = {x: w - offset, y: h - offset, column: End, row: End};
      break;
  }

  return p;
}

export function legendLayout(view, legend) {
  var item = legend.items[0],
      datum = item.datum,
      orient = item.orient,
      bounds = item.bounds,
      x = item.x, y = item.y, w, h;

  // cache current bounds for later comparison
  item._bounds
    ? item._bounds.clear().union(bounds)
    : item._bounds = bounds.clone();
  bounds.clear();

  // adjust legend to accommodate padding and title
  legendGroupLayout(view, item, item.items[0].items[0]);

  // aggregate bounds to determine size, and include origin
  bounds = legendBounds(item, bounds);
  w = 2 * item.padding;
  h = 2 * item.padding;
  if (!bounds.empty()) {
    w = Math.ceil(bounds.width() + w);
    h = Math.ceil(bounds.height() + h);
  }

  if (datum.type === Symbols) {
    legendEntryLayout(item.items[0].items[0].items[0].items);
  }

  if (orient !== None) {
    item.x = x = 0;
    item.y = y = 0;
  }
  item.width = w;
  item.height = h;
  boundStroke(bounds.set(x, y, x + w, y + h), item);
  item.mark.bounds.clear().union(bounds);

  return item;
}

function legendBounds(item, b) {
  // aggregate item bounds
  item.items.forEach(_ => b.union(_.bounds));

  // anchor to legend origin
  b.x1 = item.padding;
  b.y1 = item.padding;

  return b;
}

function legendGroupLayout(view, item, entry) {
  var pad = item.padding,
      ex = pad - entry.x,
      ey = pad - entry.y;

  if (!item.datum.title) {
    if (ex || ey) translate(view, entry, ex, ey);
  } else {
    var title = item.items[1].items[0],
        anchor = title.anchor,
        tpad = item.titlePadding || 0,
        tx = pad - title.x,
        ty = pad - title.y;

    switch (title.orient) {
      case Left:
        ex += Math.ceil(title.bounds.width()) + tpad;
        break;
      case Right:
      case Bottom:
        break;
      default:
        ey += title.bounds.height() + tpad;
    }
    if (ex || ey) translate(view, entry, ex, ey);

    switch (title.orient) {
      case Left:
        ty += legendTitleOffset(item, entry, title, anchor, 1, 1);
        break;
      case Right:
        tx += legendTitleOffset(item, entry, title, End, 0, 0) + tpad;
        ty += legendTitleOffset(item, entry, title, anchor, 1, 1);
        break;
      case Bottom:
        tx += legendTitleOffset(item, entry, title, anchor, 0, 0);
        ty += legendTitleOffset(item, entry, title, End, -1, 0, 1) + tpad;
        break;
      default:
        tx += legendTitleOffset(item, entry, title, anchor, 0, 0);
    }
    if (tx || ty) translate(view, title, tx, ty);

    // translate legend if title pushes into negative coordinates
    if ((tx = Math.round(title.bounds.x1 - pad)) < 0) {
      translate(view, entry, -tx, 0);
      translate(view, title, -tx, 0);
    }
  }
}

function legendTitleOffset(item, entry, title, anchor, y, lr, noBar) {
  const grad = item.datum.type !== 'symbol',
        vgrad = title.datum.vgrad,
        e = grad && (lr || !vgrad) && !noBar ? entry.items[0] : entry,
        s = e.bounds[y ? 'y2' : 'x2'] - item.padding,
        u = vgrad && lr ? s : 0,
        v = vgrad && lr ? 0 : s,
        o = y <= 0 ? 0 : multiLineOffset(title);

  return Math.round(anchor === Start ? u
    : anchor === End ? (v - o)
    : 0.5 * (s - o));
}

function translate(view, item, dx, dy) {
  item.x += dx;
  item.y += dy;
  item.bounds.translate(dx, dy);
  item.mark.bounds.translate(dx, dy);
  view.dirty(item);
}

function legendEntryLayout(entries) {
  // get max widths for each column
  var widths = entries.reduce((w, g) => {
    w[g.column] = Math.max(g.bounds.x2 - g.x, w[g.column] || 0);
    return w;
  }, {});

  // set dimensions of legend entry groups
  entries.forEach(g => {
    g.width  = widths[g.column];
    g.height = g.bounds.y2 - g.y;
  });
}
