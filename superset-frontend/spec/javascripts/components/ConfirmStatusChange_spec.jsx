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
import Button from 'src/components/Button';
import { supersetTheme, ThemeProvider } from '@superset-ui/core';
import ConfirmStatusChange from 'src/components/ConfirmStatusChange';
import Modal from 'src/common/components/Modal';

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
          <Button id="btn1" onClick={confirm} />
        </>
      )}
    </ConfirmStatusChange>,
    {
      wrappingComponent: ThemeProvider,
      wrappingComponentProps: { theme: supersetTheme },
    },
  );

  it('opens a confirm modal', () => {
    wrapper.find('#btn1').first().props().onClick('foo');

    wrapper.update();

    expect(wrapper.find(Modal)).toExist();
  });

  it('calls the function on confirm', () => {
    wrapper.find(Button).last().props().onClick();

    expect(mockedProps.onConfirm).toHaveBeenCalledWith('foo');
  });
});
