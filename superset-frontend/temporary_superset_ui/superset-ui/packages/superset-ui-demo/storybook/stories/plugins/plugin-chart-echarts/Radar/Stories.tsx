import React from 'react';
import { SuperChart, getChartTransformPropsRegistry } from '@superset-ui/core';
import { withKnobs } from '@storybook/addon-knobs';
import { EchartsRadarChartPlugin } from '@superset-ui/plugin-chart-echarts';
import transformProps from '@superset-ui/plugin-chart-echarts/lib/Radar/transformProps';
import { withResizableChartDemo } from '../../../../shared/components/ResizableChartDemo';
import { basic } from './data';

new EchartsRadarChartPlugin().configure({ key: 'echarts-radar' }).register();

getChartTransformPropsRegistry().registerValue('echarts-radar', transformProps);

export default {
  title: 'Chart Plugins/plugin-chart-echarts/Radar',
  decorators: [withKnobs, withResizableChartDemo],
};

export const Radar = ({ width, height }) => {
  return (
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
};
