/* eslint-disable no-magic-numbers */
import React from 'react';
import { SuperChart } from '@superset-ui/chart';
import data from './data';

export default [
  {
    renderStory: () => (
      <SuperChart
        chartType="bullet"
        chartProps={{
          formData: {
            markerLabels: '',
            markerLineLabels: '',
            markerLines: '',
            markers: '',
            rangeLabels: '',
            ranges: '',
            vizType: 'bullet',
          },
          height: 400,
          payload: { data },
          width: 400,
        }}
      />
    ),
    storyName: 'Basic',
    storyPath: 'legacy-|preset-chart-nvd3|BulletChartPlugin',
  },
];
