import {
  AxisRole, Bottom, ColFooter, ColHeader, ColTitle,
  Fit, FitX, FitY, FrameRole, Left, LegendRole,
  None, Pad, Padding, Right,
  RowFooter, RowHeader, RowTitle, ScopeRole, TitleRole, Top
} from './constants';

import {axisLayout, isYAxis} from './layout/axis';
import {gridLayout, trellisLayout} from './layout/grid';
import {legendLayout, legendParams} from './layout/legend';
import {titleLayout} from './layout/title';

import {Transform} from 'vega-dataflow';
import {Bounds} from 'vega-scenegraph';
import {inherits} from 'vega-util';

/**
 * Layout view elements such as axes and legends.
 * Also performs size adjustments.
 * @constructor
 * @param {object} params - The parameters for this operator.
 * @param {object} params.mark - Scenegraph mark of groups to layout.
 */
export default function ViewLayout(params) {
  Transform.call(this, null, params);
}

var prototype = inherits(ViewLayout, Transform);

prototype.transform = function(_, pulse) {
  var view = pulse.dataflow;
  _.mark.items.forEach(group => {
    if (_.layout) trellisLayout(view, group, _.layout);
    layoutGroup(view, group, _);
  });
  return shouldReflow(_.mark.group) ? pulse.reflow() : pulse;
};

function shouldReflow(group) {
  // We typically should reflow if layout is invoked (#2568), as child items
  // may have resized and reflow ensures group bounds are re-calculated.
  // However, legend entries have a special exception to avoid instability.
  // For example, if a selected legend symbol gains a stroke on hover,
  // we don't want to re-position subsequent elements in the legend.
  return group && group.mark.role !== 'legend-entry';
}

function layoutGroup(view, group, _) {
  var items = group.items,
      width = Math.max(0, group.width || 0),
      height = Math.max(0, group.height || 0),
      viewBounds = new Bounds().set(0, 0, width, height),
      xBounds = viewBounds.clone(),
      yBounds = viewBounds.clone(),
      legends = [], title,
      mark, orient, b, i, n;

  // layout axes, gather legends, collect bounds
  for (i=0, n=items.length; i<n; ++i) {
    mark = items[i];
    switch (mark.role) {
      case AxisRole:
        b = isYAxis(mark) ? xBounds : yBounds;
        b.union(axisLayout(view, mark, width, height));
        break;
      case TitleRole:
        title = mark;
        break;
      case LegendRole:
        legends.push(legendLayout(view, mark));
        break;
      case FrameRole:
      case ScopeRole:
      case RowHeader:
      case RowFooter:
      case RowTitle:
      case ColHeader:
      case ColFooter:
      case ColTitle:
        xBounds.union(mark.bounds);
        yBounds.union(mark.bounds);
        break;
      default:
        viewBounds.union(mark.bounds);
    }
  }

  // layout legends, adjust viewBounds
  if (legends.length) {
    // group legends by orient
    const l = {};
    legends.forEach(item => {
      orient = item.orient || Right;
      if (orient !== None) (l[orient] || (l[orient] = [])).push(item);
    });

    // perform grid layout for each orient group
    for (let orient in l) {
      const g = l[orient];
      gridLayout(view, g, legendParams(
        g, orient, _.legends, xBounds, yBounds, width, height
      ));
    }

    // update view bounds
    legends.forEach(item => {
      const b = item.bounds;

      if (!b.equals(item._bounds)) {
        item.bounds = item._bounds;
        view.dirty(item); // dirty previous location
        item.bounds = b;
        view.dirty(item);
      }

      if (_.autosize && _.autosize.type === Fit) {
        // For autosize fit, incorporate the orthogonal dimension only.
        // Legends that overrun the chart area will then be clipped;
        // otherwise the chart area gets reduced to nothing!
        switch(item.orient) {
          case Left:
          case Right:
            viewBounds.add(b.x1, 0).add(b.x2, 0);
            break;
          case Top:
          case Bottom:
            viewBounds.add(0, b.y1).add(0, b.y2);
        }
      } else {
        viewBounds.union(b);
      }
    });
  }

  // combine bounding boxes
  viewBounds.union(xBounds).union(yBounds);

  // layout title, adjust bounds
  if (title) {
    viewBounds.union(titleLayout(view, title, width, height, viewBounds));
  }

  // override aggregated view bounds if content is clipped
  if (group.clip) {
    viewBounds.set(0, 0, group.width || 0, group.height || 0);
  }

  // perform size adjustment
  viewSizeLayout(view, group, viewBounds, _);
}

function viewSizeLayout(view, group, viewBounds, _) {
  const auto = _.autosize || {},
        type = auto.type;

  if (view._autosize < 1 || !type) return;

  let viewWidth = view._width,
      viewHeight = view._height,
      width  = Math.max(0, group.width || 0),
      left   = Math.max(0, Math.ceil(-viewBounds.x1)),
      right  = Math.max(0, Math.ceil(viewBounds.x2 - width)),
      height = Math.max(0, group.height || 0),
      top    = Math.max(0, Math.ceil(-viewBounds.y1)),
      bottom = Math.max(0, Math.ceil(viewBounds.y2 - height));

  if (auto.contains === Padding) {
    const padding = view.padding();
    viewWidth -= padding.left + padding.right;
    viewHeight -= padding.top + padding.bottom;
  }

  if (type === None) {
    left = 0;
    top = 0;
    width = viewWidth;
    height = viewHeight;
  }

  else if (type === Fit) {
    width = Math.max(0, viewWidth - left - right);
    height = Math.max(0, viewHeight - top - bottom);
  }

  else if (type === FitX) {
    width = Math.max(0, viewWidth - left - right);
    viewHeight = height + top + bottom;
  }

  else if (type === FitY) {
    viewWidth = width + left + right;
    height = Math.max(0, viewHeight - top - bottom);
  }

  else if (type === Pad) {
    viewWidth = width + left + right;
    viewHeight = height + top + bottom;
  }

  view._resizeView(
    viewWidth, viewHeight,
    width, height,
    [left, top],
    auto.resize
  );
}
