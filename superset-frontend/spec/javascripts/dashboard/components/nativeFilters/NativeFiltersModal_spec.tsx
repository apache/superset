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
import { styledMount as mount } from 'spec/helpers/theming';
import { act } from 'react-dom/test-utils';
import { Provider } from 'react-redux';
import { FilterConfigModal } from 'src/dashboard/components/nativeFilters/FilterConfigModal';
import waitForComponentToPaint from 'spec/helpers/waitForComponentToPaint';
import { mockStore } from 'spec/fixtures/mockStore';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

describe('FiltersConfigModal', () => {
  const mockedProps = {
    isOpen: true,
    initialFilterId: 'DefaultFilterId',
    createNewOnOpen: true,
    onCancel: jest.fn(),
    save: jest.fn(),
  };
  function setup(overridesProps?: any) {
    return mount(
      <Provider store={mockStore}>
        <FilterConfigModal {...mockedProps} {...overridesProps} />
      </Provider>,
    );
  }

  it('should be a valid react element', () => {
    expect(React.isValidElement(<FilterConfigModal {...mockedProps} />)).toBe(
      true,
    );
  });

  it('the form validates required fields', async () => {
    const onSave = jest.fn();
    const wrapper = setup({ save: onSave });
    act(() => {
      wrapper
        .find('input')
        .first()
        .simulate('change', { target: { value: 'test name' } });

      wrapper.find('.ant-modal-footer button').at(1).simulate('click');
    });
    await waitForComponentToPaint(wrapper);
    expect(onSave.mock.calls).toHaveLength(0);
  });
});
