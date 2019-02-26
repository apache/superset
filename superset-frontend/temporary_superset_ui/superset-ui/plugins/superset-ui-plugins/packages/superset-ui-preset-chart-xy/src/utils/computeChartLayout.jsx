/* eslint-disable sort-keys, no-magic-numbers */

import React from 'react';
import collectScalesFromProps from '@data-ui/xy-chart/esm/utils/collectScalesFromProps';
import { XAxis, YAxis } from '@data-ui/xy-chart';
import adjustMargin from './adjustMargin';
import computeXAxisLayout from './computeXAxisLayout';
import computeYAxisLayout from './computeYAxisLayout';
import createTickComponent from './createTickComponent';
import getTickLabels from './getTickLabels';

const OVERFLOW_MARGIN = 8;

// {
//   width,
//   height,
//   margin:
//   encoding: {
//     x: {
//       scale:
//       axis: {
//         labellingStrategy:
//         rotation:
//         orientation:
//         scaleConfig:
//         tickFormat:
//         tickValues:
//         numTicks:
//       }
//     },
//     y: {
//       scale:
//       axis: {
//         tickFormat:
//         tickValues:
//         numTicks:
//         orientation:
//       }
//     },
//   }
//   children:
//   theme:
// }

export default function computeChartLayout(config) {
  const {
    width,
    height,
    minContentWidth = 0,
    minContentHeight = 0,
    margin,
    encoding,
    children,
    theme,
  } = config;
  const { x, y } = encoding;

  const { xScale, yScale } = collectScalesFromProps({
    width,
    height,
    margin,
    xScale: x.scale,
    yScale: y.scale,
    theme,
    children,
  });

  const { axis: yAxis = {} } = y;

  const yLayout = computeYAxisLayout({
    orientation: yAxis.orientation,
    tickLabels: getTickLabels(yScale, y.axis),
    tickLength: theme.xTickStyles.length,
    tickTextStyle: theme.yTickStyles.label.right,
  });

  const secondMargin = adjustMargin(margin, yLayout.minMargin);
  const { left, right } = secondMargin;

  const innerWidth = Math.max(width - left - right, minContentWidth);

  const { axis: xAxis = {} } = x;
  const { orientation: xOrientation = 'bottom' } = xAxis;
  const AUTO_ROTATION =
    (yLayout.orientation === 'right' && xOrientation === 'bottom') ||
    (yLayout.orientation === 'left' && xOrientation === 'top')
      ? 40
      : -40;
  const { rotation = AUTO_ROTATION } = xAxis;

  const xLayout = computeXAxisLayout({
    axisWidth: innerWidth,
    orientation: xOrientation,
    rotation,
    tickLabels: getTickLabels(xScale, x.axis),
    tickLength: theme.xTickStyles.length,
    tickTextStyle: theme.xTickStyles.label.bottom,
  });

  const finalMargin = adjustMargin(secondMargin, xLayout.minMargin);
  const innerHeight = Math.max(height - finalMargin.top - finalMargin.bottom, minContentHeight);

  const createXAxis = props => (
    <XAxis
      label={config.encoding.x.axis.label}
      labelOffset={xLayout.labelOffset}
      orientation={xLayout.orientation}
      tickComponent={createTickComponent(xLayout)}
      {...props}
    />
  );

  const createYAxis = props => (
    <YAxis
      label={config.encoding.y.axis.label}
      labelOffset={yLayout.labelOffset}
      numTicks={config.encoding.y.axis.numTicks}
      orientation={yLayout.orientation}
      tickFormat={config.encoding.y.axis.tickFormat}
      {...props}
    />
  );

  const chartWidth = Math.round(innerWidth + finalMargin.left + finalMargin.right);
  const chartHeight = Math.round(innerHeight + finalMargin.top + finalMargin.bottom);

  const isOverFlowX = chartWidth > width;
  const isOverFlowY = chartHeight > height;
  if (isOverFlowX) {
    finalMargin.bottom += OVERFLOW_MARGIN;
  }
  if (isOverFlowY) {
    finalMargin.right += OVERFLOW_MARGIN;
  }

  return {
    chartWidth: isOverFlowX ? chartWidth + OVERFLOW_MARGIN : chartWidth,
    chartHeight: isOverFlowY ? chartHeight + OVERFLOW_MARGIN : chartHeight,
    containerWidth: width,
    containerHeight: height,
    margin: finalMargin,
    x: xLayout,
    y: yLayout,
    createXAxis,
    createYAxis,
  };
}
