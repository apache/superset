import React from 'react';
import { text } from '@storybook/addon-knobs';
import { SuperChart, ChartProps } from '../../../../superset-ui-chart/src';
import {
  DiligentChartPlugin,
  BuggyChartPlugin,
  ChartKeys,
} from '../../../../superset-ui-chart/test/components/MockChartPlugins';

new DiligentChartPlugin().configure({ key: ChartKeys.DILIGENT }).register();
new BuggyChartPlugin().configure({ key: ChartKeys.BUGGY }).register();

export default [
  {
    renderStory: () => {
      const width = text('Vis width', '50%');
      const height = text('Vis height', '75%');

      return (
        <SuperChart
          chartType={ChartKeys.DILIGENT}
          width={width}
          height={height}
          formData={{ hi: 1 }}
        />
      );
    },
    storyName: 'Basic',
    storyPath: '@superset-ui/chart|SuperChart',
  },
  {
    renderStory: () => {
      const width = text('Vis width', '500');
      const height = text('Vis height', '300');

      return (
        <SuperChart
          chartType={ChartKeys.DILIGENT}
          chartProps={{
            height: Number(height),
            width: Number(width),
          }}
        />
      );
    },
    storyName: 'passing ChartPropsConfig',
    storyPath: '@superset-ui/chart|SuperChart',
  },
  {
    renderStory: () => {
      const width = text('Vis width', '500');
      const height = text('Vis height', '300');

      return (
        <SuperChart
          chartType={ChartKeys.DILIGENT}
          chartProps={
            new ChartProps({
              height: Number(height),
              width: Number(width),
            })
          }
        />
      );
    },
    storyName: 'passing ChartProps',
    storyPath: '@superset-ui/chart|SuperChart',
  },
  {
    renderStory: () => {
      const width = text('Vis width', '500');
      const height = text('Vis height', '300');

      return (
        <SuperChart
          chartType={ChartKeys.BUGGY}
          chartProps={
            new ChartProps({
              height: Number(height),
              width: Number(width),
            })
          }
        />
      );
    },
    storyName: 'With error boundary',
    storyPath: '@superset-ui/chart|SuperChart',
  },
];
