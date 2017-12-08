// JS
import $ from 'jquery';
import throttle from 'lodash.throttle';
import d3 from 'd3';
import nv from 'nvd3';
import d3tip from 'd3-tip';

import { getColorFromScheme } from '../javascripts/modules/colors';
import { customizeToolTip, d3TimeFormatPreset, d3FormatPreset, tryNumify } from '../javascripts/modules/utils';

// CSS
import '../node_modules/nvd3/build/nv.d3.min.css';
import './nvd3_vis.css';

const minBarWidth = 15;
const animationTime = 1000;

const BREAKPOINTS = {
  small: 340,
};

const addTotalBarValues = function (svg, chart, data, stacked, axisFormat) {
  const format = d3.format(axisFormat || '.3s');
  const countSeriesDisplayed = data.length;

  const totalStackedValues = stacked && data.length !== 0 ?
    data[0].values.map(function (bar, iBar) {
      const bars = data.map(function (series) {
        return series.values[iBar];
      });
      return d3.sum(bars, function (d) {
        return d.y;
      });
    }) : [];

  const rectsToBeLabeled = svg.selectAll('g.nv-group').filter(
    function (d, i) {
      if (!stacked) {
        return true;
      }
      return i === countSeriesDisplayed - 1;
    }).selectAll('rect');

  const groupLabels = svg.select('g.nv-barsWrap').append('g');
  rectsToBeLabeled.each(
    function (d, index) {
      const rectObj = d3.select(this);
      if (rectObj.attr('class').includes('positive')) {
        const transformAttr = rectObj.attr('transform');
        const yPos = parseFloat(rectObj.attr('y'));
        const xPos = parseFloat(rectObj.attr('x'));
        const rectWidth = parseFloat(rectObj.attr('width'));
        const t = groupLabels.append('text')
          .attr('x', xPos) // rough position first, fine tune later
          .attr('y', yPos - 5)
          .text(format(stacked ? totalStackedValues[index] : d.y))
          .attr('transform', transformAttr)
          .attr('class', 'bar-chart-label');
        const labelWidth = t.node().getBBox().width;
        t.attr('x', xPos + rectWidth / 2 - labelWidth / 2); // fine tune
      }
    });
};

function hideTooltips() {
  $('.nvtooltip').css({ opacity: 0 });
}

function getMaxLabelSize(container, axisClass) {
  // axis class = .nv-y2  // second y axis on dual line chart
  // axis class = .nv-x  // x axis on time series line chart
  const labelEls = container.find(`.${axisClass} text`).not('.nv-axislabel');
  const labelDimensions = labelEls.map(i => labelEls[i].getComputedTextLength());
  return Math.max(...labelDimensions);
}

/* eslint-disable camelcase */
function formatLabel(column, verbose_map) {
  let label;
  if (Array.isArray(column) && column.length) {
    label = verbose_map[column[0]] || column[0];
    if (column.length > 1) {
      label += ', ';
    }
    label += column.slice(1).join(', ');
  } else {
    label = verbose_map[column] || column;
  }
  return label;
}
/* eslint-enable camelcase */

