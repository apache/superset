import React from 'react';
import { SuperChart, getChartTransformPropsRegistry } from '@superset-ui/core';
import { EchartsRadarChartPlugin, RadarTransformProps } from '@superset-ui/plugin-chart-echarts';
import { withResizableChartDemo } from '../../../../shared/components/ResizableChartDemo';
import { basic } from './data';

new EchartsRadarChartPlugin().configure({ key: 'echarts-radar' }).register();
getChartTransformPropsRegistry().registerValue('echarts-radar', RadarTransformProps);

export default {
  title: 'Chart Plugins/plugin-chart-echarts/Radar',
  decorators: [withResizableChartDemo],
  argTypes: {
    width: { control: 'text', defaultValue: '100%' },
    height: { control: 'text', defaultValue: '100%' },
    // You can add more args here if there are other dynamic properties
  },
};

const RadarTemplate = ({ width, height }) => (
  <SuperChart
    chartType="echarts-radar"
    width={width}
    height={height}
    queriesData={[{ data: basic }]}
    formData={{
      columns: [],
      groupby: ['Sales'],
      metrics: [
        'Sales',
        'Administration',
        'Information Technology',
        'Customer Support',
        'Development',
        'Marketing',
      ],
      columnConfig: {
        Sales: { radarMetricMaxValue: 6500 },
        Administration: { radarMetricMaxValue: 16000 },
        'Information Technology': { radarMetricMaxValue: 30000 },
        'Customer Support': { radarMetricMaxValue: 38000 },
        Development: { radarMetricMaxValue: 52000 },
        Marketing: { radarMetricMaxValue: 25000 },
      },
    }}
  />
);

export const Radar = RadarTemplate.bind({});
