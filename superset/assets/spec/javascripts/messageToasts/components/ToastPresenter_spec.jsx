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
import { shallow } from 'enzyme';

import mockMessageToasts from '../mockMessageToasts';
import Toast from '../../../../src/messageToasts/components/Toast';
import ToastPresenter from '../../../../src/messageToasts/components/ToastPresenter';

describe('ToastPresenter', () => {
  const props = {
    toasts: mockMessageToasts,
    removeToast() {},
  };

  function setup(overrideProps) {
    const wrapper = shallow(<ToastPresenter {...props} {...overrideProps} />);
    return wrapper;
  }

  it('should render a div with class toast-presenter', () => {
    const wrapper = setup();
    expect(wrapper.find('.toast-presenter')).toHaveLength(1);
  });

  it('should render a Toast for each toast object', () => {
    const wrapper = setup();
    expect(wrapper.find(Toast)).toHaveLength(props.toasts.length);
  });

  it('should pass removeToast to the Toast component', () => {
    const removeToast = () => {};
    const wrapper = setup({ removeToast });
    expect(
      wrapper
        .find(Toast)
        .first()
        .prop('onCloseToast'),
    ).toBe(removeToast);
  });
});
