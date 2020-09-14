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
import Button from 'src/components/Button';
import { shallow } from 'enzyme';
import sinon from 'sinon';

import Select from 'src/components/Select';
import QuerySearch from 'src/SqlLab/components/QuerySearch';

describe('QuerySearch', () => {
  const search = sinon.spy(QuerySearch.prototype, 'refreshQueries');
  const mockedProps = {
    actions: {},
    height: 0,
  };
  it('is valid', () => {
    expect(React.isValidElement(<QuerySearch {...mockedProps} />)).toBe(true);
  });
  let wrapper;
  beforeEach(() => {
    wrapper = shallow(<QuerySearch {...mockedProps} />);
  });

  it('should have three Select', () => {
    expect(wrapper.findWhere(x => x.type() === Select)).toHaveLength(3);
  });

  it('updates fromTime on user selects from time', () => {
    wrapper.find('[name="select-from"]').simulate('change', { value: 0 });
    expect(wrapper.state().from).toBe(0);
  });

  it('updates toTime on user selects to time', () => {
    wrapper.find('[name="select-to"]').simulate('change', { value: 0 });
    expect(wrapper.state().to).toBe(0);
  });

  it('updates status on user selects status', () => {
    wrapper
      .find('[name="select-status"]')
      .simulate('change', { value: 'success' });
    expect(wrapper.state().status).toBe('success');
  });

  it('should have one input for searchText', () => {
    expect(wrapper.find('input')).toExist();
  });

  it('updates search text on user inputs search text', () => {
    wrapper.find('input').simulate('change', { target: { value: 'text' } });
    expect(wrapper.state().searchText).toBe('text');
  });

  it('refreshes queries when enter (only) is pressed on the input', () => {
    const { callCount } = search;
    wrapper.find('input').simulate('keyDown', { keyCode: 'a'.charCodeAt(0) });
    expect(search.callCount).toBe(callCount);
    wrapper.find('input').simulate('keyDown', { keyCode: '\r'.charCodeAt(0) });
    expect(search.callCount).toBe(callCount + 1);
  });

  it('should have one Button', () => {
    expect(wrapper.find(Button)).toExist();
  });

  it('refreshes queries when clicked', () => {
    const { callCount } = search;
    wrapper.find(Button).simulate('click');
    expect(search.callCount).toBe(callCount + 1);
  });
});
