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
import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import { shallow } from 'enzyme';
import SouthPaneContainer, { SouthPane } from 'src/SqlLab/components/SouthPane';
import ResultSet from 'src/SqlLab/components/ResultSet';
import { STATUS_OPTIONS } from 'src/SqlLab/constants';
import { initialState } from './fixtures';

describe('SouthPane', () => {
  const middlewares = [thunk];
  const mockStore = configureStore(middlewares);
  const store = mockStore(initialState);

  const mockedProps = {
    editorQueries: [
      {
        cached: false,
        changedOn: Date.now(),
        db: 'main',
        dbId: 1,
        id: 'LCly_kkIN',
        startDttm: Date.now(),
      },
      {
        cached: false,
        changedOn: 1559238500401,
        db: 'main',
        dbId: 1,
        id: 'lXJa7F9_r',
        startDttm: 1559238500401,
      },
      {
        cached: false,
        changedOn: 1559238506925,
        db: 'main',
        dbId: 1,
        id: '2g2_iRFMl',
        startDttm: 1559238506925,
      },
      {
        cached: false,
        changedOn: 1559238516395,
        db: 'main',
        dbId: 1,
        id: 'erWdqEWPm',
        startDttm: 1559238516395,
      },
    ],
    latestQueryId: 'LCly_kkIN',
    dataPreviewQueries: [],
    actions: {},
    activeSouthPaneTab: '',
    height: 1,
    databases: {},
    offline: false,
  };

  const getWrapper = () =>
    shallow(<SouthPaneContainer {...mockedProps} />, {
      context: { store },
    }).dive();

  let wrapper;

  beforeAll(() => {
    jest
      .spyOn(SouthPane.prototype, 'getSouthPaneHeight')
      .mockImplementation(() => 500);
  });

  it('should render offline when the state is offline', () => {
    wrapper = getWrapper();
    wrapper.setProps({ offline: true });
    expect(wrapper.find('.m-r-3').render().text()).toBe(STATUS_OPTIONS.offline);
  });
  it('should pass latest query down to ResultSet component', () => {
    wrapper = getWrapper();
    expect(wrapper.find(ResultSet)).toHaveLength(1);
    expect(wrapper.find(ResultSet).props().query.id).toEqual(
      mockedProps.latestQueryId,
    );
  });
});
