import React from 'react';
import { SuperChart, getChartTransformPropsRegistry } from '@superset-ui/core';
import { EchartsPieChartPlugin, PieTransformProps } from '@superset-ui/plugin-chart-echarts';
import { weekday, population } from './data';
import { withResizableChartDemo } from '../../../../shared/components/ResizableChartDemo';

new EchartsPieChartPlugin().configure({ key: 'echarts-pie' }).register();
getChartTransformPropsRegistry().registerValue('echarts-pie', PieTransformProps);

export default {
  title: 'Chart Plugins/plugin-chart-echarts/Pie',
  decorators: [withResizableChartDemo],
  argTypes: {
    width: { control: 'text', defaultValue: '100%' },
    height: { control: 'text', defaultValue: '100%' },
    donut: { control: 'boolean', defaultValue: false },
    innerRadius: { control: 'number', defaultValue: 30 },
    outerRadius: { control: 'number', defaultValue: 70 },
    labelsOutside: { control: 'boolean', defaultValue: true },
    labelLine: { control: 'boolean', defaultValue: true },
    showLabels: { control: 'boolean', defaultValue: true },
    showLegend: { control: 'boolean', defaultValue: false },
    labelType: { control: 'select', options: ['key', 'value', 'percent', 'key_value', 'key_percent', 'key_value_percent'], defaultValue: 'key' },
  },
};

const PieChartTemplate = ({ width, height, data, groupby, metric, donut, innerRadius, outerRadius, labelsOutside, labelLine, showLabels, showLegend, labelType }) => (
  <SuperChart
    chartType="echarts-pie"
    width={width}
    height={height}
    queriesData={[{ data }]}
    formData={{
      colorScheme: 'supersetColors',
      groupby,
      metric,
      numberFormat: 'SMART_NUMBER',
      donut,
      innerRadius,
      outerRadius,
      labelsOutside,
      labelLine,
      showLabels,
      showLegend,
      labelType,
    }}
  />
);

export const WeekdayPie = PieChartTemplate.bind({});
WeekdayPie.args = {
  data: weekday,
  groupby: ['Day'],
  metric: 'SUM(AIR_TIME)'
};

export const PopulationPie = PieChartTemplate.bind({});
PopulationPie.args = {
  data: population,
  groupby: ['Country'],
  metric: 'Population'
};
