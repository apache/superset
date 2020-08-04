import { color, svgLabel, unit, font } from '@data-ui/theme';

export { unit, font } from '@data-ui/theme';

export const colors = color;

export const { fontFamily } = font;

export const gridStyles = {
  stroke: colors.grid,
  strokeWidth: 1,
};

export const xAxisStyles = {
  stroke: colors.gridDark,
  strokeWidth: 2,
  label: {
    bottom: {
      ...svgLabel.baseLabel,
    },
    top: {
      ...svgLabel.baseLabel,
    },
  },
};

export const yAxisStyles = {
  stroke: colors.grid,
  strokeWidth: 1,
  label: {
    left: {
      ...svgLabel.baseLabel,
    },
    right: {
      ...svgLabel.baseLabel,
    },
  },
};

export const xTickStyles = {
  stroke: colors.grid,
  length: Number(unit),
  label: {
    bottom: {
      ...svgLabel.tickLabels.bottom,
    },
    top: {
      ...svgLabel.tickLabels.top,
    },
  },
};

export const yTickStyles = {
  stroke: colors.grid,
  length: Number(unit),
  label: {
    left: {
      ...svgLabel.tickLabels.left,
    },
    right: {
      ...svgLabel.tickLabels.right,
    },
  },
};

export default {
  colors,
  gridStyles,
  xAxisStyles,
  xTickStyles,
  yAxisStyles,
  yTickStyles,
};