function nvd3Vis(slice, payload) {
  let chart;
  let colorKey = 'key';
  const isExplore = $('#explore-container').length === 1;

  let data;
  if (payload.data) {
    data = payload.data.map(x => ({
      ...x, key: formatLabel(x.key, slice.datasource.verbose_map),
    }));
  } else {
    data = [];
  }

  slice.container.html('');
  slice.clearError();


  // Calculates the longest label size for stretching bottom margin
  function calculateStretchMargins(payloadData) {
    let stretchMargin = 0;
    const pixelsPerCharX = 4.5; // approx, depends on font size
    let maxLabelSize = 10; // accommodate for shorter labels
    payloadData.data.forEach((d) => {
      const axisLabels = d.values;
      for (let i = 0; i < axisLabels.length; i++) {
        maxLabelSize = Math.max(axisLabels[i].x.toString().length, maxLabelSize);
      }
    });
    stretchMargin = Math.ceil(pixelsPerCharX * maxLabelSize);
    return stretchMargin;
  }

  let width = slice.width();
  const fd = slice.formData;

  const barchartWidth = function () {
    let bars;
    if (fd.bar_stacked) {
      bars = d3.max(data, function (d) { return d.values.length; });
    } else {
      bars = d3.sum(data, function (d) { return d.values.length; });
    }
    if (bars * minBarWidth > width) {
      return bars * minBarWidth;
    }
    return width;
  };

  const vizType = fd.viz_type;
  const f = d3.format('.3s');
  const reduceXTicks = fd.reduce_x_ticks || false;
  let stacked = false;
  let row;

  const drawGraph = function () {
    let svg = d3.select(slice.selector).select('svg');
    if (svg.empty()) {
      svg = d3.select(slice.selector).append('svg');
    }
    switch (vizType) {
      case 'line':
        if (fd.show_brush) {
          chart = nv.models.lineWithFocusChart();
          chart.focus.xScale(d3.time.scale.utc());
          chart.x2Axis.staggerLabels(false);
        } else {
          chart = nv.models.lineChart();
        }
        // To alter the tooltip header
        // chart.interactiveLayer.tooltip.headerFormatter(function(){return '';});
        chart.xScale(d3.time.scale.utc());
        chart.interpolate(fd.line_interpolation);
        chart.xAxis.staggerLabels(false);
        break;

      case 'time_pivot':
        chart = nv.models.lineChart();
        chart.xScale(d3.time.scale.utc());
        chart.interpolate(fd.line_interpolation);
        chart.xAxis.staggerLabels(false);
        break;

      case 'dual_line':
        chart = nv.models.multiChart();
        chart.interpolate('linear');
        break;

      case 'bar':
        chart = nv.models.multiBarChart()
        .showControls(fd.show_controls)
        .groupSpacing(0.1);

        if (!reduceXTicks) {
          width = barchartWidth();
        }
        chart.width(width);
        chart.xAxis
        .showMaxMin(false)
        .staggerLabels(true);

        stacked = fd.bar_stacked;
        chart.stacked(stacked);

        if (fd.show_bar_value) {
          setTimeout(function () {
            addTotalBarValues(svg, chart, data, stacked, fd.y_axis_format);
          }, animationTime);
        }
        break;

      case 'dist_bar':
        chart = nv.models.multiBarChart()
        .showControls(fd.show_controls)
        .reduceXTicks(reduceXTicks)
        .rotateLabels(45)
        .groupSpacing(0.1); // Distance between each group of bars.

        chart.xAxis.showMaxMin(false);

        stacked = fd.bar_stacked;
        chart.stacked(stacked);
        if (fd.order_bars) {
          data.forEach((d) => {
            d.values.sort((a, b) => tryNumify(a.x) < tryNumify(b.x) ? -1 : 1);
          });
        }
        if (fd.show_bar_value) {
          setTimeout(function () {
            addTotalBarValues(svg, chart, data, stacked, fd.y_axis_format);
          }, animationTime);
        }
        if (!reduceXTicks) {
          width = barchartWidth();
        }
        chart.width(width);
        break;

      case 'pie':
        chart = nv.models.pieChart();
        colorKey = 'x';
        chart.valueFormat(f);
        if (fd.donut) {
          chart.donut(true);
        }
        chart.labelsOutside(fd.labels_outside);
        chart.labelThreshold(0.05);  // Configure the minimum slice size for labels to show up
        if (fd.pie_label_type !== 'key_percent' && fd.pie_label_type !== 'key_value') {
          chart.labelType(fd.pie_label_type);
        } else if (fd.pie_label_type === 'key_value') {
          chart.labelType(d => `${d.data.x}: ${d3.format('.3s')(d.data.y)}`);
        }
        chart.cornerRadius(true);

        if (fd.pie_label_type === 'percent' || fd.pie_label_type === 'key_percent') {
          let total = 0;
          data.forEach((d) => { total += d.y; });
          chart.tooltip.valueFormatter(d => `${((d / total) * 100).toFixed()}%`);
          if (fd.pie_label_type === 'key_percent') {
            chart.labelType(d => `${d.data.x}: ${((d.data.y / total) * 100).toFixed()}%`);
          }
        }

        break;

      case 'column':
        chart = nv.models.multiBarChart()
        .reduceXTicks(false)
        .rotateLabels(45);
        break;

      case 'compare':
        chart = nv.models.cumulativeLineChart();
        chart.xScale(d3.time.scale.utc());
        chart.useInteractiveGuideline(true);
        chart.xAxis
        .showMaxMin(false)
        .staggerLabels(true);
        break;

      case 'bubble':
        row = (col1, col2) => `<tr><td>${col1}</td><td>${col2}</td></tr>`;
        chart = nv.models.scatterChart();
        chart.showDistX(true);
        chart.showDistY(true);
        chart.tooltip.contentGenerator(function (obj) {
          const p = obj.point;
          let s = '<table>';
          s += (
            `<tr><td style="color: ${p.color};">` +
              `<strong>${p[fd.entity]}</strong> (${p.group})` +
            '</td></tr>');
          s += row(fd.x, f(p.x));
          s += row(fd.y, f(p.y));
          s += row(fd.size, f(p.size));
          s += '</table>';
          return s;
        });
        chart.pointRange([5, fd.max_bubble_size ** 2]);
        chart.pointDomain([0, d3.max(data, d => d3.max(d.values, v => v.size))]);
        break;

      case 'area':
        chart = nv.models.stackedAreaChart();
        chart.showControls(fd.show_controls);
        chart.style(fd.stacked_style);
        chart.xScale(d3.time.scale.utc());
        chart.xAxis.staggerLabels(true);
        break;

      case 'box_plot':
        colorKey = 'label';
        chart = nv.models.boxPlotChart();
        chart.x(d => d.label);
        chart.staggerLabels(true);
        chart.maxBoxWidth(75); // prevent boxes from being incredibly wide
        break;

      case 'bullet':
        chart = nv.models.bulletChart();
        break;

      default:
        throw new Error('Unrecognized visualization for nvd3' + vizType);
    }

    if ('showLegend' in chart && typeof fd.show_legend !== 'undefined') {
      if (width < BREAKPOINTS.small && vizType !== 'pie') {
        chart.showLegend(false);
      } else {
        chart.showLegend(fd.show_legend);
      }
    }

    let height = slice.height();
    if (vizType === 'bullet') {
      height = Math.min(height, 50);
    }

    chart.height(height);
    slice.container.css('height', height + 'px');

    if (chart.forceY &&
        fd.y_axis_bounds &&
        (fd.y_axis_bounds[0] !== null || fd.y_axis_bounds[1] !== null)) {
      chart.forceY(fd.y_axis_bounds);
    }
    if (fd.y_log_scale) {
      chart.yScale(d3.scale.log());
    }
    if (fd.x_log_scale) {
      chart.xScale(d3.scale.log());
    }
    const isTimeSeries = [
      'line', 'dual_line', 'area', 'compare', 'bar', 'time_pivot'].indexOf(vizType) >= 0;
    // if x axis format is a date format, rotate label 90 degrees
    if (isTimeSeries) {
      chart.xAxis.rotateLabels(45);
    }

    let xAxisFormatter = d3FormatPreset(fd.x_axis_format);
    if (isTimeSeries) {
      xAxisFormatter = d3TimeFormatPreset(fd.x_axis_format);
    }
    if (chart.x2Axis && chart.x2Axis.tickFormat) {
      chart.x2Axis.tickFormat(xAxisFormatter);
      height += 30;
    }
    const isXAxisString = ['dist_bar', 'box_plot'].indexOf(vizType) >= 0;
    if (!isXAxisString && chart.xAxis && chart.xAxis.tickFormat) {
      chart.xAxis.tickFormat(xAxisFormatter);
    }

    const yAxisFormatter = d3FormatPreset(fd.y_axis_format);
    if (chart.yAxis && chart.yAxis.tickFormat) {
      chart.yAxis.tickFormat(yAxisFormatter);
    }
    if (chart.y2Axis && chart.y2Axis.tickFormat) {
      chart.y2Axis.tickFormat(yAxisFormatter);
    }


    // Set showMaxMin for all axis
    function setAxisShowMaxMin(axis, showminmax) {
      if (axis && axis.showMaxMin && showminmax !== undefined) {
        axis.showMaxMin(showminmax);
      }
    }
    setAxisShowMaxMin(chart.xAxis, fd.x_axis_showminmax);
    setAxisShowMaxMin(chart.yAxis, fd.y_axis_showminmax);
    setAxisShowMaxMin(chart.y2Axis, fd.y_axis_showminmax);

    if (vizType === 'time_pivot') {
      chart.color((d) => {
        const c = fd.color_picker;
        let alpha = 1;
        if (d.rank > 0) {
          alpha = d.perc * 0.5;
        }
        return `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha})`;
      });
    } else if (vizType !== 'bullet') {
      chart.color(d => getColorFromScheme(d[colorKey], fd.color_scheme));
    }
    if ((vizType === 'line' || vizType === 'area') && fd.rich_tooltip) {
      chart.useInteractiveGuideline(true);
      if (vizType === 'line') {
        // Custom sorted tooltip
        chart.interactiveLayer.tooltip.contentGenerator((d) => {
          let tooltip = '';
          tooltip += "<table><thead><tr><td colspan='3'>"
            + `<strong class='x-value'>${xAxisFormatter(d.value)}</strong>`
            + '</td></tr></thead><tbody>';
          d.series.sort((a, b) => a.value >= b.value ? -1 : 1);
          d.series.forEach((series) => {
            tooltip += (
              `<tr class="${series.highlight ? 'emph' : ''}">` +
                `<td class='legend-color-guide' style="opacity: ${series.highlight ? '1' : '0.75'};"">` +
                  '<div ' +
                    `style="border: 2px solid ${series.highlight ? 'black' : 'transparent'}; background-color: ${series.color};"` +
                  '></div>' +
                '</td>' +
                `<td>${series.key}</td>` +
                `<td>${yAxisFormatter(series.value)}</td>` +
              '</tr>'
            );
          });
          tooltip += '</tbody></table>';
          return tooltip;
        });
      }
    }


    if (fd.bottom_margin === 'auto') {
      if (vizType === 'dist_bar') {
        const stretchMargin = calculateStretchMargins(payload);
        chart.margin({ bottom: stretchMargin });
      } else {
        chart.margin({ bottom: 50 });
      }
    } else {
      chart.margin({ bottom: fd.bottom_margin });
    }

    if (vizType === 'dual_line') {
      const yAxisFormatter1 = d3.format(fd.y_axis_format);
      const yAxisFormatter2 = d3.format(fd.y_axis_2_format);
      chart.yAxis1.tickFormat(yAxisFormatter1);
      chart.yAxis2.tickFormat(yAxisFormatter2);
      customizeToolTip(chart, xAxisFormatter, [yAxisFormatter1, yAxisFormatter2]);
      chart.showLegend(width > BREAKPOINTS.small);
    }
    svg
    .datum(data)
    .transition().duration(500)
    .attr('height', height)
    .attr('width', width)
    .call(chart);

    if (fd.show_markers) {
      svg.selectAll('.nv-point')
      .style('stroke-opacity', 1)
      .style('fill-opacity', 1);
    }

    if (chart.yAxis !== undefined || chart.yAxis2 !== undefined) {
      // Hack to adjust y axis left margin to accommodate long numbers
      const marginPad = isExplore ? width * 0.01 : width * 0.03;
      const maxYAxisLabelWidth = chart.yAxis2 ? getMaxLabelSize(slice.container, 'nv-y1')
                                              : getMaxLabelSize(slice.container, 'nv-y');
      const maxXAxisLabelHeight = getMaxLabelSize(slice.container, 'nv-x');
      chart.margin({ left: maxYAxisLabelWidth + marginPad });
      if (fd.y_axis_label && fd.y_axis_label !== '') {
        chart.margin({ left: maxYAxisLabelWidth + marginPad + 25 });
      }
      // Hack to adjust margins to accommodate long axis tick labels.
      // - has to be done only after the chart has been rendered once
      // - measure the width or height of the labels
      // ---- (x axis labels are rotated 45 degrees so we use height),
      // - adjust margins based on these measures and render again
      if (isTimeSeries && vizType !== 'bar') {
        const chartMargins = {
          bottom: maxXAxisLabelHeight + marginPad,
          right: maxXAxisLabelHeight + marginPad,
        };

        if (vizType === 'dual_line') {
          const maxYAxis2LabelWidth = getMaxLabelSize(slice.container, 'nv-y2');
          // use y axis width if it's wider than axis width/height
          if (maxYAxis2LabelWidth > maxXAxisLabelHeight) {
            chartMargins.right = maxYAxis2LabelWidth + marginPad;
          }
        }
        // apply margins
        chart.margin(chartMargins);
      }

      if (fd.x_axis_label && fd.x_axis_label !== '' && chart.xAxis) {
        chart.margin({ bottom: maxXAxisLabelHeight + marginPad + 25 });
      }
      if (fd.bottom_margin && fd.bottom_margin !== 'auto') {
        chart.margin().bottom = fd.bottom_margin;
      }
      if (fd.left_margin && fd.left_margin !== 'auto') {
        chart.margin().left = fd.left_margin;
      }

      // Axis labels
      const margins = chart.margin();
      if (fd.x_axis_label && fd.x_axis_label !== '' && chart.xAxis) {
        let distance = 0;
        if (margins.bottom && !isNaN(margins.bottom)) {
          distance = margins.bottom - 45;
        }
        // nvd3 bug axisLabelDistance is disregarded on xAxis
        // https://github.com/krispo/angular-nvd3/issues/90
        chart.xAxis.axisLabel(fd.x_axis_label).axisLabelDistance(distance);
      }

      if (fd.y_axis_label && fd.y_axis_label !== '' && chart.yAxis) {
        let distance = 0;
        if (margins.left && !isNaN(margins.left)) {
          distance = margins.left - 70;
        }
        chart.yAxis.axisLabel(fd.y_axis_label).axisLabelDistance(distance);
      }

      // render chart
      svg
      .datum(data)
      .transition().duration(500)
      .attr('height', height)
      .attr('width', width)
      .call(chart);

      // add annotation_layer
      if (isTimeSeries && payload.annotations && payload.annotations.length) {
        const tip = d3tip()
          .attr('class', 'd3-tip')
          .direction('n')
          .offset([-5, 0])
          .html((d) => {
            if (!d || !d.layer) {
              return '';
            }

            const title = d.short_descr ?
              d.short_descr + ' - ' + d.layer :
              d.layer;
            const body = d.long_descr;
            return '<div><strong>' + title + '</strong></div><br/>' +
            '<div>' + body + '</div>';
          });

        const hh = chart.yAxis.scale().range()[0];

        let annotationLayer;
        let xScale;
        let minStep;
        if (vizType === 'bar') {
          const xMax = d3.max(payload.data[0].values, d => (d.x));
          const xMin = d3.min(payload.data[0].values, d => (d.x));
          minStep = chart.xAxis.range()[1] - chart.xAxis.range()[0];
          annotationLayer = svg.select('.nv-barsWrap')
            .insert('g', ':first-child');
          xScale = d3.scale.quantile()
            .domain([xMin, xMax])
            .range(chart.xAxis.range());
        } else {
          minStep = 1;
          annotationLayer = svg.select('.nv-background')
            .append('g');
          xScale = chart.xScale();
        }

        annotationLayer
          .attr('class', 'annotation-container')
          .append('defs')
          .append('pattern')
          .attr('id', 'diagonal')
          .attr('patternUnits', 'userSpaceOnUse')
          .attr('width', 8)
          .attr('height', 10)
          .attr('patternTransform', 'rotate(45 50 50)')
          .append('line')
          .attr('stroke-width', 7)
          .attr('y2', 10);

        annotationLayer.selectAll('rect')
          .data(payload.annotations)
          .enter()
          .append('rect')
          .attr('class', 'annotation')
          .attr('x', d => (xScale(d.start_dttm)))
          .attr('y', 0)
          .attr('width', (d) => {
            const w = xScale(d.end_dttm) - xScale(d.start_dttm);
            return w === 0 ? minStep : w;
          })
          .attr('height', hh)
          .attr('fill', 'url(#diagonal)')
          .on('mouseover', tip.show)
          .on('mouseout', tip.hide);

        annotationLayer.selectAll('rect').call(tip);
      }
    }

    // on scroll, hide tooltips. throttle to only 4x/second.
    $(window).scroll(throttle(hideTooltips, 250));

    return chart;
  };

  // hide tooltips before rendering chart, if the chart is being re-rendered sometimes
  // there are left over tooltips in the dom,
  // this will clear them before rendering the chart again.
  hideTooltips();

  nv.addGraph(drawGraph);
}

module.exports = nvd3Vis;
