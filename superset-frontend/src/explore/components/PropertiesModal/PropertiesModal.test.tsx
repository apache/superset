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
import { Slice } from 'src/types/Chart';
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import fetchMock from 'fetch-mock';
import userEvent from '@testing-library/user-event';
import PropertiesModal, { PropertiesModalProps } from '.';

const createProps = () => ({
  slice: {
    cache_timeout: null,
    certified_by: 'John Doe',
    certification_details: 'Sample certification',
    changed_on: '2021-03-19T16:30:56.750230',
    changed_on_humanized: '7 days ago',
    datasource: 'FCC 2018 Survey',
    description: null,
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
      viz_type: 'histogram',
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
    slice_url: '/superset/explore/?form_data=%7B%22slice_id%22%3A%20318%7D',
  } as unknown as Slice,
  show: true,
  onHide: jest.fn(),
  onSave: jest.fn(),
  addSuccessToast: jest.fn(),
});

fetchMock.get('glob:*/api/v1/chart/318', {
  body: {
    description_columns: {},
    id: 318,
    label_columns: {
      cache_timeout: 'Cache Timeout',
      'dashboards.dashboard_title': 'Dashboards Dashboard Title',
      'dashboards.id': 'Dashboards Id',
      description: 'Description',
      'owners.first_name': 'Owners First Name',
      'owners.id': 'Owners Id',
      'owners.last_name': 'Owners Last Name',
      'owners.username': 'Owners Username',
      params: 'Params',
      slice_name: 'Slice Name',
      viz_type: 'Viz Type',
    },
    result: {
      cache_timeout: null,
      certified_by: 'John Doe',
      certification_details: 'Sample certification',
      dashboards: [
        {
          dashboard_title: 'FCC New Coder Survey 2018',
          id: 23,
        },
      ],
      description: null,
      owners: [
        {
          first_name: 'Superset',
          id: 1,
          last_name: 'Admin',
          username: 'admin',
        },
      ],
      params:
        '{"adhoc_filters": [], "all_columns_x": ["age"], "color_scheme": "supersetColors", "datasource": "42__table", "granularity_sqla": "time_start", "groupby": null, "label_colors": {}, "link_length": "25", "queryFields": {"groupby": "groupby"}, "row_limit": 10000, "slice_id": 1380, "time_range": "No filter", "url_params": {}, "viz_type": "histogram", "x_axis_label": "age", "y_axis_label": "count"}',
      slice_name: 'Age distribution of respondents',
      viz_type: 'histogram',
    },
    show_columns: [
      'cache_timeout',
      'dashboards.dashboard_title',
      'dashboards.id',
      'description',
      'owners.first_name',
      'owners.id',
      'owners.last_name',
      'owners.username',
      'params',
      'slice_name',
      'viz_type',
    ],
    show_title: 'Show Slice',
  },
});

fetchMock.get('glob:*/api/v1/chart/related/owners?q=(filter:%27%27)', {
  body: {
    count: 1,
    result: [
      {
        text: 'Superset Admin',
        value: 1,
      },
    ],
  },
  sendAsJson: true,
});

fetchMock.put('glob:*/api/v1/chart/318', {
  body: {
    id: 318,
    result: {
      cache_timeout: null,
      certified_by: 'John Doe',
      certification_details: 'Sample certification',
      description: null,
      owners: [],
      slice_name: 'Age distribution of respondents',
    },
  },
  sendAsJson: true,
});

afterAll(() => {
  fetchMock.resetBehavior();
});

const renderModal = (props: PropertiesModalProps) =>
  render(<PropertiesModal {...props} />, { useRedux: true });

test('Should render null when show:false', async () => {
  const props = createProps();
  props.show = false;
  renderModal(props);

  await waitFor(() => {
    expect(
      screen.queryByRole('dialog', { name: 'Edit Chart Properties' }),
    ).not.toBeInTheDocument();
  });
});

test('Should render when show:true', async () => {
  const props = createProps();
  renderModal(props);

  await waitFor(() => {
    expect(
      screen.getByRole('dialog', { name: 'Edit Chart Properties' }),
    ).toBeVisible();
  });
});

test('Should have modal header', async () => {
  const props = createProps();
  renderModal(props);

  await waitFor(() => {
    expect(screen.getByText('Edit Chart Properties')).toBeVisible();
    expect(screen.getByText('×')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Close' })).toBeVisible();
  });
});

test('"Close" button should call "onHide"', async () => {
  const props = createProps();
  renderModal(props);

  await waitFor(() => {
    expect(props.onHide).toBeCalledTimes(0);
  });

  userEvent.click(screen.getByRole('button', { name: 'Close' }));

  await waitFor(() => {
    expect(props.onHide).toBeCalledTimes(1);
    expect(props.onSave).toBeCalledTimes(0);
  });
});

test('Should render all elements inside modal', async () => {
  const props = createProps();
  renderModal(props);
  await waitFor(() => {
    expect(screen.getAllByRole('textbox')).toHaveLength(5);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Basic information' }),
    ).toBeVisible();
    expect(screen.getByText('Name')).toBeVisible();
    expect(screen.getByText('Description')).toBeVisible();

    expect(
      screen.getByRole('heading', { name: 'Configuration' }),
    ).toBeVisible();
    expect(screen.getByText('Cache timeout')).toBeVisible();

    expect(screen.getByRole('heading', { name: 'Access' })).toBeVisible();
    expect(screen.getByText('Owners')).toBeVisible();

    expect(
      screen.getByRole('heading', { name: 'Configuration' }),
    ).toBeVisible();
    expect(screen.getByText('Certified by')).toBeVisible();
    expect(screen.getByText('Certification details')).toBeVisible();
  });
});

