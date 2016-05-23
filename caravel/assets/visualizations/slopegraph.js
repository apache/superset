/**
 * @TODO
 *  -- add brushing?
 */

const d3 = require('d3');
const cv = require('../javascripts/modules/caravel.js');
require('./slopegraph.css');

// class constants
const CLASS_BACKGROUND        = 'slopegraph__background';
const CLASS_BACKGROUND_PATH   = 'slopegraph__background__path';

const CLASS_FOREGROUND        = 'slopegraph__foreground';
const CLASS_FOREGROUND_G      = 'slopegraph__foreground__g';
const CLASS_FOREGROUND_PATH   = 'slopegraph__foreground__g__path';
const CLASS_FOREGROUND_CIRCLE = 'slopegraph__foreground__g__circle';
const CLASS_FOREGROUND_CATEGORY = 'slopegraph__foreground__g__category';
const CLASS_FOREGROUND_VALUE    = 'slopegraph__foreground__g__value';

const CLASS_CATEGORY_AXES     = 'slopegraph__axes';
const CLASS_CATEGORY_AXES_G   = 'slopegraph__axes__g';
const CLASS_CATEGORY_AXES_LABEL = 'slopegraph__axes__g__label';

const CLASS_VORONOI = 'slopegraph__voronoi';

// vis variable constants
const TRANSITION_IN_DURATION_MS = 0;
const TRANSITION_OUT_DURATION_MS = 0;
const CIRCLE_RADIUS = 5;
const DEFAULT_FORMATTER = d3.format('.4s');

