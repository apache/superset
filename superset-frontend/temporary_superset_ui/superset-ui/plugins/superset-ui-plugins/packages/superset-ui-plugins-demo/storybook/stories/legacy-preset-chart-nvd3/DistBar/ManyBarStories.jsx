/* eslint-disable no-magic-numbers */
import React from 'react';
import { SuperChart } from '@superset-ui/chart';
// import data from './data';

const data = [{ key: 'sth', values: [] }];
const LONG_LABEL =
  'some extremely ridiculously extremely extremely extremely ridiculously extremely extremely ridiculously extremely extremely ridiculously extremely long category';

for (let i = 0; i < 50; i += 1) {
  data[0].values.push({
    x: `${LONG_LABEL.substring(0, Math.round(Math.random() * LONG_LABEL.length))} ${i + 1}`,
    y: Math.round(Math.random() * 10000),
  });
}

export default [
  {
    renderStory: () => (
      <SuperChart
        chartType="dist-bar"
        chartProps={{
          datasource: { verboseMap: {} },
          formData: {
            showBarValue: false,
            showLegend: true,
            vizType: 'dist_bar',
            xTicksLayout: 'auto',
          },
          height: 800,
          payload: { data },
          width: 400,
        }}
      />
    ),
    storyName: 'Many bars',
    storyPath: 'legacy-|preset-chart-nvd3|DistBarChartPlugin',
  },
];
