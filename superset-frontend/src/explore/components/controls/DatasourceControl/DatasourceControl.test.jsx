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
import configureStore from 'redux-mock-store';
import { DatasourceType } from '@superset-ui/core';
import {
  fireEvent,
  waitFor,
  screen,
  render,
} from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import DatasourceControl, {
  getDatasourceTitle,
} from 'src/explore/components/controls/DatasourceControl';

const defaultProps = {
  name: 'datasource',
  label: 'Dataset',
  value: '1__table',
  datasource: {
    name: 'birth_names',
    type: 'table',
    uid: '1__table',
    id: 1,
    columns: [],
    metrics: [],
    owners: [{ username: 'admin', userId: 1 }],
    database: {
      backend: 'mysql',
      name: 'main',
    },
    health_check_message: 'Warning message!',
  },
  actions: {
    setDatasource: jest.fn(),
  },
  onChange: jest.fn(),
  user: {
    createdOn: '2021-04-27T18:12:38.952304',
    email: 'admin',
    firstName: 'admin',
    isActive: true,
    lastName: 'admin',
    permissions: {},
    roles: { Admin: Array(173) },
    userId: 1,
    username: 'admin',
  },
};

describe('DatasourceControl', () => {
  const setup = (overrideProps = {}) => {
    const mockStore = configureStore([]);
    const store = mockStore({});
    const props = {
      ...defaultProps,
      ...overrideProps,
    };
    return {
      rendered: render(<DatasourceControl {...props} />, {
        useRedux: true,
        useRouter: true,
        store,
      }),
      store,
      props,
    };
  };

  it('should not render Modal', () => {
    setup();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should not render ChangeDatasourceModal', () => {
    setup();
    expect(screen.queryByTestId('Swap dataset-modal')).not.toBeInTheDocument();
  });

  it('show or hide Edit Datasource option', async () => {
    const {
      rendered: { container, rerender },
      store,
      props,
    } = setup();
    expect(
      container.querySelector('[data-test="datasource-menu-trigger"]'),
    ).toBeInTheDocument();
    userEvent.click(screen.getByLabelText('more-vert'));
    await waitFor(() => {
      expect(screen.queryAllByRole('menuitem')).toHaveLength(3);
    });

    rerender(<DatasourceControl {...{ ...props, isEditable: false }} />, {
      useRedux: true,
      useRouter: true,
      store,
    });
    expect(
      container.querySelector('[data-test="datasource-menu-trigger"]'),
    ).toBeInTheDocument();
    userEvent.click(screen.getByLabelText('more-vert'));
    await waitFor(() => {
      expect(screen.queryAllByRole('menuitem')).toHaveLength(2);
    });
  });

  it('should render health check message', async () => {
    setup();
    const modalTrigger = screen.getByLabelText('alert-solid');
    expect(modalTrigger).toBeInTheDocument();

    // Hover the modal so healthcheck message can show up
    fireEvent.mouseOver(modalTrigger);
    await waitFor(() => {
      expect(
        screen.getByText(defaultProps.datasource.health_check_message),
      ).toBeInTheDocument();
    });
  });

  it('Gets Datasource Title', () => {
    const sql = 'This is the sql';
    const name = 'this is a name';
    const emptyResult = '';
    const queryDatasource1 = { type: DatasourceType.Query, sql };
    let displayText = getDatasourceTitle(queryDatasource1);
    expect(displayText).toBe(sql);
    const queryDatasource2 = { type: DatasourceType.Query, sql: null };
    displayText = getDatasourceTitle(queryDatasource2);
    expect(displayText).toBe(null);
    const queryDatasource3 = { type: 'random type', name };
    displayText = getDatasourceTitle(queryDatasource3);
    expect(displayText).toBe(name);
    const queryDatasource4 = { type: 'random type' };
    displayText = getDatasourceTitle(queryDatasource4);
    expect(displayText).toBe(emptyResult);
    displayText = getDatasourceTitle();
    expect(displayText).toBe(emptyResult);
    displayText = getDatasourceTitle(null);
    expect(displayText).toBe(emptyResult);
    displayText = getDatasourceTitle('I should not be a string');
    expect(displayText).toBe(emptyResult);
    displayText = getDatasourceTitle([]);
    expect(displayText).toBe(emptyResult);
  });
});
