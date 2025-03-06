/* eslint-disable react/sort-prop-types */
/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { kebabCase, throttle } from 'lodash';
import d3 from 'd3';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import nv from 'nvd3-fork';
import PropTypes from 'prop-types';
import {
  CategoricalColorNamespace,
  evalExpression,
  getNumberFormatter,
  getTimeFormatter,
  isDefined,
  NumberFormats,
  SMART_DATE_VERBOSE_ID,
  t,
  VizType,
} from '@superset-ui/core';

import 'nvd3-fork/build/nv.d3.css';

/* eslint-disable-next-line */
import ANNOTATION_TYPES, {
  applyNativeColumns,
} from './vendor/superset/AnnotationTypes';
import isTruthy from './utils/isTruthy';
import {
  cleanColorInput,
  computeYDomain,
  drawBarValues,
  generateBubbleTooltipContent,
  generateCompareTooltipContent,
  generateTimePivotTooltip,
  generateTooltipClassName,
  getMaxLabelSize,
  getTimeOrNumberFormatter,
  hideTooltips,
  tipFactory,
  removeTooltip,
  setAxisShowMaxMin,
  stringifyTimeRange,
  wrapTooltip,
} from './utils';
import {
  annotationLayerType,
  boxPlotValueType,
  bulletDataType,
  categoryAndValueXYType,
  rgbObjectType,
  numericXYType,
  numberOrAutoType,
  stringOrObjectWithLabelType,
} from './PropTypes';

const NO_DATA_RENDER_DATA = [
  { text: 'No data', dy: '-.75em', class: 'header' },
  {
    text: 'Adjust filters or check the Datasource.',
    dy: '.75em',
    class: 'body',
  },
];

dayjs.extend(utc);

const smartDateVerboseFormatter = getTimeFormatter(SMART_DATE_VERBOSE_ID);

// Override the noData render function to make a prettier UX
// Code adapted from https://github.com/novus/nvd3/blob/master/src/utils.js#L653
nv.utils.noData = function noData(chart, container) {
  const opt = chart.options();
  const margin = opt.margin();
  const height = nv.utils.availableHeight(null, container, margin);
  const width = nv.utils.availableWidth(null, container, margin);
  const x = margin.left + width / 2;
  const y = margin.top + height / 2;

  // Remove any previously created chart components
  container.selectAll('g').remove();

  const noDataText = container
    .selectAll('.nv-noData')
    .data(NO_DATA_RENDER_DATA);

  noDataText
    .enter()
    .append('text')
    .attr('class', d => `nvd3 nv-noData ${d.class}`)
    .attr('dy', d => d.dy)
    .style('text-anchor', 'middle');

  noDataText
    .attr('x', x)
    .attr('y', y)
    .text(d => d.text);
};

const { getColor, getScale } = CategoricalColorNamespace;

// Limit on how large axes margins can grow as the chart window is resized
const MAX_MARGIN_PAD = 30;
const MIN_HEIGHT_FOR_BRUSH = 480;
const MAX_NO_CHARACTERS_IN_LABEL = 40;

const BREAKPOINTS = {
  small: 340,
};

const TIMESERIES_VIZ_TYPES = [VizType.Compare, VizType.TimePivot];

const CHART_ID_PREFIX = 'chart-id-';

