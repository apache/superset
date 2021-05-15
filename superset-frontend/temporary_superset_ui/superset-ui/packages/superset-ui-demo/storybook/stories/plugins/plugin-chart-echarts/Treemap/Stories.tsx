import React from 'react';
import { SuperChart, getChartTransformPropsRegistry } from '@superset-ui/core';
import { boolean, withKnobs, select } from '@storybook/addon-knobs';
import { EchartsTreemapChartPlugin } from '@superset-ui/plugin-chart-echarts';
import transformProps from '@superset-ui/plugin-chart-echarts/lib/Treemap/transformProps';
import data from './data';
import { withResizableChartDemo } from '../../../../shared/components/ResizableChartDemo';

new EchartsTreemapChartPlugin().configure({ key: 'echarts-treemap' }).register();

getChartTransformPropsRegistry().registerValue('echarts-treemap', transformProps);

export default {
  title: 'Chart Plugins|plugin-chart-echarts/Treemap',
  decorators: [withKnobs, withResizableChartDemo],
};

export const Treemap = ({ width, height }) => {
  return (
    <SuperChart
      chartType="echarts-treemap"
      width={width}
      height={height}
      queriesData={[{ data }]}
      formData={{
        colorScheme: 'supersetColors',
        groupby: ['genre'],
        metrics: ['count'],
        showLabels: boolean('Show labels', true),
        showUpperLabels: boolean('Show upperLabels', true),
        labelType: select('Treemap label type', ['key', 'value', 'key_value'], 'key_value'),
      }}
    />
  );
};
