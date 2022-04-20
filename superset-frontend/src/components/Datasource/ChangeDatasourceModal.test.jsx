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
import { mount } from 'enzyme';
import configureStore from 'redux-mock-store';
import fetchMock from 'fetch-mock';
import thunk from 'redux-thunk';
import { act } from 'react-dom/test-utils';
import sinon from 'sinon';
import { supersetTheme, ThemeProvider } from '@superset-ui/core';
import Modal from 'src/components/Modal';
import { ChangeDatasourceModal } from 'src/components/Datasource';
import waitForComponentToPaint from 'spec/helpers/waitForComponentToPaint';
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
const DATASOURCE_ENDPOINT = `glob:*/datasource/get/${datasourceData.type}/${datasourceData.id}`;
const DATASOURCE_PAYLOAD = { new: 'data' };

const INFO_ENDPOINT = 'glob:*/api/v1/dataset/_info?*';

fetchMock.get(DATASOURCES_ENDPOINT, { result: [mockDatasource['7__table']] });
fetchMock.get(DATASOURCE_ENDPOINT, DATASOURCE_PAYLOAD);
fetchMock.get(INFO_ENDPOINT, {});

async function mountAndWait(props = mockedProps) {
  const mounted = mount(<ChangeDatasourceModal store={store} {...props} />, {
    wrappingComponent: ThemeProvider,
    wrappingComponentProps: { theme: supersetTheme },
  });
  await waitForComponentToPaint(mounted);

  return mounted;
}

describe('ChangeDatasourceModal', () => {
  let wrapper;

  beforeEach(async () => {
    wrapper = await mountAndWait();
  });

  it('renders', () => {
    expect(wrapper.find(ChangeDatasourceModal)).toHaveLength(1);
  });

  it('renders a Modal', () => {
    expect(wrapper.find(Modal)).toExist();
  });

  it('fetches datasources', async () => {
    expect(fetchMock.calls(INFO_ENDPOINT)).toHaveLength(3);
  });

  it('renders confirmation message', async () => {
    await waitForComponentToPaint(wrapper, 1000);

    act(() => {
      wrapper.find('[data-test="datasource-link"]').at(0).props().onClick();
    });

    await waitForComponentToPaint(wrapper);

    expect(wrapper.find('.proceed-btn')).toExist();
  });

  it('changes the datasource', async () => {
    await waitForComponentToPaint(wrapper, 1000);

    act(() => {
      wrapper.find('[data-test="datasource-link"]').at(0).props().onClick();
    });
    await waitForComponentToPaint(wrapper);

    act(() => {
      wrapper.find('.proceed-btn').at(0).props().onClick(datasourceData);
    });
    await waitForComponentToPaint(wrapper);

    expect(fetchMock.calls(/datasource\/get\/table\/7/)).toHaveLength(1);
  });
});
