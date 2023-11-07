import React from 'react';
import { PieChartTransformedProps } from './types';
import Echart from '../../../plugin-chart-echarts/src/components/Echart';
import { allEventHandlers } from '../../../plugin-chart-echarts/src/utils/eventHandlers';
import { createJumpToDashboardHandler } from '../utils/jumpToDashboard';

export default function EchartsPie(props: PieChartTransformedProps) {
  const { height, width, echartOptions, selectedValues, refs } = props;

  const eventHandlers = allEventHandlers(props);
  eventHandlers.click = createJumpToDashboardHandler(props);

  return (
    <Echart
      refs={refs}
      height={height}
      width={width}
      echartOptions={echartOptions}
      eventHandlers={eventHandlers}
      selectedValues={selectedValues}
    />
  );
}
