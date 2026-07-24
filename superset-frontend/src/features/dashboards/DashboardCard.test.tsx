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
import { isFeatureEnabled } from '@superset-ui/core';

import { render, screen } from 'spec/helpers/testing-library';
import { SubjectType } from 'src/types/Subject';

import DashboardCard from './DashboardCard';

const aliceEditor = { id: 1, label: 'Alice Doe', type: SubjectType.User };
const bobEditor = { id: 2, label: 'Bob Smith', type: SubjectType.User };

const mockDashboard = {
  id: 1,
  dashboard_title: 'Sample Dashboard',
  certified_by: 'John Doe',
  certification_details: 'Certified on 2022-01-01',
  published: true,
  url: '/dashboard/1',
  changed_on_utc: '2024-01-01T00:00:00',
  changed_on_delta_humanized: '2 days ago',
  changed_by_name: 'John Doe',
  changed_by: 'john.doe@example.com',
  editors: [aliceEditor, bobEditor],
};

const mockHasPerm = jest.fn().mockReturnValue(true);
const mockOpenDashboardEditModal = jest.fn();
const mockSaveFavoriteStatus = jest.fn();
const mockHandleBulkDashboardExport = jest.fn();
const mockOnDelete = jest.fn();

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn(),
}));

const mockedIsFeatureEnabled = isFeatureEnabled as jest.Mock;

beforeAll(() => {
  mockedIsFeatureEnabled.mockReturnValue(true);
});

afterAll(() => {
  mockedIsFeatureEnabled.mockClear();
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

test('Renders the dashboard title', () => {
  const titleElement = screen.getByText('Sample Dashboard');
  expect(titleElement).toBeInTheDocument();
});

test('Renders the certification details', () => {
  const certificationDetailsElement = screen.getByLabelText(/certified/i);
  expect(certificationDetailsElement).toBeInTheDocument();
});

test('Renders the published status', () => {
  const publishedElement = screen.getByText(/published/i);
  expect(publishedElement).toBeInTheDocument();
});

test('Renders the modified date', () => {
  const modifiedDateElement = screen.getByText('Modified 2 days ago');
  expect(modifiedDateElement).toBeInTheDocument();
});

describe('thumbnail URL construction', () => {
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      blob: () => Promise.resolve(new Blob([''], { type: 'image/png' })),
    } as Response);
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  const renderCard = (dashboard: object) =>
    render(
      <MemoryRouter>
        <DashboardCard
          dashboard={dashboard as any}
          hasPerm={() => true}
          bulkSelectEnabled={false}
          loading={false}
          showThumbnails
          saveFavoriteStatus={() => {}}
          favoriteStatus={false}
          handleBulkDashboardExport={() => {}}
          onDelete={() => {}}
        />
      </MemoryRouter>,
    );

  test('constructs thumbnail URL from dashboard id and changed_on_utc', () => {
    renderCard({
      id: 2,
      changed_by_name: '',
      changed_by: '',
      dashboard_title: 'UTC Dashboard',
      published: false,
      url: '/dashboard/2',
      editors: [aliceEditor, bobEditor],
      changed_on_utc: '2024-01-01T00:00:00',
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/v1/dashboard/2/thumbnail/2024-01-01T00%3A00%3A00/',
    );
  });

  test('falls back to changed_on when changed_on_utc is absent', () => {
    renderCard({
      id: 3,
      changed_by_name: '',
      changed_by: '',
      dashboard_title: 'Fallback Dashboard',
      published: false,
      url: '/dashboard/3',
      editors: [aliceEditor, bobEditor],
      changed_on: '2024-06-01T12:00:00',
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/v1/dashboard/3/thumbnail/2024-06-01T12%3A00%3A00/',
    );
  });

  test('renders no thumbnail when both changed_on_utc and changed_on are absent', () => {
    renderCard({
      id: 4,
      changed_by_name: '',
      changed_by: '',
      dashboard_title: 'No Timestamp Dashboard',
      published: false,
      url: '/dashboard/4',
      editors: [aliceEditor, bobEditor],
    });

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
