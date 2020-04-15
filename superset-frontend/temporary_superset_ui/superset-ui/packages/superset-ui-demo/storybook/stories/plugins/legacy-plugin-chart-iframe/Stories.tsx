import React from 'react';
import { SuperChart } from '@superset-ui/chart';
import IframeChartPlugin from '@superset-ui/legacy-plugin-chart-iframe';

new IframeChartPlugin().configure({ key: 'iframe' }).register();

export default {
  title: 'Legacy Chart Plugins|legacy-plugin-chart-iframe',
};

export const basic = () => (
  <SuperChart
    chartType="iframe"
    width={400}
    height={400}
    queryData={{}}
    formData={{
      url: 'https://www.youtube.com/embed/jbkSRLYSojo',
    }}
  />
);