function slopeGraphFactory() {
  let slopeGraph = {};
  /**
   * Scaffolding
   */
  slopeGraph.create = function(container, props) {
    // Define vis DOM structure
    this._container = container;
    this._svg = d3.select(container).append('svg');
    this._g = this._svg.append('g');
    this._background = this._g.append('g').attr('class', CLASS_BACKGROUND);
    this._axes = this._g.append('g').attr('class', CLASS_CATEGORY_AXES);
    this._foreground = this._g.append('g').attr('class', CLASS_FOREGROUND);
    this._voronoi = this._g.append('g').attr('class', CLASS_VORONOI)

    // Define scales, axes, path generators, etc.
    this._lineGenerator = d3.svg.line();
    this._categoryScale = d3.scale.ordinal();
    this._numericScale = null;
    this._numericAxis = d3.svg.axis().orient('left').ticks(0).tickSize(0);
    this._voronoiGeom = d3.geom.voronoi(); // used for mouse events

    this.update(props);
  };

  /**
   * everything that needs to be updated when props change happens here.
   * and maybe more.
   * pattern: enter, exit, update
   */
  slopeGraph.update = function(props) {
    this._props = props;
    this._data = props.data;
    this.updateContainer(props);
    this.updateScales(props);
    this.updateAxes(props);
    this.updateBackground(props);
    this.updateForeground(props);
    this.updateMouseEventLayer(props);
  };
  /**
   * Updates for different layers, etc.
   */
  slopeGraph.updateContainer = function(props) {
    const { width, height, margin } = props;

    // Update DOM
    this._svg
      .attr('width', width)
      .attr('height', height);

    this._g
      .attr('transform', `translate(${margin.left},${margin.top})`);
  };

  slopeGraph.updateScales = function(props) {
    const {
      category1,
      category2,
      data,
      domain: _domain,
      formatter: _formatter,
      height,
      margin,
      range: _range,
      scaleType,
      width,
    } = props;

    const innerWidth  = width  - margin.left - margin.right;
    const innerHeight = height - margin.top  - margin.bottom;

    // Update ordinal scales
    const categories = [category1, category2];
    this._categoryScale
      .domain(categories)
      .rangePoints([0, innerWidth], 1);

    // Update numeric scales
    const range  = _range  || [innerHeight, 0];
    const domain = _domain || [
      d3.min(data, d => Math.min(d[category1], d[category2])),
      d3.max(data, d => Math.max(d[category1], d[category2]))
    ];

    this._numericScale = d3.scale.linear()
      .domain(domain)
      .range(range);

    this._numericAxis.scale(this._numericScale);

    // position helpers
    this._getX = (category) => {
      return this._categoryScale(category);
    };

    this._getY = (datum, category) => {
      return this._numericScale( datum[category] );
    };

    this._getScaledCoords = (datum) => {
      return [
        [ this._getX(category1), this._getY(datum, category1) ],
        [ this._getX(category2), this._getY(datum, category2) ],
      ];
    };

    // generates a 2-point path "d" attr for a given datum. depends on getX/getY
    this._pathGenerator = (d) => {
      const coords = this._getScaledCoords(d);
      return this._lineGenerator(coords);
    };
  };

  slopeGraph.updateAxes = function(props) {
    const {
      category1,
      category2,
      height,
      margin
    } = props;

    const innerHeight = height - margin.top - margin.bottom;

    const axesG = this._axes
      .selectAll(`.${CLASS_CATEGORY_AXES_G}`)
      .data([category1, category2]);

    axesG.exit().remove();

    axesG.enter().append("g")
      .attr('class', CLASS_CATEGORY_AXES_G)
     .append("text")
      .attr('class', (d,i) => `${CLASS_CATEGORY_AXES_LABEL}-${i}`)
      .style("text-anchor", "middle")
      .attr("y", innerHeight + 25)
      .text(function (d) { return d; });

    axesG
      .attr("transform", d => `translate(${this._categoryScale(d)})`)
      .call(this._numericAxis);
  };

  slopeGraph.updateBackground = function (props) {
    const { data } = props;

    const backgroundG = this._background
      .selectAll(`.${CLASS_BACKGROUND_PATH}`)
      .data(data.filter(d => !d.emphasis), (d,i) => {
        return typeof d.id === 'undefined' ? i: d.id;
      });

    backgroundG.exit().remove();
    backgroundG.enter().append('path').attr('class', CLASS_BACKGROUND_PATH);

    backgroundG.transition()
      .duration(TRANSITION_IN_DURATION_MS)
      .attr('d', this._pathGenerator);
  };

  slopeGraph.updateForeground = function (props) {
    const {
      category1,
      category2,
      data,
      label,
      formatter: _formatter
    } = props;

    const formatter = _formatter || DEFAULT_FORMATTER;

    const foregroundG = this._foreground
      .selectAll(`.${CLASS_FOREGROUND_G}`)
      .data(data.filter(d => d.emphasis), (d,i) => {
        return typeof d.id === 'undefined' ? i: d.id;
      });

    foregroundG.exit()
     .transition().duration(TRANSITION_OUT_DURATION_MS)
      .style('opacity', 0)
      .remove();

    const enteringForegroundG = foregroundG
     .enter().append('g')
      .attr('class', CLASS_FOREGROUND_G);

    enteringForegroundG.append('path')
      .attr('class', CLASS_FOREGROUND_PATH);

    enteringForegroundG.append('circle')
      .attr('class', `${CLASS_FOREGROUND_CIRCLE}0`);
    enteringForegroundG.append('circle')
      .attr('class', `${CLASS_FOREGROUND_CIRCLE}1`);

    enteringForegroundG.append('text')
      .attr('class', `${CLASS_FOREGROUND_CATEGORY}0`)
      .attr('text-anchor', 'end');
    enteringForegroundG.append('text')
      .attr('class', `${CLASS_FOREGROUND_VALUE}0`)
      .attr('text-anchor', 'end');
    enteringForegroundG.append('text')
      .attr('class', `${CLASS_FOREGROUND_VALUE}1`)
      .attr('text-anchor', 'start');

    // line
    foregroundG.selectAll(`.${CLASS_FOREGROUND_PATH}`)
      .attr('stroke', d => d.color || null)
     .transition().duration(TRANSITION_IN_DURATION_MS)
      .attr('d', this._pathGenerator);

    // labels
    foregroundG.selectAll(`.${CLASS_FOREGROUND_CATEGORY}0`)
      .attr('fill', d => d.color || null)
     .transition().duration(TRANSITION_IN_DURATION_MS)
      .attr('x', (d) => this._getX(category1))
      .attr('y', (d) => this._getY(d, category1) )
      .attr('dx', -65)
      .attr('dy', 3)
      .text(d => label && label(d) || '');

    foregroundG.selectAll(`.${CLASS_FOREGROUND_VALUE}0`)
      .attr('fill', d => d.color || null)
     .transition().duration(TRANSITION_IN_DURATION_MS)
      .attr('x', (d) => this._getX(category1))
      .attr('y', (d) => this._getY(d, category1) )
      .attr('dx', -10)
      .attr('dy', 3)
      .text(d => formatter( d[category1] ));

    foregroundG.selectAll(`.${CLASS_FOREGROUND_VALUE}1`)
      .attr('fill', d => d.color || null)
     .transition().duration(TRANSITION_IN_DURATION_MS)
      .attr('x', (d) => this._getX(category2))
      .attr('y', (d) => this._getY(d, category2) )
      .attr('dx', +10)
      .attr('dy', 3)
      .text(d => formatter( d[category2] ));

    // circles
    foregroundG.selectAll(`.${CLASS_FOREGROUND_CIRCLE}0`)
      .attr('fill', d => d.color || null)
     .transition().duration(TRANSITION_IN_DURATION_MS)
      .attr('cx', (d) => this._getX(category1) )
      .attr('cy', (d) => this._getY(d, category1) )
      .attr('r', CIRCLE_RADIUS);

    foregroundG.selectAll(`.${CLASS_FOREGROUND_CIRCLE}1`)
      .attr('fill', d => d.color || null)
     .transition().duration(TRANSITION_IN_DURATION_MS)
      .attr('cx', (d) => this._getX(category2) )
      .attr('cy', (d) => this._getY(d, category2) )
      .attr('r', CIRCLE_RADIUS);
  };

  slopeGraph.updateMouseEventLayer = function(props) {
    const {
      data,
      width,
      height,
      margin,
      // onMouseOver,
      // onMouseOut,
      // onClick
    } = props;

    const innerWidth  = width  - margin.left - margin.right;
    const innerHeight = height - margin.top  - margin.bottom;

    // voronoi tesslation
    this._voronoiGeom
      .x(d => d.values && d.values.coords[0])
      .y(d => d.values && d.values.coords[1])
      .clipExtent([[0,0], [innerWidth, innerHeight]]); // [​[x0, y0], [x1, y1]​]

    const voronoiData = d3.nest()
      .key(d => {
          const [x, y] = d.coords;
          return `${x},${y}`; // key on scaled 'x,y'
        })
      .rollup(v => v[0])
      .entries(d3.merge(
        data.map((datum, i) => {
          const [coords0, coords1] = this._getScaledCoords(datum);
          return [
            { id: datum.id, lock: datum.lock, coords: coords0 },
            { id: datum.id, lock: datum.lock, coords: coords1 }
          ]; // return two values for each datum so every point has a voronoi
        })
      ));

    const voronoiPaths = this._voronoi.selectAll("path")
      .data(this._voronoiGeom(voronoiData));
      // ^these are arrays of polgygons, each polygon is an array of points,
      //  each point is a 2-element array of x and y positions [ [[xi,yi], ...points ], ..polygons]

    voronoiPaths.exit().remove();
    voronoiPaths.enter().append("path");
    voronoiPaths
      .attr("d", function(d) { return "M" + d.join("L") + "Z"; }) // creates svg polygon paths
      .datum(function(d) { return d.point; }); // defines the data returned to listeners,
                                               // here the point object (defined in dataForVoronoi)
                                               // closest to this voronoi
    voronoiPaths.on("mouseover", d => {
      if (d.values) {
        this.toggleEmphasis({ id: d.values.id, emphasis: true });
      }
    });
    voronoiPaths.on("mouseout", d => {
      if (d.values) {
        this.toggleEmphasis({ id: d.values.id, emphasis: false });
      }
    });
    voronoiPaths.on("click", d => {
      if (d.values) {
        this.toggleLock({ id: d.values.id });
      }
    });
  };

  /**
   * Clean up
   */
  slopeGraph.destroy = function () {
    d3.select(this._container).selectAll("*").remove();
  };

  slopeGraph.toggleEmphasis = function(payload) {
    const {
      emphasis,
      id,
    } = payload;

    const idx = this._data.findIndex(d => d.id === id);
    const d = this._data[idx];

    if (idx !== -1 && !d.lock) {
      const nextEmphasis = typeof emphasis !== 'undefined' ?
                          emphasis : (!d.emphasis);
      d.emphasis = nextEmphasis;

      this.updateBackground(this._props);
      this.updateForeground(this._props);
    }
  };

  slopeGraph.toggleLock = function(payload) {
    const {
      lock,
      id,
    } = payload;

    const idx = this._data.findIndex(d => d.id === id);
    const d = this._data[idx];

    if (idx !== -1) {
      const nextLock = typeof lock === 'undefined' ? (!d.lock) : lock;
      d.lock = nextLock;

      this.updateBackground(this._props);
      this.updateForeground(this._props);
    }
  };

  return slopeGraph;
}

