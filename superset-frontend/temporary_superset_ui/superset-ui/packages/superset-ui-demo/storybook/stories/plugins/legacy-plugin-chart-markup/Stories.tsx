import React from 'react';
import { SuperChart } from '@superset-ui/chart';
import MarkupChartPlugin from '@superset-ui/legacy-plugin-chart-markup';

new MarkupChartPlugin().configure({ key: 'markup' }).register();

export default {
  title: 'Legacy Chart Plugins|legacy-plugin-chart-markup',
};

export const basic = () => (
  <SuperChart
    chartType="markup"
    width={400}
    height={400}
    queryData={{
      data: {
        html:
          '<div><b>hello</b> <i>world</i><div><img src="https://avatars3.githubusercontent.com/u/42724554?s=200&v=4" style="width: 80px" />',
      },
    }}
    formData={{ vizType: 'markup' }}
  />
);
