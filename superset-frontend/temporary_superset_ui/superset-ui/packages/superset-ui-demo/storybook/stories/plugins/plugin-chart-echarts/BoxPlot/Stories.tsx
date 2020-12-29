import React from 'react';
import { SuperChart, getChartTransformPropsRegistry } from '@superset-ui/core';
import { select, withKnobs } from '@storybook/addon-knobs';
import { EchartsBoxPlotChartPlugin } from '@superset-ui/plugin-chart-echarts';
import transformProps from '@superset-ui/plugin-chart-echarts/lib/BoxPlot/transformProps';
import data from './data';
import { withResizableChartDemo } from '../../../../shared/components/ResizableChartDemo';

new EchartsBoxPlotChartPlugin().configure({ key: 'echarts-boxplot' }).register();

getChartTransformPropsRegistry().registerValue('echarts-boxplot', transformProps);

export default {
  title: 'Chart Plugins|plugin-chart-echarts/BoxPlot',
  decorators: [withKnobs, withResizableChartDemo],
};

export const BoxPlot = ({ width, height }) => {
  return (
    <SuperChart
      chartType="echarts-boxplot"
      width={width}
      height={height}
      queriesData={[{ data }]}
      formData={{
        columns: [],
        groupby: ['type', 'region'],
        metrics: ['AVG(averageprice)'],
        whiskerOptions: 'Tukey',
        xTicksLayout: select('X Tick Layout', ['auto', 'flat', '45°', '90°', 'staggered'], '45°'),
        yAxisFormat: 'SMART_NUMBER',
      }}
    />
  );
};
