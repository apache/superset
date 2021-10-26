import React from 'react';
import { SuperChart, getChartTransformPropsRegistry } from '@superset-ui/core';
import { withKnobs } from '@storybook/addon-knobs';
import { EchartsGraphChartPlugin } from '@superset-ui/plugin-chart-echarts';
import transformProps from '@superset-ui/plugin-chart-echarts/lib/Graph/transformProps';
import { basic } from './data';
import { withResizableChartDemo } from '../../../../shared/components/ResizableChartDemo';

new EchartsGraphChartPlugin().configure({ key: 'echarts-graph' }).register();

getChartTransformPropsRegistry().registerValue('echarts-graph', transformProps);

export default {
  title: 'Chart Plugins/plugin-chart-echarts/Graph',
  decorators: [withKnobs, withResizableChartDemo],
};

export const Graph = ({ width, height }) => {
  return (
    <SuperChart
      chartType="echarts-graph"
      width={width}
      height={height}
      queriesData={[{ data: basic }]}
      formData={{
        source: 'source',
        target: 'target',
        sourceCategory: 'sourceCategory',
        targetCategory: 'targetCategory',
        metric: 'value',
      }}
    />
  );
};
