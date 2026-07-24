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
import { render, screen, userEvent } from 'spec/helpers/testing-library';
import PublishedStatus from '.';

// Mock the submodule directly (not the barrel) to avoid re-evaluating
// queries/index, whose circular import with dashboardState breaks under jest.
const mockPublish = jest.fn();
jest.mock(
  'src/dashboard/queries/usePublishDashboard/usePublishDashboard',
  () => ({
    usePublishDashboard: () => ({ mutate: mockPublish }),
  }),
);

const defaultProps = {
  dashboardId: 1,
  isPublished: false,
  userCanEdit: false,
  userCanSave: false,
};

beforeEach(() => mockPublish.mockClear());

test('renders with unpublished status and readonly permissions', async () => {
  const tooltip =
    /This dashboard is not published which means it will not show up in the list of dashboards/;
  render(<PublishedStatus {...defaultProps} />);
  expect(screen.getByText('Draft')).toBeInTheDocument();
  userEvent.hover(screen.getByText('Draft'));
  expect(await screen.findByText(tooltip)).toBeInTheDocument();
});

test('renders with unpublished status and write permissions', async () => {
  const tooltip =
    /This dashboard is not published, it will not show up in the list of dashboards/;
  render(<PublishedStatus {...defaultProps} userCanEdit userCanSave />);
  expect(screen.getByText('Draft')).toBeInTheDocument();
  userEvent.hover(screen.getByText('Draft'));
  expect(await screen.findByText(tooltip)).toBeInTheDocument();
  expect(mockPublish).not.toHaveBeenCalled();
  userEvent.click(screen.getByText('Draft'));
  expect(mockPublish).toHaveBeenCalledTimes(1);
});

test('renders with published status and readonly permissions', () => {
  render(<PublishedStatus {...defaultProps} isPublished />);
  expect(screen.queryByText('Published')).not.toBeInTheDocument();
});

test('renders with published status and write permissions', async () => {
  const tooltip = /This dashboard is published. Click to make it a draft/;
  render(
    <PublishedStatus {...defaultProps} isPublished userCanEdit userCanSave />,
  );
  expect(screen.getByText('Published')).toBeInTheDocument();
  userEvent.hover(screen.getByText('Published'));
  expect(await screen.findByText(tooltip)).toBeInTheDocument();
  expect(mockPublish).not.toHaveBeenCalled();
  userEvent.click(screen.getByText('Published'));
  expect(mockPublish).toHaveBeenCalledTimes(1);
});
