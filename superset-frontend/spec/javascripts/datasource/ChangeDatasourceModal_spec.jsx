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
import { Modal } from 'react-bootstrap';
import configureStore from 'redux-mock-store';
import fetchMock from 'fetch-mock';
import thunk from 'redux-thunk';
import sinon from 'sinon';
import { supersetTheme, ThemeProvider } from '@superset-ui/style';
import { act } from 'react-dom/test-utils';

import ChangeDatasourceModal from 'src/datasource/ChangeDatasourceModal';
import waitForComponentToPaint from 'spec/helpers/waitForComponentToPaint';
import mockDatasource from '../../fixtures/mockDatasource';

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

const DATASOURCES_ENDPOINT = 'glob:*/superset/datasources/';
const DATASOURCE_ENDPOINT = `glob:*/datasource/get/${datasourceData.type}/${datasourceData.id}`;
const DATASOURCE_PAYLOAD = { new: 'data' };

fetchMock.get(DATASOURCES_ENDPOINT, [mockDatasource['7__table']]);
fetchMock.get(DATASOURCE_ENDPOINT, DATASOURCE_PAYLOAD);

async function mountAndWait(props = mockedProps) {
  const mounted = mount(<ChangeDatasourceModal {...props} />, {
    context: { store },
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
    expect(fetchMock.calls(/superset\/datasources/)).toHaveLength(3);
  });

  it('changes the datasource', async () => {
    act(() => {
      wrapper.find('.datasource-link').at(0).props().onClick(datasourceData);
    });
    await waitForComponentToPaint(wrapper);
    expect(fetchMock.calls(/datasource\/get\/table\/7/)).toHaveLength(1);
  });
});
