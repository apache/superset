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
import sinon from 'sinon';
import { shallow } from 'enzyme';
import { OverlayTrigger } from 'react-bootstrap';

import FilterBoxItemControl from '../../../../src/explore/components/controls/FilterBoxItemControl';
import FormRow from '../../../../src/components/FormRow';
import datasources from '../../../fixtures/mockDatasource';

const defaultProps = {
  datasource: datasources['7__table'],
  onChange: sinon.spy(),
};

describe('FilterBoxItemControl', () => {
  let wrapper;
  let inst;

  const getWrapper = (propOverrides) => {
    const props = { ...defaultProps, ...propOverrides };
    return shallow(<FilterBoxItemControl {...props} />);
  };
  beforeEach(() => {
    wrapper = getWrapper();
    inst = wrapper.instance();
  });

  it('renders an OverlayTrigger', () => {
    expect(wrapper.find(OverlayTrigger)).toHaveLength(1);
  });

  it('renderForms does the job', () => {
    const popover = shallow(inst.renderForm());
    expect(popover.find(FormRow)).toHaveLength(7);
  });
});
