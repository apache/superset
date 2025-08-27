import { render, waitFor } from '@testing-library/react';

import {
  ChartPlugin,
  ChartMetadata,
  ChartProps,
  DatasourceType,
  getChartComponentRegistry,
} from '@superset-ui/core';

import SuperChartCore from './SuperChartCore';

describe('processChartProps', () => {
  const props = {
    chartType: 'line',
  };
  const FakeChart = () => <span>test</span>;

  beforeEach(() => {
    const metadata = new ChartMetadata({
      name: 'test-chart',
      thumbnail: '',
    });
    const buildQuery = () => ({
      datasource: { id: 1, type: DatasourceType.Table },
      queries: [{ granularity: 'day' }],
      force: false,
      result_format: 'json',
      result_type: 'full',
    });
    const controlPanel = { abc: 1 };
    const plugin = new ChartPlugin({
      metadata,
      Chart: FakeChart,
      buildQuery,
      controlPanel,
    });
    plugin.configure({ key: props.chartType }).register();
  });

  test('should return the same result for identical inputs (cache hit)', async () => {
    const pre = jest.fn(x => x);
    const transform = jest.fn(x => x);
    const post = jest.fn(x => x);
    expect(getChartComponentRegistry().get(props.chartType)).toBe(FakeChart);

    expect(pre).toHaveBeenCalledTimes(0);
    const { rerender } = render(
      <SuperChartCore
        {...props}
        preTransformProps={pre}
        overrideTransformProps={transform}
        postTransformProps={post}
      />,
    );

    await waitFor(() => expect(pre).toHaveBeenCalledTimes(1));
    expect(transform).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledTimes(1);

    const updatedPost = jest.fn(x => x);

    rerender(
      <SuperChartCore
        {...props}
        preTransformProps={pre}
        overrideTransformProps={transform}
        postTransformProps={updatedPost}
      />,
    );
    await waitFor(() => expect(updatedPost).toHaveBeenCalledTimes(1));
    expect(transform).toHaveBeenCalledTimes(1);
    expect(pre).toHaveBeenCalledTimes(1);
  });
});
