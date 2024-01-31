import React from 'react';
import { SuperChart, getChartTransformPropsRegistry } from '@superset-ui/core';
import { EchartsFunnelChartPlugin, FunnelTransformProps } from '@superset-ui/plugin-chart-echarts';
import { dataSource } from './constants';
import { withResizableChartDemo } from '../../../../shared/components/ResizableChartDemo';

new EchartsFunnelChartPlugin().configure({ key: 'echarts-funnel' }).register();
getChartTransformPropsRegistry().registerValue('echarts-funnel', FunnelTransformProps);

export default {
  title: 'Chart Plugins/plugin-chart-echarts/Funnel',
  decorators: [withResizableChartDemo],
  argTypes: {
    orient: {
      control: 'select',
      options: ['horizontal', 'vertical'],
      defaultValue: 'vertical',
    },
    sort: {
      control: 'select',
      options: ['descending', 'ascending', 'none'],
      defaultValue: 'descending',
    },
    gap: { control: 'number', defaultValue: 0 },
    labelType: {
      control: 'select',
      options: ['key', 'value', 'percent', 'key_value', 'key_percent', 'key_value_percent'],
      defaultValue: 'key',
    },
    labelLine: { control: 'boolean', defaultValue: true },
    showLabels: { control: 'boolean', defaultValue: true },
    showLegend: { control: 'boolean', defaultValue: false },
  },
};

const FunnelTemplate = ({ orient, sort, gap, labelType, labelLine, showLabels, showLegend, width, height }) => (
  <SuperChart
    chartType="echarts-funnel"
    width={width}
    height={height}
    queriesData={[{ data: dataSource }]}
    formData={{
      colorScheme: 'supersetColors',
      groupby: ['name'],
      metric: 'value',
      numberFormat: 'SMART_NUMBER',
      orient,
      sort,
      gap,
      labelType,
      labelLine,
      showLabels,
      showLegend,
    }}
  />
);

export const Funnel = FunnelTemplate.bind({});
