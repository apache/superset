/* eslint-disable no-magic-numbers */
import React from 'react';
import { SuperChart } from '@superset-ui/core';
import SankeyChartPlugin from '@superset-ui/legacy-plugin-chart-sankey';
import ResizableChartDemo from '../../../shared/components/ResizableChartDemo';
import data from './data';

new SankeyChartPlugin().configure({ key: 'sankey' }).register();

export default {
  title: 'Legacy Chart Plugins|legacy-plugin-chart-sankey',
};

export const basic = () => (
  <SuperChart
    chartType="sankey"
    width={400}
    height={400}
    queriesData={[{ data }]}
    formData={{
      colorScheme: 'd3Category10',
    }}
  />
);

export const resizable = () => (
  <ResizableChartDemo>
    {({ width, height }) => (
      <SuperChart
        chartType="sankey"
        width={width}
        height={height}
        queriesData={[{ data }]}
        formData={{
          colorScheme: 'd3Category10',
        }}
      />
    )}
  </ResizableChartDemo>
);
