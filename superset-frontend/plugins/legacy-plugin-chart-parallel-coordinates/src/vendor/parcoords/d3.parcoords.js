/* [LICENSE TBD] */
/* eslint-disable */
export default function (config) {
  var __ = {
    data: [],
    highlighted: [],
    dimensions: [],
    dimensionTitles: {},
    dimensionTitleRotation: 0,
    types: {},
    brushed: false,
    brushedColor: null,
    alphaOnBrushed: 0.0,
    mode: 'default',
    rate: 20,
    width: 600,
    height: 300,
    margin: { top: 24, right: 0, bottom: 12, left: 0 },
    nullValueSeparator: 'undefined', // set to "top" or "bottom"
    nullValueSeparatorPadding: { top: 8, right: 0, bottom: 8, left: 0 },
    color: '#069',
    composite: 'source-over',
    alpha: 0.7,
    bundlingStrength: 0.5,
    bundleDimension: null,
    smoothness: 0.0,
    showControlPoints: false,
    hideAxis: [],
  };

  extend(__, config);

  var pc = function (selection) {
    selection = pc.selection = d3.select(selection);

    __.width = selection[0][0].clientWidth;
    __.height = selection[0][0].clientHeight;

    // canvas data layers
    ['marks', 'foreground', 'brushed', 'highlight'].forEach(function (layer) {
      canvas[layer] = selection.append('canvas').attr('class', layer)[0][0];
      ctx[layer] = canvas[layer].getContext('2d');
    });

    // svg tick and brush layers
    pc.svg = selection
      .append('svg')
      .attr('width', __.width)
      .attr('height', __.height)
      .append('svg:g')
      .attr('transform', 'translate(' + __.margin.left + ',' + __.margin.top + ')');

    return pc;
  };
  var events = d3.dispatch.apply(
      this,
      ['render', 'resize', 'highlight', 'brush', 'brushend', 'axesreorder'].concat(d3.keys(__)),
    ),
    w = function () {
      return __.width - __.margin.right - __.margin.left;
    },
    h = function () {
      return __.height - __.margin.top - __.margin.bottom;
    },
    flags = {
      brushable: false,
      reorderable: false,
      axes: false,
      interactive: false,
      debug: false,
    },
    xscale = d3.scale.ordinal(),
    yscale = {},
    dragging = {},
    line = d3.svg.line(),
    axis = d3.svg.axis().orient('left').ticks(5),
    g, // groups for axes, brushes
    ctx = {},
    canvas = {},
    clusterCentroids = [];

  // side effects for setters
  var side_effects = d3.dispatch
    .apply(this, d3.keys(__))
    .on('composite', function (d) {
      ctx.foreground.globalCompositeOperation = d.value;
      ctx.brushed.globalCompositeOperation = d.value;
    })
    .on('alpha', function (d) {
      ctx.foreground.globalAlpha = d.value;
      ctx.brushed.globalAlpha = d.value;
    })
    .on('brushedColor', function (d) {
      ctx.brushed.strokeStyle = d.value;
    })
    .on('width', function (d) {
      pc.resize();
    })
    .on('height', function (d) {
      pc.resize();
    })
    .on('margin', function (d) {
      pc.resize();
    })
    .on('rate', function (d) {
      brushedQueue.rate(d.value);
      foregroundQueue.rate(d.value);
    })
    .on('dimensions', function (d) {
      xscale.domain(__.dimensions);
      if (flags.interactive) {
        pc.render().updateAxes();
      }
    })
    .on('bundleDimension', function (d) {
      if (!__.dimensions.length) pc.detectDimensions();
      if (!(__.dimensions[0] in yscale)) pc.autoscale();
      if (typeof d.value === 'number') {
        if (d.value < __.dimensions.length) {
          __.bundleDimension = __.dimensions[d.value];
        } else if (d.value < __.hideAxis.length) {
          __.bundleDimension = __.hideAxis[d.value];
        }
      } else {
        __.bundleDimension = d.value;
      }

      __.clusterCentroids = compute_cluster_centroids(__.bundleDimension);
    })
    .on('hideAxis', function (d) {
      if (!__.dimensions.length) pc.detectDimensions();
      pc.dimensions(without(__.dimensions, d.value));
    });

  // expose the state of the chart
  pc.state = __;
  pc.flags = flags;

  // create getter/setters
  getset(pc, __, events);

  // expose events
  d3.rebind(pc, events, 'on');

  // getter/setter with event firing
  function getset(obj, state, events) {
    d3.keys(state).forEach(function (key) {
      obj[key] = function (x) {
        if (!arguments.length) {
          return state[key];
        }
        var old = state[key];
        state[key] = x;
        side_effects[key].call(pc, { value: x, previous: old });
        events[key].call(pc, { value: x, previous: old });
        return obj;
      };
    });
  }

  function extend(target, source) {
    for (var key in source) {
      target[key] = source[key];
    }
    return target;
  }

  function without(arr, item) {
    return arr.filter(function (elem) {
      return item.indexOf(elem) === -1;
    });
  }
  /** adjusts an axis' default range [h()+1, 1] if a NullValueSeparator is set */
  function getRange() {
    if (__.nullValueSeparator == 'bottom') {
      return [h() + 1 - __.nullValueSeparatorPadding.bottom - __.nullValueSeparatorPadding.top, 1];
    } else if (__.nullValueSeparator == 'top') {
      return [h() + 1, 1 + __.nullValueSeparatorPadding.bottom + __.nullValueSeparatorPadding.top];
    }
    return [h() + 1, 1];
  }

  pc.autoscale = function () {
    // yscale
    var defaultScales = {
      date: function (k) {
        var extent = d3.extent(__.data, function (d) {
          return d[k] ? d[k].getTime() : null;
        });

        // special case if single value
        if (extent[0] === extent[1]) {
          return d3.scale.ordinal().domain([extent[0]]).rangePoints(getRange());
        }

        return d3.time.scale().domain(extent).range(getRange());
      },
      number: function (k) {
        var extent = d3.extent(__.data, function (d) {
          return +d[k];
        });

        // special case if single value
        if (extent[0] === extent[1]) {
          return d3.scale.ordinal().domain([extent[0]]).rangePoints(getRange());
        }

        return d3.scale.linear().domain(extent).range(getRange());
      },
      string: function (k) {
        var counts = {},
          domain = [];

        // Let's get the count for each value so that we can sort the domain based
        // on the number of items for each value.
        __.data.map(function (p) {
          if (p[k] === undefined && __.nullValueSeparator !== 'undefined') {
            return; // null values will be drawn beyond the horizontal null value separator!
          }
          if (counts[p[k]] === undefined) {
            counts[p[k]] = 1;
          } else {
            counts[p[k]] = counts[p[k]] + 1;
          }
        });

        domain = Object.getOwnPropertyNames(counts).sort(function (a, b) {
          return counts[a] - counts[b];
        });

        return d3.scale.ordinal().domain(domain).rangePoints(getRange());
      },
    };

    __.dimensions.forEach(function (k) {
      yscale[k] = defaultScales[__.types[k]](k);
    });

    __.hideAxis.forEach(function (k) {
      yscale[k] = defaultScales[__.types[k]](k);
    });

    // xscale
    xscale.rangePoints([0, w()], 1);

    // canvas sizes
    pc.selection
      .selectAll('canvas')
      .style('margin-top', __.margin.top + 'px')
      .style('margin-left', __.margin.left + 'px')
      .attr('width', w() + 2)
      .attr('height', h() + 2);

    // default styles, needs to be set when canvas width changes
    ctx.foreground.strokeStyle = __.color;
    ctx.foreground.lineWidth = 1.4;
    ctx.foreground.globalCompositeOperation = __.composite;
    ctx.foreground.globalAlpha = __.alpha;
    ctx.brushed.strokeStyle = __.brushedColor;
    ctx.brushed.lineWidth = 1.4;
    ctx.brushed.globalCompositeOperation = __.composite;
    ctx.brushed.globalAlpha = __.alpha;
    ctx.highlight.lineWidth = 3;

    return this;
  };

  pc.scale = function (d, domain) {
    yscale[d].domain(domain);

    return this;
  };

  pc.flip = function (d) {
    //yscale[d].domain().reverse();         // does not work
    yscale[d].domain(yscale[d].domain().reverse()); // works

    return this;
  };

  pc.commonScale = function (global, type) {
    var t = type || 'number';
    if (typeof global === 'undefined') {
      global = true;
    }

    // scales of the same type
    var scales = __.dimensions.concat(__.hideAxis).filter(function (p) {
      return __.types[p] == t;
    });

    if (global) {
      var extent = d3.extent(
        scales
          .map(function (p, i) {
            return yscale[p].domain();
          })
          .reduce(function (a, b) {
            return a.concat(b);
          }),
      );

      scales.forEach(function (d) {
        yscale[d].domain(extent);
      });
    } else {
      scales.forEach(function (k) {
        yscale[k].domain(
          d3.extent(__.data, function (d) {
            return +d[k];
          }),
        );
      });
    }

    // update centroids
    if (__.bundleDimension !== null) {
      pc.bundleDimension(__.bundleDimension);
    }

    return this;
  };
  pc.detectDimensions = function () {
    pc.types(pc.detectDimensionTypes(__.data));
    pc.dimensions(d3.keys(pc.types()));
    return this;
  };

  // a better "typeof" from this post: http://stackoverflow.com/questions/7390426/better-way-to-get-type-of-a-javascript-variable
  pc.toType = function (v) {
    return {}.toString
      .call(v)
      .match(/\s([a-zA-Z]+)/)[1]
      .toLowerCase();
  };

  // try to coerce to number before returning type
  pc.toTypeCoerceNumbers = function (v) {
    if (parseFloat(v) == v && v != null) {
      return 'number';
    }
    return pc.toType(v);
  };

  // attempt to determine types of each dimension based on first row of data
  pc.detectDimensionTypes = function (data) {
    var types = {};
    d3.keys(data[0]).forEach(function (col) {
      types[col] = pc.toTypeCoerceNumbers(data[0][col]);
    });
    return types;
  };
  pc.render = function () {
    // try to autodetect dimensions and create scales
    if (!__.dimensions.length) pc.detectDimensions();
    if (!(__.dimensions[0] in yscale)) pc.autoscale();

    pc.render[__.mode]();

    events.render.call(this);
    return this;
  };

  pc.renderBrushed = function () {
    if (!__.dimensions.length) pc.detectDimensions();
    if (!(__.dimensions[0] in yscale)) pc.autoscale();

    pc.renderBrushed[__.mode]();

    events.render.call(this);
    return this;
  };

  function isBrushed() {
    if (__.brushed && __.brushed.length !== __.data.length) return true;

    var object = brush.currentMode().brushState();

    for (var key in object) {
      if (object.hasOwnProperty(key)) {
        return true;
      }
    }
    return false;
  }

  pc.render.default = function () {
    pc.clear('foreground');
    pc.clear('highlight');

    pc.renderBrushed.default();

    __.data.forEach(path_foreground);
  };

  var foregroundQueue = d3
    .renderQueue(path_foreground)
    .rate(50)
    .clear(function () {
      pc.clear('foreground');
      pc.clear('highlight');
    });

  pc.render.queue = function () {
    pc.renderBrushed.queue();

    foregroundQueue(__.data);
  };

  pc.renderBrushed.default = function () {
    pc.clear('brushed');

    if (isBrushed()) {
      __.brushed.forEach(path_brushed);
    }
  };

  var brushedQueue = d3
    .renderQueue(path_brushed)
    .rate(50)
    .clear(function () {
      pc.clear('brushed');
    });

  pc.renderBrushed.queue = function () {
    if (isBrushed()) {
      brushedQueue(__.brushed);
    } else {
      brushedQueue([]); // This is needed to clear the currently brushed items
    }
  };
  function compute_cluster_centroids(d) {
    var clusterCentroids = d3.map();
    var clusterCounts = d3.map();
    // determine clusterCounts
    __.data.forEach(function (row) {
      var scaled = yscale[d](row[d]);
      if (!clusterCounts.has(scaled)) {
        clusterCounts.set(scaled, 0);
      }
      var count = clusterCounts.get(scaled);
      clusterCounts.set(scaled, count + 1);
    });

    __.data.forEach(function (row) {
      __.dimensions.map(function (p, i) {
        var scaled = yscale[d](row[d]);
        if (!clusterCentroids.has(scaled)) {
          var map = d3.map();
          clusterCentroids.set(scaled, map);
        }
        if (!clusterCentroids.get(scaled).has(p)) {
          clusterCentroids.get(scaled).set(p, 0);
        }
        var value = clusterCentroids.get(scaled).get(p);
        value += yscale[p](row[p]) / clusterCounts.get(scaled);
        clusterCentroids.get(scaled).set(p, value);
      });
    });

    return clusterCentroids;
  }

  function compute_centroids(row) {
    var centroids = [];

    var p = __.dimensions;
    var cols = p.length;
    var a = 0.5; // center between axes
    for (var i = 0; i < cols; ++i) {
      // centroids on 'real' axes
      var x = position(p[i]);
      var y = yscale[p[i]](row[p[i]]);
      centroids.push($V([x, y]));

      // centroids on 'virtual' axes
      if (i < cols - 1) {
        var cx = x + a * (position(p[i + 1]) - x);
        var cy = y + a * (yscale[p[i + 1]](row[p[i + 1]]) - y);
        if (__.bundleDimension !== null) {
          var leftCentroid = __.clusterCentroids
            .get(yscale[__.bundleDimension](row[__.bundleDimension]))
            .get(p[i]);
          var rightCentroid = __.clusterCentroids
            .get(yscale[__.bundleDimension](row[__.bundleDimension]))
            .get(p[i + 1]);
          var centroid = 0.5 * (leftCentroid + rightCentroid);
          cy = centroid + (1 - __.bundlingStrength) * (cy - centroid);
        }
        centroids.push($V([cx, cy]));
      }
    }

    return centroids;
  }

  function compute_control_points(centroids) {
    var cols = centroids.length;
    var a = __.smoothness;
    var cps = [];

    cps.push(centroids[0]);
    cps.push(
      $V([centroids[0].e(1) + a * 2 * (centroids[1].e(1) - centroids[0].e(1)), centroids[0].e(2)]),
    );
    for (var col = 1; col < cols - 1; ++col) {
      var mid = centroids[col];
      var left = centroids[col - 1];
      var right = centroids[col + 1];

      var diff = left.subtract(right);
      cps.push(mid.add(diff.x(a)));
      cps.push(mid);
      cps.push(mid.subtract(diff.x(a)));
    }
    cps.push(
      $V([
        centroids[cols - 1].e(1) + a * 2 * (centroids[cols - 2].e(1) - centroids[cols - 1].e(1)),
        centroids[cols - 1].e(2),
      ]),
    );
    cps.push(centroids[cols - 1]);

    return cps;
  }

  pc.shadows = function () {
    flags.shadows = true;
    pc.alphaOnBrushed(0.1);
    pc.render();
    return this;
  };

  // draw dots with radius r on the axis line where data intersects
  pc.axisDots = function (r) {
    var r = r || 0.1;
    var ctx = pc.ctx.marks;
    var startAngle = 0;
    var endAngle = 2 * Math.PI;
    ctx.globalAlpha = d3.min([1 / Math.pow(__.data.length, 1 / 2), 1]);
    __.data.forEach(function (d) {
      __.dimensions.map(function (p, i) {
        ctx.beginPath();
        ctx.arc(position(p), yscale[p](d[p]), r, startAngle, endAngle);
        ctx.stroke();
        ctx.fill();
      });
    });
    return this;
  };

  // draw single cubic bezier curve
  function single_curve(d, ctx) {
    var centroids = compute_centroids(d);
    var cps = compute_control_points(centroids);

    ctx.moveTo(cps[0].e(1), cps[0].e(2));
    for (var i = 1; i < cps.length; i += 3) {
      if (__.showControlPoints) {
        for (var j = 0; j < 3; j += 1) {
          ctx.fillRect(cps[i + j].e(1), cps[i + j].e(2), 2, 2);
        }
      }
      ctx.bezierCurveTo(
        cps[i].e(1),
        cps[i].e(2),
        cps[i + 1].e(1),
        cps[i + 1].e(2),
        cps[i + 2].e(1),
        cps[i + 2].e(2),
      );
    }
  }

  // draw single polyline
  function color_path(d, ctx) {
    ctx.beginPath();
    if ((__.bundleDimension !== null && __.bundlingStrength > 0) || __.smoothness > 0) {
      single_curve(d, ctx);
    } else {
      single_path(d, ctx);
    }
    ctx.stroke();
  }

  // draw many polylines of the same color
  function paths(data, ctx) {
    ctx.clearRect(-1, -1, w() + 2, h() + 2);
    ctx.beginPath();
    data.forEach(function (d) {
      if ((__.bundleDimension !== null && __.bundlingStrength > 0) || __.smoothness > 0) {
        single_curve(d, ctx);
      } else {
        single_path(d, ctx);
      }
    });
    ctx.stroke();
  }

  // returns the y-position just beyond the separating null value line
  function getNullPosition() {
    if (__.nullValueSeparator == 'bottom') {
      return h() + 1;
    } else if (__.nullValueSeparator == 'top') {
      return 1;
    } else {
      console.log(
        "A value is NULL, but nullValueSeparator is not set; set it to 'bottom' or 'top'.",
      );
    }
    return h() + 1;
  }

  function single_path(d, ctx) {
    __.dimensions.map(function (p, i) {
      if (i == 0) {
        ctx.moveTo(position(p), typeof d[p] == 'undefined' ? getNullPosition() : yscale[p](d[p]));
      } else {
        ctx.lineTo(position(p), typeof d[p] == 'undefined' ? getNullPosition() : yscale[p](d[p]));
      }
    });
  }

  function path_brushed(d, i) {
    if (__.brushedColor !== null) {
      ctx.brushed.strokeStyle = d3.functor(__.brushedColor)(d, i);
    } else {
      ctx.brushed.strokeStyle = d3.functor(__.color)(d, i);
    }
    return color_path(d, ctx.brushed);
  }

  function path_foreground(d, i) {
    ctx.foreground.strokeStyle = d3.functor(__.color)(d, i);
    return color_path(d, ctx.foreground);
  }

  function path_highlight(d, i) {
    ctx.highlight.strokeStyle = d3.functor(__.color)(d, i);
    return color_path(d, ctx.highlight);
  }
  pc.clear = function (layer) {
    ctx[layer].clearRect(0, 0, w() + 2, h() + 2);

    // This will make sure that the foreground items are transparent
    // without the need for changing the opacity style of the foreground canvas
    // as this would stop the css styling from working
    if (layer === 'brushed' && isBrushed()) {
      ctx.brushed.fillStyle = pc.selection.style('background-color');
      ctx.brushed.globalAlpha = 1 - __.alphaOnBrushed;
      ctx.brushed.fillRect(0, 0, w() + 2, h() + 2);
      ctx.brushed.globalAlpha = __.alpha;
    }
    return this;
  };

  d3.rebind(
    pc,
    axis,
    'ticks',
    'orient',
    'tickValues',
    'tickSubdivide',
    'tickSize',
    'tickPadding',
    'tickFormat',
  );

  function flipAxisAndUpdatePCP(dimension) {
    var g = pc.svg.selectAll('.dimension');

    pc.flip(dimension);

    d3.select(this.parentElement).transition().duration(1100).call(axis.scale(yscale[dimension]));

    pc.render();
  }

  function rotateLabels() {
    var delta = d3.event.deltaY;
    delta = delta < 0 ? -5 : delta;
    delta = delta > 0 ? 5 : delta;

    __.dimensionTitleRotation += delta;
    pc.svg
      .selectAll('text.label')
      .attr('transform', 'translate(0,-5) rotate(' + __.dimensionTitleRotation + ')');
    d3.event.preventDefault();
  }

  function dimensionLabels(d) {
    return d in __.dimensionTitles ? __.dimensionTitles[d] : d; // dimension display names
  }

  pc.createAxes = function () {
    if (g) pc.removeAxes();

    // Add a group element for each dimension.
    g = pc.svg
      .selectAll('.dimension')
      .data(__.dimensions, function (d) {
        return d;
      })
      .enter()
      .append('svg:g')
      .attr('class', 'dimension')
      .attr('transform', function (d) {
        return 'translate(' + xscale(d) + ')';
      });

    // Add an axis and title.
    g.append('svg:g')
      .attr('class', 'axis')
      .attr('transform', 'translate(0,0)')
      .each(function (d) {
        d3.select(this).call(axis.scale(yscale[d]));
      })
      .append('svg:text')
      .attr({
        'text-anchor': 'middle',
        y: 0,
        transform: 'translate(0,-5) rotate(' + __.dimensionTitleRotation + ')',
        x: 0,
        class: 'label',
      })
      .text(dimensionLabels)
      .on('dblclick', flipAxisAndUpdatePCP)
      .on('wheel', rotateLabels);

    if (__.nullValueSeparator == 'top') {
      pc.svg
        .append('line')
        .attr('x1', 0)
        .attr('y1', 1 + __.nullValueSeparatorPadding.top)
        .attr('x2', w())
        .attr('y2', 1 + __.nullValueSeparatorPadding.top)
        .attr('stroke-width', 1)
        .attr('stroke', '#777')
        .attr('fill', 'none')
        .attr('shape-rendering', 'crispEdges');
    } else if (__.nullValueSeparator == 'bottom') {
      pc.svg
        .append('line')
        .attr('x1', 0)
        .attr('y1', h() + 1 - __.nullValueSeparatorPadding.bottom)
        .attr('x2', w())
        .attr('y2', h() + 1 - __.nullValueSeparatorPadding.bottom)
        .attr('stroke-width', 1)
        .attr('stroke', '#777')
        .attr('fill', 'none')
        .attr('shape-rendering', 'crispEdges');
    }

    flags.axes = true;
    return this;
  };

  pc.removeAxes = function () {
    g.remove();
    return this;
  };

  pc.updateAxes = function () {
    var g_data = pc.svg.selectAll('.dimension').data(__.dimensions);

    // Enter
    g_data
      .enter()
      .append('svg:g')
      .attr('class', 'dimension')
      .attr('transform', function (p) {
        return 'translate(' + position(p) + ')';
      })
      .style('opacity', 0)
      .append('svg:g')
      .attr('class', 'axis')
      .attr('transform', 'translate(0,0)')
      .each(function (d) {
        d3.select(this).call(axis.scale(yscale[d]));
      })
      .append('svg:text')
      .attr({
        'text-anchor': 'middle',
        y: 0,
        transform: 'translate(0,-5) rotate(' + __.dimensionTitleRotation + ')',
        x: 0,
        class: 'label',
      })
      .text(dimensionLabels)
      .on('dblclick', flipAxisAndUpdatePCP)
      .on('wheel', rotateLabels);

    // Update
    g_data.attr('opacity', 0);
    g_data
      .select('.axis')
      .transition()
      .duration(1100)
      .each(function (d) {
        d3.select(this).call(axis.scale(yscale[d]));
      });
    g_data
      .select('.label')
      .transition()
      .duration(1100)
      .text(dimensionLabels)
      .attr('transform', 'translate(0,-5) rotate(' + __.dimensionTitleRotation + ')');

    // Exit
    g_data.exit().remove();

    g = pc.svg.selectAll('.dimension');
    g.transition()
      .duration(1100)
      .attr('transform', function (p) {
        return 'translate(' + position(p) + ')';
      })
      .style('opacity', 1);

    pc.svg
      .selectAll('.axis')
      .transition()
      .duration(1100)
      .each(function (d) {
        d3.select(this).call(axis.scale(yscale[d]));
      });

    if (flags.brushable) pc.brushable();
    if (flags.reorderable) pc.reorderable();
    if (pc.brushMode() !== 'None') {
      var mode = pc.brushMode();
      pc.brushMode('None');
      pc.brushMode(mode);
    }
    return this;
  };

  // Jason Davies, http://bl.ocks.org/1341281
  pc.reorderable = function () {
    if (!g) pc.createAxes();

    g.style('cursor', 'move').call(
      d3.behavior
        .drag()
        .on('dragstart', function (d) {
          dragging[d] = this.__origin__ = xscale(d);
        })
        .on('drag', function (d) {
          dragging[d] = Math.min(w(), Math.max(0, (this.__origin__ += d3.event.dx)));
          __.dimensions.sort(function (a, b) {
            return position(a) - position(b);
          });
          xscale.domain(__.dimensions);
          pc.render();
          g.attr('transform', function (d) {
            return 'translate(' + position(d) + ')';
          });
        })
        .on('dragend', function (d) {
          // Let's see if the order has changed and send out an event if so.
          var i = 0,
            j = __.dimensions.indexOf(d),
            elem = this,
            parent = this.parentElement;

          while ((elem = elem.previousElementSibling) != null) ++i;
          if (i !== j) {
            events.axesreorder.call(pc, __.dimensions);
            // We now also want to reorder the actual dom elements that represent
            // the axes. That is, the g.dimension elements. If we don't do this,
            // we get a weird and confusing transition when updateAxes is called.
            // This is due to the fact that, initially the nth g.dimension element
            // represents the nth axis. However, after a manual reordering,
            // without reordering the dom elements, the nth dom elements no longer
            // necessarily represents the nth axis.
            //
            // i is the original index of the dom element
            // j is the new index of the dom element
            if (i > j) {
              // Element moved left
              parent.insertBefore(this, parent.children[j - 1]);
            } else {
              // Element moved right
              if (j + 1 < parent.children.length) {
                parent.insertBefore(this, parent.children[j + 1]);
              } else {
                parent.appendChild(this);
              }
            }
          }

          delete this.__origin__;
          delete dragging[d];
          d3.select(this)
            .transition()
            .attr('transform', 'translate(' + xscale(d) + ')');
          pc.render();
        }),
    );
    flags.reorderable = true;
    return this;
  };

  // Reorder dimensions, such that the highest value (visually) is on the left and
  // the lowest on the right. Visual values are determined by the data values in
  // the given row.
  pc.reorder = function (rowdata) {
    var dims = __.dimensions.slice(0);
    __.dimensions.sort(function (a, b) {
      var pixelDifference = yscale[a](rowdata[a]) - yscale[b](rowdata[b]);

      // Array.sort is not necessarily stable, this means that if pixelDifference is zero
      // the ordering of dimensions might change unexpectedly. This is solved by sorting on
      // variable name in that case.
      if (pixelDifference === 0) {
        return a.localeCompare(b);
      } // else
      return pixelDifference;
    });

    // NOTE: this is relatively cheap given that:
    // number of dimensions < number of data items
    // Thus we check equality of order to prevent rerendering when this is the case.
    var reordered = false;
    dims.some(function (val, index) {
      reordered = val !== __.dimensions[index];
      return reordered;
    });

    if (reordered) {
      xscale.domain(__.dimensions);
      var highlighted = __.highlighted.slice(0);
      pc.unhighlight();

      g.transition()
        .duration(1500)
        .attr('transform', function (d) {
          return 'translate(' + xscale(d) + ')';
        });
      pc.render();

      // pc.highlight() does not check whether highlighted is length zero, so we do that here.
      if (highlighted.length !== 0) {
        pc.highlight(highlighted);
      }
    }
  };

  // pairs of adjacent dimensions
  pc.adjacent_pairs = function (arr) {
    var ret = [];
    for (var i = 0; i < arr.length - 1; i += 1) {
      ret.push([arr[i], arr[i + 1]]);
    }
    return ret;
  };

  var brush = {
    modes: {
      None: {
        install: function (pc) {}, // Nothing to be done.
        uninstall: function (pc) {}, // Nothing to be done.
        selected: function () {
          return [];
        }, // Nothing to return
        brushState: function () {
          return {};
        },
      },
    },
    mode: 'None',
    predicate: 'AND',
    currentMode: function () {
      return this.modes[this.mode];
    },
  };

  // This function can be used for 'live' updates of brushes. That is, during the
  // specification of a brush, this method can be called to update the view.
  //
  // @param newSelection - The new set of data items that is currently contained
  //                       by the brushes
  function brushUpdated(newSelection) {
    __.brushed = newSelection;
    events.brush.call(pc, __.brushed);
    pc.renderBrushed();
  }

  function brushPredicate(predicate) {
    if (!arguments.length) {
      return brush.predicate;
    }

    predicate = String(predicate).toUpperCase();
    if (predicate !== 'AND' && predicate !== 'OR') {
      throw 'Invalid predicate ' + predicate;
    }

    brush.predicate = predicate;
    __.brushed = brush.currentMode().selected();
    pc.renderBrushed();
    return pc;
  }

  pc.brushModes = function () {
    return Object.getOwnPropertyNames(brush.modes);
  };

  pc.brushMode = function (mode) {
    if (arguments.length === 0) {
      return brush.mode;
    }

    if (pc.brushModes().indexOf(mode) === -1) {
      throw 'pc.brushmode: Unsupported brush mode: ' + mode;
    }

    // Make sure that we don't trigger unnecessary events by checking if the mode
    // actually changes.
    if (mode !== brush.mode) {
      // When changing brush modes, the first thing we need to do is clearing any
      // brushes from the current mode, if any.
      if (brush.mode !== 'None') {
        pc.brushReset();
      }

      // Next, we need to 'uninstall' the current brushMode.
      brush.modes[brush.mode].uninstall(pc);
      // Finally, we can install the requested one.
      brush.mode = mode;
      brush.modes[brush.mode].install();
      if (mode === 'None') {
        delete pc.brushPredicate;
      } else {
        pc.brushPredicate = brushPredicate;
      }
    }

    return pc;
  };

  // brush mode: 1D-Axes

  (function () {
    var brushes = {};

    function is_brushed(p) {
      return !brushes[p].empty();
    }

    // data within extents
    function selected() {
      var actives = __.dimensions.filter(is_brushed),
        extents = actives.map(function (p) {
          return brushes[p].extent();
        });

      // We don't want to return the full data set when there are no axes brushed.
      // Actually, when there are no axes brushed, by definition, no items are
      // selected. So, let's avoid the filtering and just return false.
      //if (actives.length === 0) return false;

      // Resolves broken examples for now. They expect to get the full dataset back from empty brushes
      if (actives.length === 0) return __.data;

      // test if within range
      var within = {
        date: function (d, p, dimension) {
          if (typeof yscale[p].rangePoints === 'function') {
            // if it is ordinal
            return (
              extents[dimension][0] <= yscale[p](d[p]) && yscale[p](d[p]) <= extents[dimension][1]
            );
          } else {
            return extents[dimension][0] <= d[p] && d[p] <= extents[dimension][1];
          }
        },
        number: function (d, p, dimension) {
          if (typeof yscale[p].rangePoints === 'function') {
            // if it is ordinal
            return (
              extents[dimension][0] <= yscale[p](d[p]) && yscale[p](d[p]) <= extents[dimension][1]
            );
          } else {
            return extents[dimension][0] <= d[p] && d[p] <= extents[dimension][1];
          }
        },
        string: function (d, p, dimension) {
          return (
            extents[dimension][0] <= yscale[p](d[p]) && yscale[p](d[p]) <= extents[dimension][1]
          );
        },
      };

      return __.data.filter(function (d) {
        switch (brush.predicate) {
          case 'AND':
            return actives.every(function (p, dimension) {
              return within[__.types[p]](d, p, dimension);
            });
          case 'OR':
            return actives.some(function (p, dimension) {
              return within[__.types[p]](d, p, dimension);
            });
          default:
            throw 'Unknown brush predicate ' + __.brushPredicate;
        }
      });
    }

    function brushExtents(extents) {
      if (typeof extents === 'undefined') {
        var extents = {};
        __.dimensions.forEach(function (d) {
          var brush = brushes[d];
          if (brush !== undefined && !brush.empty()) {
            var extent = brush.extent();
            extent.sort(d3.ascending);
            extents[d] = extent;
          }
        });
        return extents;
      } else {
        //first get all the brush selections
        var brushSelections = {};
        g.selectAll('.brush').each(function (d) {
          brushSelections[d] = d3.select(this);
        });

        // loop over each dimension and update appropriately (if it was passed in through extents)
        __.dimensions.forEach(function (d) {
          if (extents[d] === undefined) {
            return;
          }

          var brush = brushes[d];
          if (brush !== undefined) {
            //update the extent
            brush.extent(extents[d]);

            //redraw the brush
            brush(brushSelections[d]);

            //fire some events
            brush.event(brushSelections[d]);
          }
        });

        //redraw the chart
        pc.renderBrushed();
      }
    }
    function brushFor(axis) {
      var brush = d3.svg.brush();

      brush
        .y(yscale[axis])
        .on('brushstart', function () {
          if (d3.event.sourceEvent !== null) {
            d3.event.sourceEvent.stopPropagation();
          }
        })
        .on('brush', function () {
          brushUpdated(selected());
        })
        .on('brushend', function () {
          events.brushend.call(pc, __.brushed);
        });

      brushes[axis] = brush;
      return brush;
    }
    function brushReset(dimension) {
      __.brushed = false;
      if (g) {
        g.selectAll('.brush').each(function (d) {
          d3.select(this).call(brushes[d].clear());
        });
        pc.renderBrushed();
      }
      return this;
    }

    function install() {
      if (!g) pc.createAxes();

      // Add and store a brush for each axis.
      g.append('svg:g')
        .attr('class', 'brush')
        .each(function (d) {
          d3.select(this).call(brushFor(d));
        })
        .selectAll('rect')
        .style('visibility', null)
        .attr('x', -15)
        .attr('width', 30);

      pc.brushExtents = brushExtents;
      pc.brushReset = brushReset;
      return pc;
    }

    brush.modes['1D-axes'] = {
      install: install,
      uninstall: function () {
        g.selectAll('.brush').remove();
        brushes = {};
        delete pc.brushExtents;
        delete pc.brushReset;
      },
      selected: selected,
      brushState: brushExtents,
    };
  })();
  // brush mode: 2D-strums
  // bl.ocks.org/syntagmatic/5441022

  (function () {
    var strums = {},
      strumRect;

    function drawStrum(strum, activePoint) {
      var svg = pc.selection.select('svg').select('g#strums'),
        id = strum.dims.i,
        points = [strum.p1, strum.p2],
        line = svg.selectAll('line#strum-' + id).data([strum]),
        circles = svg.selectAll('circle#strum-' + id).data(points),
        drag = d3.behavior.drag();

      line
        .enter()
        .append('line')
        .attr('id', 'strum-' + id)
        .attr('class', 'strum');

      line
        .attr('x1', function (d) {
          return d.p1[0];
        })
        .attr('y1', function (d) {
          return d.p1[1];
        })
        .attr('x2', function (d) {
          return d.p2[0];
        })
        .attr('y2', function (d) {
          return d.p2[1];
        })
        .attr('stroke', 'black')
        .attr('stroke-width', 2);

      drag
        .on('drag', function (d, i) {
          var ev = d3.event;
          i = i + 1;
          strum['p' + i][0] = Math.min(Math.max(strum.minX + 1, ev.x), strum.maxX);
          strum['p' + i][1] = Math.min(Math.max(strum.minY, ev.y), strum.maxY);
          drawStrum(strum, i - 1);
        })
        .on('dragend', onDragEnd());

      circles
        .enter()
        .append('circle')
        .attr('id', 'strum-' + id)
        .attr('class', 'strum');

      circles
        .attr('cx', function (d) {
          return d[0];
        })
        .attr('cy', function (d) {
          return d[1];
        })
        .attr('r', 5)
        .style('opacity', function (d, i) {
          return activePoint !== undefined && i === activePoint ? 0.8 : 0;
        })
        .on('mouseover', function () {
          d3.select(this).style('opacity', 0.8);
        })
        .on('mouseout', function () {
          d3.select(this).style('opacity', 0);
        })
        .call(drag);
    }

    function dimensionsForPoint(p) {
      var dims = { i: -1, left: undefined, right: undefined };
      __.dimensions.some(function (dim, i) {
        if (xscale(dim) < p[0]) {
          var next = __.dimensions[i + 1];
          dims.i = i;
          dims.left = dim;
          dims.right = next;
          return false;
        }
        return true;
      });

      if (dims.left === undefined) {
        // Event on the left side of the first axis.
        dims.i = 0;
        dims.left = __.dimensions[0];
        dims.right = __.dimensions[1];
      } else if (dims.right === undefined) {
        // Event on the right side of the last axis
        dims.i = __.dimensions.length - 1;
        dims.right = dims.left;
        dims.left = __.dimensions[__.dimensions.length - 2];
      }

      return dims;
    }

    function onDragStart() {
      // First we need to determine between which two axes the sturm was started.
      // This will determine the freedom of movement, because a strum can
      // logically only happen between two axes, so no movement outside these axes
      // should be allowed.
      return function () {
        var p = d3.mouse(strumRect[0][0]),
          dims,
          strum;

        p[0] = p[0] - __.margin.left;
        p[1] = p[1] - __.margin.top;

        (dims = dimensionsForPoint(p)),
          (strum = {
            p1: p,
            dims: dims,
            minX: xscale(dims.left),
            maxX: xscale(dims.right),
            minY: 0,
            maxY: h(),
          });

        strums[dims.i] = strum;
        strums.active = dims.i;

        // Make sure that the point is within the bounds
        strum.p1[0] = Math.min(Math.max(strum.minX, p[0]), strum.maxX);
        strum.p2 = strum.p1.slice();
      };
    }

    function onDrag() {
      return function () {
        var ev = d3.event,
          strum = strums[strums.active];

        // Make sure that the point is within the bounds
        strum.p2[0] = Math.min(Math.max(strum.minX + 1, ev.x - __.margin.left), strum.maxX);
        strum.p2[1] = Math.min(Math.max(strum.minY, ev.y - __.margin.top), strum.maxY);
        drawStrum(strum, 1);
      };
    }

    function containmentTest(strum, width) {
      var p1 = [strum.p1[0] - strum.minX, strum.p1[1] - strum.minX],
        p2 = [strum.p2[0] - strum.minX, strum.p2[1] - strum.minX],
        m1 = 1 - width / p1[0],
        b1 = p1[1] * (1 - m1),
        m2 = 1 - width / p2[0],
        b2 = p2[1] * (1 - m2);

      // test if point falls between lines
      return function (p) {
        var x = p[0],
          y = p[1],
          y1 = m1 * x + b1,
          y2 = m2 * x + b2;

        if (y > Math.min(y1, y2) && y < Math.max(y1, y2)) {
          return true;
        }

        return false;
      };
    }

    function selected() {
      var ids = Object.getOwnPropertyNames(strums),
        brushed = __.data;

      // Get the ids of the currently active strums.
      ids = ids.filter(function (d) {
        return !isNaN(d);
      });

      function crossesStrum(d, id) {
        var strum = strums[id],
          test = containmentTest(strum, strums.width(id)),
          d1 = strum.dims.left,
          d2 = strum.dims.right,
          y1 = yscale[d1],
          y2 = yscale[d2],
          point = [y1(d[d1]) - strum.minX, y2(d[d2]) - strum.minX];
        return test(point);
      }

      if (ids.length === 0) {
        return brushed;
      }

      return brushed.filter(function (d) {
        switch (brush.predicate) {
          case 'AND':
            return ids.every(function (id) {
              return crossesStrum(d, id);
            });
          case 'OR':
            return ids.some(function (id) {
              return crossesStrum(d, id);
            });
          default:
            throw 'Unknown brush predicate ' + __.brushPredicate;
        }
      });
    }

    function removeStrum() {
      var strum = strums[strums.active],
        svg = pc.selection.select('svg').select('g#strums');

      delete strums[strums.active];
      strums.active = undefined;
      svg.selectAll('line#strum-' + strum.dims.i).remove();
      svg.selectAll('circle#strum-' + strum.dims.i).remove();
    }

    function onDragEnd() {
      return function () {
        var brushed = __.data,
          strum = strums[strums.active];

        // Okay, somewhat unexpected, but not totally unsurprising, a mousclick is
        // considered a drag without move. So we have to deal with that case
        if (strum && strum.p1[0] === strum.p2[0] && strum.p1[1] === strum.p2[1]) {
          removeStrum(strums);
        }

        brushed = selected(strums);
        strums.active = undefined;
        __.brushed = brushed;
        pc.renderBrushed();
        events.brushend.call(pc, __.brushed);
      };
    }

    function brushReset(strums) {
      return function () {
        var ids = Object.getOwnPropertyNames(strums).filter(function (d) {
          return !isNaN(d);
        });

        ids.forEach(function (d) {
          strums.active = d;
          removeStrum(strums);
        });
        onDragEnd(strums)();
      };
    }

    function install() {
      var drag = d3.behavior.drag();

      // Map of current strums. Strums are stored per segment of the PC. A segment,
      // being the area between two axes. The left most area is indexed at 0.
      strums.active = undefined;
      // Returns the width of the PC segment where currently a strum is being
      // placed. NOTE: even though they are evenly spaced in our current
      // implementation, we keep for when non-even spaced segments are supported as
      // well.
      strums.width = function (id) {
        var strum = strums[id];

        if (strum === undefined) {
          return undefined;
        }

        return strum.maxX - strum.minX;
      };

      pc.on('axesreorder.strums', function () {
        var ids = Object.getOwnPropertyNames(strums).filter(function (d) {
          return !isNaN(d);
        });

        // Checks if the first dimension is directly left of the second dimension.
        function consecutive(first, second) {
          var length = __.dimensions.length;
          return __.dimensions.some(function (d, i) {
            return d === first ? i + i < length && __.dimensions[i + 1] === second : false;
          });
        }

        if (ids.length > 0) {
          // We have some strums, which might need to be removed.
          ids.forEach(function (d) {
            var dims = strums[d].dims;
            strums.active = d;
            // If the two dimensions of the current strum are not next to each other
            // any more, than we'll need to remove the strum. Otherwise we keep it.
            if (!consecutive(dims.left, dims.right)) {
              removeStrum(strums);
            }
          });
          onDragEnd(strums)();
        }
      });

      // Add a new svg group in which we draw the strums.
      pc.selection
        .select('svg')
        .append('g')
        .attr('id', 'strums')
        .attr('transform', 'translate(' + __.margin.left + ',' + __.margin.top + ')');

      // Install the required brushReset function
      pc.brushReset = brushReset(strums);

      drag
        .on('dragstart', onDragStart(strums))
        .on('drag', onDrag(strums))
        .on('dragend', onDragEnd(strums));

      // NOTE: The styling needs to be done here and not in the css. This is because
      //       for 1D brushing, the canvas layers should not listen to
      //       pointer-events.
      strumRect = pc.selection
        .select('svg')
        .insert('rect', 'g#strums')
        .attr('id', 'strum-events')
        .attr('x', __.margin.left)
        .attr('y', __.margin.top)
        .attr('width', w())
        .attr('height', h() + 2)
        .style('opacity', 0)
        .call(drag);
    }

    brush.modes['2D-strums'] = {
      install: install,
      uninstall: function () {
        pc.selection.select('svg').select('g#strums').remove();
        pc.selection.select('svg').select('rect#strum-events').remove();
        pc.on('axesreorder.strums', undefined);
        delete pc.brushReset;

        strumRect = undefined;
      },
      selected: selected,
      brushState: function () {
        return strums;
      },
    };
  })();

  // brush mode: 1D-Axes with multiple extents
  // requires d3.svg.multibrush

  (function () {
    if (typeof d3.svg.multibrush !== 'function') {
      return;
    }
    var brushes = {};

    function is_brushed(p) {
      return !brushes[p].empty();
    }

    // data within extents
    function selected() {
      var actives = __.dimensions.filter(is_brushed),
        extents = actives.map(function (p) {
          return brushes[p].extent();
        });

      // We don't want to return the full data set when there are no axes brushed.
      // Actually, when there are no axes brushed, by definition, no items are
      // selected. So, let's avoid the filtering and just return false.
      //if (actives.length === 0) return false;

      // Resolves broken examples for now. They expect to get the full dataset back from empty brushes
      if (actives.length === 0) return __.data;

      // test if within range
      var within = {
        date: function (d, p, dimension, b) {
          if (typeof yscale[p].rangePoints === 'function') {
            // if it is ordinal
            return b[0] <= yscale[p](d[p]) && yscale[p](d[p]) <= b[1];
          } else {
            return b[0] <= d[p] && d[p] <= b[1];
          }
        },
        number: function (d, p, dimension, b) {
          if (typeof yscale[p].rangePoints === 'function') {
            // if it is ordinal
            return b[0] <= yscale[p](d[p]) && yscale[p](d[p]) <= b[1];
          } else {
            return b[0] <= d[p] && d[p] <= b[1];
          }
        },
        string: function (d, p, dimension, b) {
          return b[0] <= yscale[p](d[p]) && yscale[p](d[p]) <= b[1];
        },
      };

      return __.data.filter(function (d) {
        switch (brush.predicate) {
          case 'AND':
            return actives.every(function (p, dimension) {
              return extents[dimension].some(function (b) {
                return within[__.types[p]](d, p, dimension, b);
              });
            });
          case 'OR':
            return actives.some(function (p, dimension) {
              return extents[dimension].some(function (b) {
                return within[__.types[p]](d, p, dimension, b);
              });
            });
          default:
            throw 'Unknown brush predicate ' + __.brushPredicate;
        }
      });
    }

    function brushExtents() {
      var extents = {};
      __.dimensions.forEach(function (d) {
        var brush = brushes[d];
        if (brush !== undefined && !brush.empty()) {
          var extent = brush.extent();
          extents[d] = extent;
        }
      });
      return extents;
    }

    function brushFor(axis) {
      var brush = d3.svg.multibrush();

      brush
        .y(yscale[axis])
        .on('brushstart', function () {
          if (d3.event.sourceEvent !== null) {
            d3.event.sourceEvent.stopPropagation();
          }
        })
        .on('brush', function () {
          brushUpdated(selected());
        })
        .on('brushend', function () {
          // d3.svg.multibrush clears extents just before calling 'brushend'
          // so we have to update here again.
          // This fixes issue #103 for now, but should be changed in d3.svg.multibrush
          // to avoid unnecessary computation.
          brushUpdated(selected());
          events.brushend.call(pc, __.brushed);
        })
        .extentAdaption(function (selection) {
          selection.style('visibility', null).attr('x', -15).attr('width', 30);
        })
        .resizeAdaption(function (selection) {
          selection.selectAll('rect').attr('x', -15).attr('width', 30);
        });

      brushes[axis] = brush;
      return brush;
    }

    function brushReset(dimension) {
      __.brushed = false;
      if (g) {
        g.selectAll('.brush').each(function (d) {
          d3.select(this).call(brushes[d].clear());
        });
        pc.renderBrushed();
      }
      return this;
    }

    function install() {
      if (!g) pc.createAxes();

      // Add and store a brush for each axis.
      g.append('svg:g')
        .attr('class', 'brush')
        .each(function (d) {
          d3.select(this).call(brushFor(d));
        })
        .selectAll('rect')
        .style('visibility', null)
        .attr('x', -15)
        .attr('width', 30);

      pc.brushExtents = brushExtents;
      pc.brushReset = brushReset;
      return pc;
    }

    brush.modes['1D-axes-multi'] = {
      install: install,
      uninstall: function () {
        g.selectAll('.brush').remove();
        brushes = {};
        delete pc.brushExtents;
        delete pc.brushReset;
      },
      selected: selected,
      brushState: brushExtents,
    };
  })();
  // brush mode: angular
  // code based on 2D.strums.js

  (function () {
    var arcs = {},
      strumRect;

    function drawStrum(arc, activePoint) {
      var svg = pc.selection.select('svg').select('g#arcs'),
        id = arc.dims.i,
        points = [arc.p2, arc.p3],
        line = svg.selectAll('line#arc-' + id).data([
          { p1: arc.p1, p2: arc.p2 },
          { p1: arc.p1, p2: arc.p3 },
        ]),
        circles = svg.selectAll('circle#arc-' + id).data(points),
        drag = d3.behavior.drag(),
        path = svg.selectAll('path#arc-' + id).data([arc]);

      path
        .enter()
        .append('path')
        .attr('id', 'arc-' + id)
        .attr('class', 'arc')
        .style('fill', 'orange')
        .style('opacity', 0.5);

      path.attr('d', arc.arc).attr('transform', 'translate(' + arc.p1[0] + ',' + arc.p1[1] + ')');

      line
        .enter()
        .append('line')
        .attr('id', 'arc-' + id)
        .attr('class', 'arc');

      line
        .attr('x1', function (d) {
          return d.p1[0];
        })
        .attr('y1', function (d) {
          return d.p1[1];
        })
        .attr('x2', function (d) {
          return d.p2[0];
        })
        .attr('y2', function (d) {
          return d.p2[1];
        })
        .attr('stroke', 'black')
        .attr('stroke-width', 2);

      drag
        .on('drag', function (d, i) {
          var ev = d3.event,
            angle = 0;

          i = i + 2;

          arc['p' + i][0] = Math.min(Math.max(arc.minX + 1, ev.x), arc.maxX);
          arc['p' + i][1] = Math.min(Math.max(arc.minY, ev.y), arc.maxY);

          angle = i === 3 ? arcs.startAngle(id) : arcs.endAngle(id);

          if (
            (arc.startAngle < Math.PI && arc.endAngle < Math.PI && angle < Math.PI) ||
            (arc.startAngle >= Math.PI && arc.endAngle >= Math.PI && angle >= Math.PI)
          ) {
            if (i === 2) {
              arc.endAngle = angle;
              arc.arc.endAngle(angle);
            } else if (i === 3) {
              arc.startAngle = angle;
              arc.arc.startAngle(angle);
            }
          }

          drawStrum(arc, i - 2);
        })
        .on('dragend', onDragEnd());

      circles
        .enter()
        .append('circle')
        .attr('id', 'arc-' + id)
        .attr('class', 'arc');

      circles
        .attr('cx', function (d) {
          return d[0];
        })
        .attr('cy', function (d) {
          return d[1];
        })
        .attr('r', 5)
        .style('opacity', function (d, i) {
          return activePoint !== undefined && i === activePoint ? 0.8 : 0;
        })
        .on('mouseover', function () {
          d3.select(this).style('opacity', 0.8);
        })
        .on('mouseout', function () {
          d3.select(this).style('opacity', 0);
        })
        .call(drag);
    }

    function dimensionsForPoint(p) {
      var dims = { i: -1, left: undefined, right: undefined };
      __.dimensions.some(function (dim, i) {
        if (xscale(dim) < p[0]) {
          var next = __.dimensions[i + 1];
          dims.i = i;
          dims.left = dim;
          dims.right = next;
          return false;
        }
        return true;
      });

      if (dims.left === undefined) {
        // Event on the left side of the first axis.
        dims.i = 0;
        dims.left = __.dimensions[0];
        dims.right = __.dimensions[1];
      } else if (dims.right === undefined) {
        // Event on the right side of the last axis
        dims.i = __.dimensions.length - 1;
        dims.right = dims.left;
        dims.left = __.dimensions[__.dimensions.length - 2];
      }

      return dims;
    }

    function onDragStart() {
      // First we need to determine between which two axes the arc was started.
      // This will determine the freedom of movement, because a arc can
      // logically only happen between two axes, so no movement outside these axes
      // should be allowed.
      return function () {
        var p = d3.mouse(strumRect[0][0]),
          dims,
          arc;

        p[0] = p[0] - __.margin.left;
        p[1] = p[1] - __.margin.top;

        (dims = dimensionsForPoint(p)),
          (arc = {
            p1: p,
            dims: dims,
            minX: xscale(dims.left),
            maxX: xscale(dims.right),
            minY: 0,
            maxY: h(),
            startAngle: undefined,
            endAngle: undefined,
            arc: d3.svg.arc().innerRadius(0),
          });

        arcs[dims.i] = arc;
        arcs.active = dims.i;

        // Make sure that the point is within the bounds
        arc.p1[0] = Math.min(Math.max(arc.minX, p[0]), arc.maxX);
        arc.p2 = arc.p1.slice();
        arc.p3 = arc.p1.slice();
      };
    }

    function onDrag() {
      return function () {
        var ev = d3.event,
          arc = arcs[arcs.active];

        // Make sure that the point is within the bounds
        arc.p2[0] = Math.min(Math.max(arc.minX + 1, ev.x - __.margin.left), arc.maxX);
        arc.p2[1] = Math.min(Math.max(arc.minY, ev.y - __.margin.top), arc.maxY);
        arc.p3 = arc.p2.slice();
        drawStrum(arc, 1);
      };
    }

    // some helper functions
    function hypothenuse(a, b) {
      return Math.sqrt(a * a + b * b);
    }

    var rad = (function () {
      var c = Math.PI / 180;
      return function (angle) {
        return angle * c;
      };
    })();

    var deg = (function () {
      var c = 180 / Math.PI;
      return function (angle) {
        return angle * c;
      };
    })();

    // [0, 2*PI] -> [-PI/2, PI/2]
    var signedAngle = function (angle) {
      var ret = angle;
      if (angle > Math.PI) {
        ret = angle - 1.5 * Math.PI;
        ret = angle - 1.5 * Math.PI;
      } else {
        ret = angle - 0.5 * Math.PI;
        ret = angle - 0.5 * Math.PI;
      }
      return -ret;
    };

    /**
     * angles are stored in radians from in [0, 2*PI], where 0 in 12 o'clock.
     * However, one can only select lines from 0 to PI, so we compute the
     * 'signed' angle, where 0 is the horizontal line (3 o'clock), and +/- PI/2
     * are 12 and 6 o'clock respectively.
     */
    function containmentTest(arc) {
      var startAngle = signedAngle(arc.startAngle);
      var endAngle = signedAngle(arc.endAngle);

      if (startAngle > endAngle) {
        var tmp = startAngle;
        startAngle = endAngle;
        endAngle = tmp;
      }

      // test if segment angle is contained in angle interval
      return function (a) {
        if (a >= startAngle && a <= endAngle) {
          return true;
        }

        return false;
      };
    }

    function selected() {
      var ids = Object.getOwnPropertyNames(arcs),
        brushed = __.data;

      // Get the ids of the currently active arcs.
      ids = ids.filter(function (d) {
        return !isNaN(d);
      });

      function crossesStrum(d, id) {
        var arc = arcs[id],
          test = containmentTest(arc),
          d1 = arc.dims.left,
          d2 = arc.dims.right,
          y1 = yscale[d1],
          y2 = yscale[d2],
          a = arcs.width(id),
          b = y1(d[d1]) - y2(d[d2]),
          c = hypothenuse(a, b),
          angle = Math.asin(b / c); // rad in [-PI/2, PI/2]
        return test(angle);
      }

      if (ids.length === 0) {
        return brushed;
      }

      return brushed.filter(function (d) {
        switch (brush.predicate) {
          case 'AND':
            return ids.every(function (id) {
              return crossesStrum(d, id);
            });
          case 'OR':
            return ids.some(function (id) {
              return crossesStrum(d, id);
            });
          default:
            throw 'Unknown brush predicate ' + __.brushPredicate;
        }
      });
    }

    function removeStrum() {
      var arc = arcs[arcs.active],
        svg = pc.selection.select('svg').select('g#arcs');

      delete arcs[arcs.active];
      arcs.active = undefined;
      svg.selectAll('line#arc-' + arc.dims.i).remove();
      svg.selectAll('circle#arc-' + arc.dims.i).remove();
      svg.selectAll('path#arc-' + arc.dims.i).remove();
    }

    function onDragEnd() {
      return function () {
        var brushed = __.data,
          arc = arcs[arcs.active];

        // Okay, somewhat unexpected, but not totally unsurprising, a mousclick is
        // considered a drag without move. So we have to deal with that case
        if (arc && arc.p1[0] === arc.p2[0] && arc.p1[1] === arc.p2[1]) {
          removeStrum(arcs);
        }

        if (arc) {
          var angle = arcs.startAngle(arcs.active);

          arc.startAngle = angle;
          arc.endAngle = angle;
          arc.arc.outerRadius(arcs.length(arcs.active)).startAngle(angle).endAngle(angle);
        }

        brushed = selected(arcs);
        arcs.active = undefined;
        __.brushed = brushed;
        pc.renderBrushed();
        events.brushend.call(pc, __.brushed);
      };
    }

    function brushReset(arcs) {
      return function () {
        var ids = Object.getOwnPropertyNames(arcs).filter(function (d) {
          return !isNaN(d);
        });

        ids.forEach(function (d) {
          arcs.active = d;
          removeStrum(arcs);
        });
        onDragEnd(arcs)();
      };
    }

    function install() {
      var drag = d3.behavior.drag();

      // Map of current arcs. arcs are stored per segment of the PC. A segment,
      // being the area between two axes. The left most area is indexed at 0.
      arcs.active = undefined;
      // Returns the width of the PC segment where currently a arc is being
      // placed. NOTE: even though they are evenly spaced in our current
      // implementation, we keep for when non-even spaced segments are supported as
      // well.
      arcs.width = function (id) {
        var arc = arcs[id];

        if (arc === undefined) {
          return undefined;
        }

        return arc.maxX - arc.minX;
      };

      // returns angles in [-PI/2, PI/2]
      angle = function (p1, p2) {
        var a = p1[0] - p2[0],
          b = p1[1] - p2[1],
          c = hypothenuse(a, b);

        return Math.asin(b / c);
      };

      // returns angles in [0, 2 * PI]
      arcs.endAngle = function (id) {
        var arc = arcs[id];
        if (arc === undefined) {
          return undefined;
        }
        var sAngle = angle(arc.p1, arc.p2),
          uAngle = -sAngle + Math.PI / 2;

        if (arc.p1[0] > arc.p2[0]) {
          uAngle = 2 * Math.PI - uAngle;
        }

        return uAngle;
      };

      arcs.startAngle = function (id) {
        var arc = arcs[id];
        if (arc === undefined) {
          return undefined;
        }

        var sAngle = angle(arc.p1, arc.p3),
          uAngle = -sAngle + Math.PI / 2;

        if (arc.p1[0] > arc.p3[0]) {
          uAngle = 2 * Math.PI - uAngle;
        }

        return uAngle;
      };

      arcs.length = function (id) {
        var arc = arcs[id];

        if (arc === undefined) {
          return undefined;
        }

        var a = arc.p1[0] - arc.p2[0],
          b = arc.p1[1] - arc.p2[1],
          c = hypothenuse(a, b);

        return c;
      };

      pc.on('axesreorder.arcs', function () {
        var ids = Object.getOwnPropertyNames(arcs).filter(function (d) {
          return !isNaN(d);
        });

        // Checks if the first dimension is directly left of the second dimension.
        function consecutive(first, second) {
          var length = __.dimensions.length;
          return __.dimensions.some(function (d, i) {
            return d === first ? i + i < length && __.dimensions[i + 1] === second : false;
          });
        }

        if (ids.length > 0) {
          // We have some arcs, which might need to be removed.
          ids.forEach(function (d) {
            var dims = arcs[d].dims;
            arcs.active = d;
            // If the two dimensions of the current arc are not next to each other
            // any more, than we'll need to remove the arc. Otherwise we keep it.
            if (!consecutive(dims.left, dims.right)) {
              removeStrum(arcs);
            }
          });
          onDragEnd(arcs)();
        }
      });

      // Add a new svg group in which we draw the arcs.
      pc.selection
        .select('svg')
        .append('g')
        .attr('id', 'arcs')
        .attr('transform', 'translate(' + __.margin.left + ',' + __.margin.top + ')');

      // Install the required brushReset function
      pc.brushReset = brushReset(arcs);

      drag
        .on('dragstart', onDragStart(arcs))
        .on('drag', onDrag(arcs))
        .on('dragend', onDragEnd(arcs));

      // NOTE: The styling needs to be done here and not in the css. This is because
      //       for 1D brushing, the canvas layers should not listen to
      //       pointer-events.
      strumRect = pc.selection
        .select('svg')
        .insert('rect', 'g#arcs')
        .attr('id', 'arc-events')
        .attr('x', __.margin.left)
        .attr('y', __.margin.top)
        .attr('width', w())
        .attr('height', h() + 2)
        .style('opacity', 0)
        .call(drag);
    }

    brush.modes['angular'] = {
      install: install,
      uninstall: function () {
        pc.selection.select('svg').select('g#arcs').remove();
        pc.selection.select('svg').select('rect#arc-events').remove();
        pc.on('axesreorder.arcs', undefined);
        delete pc.brushReset;

        strumRect = undefined;
      },
      selected: selected,
      brushState: function () {
        return arcs;
      },
    };
  })();

  pc.interactive = function () {
    flags.interactive = true;
    return this;
  };

  // expose a few objects
  pc.xscale = xscale;
  pc.yscale = yscale;
  pc.ctx = ctx;
  pc.canvas = canvas;
  pc.g = function () {
    return g;
  };

  // rescale for height, width and margins
  // TODO currently assumes chart is brushable, and destroys old brushes
  pc.resize = function () {
    // selection size
    pc.selection.select('svg').attr('width', __.width).attr('height', __.height);
    pc.svg.attr('transform', 'translate(' + __.margin.left + ',' + __.margin.top + ')');

    // FIXME: the current brush state should pass through
    if (flags.brushable) pc.brushReset();

    // scales
    pc.autoscale();

    // axes, destroys old brushes.
    if (g) pc.createAxes();
    if (flags.brushable) pc.brushable();
    if (flags.reorderable) pc.reorderable();

    events.resize.call(this, { width: __.width, height: __.height, margin: __.margin });
    return this;
  };

  // highlight an array of data
  pc.highlight = function (data) {
    if (arguments.length === 0) {
      return __.highlighted;
    }

    __.highlighted = data;
    pc.clear('highlight');
    d3.selectAll([canvas.foreground, canvas.brushed]).classed('faded', true);
    data.forEach(path_highlight);
    events.highlight.call(this, data);
    return this;
  };

  // clear highlighting
  pc.unhighlight = function () {
    __.highlighted = [];
    pc.clear('highlight');
    d3.selectAll([canvas.foreground, canvas.brushed]).classed('faded', false);
    return this;
  };

  // calculate 2d intersection of line a->b with line c->d
  // points are objects with x and y properties
  pc.intersection = function (a, b, c, d) {
    return {
      x:
        ((a.x * b.y - a.y * b.x) * (c.x - d.x) - (a.x - b.x) * (c.x * d.y - c.y * d.x)) /
        ((a.x - b.x) * (c.y - d.y) - (a.y - b.y) * (c.x - d.x)),
      y:
        ((a.x * b.y - a.y * b.x) * (c.y - d.y) - (a.y - b.y) * (c.x * d.y - c.y * d.x)) /
        ((a.x - b.x) * (c.y - d.y) - (a.y - b.y) * (c.x - d.x)),
    };
  };

  function position(d) {
    var v = dragging[d];
    return v == null ? xscale(d) : v;
  }
  pc.version = '0.7.0';
  // this descriptive text should live with other introspective methods
  pc.toString = function () {
    return (
      'Parallel Coordinates: ' +
      __.dimensions.length +
      ' dimensions (' +
      d3.keys(__.data[0]).length +
      ' total) , ' +
      __.data.length +
      ' rows'
    );
  };

  return pc;
}

