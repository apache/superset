/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { render, waitFor } from '@testing-library/react';

import {
  ChartPlugin,
  ChartMetadata,
  DatasourceType,
  getChartComponentRegistry,
} from '@superset-ui/core';

import SuperChartCore from './SuperChartCore';

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

test('should return the result from cache unless transformProps has changed', async () => {
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
