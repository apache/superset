import React, { useCallback } from 'react';
import { ScaleLinear, ScaleTime } from 'd3-scale';
import { bisector } from 'd3-array';
import { localPoint } from '@visx/event';
import { Bar, Line } from '@visx/shape';

import { ChartDataItem, ChartMargin } from './types';

export type TinyTooltipProps = {
  hideTooltip: () => void;
  tooltipData: ChartDataItem;
  tooltipLeft: number;
  tooltipTop: number;
  showTooltip: (args: object) => void;
  accentColor: string;
  innerWidth: number;
  innerHeight: number;
  xScale: ScaleTime<number, number>;
  yScale: ScaleLinear<number, number>;
  getValue: (historicalData: ChartDataItem) => number;
  getDate: (historicalData: ChartDataItem) => Date;
  data: ChartDataItem[];
  margin: ChartMargin;
};

export const TinyTooltip = ({
  hideTooltip,
  tooltipData,
  tooltipLeft,
  tooltipTop,
  showTooltip,
  accentColor,
  innerHeight,
  innerWidth,
  margin,
  xScale,
  yScale,
  getValue,
  getDate,
  data,
}: TinyTooltipProps) => {
  const bisectDate = bisector<ChartDataItem, Date>(
    (historicalData) => new Date(historicalData.xAxis),
  ).left;

  const handleTooltip = useCallback(
    (event: React.TouchEvent<SVGRectElement> | React.MouseEvent<SVGRectElement>) => {
      const { x: xPoint } = localPoint(event) || { x: 0 };
      const xPoint0 = xScale.invert(xPoint);
      const index = bisectDate(data, xPoint0, 1);
      const dataIndex0 = data[index - 1];
      const dataIndex1 = data[index];
      let updatedTooltipData = dataIndex0;

      if (dataIndex1 && getDate(dataIndex1)) {
        updatedTooltipData =
          xPoint0.valueOf() - getDate(dataIndex0).valueOf() >
          getDate(dataIndex1).valueOf() - xPoint0.valueOf()
            ? dataIndex1
            : dataIndex0;
      }

      showTooltip({
        tooltipData: updatedTooltipData,
        tooltipLeft: xPoint,
        tooltipTop: yScale(getValue(updatedTooltipData)),
      });
    },
    [xScale, bisectDate, data, getDate, showTooltip, yScale, getValue],
  );
  return (
    // eslint-disable-next-line react/jsx-no-useless-fragment
    <>
      <Bar
        x={margin.left}
        y={margin.top}
        width={innerWidth}
        height={innerHeight}
        fill="transparent"
        rx={14}
        onTouchStart={handleTooltip}
        onTouchMove={handleTooltip}
        onMouseMove={handleTooltip}
        onMouseLeave={() => hideTooltip()}
      />
      {tooltipData && (
        <g>
          <Line
            from={{ x: tooltipLeft, y: margin.top }}
            to={{ x: tooltipLeft, y: innerHeight + margin.top }}
            stroke={accentColor}
            strokeWidth={1}
            pointerEvents="none"
          />
          <circle
            cx={tooltipLeft}
            cy={tooltipTop + 1}
            r={4}
            fill="black"
            fillOpacity={0.1}
            stroke="black"
            strokeOpacity={0.1}
            strokeWidth={2}
            pointerEvents="none"
          />
          <circle
            cx={tooltipLeft}
            cy={tooltipTop}
            r={4}
            fill={accentColor}
            stroke="white"
            strokeWidth={2}
            pointerEvents="none"
          />
        </g>
      )}
    </>
  );
};
