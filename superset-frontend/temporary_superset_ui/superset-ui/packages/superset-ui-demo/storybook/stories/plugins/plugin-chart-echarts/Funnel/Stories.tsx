import React from 'react';
import { SuperChart, getChartTransformPropsRegistry } from '@superset-ui/core';
import { boolean, number, select, withKnobs } from '@storybook/addon-knobs';
import { EchartsFunnelChartPlugin } from '@superset-ui/plugin-chart-echarts';
import transformProps from '@superset-ui/plugin-chart-echarts/lib/Funnel/transformProps';
import { dataSource } from './constants';
import { withResizableChartDemo } from '../../../../shared/components/ResizableChartDemo';

new EchartsFunnelChartPlugin().configure({ key: 'echarts-funnel' }).register();

getChartTransformPropsRegistry().registerValue('echarts-funnel', transformProps);

export default {
  title: 'Chart Plugins|plugin-chart-echarts/Funnel',
  decorators: [withKnobs, withResizableChartDemo],
};

export const Funnel = ({ width, height }) => {
  return (
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
        orient: select('orient', ['horizontal', 'vertical'], 'vertical'),
        sort: select('sort', ['descending', 'ascending', 'none'], 'descending'),
        gap: number('gap', 0),
        labelType: select(
          'label type',
          ['key', 'value', 'percent', 'key_value', 'key_percent', 'key_value_percent'],
          'key',
        ),
        labelLine: boolean('Label line', true),
        showLabels: boolean('Show labels', true),
        showLegend: boolean('Show legend', false),
      }}
    />
  );
};
