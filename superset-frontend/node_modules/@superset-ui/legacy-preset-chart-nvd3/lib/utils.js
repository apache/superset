"use strict";

exports.__esModule = true;
exports.cleanColorInput = cleanColorInput;
exports.getTimeOrNumberFormatter = getTimeOrNumberFormatter;
exports.drawBarValues = drawBarValues;
exports.generateRichLineTooltipContent = generateRichLineTooltipContent;
exports.generateAreaChartTooltipContent = generateAreaChartTooltipContent;
exports.generateMultiLineTooltipContent = generateMultiLineTooltipContent;
exports.generateTimePivotTooltip = generateTimePivotTooltip;
exports.generateBubbleTooltipContent = generateBubbleTooltipContent;
exports.hideTooltips = hideTooltips;
exports.generateTooltipClassName = generateTooltipClassName;
exports.removeTooltip = removeTooltip;
exports.wrapTooltip = wrapTooltip;
exports.tipFactory = tipFactory;
exports.getMaxLabelSize = getMaxLabelSize;
exports.formatLabel = formatLabel;
exports.computeBarChartWidth = computeBarChartWidth;
exports.tryNumify = tryNumify;
exports.stringifyTimeRange = stringifyTimeRange;
exports.setAxisShowMaxMin = setAxisShowMaxMin;
exports.computeYDomain = computeYDomain;
exports.computeStackedYDomain = computeStackedYDomain;

var _d = _interopRequireDefault(require("d3"));

var _d3Tip = _interopRequireDefault(require("d3-tip"));

var _dompurify = _interopRequireDefault(require("dompurify"));

var _numberFormat = require("@superset-ui/number-format");

var _timeFormat = require("@superset-ui/time-format");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

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
// Regexp for the label added to time shifted series
// (1 hour offset, 2 days offset, etc.)
const TIME_SHIFT_PATTERN = /\d+ \w+ offset/;
const ANIMATION_TIME = 1000;

function cleanColorInput(value) {
  // for superset series that should have the same color
  return String(value).trim().replace(' (right axis)', '').split(', ').filter(k => !TIME_SHIFT_PATTERN.test(k)).join(', ');
}
/**
 * If format is smart_date, format date
 * Otherwise, format number with the given format name
 * @param {*} format
 */


function getTimeOrNumberFormatter(format) {
  return format === 'smart_date' ? _timeFormat.smartDateFormatter : (0, _numberFormat.getNumberFormatter)(format);
}

function drawBarValues(svg, data, stacked, axisFormat) {
  const format = (0, _numberFormat.getNumberFormatter)(axisFormat);
  const countSeriesDisplayed = data.filter(d => !d.disabled).length;
  const totalStackedValues = stacked && data.length !== 0 ? data[0].values.map((bar, iBar) => {
    const bars = data.filter(series => !series.disabled).map(series => series.values[iBar]);
    return _d.default.sum(bars, d => d.y);
  }) : [];
  svg.selectAll('.bar-chart-label-group').remove();
  setTimeout(() => {
    const groupLabels = svg.select('g.nv-barsWrap').append('g').attr('class', 'bar-chart-label-group');
    svg.selectAll('g.nv-group').filter((d, i) => !stacked || i === countSeriesDisplayed - 1).selectAll('rect').each(function each(d, index) {
      const rectObj = _d.default.select(this);

      const transformAttr = rectObj.attr('transform');
      const xPos = parseFloat(rectObj.attr('x'));
      const yPos = parseFloat(rectObj.attr('y'));
      const rectWidth = parseFloat(rectObj.attr('width'));
      const rectHeight = parseFloat(rectObj.attr('height'));
      const textEls = groupLabels.append('text').text(format(stacked ? totalStackedValues[index] : d.y)).attr('transform', transformAttr).attr('class', 'bar-chart-label'); // fine tune text position

      const bbox = textEls.node().getBBox();
      const labelWidth = bbox.width;
      const labelHeight = bbox.height;
      textEls.attr('x', xPos + rectWidth / 2 - labelWidth / 2);

      if (rectObj.attr('class').includes('positive')) {
        textEls.attr('y', yPos - 5);
      } else {
        textEls.attr('y', yPos + rectHeight + labelHeight);
      }
    });
  }, ANIMATION_TIME);
} // Formats the series key to account for a possible NULL value


function getFormattedKey(seriesKey, shouldDompurify) {
  if (seriesKey === '<NULL>') {
    return "&lt;" + seriesKey.slice(1, -1) + "&gt;";
  }

  return shouldDompurify ? _dompurify.default.sanitize(seriesKey) : seriesKey;
} // Custom sorted tooltip
// use a verbose formatter for times


