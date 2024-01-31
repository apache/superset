import React from 'react';
import { SuperChart, getChartTransformPropsRegistry } from '@superset-ui/core';
import { EchartsTreemapChartPlugin, TreemapTransformProps } from '@superset-ui/plugin-chart-echarts';
import data from './data';
import { withResizableChartDemo } from '../../../../shared/components/ResizableChartDemo';

new EchartsTreemapChartPlugin().configure({ key: 'echarts-treemap' }).register();
getChartTransformPropsRegistry().registerValue('echarts-treemap', TreemapTransformProps);

export default {
  title: 'Chart Plugins/plugin-chart-echarts/Treemap',
  decorators: [withResizableChartDemo],
  argTypes: {
    width: { control: 'text', defaultValue: '100%' },
    height: { control: 'text', defaultValue: '100%' },
    showLabels: { control: 'boolean', defaultValue: true },
    showUpperLabels: { control: 'boolean', defaultValue: true },
    labelType: { control: 'select', options: ['key', 'value', 'key_value'], defaultValue: 'key_value' },
  },
};

const TreemapTemplate = ({ width, height, showLabels, showUpperLabels, labelType }) => (
  <SuperChart
    chartType="echarts-treemap"
    width={width}
    height={height}
    queriesData={[{ data }]}
    formData={{
      colorScheme: 'supersetColors',
      groupby: ['genre'],
      metric: 'count',
      showLabels,
      showUpperLabels,
      labelType,
    }}
  />
);

export const Treemap = TreemapTemplate.bind({});
