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

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'spec/helpers/testing-library';
import fetchMock from 'fetch-mock';
import * as chartAction from 'src/components/Chart/chartAction';
import * as saveModalActions from 'src/explore/actions/saveModalActions';
import * as downloadAsImage from 'src/utils/downloadAsImage';
import * as exploreUtils from 'src/explore/exploreUtils';
import { FeatureFlag, VizType } from '@superset-ui/core';
import { useUnsavedChangesPrompt } from 'src/hooks/useUnsavedChangesPrompt';
import ExploreHeader, { ExploreChartHeaderProps } from '.';
import { getChartMetadataRegistry } from '@superset-ui/core';
import fs from 'fs';
import path from 'path';

const chartEndpoint = 'glob:*api/v1/chart/*';

fetchMock.get(chartEndpoint, { json: 'foo' });

window.featureFlags = {
  [FeatureFlag.EmbeddableCharts]: true,
};

jest.mock('src/hooks/useUnsavedChangesPrompt', () => ({
  useUnsavedChangesPrompt: jest.fn(),
}));

const mockExportCurrentViewBehavior = () => {
  const registry = getChartMetadataRegistry();
  return jest.spyOn(registry, 'get').mockReturnValue({
    behaviors: ['EXPORT_CURRENT_VIEW'],
  } as any);
};

const createProps = (additionalProps = {}) =>
  ({
    chart: {
      id: 1,
      latestQueryFormData: {
        viz_type: VizType.Histogram,
        datasource: '49__table',
        slice_id: 318,
        url_params: {},
        granularity_sqla: 'time_start',
        time_range: 'No filter',
        all_columns_x: ['age'],
        adhoc_filters: [],
        row_limit: 10000,
        groupby: null,
        color_scheme: 'supersetColors',
        label_colors: {},
        link_length: '25',
        x_axis_label: 'age',
        y_axis_label: 'count',
        server_pagination: false,
      },
      chartStatus: 'rendered' as const,
      chartAlert: null,
      chartUpdateEndTime: null,
      chartUpdateStartTime: 0,
      lastRendered: 0,
      sliceFormData: null,
      queryController: null,
      queriesResponse: null,
      triggerQuery: false,
    },
    slice: {
      cache_timeout: null,
      changed_on: '2021-03-19T16:30:56.750230',
      changed_on_humanized: '7 days ago',
      datasource: 'FCC 2018 Survey',
      description: 'Simple description',
      description_markeddown: '',
      edit_url: '/chart/edit/318',
      form_data: {
        adhoc_filters: [],
        all_columns_x: ['age'],
        color_scheme: 'supersetColors',
        datasource: '49__table',
        granularity_sqla: 'time_start',
        groupby: null,
        label_colors: {},
        link_length: '25',
        queryFields: { groupby: 'groupby' },
        row_limit: 10000,
        slice_id: 318,
        time_range: 'No filter',
        url_params: {},
        viz_type: VizType.Histogram,
        x_axis_label: 'age',
        y_axis_label: 'count',
      },
      modified: '<span class="no-wrap">7 days ago</span>',
      owners: [
        {
          text: 'Superset Admin',
          value: 1,
        },
      ],
      slice_id: 318,
      slice_name: 'Age distribution of respondents',
      slice_url: '/explore/?form_data=%7B%22slice_id%22%3A%20318%7D',
    },
    sliceName: 'Age distribution of respondents',
    actions: {
      postChartFormData: jest.fn(),
      updateChartTitle: jest.fn(),
      fetchFaveStar: jest.fn(),
      saveFaveStar: jest.fn(),
      redirectSQLLab: jest.fn(),
    },
    user: {
      userId: 1,
    },
    metadata: {
      created_on_humanized: 'a week ago',
      changed_on_humanized: '2 days ago',
      owners: ['John Doe'],
      created_by: 'John Doe',
      changed_by: 'John Doe',
      dashboards: [{ id: 1, dashboard_title: 'Test' }],
    },
    canOverwrite: false,
    canDownload: false,
    isStarred: false,
    ...additionalProps,
  }) as unknown as ExploreChartHeaderProps;

