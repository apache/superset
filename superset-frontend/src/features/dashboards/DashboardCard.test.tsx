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

import { MemoryRouter } from 'react-router-dom';
import { FeatureFlag, JsonResponse, SupersetClient } from '@superset-ui/core';
import * as uiCore from '@superset-ui/core';

import { render, screen, waitFor } from 'spec/helpers/testing-library';

import DashboardCard from './DashboardCard';

const mockDashboard = {
  id: 1,
  dashboard_title: 'Sample Dashboard',
  certified_by: 'John Doe',
  certification_details: 'Certified on 2022-01-01',
  published: true,
  url: '/dashboard/1',
  thumbnail_url: '/thumbnails/1.png',
  changed_on_delta_humanized: '2 days ago',
  owners: [
    { id: 1, name: 'Alice', first_name: 'Alice', last_name: 'Doe' },
    { id: 2, name: 'Bob', first_name: 'Bob', last_name: 'Smith' },
  ],
  changed_by_name: 'John Doe',
  changed_by: 'john.doe@example.com',
};

const mockHasPerm = jest.fn().mockReturnValue(true);
const mockOpenDashboardEditModal = jest.fn();
const mockSaveFavoriteStatus = jest.fn();
const mockHandleBulkDashboardExport = jest.fn();
const mockOnDelete = jest.fn();

let isFeatureEnabledMock: jest.MockInstance<boolean, [feature: FeatureFlag]>;

beforeAll(() => {
  isFeatureEnabledMock = jest
    .spyOn(uiCore, 'isFeatureEnabled')
    .mockImplementation(() => true);
});

afterAll(() => {
  // @ts-ignore
  isFeatureEnabledMock.mockClear();
});

beforeEach(() => {
  render(
    <MemoryRouter>
      <DashboardCard
        dashboard={mockDashboard}
        hasPerm={mockHasPerm}
        bulkSelectEnabled={false}
        loading={false}
        openDashboardEditModal={mockOpenDashboardEditModal}
        saveFavoriteStatus={mockSaveFavoriteStatus}
        favoriteStatus={false}
        handleBulkDashboardExport={mockHandleBulkDashboardExport}
        onDelete={mockOnDelete}
      />
    </MemoryRouter>,
  );
});

it('Renders the dashboard title', () => {
  const titleElement = screen.getByText('Sample Dashboard');
  expect(titleElement).toBeInTheDocument();
});

it('Renders the certification details', () => {
  const certificationDetailsElement = screen.getByLabelText(/certified/i);
  expect(certificationDetailsElement).toBeInTheDocument();
});

it('Renders the published status', () => {
  const publishedElement = screen.getByText(/published/i);
  expect(publishedElement).toBeInTheDocument();
});

it('Renders the modified date', () => {
  const modifiedDateElement = screen.getByText('Modified 2 days ago');
  expect(modifiedDateElement).toBeInTheDocument();
});

it('should fetch thumbnail when dashboard has no thumbnail URL and feature flag is enabled', async () => {
  const mockGet = jest.spyOn(SupersetClient, 'get').mockResolvedValue({
    json: { result: { thumbnail_url: '/new-thumbnail.png' } },
  } as unknown as JsonResponse);

  const { rerender } = render(
    <DashboardCard
      dashboard={{
        id: 1,
        thumbnail_url: '',
        changed_by_name: '',
        changed_by: '',
        dashboard_title: '',
        published: false,
        url: '',
        owners: [],
      }}
      hasPerm={() => true}
      bulkSelectEnabled={false}
      loading={false}
      saveFavoriteStatus={() => {}}
      favoriteStatus={false}
      handleBulkDashboardExport={() => {}}
      onDelete={() => {}}
    />,
  );
  await waitFor(() => {
    expect(mockGet).toHaveBeenCalledWith({
      endpoint: '/api/v1/dashboard/1',
    });
  });
  rerender(
    <DashboardCard
      dashboard={{
        id: 1,
        thumbnail_url: '/new-thumbnail.png',
        changed_by_name: '',
        changed_by: '',
        dashboard_title: '',
        published: false,
        url: '',
        owners: [],
      }}
      hasPerm={() => true}
      bulkSelectEnabled={false}
      loading={false}
      saveFavoriteStatus={() => {}}
      favoriteStatus={false}
      handleBulkDashboardExport={() => {}}
      onDelete={() => {}}
    />,
  );
  mockGet.mockRestore();
});
