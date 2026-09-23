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
import fetchMock from 'fetch-mock';
import {
  act,
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import { Menu, MenuItem } from '@superset-ui/core/components/Menu';
import {
  FeatureFlag,
  getClientErrorObject,
  isFeatureEnabled,
  SupersetClient,
} from '@superset-ui/core';
import { useDownloadMenuItems } from '.';

const mockAddSuccessToast = jest.fn();
const mockAddDangerToast = jest.fn();
const mockAddInfoToast = jest.fn();

jest.mock('src/components/MessageToasts/withToasts', () => ({
  __esModule: true,
  default: (Component: React.ComponentType) => Component,
  useToasts: () => ({
    addSuccessToast: mockAddSuccessToast,
    addDangerToast: mockAddDangerToast,
    addInfoToast: mockAddInfoToast,
  }),
}));

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn().mockReturnValue(false),
  getClientErrorObject: jest.fn().mockResolvedValue({}),
  SupersetClient: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

const mockSupersetClient = SupersetClient as jest.Mocked<typeof SupersetClient>;
const mockGetClientErrorObject = getClientErrorObject as jest.Mock;

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

// The default test store has an empty user; most tests exercise a logged-in
// session with an email on file.
const loggedInState = { user: { userId: 1, email: 'admin@example.com' } };
const guestState = { user: {} };

const MenuWrapper = () => {
  const downloadMenuItem = useDownloadMenuItems(createProps());
  const menuItems: MenuItem[] = [downloadMenuItem];
  return <Menu forceSubMenuRender items={menuItems} />;
};

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

// jsdom cannot follow an <a download> click, so record what was clicked.
let clickedDownloads: { href: string | null; download: string | null }[] = [];
let anchorClickSpy: jest.SpyInstance;
const lastDownloadHref = () =>
  clickedDownloads.length
    ? clickedDownloads[clickedDownloads.length - 1].href
    : null;

// forceSubMenuRender keeps the items mounted while the submenu is visually
// closed, so they sit under `pointer-events: none`; and user-event's own delay
// is a setTimeout that never fires once a test installs fake timers.
const clickMenuItem = (label: string) =>
  userEvent.click(screen.getByText(label), {
    pointerEventsCheck: 0,
    delay: null,
  });

const originalCreateObjectURL = window.URL.createObjectURL;
const originalRevokeObjectURL = window.URL.revokeObjectURL;
const originalLocation = window.location;

beforeEach(() => {
  jest.clearAllMocks();
  // The ready link is confirmed with HEAD before the browser is sent to it.
  fetchMock.head('glob:*/api/v1/dashboard/export_xlsx/download/*', 200);
  clickedDownloads = [];
  anchorClickSpy = jest
    .spyOn(HTMLAnchorElement.prototype, 'click')
    .mockImplementation(function recordClick(this: HTMLAnchorElement) {
      clickedDownloads.push({
        href: this.getAttribute('href'),
        download: this.getAttribute('download'),
      });
    });
  // Reset the implementation each test: clearAllMocks resets call history but
  // not mockReturnValue, so an override in one test would otherwise leak.
  (isFeatureEnabled as jest.Mock).mockReturnValue(false);
  // @ts-ignore
  delete window.location;
  window.location = { href: '' } as Location;
});

// "Export Images to Excel" is gated on the webdriver screenshot feature flags.
const enableWebDriverScreenshot = () =>
  (isFeatureEnabled as jest.Mock).mockReturnValue(true);

afterEach(() => {
  fetchMock.removeRoutes();
  fetchMock.clearHistory();
  anchorClickSpy.mockRestore();
  window.URL.createObjectURL = originalCreateObjectURL;
  window.URL.revokeObjectURL = originalRevokeObjectURL;
  window.location = originalLocation;
  jest.useRealTimers();
});

test('Should render all menu items', () => {
  enableWebDriverScreenshot();
  render(<MenuWrapper />, {
    useRedux: true,
    initialState: loggedInState,
  });

  // Screenshot options
  expect(screen.getByText('Export to PDF')).toBeInTheDocument();
  expect(screen.getByText('Download as Image')).toBeInTheDocument();

  // Export options
  expect(screen.getByText('Export Data to Excel')).toBeInTheDocument();
  expect(screen.getByText('Export Images to Excel')).toBeInTheDocument();
  expect(screen.getByText('Export YAML')).toBeInTheDocument();
  expect(screen.getByText('Export as Example')).toBeInTheDocument();
});

test('Export Images to Excel is hidden when the webdriver is not enabled', () => {
  // Default: webdriver screenshot flags off. Image export needs the webdriver,
  // so only the data export is offered.
  render(<MenuWrapper />, { useRedux: true, initialState: loggedInState });

  expect(screen.getByText('Export Data to Excel')).toBeInTheDocument();
  expect(screen.queryByText('Export Images to Excel')).not.toBeInTheDocument();
});

test('Excel export items are hidden when userCanExport is false', () => {
  render(<MenuWrapperWithProps userCanExport={false} />, {
    useRedux: true,
    initialState: loggedInState,
  });

  expect(screen.queryByText('Export Data to Excel')).not.toBeInTheDocument();
  expect(screen.queryByText('Export Images to Excel')).not.toBeInTheDocument();
  // YAML export is not gated on userCanExport and remains visible
  expect(screen.getByText('Export YAML')).toBeInTheDocument();
});

test('sessions without a user id get the data export but no bundle exports', () => {
  // The API refuses bundle exports for them, so offering them only yields errors.
  render(<MenuWrapper />, { useRedux: true, initialState: guestState });

  expect(screen.getByText('Export Data to Excel')).toBeInTheDocument();
  expect(screen.queryByText('Export YAML')).not.toBeInTheDocument();
  expect(screen.queryByText('Export as Example')).not.toBeInTheDocument();
});

test('Export Data to Excel posts mode "data" and shows a pending toast', async () => {
  mockSupersetClient.post.mockResolvedValue({
    json: { job_id: 'abc' },
  } as never);

  render(<MenuWrapper />, { useRedux: true, initialState: loggedInState });

  await clickMenuItem('Export Data to Excel');

  await waitFor(() => {
    expect(mockSupersetClient.post).toHaveBeenCalledWith({
      endpoint: '/api/v1/dashboard/123/export_xlsx/',
      jsonPayload: { active_data_mask: {}, mode: 'data' },
    });
    expect(mockAddInfoToast).toHaveBeenCalledWith(
      "Your export is being generated and will download automatically when ready. We'll also email you a download link.",
      { noDuplicate: true },
    );
  });
});

test('Export Images to Excel posts mode "images" and shows a pending toast', async () => {
  enableWebDriverScreenshot();
  mockSupersetClient.post.mockResolvedValue({
    json: { job_id: 'abc' },
  } as never);

  render(<MenuWrapper />, { useRedux: true, initialState: loggedInState });

  await clickMenuItem('Export Images to Excel');

  await waitFor(() => {
    expect(mockSupersetClient.post).toHaveBeenCalledWith({
      endpoint: '/api/v1/dashboard/123/export_xlsx/',
      jsonPayload: { active_data_mask: {}, mode: 'images' },
    });
    expect(mockAddInfoToast).toHaveBeenCalledWith(
      "Your export is being generated and will download automatically when ready. We'll also email you a download link.",
      { noDuplicate: true },
    );
  });
});

test('Export Data to Excel polls status and auto-downloads once ready', async () => {
  // A guest/embedded session has no email to be notified at, so completion is
  // discovered by polling export_xlsx/status/<job_id>/ instead -- exercised
  // here regardless of session type, since the same polling drives the
  // auto-download for a regular session too.
  jest.useFakeTimers();
  mockSupersetClient.post.mockResolvedValue({
    json: { job_id: 'abc' },
  } as never);
  mockSupersetClient.get.mockResolvedValueOnce({
    json: {
      status: 'ready',
      download_url: '/api/v1/dashboard/export_xlsx/download/abc/',
    },
  } as never);

  render(<MenuWrapper />, { useRedux: true, initialState: loggedInState });

  await clickMenuItem('Export Data to Excel');
  await waitFor(() =>
    expect(mockAddInfoToast).toHaveBeenCalledWith(
      "Your export is being generated and will download automatically when ready. We'll also email you a download link.",
      { noDuplicate: true },
    ),
  );

  await act(async () => {
    jest.advanceTimersByTime(3000);
  });

  // The download is handed to the browser via an anchor (no second
  // SupersetClient.get, so the whole workbook is never buffered in page memory).
  await waitFor(() => {
    expect(mockSupersetClient.get).toHaveBeenCalledWith({
      endpoint: '/api/v1/dashboard/export_xlsx/status/abc/',
    });
    expect(lastDownloadHref()).toBe('/api/v1/dashboard/export_xlsx/download/abc/');
    expect(mockAddSuccessToast).toHaveBeenCalledWith(
      'Your export is ready and downloading.',
    );
  });
});

test('the ready download goes through an anchor and never navigates the page', async () => {
  jest.useFakeTimers();
  mockSupersetClient.post.mockResolvedValue({
    json: { job_id: 'abc' },
  } as never);
  mockSupersetClient.get.mockResolvedValueOnce({
    json: {
      status: 'ready',
      download_url: '/api/v1/dashboard/export_xlsx/download/abc/',
    },
  } as never);
  const hrefBefore = window.location.href;

  render(<MenuWrapper />, { useRedux: true, initialState: loggedInState });

  await clickMenuItem('Export Data to Excel');
  await waitFor(() => expect(mockSupersetClient.post).toHaveBeenCalled());

  await act(async () => {
    jest.advanceTimersByTime(3000);
  });

  // A plain anchor: no frame (so no frame-src CSP exception), no `download`
  // attribute (Chrome drops those without user activation), and the dashboard
  // (or an embedding parent) is never navigated away.
  await waitFor(() =>
    expect(lastDownloadHref()).toBe('/api/v1/dashboard/export_xlsx/download/abc/'),
  );
  expect(clickedDownloads[0].download).toBeNull();
  expect(window.location.href).toBe(hrefBefore);
  expect(document.body.querySelectorAll('iframe')).toHaveLength(0);
  expect(fetchMock.callHistory.calls('glob:*/export_xlsx/download/abc/')).toHaveLength(1);
});

test('Export Data to Excel keeps polling while status is pending', async () => {
  jest.useFakeTimers();
  mockSupersetClient.post.mockResolvedValue({
    json: { job_id: 'abc' },
  } as never);
  mockSupersetClient.get.mockResolvedValue({
    json: { status: 'pending' },
  } as never);

  render(<MenuWrapper />, { useRedux: true, initialState: loggedInState });

  await clickMenuItem('Export Data to Excel');
  await waitFor(() =>
    expect(mockAddInfoToast).toHaveBeenCalledWith(
      "Your export is being generated and will download automatically when ready. We'll also email you a download link.",
      { noDuplicate: true },
    ),
  );

  await act(async () => {
    jest.advanceTimersByTime(3000);
  });
  await waitFor(() => expect(mockSupersetClient.get).toHaveBeenCalledTimes(1));

  await act(async () => {
    jest.advanceTimersByTime(3000);
  });
  await waitFor(() => expect(mockSupersetClient.get).toHaveBeenCalledTimes(2));

  // Still pending -- no terminal toast, and the browser never navigated.
  expect(mockAddDangerToast).not.toHaveBeenCalled();
  expect(mockAddSuccessToast).not.toHaveBeenCalledWith(
    'Your export is ready and downloading.',
  );
});

test('Export Data to Excel shows an error toast when the export job fails', async () => {
  jest.useFakeTimers();
  mockSupersetClient.post.mockResolvedValue({
    json: { job_id: 'abc' },
  } as never);
  mockSupersetClient.get.mockResolvedValue({
    json: { status: 'error', message: 'The export could not be built.' },
  } as never);

  render(<MenuWrapper />, { useRedux: true, initialState: loggedInState });

  await clickMenuItem('Export Data to Excel');
  await waitFor(() =>
    expect(mockAddInfoToast).toHaveBeenCalledWith(
      "Your export is being generated and will download automatically when ready. We'll also email you a download link.",
      { noDuplicate: true },
    ),
  );

  await act(async () => {
    jest.advanceTimersByTime(3000);
  });

  await waitFor(() => {
    expect(mockAddDangerToast).toHaveBeenCalledWith(
      'The export could not be built.',
    );
  });
  expect(mockAddSuccessToast).not.toHaveBeenCalledWith(
    'Your export is ready and downloading.',
  );
});

test('Export Data to Excel shows an "already in progress" toast when throttled', async () => {
  // The throttle response is 202 with a message but no job_id.
  mockSupersetClient.post.mockResolvedValue({
    json: {
      message: 'An Excel export for this dashboard is already in progress.',
    },
  } as never);

  render(<MenuWrapper />, { useRedux: true, initialState: loggedInState });

  await clickMenuItem('Export Data to Excel');

  await waitFor(() => {
    expect(mockAddInfoToast).toHaveBeenCalledWith(
      'An export for this dashboard is already in progress.',
    );
  });
});

test('Export Data to Excel shows a config error toast on 501', async () => {
  mockSupersetClient.post.mockRejectedValue(new Error('not configured'));
  mockGetClientErrorObject.mockResolvedValue({ status: 501 });

  render(<MenuWrapper />, { useRedux: true, initialState: loggedInState });

  await clickMenuItem('Export Data to Excel');

  await waitFor(() => {
    expect(mockAddDangerToast).toHaveBeenCalledWith(
      'Excel export is not configured on this server.',
    );
  });
});

test('Export Data to Excel shows a generic error toast on other failures', async () => {
  mockSupersetClient.post.mockRejectedValue(new Error('boom'));
  mockGetClientErrorObject.mockResolvedValue({ status: 500 });

  render(<MenuWrapper />, { useRedux: true, initialState: loggedInState });

  await clickMenuItem('Export Data to Excel');

  await waitFor(() => {
    expect(mockAddDangerToast).toHaveBeenCalledWith(
      'Sorry, something went wrong. Try again later.',
    );
  });
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

  render(<MenuWrapper />, { useRedux: true, initialState: loggedInState });

  await clickMenuItem('Export as Example');

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

  render(<MenuWrapper />, { useRedux: true, initialState: loggedInState });

  await clickMenuItem('Export as Example');

  await waitFor(() => {
    expect(mockAddDangerToast).toHaveBeenCalledWith(
      'Sorry, something went wrong. Try again later.',
    );
  });
});

const mockIsFeatureEnabled = isFeatureEnabled as jest.Mock;

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

// ---------------------------------------------------------------------------
// Delivery follows the requester identity, not iframe presence: a guest or
// anonymous session (no userId) has no email channel, so the toast must not
// promise one, and the image export (webdriver-rendered, guests cannot open
// Explore) is hidden.
// ---------------------------------------------------------------------------

test('guest session: export toast promises auto-download, not an email', async () => {
  mockSupersetClient.post.mockResolvedValue({
    json: { job_id: 'abc' },
  } as never);

  render(<MenuWrapper />, { useRedux: true, initialState: guestState });

  await clickMenuItem('Export Data to Excel');

  await waitFor(() =>
    expect(mockAddInfoToast).toHaveBeenCalledWith(
      'Your export is being generated. Please, do not leave the page.',
      { noDuplicate: true },
    ),
  );
});

test('guest session: Export Images to Excel is hidden even with the webdriver enabled', () => {
  enableWebDriverScreenshot();

  render(<MenuWrapper />, { useRedux: true, initialState: guestState });

  expect(screen.getByText('Export Data to Excel')).toBeInTheDocument();
  expect(screen.queryByText('Export Images to Excel')).not.toBeInTheDocument();
});

test('logged-in user without an email gets the delivery-neutral toast', async () => {
  mockSupersetClient.post.mockResolvedValue({
    json: { job_id: 'abc' },
  } as never);

  render(<MenuWrapper />, {
    useRedux: true,
    initialState: { user: { userId: 1 } },
  });

  await clickMenuItem('Export Data to Excel');

  await waitFor(() =>
    expect(mockAddInfoToast).toHaveBeenCalledWith(
      'Your export is being generated. Please, do not leave the page.',
      { noDuplicate: true },
    ),
  );
});

test('a "running" status restarts the wait window, so queue delay is not counted', async () => {
  jest.useFakeTimers();
  mockSupersetClient.post.mockResolvedValue({
    json: { job_id: 'abc' },
  } as never);
  // Worker picks the job up on the first poll; still running just past the
  // original 12 minute deadline; done on the poll after that.
  mockSupersetClient.get
    .mockResolvedValueOnce({ json: { status: 'running' } } as never)
    .mockResolvedValueOnce({ json: { status: 'running' } } as never)
    .mockResolvedValueOnce({
      json: {
        status: 'ready',
        download_url: '/api/v1/dashboard/export_xlsx/download/abc/',
      },
    } as never);

  render(<MenuWrapper />, { useRedux: true, initialState: loggedInState });

  await clickMenuItem('Export Data to Excel');
  await waitFor(() => expect(mockSupersetClient.post).toHaveBeenCalled());

  await act(async () => {
    jest.advanceTimersByTime(3000);
  });
  await waitFor(() => expect(mockSupersetClient.get).toHaveBeenCalledTimes(1));

  // t ~= 12m01s: past the enqueue-based deadline, within the restarted one
  // (running was observed at t=3s). Without the restart this poll would give
  // up with a danger toast instead of continuing.
  await act(async () => {
    jest.advanceTimersByTime(12 * 60 * 1000 - 2000);
  });
  await waitFor(() => expect(mockSupersetClient.get).toHaveBeenCalledTimes(2));
  expect(mockAddDangerToast).not.toHaveBeenCalled();

  await act(async () => {
    jest.advanceTimersByTime(3000);
  });
  await waitFor(() => {
    expect(lastDownloadHref()).toBe('/api/v1/dashboard/export_xlsx/download/abc/');
    expect(mockAddSuccessToast).toHaveBeenCalledWith(
      'Your export is ready and downloading.',
    );
  });
});

test('a transient poll failure keeps polling and still downloads', async () => {
  jest.useFakeTimers();
  mockSupersetClient.post.mockResolvedValue({
    json: { job_id: 'abc' },
  } as never);
  mockSupersetClient.get
    .mockRejectedValueOnce(new Error('network blip'))
    .mockResolvedValueOnce({
      json: {
        status: 'ready',
        download_url: '/api/v1/dashboard/export_xlsx/download/abc/',
      },
    } as never);

  render(<MenuWrapper />, { useRedux: true, initialState: loggedInState });

  await clickMenuItem('Export Data to Excel');
  await waitFor(() => expect(mockSupersetClient.post).toHaveBeenCalled());

  await act(async () => {
    jest.advanceTimersByTime(3000);
  });
  await waitFor(() => expect(mockSupersetClient.get).toHaveBeenCalledTimes(1));
  expect(mockAddDangerToast).not.toHaveBeenCalled();

  await act(async () => {
    jest.advanceTimersByTime(3000);
  });
  await waitFor(() => {
    expect(lastDownloadHref()).toBe('/api/v1/dashboard/export_xlsx/download/abc/');
    expect(mockAddSuccessToast).toHaveBeenCalledWith(
      'Your export is ready and downloading.',
    );
  });
});

test('poll failures past the deadline give up with an error toast', async () => {
  jest.useFakeTimers();
  mockSupersetClient.post.mockResolvedValue({
    json: { job_id: 'abc' },
  } as never);
  mockSupersetClient.get.mockRejectedValue(new Error('server down'));

  render(<MenuWrapper />, { useRedux: true, initialState: loggedInState });

  await clickMenuItem('Export Data to Excel');
  await waitFor(() => expect(mockSupersetClient.post).toHaveBeenCalled());

  await act(async () => {
    jest.advanceTimersByTime(3000);
  });
  await waitFor(() => expect(mockSupersetClient.get).toHaveBeenCalledTimes(1));

  // Jump past the 12 minute deadline; the next failing poll must give up.
  await act(async () => {
    jest.advanceTimersByTime(13 * 60 * 1000);
  });
  await waitFor(() => {
    expect(mockAddDangerToast).toHaveBeenCalledWith(
      'Sorry, something went wrong. Try again later.',
    );
  });
  expect(mockAddSuccessToast).not.toHaveBeenCalledWith(
    'Your export is ready and downloading.',
  );
});

test('a "ready" status with no download_url is an error, not a fake success', async () => {
  jest.useFakeTimers();
  mockSupersetClient.post.mockResolvedValue({
    json: { job_id: 'abc' },
  } as never);
  mockSupersetClient.get.mockResolvedValue({
    json: { status: 'ready' },
  } as never);

  render(<MenuWrapper />, { useRedux: true, initialState: loggedInState });

  await clickMenuItem('Export Data to Excel');
  await waitFor(() => expect(mockSupersetClient.post).toHaveBeenCalled());

  await act(async () => {
    jest.advanceTimersByTime(3000);
  });

  await waitFor(() => {
    expect(mockAddDangerToast).toHaveBeenCalledWith(
      'Sorry, something went wrong. Try again later.',
    );
  });
  expect(mockAddSuccessToast).not.toHaveBeenCalled();
  expect(mockAddSuccessToast).not.toHaveBeenCalledWith(
    'Your export is ready and downloading.',
  );
});

test('unmounting stops the polling loop', async () => {
  jest.useFakeTimers();
  mockSupersetClient.post.mockResolvedValue({
    json: { job_id: 'abc' },
  } as never);
  mockSupersetClient.get.mockResolvedValue({
    json: { status: 'pending' },
  } as never);

  const { unmount } = render(<MenuWrapper />, {
    useRedux: true,
    initialState: loggedInState,
  });

  await clickMenuItem('Export Data to Excel');
  await waitFor(() => expect(mockSupersetClient.post).toHaveBeenCalled());

  await act(async () => {
    jest.advanceTimersByTime(3000);
  });
  await waitFor(() => expect(mockSupersetClient.get).toHaveBeenCalledTimes(1));

  unmount();

  await act(async () => {
    jest.advanceTimersByTime(30000);
  });
  expect(mockSupersetClient.get).toHaveBeenCalledTimes(1);
});

test('the pending toast is announced once, not re-emitted on every poll', async () => {
  jest.useFakeTimers();
  mockSupersetClient.post.mockResolvedValue({
    json: { job_id: 'abc' },
  } as never);
  mockSupersetClient.get.mockResolvedValue({
    json: { status: 'pending' },
  } as never);

  render(<MenuWrapper />, { useRedux: true, initialState: loggedInState });

  await clickMenuItem('Export Data to Excel');
  await waitFor(() => expect(mockAddInfoToast).toHaveBeenCalledTimes(1));

  // Several poll cycles later, no additional pending toast has been emitted:
  // re-emitting would spawn a fresh role="alert" every poll for a slow export.
  for (let i = 0; i < 4; i += 1) {
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
  }
  await waitFor(() =>
    expect(mockSupersetClient.get.mock.calls.length).toBeGreaterThan(3),
  );
  expect(mockAddInfoToast).toHaveBeenCalledTimes(1);
});

const READY_URL = '/api/v1/dashboard/export_xlsx/download/abc/';

test('a link that fails at download time is reported, not navigated to', async () => {
  // The narrow race where the object vanishes between the status check and
  // the click: without the HEAD probe the page would navigate to a 410.
  jest.useFakeTimers();
  fetchMock.removeRoutes();
  fetchMock.head('glob:*/api/v1/dashboard/export_xlsx/download/*', 410);
  mockSupersetClient.post.mockResolvedValue({
    json: { job_id: 'abc' },
  } as never);
  mockSupersetClient.get.mockResolvedValueOnce({
    json: { status: 'ready', download_url: READY_URL },
  } as never);
  render(<MenuWrapper />, { useRedux: true, initialState: loggedInState });
  await clickMenuItem('Export Data to Excel');
  await waitFor(() => expect(mockSupersetClient.post).toHaveBeenCalled());
  await act(async () => {
    jest.advanceTimersByTime(3000);
  });

  await waitFor(() =>
    expect(mockAddDangerToast).toHaveBeenCalledWith(
      'Sorry, something went wrong. Try again later.',
    ),
  );
  expect(clickedDownloads).toHaveLength(0);
  expect(mockAddSuccessToast).not.toHaveBeenCalled();
});

test('the download anchor is detached again once clicked', async () => {
  // Nothing is left in document.body to accumulate across repeated exports.
  jest.useFakeTimers();
  mockSupersetClient.post.mockResolvedValue({
    json: { job_id: 'abc' },
  } as never);
  mockSupersetClient.get.mockResolvedValueOnce({
    json: { status: 'ready', download_url: READY_URL },
  } as never);
  render(<MenuWrapper />, { useRedux: true, initialState: loggedInState });
  await clickMenuItem('Export Data to Excel');
  await waitFor(() => expect(mockSupersetClient.post).toHaveBeenCalled());
  await act(async () => {
    jest.advanceTimersByTime(3000);
  });
  await waitFor(() => expect(lastDownloadHref()).toBe(READY_URL));

  expect(document.body.querySelector(`a[href="${READY_URL}"]`)).toBeNull();
});

test('unmounting while the export POST is in flight suppresses its follow-up', async () => {
  // Cleanup has already run by the time the POST settles, so a toast would
  // land on another page and the poll timer would be untracked.
  jest.useFakeTimers();
  let settlePost: (value: unknown) => void = () => {};
  mockSupersetClient.post.mockReturnValue(
    new Promise(resolve => {
      settlePost = resolve;
    }) as never,
  );

  const { unmount } = render(<MenuWrapper />, {
    useRedux: true,
    initialState: loggedInState,
  });
  await clickMenuItem('Export Data to Excel');
  await waitFor(() => expect(mockSupersetClient.post).toHaveBeenCalled());

  unmount();
  await act(async () => {
    settlePost({ json: { job_id: 'abc' } });
  });

  expect(mockAddInfoToast).not.toHaveBeenCalled();

  await act(async () => {
    jest.advanceTimersByTime(30000);
  });
  expect(mockSupersetClient.get).not.toHaveBeenCalled();
});
