/* eslint-disable sort-keys, no-magic-numbers */

import React, { ReactNode } from 'react';
import collectScalesFromProps from '@data-ui/xy-chart/esm/utils/collectScalesFromProps';
import { XAxis, YAxis } from '@data-ui/xy-chart';
import { ChartTheme } from '@data-ui/theme';
import { Margin, mergeMargin } from '@superset-ui/dimension';
import createTickComponent from './createTickComponent';
import ChartFrame from '../components/ChartFrame';
import ChannelEncoder from '../encodeable/ChannelEncoder';
import { AxisOrient } from '../encodeable/types/Axis';
import { XFieldDef, YFieldDef } from '../encodeable/types/ChannelDef';
import { PlainObject } from '../encodeable/types/Data';
import { DEFAULT_LABEL_ANGLE } from './constants';

// Additional margin to avoid content hidden behind scroll bar
const OVERFLOW_MARGIN = 8;

interface Input {
  width: number;
  height: number;
  minContentWidth?: number;
  minContentHeight?: number;
  margin: Margin;
  xEncoder: ChannelEncoder<XFieldDef>;
  yEncoder: ChannelEncoder<YFieldDef>;
  children: ReactNode[];
  theme: ChartTheme;
}

export default class XYChartLayout {
  chartWidth: number;
  chartHeight: number;
  containerWidth: number;
  containerHeight: number;
  margin: Margin;
  spec: Input;

  xLayout?: {
    labelOffset: number;
    labelOverlap: string;
    labelAngle: number;
    tickTextAnchor?: string;
    minMargin: Partial<Margin>;
    orient: AxisOrient;
  };

  yLayout?: {
    labelOffset: number;
    minMargin: Partial<Margin>;
    orient: AxisOrient;
  };

  // eslint-disable-next-line complexity
  constructor(spec: Input) {
    this.spec = spec;

    const {
      width,
      height,
      minContentWidth = 0,
      minContentHeight = 0,
      margin,
      xEncoder,
      yEncoder,
      children,
      theme,
    } = spec;

    const { xScale, yScale } = collectScalesFromProps({
      width,
      height,
      margin,
      xScale: xEncoder.definition.scale || {},
      yScale: yEncoder.definition.scale || {},
      theme,
      children,
    });

    if (typeof yEncoder.scale !== 'undefined') {
      yEncoder.scale.setDomain(yScale.domain());
    }
    if (typeof yEncoder.axis !== 'undefined') {
      this.yLayout = yEncoder.axis.computeLayout({
        axisWidth: Math.max(height - margin.top - margin.bottom),
        tickLength: theme.yTickStyles.length,
        tickTextStyle: theme.yTickStyles.label.right,
      });
    }

    const secondMargin = this.yLayout ? mergeMargin(margin, this.yLayout.minMargin) : margin;
    const innerWidth = Math.max(width - secondMargin.left - secondMargin.right, minContentWidth);

    if (typeof xEncoder.scale !== 'undefined') {
      xEncoder.scale.setDomain(xScale.domain());
    }
    if (typeof xEncoder.axis !== 'undefined') {
      this.xLayout = xEncoder.axis.computeLayout({
        axisWidth: innerWidth,
        labelAngle: this.recommendXLabelAngle(xEncoder.axis.config.orient as 'top' | 'bottom'),
        tickLength: theme.xTickStyles.length,
        tickTextStyle: theme.xTickStyles.label.bottom,
      });
    }

    const finalMargin = this.xLayout
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
    const { axis } = this.spec.yEncoder;

    return !this.yLayout ||
      (typeof axis !== 'undefined' &&
        ((axis.config.orient === 'right' && xOrient === 'bottom') ||
          (axis.config.orient === 'left' && xOrient === 'top')))
      ? DEFAULT_LABEL_ANGLE
      : -DEFAULT_LABEL_ANGLE;
  }

  renderChartWithFrame(renderChart: (input: { width: number; height: number }) => ReactNode) {
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
    const { axis } = this.spec.xEncoder;

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
    const { axis } = this.spec.yEncoder;

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