/******************************************************************************
 * Caravel wrapper
 */
function mungeData(json) {
  const { form_data, data } = json;

  return data.map((d,i) => {
    d.id = i;
    d.color = cv.color.category21( d[form_data.series] );

    // toggle labels for groups based on input
    if (form_data.label_top &&
        (i < form_data.label_top ||
          (form_data.label_top < 0 && i >= data.length + form_data.label_top) ) ) {
      d.lock = true;
      d.emphasis = true;
    }
    return d;
  });
}

function getProps(slice, json) {
  const { form_data } = json;
  const mungedData = mungeData(json);
  return {
    margin: { top: 20, right: 20, bottom: 50, left: 110 },
    width: slice.width(),
    height: slice.height(),
    data: mungedData,
    category1: form_data.metric,
    category2: form_data.secondary_metric,
    label: d => d[form_data.series],
    formatter: d3.format('.4s')
  };
}

function slopeGraph(slice) {
  const chart = slopeGraphFactory();

  function render() {
    d3.json(slice.jsonEndpoint(), function (error, json) {
      if (error !== null) {
        slice.error(error.responseText);
        return '';
      }
      const container = slice.selector;
      const props = getProps(slice, json, chart);
      chart.create(container, props);
      slice.done(json);
    });
  }

  function resize() {
    d3.json(slice.jsonEndpoint(), function (error, json) {
      if (error !== null) {
        slice.error(error.responseText);
        return '';
      }
      const props = getProps(slice, json, chart);
      chart.update(props);
      slice.done(json);
    });
  }

  return {
    render: render,
    resize: resize
  };
}

module.exports = slopeGraph;
