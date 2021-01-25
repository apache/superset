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
import { Alert } from 'react-bootstrap';
import React from 'react';
import { mount } from 'enzyme';
import Toast from 'src/messageToasts/components/Toast';
import { act } from 'react-dom/test-utils';
import mockMessageToasts from '../mockMessageToasts';

const props = {
  toast: mockMessageToasts[0],
  onCloseToast() {},
};

const setup = overrideProps => mount(<Toast {...props} {...overrideProps} />);

describe('Toast', () => {
  it('should render an Alert', () => {
    const wrapper = setup();
    expect(wrapper.find(Alert)).toExist();
  });

  it('should render toastText within the alert', () => {
    const wrapper = setup();
    const alert = wrapper.find(Alert);

    expect(alert.childAt(0).childAt(1).text()).toBe(props.toast.text);
  });

  it('should call onCloseToast upon alert dismissal', async () => {
    await act(
      () =>
        new Promise(done => {
          const onCloseToast = id => {
            expect(id).toBe(props.toast.id);
            done();
          };

          const wrapper = setup({ onCloseToast });
          const handleClosePress = wrapper.find('[label="Close alert"]').props()
            .onClick;

          const alertProps = wrapper.find(Alert).props();
          expect(alertProps.onDismiss).toBe(handleClosePress);
          handleClosePress(); // there is a timeout for onCloseToast to be called
        }),
    );
  });
});
