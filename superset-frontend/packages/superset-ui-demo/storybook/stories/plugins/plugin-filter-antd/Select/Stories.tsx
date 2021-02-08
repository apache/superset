import React from 'react';
import { action } from '@storybook/addon-actions';
import { boolean, withKnobs } from '@storybook/addon-knobs';
import { SuperChart, getChartTransformPropsRegistry } from '@superset-ui/core';
import { AntdSelectFilterPlugin } from '@superset-ui/plugin-filter-antd';
import transformProps from '@superset-ui/plugin-filter-antd/lib/Select/transformProps';
import data from './data';
import { withResizableChartDemo } from '../../../../shared/components/ResizableChartDemo';
import 'antd/dist/antd.css';

new AntdSelectFilterPlugin().configure({ key: 'filter_select' }).register();

getChartTransformPropsRegistry().registerValue('filter_select', transformProps);

export default {
  title: 'Filter Plugins|plugin-filter-antd/Select',
  decorators: [withKnobs, withResizableChartDemo],
};

export const Select = ({ width, height }) => {
  return (
    <SuperChart
      chartType="filter_select"
      width={width}
      height={height}
      queriesData={[{ data }]}
      formData={{
        adhoc_filters: [],
        extra_filters: [],
        multiSelect: boolean('Multi select', true),
        inverseSelection: boolean('Inverse selection', false),
        row_limit: 1000,
        viz_type: 'filter_select',
        groupby: ['country_name'],
        metrics: ['SUM(SP_POP_TOTL)'],
      }}
      hooks={{
        setExtraFormData: action('setExtraFormData'),
      }}
    />
  );
};
