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
import { ComponentType } from 'react';
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import { MemoryRouter, Route } from 'react-router-dom';
import FileHandler from './index';

const mockAddDangerToast = jest.fn();
const mockAddSuccessToast = jest.fn();
const mockHistoryPush = jest.fn();

type ToastInjectedProps = {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
};

// Mock the withToasts HOC
jest.mock('src/components/MessageToasts/withToasts', () => ({
  __esModule: true,
  default:
    <P extends object>(Component: ComponentType<P & ToastInjectedProps>) =>
    (props: P) => (
      <Component
        {...props}
        addDangerToast={mockAddDangerToast}
        addSuccessToast={mockAddSuccessToast}
      />
    ),
}));

interface UploadDataModalProps {
  show: boolean;
  onHide: () => void;
  type: string;
  allowedExtensions: string[];
  fileListOverride?: File[];
}

// Mock the UploadDataModal
jest.mock('src/features/databases/UploadDataModel', () => ({
  __esModule: true,
  default: ({
    show,
    onHide,
    type,
    allowedExtensions,
    fileListOverride,
  }: UploadDataModalProps) => (
    <div data-test="upload-modal">
      <div data-test="modal-show">{show.toString()}</div>
      <div data-test="modal-type">{type}</div>
      <div data-test="modal-extensions">{allowedExtensions.join(',')}</div>
      <div data-test="modal-file">{fileListOverride?.[0]?.name ?? ''}</div>
      <button onClick={onHide}>Close</button>
    </div>
  ),
}));

// Mock react-router-dom's useHistory
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useHistory: () => ({
    push: mockHistoryPush,
  }),
}));

// Mock the File API
type MockFileHandle = {
  kind: 'file';
  name: string;
  getFile: () => Promise<File>;
  isSameEntry: () => Promise<boolean>;
  queryPermission: () => Promise<PermissionState>;
  requestPermission: () => Promise<PermissionState>;
};

const createMockFileHandle = (fileName: string): MockFileHandle => ({
  kind: 'file',
  name: fileName,
  getFile: async () => new File(['test'], fileName),
  isSameEntry: async () => false,
  queryPermission: async () => 'granted',
  requestPermission: async () => 'granted',
});

type LaunchQueue = {
  setConsumer: (
    consumer: (params: { files?: MockFileHandle[] }) => void,
  ) => void;
};

const setupLaunchQueue = (fileHandle: MockFileHandle | null = null) => {
  let savedConsumer: ((params: { files?: MockFileHandle[] }) => void) | null =
    null;
  (window as Window & { launchQueue: LaunchQueue }).launchQueue = {
    setConsumer: (consumer: (params: { files?: MockFileHandle[] }) => void) => {
      savedConsumer = consumer;
      if (fileHandle) {
        setTimeout(() => {
          consumer({
            files: [fileHandle],
          });
        }, 0);
      }
    },
  };
  return {
    triggerConsumer: (params: { files?: MockFileHandle[] }) => {
      savedConsumer?.(params);
    },
  };
};

beforeEach(() => {
  jest.clearAllMocks();
  delete (window as any).launchQueue;
});

test('shows error when launchQueue is not supported', async () => {
  render(
    <MemoryRouter initialEntries={['/superset/file-handler']}>
      <Route path="/superset/file-handler">
        <FileHandler />
      </Route>
    </MemoryRouter>,
    { useRedux: true },
  );

  await waitFor(() => {
    expect(mockAddDangerToast).toHaveBeenCalledWith(
      'File handling is not supported in this browser. Please use a modern browser like Chrome or Edge.',
    );
    expect(mockHistoryPush).toHaveBeenCalledWith('/superset/welcome/');
  });
});

test('redirects when no files are provided', async () => {
  const { triggerConsumer } = setupLaunchQueue();

  render(
    <MemoryRouter initialEntries={['/superset/file-handler']}>
      <Route path="/superset/file-handler">
        <FileHandler />
      </Route>
    </MemoryRouter>,
    { useRedux: true },
  );

  // Trigger the consumer with no files
  triggerConsumer({ files: [] });

  await waitFor(() => {
    expect(mockHistoryPush).toHaveBeenCalledWith('/superset/welcome/');
  });
});

test('handles CSV file correctly', async () => {
  const fileHandle = createMockFileHandle('test.csv');
  setupLaunchQueue(fileHandle);

  render(
    <MemoryRouter initialEntries={['/superset/file-handler']}>
      <Route path="/superset/file-handler">
        <FileHandler />
      </Route>
    </MemoryRouter>,
    { useRedux: true },
  );

  const modal = await screen.findByTestId('upload-modal');
  expect(modal).toBeInTheDocument();
  expect(screen.getByTestId('modal-show')).toHaveTextContent('true');
  expect(screen.getByTestId('modal-type')).toHaveTextContent('csv');
  expect(screen.getByTestId('modal-extensions')).toHaveTextContent('csv');
  expect(screen.getByTestId('modal-file')).toHaveTextContent('test.csv');
});

