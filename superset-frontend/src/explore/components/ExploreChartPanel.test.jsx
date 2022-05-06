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
import React from 'react';
import { render, screen } from 'spec/helpers/testing-library';
import ChartContainer from 'src/explore/components/ExploreChartPanel';

const createProps = (overrides = {}) => ({
  sliceName: 'Trend Line',
  vizType: 'line',
  height: '500px',
  actions: {},
  can_overwrite: false,
  can_download: false,
  containerId: 'foo',
  width: '500px',
  isStarred: false,
  chartIsStale: false,
  chart: {},
  form_data: {},
  ...overrides,
});

describe('ChartContainer', () => {
  it('renders when vizType is line', () => {
    const props = createProps();
    expect(React.isValidElement(<ChartContainer {...props} />)).toBe(true);
  });

  it('renders with alert banner', () => {
    const props = createProps({
      chartIsStale: true,
      chart: { chartStatus: 'rendered', queriesResponse: [{}] },
    });
    render(<ChartContainer {...props} />, { useRedux: true });
    expect(screen.getByText('Your chart is not up to date')).toBeVisible();
  });

  it('doesnt render alert banner when no changes in control panel were made (chart is not stale)', () => {
    const props = createProps({
      chartIsStale: false,
    });
    render(<ChartContainer {...props} />, { useRedux: true });
    expect(
      screen.queryByText('Your chart is not up to date'),
    ).not.toBeInTheDocument();
  });

  it('doesnt render alert banner when chart not created yet (no queries response)', () => {
    const props = createProps({
      chartIsStale: true,
      chart: { queriesResponse: [] },
    });
    render(<ChartContainer {...props} />, { useRedux: true });
    expect(
      screen.queryByText('Your chart is not up to date'),
    ).not.toBeInTheDocument();
  });

  it('renders prompt to fill required controls when required control removed', () => {
    const props = createProps({
      chartIsStale: true,
      chart: { chartStatus: 'rendered', queriesResponse: [{}] },
      errorMessage: 'error',
    });
    render(<ChartContainer {...props} />, { useRedux: true });
    expect(
      screen.getByText('Required control values have been removed'),
    ).toBeVisible();
  });
});
