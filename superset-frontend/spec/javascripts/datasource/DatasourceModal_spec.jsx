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
import { act } from 'react-dom/test-utils';
import { Modal } from 'react-bootstrap';
import configureStore from 'redux-mock-store';
import { mount } from 'enzyme';
import fetchMock from 'fetch-mock';
import thunk from 'redux-thunk';
import sinon from 'sinon';
import { supersetTheme, ThemeProvider } from '@superset-ui/core';

import waitForComponentToPaint from 'spec/helpers/waitForComponentToPaint';
import DatasourceModal from 'src/datasource/DatasourceModal';
import DatasourceEditor from 'src/datasource/DatasourceEditor';
import * as featureFlags from 'src/featureFlags';
import mockDatasource from '../../fixtures/mockDatasource';

const mockStore = configureStore([thunk]);
const store = mockStore({});
const datasource = mockDatasource['7__table'];

const SAVE_ENDPOINT = 'glob:*/api/v1/dataset/7';
const SAVE_PAYLOAD = { new: 'data' };

const mockedProps = {
  datasource,
  addSuccessToast: () => {},
  addDangerToast: () => {},
  onChange: () => {},
  onHide: () => {},
  show: true,
  onDatasourceSave: sinon.spy(),
};

async function mountAndWait(props = mockedProps) {
  const mounted = mount(<DatasourceModal {...props} />, {
    context: { store },
    wrappingComponent: ThemeProvider,
    wrappingComponentProps: { theme: supersetTheme },
  });
  await waitForComponentToPaint(mounted);

  return mounted;
}

describe('DatasourceModal', () => {
  let wrapper;
  let isFeatureEnabledMock;
  beforeEach(async () => {
    isFeatureEnabledMock = jest
      .spyOn(featureFlags, 'isFeatureEnabled')
      .mockReturnValue(true);
    fetchMock.reset();
    wrapper = await mountAndWait();
  });

  afterAll(() => {
    isFeatureEnabledMock.restore();
  });

  it('renders', () => {
    expect(wrapper.find(DatasourceModal)).toExist();
  });

  it('renders a Modal', () => {
    expect(wrapper.find(Modal)).toHaveLength(2);
  });

  it('renders a DatasourceEditor', () => {
    expect(wrapper.find(DatasourceEditor)).toExist();
  });

  it('saves on confirm', async () => {
    const callsP = fetchMock.post(SAVE_ENDPOINT, SAVE_PAYLOAD);
    act(() => {
      wrapper
        .find('button[data-test="datasource-modal-save"]')
        .props()
        .onClick();
    });
    await waitForComponentToPaint(wrapper);
    act(() => {
      const okButton = wrapper.find('[className="btn btn-sm btn-primary"]');
      okButton.simulate('click');
    });
    await waitForComponentToPaint(wrapper);
    const expected = ['http://localhost/datasource/save/'];
    expect(callsP._calls.map(call => call[0])).toEqual(
      expected,
    ); /* eslint no-underscore-dangle: 0 */
  });

  it('renders a legacy data source btn', () => {
    expect(
      wrapper.find('button[data-test="datasource-modal-legacy-edit"]'),
    ).toExist();
  });
});

describe('DatasourceModal without legacy data btn', () => {
  let wrapper;
  let isFeatureEnabledMock;
  beforeEach(async () => {
    isFeatureEnabledMock = jest
      .spyOn(featureFlags, 'isFeatureEnabled')
      .mockReturnValue(false);
    fetchMock.reset();
    wrapper = await mountAndWait();
  });

  afterAll(() => {
    isFeatureEnabledMock.restore();
  });

  it('hides legacy data source btn', () => {
    isFeatureEnabledMock = jest
      .spyOn(featureFlags, 'isFeatureEnabled')
      .mockReturnValue(false);
    expect(
      wrapper.find('button[data-test="datasource-modal-legacy-edit"]'),
    ).not.toExist();
  });
});
