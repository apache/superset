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
import fetchMock from 'fetch-mock';
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import DraftDashboardNotice from './DraftDashboardNotice';

beforeEach(() => {
  fetchMock.get('/api/v1/report/configuration/', {
    result: {},
    default_executor: 'report_bot',
  });
});
afterEach(() => {
  fetchMock.removeRoutes();
  fetchMock.clearHistory();
});

test('does not warn before selecting a dashboard', () => {
  render(<DraftDashboardNotice />);
  expect(screen.queryByText('Draft dashboard access')).not.toBeInTheDocument();
  expect(fetchMock.callHistory.called('/api/v1/report/configuration/')).toBe(
    false,
  );
});

test('does not warn for a published dashboard', async () => {
  fetchMock.get('/api/v1/dashboard/1', { result: { published: true } });
  render(<DraftDashboardNotice dashboardId={1} />);
  await waitFor(() =>
    expect(fetchMock.callHistory.called('/api/v1/dashboard/1')).toBe(true),
  );
  await fetchMock.callHistory.flush(true);
  expect(screen.queryByText('Draft dashboard access')).not.toBeInTheDocument();
});

test('names the fixed account and gives a remedy without Run as', async () => {
  fetchMock.get('/api/v1/dashboard/1', { result: { published: false } });
  render(<DraftDashboardNotice dashboardId={1} />);
  expect(
    await screen.findByText(/add "report_bot" as a dashboard editor/),
  ).toBeVisible();
  expect(
    screen.queryByText(/select an authorized account in Run as/),
  ).not.toBeInTheDocument();
});

test('describes current-user execution without contradicting it', async () => {
  fetchMock.get('/api/v1/dashboard/1', { result: { published: false } });
  render(
    <DraftDashboardNotice
      dashboardId={1}
      usesDefaultExecutor={false}
      runsAsCurrentUser
    />,
  );
  expect(
    await screen.findByText(/This schedule runs with your permissions/),
  ).toBeVisible();
  expect(
    screen.queryByText(/may differ from your account/),
  ).not.toBeInTheDocument();
  expect(fetchMock.callHistory.called('/api/v1/report/configuration/')).toBe(
    false,
  );
});

test('names the selected executor and offers the available Run as control', async () => {
  fetchMock.get('/api/v1/dashboard/1', { result: { published: false } });
  render(
    <DraftDashboardNotice
      dashboardId={1}
      usesDefaultExecutor={false}
      executorName="Selected editor"
      canChooseExecutor
    />,
  );
  expect(
    await screen.findByText(/add "Selected editor" as a dashboard editor/),
  ).toBeVisible();
  expect(
    screen.getByText(/select an authorized account in Run as/),
  ).toBeVisible();
});

test('does not carry a draft notice over to a different dashboard', async () => {
  fetchMock.get('/api/v1/dashboard/1', { result: { published: false } });
  fetchMock.get('/api/v1/dashboard/2', { result: { published: true } });
  const { rerender } = render(<DraftDashboardNotice dashboardId={1} />);
  await screen.findByText('Draft dashboard access');
  rerender(<DraftDashboardNotice dashboardId={2} />);
  expect(screen.queryByText('Draft dashboard access')).not.toBeInTheDocument();
  await fetchMock.callHistory.flush(true);
  expect(screen.queryByText('Draft dashboard access')).not.toBeInTheDocument();
});

test('does not infer Draft from an inaccessible dashboard', async () => {
  fetchMock.get('/api/v1/dashboard/1', 404);
  render(<DraftDashboardNotice dashboardId={1} />);
  await fetchMock.callHistory.flush(true);
  expect(screen.queryByText('Draft dashboard access')).not.toBeInTheDocument();
});
