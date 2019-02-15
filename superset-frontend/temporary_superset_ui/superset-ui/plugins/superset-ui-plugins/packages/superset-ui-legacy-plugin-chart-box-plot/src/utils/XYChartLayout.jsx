/* eslint-disable sort-keys, no-magic-numbers */

import React from 'react';
import collectScalesFromProps from '@data-ui/xy-chart/esm/utils/collectScalesFromProps';
import { YAxis } from '@data-ui/xy-chart';
import adjustMargin from './adjustMargin';
import computeXAxisLayout from './computeXAxisLayout';
import computeYAxisLayout from './computeYAxisLayout';
import createTickComponent from './createTickComponent';
import getTickLabels from './getTickLabels';
import XAxis from '../XAxis';
import ChartFrame from '../ChartFrame';

// Additional margin to avoid content hidden behind scroll bar
const OVERFLOW_MARGIN = 8;

export default class XYChartLayout {
  constructor(config) {
    this.config = config;

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
      tickLabels: getTickLabels(yScale, yAxis),
      tickLength: theme.yTickStyles.length,
      tickTextStyle: theme.yTickStyles.label.right,
    });

    const secondMargin = adjustMargin(margin, yLayout.minMargin);
    const { left, right } = secondMargin;

    const { axis: xAxis = {} } = x;

    const { orientation: xOrientation = 'bottom' } = xAxis;
    const AUTO_ROTATION =
      (yLayout.orientation === 'right' && xOrientation === 'bottom') ||
      (yLayout.orientation === 'left' && xOrientation === 'top')
        ? 40
        : -40;
    const { rotation = AUTO_ROTATION } = xAxis;

    const innerWidth = Math.max(width - left - right, minContentWidth);

    const xLayout = computeXAxisLayout({
      axisWidth: innerWidth,
      orientation: xOrientation,
      rotation,
      tickLabels: getTickLabels(xScale, xAxis),
      tickLength: theme.xTickStyles.length,
      tickTextStyle: theme.xTickStyles.label.bottom,
    });

    const finalMargin = adjustMargin(secondMargin, xLayout.minMargin);
    const innerHeight = Math.max(height - finalMargin.top - finalMargin.bottom, minContentHeight);

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

    this.chartWidth = isOverFlowX ? chartWidth + OVERFLOW_MARGIN : chartWidth;
    this.chartHeight = isOverFlowY ? chartHeight + OVERFLOW_MARGIN : chartHeight;
    this.containerWidth = width;
    this.containerHeight = height;
    this.margin = finalMargin;
    this.xLayout = xLayout;
    this.yLayout = yLayout;
  }

  createChartWithFrame(renderChart) {
    return (
      <ChartFrame
        width={this.containerWidth}
        height={this.containerHeight}
        containerWidth={this.containerWidth}
        contentHeight={this.containerHeight}
        renderContent={renderChart}
      />
    );
  }

  createXAxis(props) {
    const { axis } = this.config.encoding.x;

    return (
      <XAxis
        label={axis.label}
        labelOffset={this.xLayout.labelOffset}
        orientation={this.xLayout.orientation}
        tickComponent={createTickComponent(this.xLayout)}
        tickFormat={axis.tickFormat}
        {...props}
      />
    );
  }

  createYAxis(props) {
    const { axis } = this.config.encoding.y;

    return (
      <YAxis
        label={axis.label}
        labelOffset={this.yLayout.labelOffset}
        numTicks={axis.numTicks}
        orientation={this.yLayout.orientation}
        tickFormat={axis.tickFormat}
        {...props}
      />
    );
  }
}
