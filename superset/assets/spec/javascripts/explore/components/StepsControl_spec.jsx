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
/* eslint-disable no-unused-expressions */
import React from 'react';
import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import { shallow } from 'enzyme';
import { ListGroupItem } from 'react-bootstrap';

import chartQueries from '../../dashboard/fixtures/mockChartQueries';
import StepsControl from '../../../../src/explore/components/controls/StepsControl';
import Button from '../../../../src/components/Button';

describe('StepsControl', () => {
  const middlewares = [thunk];
  const mockStore = configureStore(middlewares);
  const initialState = {
    charts: { 0: {} },
    explore: {
      can_overwrite: null,
      user_id: '1',
      datasource: {},
      slice: null,
      controls: {
        viz_type: {
          value: 'funnel',
        },
      },
    },
    selectedValues: {},
  };
  const store = mockStore(initialState);

  const defaultProps = {
    name: 'steps',
    label: 'Steps',
    value: {},
    origSelectedValues: {},
    vizType: '',
    annotationError: {},
    annotationQuery: {},
    onChange: () => {},
    charts: chartQueries,
  };

  const getWrapper = () =>
    shallow(<StepsControl {...defaultProps} />, {
      context: { store },
    }).dive();

  it('renders Add Step button and Absolute filter', () => {
    const wrapper = getWrapper();
    expect(wrapper.find(ListGroupItem)).toHaveLength(1);
  });

  it('add/remove Step', () => {
    const wrapper = getWrapper();
    const label = wrapper.find(ListGroupItem).first();
    label.simulate('click');
    setTimeout(() => {
      expect(wrapper.find('.list-group')).toHaveLength(1);
      expect(wrapper.find('.metrics-select')).toHaveLength(2);
      expect(wrapper.find(Button)).toHaveLength(1);
      expect(wrapper.find(Button)).first().simulate('click');
      setTimeout(() => {
        expect(wrapper.find('list-group')).toHaveLength(0);
      }, 10);
    }, 10);
  });

  it('onChange', () => {
    const wrapper = getWrapper();

    wrapper.instance().onChange(0, 'testControl', { test: true });
    expect(wrapper.state().selectedValues).toMatchObject({ 0: { testControl: { test: true } } });

  });
});
