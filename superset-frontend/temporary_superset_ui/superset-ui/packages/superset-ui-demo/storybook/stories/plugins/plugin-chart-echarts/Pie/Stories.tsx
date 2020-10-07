import React from 'react';
import { SuperChart, getChartTransformPropsRegistry } from '@superset-ui/core';
import { boolean, select, withKnobs } from '@storybook/addon-knobs';
import { EchartsPieChartPlugin } from '@superset-ui/plugin-chart-echarts';
import transformProps from '@superset-ui/plugin-chart-echarts/lib/Pie/transformProps';
import data from './data';

new EchartsPieChartPlugin().configure({ key: 'echarts-pie' }).register();

getChartTransformPropsRegistry().registerValue('echarts-pie', transformProps);

export default {
  title: 'Chart Plugins|plugin-chart-echarts/Pie',
  decorators: [withKnobs],
};

export const Pie = ({ width, height }) => {
  return (
    <SuperChart
      chartType="echarts-pie"
      width={width}
      height={height}
      queryData={{ data }}
      formData={{
        colorScheme: 'supersetColors',
        groupby: ['Day'],
        metric: 'SUM(AIR_TIME)',
        numberFormat: 'SMART_NUMBER',
        donut: boolean('Donut', false),
        labelsOutside: boolean('Labels outside', true),
        showLabels: boolean('Show labels', true),
        showLegend: boolean('Show legend', false),
        pieLabelType: select(
          'Pie label type',
          ['key', 'value', 'percent', 'key_value', 'key_percent', 'key_value_percent'],
          'key_value_percent',
        ),
      }}
    />
  );
};
