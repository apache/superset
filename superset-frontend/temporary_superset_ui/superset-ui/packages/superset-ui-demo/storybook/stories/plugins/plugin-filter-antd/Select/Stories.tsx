import React from 'react';
import { SuperChart, getChartTransformPropsRegistry } from '@superset-ui/core';
import { AntdSelectFilterPlugin } from '@superset-ui/plugin-filter-antd';
import transformProps from '@superset-ui/plugin-filter-antd/lib/Select/transformProps';
import data from './data';
import { withResizableChartDemo } from '../../../../shared/components/ResizableChartDemo';

new AntdSelectFilterPlugin().configure({ key: 'filter_select' }).register();

getChartTransformPropsRegistry().registerValue('filter_select', transformProps);

export default {
  title: 'Filter Plugins|plugin-filter-antd/Select',
  decorators: [withResizableChartDemo],
};

export const Select = ({ width, height }) => {
  return (
    <SuperChart
      chartType="filter_select"
      width={width}
      height={height}
      queryData={{ data }}
      formData={{
        adhoc_filters: [],
        extra_filters: [],
        multiSelect: true,
        row_limit: 1000,
        viz_type: 'filter_select',
        groupby: ['country_name'],
        metrics: ['SUM(SP_POP_TOTL)'],
      }}
    />
  );
};
