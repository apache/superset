/* eslint-disable no-magic-numbers */
import React from 'react';
import { SuperChart } from '@superset-ui/chart';
import SunburstChartPlugin from '@superset-ui/legacy-plugin-chart-sunburst';
import data from './data';

new SunburstChartPlugin().configure({ key: 'sunburst' }).register();

export default {
  title: 'Legacy Chart Plugins|legacy-plugin-chart-sunburst',
};

export const basic = () => (
  <SuperChart
    chartType="sunburst"
    width={400}
    height={400}
    queryData={{ data }}
    formData={{
      colorScheme: 'd3Category10',
      metric: 'sum__SP_POP_TOTL',
      secondaryMetric: 'sum__SP_RUR_TOTL',
    }}
  />
);
