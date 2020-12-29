import React from 'react';
import { text, withKnobs } from '@storybook/addon-knobs';
import { SuperChart } from '@superset-ui/core';
import {
  DiligentChartPlugin,
  BuggyChartPlugin,
  ChartKeys,
} from '@superset-ui/core/test/chart/components/MockChartPlugins';
import ResizableChartDemo from '../../shared/components/ResizableChartDemo';

new DiligentChartPlugin().configure({ key: ChartKeys.DILIGENT }).register();
new BuggyChartPlugin().configure({ key: ChartKeys.BUGGY }).register();

const DEFAULT_QUERY_DATA = { data: ['foo', 'bar'] };

export default {
  title: 'Core / chart',
  decorators: [withKnobs],
};

export const basic = () => {
  const width = text('Vis width', '100%');
  const height = text('Vis height', '100%');

  return (
    <SuperChart
      chartType={ChartKeys.DILIGENT}
      width={width}
      height={height}
      queriesData={[DEFAULT_QUERY_DATA]}
      formData={{ hi: 1 }}
    />
  );
};
export const container50pct = () => {
  const width = text('Vis width', '50%');
  const height = text('Vis height', '50%');

  return (
    <SuperChart
      chartType={ChartKeys.DILIGENT}
      width={width}
      height={height}
      queriesData={[DEFAULT_QUERY_DATA]}
      formData={{ hi: 1 }}
    />
  );
};
container50pct.story = { name: '50% of container' };

export const Resizable = () => {
  return (
    <ResizableChartDemo>
      {size => (
        <SuperChart
          chartType={ChartKeys.DILIGENT}
          width={size.width}
          height={size.height}
          queriesData={[DEFAULT_QUERY_DATA]}
        />
      )}
    </ResizableChartDemo>
  );
};

export const fixedWidth100height = () => {
  const width = text('Vis width', '500');
  const height = text('Vis height', '100%');

  return (
    <SuperChart
      chartType={ChartKeys.DILIGENT}
      height={height}
      width={width}
      queriesData={[DEFAULT_QUERY_DATA]}
    />
  );
};
fixedWidth100height.story = { name: 'fixed width, 100% height' };

export const fixedHeight100Width = () => {
  const width = text('Vis width', '100%');
  const height = text('Vis height', '300');

  return (
    <SuperChart
      chartType={ChartKeys.DILIGENT}
      height={height}
      width={width}
      queriesData={[DEFAULT_QUERY_DATA]}
    />
  );
};
fixedHeight100Width.story = { name: 'fixed height, 100% width' };

export const withErrorBoundar = () => {
  const width = text('Vis width', '500');
  const height = text('Vis height', '300');

  return (
    <SuperChart
      chartType={ChartKeys.BUGGY}
      height={height}
      width={width}
      queriesData={[DEFAULT_QUERY_DATA]}
    />
  );
};

export const withWrapper = () => {
  const width = text('Vis width', '100%');
  const height = text('Vis height', '100%');

  return (
    <SuperChart
      chartType={ChartKeys.DILIGENT}
      width={width}
      height={height}
      queriesData={[DEFAULT_QUERY_DATA]}
      Wrapper={({ children }) => (
        <div>
          <div style={{ margin: 10, position: 'fixed' }}>With wrapper!</div>
          {children}
        </div>
      )}
    />
  );
};
export const withNoResults = () => {
  const width = text('Vis width', '100%');
  const height = text('Vis height', '100%');

  return <SuperChart chartType={ChartKeys.DILIGENT} width={width} height={height} />;
};
export const withNoResultsAndMedium = () => {
  const width = text('Vis width', '400');
  const height = text('Vis height', '300');

  return <SuperChart chartType={ChartKeys.DILIGENT} width={width} height={height} />;
};
export const withNoResultsAndSmall = () => {
  const width = text('Vis width', '150');
  const height = text('Vis height', '200');

  return <SuperChart chartType={ChartKeys.DILIGENT} width={width} height={height} />;
};
