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
import { render, screen, act } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import { SupersetClient } from '@superset-ui/core';
import * as Utils from 'src/explore/exploreUtils';
import DatasourceControl from '.';

const SupersetClientGet = jest.spyOn(SupersetClient, 'get');

const createProps = () => ({
  hovered: false,
  type: 'DatasourceControl',
  label: 'Datasource',
  default: null,
  description: null,
  value: '25__table',
  datasource: {
    id: 25,
    database: {
      name: 'examples',
    },
    name: 'channels',
    type: 'table',
    columns: [],
    owners: [{ first_name: 'john', last_name: 'doe', id: 1, username: 'jd' }],
  },
  validationErrors: [],
  name: 'datasource',
  actions: {},
  isEditable: true,
  onChange: jest.fn(),
  onDatasourceSave: jest.fn(),
});

test('Should render', () => {
  const props = createProps();
  render(<DatasourceControl {...props} />);
  expect(screen.getByTestId('datasource-control')).toBeVisible();
});

test('Should have elements', () => {
  const props = createProps();
  render(<DatasourceControl {...props} />);
  expect(screen.getByText('channels')).toBeVisible();
  expect(screen.getByTestId('datasource-menu-trigger')).toBeVisible();
});

test('Should open a menu', () => {
  const props = createProps();
  render(<DatasourceControl {...props} />);

  expect(screen.queryByText('Edit dataset')).not.toBeInTheDocument();
  expect(screen.queryByText('Change dataset')).not.toBeInTheDocument();
  expect(screen.queryByText('View in SQL Lab')).not.toBeInTheDocument();

  userEvent.click(screen.getByTestId('datasource-menu-trigger'));

  expect(screen.getByText('Edit dataset')).toBeInTheDocument();
  expect(screen.getByText('Change dataset')).toBeInTheDocument();
  expect(screen.getByText('View in SQL Lab')).toBeInTheDocument();
});

test('Click on Change dataset option', async () => {
  const props = createProps();
  SupersetClientGet.mockImplementation(
    async ({ endpoint }: { endpoint: string }) => {
      if (endpoint.includes('_info')) {
        return {
          json: { permissions: ['can_read', 'can_write'] },
        } as any;
      }
      return { json: { result: [] } } as any;
    },
  );

  render(<DatasourceControl {...props} />, {
    useRedux: true,
  });
  userEvent.click(screen.getByTestId('datasource-menu-trigger'));

  await act(async () => {
    userEvent.click(screen.getByText('Change dataset'));
  });
  expect(
    screen.getByText(
      'Changing the dataset may break the chart if the chart relies on columns or metadata that does not exist in the target dataset',
    ),
  ).toBeInTheDocument();
});

test('Click on Edit dataset', async () => {
  const props = createProps();
  SupersetClientGet.mockImplementation(
    async () => ({ json: { result: [] } } as any),
  );
  render(<DatasourceControl {...props} />, {
    useRedux: true,
  });
  userEvent.click(screen.getByTestId('datasource-menu-trigger'));

  await act(async () => {
    userEvent.click(screen.getByText('Edit dataset'));
  });

  expect(
    screen.getByText(
      'Changing these settings will affect all charts using this dataset, including charts owned by other people.',
    ),
  ).toBeInTheDocument();
});

test('Click on View in SQL Lab', async () => {
  const props = createProps();
  const postFormSpy = jest.spyOn(Utils, 'postForm');
  postFormSpy.mockImplementation(jest.fn());

  render(<DatasourceControl {...props} />, {
    useRedux: true,
  });
  userEvent.click(screen.getByTestId('datasource-menu-trigger'));

  expect(postFormSpy).toBeCalledTimes(0);

  await act(async () => {
    userEvent.click(screen.getByText('View in SQL Lab'));
  });

  expect(postFormSpy).toBeCalledTimes(1);
});
