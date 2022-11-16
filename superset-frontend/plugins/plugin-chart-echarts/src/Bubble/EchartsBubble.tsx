import React from 'react';
import { BubbleChartTransformedProps } from './types';
import Echart from '../components/Echart';

export default function EchartsBubble(props: BubbleChartTransformedProps) {
  const { height, width, echartOptions } = props;

  return (
    <Echart
      height={height}
      width={width}
      echartOptions={echartOptions}
    ></Echart>
  );
}
