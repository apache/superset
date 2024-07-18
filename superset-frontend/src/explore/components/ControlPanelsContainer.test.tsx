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
import { useSelector } from 'react-redux';
import userEvent from '@testing-library/user-event';
import { render, screen } from 'spec/helpers/testing-library';
import {
  DatasourceType,
  getChartControlPanelRegistry,
  t,
} from '@superset-ui/core';
import { defaultControls, defaultState } from 'src/explore/store';
import { ExplorePageState } from 'src/explore/types';
import { getFormDataFromControls } from 'src/explore/controlUtils';
import {
  ControlPanelsContainer,
  ControlPanelsContainerProps,
} from 'src/explore/components/ControlPanelsContainer';

const FormDataMock = () => {
  const formData = useSelector(
    (state: ExplorePageState) => state.explore.form_data,
  );

  return <div data-test="mock-formdata">{Object.keys(formData).join(':')}</div>;
};

describe('ControlPanelsContainer', () => {
  beforeAll(() => {
    getChartControlPanelRegistry().registerValue('table', {
      controlPanelSections: [
        {
          label: t('GROUP BY'),
          description: t(
            'Use this section if you want a query that aggregates',
          ),
          expanded: true,
          controlSetRows: [
            ['groupby'],
            ['metrics'],
            ['percent_metrics'],
            ['timeseries_limit_metric', 'row_limit'],
            ['include_time', 'order_desc'],
          ],
        },
        {
          label: t('NOT GROUPED BY'),
          description: t('Use this section if you want to query atomic rows'),
          expanded: true,
          controlSetRows: [
            ['all_columns'],
            ['order_by_cols'],
            ['row_limit', null],
          ],
        },
        {
          label: t('Query'),
          expanded: true,
          controlSetRows: [['adhoc_filters']],
        },
        {
          label: t('Options'),
          expanded: true,
          controlSetRows: [
            ['table_timestamp_format'],
            ['page_length', null],
            ['include_search', 'table_filter'],
            ['align_pn', 'color_pn'],
          ],
        },
      ],
    });
  });

  afterAll(() => {
    getChartControlPanelRegistry().remove('table');
  });

  function getDefaultProps() {
    const controls = defaultControls as ControlPanelsContainerProps['controls'];
    return {
      datasource_type: DatasourceType.Table,
      actions: {},
      controls,
      form_data: getFormDataFromControls(controls),
      isDatasourceMetaLoading: false,
      exploreState: {},
      chart: {
        queriesResponse: null,
        chartStatus: 'success',
      },
    } as ControlPanelsContainerProps;
  }

  test('renders ControlPanelSections', async () => {
    render(<ControlPanelsContainer {...getDefaultProps()} />, {
      useRedux: true,
    });
    expect(
      await screen.findAllByTestId('collapsible-control-panel-header'),
    ).toHaveLength(4);
    expect(screen.getByRole('tab', { name: /customize/i })).toBeInTheDocument();
    userEvent.click(screen.getByRole('tab', { name: /customize/i }));
    expect(
      await screen.findAllByTestId('collapsible-control-panel-header'),
    ).toHaveLength(5);
  });

  test('renders ControlPanelSections no Customize Tab', async () => {
    getChartControlPanelRegistry().registerValue('table', {
      controlPanelSections: [
        {
          label: t('GROUP BY'),
          description: t(
            'Use this section if you want a query that aggregates',
          ),
          expanded: true,
          controlSetRows: [
            ['groupby'],
            ['metrics'],
            ['percent_metrics'],
            ['timeseries_limit_metric', 'row_limit'],
            ['include_time', 'order_desc'],
          ],
        },
        {
          label: t('Options'),
          expanded: true,
          controlSetRows: [],
        },
      ],
    });
    render(<ControlPanelsContainer {...getDefaultProps()} />, {
      useRedux: true,
    });
    expect(screen.queryByText(/customize/i)).not.toBeInTheDocument();
    expect(
      await screen.findAllByTestId('collapsible-control-panel-header'),
    ).toHaveLength(2);
  });

  test('visibility of panels is correctly applied', async () => {
    getChartControlPanelRegistry().registerValue('table', {
      controlPanelSections: [
        {
          label: t('Advanced analytics'),
          description: t('Advanced analytics post processing'),
          expanded: true,
          controlSetRows: [['groupby'], ['metrics'], ['percent_metrics']],
          visibility: () => false,
        },
        {
          label: t('Chart Title'),
          visibility: () => true,
          controlSetRows: [['timeseries_limit_metric', 'row_limit']],
        },
        {
          label: t('Chart Options'),
          controlSetRows: [['include_time', 'order_desc']],
        },
      ],
    });
    const { getByTestId } = render(
      <>
        <ControlPanelsContainer {...getDefaultProps()} />
        <FormDataMock />
      </>,
      {
        useRedux: true,
        initialState: { explore: { form_data: defaultState.form_data } },
      },
    );

    const disabledSection = screen.queryByRole('button', {
      name: /advanced analytics/i,
    });
    expect(disabledSection).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /chart title/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /chart options/i }),
    ).toBeInTheDocument();

    expect(getByTestId('mock-formdata')).not.toHaveTextContent('groupby');
    expect(getByTestId('mock-formdata')).not.toHaveTextContent('metrics');
    expect(getByTestId('mock-formdata')).not.toHaveTextContent(
      'percent_metrics',
    );
  });

  test('hidden state of controls is correctly applied', async () => {
    getChartControlPanelRegistry().registerValue('table', {
      controlPanelSections: [
        {
          label: t('Time Comparison'),
          expanded: true,
          controlSetRows: [
            [
              {
                name: 'time_compare',
                config: {
                  type: 'SelectControl',
                  freeForm: true,
                  label: t('Time shift'),
                  choices: [],
                },
              },
            ],
            [
              {
                name: 'start_date_offset',
                config: {
                  type: 'SelectControl',
                  choices: [],
                  label: t('Shift start date'),
                  hidden: true,
                },
              },
            ],
            [
              {
                name: 'comparison_type',
                config: {
                  type: 'SelectControl',
                  label: t('Calculation type'),
                  default: 'values',
                  choices: [],
                  hidden: () => true,
                },
              },
            ],
          ],
        },
      ],
    });
    render(<ControlPanelsContainer {...getDefaultProps()} />, {
      useRedux: true,
    });

    expect(screen.getByText('Time shift')).toBeInTheDocument();
    expect(screen.getByText('Shift start date')).toBeInTheDocument();
    expect(screen.getByText('Calculation type')).toBeInTheDocument();
    expect(screen.getByText('Shift start date')).not.toBeVisible();
    expect(screen.getByText('Calculation type')).not.toBeVisible();
  });
});
