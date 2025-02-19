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
import { useEffect } from 'react';
import { Provider } from 'react-redux';
import { AntdForm, FormInstance } from 'src/components';
import FiltersConfigForm, {
  FilterPanels,
} from 'src/dashboard/components/nativeFilters/FiltersConfigModal/FiltersConfigForm/FiltersConfigForm';
import { mockStoreWithChartsInTabsAndRoot } from 'spec/fixtures/mockStore';

export const createMockedProps = () => ({
  expanded: false,
  filterId: 'DefaultFilterId',
  dependencies: [],
  setErroredFilters: jest.fn(),
  restoreFilter: jest.fn(),
  getAvailableFilters: () => [],
  getDependencySuggestion: () => '',
  save: jest.fn(),
  removedFilters: {},
  handleActiveFilterPanelChange: jest.fn(),
  activeFilterPanelKeys: `DefaultFilterId-${FilterPanels.configuration.key}`,
  isActive: true,
  validateDependencies: jest.fn(),
  onModifyFilter: jest.fn(),
});

interface MockModalProps {
  scope?: object;
  formRef: { current: FormInstance | null };
}

export const createMockModal = ({ scope, formRef }: MockModalProps) => {
  const MockModalComponent = () => {
    const [form] = AntdForm.useForm();

    useEffect(() => {
      // Create a new ref object instead of modifying the parameter
      const currentForm = form;
      Object.defineProperty(formRef, 'current', {
        value: currentForm,
        writable: true,
      });

      if (scope) {
        currentForm.setFieldsValue({
          filters: {
            [createMockedProps().filterId]: {
              scope,
            },
          },
        });
      }
    }, [form]); // Add form to dependency array

    return (
      <Provider store={mockStoreWithChartsInTabsAndRoot}>
        <AntdForm form={form}>
          <FiltersConfigForm form={form} {...createMockedProps()} />
        </AntdForm>
      </Provider>
    );
  };

  return { MockModalComponent };
};

export const getTreeSwitcher = (order = 0) =>
  document.querySelectorAll('.ant-tree-switcher')[order];
