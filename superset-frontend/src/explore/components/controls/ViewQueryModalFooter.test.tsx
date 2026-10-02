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
import { ComponentProps } from 'react';
import { useLocation } from 'react-router-dom';
import { SupersetClient } from '@superset-ui/core';
import {
  fireEvent,
  render,
  screen,
  userEvent,
} from 'spec/helpers/testing-library';
import ViewQueryModalFooter from './ViewQueryModalFooter';

type FooterDatasource = NonNullable<
  ComponentProps<typeof ViewQueryModalFooter>['datasource']
>;

const datasource: FooterDatasource = {
  id: '7',
  type: 'table',
  sql: 'SELECT 1',
};

const setup = () => {
  const closeModal = jest.fn();
  const changeDatasource = jest.fn();
  // Reads the router location (not the raw window.history entry) so the
  // assertion does not depend on how the history library serializes state.
  const location: { current?: ReturnType<typeof useLocation> } = {};
  const LocationProbe = () => {
    location.current = useLocation();
    return null;
  };
  render(
    <>
      <ViewQueryModalFooter
        closeModal={closeModal}
        changeDatasource={changeDatasource}
        datasource={datasource}
      />
      <LocationProbe />
    </>,
    { useRouter: true },
  );
  return { closeModal, changeDatasource, location };
};

beforeEach(() => {
  window.history.replaceState(null, '', '/explore/');
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('renders the footer actions', () => {
  setup();
  expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Save as Dataset' }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Open in SQL Lab' }),
  ).toBeInTheDocument();
});

test('Open in SQL Lab navigates in-app with the requested query', async () => {
  const postForm = jest
    .spyOn(SupersetClient, 'postForm')
    .mockResolvedValue(undefined);
  const { location } = setup();
  await userEvent.click(
    screen.getByRole('button', { name: 'Open in SQL Lab' }),
  );
  expect(window.location.pathname).toBe('/sqllab');
  expect(location.current?.pathname).toBe('/sqllab');
  expect(location.current?.state).toEqual({
    requestedQuery: { datasourceKey: '7__table', sql: 'SELECT 1' },
  });
  expect(postForm).not.toHaveBeenCalled();
});

test('meta-click on Open in SQL Lab posts a form to open a new tab', async () => {
  const postForm = jest
    .spyOn(SupersetClient, 'postForm')
    .mockResolvedValue(undefined);
  setup();
  fireEvent.click(screen.getByRole('button', { name: 'Open in SQL Lab' }), {
    metaKey: true,
  });
  expect(postForm).toHaveBeenCalledWith('/sqllab/', {
    datasourceKey: '7__table',
    sql: 'SELECT 1',
  });
  expect(window.location.pathname).toBe('/explore/');
});

test('Close only closes the modal', async () => {
  const { closeModal, changeDatasource } = setup();
  await userEvent.click(screen.getByRole('button', { name: 'Close' }));
  expect(closeModal).toHaveBeenCalledTimes(1);
  expect(changeDatasource).not.toHaveBeenCalled();
});

test('Save as Dataset closes the modal and starts the dataset flow', async () => {
  const { closeModal, changeDatasource } = setup();
  await userEvent.click(
    screen.getByRole('button', { name: 'Save as Dataset' }),
  );
  expect(closeModal).toHaveBeenCalledTimes(1);
  expect(changeDatasource).toHaveBeenCalledTimes(1);
});