const propTypes = {
  data: PropTypes.oneOfType([
    PropTypes.arrayOf(
      PropTypes.oneOfType([
        // pie
        categoryAndValueXYType,
        // dist-bar
        PropTypes.shape({
          key: PropTypes.string,
          values: PropTypes.arrayOf(categoryAndValueXYType),
        }),
        // area, line, compare, bar
        PropTypes.shape({
          key: PropTypes.arrayOf(PropTypes.string),
          values: PropTypes.arrayOf(numericXYType),
        }),
        // dual-line
        PropTypes.shape({
          classed: PropTypes.string,
          key: PropTypes.string,
          type: PropTypes.string,
          values: PropTypes.arrayOf(numericXYType),
          yAxis: PropTypes.number,
        }),
        // box-plot
        PropTypes.shape({
          label: PropTypes.string,
          values: PropTypes.arrayOf(boxPlotValueType),
        }),
        // bubble
        PropTypes.shape({
          key: PropTypes.string,
          values: PropTypes.arrayOf(PropTypes.object),
        }),
      ]),
    ),
    bulletDataType,
  ]),
  width: PropTypes.number,
  height: PropTypes.number,
  annotationData: PropTypes.object,
  annotationLayers: PropTypes.arrayOf(annotationLayerType),
  bottomMargin: numberOrAutoType,
  colorScheme: PropTypes.string,
  comparisonType: PropTypes.string,
  contribution: PropTypes.bool,
  leftMargin: numberOrAutoType,
  onError: PropTypes.func,
  showLegend: PropTypes.bool,
  showMarkers: PropTypes.bool,
  vizType: PropTypes.oneOf([
    VizType.BoxPlot,
    'bubble',
    VizType.Bullet,
    VizType.Compare,
    'column',
    VizType.TimePivot,
    'pie',
  ]),
  xAxisFormat: PropTypes.string,
  numberFormat: PropTypes.string,
  xAxisLabel: PropTypes.string,
  xAxisShowMinMax: PropTypes.bool,
  xIsLogScale: PropTypes.bool,
  xTicksLayout: PropTypes.oneOf(['auto', 'staggered', '45°']),
  yAxisFormat: PropTypes.string,
  yAxisBounds: PropTypes.arrayOf(PropTypes.number),
  yAxisLabel: PropTypes.string,
  yAxisShowMinMax: PropTypes.bool,
  yIsLogScale: PropTypes.bool,
  // 'bar' or 'dist-bar'
  isBarStacked: PropTypes.bool,
  showBarValue: PropTypes.bool,
  // 'line' only
  showBrush: PropTypes.oneOf([true, 'yes', false, 'no', 'auto']),
  onBrushEnd: PropTypes.func,
  // 'line-multi' or 'dual-line'
  yAxis2Format: PropTypes.string,
  // 'line', 'time-pivot', 'dual-line' or 'line-multi'
  lineInterpolation: PropTypes.string,
  // 'pie' only
  isDonut: PropTypes.bool,
  isPieLabelOutside: PropTypes.bool,
  pieLabelType: PropTypes.oneOf([
    'key',
    'value',
    'percent',
    'key_value',
    'key_percent',
    'key_value_percent',
  ]),
  showLabels: PropTypes.bool,
  // 'bubble' only
  entity: PropTypes.string,
  maxBubbleSize: PropTypes.number,
  xField: stringOrObjectWithLabelType,
  yField: stringOrObjectWithLabelType,
  sizeField: stringOrObjectWithLabelType,
  // time-pivot only
  baseColor: rgbObjectType,
};

const NOOP = () => {};
const formatter = getNumberFormatter();

