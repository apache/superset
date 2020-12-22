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

import App from 'src/SqlLab/components/App';
import TabbedSqlEditors from 'src/SqlLab/components/TabbedSqlEditors';
import sqlLabReducer from 'src/SqlLab/reducers/index';

describe('SqlLab App', () => {
  const middlewares = [thunk];
  const mockStore = configureStore(middlewares);
  const store = mockStore(sqlLabReducer(undefined, {}), {});
  let wrapper;

  beforeEach(() => {
    wrapper = shallow(<App store={store} />).dive();
  });

  it('is valid', () => {
    expect(React.isValidElement(<App />)).toBe(true);
  });

  it('should render', () => {
    const inner = wrapper.dive();
    expect(inner.find('.SqlLab')).toHaveLength(1);
    expect(inner.find(TabbedSqlEditors)).toHaveLength(1);
  });
});
