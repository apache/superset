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
import { VizType } from '@superset-ui/core';
import { ExportStatus } from 'src/components/StreamingExportModal/StreamingExportModal';
import { useExploreDataExport } from '../useExploreAdditionalActionsMenu/useExploreDataExport';
import StandaloneDownloadControl from './StandaloneDownloadControl';

jest.mock('../useExploreAdditionalActionsMenu/useExploreDataExport', () => ({
  useExploreDataExport: jest.fn(),
}));

const mockUseExploreDataExport = useExploreDataExport as jest.MockedFunction<
  typeof useExploreDataExport
>;

const exportCSV = jest.fn();
const exportJson = jest.fn();
const exportExcel = jest.fn();

const streamingExportState = {
  isVisible: false,
  progress: {
    rowsProcessed: 0,
    totalRows: undefined,
    totalSize: 0,
    speed: 0,
    mbPerSecond: 0,
    elapsedTime: 0,
    status: ExportStatus.STREAMING,
  },
  onCancel: jest.fn(),
  onRetry: jest.fn(),
  onDownload: jest.fn(),
};

const latestQueryFormData = {
  viz_type: VizType.Histogram,
  datasource: '49__table',
};

describe('StandaloneDownloadControl', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockUseExploreDataExport.mockReturnValue({
      exportCSV,
      exportCSVPivoted: jest.fn(),
      exportJson,
      exportExcel,
      handleExportError: jest.fn(),
      streamingExportState,
    });
  });

  test('renders the download button', () => {
    render(
      <StandaloneDownloadControl
        latestQueryFormData={latestQueryFormData}
        canDownload
      />,
      { useRedux: true },
    );

    expect(
      screen.getByTestId('standalone-download-button'),
    ).toBeInTheDocument();
  });

  test('renders export options when download button is clicked', async () => {
    render(
      <StandaloneDownloadControl
        latestQueryFormData={latestQueryFormData}
        canDownload
      />,
      { useRedux: true },
    );

    userEvent.click(screen.getByTestId('standalone-download-button'));

    expect(await screen.findByText('Export to .CSV')).toBeInTheDocument();
    expect(screen.getByText('Export to .JSON')).toBeInTheDocument();
    expect(screen.getByText('Export to Excel')).toBeInTheDocument();
  });

  test('exports CSV when CSV option is clicked', async () => {
    render(
      <StandaloneDownloadControl
        latestQueryFormData={latestQueryFormData}
        canDownload
      />,
      { useRedux: true },
    );

    userEvent.click(screen.getByTestId('standalone-download-button'));
    userEvent.click(await screen.findByText('Export to .CSV'));

    expect(exportCSV).toHaveBeenCalledTimes(1);
  });

  test('exports JSON when JSON option is clicked', async () => {
    render(
      <StandaloneDownloadControl
        latestQueryFormData={latestQueryFormData}
        canDownload
      />,
      { useRedux: true },
    );

    userEvent.click(screen.getByTestId('standalone-download-button'));
    userEvent.click(await screen.findByText('Export to .JSON'));

    expect(exportJson).toHaveBeenCalledTimes(1);
  });

  test('exports Excel when Excel option is clicked', async () => {
    render(
      <StandaloneDownloadControl
        latestQueryFormData={latestQueryFormData}
        canDownload
      />,
      { useRedux: true },
    );

    userEvent.click(screen.getByTestId('standalone-download-button'));
    userEvent.click(await screen.findByText('Export to Excel'));

    expect(exportExcel).toHaveBeenCalledTimes(1);
  });
});
