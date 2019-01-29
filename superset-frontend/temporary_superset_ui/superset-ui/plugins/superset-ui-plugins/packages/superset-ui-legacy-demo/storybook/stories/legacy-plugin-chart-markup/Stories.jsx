import React from 'react';
import { SuperChart } from '@superset-ui/chart';

export default [
  {
    renderStory: () => (
      <SuperChart
        chartType="markup"
        chartProps={{
          formData: {
            vizType: 'markup',
          },
          height: 600,
          payload: {
            data: {
              html:
                '<div><b>hello</b> <i>world</i><div><img src="https://avatars3.githubusercontent.com/u/42724554?s=200&v=4" style="width: 80px" />',
            },
          },
          width: 600,
        }}
      />
    ),
    storyName: 'MarkupChartPlugin',
    storyPath: 'plugin-chart-markup',
  },
];
