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
import sinon from 'sinon';

import sqlLabReducer from '../../../src/SqlLab/reducers/index';
import ExploreCtasResultsButton from '../../../src/SqlLab/components/ExploreCtasResultsButton';
import Button from '../../../src/components/Button';

describe('ExploreCtasResultsButton', () => {
  const middlewares = [thunk];
  const mockStore = configureStore(middlewares);
  const initialState = {
    sqlLab: {
      ...sqlLabReducer(undefined, {}),
    },
    common: {
      conf: { SUPERSET_WEBSERVER_TIMEOUT: 45 },
    },
  };
  const store = mockStore(initialState);
  const mockedProps = {
    table: 'dummy_table',
    schema: 'dummy_schema',
    dbId: 123,
  };
  const getExploreCtasResultsButtonWrapper = (props = mockedProps) =>
    shallow(<ExploreCtasResultsButton {...props} />, {
      context: { store },
    }).dive();

  it('renders', () => {
    expect(React.isValidElement(<ExploreCtasResultsButton />)).toBe(true);
  });

  it('renders with props', () => {
    expect(React.isValidElement(<s {...mockedProps} />)).toBe(true);
  });

  it('renders a Button', () => {
    const wrapper = getExploreCtasResultsButtonWrapper();
    expect(wrapper.find(Button)).toHaveLength(1);
  });

  describe('datasourceName', () => {
    it('should build viz options', () => {
      const wrapper = getExploreCtasResultsButtonWrapper();
      const spy = sinon.spy(wrapper.instance(), 'buildVizOptions');
      wrapper.instance().buildVizOptions();
      expect(spy.returnValues[0]).toEqual({
        schema: 'dummy_schema',
        dbId: 123,
        templateParams: undefined,
        datasourceName: 'dummy_table',
      });
    });
  });
});
