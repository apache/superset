/* eslint no-param-reassign: [2, {"props": false}] */
/* eslint no-underscore-dangle: ["error", { "allow": ["_options", "_ticks"] }] */
/* eslint no-use-before-define: ["error", { "functions": false }] */
import d3 from 'd3';
import nv from 'nvd3';

export default function cumulativeLineWithFocusChart() {
  // Public variables with default settings
  const lines = nv.models.line();
  const xAxis = nv.models.axis();
  const yAxis = nv.models.axis();
  const legend = nv.models.legend();
  const controls = nv.models.legend();
  const interactiveLayer = nv.interactiveGuideline();
  const tooltip = nv.models.tooltip();
  const focus = nv.models.focus(nv.models.line());

  const margin = { top: 30, right: 30, bottom: 50, left: 60 };
  let marginTop = null;
  let color = nv.utils.defaultColor();
  let width = null;
  let height = null;
  let showLegend = true;
  let showXAxis = true;
  let showYAxis = true;
  let rightAlignYAxis = false;
  let showControls = true;
  let useInteractiveGuideline = false;
  let rescaleY = true;
  let x; // can be accessed via chart.xScale()
  let y; // can be accessed via chart.yScale()
  let focusEnable = true;
  const id = lines.id();
  const state = nv.utils.state();
  let defaultState = null;
  let noData = null;
  let average = d => d.average;
  const dispatch = d3.dispatch('stateChange', 'changeState', 'renderEnd');
  let duration = 250;
  // Set to true to bypass error checking in `indexify`
  let noErrorCheck = false;

  lines.clipEdge(true).duration(0);
  state.index = 0;
  state.rescaleY = rescaleY;
  xAxis.orient('bottom').tickPadding(7);
  yAxis.orient((rightAlignYAxis) ? 'right' : 'left');

  tooltip
    .valueFormatter((d, i) => yAxis.tickFormat()(d, i))
    .headerFormatter((d, i) => xAxis.tickFormat()(d, i));
  interactiveLayer.tooltip
    .valueFormatter((d, i) => yAxis.tickFormat()(d, i))
    .headerFormatter((d, i) => xAxis.tickFormat()(d, i));
  controls.updateState(false);

  // Private variables
  const dx = d3.scale.linear();
  const index = { i: 0, x: 0 };
  const renderWatch = nv.utils.renderWatch(dispatch, duration);
  let currentYDomain;

  const stateGetter = data => () => ({
    active: data.map(d => !d.disabled),
    index: index.i,
    rescaleY,
  });

  const stateSetter = data => (newState) => {
    if (newState.index !== undefined) index.i = newState.index;
    if (newState.rescaleY !== undefined) rescaleY = newState.rescaleY;
    if (newState.active !== undefined) {
      data.forEach((series, i) => {
        series.disabled = !newState.active[i];
      });
    }
  };

  function chart(selection) {
    renderWatch.reset();
    renderWatch.models(lines);
    if (showXAxis) renderWatch.models(xAxis);
    if (showYAxis) renderWatch.models(yAxis);
    selection.each(function (cData) {
      const container = d3.select(this);
      nv.utils.initSVG(container);
      container.classed('nv-chart-' + id, true);

      const availableWidth = nv.utils.availableWidth(width, container, margin);
      let availableHeight = nv.utils.availableHeight(height, container, margin);
      availableHeight -= focusEnable ? focus.height() : 0;

      chart.update = () => {
        if (duration === 0) {
          container.call(chart);
        } else {
          container.transition().duration(duration).call(chart);
        }
      };
      chart.container = this;

      state
        .setter(stateSetter(cData), chart.update)
        .getter(stateGetter(cData))
        .update();

      // DEPRECATED set state.disableddisabled
      state.disabled = cData.map(d => !!d.disabled);
      if (!defaultState) {
        let key;
        defaultState = {};
        for (key in state) {
          if (state[key] instanceof Array) {
            defaultState[key] = state[key].slice(0);
          } else {
            defaultState[key] = state[key];
          }
        }
      }

      function dragStart() {
        d3.select(chart.container)
          .style('cursor', 'ew-resize');
      }

      function dragMove() {
        index.x = d3.event.x;
        index.i = Math.round(dx.invert(index.x));
        updateZero();
      }

      function dragEnd() {
        d3.select(chart.container)
          .style('cursor', 'auto');
        // Update state and send stateChange with new index
        state.index = index.i;
        dispatch.stateChange(state);
      }

      const indexDrag = d3.behavior.drag()
        .on('dragstart', dragStart)
        .on('drag', dragMove)
        .on('dragend', dragEnd);

      // Display No Data message if there's nothing to show.
      if (!cData || !cData.length || !cData.filter(d => d.values.length).length) {
        nv.utils.noData(chart, container);
        return chart;
      }
      container.selectAll('.nv-noData').remove();
      focus.dispatch.on('onBrush', (extent) => { onBrush(extent); });

      // Setup Scales
      x = lines.xScale();
      y = lines.yScale();

      const data = indexify(index.i, cData);

      dx.domain([0, data[0].values.length - 1]) // Assumes all series have same length
        .range([0, availableWidth])
        .clamp(true);

      // initialize the starting yDomain for the not-rescale
      // case after indexify (to have calculated point.display)
      if (typeof currentYDomain === 'undefined') {
        currentYDomain = getCurrentYDomain(data);
      }

      if (!rescaleY) {
        lines.yDomain(currentYDomain);
      } else {
        lines.yDomain(null);
      }

      // Setup containers and skeleton of chart
      const interactivePointerEvents = (useInteractiveGuideline) ? 'none' : 'all';
      const wrap = container.selectAll('g.nv-wrap.nv-cumulativeLine').data([data]);
      const gEnter = wrap.enter().append('g').attr('class', 'nvd3 nv-wrap nv-cumulativeLine').append('g');
      const g = wrap.select('g');

      gEnter.append('g').attr('class', 'nv-interactive');
      gEnter.append('g').attr('class', 'nv-main nv-x nv-axis').style('pointer-events', 'none');
      gEnter.append('g').attr('class', 'nv-main nv-y nv-axis');
      gEnter.append('g').attr('class', 'nv-background');
      gEnter.append('g').attr('class', 'nv-linesWrap').style('pointer-events', interactivePointerEvents);
      gEnter.append('g').attr('class', 'nv-avgLinesWrap').style('pointer-events', 'none');
      gEnter.append('g').attr('class', 'nv-legendWrap');
      gEnter.append('g').attr('class', 'nv-controlsWrap');
      gEnter.append('g').attr('class', 'nv-focusWrap');

      // Controls
      if (!showControls) {
        g.select('.nv-controlsWrap').selectAll('*').remove();
      } else {
        const controlsData = [
          { key: 'Re-scale y-axis', disabled: !rescaleY },
        ];

        controls
          .width(140)
          .color(['#444', '#444', '#444'])
          .rightAlign(false)
          .margin({ top: 5, right: 0, bottom: 5, left: 20 })
        ;

        g.select('.nv-controlsWrap')
          .datum(controlsData)
          .attr('transform', 'translate(0,' + (-margin.top) + ')')
          .call(controls);
      }

      // Legend
      if (!showLegend) {
        g.select('.nv-legendWrap').selectAll('*').remove();
      } else {
        legend.width(availableWidth);
        g.select('.nv-legendWrap')
          .datum(data)
          .call(legend);
        if (!marginTop && legend.height() !== margin.top) {
          margin.top = legend.height();
          availableHeight = nv.utils.availableHeight(height, container, margin);
          availableHeight -= focusEnable ? focus.height() : 0;
        }
        if (showControls) {
          availableHeight -= controls.height();
          margin.top += controls.height();
        }
        const translate = -margin.top + (showControls ? controls.height() : 0);
        g.select('.nv-legendWrap')
          .attr('transform', 'translate(0,' + (translate) + ')');
      }
      wrap.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

      if (rightAlignYAxis) {
        g.select('.nv-y.nv-axis')
          .attr('transform', 'translate(' + availableWidth + ',0)');
      }

      // Show error if index point value is 0 (division by zero avoided)
      const tempDisabled = data.filter(d => d.tempDisabled);

      wrap.select('.tempDisabled').remove(); // clean-up and prevent duplicates
      if (tempDisabled.length) {
        wrap.append('text').attr('class', 'tempDisabled')
          .attr('x', availableWidth / 2)
          .attr('y', '-.71em')
          .style('text-anchor', 'end')
          .text(tempDisabled
            .map(d => d.key)
            .join(', ') + ' values cannot be calculated for this time period.');
      }

      // Set up interactive layer
      if (useInteractiveGuideline) {
        interactiveLayer
          .width(availableWidth)
          .height(availableHeight)
          .margin({ left: margin.left, top: margin.top })
          .svgContainer(container)
          .xScale(x);
        wrap.select('.nv-interactive').call(interactiveLayer);
      }

      gEnter.select('.nv-background')
        .append('rect');

      g.select('.nv-background rect')
        .attr('width', availableWidth)
        .attr('height', availableHeight);

      lines
        .y(d => d.display.y)
        .width(availableWidth)
        .height(availableHeight)
        .color(data.map((d, i) => d.color || color(d, i))
        .filter((d, i) => !data[i].disabled && !data[i].tempDisabled));

      const linesWrap = g.select('.nv-linesWrap')
        .datum(data.filter(d => !d.disabled && !d.tempDisabled));

      linesWrap.call(lines);

      // Store a series index number in the data array.
      data.forEach((d, i) => { d.seriesIndex = i; });

      const avgLineData = data.filter(d => !d.disabled && !!average(d));

      const avgLines = g.select('.nv-avgLinesWrap').selectAll('line')
        .data(avgLineData, d => d.key);

      const getAvgLineY = function (d) {
        // If average lines go off the svg element, clamp them to the svg bounds.
        const yVal = y(average(d));
        if (yVal < 0) return 0;
        if (yVal > availableHeight) return availableHeight;
        return yVal;
      };

      avgLines.enter()
        .append('line')
        .style('stroke-width', 2)
        .style('stroke-dasharray', '10,10')
        .style('stroke', d => lines.color()(d, d.seriesIndex))
        .attr('x1', 0)
        .attr('x2', availableWidth)
        .attr('y1', getAvgLineY)
        .attr('y2', getAvgLineY);

      avgLines
        .style('stroke-opacity', (d) => {
          // If average lines go offscreen, make them transparent
          const yVal = y(average(d));
          if (yVal < 0 || yVal > availableHeight) return 0;
          return 1;
        })
        .attr('x1', 0)
        .attr('x2', availableWidth)
        .attr('y1', getAvgLineY)
        .attr('y2', getAvgLineY);

      avgLines.exit().remove();

      // Create index line
      const indexLine = linesWrap.selectAll('.nv-indexLine')
        .data([index]);
      indexLine.enter().append('rect').attr('class', 'nv-indexLine')
        .attr('width', 3)
        .attr('x', -2)
        .attr('fill', 'red')
        .attr('fill-opacity', 0.5)
        .style('pointer-events', 'all')
        .call(indexDrag);

      indexLine
        .attr('transform', d => `translate(${dx(d.i)}, 0)`)
        .attr('height', availableHeight);

      // Setup Axes
      if (showXAxis) {
        xAxis
          .scale(x)
          ._ticks(nv.utils.calcTicksX(availableWidth / 70, data))
          .tickSize(-availableHeight, 0);
      }

      if (showYAxis) {
        yAxis
          .scale(y)
          ._ticks(nv.utils.calcTicksY(availableHeight / 36, data))
          .tickSize(-availableWidth, 0);
      }

      function updateXAxis() {
        if (showXAxis) {
          g.select('.nv-x.nv-axis')
            .transition()
            .duration(duration)
            .call(xAxis);
        }
      }

      function updateYAxis() {
        if (showYAxis) {
          g.select('.nv-y.nv-axis')
            .transition()
            .duration(duration)
            .call(yAxis);
        }
      }

      g.select('.nv-x.nv-axis').attr('transform', `translate(0, ${availableHeight})`);
      if (!focusEnable && focus.brush.extent() === null) {
        linesWrap.call(lines);
        updateXAxis();
        updateYAxis();
      } else {
        focus.width(availableWidth);
        g.select('.nv-focusWrap')
          .style('display', focusEnable ? 'initial' : 'none')
          .attr('transform', `translate(0, ${availableHeight + margin.bottom + focus.margin().top})`)
          .call(focus);
        const extent = focus.brush.empty() ? focus.xDomain() : focus.brush.extent();
        if (extent !== null) {
          onBrush(extent);
        }
      }

      // Event handling in chart's scope
      function updateZero() {
        indexLine
          .data([index]);

        // When dragging the index line, turn off line transitions.
        // Then turn them back on when done dragging.
        const oldDuration = chart.duration();
        chart.duration(0);
        chart.update();
        chart.duration(oldDuration);
        lines.duration(0);
      }

      g.select('.nv-background rect')
        .on('click', function () {
          index.x = d3.mouse(this)[0];
          index.i = Math.round(dx.invert(index.x));

          // update state and send stateChange with new index
          state.index = index.i;
          dispatch.stateChange(state);

          updateZero();
        });

      lines.dispatch.on('elementClick', (e) => {
        index.i = e.pointIndex;
        index.x = dx(index.i);

        // update state and send stateChange with new index
        state.index = index.i;
        dispatch.stateChange(state);

        updateZero();
      });

      controls.dispatch.on('legendClick', (d) => {
        d.disabled = !d.disabled;
        rescaleY = !d.disabled;
        state.rescaleY = rescaleY;
        if (!rescaleY) {
          // Rescale is turned off, so reset the Y domain
          currentYDomain = getCurrentYDomain(data);
        }
        dispatch.stateChange(state);
        chart.update();
      });

      legend.dispatch.on('stateChange', (newState) => {
        for (const key in newState) {
          state[key] = newState[key];
        }
        dispatch.stateChange(state);
        chart.update();
      });

      interactiveLayer.dispatch.on('elementMousemove', (e) => {
        lines.clearHighlights();
        let singlePoint;
        let pointIndex;
        let pointXLocation;
        const allData = [];

        data
          .filter((series, i) => {
            series.seriesIndex = i;
            return !(series.disabled || series.tempDisabled);
          })
          .forEach((series, i) => {
            const bExtent = focus.brush.empty() ? focus.xScale().domain() : focus.brush.extent();
            const extent = focus.brush.extent() !== null ? bExtent : x.domain();
            const left = extent[0] <= extent[1] ? extent[0] : extent[1];
            const right = extent[0] <= extent[1] ? extent[1] : extent[0];
            let leftPointCount = 0;
            const currentValues = series.values.filter((d, k) => {
              const toLeft = lines.x()(d, k) < left;
              const toRight = lines.x()(d, k) > right;
              leftPointCount += toLeft ? 1 : 0;
              return !(toLeft || toRight);
            });

            pointIndex = nv.interactiveBisect(currentValues, e.pointXValue, lines.x());
            const point = currentValues[pointIndex];
            const pointYValue = chart.y()(point, pointIndex);
            if (pointYValue !== null) {
              lines.highlightPoint(i, series.values.indexOf(point) - leftPointCount, true);
            }
            if (point === undefined) return;
            if (singlePoint === undefined) singlePoint = point;
            if (pointXLocation === undefined) {
              pointXLocation = chart.xScale()(chart.x()(point, pointIndex));
            }
            allData.push({
              key: series.key,
              value: pointYValue,
              color: color(series, series.seriesIndex),
              data: point,
            });
          });

        // Highlight the tooltip entry based on which point the mouse is closest to.
        if (allData.length > 2) {
          const yValue = chart.yScale().invert(e.mouseY);
          const domainExtent = Math.abs(chart.yScale().domain()[0] - chart.yScale().domain()[1]);
          const threshold = 0.03 * domainExtent;
          const indexToHighlight = nv.nearestValueIndex(
            allData.map(d => d.value),
            yValue,
            threshold,
          );
          if (indexToHighlight !== null) {
            allData[indexToHighlight].highlight = true;
          }
        }

        const defaultValueFormatter = d => d === null ? 'N/A' : yAxis.tickFormat()(d);

        interactiveLayer.tooltip.valueFormatter(
          interactiveLayer.tooltip.valueFormatter() || defaultValueFormatter,
        ).data({
          value: chart.x()(singlePoint, pointIndex),
          index: pointIndex,
          series: allData,
        })();
        interactiveLayer.renderGuideLine(pointXLocation);
      });

      interactiveLayer.dispatch.on('elementMouseout', () => { lines.clearHighlights(); });

      // Update chart from a state object passed to event handler
      dispatch.on('changeState', (e) => {
        if (typeof e.disabled !== 'undefined') {
          data.forEach((series, i) => {
            series.disabled = e.disabled[i];
          });

          state.disabled = e.disabled;
        }

        if (typeof e.index !== 'undefined') {
          index.i = e.index;
          index.x = dx(index.i);

          state.index = e.index;

          indexLine
            .data([index]);
        }

        if (typeof e.rescaleY !== 'undefined') {
          rescaleY = e.rescaleY;
        }

        chart.update();
      });

      function onBrush(extent) {
        if (extent[0] > extent[1]) {
          const tmp = extent[0];
          extent[0] = extent[1];
          extent[1] = tmp;
        }
        let leftIndex = 0;
        let rightIndex = data[0].values.length - 1;
        let computedDomain = false;
        const focusLinesWrap = g.select('.nv-linesWrap')
          .datum(
            data.filter(d => !d.disabled)
            .map((d) => {
              const lineData = {
                key: d.key,
                area: d.area,
                classed: d.classed,
                values: d.values.filter(function (dat, k) {
                  const toLeft = lines.x()(dat, k) < extent[0];
                  const toRight = lines.x()(dat, k) > extent[1];
                  if (!computedDomain) {
                    leftIndex += toLeft ? 1 : 0;
                    rightIndex -= toRight ? 1 : 0;
                  }
                  return !(toLeft || toRight);
                }),
                disableTooltip: d.disableTooltip,
              };
              computedDomain = true;
              return lineData;
            }),
          );
        dx.domain([leftIndex, rightIndex])
          .range([0, availableWidth])
          .clamp(true);
        indexLine
          .attr('transform', d => `translate(${dx(d.i)}, 0)`);
        if (index.i < dx.domain()[0] || index.i > dx.domain()[1]) {
          indexLine.style('display', 'none');
        } else {
          indexLine.style('display', '');
        }
        focusLinesWrap.transition().duration(duration).call(lines);
        updateXAxis();
        updateYAxis();
      }
      return true;
    });

    renderWatch.renderEnd('cumulativeLineChart immediate');
    return chart;
  }

  // Event handling outside chart scope
  lines.dispatch.on('elementMouseover.tooltip', (evt) => {
    evt.point = {
      x: chart.x()(evt.point),
      y: chart.y()(evt.point),
      color: evt.point.color,
    };
    tooltip.data(evt).hidden(false);
  });

  lines.dispatch.on('elementMouseout.tooltip', () => {
    tooltip.hidden(true);
  });

  let indexifyYGetter = null;

  // Normalize chart data to a point
  function indexify(idx, data) {
    if (!indexifyYGetter) indexifyYGetter = lines.y();
    return data.map((line) => {
      if (!line.values) {
        return line;
      }
      const indexValue = line.values[idx];
      if (indexValue === null) {
        return line;
      }
      const v = indexifyYGetter(indexValue, idx);

      // avoid divide by zero
      if (Math.abs(v) < 0.00001 && !noErrorCheck) {
        line.tempDisabled = true;
        return line;
      }

      line.tempDisabled = false;

      line.values = line.values.map((point, pointIndex) => {
        point.display = { y: (indexifyYGetter(point, pointIndex) - v) / v };
        return point;
      });

      return line;
    });
  }

  function getCurrentYDomain(data) {
    const seriesDomains = data
      .filter(series => !(series.disabled || series.tempDisabled))
      .map(series => d3.extent(series.values, d => d.display.y));

    return [
      d3.min(seriesDomains, d => d[0]),
      d3.max(seriesDomains, d => d[1]),
    ];
  }

  // Expose chart's sub-components
  chart.dispatch = dispatch;
  chart.lines = lines;
  chart.legend = legend;
  chart.controls = controls;
  chart.xAxis = xAxis;
  chart.yAxis = yAxis;
  chart.interactiveLayer = interactiveLayer;
  chart.state = state;
  chart.tooltip = tooltip;
  chart.focus = focus;
  chart.x2Axis = focus.xAxis;
  chart.y2Axis = focus.yAxis;

  chart.options = nv.utils.optionsFunc.bind(chart);

  chart._options = Object.create({}, {
    // Simple options, getters and setters
    width: { get: () => width, set: (_) => { width = _; } },
    height: { get: () => height, set: (_) => { height = _; } },
    showControls: { get: () => showControls, set: (_) => { showControls = _; } },
    showLegend: { get: () => showLegend, set: (_) => { showLegend = _; } },
    average: { get: () => average, set: (_) => { average = _; } },
    defaultState: { get: () => defaultState, set: (_) => { defaultState = _; } },
    noData: { get: () => noData, set: (_) => { noData = _; } },
    showXAxis: { get: () => showXAxis, set: (_) => { showXAxis = _; } },
    showYAxis: { get: () => showYAxis, set: (_) => { showYAxis = _; } },
    noErrorCheck: { get: () => noErrorCheck, set: (_) => { noErrorCheck = _; } },
    focusEnable: { get: () => focusEnable, set: (_) => { focusEnable = _; } },
    focusHeight: { get: () => focusHeight, set: (_) => { focusHeight = _; } },
    focusShowAxisX: { get: () => focusShowAxisX, set: (_) => { focusShowAxisX = _; } },
    focusShowAxisY: { get: () => focusshowAxisY, set: (_) => { focusShowAxisY = _; } },

    // options that require extra logic in the setter
    rescaleY: {
      get: () => rescaleY,
      set: (_) => {
        rescaleY = _;
        chart.state.rescaleY = _; // also update state
      },
    },
    margin: {
      get: () => margin,
      set: (_) => {
        if (_.top !== undefined) {
          margin.top = _.top;
          marginTop = _.top;
        }
        margin.right = _.right !== undefined ? _.right : margin.right;
        margin.bottom = _.bottom !== undefined ? _.bottom : margin.bottom;
        margin.left = _.left !== undefined ? _.left : margin.left;
      },
    },
    color: {
      get: () => color,
      set: (_) => {
        color = nv.utils.getColor(_);
        legend.color(color);
      },
    },
    useInteractiveGuideline: {
      get: () => useInteractiveGuideline,
      set: (_) => {
        useInteractiveGuideline = _;
        if (_ === true) {
          chart.interactive(false);
          chart.useVoronoi(false);
        }
      },
    },
    rightAlignYAxis: {
      get: () => rightAlignYAxis,
      set: (_) => {
        rightAlignYAxis = _;
        yAxis.orient((_) ? 'right' : 'left');
      },
    },
    duration: {
      get: () => duration,
      set: (_) => {
        duration = _;
        lines.duration(duration);
        xAxis.duration(duration);
        yAxis.duration(duration);
        renderWatch.reset(duration);
      },
    },
  });

  nv.utils.inheritOptions(chart, lines);
  nv.utils.initOptions(chart);

  return chart;
}
