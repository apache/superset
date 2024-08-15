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
import { waitFor, render, fireEvent } from 'spec/helpers/testing-library';
import configureStore from 'redux-mock-store';
import fetchMock from 'fetch-mock';
import thunk from 'redux-thunk';
import sinon from 'sinon';
import { ChangeDatasourceModal } from 'src/components/Datasource';
import mockDatasource from 'spec/fixtures/mockDatasource';

const mockStore = configureStore([thunk]);
const store = mockStore({});

const mockedProps = {
  addDangerToast: () => {},
  onDatasourceSave: sinon.spy(),
  onChange: () => {},
  onHide: () => {},
  show: true,
};

const datasource = mockDatasource['7__table'];
const datasourceData = {
  id: datasource.id,
  type: datasource.type,
  uid: datasource.id,
};

const DATASOURCES_ENDPOINT =
  'glob:*/api/v1/dataset/?q=(order_column:changed_on_delta_humanized,order_direction:desc,page:0,page_size:25)';
const DATASOURCE_ENDPOINT = `glob:*/api/v1/dataset/${datasourceData.id}`;
const DATASOURCE_PAYLOAD = { new: 'data' };

const INFO_ENDPOINT = 'glob:*/api/v1/dataset/_info?*';

fetchMock.get(DATASOURCES_ENDPOINT, { result: [mockDatasource['7__table']] });
fetchMock.get(DATASOURCE_ENDPOINT, DATASOURCE_PAYLOAD);
fetchMock.get(INFO_ENDPOINT, {});

afterEach(() => {
  fetchMock.resetHistory();
});

const setup = (props = mockedProps) =>
  render(<ChangeDatasourceModal {...props} />, {
    useRedux: true,
    store,
  });

test('renders', () => {
  const { getByTestId } = setup();
  expect(getByTestId('Swap dataset-modal')).toBeInTheDocument();
});

test('fetches datasources', async () => {
  setup();
  await waitFor(() => expect(fetchMock.calls(INFO_ENDPOINT)).toHaveLength(1));
});

test('renders confirmation message', async () => {
  const { findByTestId, getByRole } = setup();
  const confirmLink = await findByTestId('datasource-link');
  fireEvent.click(confirmLink);
  expect(getByRole('button', { name: 'Proceed' })).toBeInTheDocument();
});

test('changes the datasource', async () => {
  const { findByTestId, getByRole } = setup();
  const confirmLink = await findByTestId('datasource-link');
  fireEvent.click(confirmLink);
  const proceedButton = getByRole('button', { name: 'Proceed' });
  fireEvent.click(proceedButton);
  await waitFor(() =>
    expect(fetchMock.calls(/api\/v1\/dataset\/7/)).toHaveLength(1),
  );
});
