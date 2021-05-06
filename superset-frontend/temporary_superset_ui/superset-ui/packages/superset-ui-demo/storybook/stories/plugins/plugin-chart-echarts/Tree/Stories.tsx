import React from 'react';
import { SuperChart, getChartTransformPropsRegistry } from '@superset-ui/core';
import { select, withKnobs, text, number } from '@storybook/addon-knobs';
import { EchartsTreeChartPlugin } from '@superset-ui/plugin-chart-echarts';
import transformProps from '@superset-ui/plugin-chart-echarts/lib/Tree/transformProps';
import data from './data';
import { withResizableChartDemo } from '../../../../shared/components/ResizableChartDemo';

new EchartsTreeChartPlugin().configure({ key: 'echarts-tree' }).register();

getChartTransformPropsRegistry().registerValue('echarts-tree', transformProps);

export default {
  title: 'Chart Plugins|plugin-chart-echarts/Tree',
  decorators: [withKnobs, withResizableChartDemo],
};

export const Tree = ({ width, height }) => {
  return (
    <SuperChart
      chartType="echarts-tree"
      width={width}
      height={height}
      queriesData={[{ data }]}
      formData={{
        colorScheme: 'bnbColors',
        datasource: '3__table',
        granularity_sqla: 'ds',
        metric: 'count',
        id: select('Id Column', ['id_column', 'name_column', 'parent_column'], 'id_column'),
        rootNodeId: text('Root Node', '1'),
        parent: select('Parent Column', ['parent_column', 'id_column'], 'parent_column'),
        name: select('Name Column', [null, 'name_column'], 'name_column'),

        position: select('Label Position', ['top', 'right', 'left', 'bottom'], 'top'),
        layout: select('Tree Layout', ['orthogonal', 'radial'], 'orthogonal'),
        orient: select('Orientation', ['LR', 'RL', 'TB', 'BT'], 'LR'),
        emphasis: select('Emphasis', ['ancestor', 'descendant'], 'descendant'),
        symbol: select('Symbol', ['emptyCircle', 'circle', 'rect', 'triangle'], 'circle'),
        symbol_size: number('[Symbol Size', 7, { range: true, min: 5, max: 30, step: 2 }),
      }}
    />
  );
};
