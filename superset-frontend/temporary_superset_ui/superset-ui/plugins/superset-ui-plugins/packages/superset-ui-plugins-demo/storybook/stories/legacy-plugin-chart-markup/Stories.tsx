import React from 'react';
import { SuperChart } from '@superset-ui/chart';

export default [
  {
    renderStory: () => (
      <SuperChart
        chartType="markup"
        width={400}
        height={400}
        payload={{
          data: {
            html:
              '<div><b>hello</b> <i>world</i><div><img src="https://avatars3.githubusercontent.com/u/42724554?s=200&v=4" style="width: 80px" />',
          },
        }}
        formData={{ vizType: 'markup' }}
      />
    ),
    storyName: 'Basic',
    storyPath: 'legacy-|plugin-chart-markup|MarkupChartPlugin',
  },
];