d3.renderQueue = function (func) {
  var _queue = [], // data to be rendered
    _rate = 10, // number of calls per frame
    _clear = function () {}, // clearing function
    _i = 0; // current iteration

  var rq = function (data) {
    if (data) rq.data(data);
    rq.invalidate();
    _clear();
    rq.render();
  };

  rq.render = function () {
    _i = 0;
    var valid = true;
    rq.invalidate = function () {
      valid = false;
    };

    function doFrame() {
      if (!valid) return true;
      if (_i > _queue.length) return true;

      // Typical d3 behavior is to pass a data item *and* its index. As the
      // render queue splits the original data set, we'll have to be slightly
      // more carefull about passing the correct index with the data item.
      var end = Math.min(_i + _rate, _queue.length);
      for (var i = _i; i < end; i += 1) {
        func(_queue[i], i);
      }
      _i += _rate;
    }

    d3.timer(doFrame);
  };

  rq.data = function (data) {
    rq.invalidate();
    _queue = data.slice(0);
    return rq;
  };

  rq.rate = function (value) {
    if (!arguments.length) return _rate;
    _rate = value;
    return rq;
  };

  rq.remaining = function () {
    return _queue.length - _i;
  };

  // clear the canvas
  rq.clear = function (func) {
    if (!arguments.length) {
      _clear();
      return rq;
    }
    _clear = func;
    return rq;
  };

  rq.invalidate = function () {};

  return rq;
};
