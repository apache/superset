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
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import DatasourcePanel, {
  IDatasource,
  Props as DatasourcePanelProps,
} from 'src/explore/components/DatasourcePanel';
import {
  columns,
  metrics,
} from 'src/explore/components/DatasourcePanel/fixtures';
import { DatasourceType } from '@superset-ui/core';
import DatasourceControl from 'src/explore/components/controls/DatasourceControl';

const datasource: IDatasource = {
  id: 1,
  type: DatasourceType.Table,
  columns,
  metrics,
  database: {
    id: 1,
  },
  datasource_name: 'table1',
};

const mockUser = {
  createdOn: '2021-04-27T18:12:38.952304',
  email: 'admin',
  firstName: 'admin',
  isActive: true,
  lastName: 'admin',
  permissions: {},
  roles: { Admin: Array(173) },
  userId: 1,
  username: 'admin',
  isAnonymous: false,
};

const props: DatasourcePanelProps = {
  datasource,
  controls: {
    datasource: {
      validationErrors: null,
      mapStateToProps: () => ({ value: undefined }),
      type: DatasourceControl,
      label: 'hello',
      datasource,
      user: mockUser,
    },
  },
  actions: {
    setControlValue: jest.fn(),
  },
};

const search = (value: string, input: HTMLElement) => {
  userEvent.clear(input);
  userEvent.type(input, value);
};

test('should render', async () => {
  const { container } = render(<DatasourcePanel {...props} />, {
    useRedux: true,
    useDnd: true,
  });
  expect(await screen.findByText(/metrics/i)).toBeInTheDocument();
  expect(container).toBeVisible();
});

test('should display items in controls', async () => {
  render(<DatasourcePanel {...props} />, { useRedux: true, useDnd: true });
  expect(await screen.findByText('Metrics')).toBeInTheDocument();
  expect(screen.getByText('Columns')).toBeInTheDocument();
});

test('should render the metrics', async () => {
  render(<DatasourcePanel {...props} />, { useRedux: true, useDnd: true });
  const metricsNum = metrics.length;
  metrics.forEach(metric =>
    expect(screen.getByText(metric.metric_name)).toBeInTheDocument(),
  );
  expect(
    await screen.findByText(`Showing ${metricsNum} of ${metricsNum}`),
  ).toBeInTheDocument();
});

test('should render the columns', async () => {
  render(<DatasourcePanel {...props} />, { useRedux: true, useDnd: true });
  const columnsNum = columns.length;
  columns.forEach(col =>
    expect(screen.getByText(col.column_name)).toBeInTheDocument(),
  );
  expect(
    await screen.findByText(`Showing ${columnsNum} of ${columnsNum}`),
  ).toBeInTheDocument();
});

test('should render 0 search results', async () => {
  render(<DatasourcePanel {...props} />, { useRedux: true, useDnd: true });
  const searchInput = screen.getByPlaceholderText('Search Metrics & Columns');

  search('nothing', searchInput);
  expect(await screen.findAllByText('Showing 0 of 0')).toHaveLength(2);
});

test('should search and render matching columns', async () => {
  render(<DatasourcePanel {...props} />, { useRedux: true, useDnd: true });
  const searchInput = screen.getByPlaceholderText('Search Metrics & Columns');

  search(columns[0].column_name, searchInput);

  await waitFor(() => {
    expect(screen.getByText(columns[0].column_name)).toBeInTheDocument();
    expect(screen.queryByText(columns[1].column_name)).not.toBeInTheDocument();
  });
});

test('should search and render matching metrics', async () => {
  render(<DatasourcePanel {...props} />, { useRedux: true, useDnd: true });
  const searchInput = screen.getByPlaceholderText('Search Metrics & Columns');

  search(metrics[0].metric_name, searchInput);

  await waitFor(() => {
    expect(screen.getByText(metrics[0].metric_name)).toBeInTheDocument();
    expect(screen.queryByText(metrics[1].metric_name)).not.toBeInTheDocument();
  });
});

test('should render a warning', async () => {
  const deprecatedDatasource = {
    ...datasource,
    extra: JSON.stringify({ warning_markdown: 'This is a warning.' }),
  };
  const newProps = {
    ...props,
    datasource: deprecatedDatasource,
    controls: {
      datasource: {
        ...props.controls.datasource,
        datasource: deprecatedDatasource,
        user: mockUser,
      },
    },
  };
  render(<DatasourcePanel {...newProps} />, { useRedux: true, useDnd: true });
  expect(
    await screen.findByRole('img', { name: 'alert-solid' }),
  ).toBeInTheDocument();
});

test('should render a create dataset infobox', async () => {
  const newProps = {
    ...props,
    datasource: {
      ...datasource,
      type: DatasourceType.Query,
    },
  };
  render(<DatasourcePanel {...newProps} />, { useRedux: true, useDnd: true });

  const createButton = await screen.findByRole('button', {
    name: /create a dataset/i,
  });
  const infoboxText = screen.getByText(/to edit or add columns and metrics./i);

  expect(createButton).toBeVisible();
  expect(infoboxText).toBeVisible();
});

test('should not render a save dataset modal when datasource is not query or dataset', async () => {
  const newProps = {
    ...props,
    datasource: {
      ...datasource,
      type: DatasourceType.Table,
    },
  };
  render(<DatasourcePanel {...newProps} />, { useRedux: true, useDnd: true });
  expect(await screen.findByText(/metrics/i)).toBeInTheDocument();

  expect(screen.queryByText(/create a dataset/i)).toBe(null);
});