test('handles Excel (.xls) file correctly', async () => {
  const fileHandle = createMockFileHandle('test.xls');
  setupLaunchQueue(fileHandle);

  render(
    <MemoryRouter initialEntries={['/superset/file-handler']}>
      <Route path="/superset/file-handler">
        <FileHandler />
      </Route>
    </MemoryRouter>,
    { useRedux: true },
  );

  const modal = await screen.findByTestId('upload-modal');
  expect(modal).toBeInTheDocument();
  expect(screen.getByTestId('modal-type')).toHaveTextContent('excel');
  expect(screen.getByTestId('modal-extensions')).toHaveTextContent('xls,xlsx');
});

test('handles Excel (.xlsx) file correctly', async () => {
  const fileHandle = createMockFileHandle('test.xlsx');
  setupLaunchQueue(fileHandle);

  render(
    <MemoryRouter initialEntries={['/superset/file-handler']}>
      <Route path="/superset/file-handler">
        <FileHandler />
      </Route>
    </MemoryRouter>,
    { useRedux: true },
  );

  const modal = await screen.findByTestId('upload-modal');
  expect(modal).toBeInTheDocument();
  expect(screen.getByTestId('modal-type')).toHaveTextContent('excel');
  expect(screen.getByTestId('modal-extensions')).toHaveTextContent('xls,xlsx');
});

test('handles Parquet file correctly', async () => {
  const fileHandle = createMockFileHandle('test.parquet');
  setupLaunchQueue(fileHandle);

  render(
    <MemoryRouter initialEntries={['/superset/file-handler']}>
      <Route path="/superset/file-handler">
        <FileHandler />
      </Route>
    </MemoryRouter>,
    { useRedux: true },
  );

  const modal = await screen.findByTestId('upload-modal');
  expect(modal).toBeInTheDocument();
  expect(screen.getByTestId('modal-type')).toHaveTextContent('columnar');
  expect(screen.getByTestId('modal-extensions')).toHaveTextContent('parquet');
});

test('shows error for unsupported file type', async () => {
  const { triggerConsumer } = setupLaunchQueue();

  render(
    <MemoryRouter initialEntries={['/superset/file-handler']}>
      <Route path="/superset/file-handler">
        <FileHandler />
      </Route>
    </MemoryRouter>,
    { useRedux: true },
  );

  // Trigger with unsupported file
  const fileHandle = createMockFileHandle('test.pdf');
  triggerConsumer({ files: [fileHandle] });

  await waitFor(() => {
    expect(mockAddDangerToast).toHaveBeenCalledWith(
      'Unsupported file type. Please use CSV, Excel, or Columnar files.',
    );
    expect(mockHistoryPush).toHaveBeenCalledWith('/superset/welcome/');
  });
});

test('handles file with uppercase extension', async () => {
  const fileHandle = createMockFileHandle('test.CSV');
  setupLaunchQueue(fileHandle);

  render(
    <MemoryRouter initialEntries={['/superset/file-handler']}>
      <Route path="/superset/file-handler">
        <FileHandler />
      </Route>
    </MemoryRouter>,
    { useRedux: true },
  );

  const modal = await screen.findByTestId('upload-modal');
  expect(modal).toBeInTheDocument();
  expect(screen.getByTestId('modal-type')).toHaveTextContent('csv');
});

test('handles errors during file processing', async () => {
  const { triggerConsumer } = setupLaunchQueue();

  render(
    <MemoryRouter initialEntries={['/superset/file-handler']}>
      <Route path="/superset/file-handler">
        <FileHandler />
      </Route>
    </MemoryRouter>,
    { useRedux: true },
  );

  // Trigger with a file handle that throws an error
  const errorFileHandle = {
    getFile: async () => {
      throw new Error('File access denied');
    },
  };

  triggerConsumer({ files: [errorFileHandle] });

  await waitFor(() => {
    expect(mockAddDangerToast).toHaveBeenCalledWith(
      'Failed to open file. Please try again.',
    );
    expect(mockHistoryPush).toHaveBeenCalledWith('/superset/welcome/');
  });
});

test('modal close redirects to welcome page', async () => {
  const fileHandle = createMockFileHandle('test.csv');
  setupLaunchQueue(fileHandle);

  render(
    <MemoryRouter initialEntries={['/superset/file-handler']}>
      <Route path="/superset/file-handler">
        <FileHandler />
      </Route>
    </MemoryRouter>,
    { useRedux: true },
  );

  const modal = await screen.findByTestId('upload-modal');
  expect(modal).toBeInTheDocument();

  // Click the close button in the mocked modal
  const closeButton = screen.getByRole('button', { name: 'Close' });
  closeButton.click();

  await waitFor(() => {
    expect(mockHistoryPush).toHaveBeenCalledWith('/superset/welcome/');
  });
});

test('shows loading state while waiting for file', () => {
  setupLaunchQueue();

  render(
    <MemoryRouter initialEntries={['/superset/file-handler']}>
      <Route path="/superset/file-handler">
        <FileHandler />
      </Route>
    </MemoryRouter>,
    { useRedux: true },
  );

  // Should show loading initially before file is processed
  expect(screen.getByRole('status')).toBeInTheDocument();
});