function generateRichLineTooltipContent(d, timeFormatter, valueFormatter) {
  let tooltip = '';
  tooltip += "<table><thead><tr><td colspan='3'>" + ("<strong class='x-value'>" + timeFormatter(d.value) + "</strong>") + '</td></tr></thead><tbody>';
  d.series.sort((a, b) => a.value >= b.value ? -1 : 1);
  d.series.forEach(series => {
    const key = getFormattedKey(series.key, true);
    tooltip += "<tr class=\"" + (series.highlight ? 'emph' : '') + "\">" + ("<td class='legend-color-guide' style=\"opacity: " + (series.highlight ? '1' : '0.75') + ";\"\">") + '<div ' + ("style=\"border: 2px solid " + (series.highlight ? 'black' : 'transparent') + "; background-color: " + series.color + ";\"") + '></div>' + '</td>' + ("<td>" + key + "</td>") + ("<td>" + valueFormatter(series.value) + "</td>") + '</tr>';
  });
  tooltip += '</tbody></table>';
  return _dompurify.default.sanitize(tooltip);
}

function generateAreaChartTooltipContent(d, timeFormatter, valueFormatter) {
  const total = d.series[d.series.length - 1].value;
  let tooltip = '';
  tooltip += "<table><thead><tr><td colspan='4'>" + ("<strong class='x-value'>" + timeFormatter(d.value) + "</strong>") + '</td></tr></thead><tbody>' + '<tr class="tooltip-header"><td></td><td>Category</td><td>Value</td><td>% to total</td></tr>';
  d.series.forEach(series => {
    const key = getFormattedKey(series.key, true);
    let trClass = '';

    if (series.highlight) {
      trClass = 'superset-legacy-chart-nvd3-tr-highlight';
    } else if (series.key === 'TOTAL') {
      trClass = 'superset-legacy-chart-nvd3-tr-total';
    }

    tooltip += "<tr class=\"" + trClass + "\" style=\"border-color: " + series.color + "\">" + ("<td style=\"color: " + series.color + "\">" + (series.key === 'TOTAL' ? '' : '&#9724;') + "</td>") + ("<td>" + key + "</td>") + ("<td>" + valueFormatter(series.value) + "</td>") + ("<td>" + (100 * series.value / total).toFixed(2) + "%</td>") + '</tr>';
  });
  tooltip += '</tbody></table>';
  return _dompurify.default.sanitize(tooltip);
}

function generateMultiLineTooltipContent(d, xFormatter, yFormatters) {
  const tooltipTitle = xFormatter(d.value);
  let tooltip = '';
  tooltip += "<table><thead><tr><td colspan='3'>" + ("<strong class='x-value'>" + tooltipTitle + "</strong>") + '</td></tr></thead><tbody>';
  d.series.forEach((series, i) => {
    const yFormatter = yFormatters[i];
    const key = getFormattedKey(series.key, false);
    tooltip += "<tr><td class='legend-color-guide'>" + ("<div style=\"background-color: " + series.color + ";\"></div></td>") + ("<td class='key'>" + key + "</td>") + ("<td class='value'>" + yFormatter(series.value) + "</td></tr>");
  });
  tooltip += '</tbody></table>';
  return tooltip;
}

function generateTimePivotTooltip(d, xFormatter, yFormatter) {
  const tooltipTitle = xFormatter(d.value);
  let tooltip = '';
  tooltip += "<table><thead><tr><td colspan='3'>" + ("<strong class='x-value'>" + tooltipTitle + "</strong>") + '</td></tr></thead><tbody>';
  d.series.forEach(series => {
    if (series.highlight) {
      let label = '';

      if (series.key === 'current') {
        label = series.key;
      } else {
        label = series.key + " of the selected frequency:";
      }

      tooltip += "<tr><td class='legend-color-guide'>" + ("<div style=\"background-color: " + series.color + ";\"></div></td>") + ("<td class='key'>" + label + "</td>") + ("<td class='value'>" + yFormatter(series.value) + "</td></tr>");
    }
  });
  tooltip += '</tbody></table>';
  return _dompurify.default.sanitize(tooltip);
}

function getLabel(stringOrObjectWithLabel) {
  return stringOrObjectWithLabel.label || stringOrObjectWithLabel;
}

function createHTMLRow(col1, col2) {
  return "<tr><td>" + col1 + "</td><td>" + col2 + "</td></tr>";
}

function generateBubbleTooltipContent({
  point,
  entity,
  xField,
  yField,
  sizeField,
  xFormatter,
  yFormatter,
  sizeFormatter
}) {
  let s = '<table>';
  s += "<tr><td style=\"color: " + point.color + ";\">" + ("<strong>" + point[entity] + "</strong> (" + point.group + ")") + '</td></tr>';
  s += createHTMLRow(getLabel(xField), xFormatter(point.x));
  s += createHTMLRow(getLabel(yField), yFormatter(point.y));
  s += createHTMLRow(getLabel(sizeField), sizeFormatter(point.size));
  s += '</table>';
  return s;
} // shouldRemove indicates whether the nvtooltips should be removed from the DOM