fetchMock.post(
  'http://api/v1/chart/data?form_data=%7B%22slice_id%22%3A318%7D',
  { body: {} },
);
// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('ExploreChartHeader', () => {
  jest.setTimeout(15000); // ✅ Applies to all tests in this suite

  beforeEach(() => {
    jest.clearAllMocks();

    (useUnsavedChangesPrompt as jest.Mock).mockReturnValue({
      showModal: false,
      setShowModal: jest.fn(),
      handleConfirmNavigation: jest.fn(),
      handleSaveAndCloseModal: jest.fn(),
      triggerManualSave: jest.fn(),
    });
  });

  test('Cancelling changes to the properties should reset previous properties', async () => {
    const props = createProps();
    render(<ExploreHeader {...props} />, { useRedux: true });
    const newChartName = 'New chart name';
    const prevChartName = props.sliceName;

    // Wait for the component to render with the chart title
    expect(
      await screen.findByDisplayValue(prevChartName ?? ''),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('Menu actions trigger'));
    await userEvent.click(screen.getByText('Edit chart properties'));

    const nameInput = await screen.findByRole('textbox', { name: 'Name' });

    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, newChartName);

    expect(screen.getByDisplayValue(newChartName)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    // Wait for the modal to close
    await waitFor(() => {
      expect(
        screen.queryByRole('textbox', { name: 'Name' }),
      ).not.toBeInTheDocument();
    });

    await userEvent.click(screen.getByLabelText('Menu actions trigger'));
    await userEvent.click(screen.getByText('Edit chart properties'));

    // Wait for the modal to reopen and verify the name was reset
    const reopenedNameInput = await screen.findByRole('textbox', {
      name: 'Name',
    });
    expect(reopenedNameInput).toHaveValue(prevChartName ?? '');
  });

  test('renders the metadata bar when saved', async () => {
    const props = createProps({ showTitlePanelItems: true });
    render(<ExploreHeader {...props} />, { useRedux: true });
    expect(await screen.findByText('Added to 1 dashboard')).toBeInTheDocument();
    expect(await screen.findByText('Simple description')).toBeInTheDocument();
    expect(await screen.findByText('John Doe')).toBeInTheDocument();
    expect(await screen.findByText('2 days ago')).toBeInTheDocument();
  });

  test('Changes "Added to X dashboards" to plural when more than 1 dashboard', async () => {
    const props = createProps({ showTitlePanelItems: true });
    render(
      <ExploreHeader
        {...props}
        metadata={{
          ...props.metadata!,
          dashboards: [
            { id: 1, dashboard_title: 'Test' },
            { id: 2, dashboard_title: 'Test2' },
          ],
        }}
      />,
      { useRedux: true },
    );
    expect(
      await screen.findByText('Added to 2 dashboards'),
    ).toBeInTheDocument();
  });

  test('does not render the metadata bar when not saved', async () => {
    const props = createProps({ showTitlePanelItems: true, slice: null });
    render(<ExploreHeader {...props} />, { useRedux: true });
    await waitFor(() =>
      expect(
        screen.queryByText('Added to 1 dashboard'),
      ).not.toBeInTheDocument(),
    );
  });

  test('does not show unsaved changes for new charts on initial load', async () => {
    const props = createProps({
      slice: null,
      chart: {
        ...createProps().chart,
        sliceFormData: null,
      },
      formData: {
        viz_type: VizType.Histogram,
        datasource: '49__table',
      },
    });

    render(<ExploreHeader {...props} />, { useRedux: true });

    expect(
      await screen.findByText(/add the name of the chart/i),
    ).toBeInTheDocument();

    expect(useUnsavedChangesPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        hasUnsavedChanges: false,
      }),
    );
  });

  test('shows unsaved changes for new charts when user makes changes', async () => {
    const initialFormData = {
      viz_type: VizType.Histogram,
      datasource: '49__table',
      metrics: ['count'],
    };

    const modifiedFormData = {
      ...initialFormData,
      metrics: ['count', 'sum'],
    };

    const props = createProps({
      slice: null,
      chart: {
        ...createProps().chart,
        sliceFormData: null,
      },
      formData: initialFormData,
    });

    const { rerender } = render(<ExploreHeader {...props} />, {
      useRedux: true,
    });

    // Initial render should not have unsaved changes
    expect(useUnsavedChangesPrompt).toHaveBeenLastCalledWith(
      expect.objectContaining({
        hasUnsavedChanges: false,
      }),
    );

    // Simulate user making changes
    const modifiedProps = {
      ...props,
      formData: modifiedFormData,
    };

    rerender(<ExploreHeader {...modifiedProps} />, { useRedux: true });

    await waitFor(() => {
      expect(useUnsavedChangesPrompt).toHaveBeenLastCalledWith(
        expect.objectContaining({
          hasUnsavedChanges: true,
        }),
      );
    });
  });

  test('shows unsaved changes for existing charts when form data differs from saved', async () => {
    const savedFormData = {
      viz_type: VizType.Histogram,
      datasource: '49__table',
      metrics: ['count'],
    };

    const currentFormData = {
      ...savedFormData,
      metrics: ['sum'],
    };

    const props = createProps({
      formData: currentFormData,
      chart: {
        ...createProps().chart,
        sliceFormData: savedFormData,
      },
    });

    render(<ExploreHeader {...props} />, { useRedux: true });

    expect(useUnsavedChangesPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        hasUnsavedChanges: true,
      }),
    );
  });

  test('does not show unsaved changes for existing charts when form data matches saved', async () => {
    const baseFormData = {
      viz_type: VizType.Histogram,
      datasource: '49__table',
      slice_id: 318,
      url_params: {},
      granularity_sqla: 'time_start',
      time_range: 'No filter',
      all_columns_x: ['age'],
      adhoc_filters: [],
      row_limit: 10000,
      groupby: null,
      color_scheme: 'supersetColors',
      label_colors: {},
      link_length: '25',
      x_axis_label: 'age',
      y_axis_label: 'count',
    };

    const props = createProps({
      formData: baseFormData,
      sliceName: 'Age distribution of respondents',
      chart: {
        ...createProps().chart,
        sliceFormData: { ...baseFormData },
      },
    });

    render(<ExploreHeader {...props} />, { useRedux: true });

    expect(useUnsavedChangesPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        hasUnsavedChanges: false,
      }),
    );
  });

  test('Save chart', async () => {
    const setSaveChartModalVisibilitySpy = jest.spyOn(
      saveModalActions,
      'setSaveChartModalVisibility',
    );

    const setSaveChartModalVisibilityMock =
      setSaveChartModalVisibilitySpy as jest.Mock;

    const triggerManualSave = jest.fn(() => {
      setSaveChartModalVisibilityMock(true);
    });

    (useUnsavedChangesPrompt as jest.Mock).mockReturnValue({
      showModal: false,
      setShowModal: jest.fn(),
      handleConfirmNavigation: jest.fn(),
      handleSaveAndCloseModal: jest.fn(),
      triggerManualSave,
    });

    const props = createProps();
    render(<ExploreHeader {...props} />, { useRedux: true });

    const saveButton: HTMLElement = await screen.findByRole('button', {
      name: /save/i,
    });

    userEvent.click(saveButton);

    expect(triggerManualSave).toHaveBeenCalled();
    expect(setSaveChartModalVisibilityMock).toHaveBeenCalledWith(true);

    setSaveChartModalVisibilityMock.mockClear();
  });

  test('Save disabled', async () => {
    const triggerManualSave = jest.fn();

    (useUnsavedChangesPrompt as jest.Mock).mockReturnValue({
      showModal: false,
      setShowModal: jest.fn(),
      handleConfirmNavigation: jest.fn(),
      handleSaveAndCloseModal: jest.fn(),
      triggerManualSave,
    });

    const props = createProps();
    render(<ExploreHeader {...props} saveDisabled />, { useRedux: true });

    const saveButton: HTMLElement = await screen.findByRole('button', {
      name: /save/i,
    });

    expect(saveButton).toBeDisabled();

    userEvent.click(saveButton);

    expect(triggerManualSave).not.toHaveBeenCalled();
  });

  test('should render UnsavedChangesModal when showModal is true', async () => {
    const props = createProps();

    (useUnsavedChangesPrompt as jest.Mock).mockReturnValue({
      showModal: true,
      setShowModal: jest.fn(),
      handleConfirmNavigation: jest.fn(),
      handleSaveAndCloseModal: jest.fn(),
      triggerManualSave: jest.fn(),
    });

    render(<ExploreHeader {...props} />, { useRedux: true });

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(
      await screen.findByText('Save changes to your chart?'),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("If you don't save, changes will be lost."),
    ).toBeInTheDocument();
  });

  test('should call handleSaveAndCloseModal when clicking Save in UnsavedChangesModal', async () => {
    const handleSaveAndCloseModal = jest.fn();

    (useUnsavedChangesPrompt as jest.Mock).mockReturnValue({
      showModal: true,
      setShowModal: jest.fn(),
      handleConfirmNavigation: jest.fn(),
      handleSaveAndCloseModal,
      triggerManualSave: jest.fn(),
    });

    const props = createProps();
    render(<ExploreHeader {...props} />, { useRedux: true });

    const modal: HTMLElement = await screen.findByRole('dialog');
    const saveButton: HTMLElement = within(modal).getByRole('button', {
      name: /save/i,
    });

    userEvent.click(saveButton);

    expect(handleSaveAndCloseModal).toHaveBeenCalled();
  });

  test('should call handleConfirmNavigation when clicking Discard in UnsavedChangesModal', async () => {
    const handleConfirmNavigation = jest.fn();

    (useUnsavedChangesPrompt as jest.Mock).mockReturnValue({
      showModal: true,
      setShowModal: jest.fn(),
      handleConfirmNavigation,
      handleSaveAndCloseModal: jest.fn(),
      triggerManualSave: jest.fn(),
    });

    const props = createProps();
    render(<ExploreHeader {...props} />, { useRedux: true });

    const modal: HTMLElement = await screen.findByRole('dialog');
    const discardButton: HTMLElement = within(modal).getByRole('button', {
      name: /discard/i,
    });

    userEvent.click(discardButton);

    expect(handleConfirmNavigation).toHaveBeenCalled();
  });

  test('should call setShowModal(false) when clicking close button in UnsavedChangesModal', async () => {
    const setShowModal = jest.fn();

    (useUnsavedChangesPrompt as jest.Mock).mockReturnValue({
      showModal: true,
      setShowModal,
      handleConfirmNavigation: jest.fn(),
      handleSaveAndCloseModal: jest.fn(),
      triggerManualSave: jest.fn(),
    });

    const props = createProps();
    render(<ExploreHeader {...props} />, { useRedux: true });

    const closeButton: HTMLElement = await screen.findByRole('button', {
      name: /close/i,
    });

    userEvent.click(closeButton);

    expect(setShowModal).toHaveBeenCalledWith(false);
  });

  test('renders Matrixify tag when matrixify is enabled', async () => {
    const props = createProps({
      formData: {
        ...createProps().chart.latestQueryFormData,
        matrixify_enable_vertical_layout: true,
        matrixify_mode_rows: 'metrics',
        matrixify_rows: [{ label: 'COUNT(*)', expressionType: 'SIMPLE' }],
      },
    });
    render(<ExploreHeader {...props} />, { useRedux: true });

    const matrixifyTag = await screen.findByText('Matrixified');
    expect(matrixifyTag).toBeInTheDocument();
  });

  test('does not render Matrixify tag when matrixify is disabled', async () => {
    const props = createProps({
      formData: {
        ...createProps().chart.latestQueryFormData,
      },
    });
    render(<ExploreHeader {...props} />, { useRedux: true });

    await waitFor(() => {
      expect(screen.queryByText('Matrixified')).not.toBeInTheDocument();
    });
  });
});

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('Additional actions tests', () => {
  jest.setTimeout(15000); // ✅ Applies to all tests in this suite

  beforeEach(() => {
    (useUnsavedChangesPrompt as jest.Mock).mockReturnValue({
      showModal: false,
      setShowModal: jest.fn(),
      handleConfirmNavigation: jest.fn(),
      handleSaveAndCloseModal: jest.fn(),
      triggerManualSave: jest.fn(),
    });
  });

  test('Should render a button', async () => {
    const props = createProps();
    render(<ExploreHeader {...props} />, { useRedux: true });
    expect(
      await screen.findByLabelText('Menu actions trigger'),
    ).toBeInTheDocument();
  });

  test('Should open a menu', async () => {
    const props = createProps();
    render(<ExploreHeader {...props} />, {
      useRedux: true,
    });

    userEvent.click(screen.getByLabelText('Menu actions trigger'));

    expect(
      await screen.findByText('Edit chart properties'),
    ).toBeInTheDocument();
    expect(screen.getByText('Data Export Options')).toBeInTheDocument();
    expect(screen.getByText('Share')).toBeInTheDocument();
    expect(screen.getByText('View query')).toBeInTheDocument();
    expect(screen.getByText('Run in SQL Lab')).toBeInTheDocument();

    expect(
      screen.queryByText('Set up an email report'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Manage email report')).not.toBeInTheDocument();
  });

  test('Should open all data download submenu', async () => {
    const props = createProps();
    render(<ExploreHeader {...props} />, {
      useRedux: true,
    });

    userEvent.click(screen.getByLabelText('Menu actions trigger'));

    userEvent.hover(await screen.findByText('Data Export Options'));
    userEvent.hover(await screen.findByText('Export All Data'));

    expect(await screen.findByText('Export to .CSV')).toBeInTheDocument();
    expect(await screen.findByText('Export to .JSON')).toBeInTheDocument();
    expect(await screen.findByText('Export to Excel')).toBeInTheDocument();
    expect(
      await screen.findByText('Export screenshot (jpeg)'),
    ).toBeInTheDocument();
  });

  test('Should open current view data download submenu', async () => {
    const props = createProps();
    props.chart.latestQueryFormData.viz_type = VizType.Table;

    // Force-enable EXPORT_CURRENT_VIEW for this viz in this test
    const registry = getChartMetadataRegistry();
    const getSpy = jest.spyOn(registry, 'get').mockReturnValue({
      behaviors: ['EXPORT_CURRENT_VIEW'],
    } as any);

    render(<ExploreHeader {...props} />, { useRedux: true });

    userEvent.click(screen.getByLabelText('Menu actions trigger'));
    userEvent.hover(await screen.findByText('Data Export Options'));

    // Now the submenu should exist
    userEvent.hover(await screen.findByText('Export Current View'));

    expect(await screen.findByText('Export to .CSV')).toBeInTheDocument();
    expect(await screen.findByText('Export to .JSON')).toBeInTheDocument();
    expect(
      await screen.findByText(/Export to (Excel|\.XLSX)/i),
    ).toBeInTheDocument();
    expect(
      await screen.findByText('Export screenshot (jpeg)'),
    ).toBeInTheDocument();

    getSpy.mockRestore();
  });

  test('Should open share submenu', async () => {
    const props = createProps();
    render(<ExploreHeader {...props} />, {
      useRedux: true,
    });

    userEvent.click(screen.getByLabelText('Menu actions trigger'));

    expect(
      screen.queryByText('Copy permalink to clipboard'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Embed code')).not.toBeInTheDocument();
    expect(screen.queryByText('Share chart by email')).not.toBeInTheDocument();

    expect(screen.getByText('Share')).toBeInTheDocument();
    userEvent.hover(screen.getByText('Share'));
    expect(
      await screen.findByText('Copy permalink to clipboard'),
    ).toBeInTheDocument();
    expect(await screen.findByText('Embed code')).toBeInTheDocument();
    expect(await screen.findByText('Share chart by email')).toBeInTheDocument();
  });

  test('Should call onOpenPropertiesModal when click on "Edit chart properties"', async () => {
    const props = createProps();
    render(<ExploreHeader {...props} />, {
      useRedux: true,
    });
    expect(props.actions.redirectSQLLab).toHaveBeenCalledTimes(0);
    userEvent.click(screen.getByLabelText('Menu actions trigger'));
    userEvent.click(
      screen.getByRole('menuitem', { name: 'Edit chart properties' }),
    );
    expect(
      await screen.findByText('Edit chart properties'),
    ).toBeInTheDocument();
  });

  test('Should call getChartDataRequest when click on "View query"', async () => {
    const props = createProps();
    const getChartDataRequest = jest.spyOn(chartAction, 'getChartDataRequest');
    render(<ExploreHeader {...props} />, {
      useRedux: true,
    });

    expect(getChartDataRequest).toHaveBeenCalledTimes(0);
    userEvent.click(screen.getByLabelText('Menu actions trigger'));
    expect(getChartDataRequest).toHaveBeenCalledTimes(0);

    const menuItem = screen.getByText('View query').parentElement!;
    userEvent.click(menuItem);

    await waitFor(() => expect(getChartDataRequest).toHaveBeenCalledTimes(1));
  });

  test('Should call onOpenInEditor when click on "Run in SQL Lab"', async () => {
    const props = createProps();
    render(<ExploreHeader {...props} />, {
      useRedux: true,
    });
    expect(await screen.findByText('Save')).toBeInTheDocument();

    expect(props.actions.redirectSQLLab).toHaveBeenCalledTimes(0);
    userEvent.click(screen.getByLabelText('Menu actions trigger'));
    expect(props.actions.redirectSQLLab).toHaveBeenCalledTimes(0);

    userEvent.click(screen.getByRole('menuitem', { name: 'Run in SQL Lab' }));
    expect(props.actions.redirectSQLLab).toHaveBeenCalledTimes(1);
  });

  // eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
  describe('Export All Data', () => {
    let spyDownloadAsImage: jest.SpyInstance;
    let spyExportChart: jest.SpyInstance;

    beforeEach(() => {
      spyDownloadAsImage = jest.spyOn(downloadAsImage, 'default');
      spyExportChart = jest.spyOn(exploreUtils, 'exportChart');

      (useUnsavedChangesPrompt as jest.Mock).mockReturnValue({
        showModal: false,
        setShowModal: jest.fn(),
        handleConfirmNavigation: jest.fn(),
        handleSaveAndCloseModal: jest.fn(),
        triggerManualSave: jest.fn(),
      });
    });

    afterEach(async () => {
      spyDownloadAsImage.mockRestore();
      spyExportChart.mockRestore();
      // Wait for any pending effects to complete
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    test('Should call downloadAsImage when click on "Export screenshot (jpeg)"', async () => {
      const props = createProps();
      render(<ExploreHeader {...props} />, {
        useRedux: true,
      });

      userEvent.click(screen.getByLabelText('Menu actions trigger'));
      userEvent.hover(await screen.findByText('Data Export Options'));
      userEvent.hover(await screen.findByText('Export All Data'));

      const downloadAsImageElement = await screen.findByText(
        'Export screenshot (jpeg)',
      );
      userEvent.click(downloadAsImageElement);

      await waitFor(() => {
        expect(spyDownloadAsImage.mock.calls.length).toBe(1);
      });
    });

    test('Should not export to CSV if canDownload=false', async () => {
      const props = createProps();
      render(<ExploreHeader {...props} />, {
        useRedux: true,
      });
      userEvent.click(screen.getByLabelText('Menu actions trigger'));
      userEvent.hover(await screen.findByText('Data Export Options'));
      userEvent.hover(await screen.findByText('Export All Data'));
      const exportCSVElement = await screen.findByText('Export to .CSV');
      userEvent.click(exportCSVElement);
      expect(spyExportChart.mock.calls.length).toBe(0);
      spyExportChart.mockRestore();
    });

    test('Should export to CSV if canDownload=true', async () => {
      const props = createProps();
      props.canDownload = true;
      render(<ExploreHeader {...props} />, {
        useRedux: true,
      });

      userEvent.click(screen.getByLabelText('Menu actions trigger'));
      userEvent.hover(await screen.findByText('Data Export Options'));
      userEvent.hover(await screen.findByText('Export All Data'));
      const exportCSVElement = await screen.findByText('Export to .CSV');
      userEvent.click(exportCSVElement);
      expect(spyExportChart.mock.calls.length).toBe(1);
      spyExportChart.mockRestore();
    });

    test('Should not export to JSON if canDownload=false', async () => {
      const props = createProps();
      render(<ExploreHeader {...props} />, {
        useRedux: true,
      });
      userEvent.click(screen.getByLabelText('Menu actions trigger'));
      userEvent.hover(await screen.findByText('Data Export Options'));
      userEvent.hover(await screen.findByText('Export All Data'));
      const exportJsonElement = await screen.findByText('Export to .JSON');
      userEvent.click(exportJsonElement);
      expect(spyExportChart.mock.calls.length).toBe(0);
      spyExportChart.mockRestore();
    });

    test('Should export to JSON if canDownload=true', async () => {
      const props = createProps();
      props.canDownload = true;
      render(<ExploreHeader {...props} />, {
        useRedux: true,
      });

      userEvent.click(screen.getByLabelText('Menu actions trigger'));
      userEvent.hover(await screen.findByText('Data Export Options'));
      userEvent.hover(await screen.findByText('Export All Data'));
      const exportJsonElement = await screen.findByText('Export to .JSON');
      userEvent.click(exportJsonElement);
      expect(spyExportChart.mock.calls.length).toBe(1);
    });

    test('Should not export to pivoted CSV if canDownloadCSV=false and viz_type=pivot_table_v2', async () => {
      const props = createProps();
      props.chart.latestQueryFormData.viz_type = VizType.PivotTable;
      render(<ExploreHeader {...props} />, {
        useRedux: true,
      });

      userEvent.click(screen.getByLabelText('Menu actions trigger'));
      userEvent.hover(await screen.findByText('Data Export Options'));
      userEvent.hover(await screen.findByText('Export All Data'));
      const exportCSVElement = await screen.findByText(
        'Export to pivoted .CSV',
      );
      userEvent.click(exportCSVElement);
      expect(spyExportChart.mock.calls.length).toBe(0);
    });

    test('Should export to pivoted CSV if canDownloadCSV=true and viz_type=pivot_table_v2', async () => {
      const props = createProps();
      props.canDownload = true;
      props.chart.latestQueryFormData.viz_type = VizType.PivotTable;
      render(<ExploreHeader {...props} />, {
        useRedux: true,
      });

      userEvent.click(screen.getByLabelText('Menu actions trigger'));
      userEvent.hover(await screen.findByText('Data Export Options'));
      userEvent.hover(await screen.findByText('Export All Data'));
      const exportCSVElement = await screen.findByText(
        'Export to pivoted .CSV',
      );
      userEvent.click(exportCSVElement);
      expect(spyExportChart.mock.calls.length).toBe(1);
    });

    test('Should not export to Excel if canDownload=false', async () => {
      const props = createProps();
      render(<ExploreHeader {...props} />, {
        useRedux: true,
      });
      userEvent.click(screen.getByLabelText('Menu actions trigger'));
      userEvent.hover(await screen.findByText('Data Export Options'));
      userEvent.hover(await screen.findByText('Export All Data'));
      const exportExcelElement = await screen.findByText('Export to Excel');
      userEvent.click(exportExcelElement);
      expect(spyExportChart.mock.calls.length).toBe(0);
      spyExportChart.mockRestore();
    });

    test('Should export to Excel if canDownload=true', async () => {
      const props = createProps();
      props.canDownload = true;
      render(<ExploreHeader {...props} />, {
        useRedux: true,
      });
      userEvent.click(screen.getByLabelText('Menu actions trigger'));
      userEvent.hover(await screen.findByText('Data Export Options'));
      userEvent.hover(await screen.findByText('Export All Data'));
      const exportExcelElement = await screen.findByText('Export to Excel');
      userEvent.click(exportExcelElement);
      expect(spyExportChart.mock.calls.length).toBe(1);
    });
  });

  describe('Current View', () => {
    let spyDownloadAsImage: jest.SpyInstance;
    let spyExportChart: jest.SpyInstance;

    let originalURL: typeof URL;
    let anchorClickSpy: jest.SpyInstance;

    beforeAll(() => {
      originalURL = global.URL;

      // Replace global.URL with a version that has the blob helpers
      const mockedURL = {
        ...originalURL,
        createObjectURL: jest.fn(() => 'blob:mock-url'),
        revokeObjectURL: jest.fn(),
      } as unknown as typeof URL;

      Object.defineProperty(global, 'URL', {
        writable: true,
        value: mockedURL,
      });

      // Avoid jsdom navigation side-effects on <a>.click()
      anchorClickSpy = jest
        .spyOn(HTMLAnchorElement.prototype, 'click')
        .mockImplementation(() => {});
    });

    afterAll(() => {
      // restore URL
      Object.defineProperty(global, 'URL', {
        writable: true,
        value: originalURL,
      });
      anchorClickSpy.mockRestore();
    });

    beforeEach(() => {
      spyDownloadAsImage = jest.spyOn(downloadAsImage, 'default');
      spyExportChart = jest.spyOn(exploreUtils, 'exportChart');

      (useUnsavedChangesPrompt as jest.Mock).mockReturnValue({
        showModal: false,
        setShowModal: jest.fn(),
        handleConfirmNavigation: jest.fn(),
        handleSaveAndCloseModal: jest.fn(),
        triggerManualSave: jest.fn(),
      });
    });

    afterEach(async () => {
      spyDownloadAsImage.mockRestore();
      spyExportChart.mockRestore();
      await new Promise(r => setTimeout(r, 0));
    });

    test('Screenshot (Current View) calls downloadAsImage', async () => {
      const props = createProps();
      props.chart.latestQueryFormData.viz_type = VizType.Table;

      const getSpy = mockExportCurrentViewBehavior();

      render(<ExploreHeader {...props} />, { useRedux: true });

      userEvent.click(screen.getByLabelText('Menu actions trigger'));
      userEvent.hover(await screen.findByText('Data Export Options'));
      userEvent.hover(await screen.findByText('Export Current View'));

      // clear previous calls on the jest spy created in beforeEach
      spyDownloadAsImage.mockClear();

      const item = await screen.findByText('Export screenshot (jpeg)');
      userEvent.click(item);

      await waitFor(() => {
        expect(spyDownloadAsImage).toHaveBeenCalled();
      });

      getSpy.mockRestore();
    });

    test('CSV (Current View) uses client-side export when pagination disabled & clientView present', async () => {
      const props = createProps({
        ownState: {
          clientView: {
            columns: [
              { key: 'a', label: 'A' },
              { key: 'b', label: 'B' },
            ],
            rows: [
              { a: 1, b: 'x' },
              { a: 2, b: 'y' },
            ],
          },
        },
      });
      props.canDownload = true;
      props.chart.latestQueryFormData.viz_type = VizType.Table;
      props.chart.latestQueryFormData.server_pagination = false;

      const getSpy = mockExportCurrentViewBehavior();

      render(<ExploreHeader {...props} />, { useRedux: true });

      userEvent.click(screen.getByLabelText('Menu actions trigger'));
      userEvent.hover(await screen.findByText('Data Export Options'));
      userEvent.hover(await screen.findByText('Export Current View'));

      spyExportChart.mockClear();

      userEvent.click(await screen.findByText('Export to .CSV'));

      expect(spyExportChart).not.toHaveBeenCalled();

      getSpy.mockRestore();
    });

    test('JSON (Current View) uses client-side export when pagination disabled & clientView present', async () => {
      const props = createProps({
        ownState: {
          clientView: {
            columns: [{ key: 'a', label: 'A' }],
            rows: [{ a: 123 }],
          },
        },
      });
      props.canDownload = true;
      props.chart.latestQueryFormData.viz_type = VizType.Table;
      props.chart.latestQueryFormData.server_pagination = false;

      const getSpy = mockExportCurrentViewBehavior();

      render(<ExploreHeader {...props} />, { useRedux: true });

      userEvent.click(screen.getByLabelText('Menu actions trigger'));
      userEvent.hover(await screen.findByText('Data Export Options'));
      userEvent.hover(await screen.findByText('Export Current View'));

      spyExportChart.mockClear();
      userEvent.click(await screen.findByText('Export to .JSON'));

      expect(spyExportChart).not.toHaveBeenCalled();

      getSpy.mockRestore();
    });

    test('CSV (Current View) falls back to server export when server_pagination is true', async () => {
      const props = createProps();
      props.canDownload = true;
      props.chart.latestQueryFormData.viz_type = VizType.Table;
      props.chart.latestQueryFormData.server_pagination = true;

      const getSpy = mockExportCurrentViewBehavior();

      render(<ExploreHeader {...props} />, { useRedux: true });

      userEvent.click(screen.getByLabelText('Menu actions trigger'));
      userEvent.hover(await screen.findByText('Data Export Options'));
      userEvent.hover(await screen.findByText('Export Current View'));

      spyExportChart.mockClear();
      userEvent.click(await screen.findByText('Export to .CSV'));

      expect(spyExportChart.mock.calls.length).toBe(1);
      const args = spyExportChart.mock.calls[0][0];
      expect(args.resultType).toBe('results');
      expect(args.resultFormat).toBe('csv');

      getSpy.mockRestore();
    });

    test('Excel (Current View) uses client-side export when pagination disabled & clientView present', async () => {
      const props = createProps({
        ownState: {
          clientView: {
            columns: [{ key: 'c', label: 'C' }],
            rows: [{ c: 'foo' }],
          },
        },
      });
      props.canDownload = true;
      props.chart.latestQueryFormData.viz_type = VizType.Table;
      props.chart.latestQueryFormData.server_pagination = false;

      const getSpy = mockExportCurrentViewBehavior();
      render(<ExploreHeader {...props} />, { useRedux: true });

      userEvent.click(await screen.findByLabelText('Menu actions trigger'));
      userEvent.hover(await screen.findByText('Data Export Options'));
      userEvent.hover(await screen.findByText('Export Current View'));

      spyExportChart.mockClear();
      userEvent.click(await screen.findByText(/Export to (Excel|\.XLSX)/i));

      expect(spyExportChart).not.toHaveBeenCalled();
      getSpy.mockRestore();
    });

    test('Excel (Current View) falls back to server export when server_pagination is true', async () => {
      const props = createProps();
      props.canDownload = true;
      props.chart.latestQueryFormData.viz_type = VizType.Table;
      props.chart.latestQueryFormData.server_pagination = true;

      const getSpy = mockExportCurrentViewBehavior();
      render(<ExploreHeader {...props} />, { useRedux: true });

      userEvent.click(await screen.findByLabelText('Menu actions trigger'));
      userEvent.hover(await screen.findByText('Data Export Options'));
      userEvent.hover(await screen.findByText('Export Current View'));

      spyExportChart.mockClear();
      userEvent.click(await screen.findByText(/Export to (Excel|\.XLSX)/i));

      expect(spyExportChart.mock.calls.length).toBe(1);
      const args = spyExportChart.mock.calls[0][0];
      expect(args.resultType).toBe('results');
      expect(args.resultFormat).toBe('xlsx');
      getSpy.mockRestore();

      // delete test excel files
      const cwd = process.cwd();
      for (const file of fs.readdirSync(cwd)) {
        if (file.endsWith('.xlsx')) {
          fs.unlinkSync(path.join(cwd, file));
        }
      }
    });

    test('JSON (Current View) falls back to server export when server_pagination is true', async () => {
      const props = createProps();
      props.canDownload = true;
      props.chart.latestQueryFormData.viz_type = VizType.Table;
      props.chart.latestQueryFormData.server_pagination = true;

      const getSpy = mockExportCurrentViewBehavior();

      render(<ExploreHeader {...props} />, { useRedux: true });

      userEvent.click(screen.getByLabelText('Menu actions trigger'));
      userEvent.hover(await screen.findByText('Data Export Options'));
      userEvent.hover(await screen.findByText('Export Current View'));

      // server path expected - use the jest spy and inspect call args
      spyExportChart.mockClear();

      const jsonItem = await screen.findByText('Export to .JSON');
      userEvent.click(jsonItem);

      await waitFor(() => {
        expect(spyExportChart.mock.calls.length).toBe(1);
      });

      const args = spyExportChart.mock.calls[0][0];
      expect(args.resultType).toBe('results');
      expect(args.resultFormat).toBe('json');

      getSpy.mockRestore();
    });
  });
});
