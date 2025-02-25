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
import { SupersetClient } from '@superset-ui/core';
import { mockStore } from 'spec/fixtures/mockStore';
import PropertiesModal from '.';

// Mock Ant Design Grid System
jest.mock('antd/lib/grid/hooks/useBreakpoint', () => ({
  __esModule: true,
  default: () => ({
    xs: true,
    sm: true,
    md: true,
    lg: true,
    xl: true,
    xxl: true,
  }),
}));

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

const dashboardResult = {
  json: {
    result: {
      dashboard_title: 'New Title',
      slug: '/new',
      json_metadata: '{"something":"foo"}',
      owners: [],
      roles: [],
    },
  },
};

fetchMock.restore();

fetchMock.get('glob:*/api/v1/dashboard/related/owners?*', {
  result: [],
});

fetchMock.get('glob:*/api/v1/dashboard/*', {
  result: {
    dashboard_title: 'New Title',
    slug: '/new',
    json_metadata: '{"something":"foo"}',
    owners: [],
    roles: [],
  },
});

const requiredProps = {
  dashboardId: 1,
  show: true,
  addSuccessToast: jest.fn(),
  onHide: jest.fn(),
  addDangerToast: jest.fn(),
};

const renderModal = (props = {}) =>
  render(<PropertiesModal {...requiredProps} {...props} />, {
    useRedux: true,
    store: mockStore,
  });

describe('PropertiesModal', () => {
  beforeAll(() => {
    jest.useFakeTimers();
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('onColorSchemeChange', () => {
    it('sets up a default state', async () => {
      renderModal({ colorScheme: 'SUPERSET_DEFAULT' });
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });

    describe('with a valid color scheme as an arg', () => {
      describe('without metadata', () => {
        it('updates the color scheme in the metadata', async () => {
          renderModal({ colorScheme: 'SUPERSET_DEFAULT' });
          await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
          });
          const advancedButton = screen.getByText('Advanced');
          advancedButton.click();
          await waitFor(() => {
            expect(screen.getByText('JSON metadata')).toBeInTheDocument();
          });
        });
      });

      describe('with metadata', () => {
        it('will update the metadata with color_scheme', async () => {
          const spy = jest.spyOn(SupersetClient, 'get').mockResolvedValue({
            json: {
              result: {
                dashboard_title: 'New Title',
                slug: '/new',
                json_metadata: '{"color_scheme": "foo"}',
                owners: [],
                roles: [],
              },
            },
          });
          renderModal();
          await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
          });
          const advancedButton = screen.getByText('Advanced');
          advancedButton.click();
          await waitFor(() => {
            expect(screen.getByText('JSON metadata')).toBeInTheDocument();
          });
          spy.mockRestore();
        });
      });
    });
  });

  describe('onOwnersChange', () => {
    it('should update owners when changed', async () => {
      const spy = jest.spyOn(SupersetClient, 'get').mockResolvedValue({
        json: {
          result: [{ value: 1, text: 'foo' }],
          count: 1,
        },
      });
      renderModal();
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
      const ownersSelect = screen.getByRole('combobox', { name: 'Owners' });
      expect(ownersSelect).toBeInTheDocument();
      spy.mockRestore();
    });
  });

  describe('fetchDashboardDetails', () => {
    it('should make an api call', async () => {
      const spy = jest.spyOn(SupersetClient, 'get');
      renderModal();
      await waitFor(() => {
        expect(spy).toHaveBeenCalledWith({
          endpoint: '/api/v1/dashboard/1',
        });
      });
      spy.mockRestore();
    });

    it('should update state with dashboard details', async () => {
      const spy = jest
        .spyOn(SupersetClient, 'get')
        .mockResolvedValue(dashboardResult);
      renderModal();
      await waitFor(() => {
        expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue(
          'New Title',
        );
        expect(screen.getByRole('textbox', { name: 'URL slug' })).toHaveValue(
          '/new',
        );
      });
      const advancedButton = screen.getByText('Advanced');
      advancedButton.click();
      await waitFor(() => {
        expect(screen.getByText('JSON metadata')).toBeInTheDocument();
      });
      spy.mockRestore();
    });

    it('should handle owners in dashboard details', async () => {
      const spy = jest.spyOn(SupersetClient, 'get').mockResolvedValue({
        json: {
          result: {
            dashboard_title: 'New Title',
            slug: '/new',
            json_metadata: '{"something":"foo"}',
            owners: [{ id: 1, first_name: 'Al', last_name: 'Pacino' }],
            roles: [],
          },
        },
      });
      renderModal();
      await waitFor(() => {
        const ownersSelect = screen.getByRole('combobox', { name: 'Owners' });
        expect(ownersSelect).toBeInTheDocument();
      });
      spy.mockRestore();
    });

    it('should handle roles in dashboard details', async () => {
      const spy = jest.spyOn(SupersetClient, 'get').mockResolvedValue({
        json: {
          result: {
            dashboard_title: 'New Title',
            slug: '/new',
            json_metadata: '{"something":"foo"}',
            owners: [],
            roles: [{ id: 1, name: 'Alpha' }],
          },
        },
      });
      renderModal();
      await waitFor(() => {
        const rolesSelect = screen.queryByRole('combobox', { name: 'Roles' });
        expect(rolesSelect).toBeInTheDocument();
      });
      spy.mockRestore();
    });
  });
});
