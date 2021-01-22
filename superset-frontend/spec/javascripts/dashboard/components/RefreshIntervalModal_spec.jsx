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

import ModalTrigger from 'src/components/ModalTrigger';
import RefreshIntervalModal from 'src/dashboard/components/RefreshIntervalModal';
import { Alert } from 'react-bootstrap';
import { supersetTheme, ThemeProvider } from '@superset-ui/core';

const getMountWrapper = props =>
  mount(<RefreshIntervalModal {...props} />, {
    wrappingComponent: ThemeProvider,
    wrappingComponentProps: {
      theme: supersetTheme,
    },
  });

describe('RefreshIntervalModal', () => {
  const mockedProps = {
    triggerNode: <i className="fa fa-edit" />,
    refreshFrequency: 10,
    onChange: jest.fn(),
    editMode: true,
  };
  it('is valid', () => {
    expect(
      React.isValidElement(<RefreshIntervalModal {...mockedProps} />),
    ).toBe(true);
  });
  it('renders the trigger node', () => {
    const wrapper = getMountWrapper(mockedProps);
    expect(wrapper.find('.fa-edit')).toExist();
  });
  it('should render a interval seconds', () => {
    const wrapper = getMountWrapper(mockedProps);
    expect(wrapper.prop('refreshFrequency')).toEqual(10);
  });
  it('should change refreshFrequency with edit mode', () => {
    const wrapper = getMountWrapper(mockedProps);
    wrapper.instance().handleFrequencyChange({ value: 30 });
    wrapper.instance().onSave();
    expect(mockedProps.onChange).toHaveBeenCalled();
    expect(mockedProps.onChange).toHaveBeenCalledWith(30, mockedProps.editMode);
  });
  it('should show warning message', () => {
    const props = {
      ...mockedProps,
      refreshLimit: 3600,
      refreshWarning: 'Show warning',
    };

    const wrapper = getMountWrapper(props);
    wrapper.find('span[role="button"]').simulate('click');

    wrapper.instance().handleFrequencyChange({ value: 30 });
    wrapper.update();
    expect(wrapper.find(ModalTrigger).find(Alert)).toExist();

    wrapper.instance().handleFrequencyChange({ value: 3601 });
    wrapper.update();
    expect(wrapper.find(ModalTrigger).find(Alert)).not.toExist();
  });
});
