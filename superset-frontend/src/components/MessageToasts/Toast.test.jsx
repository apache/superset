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
import { ThemeProvider, supersetTheme } from '@superset-ui/core';
import Toast from 'src/components/MessageToasts/Toast';
import { act } from 'react-dom/test-utils';
import mockMessageToasts from './mockMessageToasts';

jest.mock('src/components/Icons/Icon', () => () => <span />);

const props = {
  toast: mockMessageToasts[0],
  onCloseToast() {},
};

const setup = overrideProps =>
  mount(<Toast {...props} {...overrideProps} />, {
    wrappingComponent: ThemeProvider,
    wrappingComponentProps: { theme: supersetTheme },
  });

describe('Toast', () => {
  it('should render', () => {
    const wrapper = setup();
    expect(wrapper.find('[data-test="toast-container"]')).toExist();
  });

  it('should render toastText within the div', () => {
    const wrapper = setup();
    const container = wrapper.find('[data-test="toast-container"]');
    expect(container.hostNodes().childAt(1).text()).toBe(props.toast.text);
  });

  it('should call onCloseToast upon toast dismissal', async () =>
    act(
      () =>
        new Promise(done => {
          const onCloseToast = id => {
            expect(id).toBe(props.toast.id);
            done();
          };

          const wrapper = setup({ onCloseToast });
          wrapper.find('[data-test="close-button"]').props().onClick();
        }),
    ));
});
