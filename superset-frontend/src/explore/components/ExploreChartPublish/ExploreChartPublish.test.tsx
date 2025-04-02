/**
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
import {
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import { FeatureFlag } from '@superset-ui/core';
import fetchMock from 'fetch-mock';
import ChartPublishedStatus from '.';

const defaultProps = {
  sliceId: 1,
  userCanOverwrite: true,
  isPublished: false,
};
window.featureFlags = {
  [FeatureFlag.PublishCharts]: true,
};

const chartEndpoint = 'glob:*api/v1/chart/*';

fetchMock.put(chartEndpoint, { published: true });
test('renders with unpublished status and write permissions', async () => {
  render(<ChartPublishedStatus {...defaultProps} />);
  expect(screen.getByText('Draft')).toBeInTheDocument();
  expect(fetchMock.calls().length).toBe(1);
  userEvent.click(screen.getByText('Draft'));
  await waitFor(() => {
    expect(screen.getByText('Published')).toBeInTheDocument();
  });
  expect(fetchMock.calls().length).toBe(2);
});

test('renders with published status and write permissions', async () => {
  render(<ChartPublishedStatus {...defaultProps} isPublished={true} />);
  expect(screen.getByText('Published')).toBeInTheDocument();
  expect(fetchMock.calls().length).toBe(2);
  userEvent.click(screen.getByText('Published'));
  await waitFor(() => {
    expect(screen.getByText('Draft')).toBeInTheDocument();
  });
  expect(fetchMock.calls().length).toBe(3);
});
