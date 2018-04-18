const { assign } = Object;

const A11Y_BABU = '#00A699';
const AXIS_LINE_GRAY = '#484848';

// Colors
const colors = [
  '#ffffff',
  '#f0f0f0',
  '#d9d9d9',
  '#bdbdbd',
  '#969696',
  '#737373',
  '#525252',
  '#252525',
  '#000000',
];

const charcoal = '#484848';

// Typography
const sansSerif = '"Roboto", sans-serif';
const letterSpacing = 'normal';
const fontSize = 8;

// Layout
const baseProps = {
  width: 450,
  height: 300,
  padding: 50,
  colorScale: colors,
};

// Labels
const baseLabelStyles = {
  fontFamily: sansSerif,
  fontSize,
  letterSpacing,
  padding: 10,
  fill: charcoal,
  stroke: 'transparent',
};

// Strokes
const strokeLinecap = 'round';
const strokeLinejoin = 'round';

// Create the theme
const theme = {
  area: assign({
    style: {
      data: {
        fill: charcoal,
      },
      labels: baseLabelStyles,
    },
  }, baseProps),
  axis: assign({
    style: {
      axis: {
        fill: 'none',
        stroke: AXIS_LINE_GRAY,
        strokeWidth: 1,
        strokeLinecap,
        strokeLinejoin,
      },
      axisLabel: assign({}, baseLabelStyles, {
        padding: 25,
      }),
      grid: {
        fill: 'none',
        stroke: 'transparent',
      },
      ticks: {
        fill: 'none',
        padding: 10,
        size: 1,
        stroke: 'transparent',
      },
      tickLabels: baseLabelStyles,
    },
  }, baseProps),
  bar: assign({
    style: {
      data: {
        fill: A11Y_BABU,
        padding: 10,
        stroke: 'transparent',
        strokeWidth: 0,
        width: 8,
      },
      labels: baseLabelStyles,
    },
  }, baseProps),
  candlestick: assign({
    style: {
      data: {
        stroke: A11Y_BABU,
        strokeWidth: 1,
      },
      labels: assign({}, baseLabelStyles, {
        padding: 25,
        textAnchor: 'end',
      }),
    },
    candleColors: {
      positive: '#ffffff',
      negative: charcoal,
    },
  }, baseProps),
  chart: baseProps,
  errorbar: assign({
    style: {
      data: {
        fill: 'none',
        stroke: charcoal,
        strokeWidth: 2,
      },
      labels: assign({}, baseLabelStyles, {
        textAnchor: 'start',
      }),
    },
  }, baseProps),
  group: assign({
    colorScale: colors,
  }, baseProps),
  line: assign({
    style: {
      data: {
        fill: 'none',
        stroke: A11Y_BABU,
        strokeWidth: 2,
      },
      labels: assign({}, baseLabelStyles, {
        textAnchor: 'start',
      }),
    },
  }, baseProps),
  pie: {
    style: {
      data: {
        padding: 10,
        stroke: 'none',
        strokeWidth: 1,
      },
      labels: assign({}, baseLabelStyles, {
        padding: 200,
        textAnchor: 'middle',
      }),
    },
    colorScale: colors,
    width: 400,
    height: 400,
    padding: 50,
  },
  scatter: assign({
    style: {
      data: {
        fill: charcoal,
        stroke: 'transparent',
        strokeWidth: 0,
      },
      labels: assign({}, baseLabelStyles, {
        textAnchor: 'middle',
      }),
    },
  }, baseProps),
  stack: assign({
    colorScale: colors,
  }, baseProps),
};

export default theme;
