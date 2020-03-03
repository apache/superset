import React from 'react';
import { text } from '@storybook/addon-knobs';
import { SuperChart } from '../../../../superset-ui-chart/src';
import {
  DiligentChartPlugin,
  BuggyChartPlugin,
  ChartKeys,
} from '../../../../superset-ui-chart/test/components/MockChartPlugins';

new DiligentChartPlugin().configure({ key: ChartKeys.DILIGENT }).register();
new BuggyChartPlugin().configure({ key: ChartKeys.BUGGY }).register();

const DEFAULT_QUERY_DATA = { data: ['foo', 'bar'] };

export default [
  {
    renderStory: () => {
      const width = text('Vis width', '100%');
      const height = text('Vis height', '100%');

      return (
        <SuperChart
          chartType={ChartKeys.DILIGENT}
          width={width}
          height={height}
          queryData={DEFAULT_QUERY_DATA}
          formData={{ hi: 1 }}
        />
      );
    },
    storyName: 'Basic',
    storyPath: '@superset-ui/chart|SuperChart',
  },
  {
    renderStory: () => {
      const width = text('Vis width', '50%');
      const height = text('Vis height', '50%');

      return (
        <SuperChart
          chartType={ChartKeys.DILIGENT}
          width={width}
          height={height}
          queryData={DEFAULT_QUERY_DATA}
          formData={{ hi: 1 }}
        />
      );
    },
    storyName: '50% of container',
    storyPath: '@superset-ui/chart|SuperChart',
  },
  {
    renderStory: () => {
      const width = text('Vis width', '500');
      const height = text('Vis height', '300');

      return (
        <SuperChart
          chartType={ChartKeys.DILIGENT}
          height={height}
          width={width}
          queryData={DEFAULT_QUERY_DATA}
        />
      );
    },
    storyName: 'fixed dimension',
    storyPath: '@superset-ui/chart|SuperChart',
  },
  {
    renderStory: () => {
      const width = text('Vis width', '500');
      const height = text('Vis height', '100%');

      return (
        <SuperChart
          chartType={ChartKeys.DILIGENT}
          height={height}
          width={width}
          queryData={DEFAULT_QUERY_DATA}
        />
      );
    },
    storyName: 'fixed width, 100% height',
    storyPath: '@superset-ui/chart|SuperChart',
  },
  {
    renderStory: () => {
      const width = text('Vis width', '100%');
      const height = text('Vis height', '300');

      return (
        <SuperChart
          chartType={ChartKeys.DILIGENT}
          height={height}
          width={width}
          queryData={DEFAULT_QUERY_DATA}
        />
      );
    },
    storyName: 'fixed height, 100% width',
    storyPath: '@superset-ui/chart|SuperChart',
  },
  {
    renderStory: () => {
      const width = text('Vis width', '500');
      const height = text('Vis height', '300');

      return (
        <SuperChart
          chartType={ChartKeys.BUGGY}
          height={height}
          width={width}
          queryData={DEFAULT_QUERY_DATA}
        />
      );
    },
    storyName: 'With error boundary',
    storyPath: '@superset-ui/chart|SuperChart',
  },
  {
    renderStory: () => {
      const width = text('Vis width', '100%');
      const height = text('Vis height', '100%');

      return (
        <SuperChart
          chartType={ChartKeys.DILIGENT}
          width={width}
          height={height}
          queryData={DEFAULT_QUERY_DATA}
          Wrapper={({ children }) => (
            <div>
              <div style={{ margin: 10, position: 'fixed' }}>With wrapper!</div>
              {children}
            </div>
          )}
        />
      );
    },
    storyName: 'With Wrapper',
    storyPath: '@superset-ui/chart|SuperChart',
  },
  {
    renderStory: () => {
      const width = text('Vis width', '100%');
      const height = text('Vis height', '100%');

      return <SuperChart chartType={ChartKeys.DILIGENT} width={width} height={height} />;
    },
    storyName: 'With no results',
    storyPath: '@superset-ui/chart|SuperChart',
  },
  {
    renderStory: () => {
      const width = text('Vis width', '400');
      const height = text('Vis height', '300');

      return <SuperChart chartType={ChartKeys.DILIGENT} width={width} height={height} />;
    },
    storyName: 'With no results and small',
    storyPath: '@superset-ui/chart|SuperChart',
  },
];
