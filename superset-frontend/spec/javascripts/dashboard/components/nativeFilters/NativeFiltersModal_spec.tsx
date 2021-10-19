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
import { ReactWrapper } from 'enzyme';
import React from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { act } from 'react-dom/test-utils';
import { Provider } from 'react-redux';
import { mockStore } from 'spec/fixtures/mockStore';
import { styledMount as mount } from 'spec/helpers/theming';
import waitForComponentToPaint from 'spec/helpers/waitForComponentToPaint';
import Alert from 'src/components/Alert';
import { FiltersConfigModal } from 'src/dashboard/components/nativeFilters/FiltersConfigModal/FiltersConfigModal';

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

jest.mock('@superset-ui/core', () => ({
  // @ts-ignore
  ...jest.requireActual('@superset-ui/core'),
  getChartMetadataRegistry: () => ({
    items: {
      filter_select: {
        value: {
          datasourceCount: 1,
          behaviors: ['NATIVE_FILTER'],
        },
      },
    },
  }),
}));

describe('FiltersConfigModal', () => {
  const mockedProps = {
    isOpen: true,
    initialFilterId: 'DefaultsID',
    createNewOnOpen: true,
    onCancel: jest.fn(),
    onSave: jest.fn(),
  };
  function setup(overridesProps?: any) {
    return mount(
      <Provider store={mockStore}>
        <DndProvider backend={HTML5Backend}>
          <FiltersConfigModal {...mockedProps} {...overridesProps} />
        </DndProvider>
      </Provider>,
    );
  }

  it('should be a valid react element', () => {
    expect(React.isValidElement(<FiltersConfigModal {...mockedProps} />)).toBe(
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

  describe('when click cancel', () => {
    let onCancel: jest.Mock;
    let wrapper: ReactWrapper;

    beforeEach(() => {
      onCancel = jest.fn();
      wrapper = setup({ onCancel, createNewOnOpen: false });
    });

    async function clickCancel() {
      act(() => {
        wrapper.find('.ant-modal-footer button').at(0).simulate('click');
      });
      await waitForComponentToPaint(wrapper);
    }

    function addFilter() {
      act(() => {
        wrapper.find('[aria-label="Add filter"]').at(0).simulate('click');
      });
    }

    it('does not show alert when there is no unsaved filters', async () => {
      await clickCancel();
      expect(onCancel.mock.calls).toHaveLength(1);
    });

    it('shows correct alert message for unsaved filters', async () => {
      addFilter();
      await clickCancel();
      expect(onCancel.mock.calls).toHaveLength(0);
      expect(wrapper.find(Alert).text()).toContain(
        'There are unsaved changes.',
      );
    });
  });
});