test('Should have modal footer', async () => {
  const props = createProps();
  renderModal(props);

  await waitFor(() => {
    expect(screen.getByText('Cancel')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeVisible();

    expect(screen.getByText('Save')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Save' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });
});

test('"Cancel" button should call "onHide"', async () => {
  const props = createProps();
  renderModal(props);

  await waitFor(() => {
    expect(props.onHide).toBeCalledTimes(0);
  });

  userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

  await waitFor(() => {
    expect(props.onHide).toBeCalledTimes(1);
    expect(props.onSave).toBeCalledTimes(0);
  });
});

test('"Save" button should call only "onSave"', async () => {
  const props = createProps();
  renderModal(props);
  await waitFor(() => {
    expect(props.onSave).toBeCalledTimes(0);
    expect(props.onHide).toBeCalledTimes(0);

    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });
  userEvent.click(screen.getByRole('button', { name: 'Save' }));

  await waitFor(() => {
    expect(props.onSave).toBeCalledTimes(1);
    expect(props.onHide).toBeCalledTimes(1);
  });
});

test('Empty "Certified by" should clear "Certification details"', async () => {
  const props = createProps();
  const noCertifiedByProps = {
    ...props,
    slice: {
      ...props.slice,
      certified_by: '',
    },
  };
  renderModal(noCertifiedByProps);

  expect(
    screen.getByRole('textbox', { name: 'Certification details' }),
  ).toHaveValue('');
});

test('"Name" should not be empty', async () => {
  const props = createProps();
  renderModal(props);

  const name = screen.getByRole('textbox', { name: 'Name' });

  userEvent.clear(name);

  expect(name).toHaveValue('');

  userEvent.click(screen.getByRole('button', { name: 'Save' }));

  await waitFor(() => {
    expect(props.onSave).toBeCalledTimes(0);
  });
});

test('"Name" should not be empty when saved', async () => {
  const props = createProps();
  renderModal(props);

  const name = screen.getByRole('textbox', { name: 'Name' });

  userEvent.clear(name);
  userEvent.type(name, 'Test chart new name');

  expect(name).toHaveValue('Test chart new name');

  userEvent.click(screen.getByRole('button', { name: 'Save' }));

  await waitFor(() => {
    expect(props.onSave).toBeCalledTimes(1);
    expect(props.onSave).toBeCalledWith(
      expect.objectContaining({ slice_name: 'Test chart new name' }),
    );
  });
});

test('"Cache timeout" should not be empty when saved', async () => {
  const props = createProps();
  renderModal(props);

  const cacheTimeout = screen.getByRole('textbox', { name: 'Cache timeout' });

  userEvent.clear(cacheTimeout);
  userEvent.type(cacheTimeout, '1000');

  expect(cacheTimeout).toHaveValue('1000');

  userEvent.click(screen.getByRole('button', { name: 'Save' }));

  await waitFor(() => {
    expect(props.onSave).toBeCalledTimes(1);
    expect(props.onSave).toBeCalledWith(
      expect.objectContaining({ cache_timeout: '1000' }),
    );
  });
});

test('"Description" should not be empty when saved', async () => {
  const props = createProps();
  renderModal(props);

  const description = screen.getByRole('textbox', { name: 'Description' });

  userEvent.clear(description);
  userEvent.type(description, 'Test description');

  expect(description).toHaveValue('Test description');

  userEvent.click(screen.getByRole('button', { name: 'Save' }));

  await waitFor(() => {
    expect(props.onSave).toBeCalledTimes(1);
    expect(props.onSave).toBeCalledWith(
      expect.objectContaining({ description: 'Test description' }),
    );
  });
});

test('"Certified by" should not be empty when saved', async () => {
  const props = createProps();
  renderModal(props);

  const certifiedBy = screen.getByRole('textbox', { name: 'Certified by' });

  userEvent.clear(certifiedBy);
  userEvent.type(certifiedBy, 'Test certified by');

  expect(certifiedBy).toHaveValue('Test certified by');

  userEvent.click(screen.getByRole('button', { name: 'Save' }));

  await waitFor(() => {
    expect(props.onSave).toBeCalledTimes(1);
    expect(props.onSave).toBeCalledWith(
      expect.objectContaining({ certified_by: 'Test certified by' }),
    );
  });
});

test('"Certification details" should not be empty when saved', async () => {
  const props = createProps();
  renderModal(props);

  const certificationDetails = screen.getByRole('textbox', {
    name: 'Certification details',
  });

  userEvent.clear(certificationDetails);
  userEvent.type(certificationDetails, 'Test certification details');

  expect(certificationDetails).toHaveValue('Test certification details');

  userEvent.click(screen.getByRole('button', { name: 'Save' }));

  await waitFor(() => {
    expect(props.onSave).toBeCalledTimes(1);
    expect(props.onSave).toBeCalledWith(
      expect.objectContaining({
        certification_details: 'Test certification details',
      }),
    );
  });
});
