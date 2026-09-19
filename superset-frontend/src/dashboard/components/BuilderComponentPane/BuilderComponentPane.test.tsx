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

import { fireEvent, render, screen } from 'spec/helpers/testing-library';
import BuilderComponentPane from '.';

jest.mock('src/dashboard/containers/SliceAdder', () => () => (
  <div data-test="mock-slice-adder" />
));

test('BuilderComponentPane has correct tabs in correct order', () => {
  render(<BuilderComponentPane topOffset={115} />, {
    useRedux: true,
    initialState: {
      dashboardState: {
        nativeFiltersBarOpen: false,
      },
    },
  });
  const tabs = screen.getAllByRole('tab');
  expect(tabs).toHaveLength(2);
  expect(tabs[0]).toHaveTextContent('Charts');
  expect(tabs[1]).toHaveTextContent('Layout elements');
  expect(screen.getByRole('tab', { selected: true })).toHaveTextContent(
    'Charts',
  );
});

test('does not render Filter Card when DashboardNativeFiltersOnCanvas is disabled', () => {
  window.featureFlags = {};
  render(<BuilderComponentPane topOffset={115} />, {
    useRedux: true,
    useDnd: true,
    initialState: {
      dashboardState: {
        nativeFiltersBarOpen: false,
      },
    },
  });

  fireEvent.click(screen.getByText('Layout elements'));
  expect(screen.queryByText('Filter Card')).not.toBeInTheDocument();
});

test('renders Filter Card when DashboardNativeFiltersOnCanvas is enabled', () => {
  window.featureFlags = {
    DASHBOARD_NATIVE_FILTERS_ON_CANVAS: true,
  };
  render(<BuilderComponentPane topOffset={115} />, {
    useRedux: true,
    useDnd: true,
    initialState: {
      dashboardState: {
        nativeFiltersBarOpen: false,
      },
    },
  });

  fireEvent.click(screen.getByText('Layout elements'));
  expect(screen.getByText('Filter Card')).toBeInTheDocument();
  window.featureFlags = {};
});
