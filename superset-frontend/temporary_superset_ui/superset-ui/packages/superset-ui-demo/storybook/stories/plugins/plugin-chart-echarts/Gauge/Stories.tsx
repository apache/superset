import React from 'react';
import { SuperChart, getChartTransformPropsRegistry } from '@superset-ui/core';
import { withKnobs } from '@storybook/addon-knobs';
import { EchartsGaugeChartPlugin } from '@superset-ui/plugin-chart-echarts';
import transformProps from '@superset-ui/plugin-chart-echarts/lib/Gauge/transformProps';
import { withResizableChartDemo } from '../../../../shared/components/ResizableChartDemo';
import { speed } from './data';

new EchartsGaugeChartPlugin().configure({ key: 'echarts-gauge' }).register();

getChartTransformPropsRegistry().registerValue('echarts-gauge', transformProps);

export default {
  title: 'Chart Plugins/plugin-chart-echarts/Gauge',
  decorators: [withKnobs, withResizableChartDemo],
};

export const Gauge = ({ width, height }) => {
  return (
    <SuperChart
      chartType="echarts-gauge"
      width={width}
      height={height}
      queriesData={[{ data: speed }]}
      formData={{
        columns: [],
        groupby: ['name'],
        metric: 'value',
      }}
    />
  );
};
