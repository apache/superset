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
import {
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import { Menu, MenuItem } from '@superset-ui/core/components/Menu';
import {
  FeatureFlag,
  isFeatureEnabled,
  SupersetClient,
} from '@superset-ui/core';
import { useDownloadMenuItems } from '.';

const mockAddSuccessToast = jest.fn();
const mockAddDangerToast = jest.fn();

jest.mock('src/components/MessageToasts/withToasts', () => ({
  __esModule: true,
  default: (Component: React.ComponentType) => Component,
  useToasts: () => ({
    addSuccessToast: mockAddSuccessToast,
    addDangerToast: mockAddDangerToast,
  }),
}));

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn().mockReturnValue(false),
  SupersetClient: {
    get: jest.fn(),
  },
}));

const mockSupersetClient = SupersetClient as jest.Mocked<typeof SupersetClient>;

const createProps = () => ({
  pdfMenuItemTitle: 'Export to PDF',
  imageMenuItemTitle: 'Download as Image',
  dashboardTitle: 'Test Dashboard',
  logEvent: jest.fn(),
  dashboardId: 123,
  title: 'Download',
  submenuKey: 'download',
  userCanExport: true,
});

const MenuWrapper = () => {
  const downloadMenuItem = useDownloadMenuItems(createProps());
  const menuItems: MenuItem[] = [downloadMenuItem];
  return <Menu forceSubMenuRender items={menuItems} />;
};

const originalCreateObjectURL = window.URL.createObjectURL;
const originalRevokeObjectURL = window.URL.revokeObjectURL;

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  window.URL.createObjectURL = originalCreateObjectURL;
  window.URL.revokeObjectURL = originalRevokeObjectURL;
});

test('Should render all menu items', () => {
  render(<MenuWrapper />, {
    useRedux: true,
  });

  // Screenshot options
  expect(screen.getByText('Export to PDF')).toBeInTheDocument();
  expect(screen.getByText('Download as Image')).toBeInTheDocument();

  // Export options
  expect(screen.getByText('Export YAML')).toBeInTheDocument();
  expect(screen.getByText('Export as Example')).toBeInTheDocument();
});

test('Export as Example calls SupersetClient.get with correct endpoint', async () => {
  const mockBlob = new Blob(['test'], { type: 'application/zip' });
  const mockResponse: Pick<Response, 'blob' | 'headers'> = {
    blob: jest.fn().mockResolvedValue(mockBlob),
    headers: new Headers({
      'Content-Disposition': 'attachment; filename="dashboard_123_example.zip"',
    }),
  };
  mockSupersetClient.get.mockResolvedValue(mockResponse as unknown as Response);

  // Mock URL.createObjectURL / revokeObjectURL since jsdom doesn't support them
  const createObjectURL = jest.fn(() => 'blob:http://localhost/fake');
  const revokeObjectURL = jest.fn();
  window.URL.createObjectURL = createObjectURL;
  window.URL.revokeObjectURL = revokeObjectURL;

  render(<MenuWrapper />, { useRedux: true });

  await userEvent.click(screen.getByText('Export as Example'));

  await waitFor(() => {
    expect(mockSupersetClient.get).toHaveBeenCalledWith({
      endpoint: '/api/v1/dashboard/123/export_as_example/',
      headers: { Accept: 'application/zip' },
      parseMethod: 'raw',
    });
    expect(mockAddSuccessToast).toHaveBeenCalledWith(
      'Dashboard exported as example successfully',
    );
  });
});

test('Export as Example shows error toast on failure', async () => {
  mockSupersetClient.get.mockRejectedValue(new Error('Network error'));

  render(<MenuWrapper />, { useRedux: true });

  await userEvent.click(screen.getByText('Export as Example'));

  await waitFor(() => {
    expect(mockAddDangerToast).toHaveBeenCalledWith(
      'Sorry, something went wrong. Try again later.',
    );
  });
});

const mockIsFeatureEnabled = isFeatureEnabled as jest.Mock;

const MenuWrapperWithProps = (
  overrides: Partial<ReturnType<typeof createProps>> & {
    canExportImage?: boolean;
  },
) => {
  const downloadMenuItem = useDownloadMenuItems({
    ...createProps(),
    ...overrides,
  });
  const menuItems: MenuItem[] = [downloadMenuItem];
  return <Menu forceSubMenuRender items={menuItems} />;
};

test('Screenshot menu items should be disabled when GranularExportControls is ON and canExportImage is false', () => {
  mockIsFeatureEnabled.mockImplementation(
    (flag: string) => flag === FeatureFlag.GranularExportControls,
  );

  render(<MenuWrapperWithProps canExportImage={false} />, {
    useRedux: true,
  });

  const pdfItem = screen
    .getByText('Export to PDF')
    .closest('[role="menuitem"]');
  const imageItem = screen
    .getByText('Download as Image')
    .closest('[role="menuitem"]');
  expect(pdfItem).toHaveAttribute('aria-disabled', 'true');
  expect(imageItem).toHaveAttribute('aria-disabled', 'true');

  mockIsFeatureEnabled.mockReset();
});

test('Screenshot menu items should be enabled when GranularExportControls is ON and canExportImage is true', () => {
  mockIsFeatureEnabled.mockImplementation(
    (flag: string) => flag === FeatureFlag.GranularExportControls,
  );

  render(<MenuWrapperWithProps canExportImage />, {
    useRedux: true,
  });

  const pdfItem = screen
    .getByText('Export to PDF')
    .closest('[role="menuitem"]');
  const imageItem = screen
    .getByText('Download as Image')
    .closest('[role="menuitem"]');
  expect(pdfItem).not.toHaveAttribute('aria-disabled', 'true');
  expect(imageItem).not.toHaveAttribute('aria-disabled', 'true');

  mockIsFeatureEnabled.mockReset();
});

test('Screenshot menu items should not be disabled when canExportImage is not provided', () => {
  mockIsFeatureEnabled.mockReturnValue(false);

  render(<MenuWrapperWithProps />, {
    useRedux: true,
  });

  const pdfItem = screen
    .getByText('Export to PDF')
    .closest('[role="menuitem"]');
  const imageItem = screen
    .getByText('Download as Image')
    .closest('[role="menuitem"]');
  expect(pdfItem).not.toHaveAttribute('aria-disabled', 'true');
  expect(imageItem).not.toHaveAttribute('aria-disabled', 'true');

  mockIsFeatureEnabled.mockReset();
});

test('Disabled screenshot items should show tooltip icon when GranularExportControls is ON', () => {
  mockIsFeatureEnabled.mockImplementation(
    (flag: string) => flag === FeatureFlag.GranularExportControls,
  );

  render(<MenuWrapperWithProps canExportImage={false} />, {
    useRedux: true,
  });

  const tooltipTriggers = screen.getAllByTestId('tooltip-trigger');
  expect(tooltipTriggers.length).toBeGreaterThanOrEqual(2);

  mockIsFeatureEnabled.mockReset();
});

test('Enabled screenshot items should not show tooltip icon', () => {
  mockIsFeatureEnabled.mockImplementation(
    (flag: string) => flag === FeatureFlag.GranularExportControls,
  );

  render(<MenuWrapperWithProps canExportImage />, {
    useRedux: true,
  });

  expect(screen.queryByTestId('tooltip-trigger')).not.toBeInTheDocument();

  mockIsFeatureEnabled.mockReset();
});
