/* eslint-disable no-magic-numbers */
import React from 'react';
import { SuperChart } from '@superset-ui/chart';
import dummyDatasource from '../../../shared/dummyDatasource';

const data: {
  key: string;
  values: {
    x: string;
    y: number;
  }[];
}[] = [{ key: 'sth', values: [] }];
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
        width={400}
        height={400}
        datasource={dummyDatasource}
        payload={{ data }}
        formData={{
          showBarValue: false,
          showLegend: true,
          vizType: 'dist_bar',
          xTicksLayout: 'auto',
        }}
      />
    ),
    storyName: 'Many bars',
    storyPath: 'legacy-|preset-chart-nvd3|DistBarChartPlugin',
  },
];
