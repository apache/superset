import d3 from 'd3';
import d3tip from 'd3-tip';
import dompurify from 'dompurify';
import { getNumberFormatter } from '@superset-ui/number-format';
import { smartDateFormatter } from '@superset-ui/time-format';

// Regexp for the label added to time shifted series
// (1 hour offset, 2 days offset, etc.)
const TIME_SHIFT_PATTERN = /\d+ \w+ offset/;

export function cleanColorInput(value) {
  // for superset series that should have the same color
  return String(value).trim()
    .split(', ')
    .filter(k => !TIME_SHIFT_PATTERN.test(k))
    .join(', ');
}

/**
 * If format is smart_date, format date
 * Otherwise, format number with the given format name
 * @param {*} format
 */
export function getTimeOrNumberFormatter(format) {
  return (format === 'smart_date')
    ? smartDateFormatter
    : getNumberFormatter(format);
}

export function drawBarValues(svg, data, stacked, axisFormat) {
  const format = getNumberFormatter(axisFormat);
  const countSeriesDisplayed = data.length;

  const totalStackedValues = stacked && data.length !== 0 ?
    data[0].values.map(function (bar, iBar) {
      const bars = data.map(series => series.values[iBar]);
      return d3.sum(bars, d => d.y);
    }) : [];

  const groupLabels = svg.select('g.nv-barsWrap').append('g');

  svg.selectAll('g.nv-group')
    .filter((d, i) => !stacked || i === countSeriesDisplayed - 1)
    .selectAll('rect')
    .each(function (d, index) {
      const rectObj = d3.select(this);
      if (rectObj.attr('class').includes('positive')) {
        const transformAttr = rectObj.attr('transform');
        const yPos = parseFloat(rectObj.attr('y'));
        const xPos = parseFloat(rectObj.attr('x'));
        const rectWidth = parseFloat(rectObj.attr('width'));
        const textEls = groupLabels.append('text')
          .attr('y', yPos - 5)
          .text(format(stacked ? totalStackedValues[index] : d.y))
          .attr('transform', transformAttr)
          .attr('class', 'bar-chart-label');
        const labelWidth = textEls.node().getBBox().width;
        textEls.attr('x', xPos + rectWidth / 2 - labelWidth / 2); // fine tune
      }
    });
}

// Custom sorted tooltip
// use a verbose formatter for times
export function generateRichLineTooltipContent(d, timeFormatter, valueFormatter) {
  let tooltip = '';
  tooltip += "<table><thead><tr><td colspan='3'>"
    + `<strong class='x-value'>${timeFormatter(d.value)}</strong>`
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
        `<td>${dompurify.sanitize(series.key)}</td>` +
        `<td>${valueFormatter(series.value)}</td>` +
      '</tr>'
    );
  });
  tooltip += '</tbody></table>';
  return tooltip;
}

export function generateMultiLineTooltipContent(d, xFormatter, yFormatters) {
  const tooltipTitle = xFormatter(d.value);
  let tooltip = '';

  tooltip += "<table><thead><tr><td colspan='3'>"
    + `<strong class='x-value'>${tooltipTitle}</strong>`
    + '</td></tr></thead><tbody>';

  d.series.forEach((series, i) => {
    const yFormatter = yFormatters[i];
    tooltip += "<tr><td class='legend-color-guide'>"
      + `<div style="background-color: ${series.color};"></div></td>`
      + `<td class='key'>${series.key}</td>`
      + `<td class='value'>${yFormatter(series.value)}</td></tr>`;
  });

  tooltip += '</tbody></table>';

  return tooltip;
}

function getLabel(stringOrObjectWithLabel) {
  return stringOrObjectWithLabel.label || stringOrObjectWithLabel;
}

function createHTMLRow(col1, col2) {
  return `<tr><td>${col1}</td><td>${col2}</td></tr>`;
}

export function generateBubbleTooltipContent({
  point,
  entity,
  xField,
  yField,
  sizeField,
  xFormatter,
  yFormatter,
  sizeFormatter,
}) {
  let s = '<table>';
  s += (
    `<tr><td style="color: ${point.color};">` +
      `<strong>${point[entity]}</strong> (${point.group})` +
    '</td></tr>'
  );
  s += createHTMLRow(getLabel(xField), xFormatter(point.x));
  s += createHTMLRow(getLabel(yField), yFormatter(point.y));
  s += createHTMLRow(getLabel(sizeField), sizeFormatter(point.size));
  s += '</table>';
  return s;
}

export function hideTooltips() {
  const target = document.querySelector('.nvtooltip');
  if (target) {
    target.style.opacity = 0;
  }
}

export function wrapTooltip(chart, maxWidth) {
  const tooltipLayer = chart.useInteractiveGuideline && chart.useInteractiveGuideline() ?
    chart.interactiveLayer : chart;
  const tooltipGeneratorFunc = tooltipLayer.tooltip.contentGenerator();
  tooltipLayer.tooltip.contentGenerator((d) => {
    let tooltip = `<div style="max-width: ${maxWidth * 0.5}px">`;
    tooltip += tooltipGeneratorFunc(d);
    tooltip += '</div>';
    return tooltip;
  });
}

export function tipFactory(layer) {
  return d3tip()
    .attr('class', 'd3-tip')
    .direction('n')
    .offset([-5, 0])
    .html((d) => {
      if (!d) {
        return '';
      }
      const title = d[layer.titleColumn] && d[layer.titleColumn].length ?
        d[layer.titleColumn] + ' - ' + layer.name :
        layer.name;
      const body = Array.isArray(layer.descriptionColumns) ?
        layer.descriptionColumns.map(c => d[c]) : Object.values(d);
      return '<div><strong>' + title + '</strong></div><br/>' +
        '<div>' + body.join(', ') + '</div>';
    });
}

export function getMaxLabelSize(svg, axisClass) {
  // axis class = .nv-y2  // second y axis on dual line chart
  // axis class = .nv-x  // x axis on time series line chart
  const tickTexts = svg.selectAll(`.${axisClass} g.tick text`);
  if (tickTexts.length > 0) {
    const lengths = tickTexts[0].map(text => text.getComputedTextLength());
    return Math.ceil(Math.max(0, ...lengths));
  }
  return 0;
}

export function formatLabel(input, verboseMap = {}) {
  // The input for label may be a string or an array of string
  // When using the time shift feature, the label contains a '---' in the array
  const verboseLookup = s => verboseMap[s] || s;
  return (Array.isArray(input) && input.length)
    ? input.map(l => TIME_SHIFT_PATTERN.test(l) ? l : verboseLookup(l))
      .join(', ')
    : verboseLookup(input);
}

const MIN_BAR_WIDTH = 15;

export function computeBarChartWidth(data, stacked, maxWidth) {
  const barCount = stacked
    ? d3.max(data, d => d.values.length)
    : d3.sum(data, d => d.values.length);

  const barWidth = barCount * MIN_BAR_WIDTH;
  return Math.max(barWidth, maxWidth);
}

export function tryNumify(s) {
  // Attempts casting to Number, returns string when failing
  const n = Number(s);
  return Number.isNaN(n) ? s : n;
}

export function stringifyTimeRange(extent) {
  if (extent.some(d => d.toISOString === undefined)) {
    return null;
  }
  return extent.map(d => d.toISOString()
    .slice(0, -1))
    .join(' : ');
}

export function setAxisShowMaxMin(axis, showminmax) {
  if (axis && axis.showMaxMin && showminmax !== undefined) {
    axis.showMaxMin(showminmax);
  }
}
