import React, { useMemo } from 'react';
import { Group } from '@visx/group';
import { AreaClosed } from '@visx/shape';
import { AxisLeft, AxisBottom } from '@visx/axis';
import { LinearGradient } from '@visx/gradient';
import { curveMonotoneX } from '@visx/curve';

import { ChartData, ChartMargin, ChartDataType, ChartDataItem } from './types';
import { useChartAccessorsAndScales } from './hooks';
import { ChartBottomAxisBaseConfig, ChartLeftAxisBaseConfig, ChartSliderHeight, ChartSliderSeparation, formatDateForChart } from './utils';

export interface IAreaChartProps {
  id: string;
  data: ChartData;
  dataType?: ChartDataType;
  xField: string;
  yField: string;
  gradientColor: string;
  gradientColorTo?: string;
  fromOpacity?: number;
  toOpacity?: number;
  width: number;
  height: number;
  hasSlider?: boolean;
  compact?: boolean;
  margin: ChartMargin;
  hideBottomAxis?: boolean;
  hideLeftAxis?: boolean;
  top?: number;
  left?: number;
  children?: React.ReactNode;
}

export const AreaChart = ({
  id,
  data,
  dataType = 'string',
  gradientColor,
  width,
  height,
  xField,
  yField,
  margin,
  hideBottomAxis = false,
  hideLeftAxis = false,
  hasSlider = false,
  compact = false,
  gradientColorTo,
  fromOpacity = 1,
  toOpacity = 0.1,
  top,
  left,
  children,
}: IAreaChartProps) => {
  const bounds = useMemo(() => {
    const innerHeight = height - margin.top - margin.bottom;
    const innerWidth = width - margin.left - margin.right;
    let chartHeight = innerHeight;

    if (hasSlider) {
      const sliderSeparation = compact ? ChartSliderSeparation / 2 : ChartSliderSeparation;
      chartHeight = innerHeight - sliderSeparation - ChartSliderHeight;
    }

    const xMax = Math.max(innerWidth, 0);
    const yMax = Math.max(chartHeight, 0);

    return {
      xMax,
      yMax,
    };
  }, [compact, height, margin, width, hasSlider]);

  const { getXAxisValue, getYAxisValue, xScale, yScale } = useChartAccessorsAndScales({
    data,
    dataType,
    xField,
    yField,
    width: bounds.xMax,
    height: bounds.yMax,
  });

  if (width < 10) return null;

  return (
    <Group left={left || margin.left} top={top || margin.top}>
      <LinearGradient
        id={`${id}-chart-gradient`}
        from={gradientColor}
        fromOpacity={fromOpacity}
        to={gradientColorTo || gradientColor}
        toOpacity={toOpacity}
      />

      <AreaClosed<ChartDataItem>
        data={data}
        x={(datum) => (xScale as (arg: string | Date) => number)(getXAxisValue(datum)) || 0}
        y={(datum) => yScale?.(getYAxisValue(datum)) || 0}
        yScale={yScale as never}
        strokeWidth={1}
        stroke={`url(#${id}-chart-gradient)`}
        fill={`url(#${id}-chart-gradient)`}
        curve={curveMonotoneX}
      />

      {!hideBottomAxis && (
        <AxisBottom
          top={bounds.yMax}
          scale={xScale as never}
          numTicks={width > 520 ? 10 : 5}
          tickFormat={dataType === 'date' ? (formatDateForChart as never) : undefined}
          {...ChartBottomAxisBaseConfig}
        />
      )}

      {!hideLeftAxis && (
        <AxisLeft scale={yScale as never} numTicks={5} {...ChartLeftAxisBaseConfig} />
      )}

      {children}
    </Group>
  );
};
