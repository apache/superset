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
import { Modal, Button } from 'react-bootstrap';
import ConfirmStatusChange from 'src/components/ConfirmStatusChange';

describe('ConfirmStatusChange', () => {
  const mockedProps = {
    title: 'please confirm',
    description: 'are you sure?',
    onConfirm: jest.fn(),
  };
  const wrapper = mount(
    <ConfirmStatusChange {...mockedProps}>
      {confirm => (
        <>
          <button id="btn1" onClick={confirm} />
        </>
      )}
    </ConfirmStatusChange>,
  );

  it('opens a confirm modal', () => {
    wrapper.find('#btn1').props().onClick('foo');

    wrapper.update();

    expect(wrapper.find(Modal).exists()).toBeTruthy();
  });

  it('calls the function on confirm', () => {
    wrapper.find(Button).last().props().onClick();

    expect(mockedProps.onConfirm).toHaveBeenCalledWith('foo');
  });
});
