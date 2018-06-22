import d3 from 'd3';
import './spider_radar.css';

function spiderRadarViz(slice, json) {
  // console.log("Slice", slice);
  // console.log("JSON", json);

  const div = d3.select(slice.selector);

  const formData = slice.formData;
  const scenarios = json.data.scenarios;
  const max = formData.spider_max_value.value;
  const showlegend = formData.show_legend;

  const width = slice.width();
  const height = slice.height();
  const marg = {
    top: 0,
    right: 0,
    bottom: 40,
    left: 0,
  };
  const legpos = { x: 25, y: 25 };

  const col = d3.scale.ordinal()
    .range(['#2067A3', '#C6B201', '#BB352A']);
  const radarChartOptions = {
    w: width,
    h: height,
    margin: marg,
    legendPosition: legpos,
    maxValue: max,
    levels: 5,
    roundStrokes: true,
    color: col,
    axisName: 'reason',
    areaName: 'device',
    value: 'value',
  };

  /* //////// SECONDARY FUNCTIONS ////////////////////////// */

  function setOptions(options) {
    const defaults = {
      w: 600, // Width of the circle
      h: 600, // Height of the circle
      margin: { top: 20, right: 20, bottom: 30, left: 20 }, // The margins of the SVG
      levels: 3, // How many levels or inner circles should there be drawn
      maxValue: 0, // What is the value that the biggest circle will represent
      labelFactor: 1.25, // X farther than radius, outer circle labels placed
      wrapWidth: 60, // The number of pixels after which a label needs to be given a new line
      opacityArea: 0.35, // The opacity of the area of the blob
      dotRadius: 4, // The size of the colored circles of each blog
      opacityCircles: 0.1, // The opacity of the circles of each blob
      strokeWidth: 2, // The width of the stroke around each blob
      roundStrokes: false, // Makes area & stroke will follow round path (cardinal-closed)
      color: d3.scale.category10(), // Color function
      axisName: 'axisName',
      areaName: 'areaName',
      value: 'value',
    };
    if (typeof options !== 'undefined') {
      for (const i in options) {
        if (typeof options[i] !== 'undefined') {
          defaults[i] = options[i];
        }
      }
    }
    return defaults;
  }

  function setOuterCircleMax(cfg, data) {
    const dataMax = d3.max(data, i => d3.max(i.map(o => o.value)));
    return Math.max(cfg.maxValue, dataMax);
  }

  // Taken from http://bl.ocks.org/mbostock/7555321
  // Wraps SVG text
  function wrap(_text, width_) {
    _text.each(function () {
      const text = d3.select(this);
      const words = text.text().split(/\s+/).reverse();
      let word;
      let line = [];
      let lineNumber = 0;
      const lineHeight = 1.4; // ems
      const y = text.attr('y');
      const x = text.attr('x');
      const dy = parseFloat(text.attr('dy'));
      let tspan = text.text(null)
        .append('tspan')
        .attr('x', x)
        .attr('y', y)
        .attr('dy', dy + 'em');
      word = words.pop();
      while (word) {
        line.push(word);
        tspan.text(line.join(' '));
        if (tspan.node().getComputedTextLength() > width_) {
          line.pop();
          tspan.text(line.join(' '));
          line = [word];
          tspan = text
            .append('tspan')
            .attr('x', x)
            .attr('y', y)
            .attr('dy', ++lineNumber * lineHeight + dy + 'em')
            .text(word);
        }
        word = words.pop();
      }
    });
  }

  // on mouseover for the legend symbol
  function cellover(d, data) {
    // Dim all blobs
    d3.selectAll('.radarArea')
      .transition().duration(200)
      .style('fill-opacity', 0.1);
    // Bring back the hovered over blob
    d3.select('.' + data[d][0].areaName.replace(/\s+/g, ''))
      .transition().duration(200)
      .style('fill-opacity', 0.7);
  }

  // on mouseout for the legend symbol
  function cellout(cfg) {
    // Bring back all blobs
    d3.selectAll('.radarArea')
      .transition().duration(200)
      .style('fill-opacity', cfg.opacityArea);
  }

  /* //////// MAIN FUNCTION //////////////////////////////// */
  function RadarChart(_div, data, options) {
    _div.select('svg').remove();

    // Repopulate options with any new values
    const cfg = setOptions(options);

    // If the supplied maxValue is smaller than the actual one, replace by the max in the data
    const maxValue = setOuterCircleMax(cfg, data);
    const allAxis = (data[0].map(dataPoint => dataPoint.axis)); // Names of each axis
    const total = allAxis.length; // The number of different axes
    const radius = Math.min(cfg.w / 2.7, cfg.h / 2.7); // Radius of the outermost circle
      // Format = d3.format('%'), // Percentage formatting
    const Format = d3.format('.1f');
    const angleSlice = Math.PI * 2 / total; // The width in radians of each "slice"

    // Scale for the radius
    const rScale = d3.scale.linear()
      .range([0, radius])
      .domain([0, maxValue]);

    // ////////// Create the container SVG and g /////////////


    // Create the svg element
    const svg = div.append('svg')
      .attr('width', cfg.w + cfg.margin.left + cfg.margin.right)
      .attr('height', cfg.h + cfg.margin.top + cfg.margin.bottom)
      .attr('class', 'radarChart');
    // Append a g element
    const g = svg.append('g')
      .attr('transform', 'translate(' + (cfg.w / 2 + cfg.margin.left) + ',' + (cfg.h / 2 + cfg.margin.top) + ')');

    /* //////// Glow filter for some extra pizzazz ////////// */

    // Filter for the outside glow
    const filter = g.append('defs').append('filter').attr('id', 'glow');
    /* const feGaussianBlur = filter.append('feGaussianBlur')
    .attr('stdDeviation', '2.5')
    .attr('result', 'coloredBlur');
     */
    filter.append('feGaussianBlur').attr('stdDeviation', '2.5').attr('result', 'coloredBlur');
    const feMerge = filter.append('feMerge');
    // let feMergeNode_1 = feMerge.append('feMergeNode').attr('in', 'coloredBlur');
    // let feMergeNode_2 = feMerge.append('feMergeNode').attr('in', 'SourceGraphic');
    feMerge.append('feMergeNode').attr('in', 'coloredBlur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    /* ///////////// Draw the Circular grid ///////////////// */

    // Wrapper for the grid & axes
    const axisGrid = g.append('g').attr('class', 'axisWrapper');

    // Draw the background circles
    axisGrid.selectAll('.levels')
      .data(d3.range(1, (cfg.levels + 1)).reverse())
      .enter()
      .append('circle')
      .attr('class', 'gridCircle')
      .attr('r', d => radius / cfg.levels * d)
      .style('fill', '#CDCDCD')
      .style('stroke', '#CDCDCD')
      .style('fill-opacity', cfg.opacityCircles)
      .style('filter', 'url(#glow)');

    // Text indicating at what % each level is
    axisGrid.selectAll('.axisLabel')
      .data(d3.range(1, (cfg.levels + 1)).reverse())
      .enter().append('text')
      .attr('class', 'axisLabel')
      .attr('x', 4)
      .attr('y', d => -d * radius / cfg.levels)
      .attr('dy', '0.4em')
      .style('font-size', '10px')
      .attr('fill', '#737373')
      .text(d => Format(maxValue * d / cfg.levels));
    // ///////////////////////////////////////////////////////
    // ////////////////// Draw the axes //////////////////////
    // ///////////////////////////////////////////////////////

    // Create the straight lines radiating outward from the center
    const axis = axisGrid.selectAll('.axis')
      .data(allAxis)
      .enter()
      .append('g')
      .attr('class', 'axis');
    // Append the lines
    axis.append('line')
      .attr('x1', 0)
      .attr('y1', 0)
      .attr('x2', function (d, i) {
        return rScale(maxValue * 1.1) * Math.cos(angleSlice * i - Math.PI / 2);
      })
      .attr('y2', function (d, i) {
        return rScale(maxValue * 1.1) * Math.sin(angleSlice * i - Math.PI / 2);
      })
      .attr('class', 'line')
      .style('stroke', 'white')
      .style('stroke-width', '2px');

    // Append the labels at each axis
    axis.append('text')
      .attr('class', 'legend')
      .style('font-size', '11px')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('x', function (d, i) {
        return rScale(maxValue * cfg.labelFactor) * Math.cos(angleSlice * i - Math.PI / 2);
      })
      .attr('y', function (d, i) {
        return rScale(maxValue * cfg.labelFactor) * Math.sin(angleSlice * i - Math.PI / 2);
      })
      .text(function (d) {
        return d;
      })
      .call(wrap, cfg.wrapWidth);

    // ///////////////////////////////////////////////////////
    // /////////// Draw the radar chart blobs ////////////////
    // ///////////////////////////////////////////////////////

    // The radial line function
    const radarLine = d3.svg.line.radial()
      .interpolate('linear-closed')
      .radius(function (d) {
        return rScale(d.value);
      })
      .angle(function (d, i) {
        return i * angleSlice;
      });

    if (cfg.roundStrokes) {
      radarLine.interpolate('cardinal-closed');
    }

    // Create a wrapper for the blobs
    const blobWrapper = g.selectAll('.radarWrapper')
      .data(data)
      .enter().append('g')
      .attr('class', 'radarWrapper');

    // Append the backgrounds
    blobWrapper
      .append('path')
      .attr('class', 'radarArea')
      .attr('d', function (d) {
        return radarLine(d);
      })
      .style('fill', function (d, i) {
        return cfg.color(i);
      })
      .style('fill-opacity', cfg.opacityArea)
      .on('mouseover', function () {
        // Dim all blobs
        d3.selectAll('.radarArea')
          .transition().duration(200)
          .style('fill-opacity', 0.1);
        // Bring back the hovered over blob
        d3.select(this)
          .transition().duration(200)
          .style('fill-opacity', 0.7);
      })
      .on('mouseout', function () {
        // Bring back all blobs
        d3.selectAll('.radarArea')
          .transition().duration(200)
          .style('fill-opacity', cfg.opacityArea);
      });

    // Create the outlines
    blobWrapper.append('path')
      .attr('class', 'radarStroke')
      .attr('d', function (d) {
        return radarLine(d);
      })
      .style('stroke-width', cfg.strokeWidth + 'px')
      .style('stroke', function (d, i) {
        return cfg.color(i);
      })
      .style('fill', 'none')
      .style('filter', 'url(#glow)');

    // Append the circles
    blobWrapper.selectAll('.radarCircle')
      .data(d => d)
      .enter().append('circle')
      .attr('class', 'radarCircle')
      .attr('r', cfg.dotRadius)
      .attr('cx', function (d, i) {
        return rScale(d.value) * Math.cos(angleSlice * i - Math.PI / 2);
      })
      .attr('cy', function (d, i) {
        return rScale(d.value) * Math.sin(angleSlice * i - Math.PI / 2);
      })
      .style('fill', function (d, i, j) {
        return cfg.color(j);
      })
      .style('fill-opacity', 0.8);

    // ///////////////////////////////////////////////////////
    // ////// Append invisible circles for tooltip ///////////
    // ///////////////////////////////////////////////////////

    // Set up the small tooltip for when you hover over a circle
    const tooltip = g.append('text')
      .attr('class', 'tooltip')
      .style('opacity', 0);

    // Wrapper for the invisible circles on top
    const blobCircleWrapper = g.selectAll('.radarCircleWrapper')
      .data(data)
      .enter().append('g')
      .attr('class', 'radarCircleWrapper');

    // Append a set of invisible circles on top for the mouseover pop-up
    blobCircleWrapper.selectAll('.radarInvisibleCircle')
      .data(function (d) {
        return d;
      })
      .enter().append('circle')
      .attr('class', 'radarInvisibleCircle')
      .attr('r', cfg.dotRadius * 1.5)
      .attr('cx', (d, index) => rScale(d.value) * Math.cos(angleSlice * index - Math.PI / 2))
      .attr('cy', (d, index) => rScale(d.value) * Math.sin(angleSlice * index - Math.PI / 2))
      .style('fill', 'none')
      .style('pointer-events', 'all')
      .on('mouseover', function (d) {
        newX = parseFloat(d3.select(this).attr('cx')) - 10;
        newY = parseFloat(d3.select(this).attr('cy')) - 10;

        tooltip
          .attr('x', newX)
          .attr('y', newY)
          .text(Format(d.value))
          .transition()
.duration(200)
          .style('opacity', 1);
      })
      .on('mouseout', () => {
        tooltip.transition().duration(200)
          .style('opacity', 0);
      });


    // ///////////////////////////////////////////////////////
    // //////// DRAW THE LEGEND //////////////////////////////
    // ///////////////////////////////////////////////////////

    if (showlegend) {
      svg.append('g')
        .attr('class', 'legendOrdinal')
        .attr('transform', 'translate(' + cfg.legendPosition.x + ',' + cfg.legendPosition.y + ')');

      const legendOrdinal = d3.legend.color()
        .shape('path', d3.svg.symbol().type('triangle-up').size(150)())
        .shapePadding(10)
        .scale(cfg.color)
        .labels(cfg.color.domain().map(d => data[d][0].areaName))
        .on('cellover', (d) => {
          cellover(d, data);
        })
        .on('cellout', () => {
          // used to carry d in here, not sure why as it wasn't being used
          cellout(cfg);
        });

      svg.select('.legendOrdinal')
        .call(legendOrdinal);
    }
  }


  RadarChart(div, scenarios, radarChartOptions);
}

module.exports = spiderRadarViz;
