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
  act,
  render,
  screen,
  waitFor,
  fireEvent,
  cleanup,
  defaultStore as store,
} from 'spec/helpers/testing-library';
import fetchMock from 'fetch-mock';
import sinon from 'sinon';
import { SupersetClient } from '@superset-ui/core';
import { DatasourceModal } from 'src/components/Datasource';
import mockDatasource from 'spec/fixtures/mockDatasource';

// Define your constants here
const SAVE_ENDPOINT = 'glob:*/api/v1/dataset/7';
const SAVE_PAYLOAD = { new: 'data' };
const SAVE_DATASOURCE_ENDPOINT = 'glob:*/api/v1/dataset/7';
const GET_DATASOURCE_ENDPOINT = SAVE_DATASOURCE_ENDPOINT;
const GET_DATABASE_ENDPOINT = 'glob:*/api/v1/database/?q=*';

const mockedProps = {
  datasource: mockDatasource['7__table'],
  addSuccessToast: () => {},
  addDangerToast: () => {},
  onChange: () => {},
  onHide: () => {},
  show: true,
  onDatasourceSave: sinon.spy(),
};

let container;

async function renderAndWait(props = mockedProps) {
  const { container: renderedContainer } = render(
    <DatasourceModal {...props} />,
    { store },
  );

  container = renderedContainer;
}

beforeEach(() => {
  fetchMock.reset();
  cleanup();
  renderAndWait();
  fetchMock.post(SAVE_ENDPOINT, SAVE_PAYLOAD);
  fetchMock.put(SAVE_DATASOURCE_ENDPOINT, {});
  fetchMock.get(GET_DATASOURCE_ENDPOINT, { result: {} });
  fetchMock.get(GET_DATABASE_ENDPOINT, { result: [] });
});

describe('DatasourceModal', () => {
  it('renders', async () => {
    expect(container).toBeDefined();
  });

  it('renders the component', () => {
    expect(screen.getByText('Edit Dataset')).toBeInTheDocument();
  });

  it('renders a Modal', async () => {
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('renders a DatasourceEditor', async () => {
    expect(screen.getByTestId('datasource-editor')).toBeInTheDocument();
  });

  it('disables the save button when the datasource is managed externally', () => {
    // the render is currently in a before operation, so it needs to be cleaned up
    // we could alternatively move all the renders back into the tests or find a better
    // way to automatically render but still allow to pass in props with the tests
    cleanup();

    renderAndWait({
      ...mockedProps,
      datasource: { ...mockedProps.datasource, is_managed_externally: true },
    });
    const saveButton = screen.getByTestId('datasource-modal-save');
    expect(saveButton).toBeDisabled();
  });

  it('calls the onDatasourceSave function when the save button is clicked', async () => {
    cleanup();
    const onDatasourceSave = jest.fn();

    renderAndWait({ ...mockedProps, onDatasourceSave });
    const saveButton = screen.getByTestId('datasource-modal-save');
    await act(async () => {
      fireEvent.click(saveButton);
      const okButton = await screen.findByRole('button', { name: 'OK' });
      okButton.click();
    });
    await waitFor(() => {
      expect(onDatasourceSave).toHaveBeenCalled();
    });
  });

  it('should render error dialog', async () => {
    jest
      .spyOn(SupersetClient, 'put')
      .mockRejectedValue(new Error('Something went wrong'));
    await act(async () => {
      const saveButton = screen.getByTestId('datasource-modal-save');
      fireEvent.click(saveButton);
      const okButton = await screen.findByRole('button', { name: 'OK' });
      okButton.click();
    });
    await act(async () => {
      const errorTitle = await screen.findByText('Error saving dataset');
      expect(errorTitle).toBeInTheDocument();
    });
  });
});
