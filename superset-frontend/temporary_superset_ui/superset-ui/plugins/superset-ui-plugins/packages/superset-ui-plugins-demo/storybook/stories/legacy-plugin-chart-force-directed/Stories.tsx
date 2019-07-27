/* eslint-disable no-magic-numbers */
import React from 'react';
import { SuperChart } from '@superset-ui/chart';
import data from './data';

export default [
  {
    renderStory: () => (
      <SuperChart chartType="force-directed" width={400} height={400} payload={{ data }} />
    ),
    storyName: 'Basic',
    storyPath: 'legacy-|plugin-chart-force-directed|ForceDirectedChartPlugin',
  },
];