function hideTooltips(shouldRemove) {
  const targets = document.querySelectorAll('.nvtooltip');

  if (targets.length > 0) {
    // Only set opacity to 0 when hiding tooltips so they would reappear
    // on hover, which sets the opacity to 1
    targets.forEach(t => {
      if (shouldRemove) {
        t.remove();
      } else {
        // eslint-disable-next-line no-param-reassign
        t.style.opacity = 0;
      }
    });
  }
}

function generateTooltipClassName(uuid) {
  return "tooltip-" + uuid;
}

function removeTooltip(uuid) {
  const classSelector = "." + generateTooltipClassName(uuid);
  const target = document.querySelector(classSelector);

  if (target) {
    target.remove();
  }
}

function wrapTooltip(chart, maxWidth) {
  const tooltipLayer = chart.useInteractiveGuideline && chart.useInteractiveGuideline() ? chart.interactiveLayer : chart;
  const tooltipGeneratorFunc = tooltipLayer.tooltip.contentGenerator();
  tooltipLayer.tooltip.contentGenerator(d => {
    let tooltip = "<div style=\"max-width: " + maxWidth * 0.5 + "px\">";
    tooltip += tooltipGeneratorFunc(d);
    tooltip += '</div>';
    return tooltip;
  });
}

function tipFactory(layer) {
  return (0, _d3Tip.default)().attr('class', "d3-tip " + (layer.annotationTipClass || '')).direction('n').offset([-5, 0]).html(d => {
    if (!d) {
      return '';
    }

    const title = d[layer.titleColumn] && d[layer.titleColumn].length > 0 ? d[layer.titleColumn] + " - " + layer.name : layer.name;
    const body = Array.isArray(layer.descriptionColumns) ? layer.descriptionColumns.map(c => d[c]) : Object.values(d);
    return "<div><strong>" + title + "</strong></div><br/><div>" + body.join(', ') + "</div>";
  });
}

function getMaxLabelSize(svg, axisClass) {
  // axis class = .nv-y2  // second y axis on dual line chart
  // axis class = .nv-x  // x axis on time series line chart
  const tickTexts = svg.selectAll("." + axisClass + " g.tick text");

  if (tickTexts.length > 0) {
    const lengths = tickTexts[0].map(text => text.getComputedTextLength());
    return Math.ceil(Math.max(0, ...lengths));
  }

  return 0;
}

function formatLabel(input, verboseMap = {}) {
  // The input for label may be a string or an array of string
  // When using the time shift feature, the label contains a '---' in the array
  const verboseLookup = s => verboseMap[s] || s;

  return Array.isArray(input) && input.length > 0 ? input.map(l => TIME_SHIFT_PATTERN.test(l) ? l : verboseLookup(l)).join(', ') : verboseLookup(input);
}

const MIN_BAR_WIDTH = 18;

function computeBarChartWidth(data, stacked, maxWidth) {
  const barCount = stacked ? _d.default.max(data, d => d.values.length) : _d.default.sum(data, d => d.values.length);
  const barWidth = barCount * MIN_BAR_WIDTH;
  return Math.max(barWidth, maxWidth);
}

function tryNumify(s) {
  // Attempts casting to Number, returns string when failing
  const n = Number(s);
  return Number.isNaN(n) ? s : n;
}

function stringifyTimeRange(extent) {
  if (extent.some(d => d.toISOString === undefined)) {
    return null;
  }

  return extent.map(d => d.toISOString().slice(0, -1)).join(' : ');
}

function setAxisShowMaxMin(axis, showminmax) {
  if (axis && axis.showMaxMin && showminmax !== undefined) {
    axis.showMaxMin(showminmax);
  }
}

function computeYDomain(data) {
  if (Array.isArray(data) && data.length > 0 && Array.isArray(data[0].values)) {
    const extents = data.filter(d => !d.disabled).map(row => _d.default.extent(row.values, v => v.y));

    const minOfMin = _d.default.min(extents, ([min]) => min);

    const maxOfMax = _d.default.max(extents, ([, max]) => max);

    return [minOfMin, maxOfMax];
  }

  return [0, 1];
}

function computeStackedYDomain(data) {
  if (Array.isArray(data) && data.length > 0 && Array.isArray(data[0].values)) {
    const series = data.filter(d => !d.disabled).map(d => d.values.map(v => v.y));
    const stackedValues = series[0].map((_, i) => series.reduce((acc, cur) => acc + cur[i], 0));
    return [Math.min(0, ...stackedValues), Math.max(0, ...stackedValues)];
  }

  return [0, 1];
}