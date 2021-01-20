import React from 'react';
import { SuperChart, getChartTransformPropsRegistry } from '@superset-ui/core';
import { boolean, number, select, withKnobs } from '@storybook/addon-knobs';
import { EchartsPieChartPlugin } from '@superset-ui/plugin-chart-echarts';
import transformProps from '@superset-ui/plugin-chart-echarts/lib/Pie/transformProps';
import { weekday, population } from './data';
import { withResizableChartDemo } from '../../../../shared/components/ResizableChartDemo';

new EchartsPieChartPlugin().configure({ key: 'echarts-pie' }).register();

getChartTransformPropsRegistry().registerValue('echarts-pie', transformProps);

export default {
  title: 'Chart Plugins|plugin-chart-echarts/Pie',
  decorators: [withKnobs, withResizableChartDemo],
};

export const WeekdayPie = ({ width, height }) => {
  return (
    <SuperChart
      chartType="echarts-pie"
      width={width}
      height={height}
      queriesData={[{ data: weekday }]}
      formData={{
        colorScheme: 'supersetColors',
        groupby: ['Day'],
        metric: 'SUM(AIR_TIME)',
        numberFormat: 'SMART_NUMBER',
        donut: boolean('Donut', false),
        innerRadius: number('Inner Radius', 30),
        outerRadius: number('Outer Radius', 70),
        labelsOutside: boolean('Labels outside', true),
        labelLine: boolean('Label line', true),
        showLabels: boolean('Show labels', true),
        showLegend: boolean('Show legend', false),
        labelType: select(
          'Pie label type',
          ['key', 'value', 'percent', 'key_value', 'key_percent', 'key_value_percent'],
          'key',
        ),
      }}
    />
  );
};

export const PopulationPie = ({ width, height }) => {
  return (
    <SuperChart
      chartType="echarts-pie"
      width={width}
      height={height}
      queriesData={[{ data: population }]}
      formData={{
        colorScheme: 'supersetColors',
        groupby: ['Country'],
        metric: 'Population',
        numberFormat: 'SMART_NUMBER',
        donut: boolean('Donut', false),
        innerRadius: number('Inner Radius', 30),
        outerRadius: number('Outer Radius', 70),
        labelsOutside: boolean('Labels outside', false),
        labelLine: boolean('Label line', true),
        showLabels: boolean('Show labels', true),
        showLegend: boolean('Show legend', false),
        labelType: select(
          'Pie label type',
          ['key', 'value', 'percent', 'key_value', 'key_percent', 'key_value_percent'],
          'key',
        ),
      }}
    />
  );
};