function nvd3Vis(element, props) {
  const {
    data,
    width: maxWidth,
    height: maxHeight,
    annotationData,
    annotationLayers = [],
    baseColor,
    bottomMargin,
    colorScheme,
    comparisonType,
    contribution,
    entity,
    isBarStacked,
    isDonut,
    isPieLabelOutside,
    leftMargin,
    lineInterpolation = 'linear',
    markerLabels,
    markerLines,
    markerLineLabels,
    markers,
    maxBubbleSize,
    onBrushEnd = NOOP,
    onError = NOOP,
    pieLabelType,
    rangeLabels,
    ranges,
    showBarValue,
    showBrush,
    showLabels,
    showLegend,
    showMarkers,
    sizeField,
    vizType,
    xAxisFormat,
    numberFormat,
    xAxisLabel,
    xAxisShowMinMax = false,
    xField,
    xIsLogScale,
    xTicksLayout,
    yAxisFormat,
    yAxisBounds,
    yAxisLabel,
    yAxisShowMinMax = false,
    yAxis2ShowMinMax = false,
    yField,
    yIsLogScale,
    sliceId,
  } = props;

  const isExplore = document.querySelector('#explorer-container') !== null;
  const container = element;
  container.innerHTML = '';
  const activeAnnotationLayers = annotationLayers.filter(layer => layer.show);

  // Search for the chart id in a parent div from the nvd3 chart
  let chartContainer = container;
  let chartId = null;
  while (chartContainer.parentElement) {
    if (chartContainer.parentElement.id.startsWith(CHART_ID_PREFIX)) {
      chartId = chartContainer.parentElement.id;
      break;
    }

    chartContainer = chartContainer.parentElement;
  }

  let chart;
  const width = maxWidth;
  let colorKey = 'key';

  container.style.width = `${maxWidth}px`;
  container.style.height = `${maxHeight}px`;

  function isVizTypes(types) {
    return types.includes(vizType);
  }

  const drawGraph = function drawGraph() {
    const d3Element = d3.select(element);
    d3Element.classed('superset-legacy-chart-nvd3', true);
    d3Element.classed(`superset-legacy-chart-nvd3-${kebabCase(vizType)}`, true);
    let svg = d3Element.select('svg');
    if (svg.empty()) {
      svg = d3Element.append('svg');
    }
    const height =
      vizType === VizType.Bullet ? Math.min(maxHeight, 50) : maxHeight;
    const isTimeSeries = isVizTypes(TIMESERIES_VIZ_TYPES);

    // Handling xAxis ticks settings
    const staggerLabels = xTicksLayout === 'staggered';
    const xLabelRotation = xTicksLayout === '45°' ? 45 : 0;
    if (xLabelRotation === 45 && isTruthy(showBrush)) {
      onError(
        t('You cannot use 45° tick layout along with the time range filter'),
      );

      return null;
    }

    const canShowBrush =
      isTruthy(showBrush) ||
      (showBrush === 'auto' &&
        maxHeight >= MIN_HEIGHT_FOR_BRUSH &&
        xTicksLayout !== '45°');
    const numberFormatter = getNumberFormatter(numberFormat);

    switch (vizType) {
      case VizType.TimePivot:
        chart = nv.models.lineChart();
        chart.xScale(d3.time.scale.utc());
        chart.interpolate(lineInterpolation);
        break;

      case VizType.Pie:
        chart = nv.models.pieChart();
        colorKey = 'x';
        chart.valueFormat(numberFormatter);
        if (isDonut) {
          chart.donut(true);
        }
        chart.showLabels(showLabels);
        chart.labelsOutside(isPieLabelOutside);
        // Configure the minimum slice size for labels to show up
        chart.labelThreshold(0.05);
        chart.cornerRadius(true);

        if (['key', 'value', 'percent'].includes(pieLabelType)) {
          chart.labelType(pieLabelType);
        } else if (pieLabelType === 'key_value') {
          chart.labelType(d => `${d.data.x}: ${numberFormatter(d.data.y)}`);
        } else {
          // pieLabelType in ['key_percent', 'key_value_percent']
          const total = d3.sum(data, d => d.y);
          const percentFormatter = getNumberFormatter(
            NumberFormats.PERCENT_2_POINT,
          );
          if (pieLabelType === 'key_percent') {
            chart.tooltip.valueFormatter(d => percentFormatter(d));
            chart.labelType(
              d => `${d.data.x}: ${percentFormatter(d.data.y / total)}`,
            );
          } else {
            // pieLabelType === 'key_value_percent'
            chart.tooltip.valueFormatter(
              d => `${numberFormatter(d)} (${percentFormatter(d / total)})`,
            );
            chart.labelType(
              d =>
                `${d.data.x}: ${numberFormatter(d.data.y)} (${percentFormatter(
                  d.data.y / total,
                )})`,
            );
          }
        }
        // Pie chart does not need top margin
        chart.margin({ top: 0 });
        break;

      case 'column':
        chart = nv.models.multiBarChart().reduceXTicks(false);
        break;

      case VizType.Compare:
        chart = nv.models.cumulativeLineChart();
        chart.xScale(d3.time.scale.utc());
        chart.useInteractiveGuideline(true);
        chart.xAxis.showMaxMin(false);
        break;

      case VizType.LegacyBubble:
        chart = nv.models.scatterChart();
        chart.showDistX(false);
        chart.showDistY(false);
        chart.tooltip.contentGenerator(d =>
          generateBubbleTooltipContent({
            point: d.point,
            entity,
            xField,
            yField,
            sizeField,
            xFormatter: getTimeOrNumberFormatter(xAxisFormat),
            yFormatter: getTimeOrNumberFormatter(yAxisFormat),
            sizeFormatter: formatter,
          }),
        );
        chart.pointRange([5, maxBubbleSize ** 2]);
        chart.pointDomain([
          0,
          d3.max(data, d => d3.max(d.values, v => v.size)),
        ]);
        break;

      case VizType.BoxPlot:
        colorKey = 'label';
        chart = nv.models.boxPlotChart();
        chart.x(d => d.label);
        chart.maxBoxWidth(75); // prevent boxes from being incredibly wide
        break;

      case VizType.Bullet:
        chart = nv.models.bulletChart();
        data.rangeLabels = rangeLabels;
        data.ranges = ranges;
        data.markerLabels = markerLabels;
        data.markerLines = markerLines;
        data.markerLineLabels = markerLineLabels;
        data.markers = markers;
        break;

      default:
        throw new Error(`Unrecognized visualization for nvd3${vizType}`);
    }
    // Assuming the container has padding already other than for top margin
    chart.margin({ left: 0, bottom: 0 });

    if (showBarValue) {
      drawBarValues(svg, data, isBarStacked, yAxisFormat);
      chart.dispatch.on('stateChange.drawBarValues', () => {
        drawBarValues(svg, data, isBarStacked, yAxisFormat);
      });
    }

    if (canShowBrush && onBrushEnd !== NOOP) {
      if (chart.focus) {
        chart.focus.dispatch.on('brush', event => {
          const timeRange = stringifyTimeRange(event.extent);
          if (timeRange) {
            event.brush.on('brushend', () => {
              onBrushEnd(timeRange);
            });
          }
        });
      }
    }

    if (chart.xAxis && chart.xAxis.staggerLabels) {
      chart.xAxis.staggerLabels(staggerLabels);
    }
    if (chart.xAxis && chart.xAxis.rotateLabels) {
      chart.xAxis.rotateLabels(xLabelRotation);
    }
    if (chart.x2Axis && chart.x2Axis.staggerLabels) {
      chart.x2Axis.staggerLabels(staggerLabels);
    }
    if (chart.x2Axis && chart.x2Axis.rotateLabels) {
      chart.x2Axis.rotateLabels(xLabelRotation);
    }

    if ('showLegend' in chart && typeof showLegend !== 'undefined') {
      if (width < BREAKPOINTS.small && vizType !== VizType.Pie) {
        chart.showLegend(false);
      } else {
        chart.showLegend(showLegend);
      }
    }

    if (yIsLogScale) {
      chart.yScale(d3.scale.log());
    }
    if (xIsLogScale) {
      chart.xScale(d3.scale.log());
    }

    let xAxisFormatter;
    if (isTimeSeries) {
      xAxisFormatter = getTimeFormatter(xAxisFormat);
      // In tooltips, always use the verbose time format
      chart.interactiveLayer.tooltip.headerFormatter(smartDateVerboseFormatter);
    } else {
      xAxisFormatter = getTimeOrNumberFormatter(xAxisFormat);
    }
    if (chart.x2Axis && chart.x2Axis.tickFormat) {
      chart.x2Axis.tickFormat(xAxisFormatter);
    }
    if (chart.xAxis && chart.xAxis.tickFormat) {
      const isXAxisString = isVizTypes([VizType.BoxPlot]);
      if (isXAxisString) {
        chart.xAxis.tickFormat(d =>
          d.length > MAX_NO_CHARACTERS_IN_LABEL
            ? `${d.slice(0, Math.max(0, MAX_NO_CHARACTERS_IN_LABEL))}…`
            : d,
        );
      } else {
        chart.xAxis.tickFormat(xAxisFormatter);
      }
    }

    let yAxisFormatter = getTimeOrNumberFormatter(yAxisFormat);
    if (chart.yAxis && chart.yAxis.tickFormat) {
      if (
        (contribution || comparisonType === 'percentage') &&
        (!yAxisFormat ||
          yAxisFormat === NumberFormats.SMART_NUMBER ||
          yAxisFormat === NumberFormats.SMART_NUMBER_SIGNED)
      ) {
        // When computing a "Percentage" or "Contribution" selected,
        // force a percentage format if no custom formatting set
        yAxisFormatter = getNumberFormatter(NumberFormats.PERCENT_1_POINT);
      }
      chart.yAxis.tickFormat(yAxisFormatter);
    }
    if (chart.y2Axis && chart.y2Axis.tickFormat) {
      chart.y2Axis.tickFormat(yAxisFormatter);
    }

    if (chart.yAxis) {
      chart.yAxis.ticks(5);
    }
    if (chart.y2Axis) {
      chart.y2Axis.ticks(5);
    }

    // Set showMaxMin for all axis
    setAxisShowMaxMin(chart.xAxis, xAxisShowMinMax);
    setAxisShowMaxMin(chart.x2Axis, xAxisShowMinMax);
    setAxisShowMaxMin(chart.yAxis, yAxisShowMinMax);
    setAxisShowMaxMin(chart.y2Axis, yAxis2ShowMinMax || yAxisShowMinMax);

    if (vizType === VizType.TimePivot) {
      if (baseColor) {
        const { r, g, b } = baseColor;
        chart.color(d => {
          const alpha = d.rank > 0 ? d.perc * 0.5 : 1;

          return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        });
      }

      chart.useInteractiveGuideline(true);
      chart.interactiveLayer.tooltip.contentGenerator(d =>
        generateTimePivotTooltip(d, xAxisFormatter, yAxisFormatter),
      );
    } else if (vizType !== VizType.Bullet) {
      const colorFn = getScale(colorScheme);
      chart.color(
        d => d.color || colorFn(cleanColorInput(d[colorKey]), sliceId),
      );
    }

    if (isVizTypes([VizType.Compare])) {
      chart.interactiveLayer.tooltip.contentGenerator(d =>
        generateCompareTooltipContent(d, yAxisFormatter),
      );
    }

    // This is needed for correct chart dimensions if a chart is rendered in a hidden container
    chart.width(width);
    chart.height(height);

    svg
      .datum(data)
      .transition()
      .duration(500)
      .attr('height', height)
      .attr('width', width)
      .call(chart);

    // For log scale, only show 1, 10, 100, 1000, ...
    if (yIsLogScale) {
      chart.yAxis.tickFormat(d =>
        d !== 0 && Math.log10(d) % 1 === 0 ? yAxisFormatter(d) : '',
      );
    }

    if (xLabelRotation > 0) {
      // shift labels to the left so they look better
      const xTicks = svg.select('.nv-x.nv-axis > g').selectAll('g');
      xTicks.selectAll('text').attr('dx', -6.5);
    }

    const applyYAxisBounds = () => {
      if (
        chart.yDomain &&
        Array.isArray(yAxisBounds) &&
        yAxisBounds.length === 2
      ) {
        const [customMin, customMax] = yAxisBounds;
        const hasCustomMin = isDefined(customMin) && !Number.isNaN(customMin);
        const hasCustomMax = isDefined(customMax) && !Number.isNaN(customMax);

        if (hasCustomMin && hasCustomMax) {
          // Override the y domain if there's both a custom min and max
          chart.yDomain([customMin, customMax]);
          chart.clipEdge(true);
        } else if (hasCustomMin || hasCustomMax) {
          // Only one of the bounds has been set, so we need to manually calculate the other one
          const [trueMin, trueMax] = computeYDomain(data);
          const min = hasCustomMin ? customMin : trueMin;
          const max = hasCustomMax ? customMax : trueMax;
          chart.yDomain([min, max]);
          chart.clipEdge(true);
        }
      }
    };
    applyYAxisBounds();

    // Also reapply on each state change to account for enabled/disabled series
    if (chart.dispatch && chart.dispatch.stateChange) {
      chart.dispatch.on('stateChange.applyYAxisBounds', applyYAxisBounds);
    }

    if (showMarkers) {
      svg
        .selectAll('.nv-point')
        .style('stroke-opacity', 1)
        .style('fill-opacity', 1);

      // redo on legend toggle; nvd3 calls the callback *before* the line is
      // drawn, so we need to add a small delay here
      chart.dispatch.on('stateChange.showMarkers', () => {
        setTimeout(() => {
          svg
            .selectAll('.nv-point')
            .style('stroke-opacity', 1)
            .style('fill-opacity', 1);
        }, 10);
      });
    }

    if (chart.yAxis !== undefined || chart.yAxis2 !== undefined) {
      // Hack to adjust y axis left margin to accommodate long numbers
      const marginPad = Math.ceil(
        Math.min(maxWidth * (isExplore ? 0.01 : 0.03), MAX_MARGIN_PAD),
      );
      // Hack to adjust margins to accommodate long axis tick labels.
      // - has to be done only after the chart has been rendered once
      // - measure the width or height of the labels
      // ---- (x axis labels are rotated 45 degrees so we use height),
      // - adjust margins based on these measures and render again
      const margins = chart.margin();
      if (chart.xAxis) {
        margins.bottom = 28;
      }
      const maxYAxisLabelWidth = getMaxLabelSize(
        svg,
        chart.yAxis2 ? 'nv-y1' : 'nv-y',
      );
      const maxXAxisLabelHeight = getMaxLabelSize(svg, 'nv-x');
      margins.left = maxYAxisLabelWidth + marginPad;

      if (yAxisLabel && yAxisLabel !== '') {
        margins.left += 25;
      }
      if (showBarValue) {
        // Add more margin to avoid label colliding with legend.
        margins.top += 24;
      }
      if (xAxisShowMinMax) {
        // If x bounds are shown, we need a right margin
        margins.right = Math.max(20, maxXAxisLabelHeight / 2) + marginPad;
      }
      if (xLabelRotation === 45) {
        margins.bottom =
          maxXAxisLabelHeight * Math.sin((Math.PI * xLabelRotation) / 180) +
          marginPad +
          30;
        margins.right =
          maxXAxisLabelHeight * Math.cos((Math.PI * xLabelRotation) / 180) +
          marginPad;
      } else if (staggerLabels) {
        margins.bottom = 40;
      }

      if (bottomMargin && bottomMargin !== 'auto') {
        margins.bottom = parseInt(bottomMargin, 10);
      }
      if (leftMargin && leftMargin !== 'auto') {
        margins.left = leftMargin;
      }

      if (xAxisLabel && xAxisLabel !== '' && chart.xAxis) {
        margins.bottom += 25;
        let distance = 0;
        if (margins.bottom && !Number.isNaN(margins.bottom)) {
          distance = margins.bottom - 45;
        }
        // nvd3 bug axisLabelDistance is disregarded on xAxis
        // https://github.com/krispo/angular-nvd3/issues/90
        chart.xAxis.axisLabel(xAxisLabel).axisLabelDistance(distance);
      }

      if (yAxisLabel && yAxisLabel !== '' && chart.yAxis) {
        let distance = 0;
        if (margins.left && !Number.isNaN(margins.left)) {
          distance = margins.left - 70;
        }
        chart.yAxis.axisLabel(yAxisLabel).axisLabelDistance(distance);
      }
      if (isTimeSeries && annotationData && activeAnnotationLayers.length > 0) {
        // Time series annotations add additional data
        const timeSeriesAnnotations = activeAnnotationLayers
          .filter(
            layer => layer.annotationType === ANNOTATION_TYPES.TIME_SERIES,
          )
          .reduce(
            (bushel, a) =>
              bushel.concat(
                (annotationData[a.name] || []).map(series => {
                  if (!series) {
                    return {};
                  }
                  const key = Array.isArray(series.key)
                    ? `${a.name}, ${series.key.join(', ')}`
                    : `${a.name}, ${series.key}`;

                  return {
                    ...series,
                    key,
                    color: a.color,
                    strokeWidth: a.width,
                    classed: `${a.opacity} ${a.style} nv-timeseries-annotation-layer showMarkers${a.showMarkers} hideLine${a.hideLine}`,
                  };
                }),
              ),
            [],
          );
        data.push(...timeSeriesAnnotations);
      }

      // Uniquely identify tooltips based on chartId so this chart instance only
      // controls its own tooltips
      if (chartId) {
        if (chart && chart.interactiveLayer && chart.interactiveLayer.tooltip) {
          chart.interactiveLayer.tooltip.classes([
            generateTooltipClassName(chartId),
          ]);
        }

        if (chart && chart.tooltip) {
          chart.tooltip.classes([generateTooltipClassName(chartId)]);
        }
      }

      // render chart
      chart.margin(margins);
      svg
        .datum(data)
        .transition()
        .duration(500)
        .attr('width', width)
        .attr('height', height)
        .call(chart);

      // On scroll, hide (not remove) tooltips so they can reappear on hover.
      // Throttle to only 4x/second.
      window.addEventListener(
        'scroll',
        throttle(() => hideTooltips(false), 250),
      );

      // The below code should be run AFTER rendering because chart is updated in call()
      if (isTimeSeries && activeAnnotationLayers.length > 0) {
        // Formula annotations
        const formulas = activeAnnotationLayers.filter(
          a => a.annotationType === ANNOTATION_TYPES.FORMULA,
        );

        const xMax = chart.xAxis.scale().domain()[1].valueOf();
        const xMin = chart.xAxis.scale().domain()[0].valueOf();
        let xScale;
        if (chart.xScale) {
          xScale = chart.xScale();
        } else if (chart.xAxis.scale) {
          xScale = chart.xAxis.scale();
        } else {
          xScale = d3.scale.linear();
        }
        if (xScale && xScale.clamp) {
          xScale.clamp(true);
        }

        if (formulas.length > 0) {
          const xValues = [];
          let period = Math.min(
            ...data.map(d =>
              Math.min(...d.values.slice(1).map((v, i) => v.x - d.values[i].x)),
            ),
          );
          const dataPoints = (xMax - xMin) / (period || 1);
          // make sure that there are enough data points and not too many
          period = dataPoints < 100 ? (xMax - xMin) / 100 : period;
          period = dataPoints > 500 ? (xMax - xMin) / 500 : period;
          xValues.push(xMin);
          for (let x = xMin; x < xMax; x += period) {
            xValues.push(x);
          }
          xValues.push(xMax);

          const formulaData = formulas.map(fo => {
            const { value: expression } = fo;
            return {
              key: fo.name,
              values: xValues.map(x => ({
                x,
                y: evalExpression(expression, x),
              })),
              color: fo.color,
              strokeWidth: fo.width,
              classed: `${fo.opacity} ${fo.style}`,
            };
          });
          data.push(...formulaData);
        }
        const xAxis = chart.xAxis1 ? chart.xAxis1 : chart.xAxis;
        const yAxis = chart.yAxis1 ? chart.yAxis1 : chart.yAxis;
        const chartWidth = xAxis.scale().range()[1];
        const annotationHeight = yAxis.scale().range()[0];

        if (annotationData) {
          // Event annotations
          activeAnnotationLayers
            .filter(
              x =>
                x.annotationType === ANNOTATION_TYPES.EVENT &&
                annotationData &&
                annotationData[x.name],
            )
            .forEach((config, index) => {
              const e = applyNativeColumns(config);
              // Add event annotation layer
              const annotations = d3
                .select(element)
                .select('.nv-wrap')
                .append('g')
                .attr('class', `nv-event-annotation-layer-${index}`);
              const aColor =
                e.color || getColor(cleanColorInput(e.name), colorScheme);

              const tip = tipFactory({
                ...e,
                annotationTipClass: `arrow-down nv-event-annotation-layer-${config.sourceType}`,
              });
              const records = (annotationData[e.name].records || [])
                .map(r => {
                  const timeValue = new Date(dayjs.utc(r[e.timeColumn]));

                  return {
                    ...r,
                    [e.timeColumn]: timeValue,
                  };
                })
                .filter(
                  record =>
                    !Number.isNaN(record[e.timeColumn].getMilliseconds()),
                );

              if (records.length > 0) {
                annotations
                  .selectAll('line')
                  .data(records)
                  .enter()
                  .append('line')
                  .attr({
                    x1: d => xScale(new Date(d[e.timeColumn])),
                    y1: 0,
                    x2: d => xScale(new Date(d[e.timeColumn])),
                    y2: annotationHeight,
                  })
                  .attr('class', `${e.opacity} ${e.style}`)
                  .style('stroke', aColor)
                  .style('stroke-width', e.width)
                  .on('mouseover', tip.show)
                  .on('mouseout', tip.hide)
                  .call(tip);
              }

              // update annotation positions on brush event
              if (chart.focus) {
                chart.focus.dispatch.on('onBrush.event-annotation', () => {
                  annotations
                    .selectAll('line')
                    .data(records)
                    .attr({
                      x1: d => xScale(new Date(d[e.timeColumn])),
                      y1: 0,
                      x2: d => xScale(new Date(d[e.timeColumn])),
                      y2: annotationHeight,
                      opacity: d => {
                        const x = xScale(new Date(d[e.timeColumn]));

                        return x > 0 && x < chartWidth ? 1 : 0;
                      },
                    });
                });
              }
            });

          // Interval annotations
          activeAnnotationLayers
            .filter(
              x =>
                x.annotationType === ANNOTATION_TYPES.INTERVAL &&
                annotationData &&
                annotationData[x.name],
            )
            .forEach((config, index) => {
              const e = applyNativeColumns(config);
              // Add interval annotation layer
              const annotations = d3
                .select(element)
                .select('.nv-wrap')
                .append('g')
                .attr('class', `nv-interval-annotation-layer-${index}`);

              const aColor =
                e.color || getColor(cleanColorInput(e.name), colorScheme);
              const tip = tipFactory(e);

              const records = (annotationData[e.name].records || [])
                .map(r => {
                  const timeValue = new Date(dayjs.utc(r[e.timeColumn]));
                  const intervalEndValue = new Date(
                    dayjs.utc(r[e.intervalEndColumn]),
                  );

                  return {
                    ...r,
                    [e.timeColumn]: timeValue,
                    [e.intervalEndColumn]: intervalEndValue,
                  };
                })
                .filter(
                  record =>
                    !Number.isNaN(record[e.timeColumn].getMilliseconds()) &&
                    !Number.isNaN(
                      record[e.intervalEndColumn].getMilliseconds(),
                    ),
                );

              if (records.length > 0) {
                annotations
                  .selectAll('rect')
                  .data(records)
                  .enter()
                  .append('rect')
                  .attr({
                    x: d =>
                      Math.min(
                        xScale(new Date(d[e.timeColumn])),
                        xScale(new Date(d[e.intervalEndColumn])),
                      ),
                    y: 0,
                    width: d =>
                      Math.max(
                        Math.abs(
                          xScale(new Date(d[e.intervalEndColumn])) -
                            xScale(new Date(d[e.timeColumn])),
                        ),
                        1,
                      ),
                    height: annotationHeight,
                  })
                  .attr('class', `${e.opacity} ${e.style}`)
                  .style('stroke-width', e.width)
                  .style('stroke', aColor)
                  .style('fill', aColor)
                  .style('fill-opacity', 0.2)
                  .on('mouseover', tip.show)
                  .on('mouseout', tip.hide)
                  .call(tip);
              }

              // update annotation positions on brush event
              if (chart.focus) {
                chart.focus.dispatch.on('onBrush.interval-annotation', () => {
                  annotations
                    .selectAll('rect')
                    .data(records)
                    .attr({
                      x: d => xScale(new Date(d[e.timeColumn])),
                      width: d => {
                        const x1 = xScale(new Date(d[e.timeColumn]));
                        const x2 = xScale(new Date(d[e.intervalEndColumn]));

                        return x2 - x1;
                      },
                    });
                });
              }
            });
        }

        // rerender chart appended with annotation layer
        svg.datum(data).attr('height', height).attr('width', width).call(chart);

        // Display styles for Time Series Annotations
        chart.dispatch.on('renderEnd.timeseries-annotation', () => {
          d3.selectAll(
            '.slice_container .nv-timeseries-annotation-layer.showMarkerstrue .nv-point',
          )
            .style('stroke-opacity', 1)
            .style('fill-opacity', 1);
          d3.selectAll(
            '.slice_container .nv-timeseries-annotation-layer.hideLinetrue',
          ).style('stroke-width', 0);
        });
      }
    }

    wrapTooltip(chart);

    return chart;
  };

  // Remove tooltips before rendering chart, if the chart is being re-rendered sometimes
  // there are left over tooltips in the dom,
  // this will clear them before rendering the chart again.
  if (chartId) {
    removeTooltip(chartId);
  } else {
    hideTooltips(true);
  }

  nv.addGraph(drawGraph);
}

nvd3Vis.displayName = 'NVD3';
nvd3Vis.propTypes = propTypes;
export default nvd3Vis;
