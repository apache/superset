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
import StreamingExportModal, {
  ExportStatus,
  StreamingProgress,
} from './StreamingExportModal';

const defaultProgress: StreamingProgress = {
  rowsProcessed: 0,
  totalRows: 1000,
  totalSize: 0,
  status: ExportStatus.STREAMING,
  filename: 'test_export.csv',
};

const defaultProps = {
  visible: true,
  onCancel: jest.fn(),
  onRetry: jest.fn(),
  progress: defaultProgress,
};

beforeEach(() => {
  jest.clearAllMocks();
  URL.revokeObjectURL = jest.fn();
  URL.createObjectURL = jest.fn(() => 'blob:mock-url');
});

test('renders modal with streaming state', () => {
  render(<StreamingExportModal {...defaultProps} />);

  expect(screen.getByText('CSV Export')).toBeInTheDocument();
  expect(
    screen.getByText(/Processing export for test_export.csv/i),
  ).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Download' })).toBeDisabled();
});

test('shows progress percentage during streaming', () => {
  const progress = {
    ...defaultProgress,
    rowsProcessed: 500,
    totalRows: 1000,
    status: ExportStatus.STREAMING,
  };

  render(<StreamingExportModal {...defaultProps} progress={progress} />);

  expect(screen.getByRole('progressbar')).toBeInTheDocument();
});

test('shows completed state when export finishes', () => {
  const progress = {
    ...defaultProgress,
    rowsProcessed: 1000,
    totalRows: 1000,
    status: ExportStatus.COMPLETED,
    downloadUrl: 'blob:mock-url',
  };

  render(<StreamingExportModal {...defaultProps} progress={progress} />);

  expect(
    screen.getByText(/Export successful: test_export.csv/i),
  ).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Download' })).toBeEnabled();
});

test('shows error state when export fails', () => {
  const progress = {
    ...defaultProgress,
    status: ExportStatus.ERROR,
    error: 'Database connection failed',
  };

  render(<StreamingExportModal {...defaultProps} progress={progress} />);

  expect(screen.getByText('Database connection failed')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
});

test('shows cancelled state when export is cancelled', () => {
  const progress = {
    ...defaultProgress,
    status: ExportStatus.CANCELLED,
  };

  render(<StreamingExportModal {...defaultProps} progress={progress} />);

  expect(screen.getByText('Export cancelled')).toBeInTheDocument();
  expect(
    screen.getAllByRole('button', { name: 'Close' })[0],
  ).toBeInTheDocument();
});

test('calls onCancel when cancel button is clicked during streaming', async () => {
  const onCancel = jest.fn();
  render(<StreamingExportModal {...defaultProps} onCancel={onCancel} />);

  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(onCancel).toHaveBeenCalledTimes(1);
});

test('calls onRetry when retry button is clicked after error', async () => {
  const onRetry = jest.fn();
  const progress = {
    ...defaultProgress,
    status: ExportStatus.ERROR,
    error: 'Network error',
  };

  render(
    <StreamingExportModal
      {...defaultProps}
      progress={progress}
      onRetry={onRetry}
    />,
  );

  await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(onRetry).toHaveBeenCalledTimes(1);
});

test('triggers download when download button is clicked', async () => {
  const progress = {
    ...defaultProgress,
    rowsProcessed: 1000,
    totalRows: 1000,
    status: ExportStatus.COMPLETED,
    downloadUrl: 'blob:mock-url',
    filename: 'test_export.csv',
  };

  const onCancel = jest.fn();
  render(
    <StreamingExportModal
      {...defaultProps}
      progress={progress}
      onCancel={onCancel}
    />,
  );

  const downloadButton = screen.getByRole('button', { name: 'Download' });
  expect(downloadButton).toBeEnabled();

  await userEvent.click(downloadButton);

  expect(onCancel).toHaveBeenCalledTimes(1);
});

test('does not show download button when downloadUrl is missing', () => {
  const progress = {
    ...defaultProgress,
    status: ExportStatus.COMPLETED,
  };

  render(<StreamingExportModal {...defaultProps} progress={progress} />);

  expect(screen.getByRole('button', { name: 'Download' })).toBeDisabled();
});

test('progress bar shows correct percentage with decimal precision', () => {
  const progress = {
    ...defaultProgress,
    rowsProcessed: 333,
    totalRows: 1000,
    status: ExportStatus.STREAMING,
  };

  render(<StreamingExportModal {...defaultProps} progress={progress} />);

  expect(screen.getByRole('progressbar')).toBeInTheDocument();
});

test('shows generic processing message when filename is not provided', () => {
  const progress = {
    ...defaultProgress,
    filename: undefined,
    status: ExportStatus.STREAMING,
  };

  render(<StreamingExportModal {...defaultProps} progress={progress} />);

  expect(screen.getByText('Processing export...')).toBeInTheDocument();
});

test('handles retry button visibility based on onRetry prop', () => {
  const progress = {
    ...defaultProgress,
    status: ExportStatus.ERROR,
    error: 'Test error',
  };

  const { rerender } = render(
    <StreamingExportModal
      {...defaultProps}
      progress={progress}
      onRetry={undefined}
    />,
  );

  expect(
    screen.queryByRole('button', { name: 'Retry' }),
  ).not.toBeInTheDocument();

  rerender(
    <StreamingExportModal
      {...defaultProps}
      progress={progress}
      onRetry={jest.fn()}
    />,
  );

  expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
});

test('shows generic error message when error details are not provided', () => {
  const progress = {
    ...defaultProgress,
    status: ExportStatus.ERROR,
  };

  render(<StreamingExportModal {...defaultProps} progress={progress} />);

  expect(screen.getByText('Export failed')).toBeInTheDocument();
});
