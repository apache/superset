import React from 'react';
import { MyCustomChartProps } from './types';
import Echart from '../components/Echart';
import { allEventHandlers } from '../utils/eventHandlers';

export default function MyCustomChart(props: MyCustomChartProps) {
  const { height, width, echartOptions, selectedValues, refs } = props;
  const eventHandlers = allEventHandlers(props);

  return (
    <Echart
      refs={refs}
      height={height}
      width={width}
      echartOptions={echartOptions} // Using the echart options
      eventHandlers={eventHandlers}
      selectedValues={selectedValues} // Passing selected values to Echart
    />
  );
}
