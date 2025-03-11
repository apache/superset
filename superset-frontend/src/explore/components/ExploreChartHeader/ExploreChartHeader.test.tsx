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

import sinon from 'sinon';
import {
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import fetchMock from 'fetch-mock';
import * as chartAction from 'src/components/Chart/chartAction';
import * as saveModalActions from 'src/explore/actions/saveModalActions';
import * as downloadAsImage from 'src/utils/downloadAsImage';
import * as exploreUtils from 'src/explore/exploreUtils';
import { FeatureFlag, VizType } from '@superset-ui/core';
import ExploreHeader from '.';

const chartEndpoint = 'glob:*api/v1/chart/*';

fetchMock.get(chartEndpoint, { json: 'foo' });

window.featureFlags = {
  [FeatureFlag.EmbeddableCharts]: true,
};

const createProps = (additionalProps = {}) => ({
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
    },
    chartStatus: 'rendered',
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
  slice_name: 'Age distribution of respondents',
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
});

fetchMock.post(
  'http://api/v1/chart/data?form_data=%7B%22slice_id%22%3A318%7D',
  { body: {} },
  {
    sendAsJson: false,
  },
);
describe('ExploreChartHeader', () => {
  jest.setTimeout(15000); // ✅ Applies to all tests in this suite

  test('Cancelling changes to the properties should reset previous properties', async () => {
    const props = createProps();
    render(<ExploreHeader {...props} />, { useRedux: true });
    const newChartName = 'New chart name';
    const prevChartName = props.slice_name;
    expect(
      await screen.findByText(/add the name of the chart/i),
    ).toBeInTheDocument();

    userEvent.click(screen.getByLabelText('Menu actions trigger'));
    userEvent.click(screen.getByText('Edit chart properties'));

    const nameInput = await screen.findByRole('textbox', { name: 'Name' });

    userEvent.clear(nameInput);
    userEvent.type(nameInput, newChartName);

    expect(screen.getByDisplayValue(newChartName)).toBeInTheDocument();

    userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    userEvent.click(screen.getByLabelText('Menu actions trigger'));
    userEvent.click(screen.getByText('Edit chart properties'));

    expect(await screen.findByDisplayValue(prevChartName)).toBeInTheDocument();
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
          ...props.metadata,
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

  test('Save chart', async () => {
    const setSaveChartModalVisibility = jest.spyOn(
      saveModalActions,
      'setSaveChartModalVisibility',
    );
    const props = createProps();
    render(<ExploreHeader {...props} />, { useRedux: true });
    expect(await screen.findByText('Save')).toBeInTheDocument();
    userEvent.click(screen.getByText('Save'));
    expect(setSaveChartModalVisibility).toHaveBeenCalledWith(true);
    setSaveChartModalVisibility.mockClear();
  });

  test('Save disabled', async () => {
    const setSaveChartModalVisibility = jest.spyOn(
      saveModalActions,
      'setSaveChartModalVisibility',
    );
    const props = createProps();
    render(<ExploreHeader {...props} saveDisabled />, { useRedux: true });
    expect(await screen.findByText('Save')).toBeInTheDocument();
    userEvent.click(screen.getByText('Save'));
    expect(setSaveChartModalVisibility).not.toHaveBeenCalled();
    setSaveChartModalVisibility.mockClear();
  });
});

describe('Additional actions tests', () => {
  jest.setTimeout(15000); // ✅ Applies to all tests in this suite

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
    expect(screen.getByText('Download')).toBeInTheDocument();
    expect(screen.getByText('Share')).toBeInTheDocument();
    expect(screen.getByText('View query')).toBeInTheDocument();
    expect(screen.getByText('Run in SQL Lab')).toBeInTheDocument();

    expect(
      screen.queryByText('Set up an email report'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Manage email report')).not.toBeInTheDocument();
  });

  test('Should open download submenu', async () => {
    const props = createProps();
    render(<ExploreHeader {...props} />, {
      useRedux: true,
    });

    userEvent.click(screen.getByLabelText('Menu actions trigger'));

    expect(screen.queryByText('Export to .CSV')).not.toBeInTheDocument();
    expect(screen.queryByText('Export to .JSON')).not.toBeInTheDocument();
    expect(screen.queryByText('Download as image')).not.toBeInTheDocument();

    expect(screen.getByText('Download')).toBeInTheDocument();
    userEvent.hover(screen.getByText('Download'));
    expect(await screen.findByText('Export to .CSV')).toBeInTheDocument();
    expect(await screen.findByText('Export to .JSON')).toBeInTheDocument();
    expect(await screen.findByText('Download as image')).toBeInTheDocument();
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

    expect(screen.queryByText('Edit Chart Properties')).not.toBeInTheDocument();
    userEvent.click(
      screen.getByRole('menuitem', { name: 'Edit chart properties' }),
    );
    expect(
      await screen.findByText('Edit Chart Properties'),
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

  describe('Download', () => {
    let spyDownloadAsImage = sinon.spy();
    let spyExportChart = sinon.spy();

    beforeEach(() => {
      spyDownloadAsImage = sinon.spy(downloadAsImage, 'default');
      spyExportChart = sinon.spy(exploreUtils, 'exportChart');
    });

    afterEach(async () => {
      spyDownloadAsImage.restore();
      spyExportChart.restore();
      // Wait for any pending effects to complete
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    test('Should call downloadAsImage when click on "Download as image"', async () => {
      const props = createProps();
      const spy = jest.spyOn(downloadAsImage, 'default');
      render(<ExploreHeader {...props} />, {
        useRedux: true,
      });

      await waitFor(() => {
        expect(
          screen.getByLabelText('Menu actions trigger'),
        ).toBeInTheDocument();
      });

      userEvent.click(screen.getByLabelText('Menu actions trigger'));
      userEvent.hover(screen.getByText('Download'));

      const downloadAsImageElement =
        await screen.findByText('Download as image');
      userEvent.click(downloadAsImageElement);

      await waitFor(() => {
        expect(spy).toHaveBeenCalledTimes(1);
      });
    });

    test('Should not export to CSV if canDownload=false', async () => {
      const props = createProps();
      render(<ExploreHeader {...props} />, {
        useRedux: true,
      });
      userEvent.click(screen.getByLabelText('Menu actions trigger'));
      userEvent.hover(screen.getByText('Download'));
      const exportCSVElement = await screen.findByText('Export to .CSV');
      userEvent.click(exportCSVElement);
      expect(spyExportChart.callCount).toBe(0);
      spyExportChart.restore();
    });

    test('Should export to CSV if canDownload=true', async () => {
      const props = createProps();
      props.canDownload = true;
      render(<ExploreHeader {...props} />, {
        useRedux: true,
      });

      userEvent.click(screen.getByLabelText('Menu actions trigger'));
      userEvent.hover(screen.getByText('Download'));
      const exportCSVElement = await screen.findByText('Export to .CSV');
      userEvent.click(exportCSVElement);
      expect(spyExportChart.callCount).toBe(1);
      spyExportChart.restore();
    });

    test('Should not export to JSON if canDownload=false', async () => {
      const props = createProps();
      render(<ExploreHeader {...props} />, {
        useRedux: true,
      });
      userEvent.click(screen.getByLabelText('Menu actions trigger'));
      userEvent.hover(screen.getByText('Download'));
      const exportJsonElement = await screen.findByText('Export to .JSON');
      userEvent.click(exportJsonElement);
      expect(spyExportChart.callCount).toBe(0);
      spyExportChart.restore();
    });

    test('Should export to JSON if canDownload=true', async () => {
      const props = createProps();
      props.canDownload = true;
      render(<ExploreHeader {...props} />, {
        useRedux: true,
      });

      userEvent.click(screen.getByLabelText('Menu actions trigger'));
      userEvent.hover(screen.getByText('Download'));
      const exportJsonElement = await screen.findByText('Export to .JSON');
      userEvent.click(exportJsonElement);
      expect(spyExportChart.callCount).toBe(1);
    });

    test('Should not export to pivoted CSV if canDownloadCSV=false and viz_type=pivot_table_v2', async () => {
      const props = createProps();
      props.chart.latestQueryFormData.viz_type = VizType.PivotTable;
      render(<ExploreHeader {...props} />, {
        useRedux: true,
      });

      userEvent.click(screen.getByLabelText('Menu actions trigger'));
      userEvent.hover(screen.getByText('Download'));
      const exportCSVElement = await screen.findByText(
        'Export to pivoted .CSV',
      );
      userEvent.click(exportCSVElement);
      expect(spyExportChart.callCount).toBe(0);
    });

    test('Should export to pivoted CSV if canDownloadCSV=true and viz_type=pivot_table_v2', async () => {
      const props = createProps();
      props.canDownload = true;
      props.chart.latestQueryFormData.viz_type = VizType.PivotTable;
      render(<ExploreHeader {...props} />, {
        useRedux: true,
      });

      userEvent.click(screen.getByLabelText('Menu actions trigger'));
      userEvent.hover(screen.getByText('Download'));
      const exportCSVElement = await screen.findByText(
        'Export to pivoted .CSV',
      );
      userEvent.click(exportCSVElement);
      expect(spyExportChart.callCount).toBe(1);
    });

    test('Should not export to Excel if canDownload=false', async () => {
      const props = createProps();
      render(<ExploreHeader {...props} />, {
        useRedux: true,
      });
      userEvent.click(screen.getByLabelText('Menu actions trigger'));
      userEvent.hover(screen.getByText('Download'));
      const exportExcelElement = await screen.findByText('Export to Excel');
      userEvent.click(exportExcelElement);
      expect(spyExportChart.callCount).toBe(0);
      spyExportChart.restore();
    });

    test('Should export to Excel if canDownload=true', async () => {
      const props = createProps();
      props.canDownload = true;
      render(<ExploreHeader {...props} />, {
        useRedux: true,
      });
      userEvent.click(screen.getByLabelText('Menu actions trigger'));
      userEvent.hover(screen.getByText('Download'));
      const exportExcelElement = await screen.findByText('Export to Excel');
      userEvent.click(exportExcelElement);
      expect(spyExportChart.callCount).toBe(1);
    });
  });
});
