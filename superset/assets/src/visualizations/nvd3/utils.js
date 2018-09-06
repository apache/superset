import { TIME_SHIFT_PATTERN } from '../../utils/common';

export const addTotalBarValues = function (svg, chart, data, stacked, axisFormat) {
  const format = d3.format(axisFormat || '.3s');
  const countSeriesDisplayed = data.length;

  const totalStackedValues = stacked && data.length !== 0 ?
    data[0].values.map(function (bar, iBar) {
      const bars = data.map(series => series.values[iBar]);
      return d3.sum(bars, d => d.y);
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
        const textEls = groupLabels.append('text')
          .attr('x', xPos) // rough position first, fine tune later
          .attr('y', yPos - 5)
          .text(format(stacked ? totalStackedValues[index] : d.y))
          .attr('transform', transformAttr)
          .attr('class', 'bar-chart-label');
        const labelWidth = textEls.node().getBBox().width;
        textEls.attr('x', xPos + rectWidth / 2 - labelWidth / 2); // fine tune
      }
    });
};

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

export function getMaxLabelSize(svg, axisClass) {
  // axis class = .nv-y2  // second y axis on dual line chart
  // axis class = .nv-x  // x axis on time series line chart
  const tickTexts = svg.selectAll(`.${axisClass} g.tick text`);
  if (tickTexts.length > 0) {
    const lengths = tickTexts[0].map(text => text.getComputedTextLength());
    return Math.ceil(Math.max(...lengths));
  }
  return 0;
}

export function getLabel(stringOrObjectWithLabel) {
  return stringOrObjectWithLabel.label || stringOrObjectWithLabel;
}

export function formatLabel(input, verboseMap = {}) {
  // The input for label may be a string or an array of string
  // When using the time shift feature, the label contains a '---' in the array
  const verboseLkp = s => verboseMap[s] || s;
  let label;
  if (Array.isArray(input) && input.length) {
    const verboseLabels = input.map(l => TIME_SHIFT_PATTERN.test(l) ? l : verboseLkp(l));
    label = verboseLabels.join(', ');
  } else {
    label = verboseLkp(input);
  }
  return label;
}

const MIN_BAR_WIDTH = 15;

export function computeBarChartWidth(data, stacked, maxWidth) {
  const barCount = stacked
    ? d3.max(data, d => d.values.length)
    : d3.sum(data, d => d.values.length);

  const barWidth = barCount * MIN_BAR_WIDTH;
  return Math.max(barWidth, maxWidth);
}
