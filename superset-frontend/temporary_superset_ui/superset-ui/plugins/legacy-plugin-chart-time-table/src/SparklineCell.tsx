/* eslint-disable class-methods-use-this */
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
import React from 'react';
import {
  Sparkline,
  LineSeries,
  PointSeries,
  HorizontalReferenceLine,
  VerticalReferenceLine,
  WithTooltip,
} from '@data-ui/sparkline';
import { getTextDimension, formatNumber } from '@superset-ui/core';

interface Props {
  ariaLabel: string;
  className?: string;
  height: number;
  numberFormat: string;
  renderTooltip: ({ index }: { index: number }) => void;
  showYAxis: boolean;
  width: number;
  yAxisBounds: Array<number>;
  data: Array<number>;
}

interface TooltipProps {
  onMouseLeave: () => void;
  onMouseMove: () => void;
  tooltipData: {
    index: number;
  };
}

interface Yscale {
  min?: number;
  max?: number;
}

const MARGIN = {
  top: 8,
  right: 8,
  bottom: 8,
  left: 8,
};
const tooltipProps = {
  style: {
    opacity: 0.8,
  },
  offsetTop: 0,
};

function getSparklineTextWidth(text: string) {
  return (
    getTextDimension({
      text,
      style: {
        fontSize: '12px',
        fontWeight: 200,
        letterSpacing: 0.4,
      },
    }).width + 5
  );
}

function isValidBoundValue(value?: number | string) {
  return (
    value !== null &&
    value !== undefined &&
    value !== '' &&
    !Number.isNaN(value)
  );
}

class SparklineCell extends React.Component<Props, {}> {
  renderHorizontalReferenceLine(value?: number, label?: string) {
    return (
      <HorizontalReferenceLine
        reference={value}
        labelPosition="right"
        renderLabel={() => label}
        stroke="#bbb"
        strokeDasharray="3 3"
        strokeWidth={1}
      />
    );
  }

  render() {
    const {
      width = 300,
      height = 50,
      data,
      ariaLabel,
      numberFormat = undefined,
      yAxisBounds = [undefined, undefined],
      showYAxis = false,
      renderTooltip = () => <div />,
    } = this.props;

    const yScale: Yscale = {};
    let hasMinBound = false;
    let hasMaxBound = false;

    if (yAxisBounds) {
      const [minBound, maxBound] = yAxisBounds;
      hasMinBound = isValidBoundValue(minBound);
      if (hasMinBound) {
        yScale.min = minBound;
      }
      hasMaxBound = isValidBoundValue(maxBound);
      if (hasMaxBound) {
        yScale.max = maxBound;
      }
    }

    let min: number | undefined;
    let max: number | undefined;
    let minLabel: string;
    let maxLabel: string;
    let labelLength = 0;
    if (showYAxis) {
      const [minBound, maxBound] = yAxisBounds;
      min = hasMinBound
        ? minBound
        : data.reduce((acc, current) => Math.min(acc, current), data[0]);
      max = hasMaxBound
        ? maxBound
        : data.reduce((acc, current) => Math.max(acc, current), data[0]);

      minLabel = formatNumber(numberFormat, min);
      maxLabel = formatNumber(numberFormat, max);
      labelLength = Math.max(
        getSparklineTextWidth(minLabel),
        getSparklineTextWidth(maxLabel),
      );
    }

    const margin = {
      ...MARGIN,
      right: MARGIN.right + labelLength,
    };

    return (
      <WithTooltip
        tooltipProps={tooltipProps}
        hoverStyles={null}
        renderTooltip={renderTooltip}
      >
        {({ onMouseLeave, onMouseMove, tooltipData }: TooltipProps) => (
          <Sparkline
            ariaLabel={ariaLabel}
            width={width}
            height={height}
            margin={margin}
            data={data}
            onMouseLeave={onMouseLeave}
            onMouseMove={onMouseMove}
            {...yScale}
          >
            {showYAxis && this.renderHorizontalReferenceLine(min, minLabel)}
            {showYAxis && this.renderHorizontalReferenceLine(max, maxLabel)}
            <LineSeries showArea={false} stroke="#767676" />
            {tooltipData && (
              <VerticalReferenceLine
                reference={tooltipData.index}
                strokeDasharray="3 3"
                strokeWidth={1}
              />
            )}
            {tooltipData && (
              <PointSeries
                points={[tooltipData.index]}
                fill="#767676"
                strokeWidth={1}
              />
            )}
          </Sparkline>
        )}
      </WithTooltip>
    );
  }
}

export default SparklineCell;
