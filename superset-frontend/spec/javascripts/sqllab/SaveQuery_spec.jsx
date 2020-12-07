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
import { FormControl } from 'react-bootstrap';
import { shallow } from 'enzyme';
import * as sinon from 'sinon';
import SaveQuery from 'src/SqlLab/components/SaveQuery';
import Modal from 'src/common/components/Modal';
import Button from 'src/components/Button';

describe('SavedQuery', () => {
  const mockedProps = {
    query: {
      dbId: 1,
      schema: 'main',
      sql: 'SELECT * FROM t',
    },
    defaultLabel: 'untitled',
    animation: false,
  };
  it('is valid', () => {
    expect(React.isValidElement(<SaveQuery />)).toBe(true);
  });
  it('is valid with props', () => {
    expect(React.isValidElement(<SaveQuery {...mockedProps} />)).toBe(true);
  });
  it('has a Modal', () => {
    const wrapper = shallow(<SaveQuery {...mockedProps} />);
    expect(wrapper.find(Modal)).toExist();
  });
  it('has a cancel button', () => {
    const wrapper = shallow(<SaveQuery {...mockedProps} />);
    const modal = wrapper.find(Modal);

    expect(modal.find('[data-test="cancel-query"]')).toHaveLength(1);
  });
  it('has 2 FormControls', () => {
    const wrapper = shallow(<SaveQuery {...mockedProps} />);
    const modal = wrapper.find(Modal);

    expect(modal.find(FormControl)).toHaveLength(2);
  });
  it('has a save button if this is a new query', () => {
    const saveSpy = sinon.spy();
    const wrapper = shallow(<SaveQuery {...mockedProps} onSave={saveSpy} />);
    const modal = wrapper.find(Modal);

    expect(modal.find(Button)).toHaveLength(2);
    modal.find(Button).at(0).simulate('click');
    expect(saveSpy.calledOnce).toBe(true);
  });
  it('has an update button if this is an existing query', () => {
    const updateSpy = sinon.spy();
    const props = {
      ...mockedProps,
      query: {
        ...mockedProps.query,
        remoteId: '42',
      },
    };
    const wrapper = shallow(<SaveQuery {...props} onUpdate={updateSpy} />);
    const modal = wrapper.find(Modal);

    expect(modal.find(Button)).toHaveLength(3);
    modal.find(Button).at(0).simulate('click');
    expect(updateSpy.calledOnce).toBe(true);
  });
});
