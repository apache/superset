/* eslint-disable sort-keys, no-magic-numbers */

import React, { ReactNode, CSSProperties } from 'react';
import { XAxis, YAxis } from '@data-ui/xy-chart';
import { Margin, mergeMargin, Dimension } from '@superset-ui/dimension';
import { ChartFrame } from '@superset-ui/chart-composition';
import createTickComponent from './createTickComponent';
import ChannelEncoder from '../encodeable/ChannelEncoder';
import { XFieldDef, YFieldDef } from '../encodeable/types/ChannelDef';
import { PlainObject } from '../encodeable/types/Data';
import { DEFAULT_LABEL_ANGLE } from './constants';
import { AxisLayout } from '../encodeable/AxisAgent';

// Additional margin to avoid content hidden behind scroll bar
const OVERFLOW_MARGIN = 8;

export interface XYChartLayoutConfig {
  width: number;
  height: number;
  minContentWidth?: number;
  minContentHeight?: number;
  margin: Margin;
  xEncoder: ChannelEncoder<XFieldDef>;
  xTickSize?: number;
  xTickTextStyle?: CSSProperties;
  autoAdjustXMargin?: boolean;
  yEncoder: ChannelEncoder<YFieldDef>;
  yTickSize?: number;
  yTickTextStyle?: CSSProperties;
  autoAdjustYMargin?: boolean;
}

export default class XYChartLayout {
  chartWidth: number;
  chartHeight: number;
  containerWidth: number;
  containerHeight: number;
  margin: Margin;
  xEncoder: ChannelEncoder<XFieldDef>;
  xLayout?: AxisLayout;
  yEncoder: ChannelEncoder<YFieldDef>;
  yLayout?: AxisLayout;

  // eslint-disable-next-line complexity
  constructor(config: XYChartLayoutConfig) {
    const {
      width,
      height,
      minContentWidth = 0,
      minContentHeight = 0,
      margin,
      xEncoder,
      xTickSize,
      xTickTextStyle,
      autoAdjustXMargin = true,
      yEncoder,
      yTickSize,
      yTickTextStyle,
      autoAdjustYMargin = true,
    } = config;

    this.xEncoder = xEncoder;
    this.yEncoder = yEncoder;

    if (typeof yEncoder.axis !== 'undefined') {
      this.yLayout = yEncoder.axis.computeLayout({
        axisWidth: Math.max(height - margin.top - margin.bottom),
        tickSize: yEncoder.axis.config.tickSize || yTickSize,
        tickTextStyle: yTickTextStyle,
      });
    }

    const secondMargin =
      this.yLayout && autoAdjustYMargin ? mergeMargin(margin, this.yLayout.minMargin) : margin;
    const innerWidth = Math.max(width - secondMargin.left - secondMargin.right, minContentWidth);

    if (typeof xEncoder.axis !== 'undefined') {
      this.xLayout = xEncoder.axis.computeLayout({
        axisWidth: innerWidth,
        labelAngle: this.recommendXLabelAngle(xEncoder.axis.config.orient as 'top' | 'bottom'),
        tickSize: xEncoder.axis.config.tickSize || xTickSize,
        tickTextStyle: xTickTextStyle,
      });
    }

    const finalMargin =
      this.xLayout && autoAdjustXMargin
        ? mergeMargin(secondMargin, this.xLayout.minMargin)
        : secondMargin;

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
  }

  recommendXLabelAngle(xOrient: 'top' | 'bottom' = 'bottom') {
    const { axis } = this.yEncoder;

    return !this.yLayout ||
      (typeof axis !== 'undefined' &&
        ((axis.config.orient === 'right' && xOrient === 'bottom') ||
          (axis.config.orient === 'left' && xOrient === 'top')))
      ? DEFAULT_LABEL_ANGLE
      : -DEFAULT_LABEL_ANGLE;
  }

  renderChartWithFrame(renderChart: (input: Dimension) => ReactNode) {
    return (
      <ChartFrame
        width={this.containerWidth}
        height={this.containerHeight}
        contentWidth={this.chartWidth}
        contentHeight={this.chartHeight}
        renderContent={renderChart}
      />
    );
  }

  renderXAxis(props?: PlainObject) {
    const { axis } = this.xEncoder;

    return axis && this.xLayout ? (
      <XAxis
        label={axis.getTitle()}
        labelOffset={this.xLayout.labelOffset}
        numTicks={axis.config.tickCount}
        orientation={axis.config.orient}
        tickComponent={createTickComponent(this.xLayout)}
        tickFormat={axis.getFormat()}
        {...props}
      />
    ) : null;
  }

  renderYAxis(props?: PlainObject) {
    const { axis } = this.yEncoder;

    return axis && this.yLayout ? (
      <YAxis
        label={axis.getTitle()}
        labelOffset={this.yLayout.labelOffset}
        numTicks={axis.config.tickCount}
        orientation={axis.config.orient}
        tickFormat={axis.getFormat()}
        {...props}
      />
    ) : null;
  }
}
